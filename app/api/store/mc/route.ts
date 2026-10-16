import { normUuid } from "@/lib/license";
import { publicUser, saveUser } from "@/lib/store";
import { bad, needUser } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// Remove a Minecraft account from this licence: { uuid }. The free slot is taken the next time the mod starts on another account.
export async function POST(req: Request) {
  const u = await needUser(req);
  if (u instanceof Response) return u;
  const b = (await req.json().catch(() => ({}))) as { uuid?: string };
  const id = normUuid(String(b.uuid ?? ""));
  if (!u.mc.some((m) => normUuid(m.uuid) === id)) return bad("That account isn't on your licence.");
  const next = { ...u, mc: u.mc.filter((m) => normUuid(m.uuid) !== id) };
  await saveUser(next);
  return Response.json({ user: publicUser(next) });
}
