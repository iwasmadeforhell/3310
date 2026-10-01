import { guard } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { randomId } from "@/lib/id";
import { POST_INDEX, TAGS, getPost, postKey, type Post, type Tag } from "@/lib/posts";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const tag = (v: unknown): Tag => (TAGS as readonly string[]).includes(v as string) ? (v as Tag) : "news";

export async function POST(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
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
  };
  const r = redis();
  await r.set(postKey(post.id), post);
  await r.zadd(POST_INDEX, { score: post.createdAt, member: post.id });
  return Response.json(post);
}

export async function PUT(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  const post = await getPost(String(body?.id ?? ""));
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  const title = str(body.title, 200).trim();
  const text = str(body.body, 20000);
  if (!title || !text.trim()) return Response.json({ error: "Title and body are required." }, { status: 400 });
  const next: Post = { ...post, title, body: text, tag: tag(body.tag), mood: str(body.mood, 60).trim() || undefined, updatedAt: Date.now() };
  await redis().set(postKey(post.id), next);
  return Response.json(next);
}

export async function DELETE(req: Request) {
  const denied = await guard(req, "admin");
  if (denied) return denied;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const r = redis();
  await Promise.all([r.del(postKey(id)), r.zrem(POST_INDEX, id)]);
  return Response.json({ ok: true });
}
