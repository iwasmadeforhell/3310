import { get } from "@vercel/blob";
import { hasRedis, redis } from "@/lib/redis";
import { deleteFile, fileKey, isExpired, type DropFile } from "@/lib/drop";
import { notFoundPage } from "@/lib/notFoundPage";

export const dynamic = "force-dynamic";

// Types that are safe to show in the browser. Everything else (HTML, SVG, JS…)
// is forced to download, so an uploaded file can never run scripts on 3310.nz.
const INLINE = /^(image\/(png|jpe?g|gif|webp|avif)|video\/|audio\/|application\/pdf$|text\/plain)/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{1,20}$/.test(id) || !hasRedis()) return notFoundPage("That file doesn't exist.");

  const file = await redis().get<DropFile>(fileKey(id));
  if (!file) return notFoundPage("That file doesn't exist (or was deleted).");
  if (isExpired(file)) {
    await deleteFile(file);
    return notFoundPage("That file has expired.");
  }

  const result = await get(file.pathname, {
    access: "private",
    ifNoneMatch: req.headers.get("if-none-match") ?? undefined,
  });
  if (!result) return notFoundPage("That file doesn't exist (or was deleted).");

  const type = result.blob.contentType ?? file.contentType ?? "application/octet-stream";
  const download = new URL(req.url).searchParams.has("dl") || !INLINE.test(type);
  const headers: Record<string, string> = {
    ETag: result.blob.etag,
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
  };
  if (!type.startsWith("application/pdf")) {
    headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox";
  }
  if (result.statusCode === 304) return new Response(null, { status: 304, headers });

  if (result.blob.size) headers["Content-Length"] = String(result.blob.size);
  return new Response(result.stream, {
    headers: { ...headers, "Content-Type": download ? "application/octet-stream" : type },
  });
}
