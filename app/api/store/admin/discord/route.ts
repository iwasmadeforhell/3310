import commands from "@/lib/discord-commands.json";
import { bad, needAdmin } from "@/lib/storeApi";

export const dynamic = "force-dynamic";

/** Registers the bot's slash commands (lib/discord-commands.json) with the server's own token: the admin page button. */
export async function POST(req: Request) {
  const a = await needAdmin(req);
  if (a instanceof Response) return a;
  const app = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!app || !token) return bad("DISCORD_APP_ID / DISCORD_BOT_TOKEN aren't set.", 503);
  const res = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, {
    method: "PUT",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  const text = await res.text();
  if (!res.ok) return bad(`Discord said ${res.status}: ${text.slice(0, 300)}`, 502);
  const list = JSON.parse(text) as { name: string }[];
  return Response.json({ ok: true, commands: list.map((c) => c.name) });
}
