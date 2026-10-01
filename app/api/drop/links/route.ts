import { guard } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { randomId } from "@/lib/id";
import { CODE_RE, LINK_INDEX, clickKey, linkKey, listLinks, type ShortLink } from "@/lib/drop";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guard(req, "drop", false);
  if (denied) return denied;
  return Response.json(await listLinks());
}

export async function POST(req: Request) {
  const denied = await guard(req, "drop");
  if (denied) return denied;

  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  let target: URL;
  try {
    target = new URL(/^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return Response.json({ error: "That doesn't look like a URL." }, { status: 400 });
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return Response.json({ error: "Only http(s) links are allowed." }, { status: 400 });
  }

  const custom = typeof body?.code === "string" ? body.code.trim() : "";
  if (custom && !CODE_RE.test(custom)) {
    return Response.json({ error: "Custom code: letters, numbers, - and _ only (max 48)." }, { status: 400 });
  }

  const r = redis();
  const link: ShortLink = { code: custom || randomId(6), url: target.toString(), createdAt: Date.now() };
  // NX = only set if the code is free
  let ok = await r.set(linkKey(link.code), link, { nx: true });
  if (!ok && !custom) {
    link.code = randomId(8);
    ok = await r.set(linkKey(link.code), link, { nx: true });
  }
  if (!ok) return Response.json({ error: `“${link.code}” is already taken.` }, { status: 409 });

  await r.zadd(LINK_INDEX, { score: link.createdAt, member: link.code });
  return Response.json({ ...link, clicks: 0 });
}

export async function DELETE(req: Request) {
  const denied = await guard(req, "drop");
  if (denied) return denied;
  const code = new URL(req.url).searchParams.get("code") ?? "";
  if (!CODE_RE.test(code)) return Response.json({ error: "Bad code" }, { status: 400 });
  const r = redis();
  await Promise.all([r.del(linkKey(code), clickKey(code)), r.zrem(LINK_INDEX, code)]);
  return Response.json({ ok: true });
}
