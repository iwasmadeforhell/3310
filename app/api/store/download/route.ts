import { get } from "@vercel/blob";
import { canGet, getRelease, type Channel } from "@/lib/releases";
import { isActive } from "@/lib/store";
import { bad, needUser } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// The mod jar, for signed-in users with an active licence. ?channel=beta for beta testers / devs.
export async function GET(req: Request) {
  const u = await needUser(req, false);
  if (u instanceof Response) return u;
  if (!isActive(u)) return bad("Your licence isn't active. Buy a month first.", 403);
  const channel: Channel = new URL(req.url).searchParams.get("channel") === "beta" ? "beta" : "stable";
  if (!canGet(u, channel)) return bad("Beta builds are for beta testers.", 403);
  const rel = await getRelease(channel);
  if (!rel) return bad("No build has been uploaded yet.", 404);
  const blob = await get(rel.pathname, { access: "private" });
  if (!blob) return bad("The build file is missing.", 404);
  return new Response(blob.stream, {
    headers: {
      "Content-Type": "application/java-archive",
      "Content-Disposition": `attachment; filename="${rel.name.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      ...(rel.size ? { "Content-Length": String(rel.size) } : {}),
    },
  });
}
