// Forum accounts for forum.3310.nz.
//
// Registered users live in Redis (`us:<id>`, id = lower-cased name). The owner
// is not stored there: it is the ADMIN_USERNAME / ADMIN_PASSWORD login from the
// env vars, so it can never be demoted, deleted or locked out from the site.
//
// Session cookie:  u.<expiresAtSeconds>.<id>.<passwordTag>.<hmac>
// The role is NOT in the cookie. It is read from Redis on every request, so a
// role change, password change or deleted account takes effect immediately.
import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { hasSession } from "./auth";
import { hasRedis, redis } from "./redis";

export const ROLES = ["member", "moderator", "admin"] as const;
export type Role = (typeof ROLES)[number];

type StoredUser = { id: string; name: string; role: Role; color: string; createdAt: number; salt: string; hash: string };
/** What pages and API responses are allowed to see: never the password hash. */
export type PublicUser = { id: string; name: string; role: Role; color: string; createdAt?: number; owner?: boolean; deleted?: boolean };

export const USER_COOKIE = "nk_u";
export const USER_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
export const OWNER_NAME = "Nokia";
export const DEFAULT_COLOR = "#a2cffe";

const USER_INDEX = "us:index";
const userKey = (id: string) => `us:${id}`;

export const NAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
const RESERVED = ["nokia", "admin", "owner", "moderator", "mod", "staff", "system", "deleted", "3310"];

export function ownerId(): string {
  return (process.env.ADMIN_USERNAME || "nokia").trim().toLowerCase();
}

export const isAdmin = (u: PublicUser | null | undefined) => u?.role === "admin";
export const isStaff = (u: PublicUser | null | undefined) => u?.role === "admin" || u?.role === "moderator";

function owner(): PublicUser {
  return { id: ownerId(), name: OWNER_NAME, role: "admin", color: "", owner: true };
}

/** Names sit on a dark chip, so very dark colours are refused. */
export function validColor(v: unknown): v is string {
  if (typeof v !== "string" || !/^#[0-9a-fA-F]{6}$/.test(v)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b >= 0.16;
}

function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 32, (err, key) => (err ? reject(err) : resolve(key.toString("base64url")))),
  );
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const toPublic = ({ id, name, role, color, createdAt }: StoredUser): PublicUser => ({ id, name, role, color, createdAt });

export async function getUser(id: string): Promise<PublicUser | null> {
  if (!hasRedis() || !/^[a-z0-9_-]{3,20}$/.test(id)) return null;
  const u = await redis().get<StoredUser>(userKey(id));
  return u ? toPublic(u) : null;
}

export async function listUsers(): Promise<PublicUser[]> {
  if (!hasRedis()) return [];
  const r = redis();
  const ids = await r.zrange<string[]>(USER_INDEX, 0, 999, { rev: true });
  if (!ids.length) return [];
  const docs = await r.mget<(StoredUser | null)[]>(...ids.map(userKey));
  return docs.filter((d): d is StoredUser => d !== null).map(toPublic);
}

/** Look up several authors at once. The owner and deleted accounts are filled in too. */
export async function usersById(ids: string[], fallbackNames: Record<string, string> = {}): Promise<Record<string, PublicUser>> {
  const out: Record<string, PublicUser> = { [ownerId()]: owner() };
  const wanted = [...new Set(ids)].filter((id) => id !== ownerId());
  if (!wanted.length || !hasRedis()) return out;
  const docs = await redis().mget<(StoredUser | null)[]>(...wanted.map(userKey));
  wanted.forEach((id, i) => {
    const d = docs[i];
    out[id] = d ? toPublic(d) : { id, name: fallbackNames[id] ?? id, role: "member", color: "", deleted: true };
  });
  return out;
}

/** Why a sign-up can't go ahead, or null if the details are fine. */
export function signupProblem(name: string, password: string, color: string): string | null {
  if (!NAME_RE.test(name)) return "User names are 3–20 characters: letters, numbers, _ and -.";
  const id = name.toLowerCase();
  if (id === ownerId() || RESERVED.includes(id)) return "That user name is taken.";
  if (password.length < 8 || password.length > 200) return "Passwords need at least 8 characters.";
  if (!validColor(color)) return "Pick a brighter name colour (it sits on a dark background).";
  return null;
}

export async function createUser(name: string, password: string, color: string): Promise<PublicUser | { error: string }> {
  const problem = signupProblem(name, password, color);
  if (problem) return { error: problem };
  const id = name.toLowerCase();

  const salt = randomBytes(16).toString("base64url");
  const user: StoredUser = { id, name, role: "member", color: color.toLowerCase(), createdAt: Date.now(), salt, hash: await hashPassword(password, salt) };
  const r = redis();
  // nx: only succeeds if the name is still free, so two sign-ups can't share it.
  const created = await r.set(userKey(id), user, { nx: true });
  if (created !== "OK") return { error: "That user name is taken." };
  await r.zadd(USER_INDEX, { score: user.createdAt, member: id });
  return toPublic(user);
}

/** Returns the user if the password matches, else null. */
export async function checkUserPassword(name: string, password: string): Promise<PublicUser | null> {
  const id = name.trim().toLowerCase();
  if (!hasRedis() || !/^[a-z0-9_-]{3,20}$/.test(id) || password.length > 200) return null;
  const u = await redis().get<StoredUser>(userKey(id));
  // Hash even when the user doesn't exist, so both cases take the same time.
  const hash = await hashPassword(password, u?.salt ?? "no-such-user");
  return u && safeEqual(hash, u.hash) ? toPublic(u) : null;
}

async function patchUser(id: string, patch: Partial<Pick<StoredUser, "role" | "color">>): Promise<PublicUser | null> {
  const r = redis();
  const u = await r.get<StoredUser>(userKey(id));
  if (!u) return null;
  const next = { ...u, ...patch };
  await r.set(userKey(id), next);
  return toPublic(next);
}
export const setRole = (id: string, role: Role) => patchUser(id, { role });
export const setColor = (id: string, color: string) => patchUser(id, { color: color.toLowerCase() });

export async function deleteUser(id: string) {
  const r = redis();
  await Promise.all([r.del(userKey(id)), r.zrem(USER_INDEX, id)]);
}

// ---------- session cookie ----------

function sign(payload: string): string | null {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 32) return null; // misconfigured -> nobody gets in
  return createHmac("sha256", secret).update(`forum-user:${payload}`).digest("base64url");
}

export async function createUserToken(id: string): Promise<string | null> {
  const u = hasRedis() ? await redis().get<StoredUser>(userKey(id)) : null;
  if (!u) return null;
  const payload = `u.${Math.floor(Date.now() / 1000) + USER_MAX_AGE}.${id}.${u.hash.slice(0, 10)}`;
  const sig = sign(payload);
  return sig ? `${payload}.${sig}` : null;
}

async function userFromToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "u") return null;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const expected = sign(parts.slice(0, 4).join("."));
  if (!expected || !safeEqual(expected, parts[4])) return null;
  if (!hasRedis()) return null;
  const u = await redis().get<StoredUser>(userKey(parts[2]));
  // The tag ties the cookie to the password it was issued for.
  return u && safeEqual(u.hash.slice(0, 10), parts[3]) ? toPublic(u) : null;
}

/** Who is making this request: the owner, a registered user, or nobody. */
export async function currentUser(): Promise<PublicUser | null> {
  if (await hasSession("admin")) return owner();
  const jar = await cookies();
  return userFromToken(jar.get(USER_COOKIE)?.value);
}
