import "server-only";
import { hasRedis, listDocs, redis } from "./redis";
import { isAdmin, ownerId, usersById, type PublicUser } from "./users";
import { votesFor, type Votes } from "./votes";

export const TAGS = ["news", "update", "random", "music"] as const;
export type Tag = (typeof TAGS)[number];

/** "board" is open to every registered member; only admins can post in "devlog". */
export const SECTIONS = ["board", "devlog"] as const;
export type Section = (typeof SECTIONS)[number];

export type Post = {
  id: string;
  title: string;
  body: string;
  tag: Tag;
  mood?: string;
  createdAt: number;
  updatedAt?: number;
  /** Posts from before accounts existed have neither field: they are the owner's board posts. */
  section?: Section;
  author?: string;
  authorName?: string;
};

export const POST_INDEX = "po:index";
export const postKey = (id: string) => `po:${id}`;

export const sectionOf = (p: Post): Section => p.section ?? "board";
export const authorOf = (p: Post): string => p.author ?? ownerId();

export async function listPosts(section?: Section): Promise<Post[]> {
  if (!hasRedis()) return [];
  const posts = await listDocs<Post>(POST_INDEX, "po:");
  return section ? posts.filter((p) => sectionOf(p) === section) : posts;
}

export async function getPost(id: string): Promise<Post | null> {
  if (!hasRedis() || !/^[A-Za-z0-9]{1,20}$/.test(id)) return null;
  return redis().get<Post>(postKey(id));
}

/** Authors and vote counts for a list of posts, fetched together. */
export async function postExtras(posts: Post[], me: PublicUser | null) {
  const names: Record<string, string> = {};
  for (const p of posts) if (p.author && p.authorName) names[p.author] = p.authorName;
  const [authors, votes] = await Promise.all([
    usersById(posts.map(authorOf), names),
    votesFor(posts.map((p) => p.id), me?.id),
  ]);
  return { authors, votes };
}
export type PostExtras = { authors: Record<string, PublicUser>; votes: Record<string, Votes> };

/** Authors and admins can edit a post. */
export function canEdit(me: PublicUser | null, post: Post): boolean {
  return !!me && (isAdmin(me) || authorOf(post) === me.id);
}

/** Authors and admins can delete; moderators can delete board posts that weren't written by an admin. */
export function canDelete(me: PublicUser | null, post: Post, author: PublicUser | undefined): boolean {
  if (canEdit(me, post)) return true;
  return me?.role === "moderator" && sectionOf(post) === "board" && !isAdmin(author);
}

export async function bumpHits(): Promise<number> {
  if (!hasRedis()) return 0;
  return redis().incr("old:hits");
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Luxembourg" });
}
