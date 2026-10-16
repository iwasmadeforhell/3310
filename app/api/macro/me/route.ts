import { accountFor, getCfg } from "@/lib/macro";
import { hasRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// Is this mod token linked yet? (polled by the mod while it shows the pairing code)
export async function GET(req: Request) {
  if (!hasRedis()) return Response.json({ error: "Not configured" }, { status: 503 });
  const a = await accountFor(req);
  if (!a) return Response.json({ error: "Unknown token" }, { status: 401 });
  const cfg = a.acct.discordId ? await getCfg(a.acct.discordId) : null;
  return Response.json({
    linked: !!a.acct.discordId,
    discordName: a.acct.discordName ?? null,
    mode: cfg?.mode ?? null,
    updates: cfg?.updates ?? null,
  });
}
