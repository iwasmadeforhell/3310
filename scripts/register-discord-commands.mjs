// Registers the 3310 bot's slash commands (run once, and again after changing them):
//   DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs
// Commands work in servers, in the bot's DMs and (user install) anywhere.

const app = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_TOKEN;
if (!app || !token) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN");
  process.exit(1);
}

const ctx = { integration_types: [0, 1], contexts: [0, 1, 2] };
const commands = [
  { name: "link", description: "Link a Minecraft account running 3310 Client", options: [{ type: 3, name: "code", description: "The 6-letter code the mod shows", required: true, min_length: 6, max_length: 6 }], ...ctx },
  { name: "unlink", description: "Stop alerts from a linked Minecraft account", options: [{ type: 3, name: "account", description: "Minecraft name, or 'all'", required: true }], ...ctx },
  { name: "accounts", description: "Your linked Minecraft accounts and when they last reported", ...ctx },
  {
    name: "alerts",
    description: "Where alerts are sent",
    options: [{ type: 3, name: "where", description: "Your DMs, or this channel", required: true, choices: [{ name: "My DMs", value: "dm" }, { name: "This channel", value: "here" }] }],
    ...ctx,
  },
  { name: "updates", description: "Turn the regular status updates on or off", options: [{ type: 5, name: "enabled", description: "On or off", required: true }], ...ctx },
  { name: "test", description: "Send yourself a test alert", ...ctx },
  {
    name: "status",
    description: "Screenshot (and optionally a 5 s video) from your game right now",
    options: [
      { type: 5, name: "video", description: "Also record 5 seconds of video", required: false },
      { type: 3, name: "account", description: "Only this Minecraft account (default: all linked)", required: false },
    ],
    ...ctx,
  },
];

const res = await fetch(`https://discord.com/api/v10/applications/${app}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(commands),
});
console.log(res.status, (await res.text()).slice(0, 400));
