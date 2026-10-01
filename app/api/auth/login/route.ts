import { NextResponse } from "next/server";
import { COOKIE, MAX_AGE, checkPassword, checkUsername, createToken, isConfigured, isScope } from "@/lib/session";
import { clientIp, sameOrigin } from "@/lib/auth";
import { clearRateLimit, rateLimited } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });

  let body: { scope?: unknown; username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const { scope, username, password } = body;
  if (!isScope(scope) || typeof password !== "string") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!isConfigured(scope)) {
    return NextResponse.json({ error: "This section isn't set up yet (missing env vars)." }, { status: 503 });
  }

  const limitKey = `login:${scope}:${clientIp(req)}`;
  if (await rateLimited(limitKey, 8, 15 * 60)) {
    return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }

  // Check both so a wrong username and a wrong password look the same.
  const passwordOk = await checkPassword(scope, password);
  if (!checkUsername(scope, username) || !passwordOk) {
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 300));
    const error = scope === "admin" ? "Wrong username or password." : "Wrong password.";
    return NextResponse.json({ error }, { status: 401 });
  }

  await clearRateLimit(limitKey);
  const token = await createToken(scope);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE[scope], token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE[scope],
  });
  return res;
}
