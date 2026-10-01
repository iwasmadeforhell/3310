import { get } from "@vercel/blob";
import { canViewPortfolio } from "@/lib/auth";
import { PF_PREFIX } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

// Streams a private portfolio image. The blob store is PRIVATE, so the only way
// to see an image is through this route, which checks the session cookie first.
export async function GET(req: Request) {
  if (!(await canViewPortfolio())) {
    return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const p = new URL(req.url).searchParams.get("p") ?? "";
  if (!p.startsWith(PF_PREFIX) || p.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const result = await get(p, {
    access: "private",
    ifNoneMatch: req.headers.get("if-none-match") ?? undefined,
  });
  if (!result) return new Response("Not found", { status: 404 });

  const headers: Record<string, string> = {
    ETag: result.blob.etag,
    "Cache-Control": "private, no-cache",
    "X-Robots-Tag": "noindex, noimageindex",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (result.statusCode === 304) return new Response(null, { status: 304, headers });

  return new Response(result.stream, {
    headers: { ...headers, "Content-Type": result.blob.contentType ?? "application/octet-stream" },
  });
}
