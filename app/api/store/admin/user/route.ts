import { normUuid } from "@/lib/license";
import { MONTH_MS, TIERS, clearHwid, deleteUser, getUser, publicUser, saveUser, setHwid, type StoreUser, type Tier } from "@/lib/store";
import { bad, needAdmin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  action?: "tier" | "addMonth" | "removeMonth" | "expires" | "never" | "resetHwid" | "setHwid" | "removeMc" | "ban" | "unban" | "note" | "delete";
  tier?: Tier;
  expiresAt?: number;
  hwid?: string;
  uuid?: string;
  note?: string;
};

// Admin changes to one whitelisted user.
export async function POST(req: Request) {
  const admin = await needAdmin(req);
  if (admin instanceof Response) return admin;
  const b = (await req.json().catch(() => ({}))) as Body;
  const u = b.id ? await getUser(b.id) : null;
  if (!u) return bad("No such user.", 404);

  let next: StoreUser = u;
  switch (b.action) {
    case "tier":
      if (!b.tier || !TIERS.includes(b.tier)) return bad("Unknown tier.");
      next = { ...u, tier: b.tier };
      break;
    case "addMonth":
      next = { ...u, expiresAt: Math.max(Date.now(), u.expiresAt ?? 0) + MONTH_MS };
      break;
    case "removeMonth":
      next = { ...u, expiresAt: Math.max(0, (u.expiresAt ?? Date.now()) - MONTH_MS) };
      break;
    case "expires":
      if (typeof b.expiresAt !== "number" || b.expiresAt < 0) return bad("Bad date.");
      next = { ...u, expiresAt: b.expiresAt };
      break;
    case "never":
      next = { ...u, expiresAt: null };
      break;
    case "resetHwid":
      next = await clearHwid(u);
      break;
    case "setHwid": {
      const r = await setHwid(u, String(b.hwid ?? ""), true);
      if (typeof r === "string") return bad(r);
      next = r;
      break;
    }
    case "removeMc": {
      const id = normUuid(String(b.uuid ?? ""));
      next = { ...u, mc: u.mc.filter((m) => normUuid(m.uuid) !== id) };
      break;
    }
    case "ban":
      if (u.id === admin.id) return bad("You can't ban yourself.");
      next = { ...u, banned: true, sv: u.sv + 1 };
      break;
    case "unban":
      next = { ...u, banned: false };
      break;
    case "note":
      next = { ...u, note: String(b.note ?? "").slice(0, 500) };
      break;
    case "delete":
      if (u.id === admin.id) return bad("You can't delete yourself.");
      await deleteUser(u);
      return Response.json({ deleted: true });
    default:
      return bad("Unknown action.");
  }
  if (b.action !== "resetHwid" && b.action !== "setHwid") await saveUser(next);
  return Response.json({ user: publicUser(next) });
}
