// Uploads a mod jar as the current build of a channel, the same way 3310.nz/admin -> Builds does.
//   $env:NK_ST="<your nk_st cookie>"; node scripts/upload-release.mjs <jar> <version> [stable|beta]
// NK_ST is the value of the "nk_st" cookie of an admin login on 3310.nz (browser dev tools -> Application -> Cookies).

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { upload } from "@vercel/blob/client";

const [jar, version, channel = "beta"] = process.argv.slice(2);
const cookie = process.env.NK_ST;
const SITE = process.env.SITE ?? "https://3310.nz";
if (!jar || !version || !cookie || !["stable", "beta"].includes(channel)) {
  console.error('usage: $env:NK_ST="<cookie>"; node scripts/upload-release.mjs <jar> <version> [stable|beta]');
  process.exit(1);
}

const headers = { Cookie: `nk_st=${cookie}`, Origin: SITE };
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
