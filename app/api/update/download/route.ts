import { get } from "@vercel/blob";
import { modAccess } from "@/lib/license";
import { buildFor } from "@/lib/modUpdate";
import { HWID_RE, normHwid, storeReady } from "@/lib/store";
import { rateLimited } from "@/lib/redis";
import { clientIp } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { hwid } from the mod -> the jar /api/update announced for it.
export async function POST(req: Request) {
  if (!storeReady()) return Response.json({ error: "Store not configured" }, { status: 503 });
  if (await rateLimited(`updl:${clientIp(req)}`, 12, 3600)) return Response.json({ error: "Too many requests" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const hwid = typeof body?.hwid === "string" ? normHwid(body.hwid) : "";
  if (!HWID_RE.test(hwid)) return Response.json({ error: "Bad request" }, { status: 400 });
  const access = await modAccess(hwid);
  if ("error" in access) return Response.json({ error: access.error }, { status: 403 });
  const rel = await buildFor(access.tier);
  if (!rel) return Response.json({ error: "No build has been uploaded yet." }, { status: 404 });
  const blob = await get(rel.pathname, { access: "private" });
  if (!blob?.stream) return Response.json({ error: "The build file is missing." }, { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/java-archive",
      "Cache-Control": "private, no-store",
      "X-Build-Version": rel.version,
      ...(rel.size ? { "Content-Length": String(rel.size) } : {}),
    },
  });
}
