import { del } from "@vercel/blob";
import { guard } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { randomId } from "@/lib/id";
import { DROP_PREFIX, FILE_INDEX, fileKey, listFiles, type DropFile } from "@/lib/drop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard(req, "drop", false);
  if (denied) return denied;
  return Response.json(await listFiles());
}

/** Register an uploaded blob so it gets a short /f/<id> link. */
export async function POST(req: Request) {
  const denied = await guard(req, "drop");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const pathname = typeof body?.pathname === "string" ? body.pathname : "";
  if (!pathname.startsWith(DROP_PREFIX) || pathname.includes("..")) {
    return Response.json({ error: "Bad pathname" }, { status: 400 });
  }
  const file: DropFile = {
    id: randomId(7),
    pathname,
    name: (typeof body.name === "string" ? body.name : pathname.split("/").pop()!).slice(0, 200),
    size: typeof body.size === "number" ? body.size : 0,
    contentType: typeof body.contentType === "string" ? body.contentType.slice(0, 120) : "application/octet-stream",
    createdAt: Date.now(),
  };
  const r = redis();
  await r.set(fileKey(file.id), file);
  await r.zadd(FILE_INDEX, { score: file.createdAt, member: file.id });
  return Response.json(file);
}

export async function DELETE(req: Request) {
  const denied = await guard(req, "drop");
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const r = redis();
  const file = await r.get<DropFile>(fileKey(id));
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  await del(file.pathname).catch(() => {});
  await Promise.all([r.del(fileKey(id)), r.zrem(FILE_INDEX, id)]);
  return Response.json({ ok: true });
}
