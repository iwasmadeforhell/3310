// Account settings (your own name colour and bio) and user management (admins).
import { forbidden, sameOrigin, unauthorized } from "@/lib/auth";
import { deleteAvatar } from "@/lib/avatars";
import { purgeMessages } from "@/lib/messages";
import { redis } from "@/lib/redis";
import { POST_INDEX, listPosts, postKey } from "@/lib/posts";
import { ROLES, currentUser, deleteUser, getUser, isAdmin, setColor, setProfile, setRole, validColor, type Role } from "@/lib/users";
import { clearVotes } from "@/lib/votes";

export const dynamic = "force-dynamic";

const MAX_BIO = 300;

/** Change your own name colour and/or "about me" text. */
export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => null);
  if (body?.color === undefined && body?.bio === undefined) return Response.json({ error: "Nothing to change" }, { status: 400 });
  if (body.color !== undefined) {
    if (me.owner) return Response.json({ error: "The owner's name keeps its gradient." }, { status: 400 });
    if (!validColor(body.color)) {
      return Response.json({ error: "Pick a brighter colour (names sit on a dark background)." }, { status: 400 });
    }
  }
  if (body.bio !== undefined && (typeof body.bio !== "string" || body.bio.length > MAX_BIO)) {
    return Response.json({ error: `"About me" can be up to ${MAX_BIO} characters.` }, { status: 400 });
  }
  let user = me;
  if (body.color !== undefined) user = (await setColor(me.id, body.color)) ?? user;
  if (body.bio !== undefined) user = (await setProfile(me, { bio: body.bio.trim() })) ?? user;
  return Response.json(user);
}

/** Admins manage members and moderators. Only the owner can touch other admins. */
async function target(req: Request, id: string) {
  if (!sameOrigin(req)) return { denied: forbidden("Bad origin") };
  const me = await currentUser();
  if (!isAdmin(me)) return { denied: me ? forbidden() : unauthorized() };
  const user = await getUser(id);
  if (!user) return { denied: Response.json({ error: "No such user" }, { status: 404 }) };
  if (user.role === "admin" && !me!.owner) return { denied: forbidden("Only the owner can change another admin.") };
  return { me: me!, user };
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const t = await target(req, String(body?.id ?? ""));
  if (t.denied) return t.denied;
  const role = body.role as Role;
  if (!ROLES.includes(role)) return Response.json({ error: "Bad role" }, { status: 400 });
  if (role === "admin" && !t.me.owner) return forbidden("Only the owner can make someone an admin.");
  return Response.json(await setRole(t.user.id, role));
}

/** Delete an account and its private messages. With ?posts=1 their posts are deleted too. */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const t = await target(req, url.searchParams.get("id") ?? "");
  if (t.denied) return t.denied;
  if (url.searchParams.get("posts") === "1") {
    const posts = (await listPosts()).filter((p) => p.author === t.user.id);
    const r = redis();
    await Promise.all(posts.flatMap((p) => [r.del(postKey(p.id)), r.zrem(POST_INDEX, p.id), clearVotes(p.id)]));
  }
  await Promise.all([deleteUser(t.user.id), purgeMessages(t.user.id), deleteAvatar(t.user.id)]);
  return Response.json({ ok: true });
}
