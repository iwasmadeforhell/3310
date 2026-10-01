// Signed, HttpOnly session cookies. Uses Web Crypto only, so it runs in the
// proxy, route handlers and server components alike.
//
// Token format:  <scope>.<expiresAtSeconds>.<nonce>.<hmac>
// The HMAC key is derived from SESSION_SECRET *and* the section's password,
// so changing a password instantly invalidates every existing session.

export type Scope = "portfolio" | "drop" | "admin";

export const COOKIE: Record<Scope, string> = {
  portfolio: "nk_pf",
  drop: "nk_dr",
  admin: "nk_ad",
};

export const MAX_AGE: Record<Scope, number> = {
  portfolio: 60 * 60 * 24 * 7, // 7 days
  drop: 60 * 60 * 24 * 30, // 30 days
  admin: 60 * 60 * 24 * 7, // 7 days
};

const PASSWORD_ENV: Record<Scope, string> = {
  portfolio: "PORTFOLIO_PASSWORD",
  drop: "DROP_PASSWORD",
  admin: "ADMIN_PASSWORD",
};

export function isScope(v: unknown): v is Scope {
  return v === "portfolio" || v === "drop" || v === "admin";
}

function passwordFor(scope: Scope): string {
  return process.env[PASSWORD_ENV[scope]] ?? "";
}

const enc = new TextEncoder();

async function hmac(key: string, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signingKey(scope: Scope): Promise<string | null> {
  const secret = process.env.SESSION_SECRET ?? "";
  const pw = passwordFor(scope);
  if (secret.length < 32 || !pw) return null; // misconfigured -> nobody gets in
  return b64url(await hmac(secret, `key:${scope}:${pw}`));
}

export function isConfigured(scope: Scope): boolean {
  return (process.env.SESSION_SECRET ?? "").length >= 32 && passwordFor(scope).length > 0;
}

export async function createToken(scope: Scope): Promise<string | null> {
  const key = await signingKey(scope);
  if (!key) return null;
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE[scope];
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `${scope}.${exp}.${nonce}`;
  return `${payload}.${b64url(await hmac(key, payload))}`;
}

export async function verifyToken(scope: Scope, token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== scope) return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const key = await signingKey(scope);
  if (!key) return false;
  const expected = b64url(await hmac(key, parts.slice(0, 3).join(".")));
  return safeEqual(expected, parts[3]);
}

/** Constant-time password check (both sides hashed to equal length first). */
export async function checkPassword(scope: Scope, input: string): Promise<boolean> {
  const pw = passwordFor(scope);
  if (!pw || typeof input !== "string" || input.length > 512) return false;
  const salt = process.env.SESSION_SECRET ?? "pw";
  const [a, b] = await Promise.all([hmac(salt, input), hmac(salt, pw)]);
  return safeEqual(b64url(a), b64url(b));
}

/** The admin login also asks for a username. It isn't a secret (the password
 *  is), so it has a default and can be overridden with ADMIN_USERNAME. */
export function checkUsername(scope: Scope, input: unknown): boolean {
  if (scope !== "admin") return true;
  if (typeof input !== "string" || input.length > 64) return false;
  const expected = (process.env.ADMIN_USERNAME || "nokia").trim().toLowerCase();
  return safeEqual(input.trim().toLowerCase(), expected);
}
