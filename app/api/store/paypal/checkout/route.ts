import { paypalLink, paypalOrderFor, paypalReady } from "@/lib/paypal";
import { bad, limited, needUser } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// One month of 3310 Client paid over PayPal.me: hands out the buyer's reference code and the payment link.
export async function POST(req: Request) {
  const u = await needUser(req);
  if (u instanceof Response) return u;
  if (!paypalReady()) return bad("PayPal payments aren't set up yet.", 503);
  if (u.banned) return bad("This account is banned.", 403);
  if (await limited(req, "checkout", 10, 600)) return bad("Too many checkouts. Wait a few minutes.", 429);
  const o = await paypalOrderFor(u.id, u.discordName ?? u.email ?? u.id);
  return Response.json({ code: o.code, url: paypalLink() });
}
