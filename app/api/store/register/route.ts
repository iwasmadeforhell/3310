import { sameOrigin } from "@/lib/auth";
import { register, storeReady } from "@/lib/store";
import { bad, limited, withSession } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!storeReady()) return bad("The store isn't configured yet.", 503);
  if (!sameOrigin(req)) return bad("Bad origin", 403);
  if (await limited(req, "reg", 5, 3600)) return bad("Too many sign-ups from here. Try again later.", 429);
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const u = await register(String(b.email ?? ""), String(b.password ?? ""));
  if (typeof u === "string") return bad(u);
  return withSession(u);
}
