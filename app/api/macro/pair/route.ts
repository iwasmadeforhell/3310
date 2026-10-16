import { clientIp } from "@/lib/auth";
import { validUuid } from "@/lib/license";
import { PAIR_TTL_SEC, createPairing, macroReady } from "@/lib/macro";
import { rateLimited } from "@/lib/redis";

export const dynamic = "force-dynamic";

// The mod asks for a pairing: { uuid, name } -> { token, code }. The player types /link <code> in Discord.
export async function POST(req: Request) {
  const why = macroReady();
  if (why) return Response.json({ error: why }, { status: 503 });
  if (await rateLimited(`macro:pair:${clientIp(req)}`, 10, 3600)) return Response.json({ error: "Too many pairing requests" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { uuid?: string; name?: string };
  if (!validUuid(b.uuid) || typeof b.name !== "string" || !/^\w{1,16}$/.test(b.name)) {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const { token, code } = await createPairing(b.uuid.toLowerCase().replace(/-/g, ""), b.name);
  return Response.json({ token, code, expiresIn: PAIR_TTL_SEC });
}
