import "server-only";
import { createHash, randomBytes, verify } from "node:crypto";
import { hasRedis, redis } from "./redis";

// 3310 Client <-> Discord alerts.
//
// Each Minecraft account running the mod gets its own secret token from /api/macro/pair, together with a short
// one-time code. Typing /link <code> in Discord binds that token to the Discord user, so any number of people can
// link any number of accounts. The token is only ever stored hashed.

export type MacroAccount = {
  uuid: string;
  name: string;
  createdAt: number;
  discordId?: string;
  discordName?: string;
  linkedAt?: number;
  lastSeen?: number;
  lastStatus?: string;
};

export type MacroUserCfg = {
  /** "dm" (default) or "channel": alerts go to [channel] and ping the user there. */
  mode: "dm" | "channel";
  channel?: string;
  /** Status updates (the every-5-15-minute ones). Alerts are always sent. */
  updates: boolean;
};

const acctKey = (hash: string) => `macro:acct:${hash}`;
const pairKey = (code: string) => `macro:pair:${code}`;
const userKey = (discordId: string) => `macro:user:${discordId}`; // set of account hashes
const cfgKey = (discordId: string) => `macro:cfg:${discordId}`;
const dmKey = (discordId: string) => `macro:dm:${discordId}`;

export const PAIR_TTL_SEC = 15 * 60;
/** Discord's upload limit for bots without a boosted server. */
export const MAX_UPLOAD = 10 * 1024 * 1024;
export const CHUNK_PREFIX = "macro-tmp/";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function macroReady(): string | null {
  if (!hasRedis()) return "Redis is not configured";
  if (!process.env.DISCORD_BOT_TOKEN) return "DISCORD_BOT_TOKEN is not set";
  return null;
}

/** New account token + pairing code for a Minecraft account. */
export async function createPairing(uuid: string, name: string) {
  const r = redis();
  const token = randomBytes(32).toString("base64url");
  const hash = hashToken(token);
  let code = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = randomBytes(6);
    code = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
    const ok = await r.set(pairKey(code), hash, { nx: true, ex: PAIR_TTL_SEC });
    if (ok) break;
    code = "";
  }
  if (!code) throw new Error("Could not make a pairing code");
  const acct: MacroAccount = { uuid, name, createdAt: Date.now() };
  await r.set(acctKey(hash), acct);
  return { token, code };
}

export async function accountFor(req: Request): Promise<{ hash: string; acct: MacroAccount } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(auth);
  if (!m) return null;
  const hash = hashToken(m[1]);
  const acct = await redis().get<MacroAccount>(acctKey(hash));
  return acct ? { hash, acct } : null;
}

export async function touchAccount(hash: string, acct: MacroAccount, patch: Partial<MacroAccount>) {
  const next = { ...acct, ...patch };
  await redis().set(acctKey(hash), next);
  return next;
}

/** /link <code>: binds the account behind the code to this Discord user. Same Minecraft account linked again replaces the old link. */
export async function linkCode(code: string, discordId: string, discordName: string): Promise<MacroAccount | null> {
  const r = redis();
  const c = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(c)) return null;
  const hash = await r.getdel<string>(pairKey(c));
  if (!hash) return null;
  const acct = await r.get<MacroAccount>(acctKey(hash));
  if (!acct) return null;
  // an older link of the same Minecraft account (any Discord user) stops receiving alerts
  for (const old of await listAccounts(discordId)) {
    if (old.acct.uuid === acct.uuid && old.hash !== hash) await unlinkHash(old.hash, discordId);
  }
  const next: MacroAccount = { ...acct, discordId, discordName, linkedAt: Date.now() };
  await r.set(acctKey(hash), next);
  await r.sadd(userKey(discordId), hash);
  return next;
}

export async function listAccounts(discordId: string): Promise<{ hash: string; acct: MacroAccount }[]> {
  const r = redis();
  const hashes = await r.smembers<string[]>(userKey(discordId));
  if (!hashes.length) return [];
  const docs = await r.mget<(MacroAccount | null)[]>(...hashes.map(acctKey));
  const out: { hash: string; acct: MacroAccount }[] = [];
  hashes.forEach((h, i) => {
    const d = docs[i];
    if (d && d.discordId === discordId) out.push({ hash: h, acct: d });
    else r.srem(userKey(discordId), h).catch(() => {});
  });
  return out.sort((a, b) => a.acct.name.localeCompare(b.acct.name));
}

/** Deletes the account token entirely: the mod has to pair again. */
export async function unlinkHash(hash: string, discordId: string) {
  const r = redis();
  await Promise.all([r.del(acctKey(hash)), r.srem(userKey(discordId), hash)]);
}

export async function getCfg(discordId: string): Promise<MacroUserCfg> {
  const c = await redis().get<MacroUserCfg>(cfgKey(discordId));
  return { mode: c?.mode ?? "dm", channel: c?.channel, updates: c?.updates ?? true };
}

export async function setCfg(discordId: string, patch: Partial<MacroUserCfg>) {
  const next = { ...(await getCfg(discordId)), ...patch };
  await redis().set(cfgKey(discordId), next);
  return next;
}

// ---- Discord ------------------------------------------------------------------------------------

const API = "https://discord.com/api/v10";

function botHeaders(): Record<string, string> {
  return { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`, "User-Agent": "DiscordBot (https://3310.nz, 1.0)" };
}

export class DiscordError extends Error {
  constructor(public status: number, public code: number | undefined, message: string) {
    super(message);
  }
}

async function discord(path: string, init: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}${path}`, { ...init, headers: { ...botHeaders(), ...(init.headers as Record<string, string>) } });
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      await new Promise((ok) => setTimeout(ok, Math.min(5, body.retry_after ?? 1) * 1000));
      continue;
    }
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const j = json as { code?: number; message?: string } | null;
      throw new DiscordError(res.status, j?.code, j?.message ?? `Discord HTTP ${res.status}`);
    }
    return json;
  }
  throw new DiscordError(429, undefined, "Discord rate limit");
}

async function dmChannel(discordId: string): Promise<string> {
  const r = redis();
  const cached = await r.get<string>(dmKey(discordId));
  if (cached) return cached;
  const ch = (await discord("/users/@me/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: discordId }),
  })) as { id: string };
  await r.set(dmKey(discordId), ch.id, { ex: 30 * 24 * 3600 });
  return ch.id;
}

export type Embed = {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  author?: { name: string; icon_url?: string };
  image?: { url: string };
  timestamp?: string;
};

export type OutFile = { name: string; type: string; data: Uint8Array };

/** Send to where this Discord user wants alerts (their DMs or a chosen channel). */
export async function deliver(discordId: string, cfg: MacroUserCfg, embed: Embed, ping: boolean, files: OutFile | OutFile[] = []) {
  const list = Array.isArray(files) ? files : [files];
  const channel = cfg.mode === "channel" && cfg.channel ? cfg.channel : await dmChannel(discordId);
  const inChannel = channel === cfg.channel;
  const payload = {
    content: inChannel && ping ? `<@${discordId}>` : undefined,
    embeds: [embed],
    allowed_mentions: { users: inChannel && ping ? [discordId] : [] },
    attachments: list.length ? list.map((f, i) => ({ id: i, filename: f.name })) : undefined,
  };
  if (!list.length) {
    return discord(`/channels/${channel}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  const form = new FormData();
  form.set("payload_json", JSON.stringify(payload));
  list.forEach((f, i) => form.set(`files[${i}]`, new Blob([f.data as BlobPart], { type: f.type }), f.name));
  return discord(`/channels/${channel}/messages`, { method: "POST", body: form });
}

/** Ed25519 check of an interaction request (Discord drops the endpoint if this is wrong). */
export function verifyInteraction(body: string, signature: string | null, timestamp: string | null): boolean {
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (!key || !signature || !timestamp || !/^[0-9a-f]{64}$/i.test(key) || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  try {
    return verify(
      null,
      Buffer.from(timestamp + body),
      { key: { kty: "OKP", crv: "Ed25519", x: Buffer.from(key, "hex").toString("base64url") }, format: "jwk" },
      Buffer.from(signature, "hex"),
    );
  } catch {
    return false;
  }
}

export const clip = (s: unknown, n: number) => (typeof s === "string" ? (s.length > n ? s.slice(0, n - 1) + "…" : s) : "");

export const COLORS = { alert: 0xe5484d, warn: 0xf5a524, status: 0xa2cffe, info: 0x46a758 } as const;
