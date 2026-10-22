// Registers the 3310 bot's slash commands (run once, and again after changing lib/discord-commands.json):
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs
// The store admin page has a "Register bot commands" button that does the same with the server's env.
// Alert commands work in servers, in the bot's DMs and (user install) anywhere; ticket commands only in servers.

import { readFileSync } from "node:fs";

const app = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!app || !token) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN");
  process.exit(1);
}

const commands = JSON.parse(readFileSync(new URL("../lib/discord-commands.json", import.meta.url), "utf8"));

const res = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
});
console.log(res.status, (await res.text()).slice(0, 400));
