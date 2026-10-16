import { sameOrigin } from "@/lib/auth";
import { checkPassword, storeReady, userByEmail } from "@/lib/store";
import { bad, limited, withSession } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!storeReady()) return bad("The store isn't configured yet.", 503);
  if (!sameOrigin(req)) return bad("Bad origin", 403);
  if (await limited(req, "login", 10, 900)) return bad("Too many attempts. Wait a few minutes.", 429);
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const u = b.email ? await userByEmail(String(b.email)) : null;
  if (!u || !(await checkPassword(String(b.password ?? ""), u.passHash))) return bad("Wrong email or password.", 401);
  if (u.banned) return bad("This account is banned.", 403);
  return withSession(u);
}
