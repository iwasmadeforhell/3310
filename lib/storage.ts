import "server-only";
import { listFiles } from "./drop";
import { listPortfolio } from "./portfolio";

// Drop files and portfolio images share one Blob store. Vercel has no API for
// "space left", so usage is added up from the sizes saved with each record.
// The Hobby plan includes 1 GB; set BLOB_QUOTA_GB if the plan changes.
export const QUOTA_BYTES = (Number(process.env.BLOB_QUOTA_GB) || 1) * 1024 ** 3;

export type StorageUsage = { quota: number; drop: number; portfolio: number; used: number };

export async function storageUsage(): Promise<StorageUsage> {
  const [files, items] = await Promise.all([listFiles(), listPortfolio()]);
  const drop = files.reduce((n, f) => n + (f.size || 0), 0);
  const portfolio = items.reduce((n, it) => n + it.images.reduce((m, im) => m + (im.size || 0), 0), 0);
  return { quota: QUOTA_BYTES, drop, portfolio, used: drop + portfolio };
}
