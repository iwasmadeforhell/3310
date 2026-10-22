import { addPaidMonth, PRICE_CENTS } from "@/lib/store";
import { verifyIpn } from "@/lib/nowpayments";

export const dynamic = "force-dynamic";

type Ipn = {
  payment_id: number | string;
  payment_status: string;
  order_id?: string | null;
  price_amount?: number;
  price_currency?: string;
};

// NOWPayments IPN: called on every status change of a payment. Only "finished" (funds sent to the wallet) adds the month.
// Partial payments are ignored here; they show up in the NOWPayments dashboard to sort out by hand. Safe to receive twice.
export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyIpn(body, req.headers.get("x-nowpayments-sig"))) return new Response("bad signature", { status: 400 });
  const p = JSON.parse(body) as Ipn;
  const userId = p.order_id?.split(".")[0];
  const cents = Math.round(Number(p.price_amount ?? 0) * 100);
  if (p.payment_status === "finished" && userId && cents >= PRICE_CENTS) {
    await addPaidMonth(userId, `np_${p.payment_id}`, cents, p.price_currency ?? "eur");
  }
  return Response.json({ received: true });
}
