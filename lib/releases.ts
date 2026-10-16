import "server-only";
import { redis } from "./redis";
import type { StoreUser } from "./store";
import { isStaffTier } from "./tiers";

// Mod downloads: one current jar per channel, kept in the private Blob store under releases/.

export type Channel = "stable" | "beta";
export const CHANNELS: Channel[] = ["stable", "beta"];
export const RELEASE_PREFIX = "releases/";

export type Release = { channel: Channel; pathname: string; name: string; version: string; size: number; uploadedAt: number };

const key = (c: Channel) => `st:release:${c}`;

export async function getRelease(c: Channel): Promise<Release | null> {
  return redis().get<Release>(key(c));
}

export async function setRelease(r: Release) {
  await redis().set(key(r.channel), r);
}

/** Beta builds are for beta testers and devs. */
export const canGet = (u: StoreUser, c: Channel) => c === "stable" || u.tier === "beta" || isStaffTier(u.tier);
