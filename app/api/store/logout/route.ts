import { sessionCookie } from "@/lib/store";
import { serialize } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", serialize(sessionCookie("", 0)));
  return res;
}
