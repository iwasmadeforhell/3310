import { PRICE_CENTS } from "@/lib/store";
import { stripe, stripeReady } from "@/lib/stripe";
import { bad, limited, needUser, origin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// Card payments are off for now (no button on /purchase). Set to false to turn them back on.
const CARD_PAUSED = true;

// One month of 3310 Client: a Stripe Checkout payment of 2.99 EUR. The webhook adds the month once it is paid.
export async function POST(req: Request) {
  const u = await needUser(req);
  if (u instanceof Response) return u;
  if (CARD_PAUSED) return bad("Card payments are paused. Pay with crypto or PayPal instead.", 503);
  if (!stripeReady()) return bad("Payments aren't set up yet.", 503);
  if (u.banned) return bad("This account is banned.", 403);
  if (await limited(req, "checkout", 10, 600)) return bad("Too many checkouts. Wait a few minutes.", 429);
  try {
    const s = await stripe<{ url: string }>("/checkout/sessions", {
      mode: "payment",
      client_reference_id: u.id,
      metadata: { userId: u.id, product: "month" },
      payment_intent_data: { metadata: { userId: u.id } },
      line_items: {
        0: {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: PRICE_CENTS,
            // tax code: Stripe's "electronically supplied services" - required by Managed Payments (Stripe handles the VAT)
            product_data: {
              name: "3310 Client - 1 month",
              description: "30 days of 3310 Client for one PC and up to 3 Minecraft accounts",
              tax_code: "txcd_10000000",
            },
          },
        },
      },
      customer_email: u.email,
      success_url: `${origin()}/dashboard?paid=1`,
      cancel_url: `${origin()}/purchase?cancelled=1`,
    });
    return Response.json({ url: s.url });
  } catch (e) {
    return bad((e as Error).message, 502);
  }
}
