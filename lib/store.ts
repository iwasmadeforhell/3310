import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { hasRedis, redis } from "./redis";

// 3310 Client store: accounts, licences (tier + paid-until), the one hardware id each account is locked to,
// and the Minecraft accounts (by UUID) that may run the mod under it.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

import { isStaffTier, type Tier } from "./tiers";
export { TIERS, isStaffTier, type Tier } from "./tiers";

export type McAccount = { uuid: string; name: string; addedAt: number };

export type StoreUser = {
  id: string;
  createdAt: number;
  email?: string;
  passHash?: string; // scrypt$<salt b64>$<hash b64>
  discordId?: string;
  discordName?: string;
  tier: Tier;
  /** Paid / granted until (ms). null = never expires. 0 = nothing bought yet. */
  expiresAt: number | null;
  hwid?: string;
  hwidSetAt?: number;
  mc: McAccount[];
  banned?: boolean;
  note?: string;
  /** Bumped to sign this user out everywhere (password change, ban). */
  sv: number;
  lastCheck?: number;
  lastVersion?: string;
};

export const MONTH_MS = 30 * 24 * 3600 * 1000;
export const HWID_COOLDOWN_MS = 24 * 3600 * 1000;
export const MC_SLOTS = 3;
export const PRICE_CENTS = 299;

const userKey = (id: string) => `st:user:${id}`;
const emailKey = (email: string) => `st:email:${email}`;
const discordKey = (id: string) => `st:discord:${id}`;
const hwidKey = (hwid: string) => `st:hwid:${hwid}`;
const USERS = "st:users";

export const storeReady = () => hasRedis() && (process.env.SESSION_SECRET ?? "").length >= 32;

export const normEmail = (e: string) => e.trim().toLowerCase();
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
/** HWIDs the mod prints: 3310-XXXXX-XXXXX-XXXXX-XXXXX (base32). */
export const HWID_RE = /^3310(-[A-Z2-7]{5}){4}$/;
export const normHwid = (h: string) => h.trim().toUpperCase();

export function isAdmin(u: StoreUser | null): boolean {
  if (!u) return false;
  // emails and/or Discord user ids, comma or space separated; stray quotes are ignored
  const list = (process.env.STORE_ADMINS ?? "")
    .split(/[,\s;]+/)
    .map((s) => s.replace(/["'`<>]/g, "").trim().toLowerCase())
    .filter(Boolean);
  return (!!u.email && list.includes(u.email)) || (!!u.discordId && list.includes(u.discordId));
}

/** Hardware ids that always get a dev licence (the owner's PCs), set in STORE_DEV_HWIDS. */
export function devHwids(): string[] {
  return (process.env.STORE_DEV_HWIDS ?? "").split(",").map(normHwid).filter(Boolean);
}

export function isActive(u: StoreUser, now = Date.now()): boolean {
  if (u.banned) return false;
  if (isStaffTier(u.tier) || u.expiresAt === null) return true;
  return u.expiresAt > now;
}

export const mcLimit = (u: StoreUser) => (isStaffTier(u.tier) ? Infinity : MC_SLOTS);

export function displayName(u: StoreUser) {
  return u.discordName ?? u.email ?? u.id;
}

// ---- users ---------------------------------------------------------------------------------------

export async function getUser(id: string): Promise<StoreUser | null> {
  const u = await redis().get<StoreUser>(userKey(id));
  return u ? { ...u, mc: u.mc ?? [], sv: u.sv ?? 1 } : null;
}

export async function saveUser(u: StoreUser) {
  await redis().set(userKey(u.id), u);
}

async function newUser(patch: Partial<StoreUser>): Promise<StoreUser> {
  const u: StoreUser = {
    id: randomBytes(9).toString("base64url"),
    createdAt: Date.now(),
    tier: "normal",
    expiresAt: 0,
    mc: [],
    sv: 1,
    ...patch,
  };
  const r = redis();
  await r.set(userKey(u.id), u);
  await r.zadd(USERS, { score: u.createdAt, member: u.id });
  return u;
}

export async function userByEmail(email: string) {
  const id = await redis().get<string>(emailKey(normEmail(email)));
  return id ? getUser(id) : null;
}

export async function userByDiscord(discordId: string) {
  const id = await redis().get<string>(discordKey(discordId));
  return id ? getUser(id) : null;
}

export async function userByHwid(hwid: string) {
  const id = await redis().get<string>(hwidKey(normHwid(hwid)));
  return id ? getUser(id) : null;
}

export async function listUsers(): Promise<StoreUser[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(USERS, 0, 4999, { rev: true });
  if (!ids.length) return [];
  const docs = await r.mget<(StoreUser | null)[]>(...ids.map(userKey));
  return docs.filter((d): d is StoreUser => d !== null).map((u) => ({ ...u, mc: u.mc ?? [], sv: u.sv ?? 1 }));
}

export async function deleteUser(u: StoreUser) {
  const r = redis();
  await Promise.all([
    r.del(userKey(u.id)),
    r.zrem(USERS, u.id),
    u.email ? r.del(emailKey(u.email)) : null,
    u.discordId ? r.del(discordKey(u.discordId)) : null,
    u.hwid ? r.del(hwidKey(u.hwid)) : null,
  ]);
}

// ---- passwords -----------------------------------------------------------------------------------

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function checkPassword(pw: string, stored: string | undefined): Promise<boolean> {
  if (!stored || typeof pw !== "string" || pw.length > 256) return false;
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await scrypt(pw, Buffer.from(salt, "base64"), want.length);
  return timingSafeEqual(want, got);
}

export async function register(email: string, pw: string): Promise<StoreUser | string> {
  const e = normEmail(email);
  if (!EMAIL_RE.test(e)) return "That email doesn't look right.";
  if (typeof pw !== "string" || pw.length < 8) return "Use a password of at least 8 characters.";
  if (pw.length > 200) return "That password is too long.";
  const r = redis();
  const claimed = await r.set(emailKey(e), "pending", { nx: true });
  if (!claimed) return "There is already an account with that email.";
  const u = await newUser({ email: e, passHash: await hashPassword(pw) });
  await r.set(emailKey(e), u.id);
  return u;
}

/** Discord login: the account with this Discord id, else attach it to [current], else a new account. */
export async function loginDiscord(discordId: string, discordName: string, current: StoreUser | null): Promise<StoreUser | string> {
  const r = redis();
  const existing = await userByDiscord(discordId);
  if (existing) {
    if (current && current.id !== existing.id) return "That Discord account is already linked to another 3310 account.";
    if (existing.discordName !== discordName) await saveUser({ ...existing, discordName });
    return { ...existing, discordName };
  }
  if (current) {
    const next = { ...current, discordId, discordName };
    await saveUser(next);
    await r.set(discordKey(discordId), current.id);
    return next;
  }
  const u = await newUser({ discordId, discordName });
  await r.set(discordKey(discordId), u.id);
  return u;
}

// ---- hardware id ---------------------------------------------------------------------------------

/** Bind [hwid] to this account. One per account; changing it is allowed once every 24 hours. */
export async function setHwid(u: StoreUser, raw: string, force = false): Promise<StoreUser | string> {
  const hwid = normHwid(raw);
  if (!HWID_RE.test(hwid)) return "That isn't a 3310 hardware id. Copy it from the prompt in Minecraft (it starts with 3310-).";
  if (u.hwid === hwid) return u;
  if (!force && u.hwid && u.hwidSetAt && Date.now() - u.hwidSetAt < HWID_COOLDOWN_MS) {
    const left = HWID_COOLDOWN_MS - (Date.now() - u.hwidSetAt);
    return `You can change your hardware id again in ${fmtLeft(left)}.`;
  }
  const r = redis();
  const owner = await r.get<string>(hwidKey(hwid));
  if (owner && owner !== u.id) return "That PC is already verified on another account.";
  if (u.hwid) await r.del(hwidKey(u.hwid));
  await r.set(hwidKey(hwid), u.id);
  const next = { ...u, hwid, hwidSetAt: Date.now() };
  await saveUser(next);
  return next;
}

export async function clearHwid(u: StoreUser): Promise<StoreUser> {
  if (u.hwid) await redis().del(hwidKey(u.hwid));
  const next = { ...u, hwid: undefined, hwidSetAt: undefined };
  await saveUser(next);
  return next;
}

export function fmtLeft(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.max(1, Math.ceil((ms % 3600000) / 60000));
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

// ---- purchases -----------------------------------------------------------------------------------

/** Adds one paid month (from today, or from the current end if still running). Idempotent per payment id. */
export async function addPaidMonth(userId: string, paymentId: string, amount: number, currency: string): Promise<boolean> {
  const r = redis();
  const fresh = await r.set(`st:pay:${paymentId}`, userId, { nx: true });
  if (!fresh) return false;
  const u = await getUser(userId);
  if (!u) return false;
  if (u.expiresAt !== null) {
    const from = Math.max(Date.now(), u.expiresAt ?? 0);
    await saveUser({ ...u, expiresAt: from + MONTH_MS });
  }
  await r.lpush(`st:payments:${userId}`, { id: paymentId, amount, currency, at: Date.now() });
  return true;
}

export type Payment = { id: string; amount: number; currency: string; at: number };

export async function payments(userId: string): Promise<Payment[]> {
  return (await redis().lrange<Payment>(`st:payments:${userId}`, 0, 49)) ?? [];
}

// ---- sessions ------------------------------------------------------------------------------------

export const STORE_COOKIE = "nk_st";
const SESSION_DAYS = 30;

function sign(data: string) {
  return createHmac("sha256", `store:${process.env.SESSION_SECRET ?? ""}`).update(data).digest("base64url");
}

export function sessionToken(u: StoreUser) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  const payload = `${u.id}.${exp}.${u.sv}`;
  return `${payload}.${sign(payload)}`;
}

export const sessionCookie = (value: string, maxAge = SESSION_DAYS * 86400) => ({
  name: STORE_COOKIE,
  value,
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export async function userFromToken(token: string | undefined): Promise<StoreUser | null> {
  if (!token || !storeReady()) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [id, exp, sv, mac] = parts;
  const want = sign(`${id}.${exp}.${sv}`);
  if (want.length !== mac.length || !timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const u = await getUser(id);
  if (!u || String(u.sv) !== sv) return null;
  return u;
}

/** The signed-in store user (server components and route handlers). */
export async function currentUser(): Promise<StoreUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(STORE_COOKIE)?.value);
}

/** Public view of an account (never the password hash). */
export function publicUser(u: StoreUser) {
  const { passHash: _p, sv: _s, ...rest } = u;
  return { ...rest, hasPassword: !!u.passHash, active: isActive(u), admin: isAdmin(u) };
}
