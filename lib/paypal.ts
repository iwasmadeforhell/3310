import "server-only";
import { randomBytes } from "node:crypto";
import { redis } from "./redis";
import { addPaidMonth, getUser, PRICE_CENTS } from "./store";

// PayPal to a personal account: no API, so each buyer gets a reference code to put in the PayPal note,
// and an admin confirms the payment by hand on /admin, which adds the month.

export type PaypalOrder = { code: string; userId: string; who: string; at: number };

const ORDERS = "st:pp:orders"; // hash code -> PaypalOrder
const userOrderKey = (userId: string) => `st:pp:user:${userId}`;

export const paypalReady = () => !!process.env.PAYPAL_ME;

export const paypalLink = () => `https://paypal.me/${process.env.PAYPAL_ME}/${(PRICE_CENTS / 100).toFixed(2)}EUR`;

/** The user's open order, or a new one. One open order per user so repeat clicks don't pile up. */
export async function paypalOrderFor(userId: string, who: string): Promise<PaypalOrder> {
  const r = redis();
  const open = await r.get<string>(userOrderKey(userId));
  if (open) {
    const o = await r.hget<PaypalOrder>(ORDERS, open);
    if (o) return o;
  }
  const o: PaypalOrder = { code: `3310-${randomBytes(4).toString("hex").toUpperCase()}`, userId, who, at: Date.now() };
  await r.hset(ORDERS, { [o.code]: o });
  await r.set(userOrderKey(userId), o.code);
  const { alertOwner } = await import("./ownerAlerts");
  await alertOwner({
    title: "🕓 PayPal order waiting",
    description: `**${who}** started a PayPal payment with code \`${o.code}\`. When the money (with that code in the note) is in your PayPal, confirm it in 3310.nz/admin.`,
    color: 0xf5a524,
  });
  return o;
}

export async function paypalOrders(): Promise<PaypalOrder[]> {
  const all = (await redis().hgetall<Record<string, PaypalOrder>>(ORDERS)) ?? {};
  return Object.values(all).sort((a, b) => b.at - a.at);
}

/** Confirm (adds the month) or dismiss an open order. */
export async function resolvePaypalOrder(code: string, confirm: boolean): Promise<boolean> {
  const r = redis();
  const o = await r.hget<PaypalOrder>(ORDERS, code);
  if (!o) return false;
  if (confirm) {
    if (!(await getUser(o.userId))) return false;
    await addPaidMonth(o.userId, `pp_${o.code}`, PRICE_CENTS, "eur");
  }
  await r.hdel(ORDERS, code);
  if ((await r.get<string>(userOrderKey(o.userId))) === code) await r.del(userOrderKey(o.userId));
  return true;
}
