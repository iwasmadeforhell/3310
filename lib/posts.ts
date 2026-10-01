import "server-only";
import { hasRedis, listDocs, redis } from "./redis";

export const TAGS = ["news", "update", "random", "music"] as const;
export type Tag = (typeof TAGS)[number];

export type Post = {
  id: string;
  title: string;
  body: string;
  tag: Tag;
  mood?: string;
  createdAt: number;
  updatedAt?: number;
};

export const POST_INDEX = "po:index";
export const postKey = (id: string) => `po:${id}`;

export async function listPosts(): Promise<Post[]> {
  if (!hasRedis()) return [];
  return listDocs<Post>(POST_INDEX, "po:");
}

export async function getPost(id: string): Promise<Post | null> {
  if (!hasRedis() || !/^[A-Za-z0-9]{1,20}$/.test(id)) return null;
  return redis().get<Post>(postKey(id));
}

export async function bumpHits(): Promise<number> {
  if (!hasRedis()) return 0;
  return redis().incr("old:hits");
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Luxembourg" });
}
