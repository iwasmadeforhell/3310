import { del, list } from "@vercel/blob";
import { CHUNK_PREFIX } from "@/lib/macro";
import { autoCloseSweep } from "@/lib/tickets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron: tickets past their server's auto-close time are closed (lib/tickets.ts), and clip parts whose event never arrived (the mod crashed mid-upload) are deleted after an hour.
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
  const ticketsClosed = await autoCloseSweep().catch((e) => {
    console.error("ticket auto-close failed", e);
    return -1;
  });
  return Response.json({ ok: true, deleted: old.length, ticketsClosed });
}
