import { del } from "@vercel/blob";
import { guard } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { randomId } from "@/lib/id";
import { PF_INDEX, PF_PREFIX, getPortfolioItem, listPortfolio, pfKey, type PfItem } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function GET(req: Request) {
  const denied = await guard(req, "portfolio-view", false);
  if (denied) return denied;
  return Response.json(await listPortfolio());
}

export async function POST(req: Request) {
  const denied = await guard(req, "manage");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });

  const images = Array.isArray(body.images)
    ? body.images
        .filter((i: { pathname?: unknown }) => typeof i?.pathname === "string" && i.pathname.startsWith(PF_PREFIX))
        .slice(0, 40)
        .map((i: { pathname: string; w?: unknown; h?: unknown }) => ({
          pathname: i.pathname,
          w: typeof i.w === "number" ? Math.round(i.w) : undefined,
          h: typeof i.h === "number" ? Math.round(i.h) : undefined,
        }))
    : [];
  if (!images.length) return Response.json({ error: "Add at least one image." }, { status: 400 });

  const item: PfItem = {
    id: randomId(10),
    title: str(body.title, 140) || "Untitled",
    description: str(body.description, 4000),
    year: str(body.year, 12),
    images,
    createdAt: Date.now(),
  };
  const r = redis();
  await r.set(pfKey(item.id), item);
  await r.zadd(PF_INDEX, { score: item.createdAt, member: item.id });
  return Response.json(item);
}

export async function PATCH(req: Request) {
  const denied = await guard(req, "manage");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const item = body?.id ? await getPortfolioItem(String(body.id)) : null;
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });

  if (body.title !== undefined) item.title = str(body.title, 140) || "Untitled";
  if (body.description !== undefined) item.description = str(body.description, 4000);
  if (body.year !== undefined) item.year = str(body.year, 12);
  await redis().set(pfKey(item.id), item);

  // Move to top/bottom
  if (body.move === "top") await redis().zadd(PF_INDEX, { score: Date.now(), member: item.id });
  return Response.json(item);
}

export async function DELETE(req: Request) {
  const denied = await guard(req, "manage");
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const item = await getPortfolioItem(id);
  if (!item) return Response.json({ error: "Not found" }, { status: 404 });

  await del(item.images.map((i) => i.pathname)).catch(() => {});
  const r = redis();
  await r.del(pfKey(id));
  await r.zrem(PF_INDEX, id);
  return Response.json({ ok: true });
}
