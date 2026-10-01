import { forbidden, sameOrigin, unauthorized } from "@/lib/auth";
import { rateLimited } from "@/lib/redis";
import { getPost } from "@/lib/posts";
import { currentUser } from "@/lib/users";
import { castVote } from "@/lib/votes";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized("Make an account to vote.");
  if (await rateLimited(`vote:${me.id}`, 60, 60)) return Response.json({ error: "Slow down!" }, { status: 429 });
  const body = await req.json().catch(() => null);
  const vote = body?.vote === 1 || body?.vote === -1 ? body.vote : 0;
  const post = await getPost(String(body?.id ?? ""));
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await castVote(post.id, me.id, vote));
}
