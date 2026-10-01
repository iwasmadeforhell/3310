// Likes and dislikes on forum posts. Each post has two Redis sets of user ids,
// so one account can only ever count once per post.
import "server-only";
import { hasRedis, redis } from "./redis";

export type Votes = { up: number; down: number; mine: 1 | -1 | 0 };

const upKey = (id: string) => `pv:up:${id}`;
const downKey = (id: string) => `pv:dn:${id}`;

export async function votesFor(postIds: string[], userId?: string): Promise<Record<string, Votes>> {
  const out: Record<string, Votes> = {};
  if (!postIds.length || !hasRedis()) return out;
  const p = redis().pipeline();
  for (const id of postIds) {
    p.scard(upKey(id));
    p.scard(downKey(id));
    if (userId) {
      p.sismember(upKey(id), userId);
      p.sismember(downKey(id), userId);
    }
  }
  const res = await p.exec<number[]>();
  const step = userId ? 4 : 2;
  postIds.forEach((id, i) => {
    const [up, down, likes, dislikes] = res.slice(i * step, i * step + step);
    out[id] = { up: up ?? 0, down: down ?? 0, mine: likes ? 1 : dislikes ? -1 : 0 };
  });
  return out;
}

/** vote: 1 = like, -1 = dislike, 0 = take the vote back. */
export async function castVote(postId: string, userId: string, vote: 1 | -1 | 0): Promise<Votes> {
  const p = redis().pipeline();
  if (vote === 1) p.sadd(upKey(postId), userId);
  else p.srem(upKey(postId), userId);
  if (vote === -1) p.sadd(downKey(postId), userId);
  else p.srem(downKey(postId), userId);
  await p.exec();
  return (await votesFor([postId], userId))[postId];
}

export async function clearVotes(postId: string) {
  await redis().del(upKey(postId), downKey(postId));
}
