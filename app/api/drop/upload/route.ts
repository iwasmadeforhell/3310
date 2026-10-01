import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { hasSession, sameOrigin } from "@/lib/auth";
import { DROP_PREFIX } from "@/lib/drop";
import { storageUsage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_FILE = 500 * 1024 * 1024; // 500 MB

export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    if (!sameOrigin(req) || !(await hasSession("drop"))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(DROP_PREFIX)) throw new Error("Invalid path");
        const { quota, used } = await storageUsage();
        if (used >= quota) throw new Error("Storage is full. Delete some files first.");
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: Math.min(MAX_FILE, quota - used),
        };
      },
      onUploadCompleted: async () => {
        // The dashboard registers the file right after upload.
      },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
