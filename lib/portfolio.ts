import "server-only";
import { hasRedis, listDocs, redis } from "./redis";

export type PfImage = { pathname: string; w?: number; h?: number; size?: number };
export type PfCategory = "photography" | "art";
export const PF_CATEGORIES: PfCategory[] = ["photography", "art"];
export const asCategory = (v: unknown): PfCategory => (v === "art" ? "art" : "photography");

export type PfItem = {
  id: string;
  title: string;
  description: string;
  year: string;
  category?: PfCategory; // missing on older items = photography
  images: PfImage[];
  createdAt: number;
};

export const PF_INDEX = "pf:index";
export const pfKey = (id: string) => `pf:item:${id}`;
export const PF_PREFIX = "portfolio/";

export async function listPortfolio(): Promise<PfItem[]> {
  if (!hasRedis()) return [];
  return listDocs<PfItem>(PF_INDEX, "pf:item:");
}

export async function getPortfolioItem(id: string): Promise<PfItem | null> {
  return redis().get<PfItem>(pfKey(id));
}

/** URL the browser uses for an image — always the authenticated proxy route. */
export function imageUrl(pathname: string) {
  return `/api/portfolio/img?p=${encodeURIComponent(pathname)}`;
}
