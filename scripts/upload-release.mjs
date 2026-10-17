// Uploads a mod jar as the current build of a channel, the same way 3310.nz/admin -> Builds does.
//   node scripts/upload-release.mjs <jar> <version> [stable|beta]
// Auth: the deploy token (env DEPLOY_TOKEN, or the file %APPDATA%/3310/deploy.token = Vercel env RELEASE_DEPLOY_TOKEN),
// or NK_ST = the "nk_st" cookie of an admin login on 3310.nz. The mod's Gradle build runs this after every build.

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { basename } from "node:path";
import { upload } from "@vercel/blob/client";

const [jar, version, channel = "beta"] = process.argv.slice(2);
const cookie = process.env.NK_ST;
let token = process.env.DEPLOY_TOKEN;
if (!token && !cookie && process.env.APPDATA) {
  try { token = readFileSync(join(process.env.APPDATA, "3310", "deploy.token"), "utf8").trim(); } catch {}
}
const SITE = process.env.SITE ?? "https://3310.nz";
if (!jar || !version || !(cookie || token) || !["stable", "beta"].includes(channel)) {
  console.error("usage: node scripts/upload-release.mjs <jar> <version> [stable|beta]  (needs %APPDATA%/3310/deploy.token, DEPLOY_TOKEN or NK_ST)");
  process.exit(1);
}

const headers = token ? { Authorization: `Bearer ${token}`, Origin: SITE } : { Cookie: `nk_st=${cookie}`, Origin: SITE };
const data = await readFile(jar);
const name = basename(jar);
const file = new File([data], name, { type: "application/java-archive" });

console.log(`uploading ${name} (${(data.length / 1048576).toFixed(1)} MB) to the ${channel} channel...`);
let last = -1;
const blob = await upload(`releases/${channel}/${name.replace(/[^A-Za-z0-9._-]/g, "_")}`, file, {
  access: "private",
  handleUploadUrl: `${SITE}/api/store/admin/release`,
  headers,
  multipart: data.length > 8 * 1024 * 1024,
  onUploadProgress: ({ percentage }) => {
    const p = Math.floor(percentage / 10) * 10;
    if (p !== last) { last = p; process.stdout.write(`${p}% `); }
  },
});
console.log();

const res = await fetch(`${SITE}/api/store/admin/release`, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ channel, pathname: blob.pathname, name, version, size: data.length }),
});
const out = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("saving the release failed:", out.error ?? res.status);
  process.exit(1);
}
console.log(`done: ${channel} is now v${version} (${name})`);
