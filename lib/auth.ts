import "server-only";
import { cookies } from "next/headers";
import { COOKIE, type Scope, verifyToken } from "./session";

/** Server-side session check. Every protected page AND route handler calls this
 *  directly — the proxy redirect is only a convenience, never the real gate. */
export async function hasSession(scope: Scope): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(scope, jar.get(COOKIE[scope])?.value);
}

export async function canViewPortfolio(): Promise<boolean> {
  return (await hasSession("portfolio")) || (await hasSession("admin"));
}

/** Basic CSRF guard for state-changing requests: the Origin must match the Host. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function unauthorized(msg = "Unauthorized") {
  return Response.json({ error: msg }, { status: 401 });
}

export function forbidden(msg = "Forbidden") {
  return Response.json({ error: msg }, { status: 403 });
}

/** Returns an error Response if the request lacks `scope`, else null. */
export async function guard(req: Request, scope: Scope | "portfolio-view", mutating = true) {
  if (mutating && !sameOrigin(req)) return forbidden("Bad origin");
  const ok = scope === "portfolio-view" ? await canViewPortfolio() : await hasSession(scope);
  return ok ? null : unauthorized();
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
