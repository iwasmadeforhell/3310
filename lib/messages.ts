// Private messages between two forum accounts.
//
//   pm:<a>:<b>         list of messages in the conversation (a < b, user ids)
//   pm:inbox:<user>    sorted set of the people <user> has talked to, by last message time
//   pm:unread:<user>   hash: other user id -> number of unread messages from them
import "server-only";
import { hasRedis, redis } from "./redis";
import { randomId } from "./id";

export type Message = { id: string; from: string; body: string; at: number };
export type Conversation = { with: string; last: number; unread: number };

export const MAX_BODY = 2000;
const KEEP = 500; // messages kept per conversation; older ones drop off

const threadKey = (a: string, b: string) => `pm:${[a, b].sort().join(":")}`;
const inboxKey = (user: string) => `pm:inbox:${user}`;
const unreadKey = (user: string) => `pm:unread:${user}`;

export async function sendMessage(from: string, to: string, body: string): Promise<Message> {
  const msg: Message = { id: randomId(10), from, body, at: Date.now() };
  const r = redis();
  const key = threadKey(from, to);
  await r.rpush(key, msg);
  await Promise.all([
    r.ltrim(key, -KEEP, -1),
    r.zadd(inboxKey(from), { score: msg.at, member: to }),
    r.zadd(inboxKey(to), { score: msg.at, member: from }),
    r.hincrby(unreadKey(to), from, 1),
  ]);
  return msg;
}

/** The conversation between `me` and `other`, oldest first. Marks it as read for `me`. */
export async function readThread(me: string, other: string): Promise<Message[]> {
  if (!hasRedis()) return [];
  const r = redis();
  const [messages] = await Promise.all([r.lrange<Message>(threadKey(me, other), 0, -1), r.hdel(unreadKey(me), other)]);
  return messages;
}

export async function listConversations(me: string): Promise<Conversation[]> {
  if (!hasRedis()) return [];
  const r = redis();
  const [flat, unread] = await Promise.all([
    r.zrange<(string | number)[]>(inboxKey(me), 0, 99, { rev: true, withScores: true }),
    r.hgetall<Record<string, number>>(unreadKey(me)),
  ]);
  const out: Conversation[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const other = String(flat[i]);
    out.push({ with: other, last: Number(flat[i + 1]), unread: Number(unread?.[other] ?? 0) });
  }
  return out;
}

export async function unreadCount(me: string): Promise<number> {
  if (!hasRedis()) return 0;
  const unread = await redis().hgetall<Record<string, number>>(unreadKey(me));
  return Object.values(unread ?? {}).reduce((n, v) => n + Number(v), 0);
}

/**
 * Delete every conversation an account took part in. Called when the account is
 * deleted, so that someone who later registers the same name can't read them.
 */
export async function purgeMessages(user: string) {
  const r = redis();
  const others = (await r.zrange<(string | number)[]>(inboxKey(user), 0, -1)).map(String);
  await Promise.all([
    ...others.flatMap((o) => [r.del(threadKey(user, o)), r.zrem(inboxKey(o), user), r.hdel(unreadKey(o), user)]),
    r.del(inboxKey(user), unreadKey(user)),
  ]);
}
