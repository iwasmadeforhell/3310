import { hasRedis, redis } from "@/lib/redis";
import { CODE_RE, clickKey, linkKey, type ShortLink } from "@/lib/drop";
import { notFoundPage } from "@/lib/notFoundPage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!CODE_RE.test(code) || !hasRedis()) return notFoundPage("That short link doesn't exist.");

  const r = redis();
  const link = await r.get<ShortLink>(linkKey(code));
  if (!link) return notFoundPage("That short link doesn't exist.");

  await r.incr(clickKey(code));
  return new Response(null, {
    status: 302,
    headers: { Location: link.url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
