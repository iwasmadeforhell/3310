import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Stripe over plain REST (no SDK): one Checkout Session per month bought, and the webhook signature check.

export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;

/** Flattens { a: { b: 1 } } into Stripe's form encoding a[b]=1. */
function form(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") form(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(body),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe HTTP ${res.status}`);
  return json;
}

/** Stripe-Signature: t=<unix>,v1=<hex hmac of "<t>.<body>">. Rejects anything older than 5 minutes. */
export function verifyWebhook(body: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const want = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .some((p) => {
      const got = p.slice(3);
      return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
    });
}
