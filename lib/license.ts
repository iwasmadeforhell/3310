import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import { devHwids, getUser, isActive, isStaffTier, mcLimit, normHwid, saveUser, userByHwid, type Tier } from "./store";

// Licence answers for the mod. Every answer is signed (Ed25519, LICENSE_SIGNING_KEY = PKCS#8 DER, base64) over
//   v1|<status>|<tier>|<hwid>|<uuid>|<nonce>|<issuedAt>|<expiresAt>
// and the mod checks it with the public key built into it, so a fake server or an edited answer is refused.

export type LicenseStatus = "ok" | "unverified" | "expired" | "banned" | "accounts_full";

export type LicenseAnswer = {
  status: LicenseStatus;
  tier: Tier | "";
  hwid: string;
  uuid: string;
  nonce: string;
  issuedAt: number;
  /** ms; -1 = never */
  expiresAt: number;
  message: string;
  account?: string;
  sig?: string;
};

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
export const normUuid = (u: string) => u.trim().toLowerCase().replace(/-/g, "");
export const validUuid = (u: unknown): u is string => typeof u === "string" && UUID_RE.test(u.trim());

export function signAnswer(a: LicenseAnswer): LicenseAnswer {
  const raw = process.env.LICENSE_SIGNING_KEY;
  if (!raw) throw new Error("LICENSE_SIGNING_KEY is not set");
  const key = createPrivateKey({ key: Buffer.from(raw, "base64"), format: "der", type: "pkcs8" });
  const msg = ["v1", a.status, a.tier, a.hwid, a.uuid, a.nonce, a.issuedAt, a.expiresAt].join("|");
  return { ...a, sig: sign(null, Buffer.from(msg), key).toString("base64") };
}

export async function check(hwidRaw: string, uuidRaw: string, name: string, nonce: string, version: string): Promise<LicenseAnswer> {
  const hwid = normHwid(hwidRaw);
  const uuid = normUuid(uuidRaw);
  const base = { hwid, uuid, nonce, issuedAt: Date.now() };

  const found = await userByHwid(hwid);
  // A whitelisted PC is always licensed - as dev, unless it is verified on an owner/dev account (then that tier shows).
  if (devHwids().includes(hwid) && !(found && isStaffTier(found.tier) && !found.banned)) {
    return { ...base, status: "ok", tier: "dev", expiresAt: -1, message: "Developer PC", account: "dev" };
  }

  if (!found) {
    return { ...base, status: "unverified", tier: "", expiresAt: 0, message: "This PC is not verified yet. Verify it at 3310.nz/verify." };
  }
  let u = (await getUser(found.id)) ?? found;
  const exp = u.expiresAt === null || isStaffTier(u.tier) ? -1 : u.expiresAt ?? 0;
  const who = u.discordName ?? u.email ?? "";
  if (u.banned) return { ...base, status: "banned", tier: u.tier, expiresAt: exp, message: "This account is banned.", account: who };
  if (!isActive(u)) {
    return { ...base, status: "expired", tier: u.tier, expiresAt: exp, message: "Your month has run out. Buy another at 3310.nz/purchase.", account: who };
  }

  const shortName = typeof name === "string" ? name.slice(0, 16) : "";
  const known = u.mc.find((m) => normUuid(m.uuid) === uuid);
  if (!known) {
    if (u.mc.length >= mcLimit(u)) {
      return {
        ...base,
        status: "accounts_full",
        tier: u.tier,
        expiresAt: exp,
        message: `This licence already has ${u.mc.length} Minecraft accounts. Remove one in your dashboard at 3310.nz/dashboard.`,
        account: who,
      };
    }
    u = { ...u, mc: [...u.mc, { uuid, name: shortName, addedAt: Date.now() }] };
  } else if (shortName && known.name !== shortName) {
    u = { ...u, mc: u.mc.map((m) => (m === known ? { ...m, name: shortName } : m)) };
  }
  await saveUser({ ...u, lastCheck: Date.now(), lastVersion: typeof version === "string" ? version.slice(0, 32) : undefined });
  return { ...base, status: "ok", tier: u.tier, expiresAt: exp, message: "Licensed", account: who };
}
