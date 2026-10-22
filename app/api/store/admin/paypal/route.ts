import { paypalOrders, resolvePaypalOrder } from "@/lib/paypal";
import { bad, needAdmin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await needAdmin(req, false);
  if (a instanceof Response) return a;
  return Response.json({ orders: await paypalOrders() });
}

/** { code, action: "confirm" | "dismiss" } */
export async function POST(req: Request) {
  const a = await needAdmin(req);
  if (a instanceof Response) return a;
  const { code, action } = (await req.json().catch(() => ({}))) as { code?: string; action?: string };
  if (!code || (action !== "confirm" && action !== "dismiss")) return bad("Bad request.");
  if (!(await resolvePaypalOrder(code, action === "confirm"))) return bad("Order not found.", 404);
  return Response.json({ orders: await paypalOrders() });
}
