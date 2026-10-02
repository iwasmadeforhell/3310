// Set or remove a profile picture. Reading one is in ./[id]/route.ts.
import { forbidden, sameOrigin, unauthorized } from "@/lib/auth";
import { deleteAvatar, saveAvatar } from "@/lib/avatars";
import { rateLimited } from "@/lib/redis";
import { currentUser, getProfile, isAdmin, isStaff, setProfile } from "@/lib/users";

export const dynamic = "force-dynamic";

/** Upload your own picture: { image: "data:image/...;base64,..." } */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized();
  if (await rateLimited(`avatar:${me.id}`, 10, 10 * 60)) return Response.json({ error: "Slow down! Try again in a few minutes." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (typeof body?.image !== "string" || !(await saveAvatar(me.id, body.image))) {
    return Response.json({ error: "That file isn't a picture I can use. Try a JPG, PNG, WebP or GIF." }, { status: 400 });
  }
  return Response.json(await setProfile(me, { avatar: Date.now() }));
}

/** Remove a picture: your own, or (for moderators and admins) someone else's with ?id=. */
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized();
  const id = new URL(req.url).searchParams.get("id") ?? me.id;
  const user = id === me.id ? me : await getProfile(id);
  if (!user) return Response.json({ error: "No such user" }, { status: 404 });
  if (user.id !== me.id) {
    // Staff can clear members' pictures; only the owner can touch an admin's.
    if (!isStaff(me) || (isAdmin(user) && !me.owner)) return forbidden();
  }
  await deleteAvatar(user.id);
  return Response.json(await setProfile(user, { avatar: null }));
}
