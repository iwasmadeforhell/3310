import { check, signAnswer, validUuid } from "@/lib/license";
import { HWID_RE, normHwid, storeReady } from "@/lib/store";
import { rateLimited } from "@/lib/redis";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { hwid, uuid, name, nonce, version } from the mod -> a signed licence answer.
export async function POST(req: Request) {
  if (!storeReady()) return Response.json({ error: "Store not configured" }, { status: 503 });
  if (await rateLimited(`lic:${clientIp(req)}`, 60, 600)) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hwid = typeof body?.hwid === "string" ? normHwid(body.hwid) : "";
  const nonce = typeof body?.nonce === "string" ? body.nonce : "";
  if (!HWID_RE.test(hwid) || !validUuid(body?.uuid) || !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const answer = await check(hwid, body!.uuid as string, String(body?.name ?? ""), nonce, String(body?.version ?? ""));
  return Response.json(signAnswer(answer), { headers: { "Cache-Control": "no-store" } });
}
