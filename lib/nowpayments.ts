import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// NOWPayments over plain REST: one hosted invoice per month bought (buyer picks the coin), and the IPN signature check.

export const cryptoReady = () => !!process.env.NOWPAYMENTS_API_KEY && !!process.env.NOWPAYMENTS_IPN_SECRET;

export async function nowpayments<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.nowpayments.io/v1${path}`, {
    method: "POST",
    headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { message?: string };
  if (!res.ok) throw new Error(json.message ?? `NOWPayments HTTP ${res.status}`);
  return json;
}

/** Copy of a JSON value with every object's keys sorted, which is what NOWPayments signs. */
function sorted(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sorted);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, sorted((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

/** x-nowpayments-sig: hex HMAC-SHA512 of the key-sorted JSON body, keyed with the IPN secret. */
export function verifyIpn(body: string, header: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !header) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  const want = createHmac("sha512", secret).update(JSON.stringify(sorted(parsed))).digest("hex");
  const got = header.trim().toLowerCase();
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
