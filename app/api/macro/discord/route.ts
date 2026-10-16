import {
  COLORS,
  deliver,
  getCfg,
  linkCode,
  listAccounts,
  macroReady,
  setCfg,
  unlinkHash,
  verifyInteraction,
} from "@/lib/macro";

export const dynamic = "force-dynamic";

// Discord "Interactions Endpoint URL" for the 3310 bot: slash commands arrive here as signed HTTP requests,
// so the bot needs no always-on process. Commands are registered by scripts/register-discord-commands.mjs.

type Option = { name: string; value: string | boolean | number };
type Interaction = {
  type: number;
  channel_id?: string;
  guild_id?: string;
  member?: { user: DiscordUser };
  user?: DiscordUser;
  data?: { name: string; options?: Option[] };
};
type DiscordUser = { id: string; username: string; global_name?: string | null };

const EPHEMERAL = 64;
const reply = (content: string) => Response.json({ type: 4, data: { content, flags: EPHEMERAL, allowed_mentions: { parse: [] } } });

function ago(ms?: number) {
  if (!ms) return "never";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verifyInteraction(body, req.headers.get("x-signature-ed25519"), req.headers.get("x-signature-timestamp"))) {
    return new Response("invalid request signature", { status: 401 });
  }
  const it = JSON.parse(body) as Interaction;
  if (it.type === 1) return Response.json({ type: 1 }); // PING
  if (it.type !== 2 || !it.data) return reply("Unknown interaction.");
  const why = macroReady();
  if (why) return reply(`The bot isn't set up yet (${why}).`);

  const user = it.member?.user ?? it.user;
  if (!user) return reply("Couldn't tell who you are.");
  const opt = (n: string) => it.data?.options?.find((o) => o.name === n)?.value;
  const uname = user.global_name || user.username;

  switch (it.data.name) {
    case "link": {
      const acct = await linkCode(String(opt("code") ?? ""), user.id, uname);
      if (!acct) return reply("That code is wrong or expired. Get a new one in the mod (Discord Alerts, **Link Discord**).");
      return reply(`Linked **${acct.name}**. Alerts, clips and status updates from this account now come to you. Try \`/test\`.`);
    }
    case "unlink": {
      const name = String(opt("account") ?? "").trim().toLowerCase();
      const all = await listAccounts(user.id);
      const hit = all.filter((a) => name === "all" || a.acct.name.toLowerCase() === name);
      if (!hit.length) return reply(all.length ? `No linked account called "${name}". Yours: ${all.map((a) => a.acct.name).join(", ")}` : "You have no linked accounts.");
      for (const a of hit) await unlinkHash(a.hash, user.id);
      return reply(`Unlinked ${hit.map((a) => `**${a.acct.name}**`).join(", ")}. The mod will need a new code to link again.`);
    }
    case "accounts": {
      const all = await listAccounts(user.id);
      const cfg = await getCfg(user.id);
      if (!all.length) return reply("No linked accounts. In the mod open Discord Alerts and press **Link Discord**, then `/link <code>` here.");
      const lines = all.map((a) => `- **${a.acct.name}**: last heard from ${ago(a.acct.lastSeen)}${a.acct.lastStatus ? `\n  ${a.acct.lastStatus.split("\n")[0].slice(0, 120)}` : ""}`);
      const where = cfg.mode === "channel" && cfg.channel ? `<#${cfg.channel}>` : "your DMs";
      return reply(`${lines.join("\n")}\n\nAlerts go to ${where}. Status updates are ${cfg.updates ? "on" : "off"}.`);
    }
    case "alerts": {
      const where = String(opt("where") ?? "dm");
      if (where === "here") {
        if (!it.guild_id || !it.channel_id) return reply("Use `where:here` inside a server channel. In DMs, alerts already come here.");
        await setCfg(user.id, { mode: "channel", channel: it.channel_id });
        return reply(`Alerts will be posted in <#${it.channel_id}> and ping you. (The bot needs permission to send messages and attach files here.)`);
      }
      await setCfg(user.id, { mode: "dm", channel: undefined });
      return reply("Alerts will come to your DMs.");
    }
    case "updates": {
      const on = opt("enabled") !== false;
      await setCfg(user.id, { updates: on });
      return reply(on ? "Status updates are on." : "Status updates are off. Alerts (stuck, failsafe, clips) still come through.");
    }
    case "test": {
      try {
        await deliver(user.id, await getCfg(user.id), {
          title: "Test alert",
          description: "If you can read this, 3310 Client alerts reach you here.",
          color: COLORS.info,
          footer: { text: "3310 Client" },
          timestamp: new Date().toISOString(),
        }, true);
        return reply("Sent a test alert.");
      } catch (e) {
        return reply(`Couldn't send it: ${(e as Error).message}. If it's about DMs, join the 3310 server or use \`/alerts where:here\` in a channel.`);
      }
    }
  }
  return reply("Unknown command.");
}
