import { modAccess, signUpdate } from "@/lib/license";
import { buildFor } from "@/lib/modUpdate";
import { releaseSha } from "@/lib/releases";
import { HWID_RE, normHwid, storeReady } from "@/lib/store";
import { rateLimited } from "@/lib/redis";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { hwid, nonce, version } from the mod -> the build it should run, signed (the mod checks the signature and
// the jar's SHA-256 before installing it).
export async function POST(req: Request) {
  if (!storeReady()) return Response.json({ error: "Store not configured" }, { status: 503 });
  if (await rateLimited(`upd:${clientIp(req)}`, 60, 600)) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hwid = typeof body?.hwid === "string" ? normHwid(body.hwid) : "";
  const nonce = typeof body?.nonce === "string" ? body.nonce : "";
  if (!HWID_RE.test(hwid) || !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) return Response.json({ error: "Bad request" }, { status: 400 });
  const access = await modAccess(hwid);
  if ("error" in access) return Response.json({ error: access.error }, { status: 403 });
  const rel = await buildFor(access.tier);
  if (!rel) return Response.json({ status: "none" }, { headers: { "Cache-Control": "no-store" } });
  const sha256 = await releaseSha(rel);
  const answer = signUpdate({ channel: rel.channel, version: rel.version, sha256, size: rel.size, hwid, nonce });
  return Response.json({ status: "ok", ...answer }, { headers: { "Cache-Control": "no-store" } });
}
