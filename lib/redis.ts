import "server-only";
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

function creds() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function hasRedis(): boolean {
  return creds() !== null;
}

export function redis(): Redis {
  if (client) return client;
  const c = creds();
  if (!c) throw new Error("Redis is not configured (add Upstash Redis in Vercel → Storage).");
  client = new Redis(c);
  return client;
}

/** Fetch ids from a sorted set (newest first) and load their JSON docs. */
export async function listDocs<T>(indexKey: string, docPrefix: string, limit = 500): Promise<T[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(indexKey, 0, limit - 1, { rev: true });
  if (!ids.length) return [];
  const docs = await r.mget<(T | null)[]>(...ids.map((id) => `${docPrefix}${id}`));
  return docs.filter((d): d is T => d !== null);
}

/** Simple fixed-window limiter: max `limit` hits per `windowSec`. Fails open if Redis is absent. */
export async function rateLimited(key: string, limit: number, windowSec: number): Promise<boolean> {
  if (!hasRedis()) return false;
  const r = redis();
  const k = `rl:${key}`;
  const n = await r.incr(k);
  if (n === 1) await r.expire(k, windowSec);
  return n > limit;
}

export async function clearRateLimit(key: string) {
  if (hasRedis()) await redis().del(`rl:${key}`);
}
