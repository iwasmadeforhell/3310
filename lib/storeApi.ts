import "server-only";
import { clientIp, sameOrigin } from "./auth";
import { rateLimited } from "./redis";
import { currentUser, isAdmin, sessionCookie, sessionToken, storeReady, type StoreUser } from "./store";

export const bad = (error: string, status = 400) => Response.json({ error }, { status });

/** The signed-in user for a request (state-changing ones must be same-origin), or an error Response. */
export async function needUser(req: Request, mutating = true): Promise<StoreUser | Response> {
  if (!storeReady()) return bad("The store isn't configured yet.", 503);
  if (mutating && !sameOrigin(req)) return bad("Bad origin", 403);
  const u = await currentUser();
  if (!u) return bad("Please log in.", 401);
  return u;
}

export async function needAdmin(req: Request, mutating = true): Promise<StoreUser | Response> {
  const u = await needUser(req, mutating);
  if (u instanceof Response) return u;
  return isAdmin(u) ? u : bad("Admins only.", 403);
}

export async function limited(req: Request, what: string, n: number, sec: number) {
  return rateLimited(`st:${what}:${clientIp(req)}`, n, sec);
}

type Cookie = { name: string; value: string; maxAge: number; path: string; httpOnly: boolean; secure: boolean; sameSite: string };

export function serialize(c: Cookie) {
  const same = c.sameSite[0].toUpperCase() + c.sameSite.slice(1);
  return `${c.name}=${c.value}; Max-Age=${c.maxAge}; Path=${c.path}; ${c.httpOnly ? "HttpOnly; " : ""}${c.secure ? "Secure; " : ""}SameSite=${same}`;
}

/** JSON response that also signs the user in. */
export function withSession(u: StoreUser, body: unknown = { ok: true }) {
  const res = Response.json(body);
  res.headers.append("Set-Cookie", serialize(sessionCookie(sessionToken(u))));
  return res;
}

export const origin = () => `https://${process.env.ROOT_DOMAIN ?? "3310.nz"}`;

/** Only same-site paths are allowed as a "next" redirect. */
export const safeNext = (n: string | null | undefined) => (n && /^\/[A-Za-z0-9/?=&_-]*$/.test(n) && !n.startsWith("//") ? n : "/dashboard");
