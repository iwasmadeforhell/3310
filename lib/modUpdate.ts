import "server-only";
import { CHANNELS, compareVersions, getRelease, type Release } from "./releases";
import { isStaffTier, type Tier } from "./store";

/** The build a mod on [tier] should run: beta testers and staff get the newer of beta and stable, everyone else stable. */
export async function buildFor(tier: Tier): Promise<Release | null> {
  const channels = tier === "beta" || isStaffTier(tier) ? CHANNELS : (["stable"] as const);
  const rels = (await Promise.all(channels.map((c) => getRelease(c)))).filter((r): r is Release => !!r?.version);
  return rels.sort((a, b) => compareVersions(b.version, a.version) || b.uploadedAt - a.uploadedAt)[0] ?? null;
}
