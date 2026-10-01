// Register and log in on old.3310.nz. The owner logs in through the same form:
// if the user name is the admin user name, the ADMIN_PASSWORD check is used.
import { NextResponse } from "next/server";
import { COOKIE, MAX_AGE, checkPassword, checkUsername, createToken, isConfigured } from "@/lib/session";
import { clientIp, sameOrigin } from "@/lib/auth";
import { clearRateLimit, hasRedis, rateLimited } from "@/lib/redis";
import { USER_COOKIE, USER_MAX_AGE, checkUserPassword, createUser, createUserToken, getUser, signupProblem } from "@/lib/users";

export const dynamic = "force-dynamic";

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Bad origin", 403);
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password || username.length > 64) return fail("Bad request", 400);
  if (!hasRedis()) return fail("The database isn't connected yet.", 503);
  const ip = clientIp(req);

  if (body.action === "register") {
    const color = typeof body.color === "string" ? body.color : "";
    // Typos and taken names don't count towards the limit, only real sign-ups do.
    const problem = signupProblem(username, password, color) ?? ((await getUser(username.toLowerCase())) ? "That user name is taken." : null);
    if (problem) return fail(problem, 400);
    if (await rateLimited(`register:${ip}`, 3, 60 * 60)) return fail("Too many new accounts from here. Try again in an hour.", 429);
    const user = await createUser(username, password, color);
    if ("error" in user) return fail(user.error, 400);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(USER_COOKIE, (await createUserToken(user.id))!, cookieOptions(USER_MAX_AGE));
    return res;
  }

  const limitKey = `login:forum:${ip}`;
  if (await rateLimited(limitKey, 8, 15 * 60)) return fail("Too many attempts. Try again in 15 minutes.", 429);

  const res = NextResponse.json({ ok: true });
  if (checkUsername("admin", username)) {
    if (!isConfigured("admin") || !(await checkPassword("admin", password))) return wrong();
    res.cookies.set(COOKIE.admin, (await createToken("admin"))!, cookieOptions(MAX_AGE.admin));
  } else {
    const user = await checkUserPassword(username, password);
    const token = user && (await createUserToken(user.id));
    if (!token) return wrong();
    res.cookies.set(USER_COOKIE, token, cookieOptions(USER_MAX_AGE));
  }
  await clearRateLimit(limitKey);
  return res;
}

async function wrong() {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 300));
  return fail("Wrong username or password.", 401);
}
