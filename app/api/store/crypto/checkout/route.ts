import { randomBytes } from "node:crypto";
import { PRICE_CENTS } from "@/lib/store";
import { cryptoReady, nowpayments } from "@/lib/nowpayments";
import { bad, limited, needUser, origin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// One month of 3310 Client paid in crypto: a NOWPayments invoice priced in EUR. The IPN webhook adds the month once it is paid.
// order_id is "<userId>.<random>" (user ids are base64url, so they never contain a dot).
export async function POST(req: Request) {
  const u = await needUser(req);
  if (u instanceof Response) return u;
  if (!cryptoReady()) return bad("Crypto payments aren't set up yet.", 503);
  if (u.banned) return bad("This account is banned.", 403);
  if (await limited(req, "checkout", 10, 600)) return bad("Too many checkouts. Wait a few minutes.", 429);
  try {
    const inv = await nowpayments<{ invoice_url: string }>("/invoice", {
      price_amount: PRICE_CENTS / 100,
      price_currency: "eur",
      order_id: `${u.id}.${randomBytes(6).toString("hex")}`,
      order_description: "3310 Client - 1 month",
      ipn_callback_url: `${origin()}/api/store/crypto/ipn`,
      success_url: `${origin()}/dashboard?paid=crypto`,
      cancel_url: `${origin()}/purchase?cancelled=1`,
    });
    return Response.json({ url: inv.invoice_url });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
