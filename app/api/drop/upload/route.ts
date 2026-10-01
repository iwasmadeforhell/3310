import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { hasSession, sameOrigin } from "@/lib/auth";
import { DROP_PREFIX } from "@/lib/drop";

export const dynamic = "force-dynamic";

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
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
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
