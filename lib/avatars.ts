// Profile pictures for forum accounts.
//
// Every upload is decoded and re-encoded on the server as a 160x160 JPEG, so
// whatever is stored is a real, small image with no metadata (camera GPS etc.)
// and nothing else hidden in it. Pictures are a few KB each and live in Redis
// under `av:<user id>`; the Blob store's 1 GB is left for drop and the portfolio.
import "server-only";
import sharp from "sharp";
import { hasRedis, redis } from "./redis";

export const AVATAR_SIZE = 160;
/** Largest upload accepted (the browser shrinks pictures before sending them). */
export const MAX_UPLOAD_BYTES = 600 * 1024;

const key = (id: string) => `av:${id}`;

/** Takes a `data:image/...;base64,` URL. Returns false if it isn't a usable image. */
export async function saveAvatar(id: string, dataUrl: string): Promise<boolean> {
  const m = /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return false;
  const input = Buffer.from(m[1], "base64");
  if (!input.length || input.length > MAX_UPLOAD_BYTES) return false;
  try {
    const out = await sharp(input, { limitInputPixels: 4096 * 4096 })
      .rotate() // apply the camera's orientation before the metadata is dropped
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82 })
      .toBuffer();
    await redis().set(key(id), { d: out.toString("base64") });
    return true;
  } catch {
    return false;
  }
}

export async function getAvatar(id: string): Promise<Buffer | null> {
  if (!hasRedis() || !/^[a-z0-9_-]{3,20}$/.test(id)) return null;
  const doc = await redis().get<{ d: string }>(key(id));
  return doc?.d ? Buffer.from(doc.d, "base64") : null;
}

export async function deleteAvatar(id: string) {
  await redis().del(key(id));
}
