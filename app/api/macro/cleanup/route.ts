import { del, list } from "@vercel/blob";
import { CHUNK_PREFIX } from "@/lib/macro";

export const dynamic = "force-dynamic";

// Daily cron: clip parts whose event never arrived (the mod crashed mid-upload) are deleted after an hour.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const old: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: CHUNK_PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) if (Date.now() - new Date(b.uploadedAt).getTime() > 3600_000) old.push(b.url);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (old.length) await del(old);
  return Response.json({ ok: true, deleted: old.length });
}
