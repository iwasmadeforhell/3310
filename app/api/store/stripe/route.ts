import { addPaidMonth } from "@/lib/store";
import { verifyWebhook } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type CheckoutSession = {
  id: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
};

// Stripe webhook (checkout.session.completed / async_payment_succeeded): adds the paid month. Safe to receive twice.
export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyWebhook(body, req.headers.get("stripe-signature"))) return new Response("bad signature", { status: 400 });
  const event = JSON.parse(body) as { type: string; data: { object: CheckoutSession } };
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    const userId = s.client_reference_id ?? s.metadata?.userId;
    if (userId && s.payment_status === "paid") {
      await addPaidMonth(userId, s.id, s.amount_total ?? 0, s.currency ?? "eur");
    }
  }
  return Response.json({ received: true });
}
