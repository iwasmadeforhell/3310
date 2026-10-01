import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/session";
import { sameOrigin } from "@/lib/auth";
import { USER_COOKIE } from "@/lib/users";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  for (const name of [...Object.values(COOKIE), USER_COOKIE]) {
    res.cookies.set(name, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}
