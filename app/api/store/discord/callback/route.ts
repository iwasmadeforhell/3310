import { cookies } from "next/headers";
import { currentUser, loginDiscord, sessionCookie, sessionToken, storeReady } from "@/lib/store";
import { origin, safeNext, serialize } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (why: string) => Response.redirect(`${origin()}/login?error=${encodeURIComponent(why)}`, 302);
  if (!storeReady()) return fail("The store isn't configured yet.");
  const jar = await cookies();
  const [state, nextB64] = (jar.get("nk_st_oauth")?.value ?? "").split(".");
  if (!state || state !== url.searchParams.get("state")) return fail("The Discord login expired. Try again.");
  const code = url.searchParams.get("code");
  if (!code) return fail("The Discord login was cancelled.");

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_APP_ID ?? "",
      client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
      grant_type: "authorization_code",
      code,
      redirect_uri: `${origin()}/api/store/discord/callback`,
    }),
  });
  if (!tokenRes.ok) return fail("Discord didn't accept the login.");
  const tok = (await tokenRes.json()) as { access_token: string };
  const meRes = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!meRes.ok) return fail("Couldn't read your Discord profile.");
  const me = (await meRes.json()) as { id: string; username: string; global_name?: string | null };

  const u = await loginDiscord(me.id, me.global_name || me.username, await currentUser());
  if (typeof u === "string") return fail(u);
  if (u.banned) return fail("This account is banned.");
  const next = safeNext(nextB64 ? Buffer.from(nextB64, "base64url").toString() : null);
  const res = new Response(null, { status: 302, headers: { Location: `${origin()}${next}` } });
  res.headers.append("Set-Cookie", serialize(sessionCookie(sessionToken(u))));
  res.headers.append("Set-Cookie", "nk_st_oauth=; Max-Age=0; Path=/api/store/discord; HttpOnly; Secure; SameSite=Lax");
  return res;
}
