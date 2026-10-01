import "server-only";
import { hasRedis, redis } from "./redis";

export type ShortLink = { code: string; url: string; createdAt: number; clicks?: number };
export type DropFile = { id: string; pathname: string; name: string; size: number; contentType: string; createdAt: number };

export const LINK_INDEX = "lk:index";
export const linkKey = (code: string) => `lk:${code}`;
export const clickKey = (code: string) => `lk:clicks:${code}`;

export const FILE_INDEX = "fl:index";
export const fileKey = (id: string) => `fl:${id}`;
export const DROP_PREFIX = "drop/";

export const CODE_RE = /^[A-Za-z0-9_-]{1,48}$/;

export async function listLinks(): Promise<ShortLink[]> {
  if (!hasRedis()) return [];
  const r = redis();
  const codes = await r.zrange<string[]>(LINK_INDEX, 0, 999, { rev: true });
  if (!codes.length) return [];
  const [docs, clicks] = await Promise.all([
    r.mget<(ShortLink | null)[]>(...codes.map(linkKey)),
    r.mget<(number | null)[]>(...codes.map(clickKey)),
  ]);
  return docs
    .map((d, i): ShortLink | null => (d ? { ...d, clicks: Number(clicks[i] ?? 0) } : null))
    .filter((d): d is ShortLink => d !== null);
}

export async function listFiles(): Promise<DropFile[]> {
  if (!hasRedis()) return [];
  const r = redis();
  const ids = await r.zrange<string[]>(FILE_INDEX, 0, 999, { rev: true });
  if (!ids.length) return [];
  const docs = await r.mget<(DropFile | null)[]>(...ids.map(fileKey));
  return docs.filter((d): d is DropFile => d !== null);
}
