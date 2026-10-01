import { forbidden, sameOrigin, unauthorized } from "@/lib/auth";
import { rateLimited, redis } from "@/lib/redis";
import { randomId } from "@/lib/id";
import { POST_INDEX, TAGS, authorOf, canDelete, canEdit, getPost, postKey, type Post, type Section, type Tag } from "@/lib/posts";
import { currentUser, isAdmin, isStaff, usersById } from "@/lib/users";
import { clearVotes } from "@/lib/votes";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const tag = (v: unknown): Tag => (TAGS as readonly string[]).includes(v as string) ? (v as Tag) : "news";
const section = (v: unknown): Section => (v === "devlog" ? "devlog" : "board");

export async function POST(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized("Log in to post.");
  const body = await req.json().catch(() => null);
  const where = section(body?.section);
  if (where === "devlog" && !isAdmin(me)) return forbidden("Only admins can post in the devlog.");
  if (!isStaff(me) && (await rateLimited(`post:${me.id}`, 5, 10 * 60))) {
    return Response.json({ error: "Slow down! Try again in a few minutes." }, { status: 429 });
  }
  const title = str(body?.title, 200).trim();
  const text = str(body?.body, 20000);
  if (!title || !text.trim()) return Response.json({ error: "Title and body are required." }, { status: 400 });

  const post: Post = {
    id: randomId(8),
    title,
    body: text,
    tag: tag(body.tag),
    mood: str(body.mood, 60).trim() || undefined,
    createdAt: Date.now(),
    section: where,
    author: me.id,
    authorName: me.name,
  };
  const r = redis();
  await r.set(postKey(post.id), post);
  await r.zadd(POST_INDEX, { score: post.createdAt, member: post.id });
  return Response.json(post);
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => null);
  const post = await getPost(String(body?.id ?? ""));
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(me, post)) return forbidden("You can only edit your own posts.");

  const title = str(body.title, 200).trim();
  const text = str(body.body, 20000);
  if (!title || !text.trim()) return Response.json({ error: "Title and body are required." }, { status: 400 });
  const next: Post = { ...post, title, body: text, tag: tag(body.tag), mood: str(body.mood, 60).trim() || undefined, updatedAt: Date.now() };
  // Only admins can move a post between the board and the devlog.
  if (isAdmin(me) && body.section !== undefined) next.section = section(body.section);
  await redis().set(postKey(post.id), next);
  return Response.json(next);
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized();
  const post = await getPost(new URL(req.url).searchParams.get("id") ?? "");
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  const author = (await usersById([authorOf(post)]))[authorOf(post)];
  if (!canDelete(me, post, author)) return forbidden("You can't delete that post.");
  const r = redis();
  await Promise.all([r.del(postKey(post.id)), r.zrem(POST_INDEX, post.id), clearVotes(post.id)]);
  return Response.json({ ok: true });
}
