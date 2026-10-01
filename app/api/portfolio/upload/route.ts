import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { hasSession, sameOrigin } from "@/lib/auth";
import { PF_PREFIX } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// Issues short-lived client upload tokens so large images go straight from the
// browser to the private blob store. Only the admin can get a token.
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    if (!sameOrigin(req) || !(await hasSession("admin"))) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(PF_PREFIX)) throw new Error("Invalid path");
        return {
          allowedContentTypes: IMAGE_TYPES,
          addRandomSuffix: true,
          maximumSizeInBytes: 50 * 1024 * 1024,
        };
      },
      onUploadCompleted: async () => {
        // Items are registered by the manage page after upload; nothing to do here.
      },
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
