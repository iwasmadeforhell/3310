import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { CHANNELS, RELEASE_PREFIX, getRelease, setRelease, type Channel } from "@/lib/releases";
import { bad, deployAuthorized, needAdmin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

const MAX_JAR = 60 * 1024 * 1024;

// Admin (or the mod build with the deploy token): upload a mod jar straight to Blob (client upload), then PUT the release record for a channel.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  if (body.type === "blob.generate-client-token" && !deployAuthorized(req)) {
    const a = await needAdmin(req);
    if (a instanceof Response) return a;
  }
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(RELEASE_PREFIX) || !pathname.endsWith(".jar")) throw new Error("Upload a .jar");
        return { addRandomSuffix: true, maximumSizeInBytes: MAX_JAR };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return bad((e as Error).message);
  }
}

export async function PUT(req: Request) {
  if (!deployAuthorized(req)) {
    const a = await needAdmin(req);
    if (a instanceof Response) return a;
  }
  const b = (await req.json().catch(() => ({}))) as { channel?: Channel; pathname?: string; name?: string; version?: string; size?: number };
  if (!b.channel || !CHANNELS.includes(b.channel)) return bad("Pick a channel.");
  if (!b.pathname?.startsWith(RELEASE_PREFIX)) return bad("Bad file.");
  const old = await getRelease(b.channel);
  await setRelease({
    channel: b.channel,
    pathname: b.pathname,
    name: String(b.name ?? "3310-client.jar").slice(0, 100),
    version: String(b.version ?? "").slice(0, 32),
    size: Number(b.size ?? 0),
    uploadedAt: Date.now(),
  });
  if (old && old.pathname !== b.pathname) await del(old.pathname).catch(() => {});
  return Response.json({ ok: true });
}
