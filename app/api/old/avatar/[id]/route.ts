import { getAvatar } from "@/lib/avatars";

export const dynamic = "force-dynamic";

/** Serves a profile picture. Pages link it with ?v=<version>, so it can be cached for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const image = await getAvatar((await params).id);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(image.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
