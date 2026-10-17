import "server-only";
import { createHash } from "node:crypto";
import { get } from "@vercel/blob";
import { redis } from "./redis";
import type { StoreUser } from "./store";
import { isStaffTier } from "./tiers";

// Mod downloads: one current jar per channel, kept in the private Blob store under releases/.

export type Channel = "stable" | "beta";
export const CHANNELS: Channel[] = ["stable", "beta"];
export const RELEASE_PREFIX = "releases/";

export type Release = { channel: Channel; pathname: string; name: string; version: string; size: number; uploadedAt: number; sha256?: string };

const key = (c: Channel) => `st:release:${c}`;

export async function getRelease(c: Channel): Promise<Release | null> {
  return redis().get<Release>(key(c));
}

export async function setRelease(r: Release) {
  await redis().set(key(r.channel), r);
}

/** Beta builds are for beta testers and devs. */
export const canGet = (u: StoreUser, c: Channel) => c === "stable" || u.tier === "beta" || isStaffTier(u.tier);

/** SHA-256 (hex) of a release jar, worked out once from the stored file and kept on the record. The mod checks it. */
export async function releaseSha(rel: Release): Promise<string> {
  if (rel.sha256) return rel.sha256;
  const blob = await get(rel.pathname, { access: "private" });
  if (!blob?.stream) throw new Error("The build file is missing.");
  const h = createHash("sha256");
  const reader = blob.stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    h.update(value);
  }
  const sha = h.digest("hex");
  const cur = await getRelease(rel.channel);
  if (cur?.pathname === rel.pathname) await setRelease({ ...cur, sha256: sha }); // not if a newer build came in meanwhile
  return sha;
}

/** Dotted numeric compare (1.10.0 > 1.9.2), same as the mod. */
export function compareVersions(a: string, b: string): number {
  const parts = (s: string) => s.replace(/^v/, "").split(/[.+-]/).map((p) => parseInt(p, 10) || 0);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
