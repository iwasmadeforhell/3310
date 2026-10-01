import { forbidden, sameOrigin, unauthorized } from "@/lib/auth";
import { rateLimited } from "@/lib/redis";
import { MAX_BODY, readThread, sendMessage } from "@/lib/messages";
import { currentUser, isStaff, usersById } from "@/lib/users";

export const dynamic = "force-dynamic";

/** The other person in a conversation, or null if there is no such account. */
async function partner(id: string, meId: string) {
  if (!/^[a-z0-9_-]{3,20}$/.test(id) || id === meId) return null;
  const user = (await usersById([id]))[id];
  return user && !user.deleted ? user : null;
}

/** Messages between you and ?with=<user>. Only ever returns your own conversations. */
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return unauthorized();
  const other = new URL(req.url).searchParams.get("with") ?? "";
  if (!/^[a-z0-9_-]{3,20}$/.test(other)) return Response.json({ error: "Bad request" }, { status: 400 });
  return Response.json(await readThread(me.id, other));
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return forbidden("Bad origin");
  const me = await currentUser();
  if (!me) return unauthorized("Log in to send messages.");
  const body = await req.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) return Response.json({ error: "Write something first." }, { status: 400 });
  if (text.length > MAX_BODY) return Response.json({ error: `Messages can be up to ${MAX_BODY} characters.` }, { status: 400 });
  const to = await partner(String(body.to ?? ""), me.id);
  if (!to) return Response.json({ error: "That member doesn't exist." }, { status: 404 });
  if (!isStaff(me) && (await rateLimited(`pm:${me.id}`, 20, 5 * 60))) {
    return Response.json({ error: "Slow down! Try again in a few minutes." }, { status: 429 });
  }
  return Response.json(await sendMessage(me.id, to.id, text));
}
