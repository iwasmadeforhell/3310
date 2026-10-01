import { listFiles } from "@/lib/drop";

export const dynamic = "force-dynamic";

// Daily Vercel cron (see vercel.json). Expired files already stop being served
// the moment they expire; this frees their storage even if nobody opens drop.
// Vercel sends CRON_SECRET as a bearer token, so nobody else can trigger it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const remaining = await listFiles(); // deletes expired files as it lists
  return Response.json({ ok: true, files: remaining.length });
}
