import { publicUser, setHwid } from "@/lib/store";
import { bad, needUser } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// Verify this account's PC: { hwid } as copied from the prompt in Minecraft. One PC per account, changeable every 24 h.
export async function POST(req: Request) {
  const u = await needUser(req);
  if (u instanceof Response) return u;
  const b = (await req.json().catch(() => ({}))) as { hwid?: string };
  const r = await setHwid(u, String(b.hwid ?? ""));
  if (typeof r === "string") return bad(r);
  return Response.json({ user: publicUser(r) });
}
