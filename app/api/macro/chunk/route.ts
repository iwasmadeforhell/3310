import { put } from "@vercel/blob";
import { CHUNK_PREFIX, MAX_UPLOAD, accountFor } from "@/lib/macro";
import { rateLimited } from "@/lib/redis";

export const dynamic = "force-dynamic";

const CHUNK_MAX = 3.5 * 1024 * 1024; // under Vercel's 4.5 MB request limit

// Clips are bigger than one request may be: the mod PUTs them in parts (?id=<upload id>&i=<n>), then names the
// upload in /api/macro/event, which stitches the parts together and sends them to Discord.
export async function PUT(req: Request) {
  const a = await accountFor(req);
  if (!a) return Response.json({ error: "Unknown token" }, { status: 401 });
  if (await rateLimited(`macro:chunk:${a.hash}`, 60, 600)) return Response.json({ error: "Too many uploads" }, { status: 429 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const i = Number(url.searchParams.get("i"));
  if (!/^[a-z0-9]{12,40}$/.test(id) || !Number.isInteger(i) || i < 0 || i * CHUNK_MAX >= MAX_UPLOAD) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const data = new Uint8Array(await req.arrayBuffer());
  if (!data.length || data.length > CHUNK_MAX) return Response.json({ error: "Bad chunk size" }, { status: 413 });
  await put(`${CHUNK_PREFIX}${a.hash.slice(0, 24)}/${id}/${String(i).padStart(3, "0")}`, Buffer.from(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/octet-stream",
  });
  return Response.json({ ok: true });
}
