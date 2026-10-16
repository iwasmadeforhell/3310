import { randomBytes } from "node:crypto";
import { origin, safeNext } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

// Start "Log in with Discord" (it also links Discord to an account that is already signed in).
export async function GET(req: Request) {
  const id = process.env.DISCORD_APP_ID;
  if (!id || !process.env.DISCORD_CLIENT_SECRET) return Response.redirect(`${origin()}/login?error=${encodeURIComponent("Discord login isn't set up yet.")}`, 302);
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  const state = randomBytes(16).toString("base64url");
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("redirect_uri", `${origin()}/api/store/discord/callback`);
  url.searchParams.set("state", state);
  const res = new Response(null, { status: 302, headers: { Location: url.toString() } });
  res.headers.append(
    "Set-Cookie",
    `nk_st_oauth=${state}.${Buffer.from(next).toString("base64url")}; Max-Age=600; Path=/api/store/discord; HttpOnly; Secure; SameSite=Lax`,
  );
  return res;
}
