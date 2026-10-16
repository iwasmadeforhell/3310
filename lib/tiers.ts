// Licence tiers, shared by the server and the store's client components.
// "owner" and "dev" are staff: never expire, unlimited Minecraft accounts, beta builds. Owner only looks different.

export type Tier = "normal" | "beta" | "dev" | "owner";
export const TIERS: Tier[] = ["normal", "beta", "dev", "owner"];

export const isStaffTier = (t: string) => t === "dev" || t === "owner";

/** Sort order in the admin list: owner first. */
export const TIER_ORDER: Record<Tier, number> = { owner: 0, dev: 1, beta: 2, normal: 3 };

/** CSS class of the tier's badge. */
export const tierClass = (t: string) => (t === "owner" ? "owner" : t === "dev" ? "dev" : t === "beta" ? "beta" : "");
