import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { redis } from "@/lib/redis";
import { COLORS, clip, discord, DiscordError, dmChannel } from "@/lib/macro";
import { origin } from "@/lib/storeApi";

// Support tickets for the 3310 bot, in the style of tickets.bot, over the HTTP interactions endpoint (no gateway):
// a panel message with one button per topic -> an optional form (modal) -> a private channel for the member and the
// staff role, with Close / Claim buttons. Closing saves a transcript (3310.nz/transcript/<id>?k=..., 180 days, also as a
// .txt in the log channel), DMs it to the member with a 1-5 star rating, and deletes the channel. Slow work runs in
// after() so the 3 s interaction deadline is always met.

// ---- types ----------------------------------------------------------------------------------------

export type DUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
type Member = { user: DUser; roles: string[]; permissions?: string };
type Opt = { name: string; type: number; value?: string | number | boolean; options?: Opt[]; focused?: boolean };
export type Interaction = {
  id: string;
  token: string;
  application_id: string;
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: Member;
  user?: DUser;
  data?: {
    name?: string;
    options?: Opt[];
    custom_id?: string;
    components?: { components: { custom_id: string; value: string }[] }[];
    resolved?: { users?: Record<string, DUser>; roles?: Record<string, { id: string; name: string }> };
  };
};

type Topic = { id: string; name: string; emoji?: string; questions: string[] };
type Cfg = { category: string; staff: string; log?: string; limit: number; autoCloseH: number; topics: Topic[]; guildName?: string };
type Ticket = {
  guild: string;
  channel: string;
  owner: string;
  ownerName: string;
  number: number;
  topic: string;
  answers: { q: string; a: string }[];
  openedAt: number;
  claimedBy?: string;
  closeRequest?: string;
};
type TMsg = {
  author: { id: string; name: string; avatar?: string | null; bot?: boolean };
  content: string;
  at: number;
  attachments: { name: string; url: string }[];
  embeds: { title?: string; description?: string }[];
};
export type Transcript = {
  id: string;
  key: string;
  guild: string;
  guildName?: string;
  number: number;
  topic: string;
  owner: string;
  ownerName: string;
  openedAt: number;
  closedAt: number;
  closedBy: string;
  reason?: string;
  claimedBy?: string;
  answers: Ticket["answers"];
  messages: TMsg[];
  log?: string;
  rating?: number;
};

const DEFAULT_TOPICS: Topic[] = [
  { id: "buy", name: "Purchase / licence", emoji: "🛒", questions: ["What's it about? (order, payment, licence)", "Store email or payment id (optional)"] },
  { id: "help", name: "Help / bug", emoji: "🛠️", questions: ["What happened?", "Minecraft name (optional)"] },
  { id: "other", name: "Other", emoji: "💬", questions: ["What do you need?"] },
];

const K = {
  cfg: (g: string) => `tk:cfg:${g}`,
  num: (g: string) => `tk:num:${g}`,
  t: (ch: string) => `tk:t:${ch}`,
  open: (g: string) => `tk:open:${g}`,
  mine: (g: string, u: string) => `tk:mine:${g}:${u}`,
  bl: (g: string) => `tk:bl:${g}`,
  tags: (g: string) => `tk:tags:${g}`,
  stats: (g: string) => `tk:stats:${g}`,
  tr: (id: string) => `tk:tr:${id}`,
  guilds: "tk:guilds",
};
const TRANSCRIPT_TTL = 180 * 86400;
const MAX_MESSAGES = 1000;

// permission bits
const VIEW = 1024, SEND = 2048, MANAGE_MSG = 8192, EMBED = 16384, ATTACH = 32768, HISTORY = 65536, MANAGE_CH = 16;
const MEMBER_ALLOW = String(VIEW | SEND | EMBED | ATTACH | HISTORY);
const STAFF_ALLOW = String(VIEW | SEND | EMBED | ATTACH | HISTORY | MANAGE_MSG);
const BOT_ALLOW = String(VIEW | SEND | EMBED | ATTACH | HISTORY | MANAGE_MSG | MANAGE_CH);
const ADMIN_BITS = BigInt(8) | BigInt(32); // Administrator, Manage Server

// ---- small helpers --------------------------------------------------------------------------------

const EPH = 64;
const JH = { "Content-Type": "application/json" };
const NONE = { parse: [] as string[] };

const say = (content: string, components?: unknown[]) => Response.json({ type: 4, data: { content, flags: EPH, components, allowed_mentions: NONE } });
const pub = (data: Record<string, unknown>) => Response.json({ type: 4, data: { allowed_mentions: NONE, ...data } });
const update = (data: Record<string, unknown>) => Response.json({ type: 7, data: { allowed_mentions: NONE, ...data } });
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

const userOf = (it: Interaction) => it.member?.user ?? it.user;
const nameOf = (u: DUser) => u.global_name || u.username;
const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const errText = (e: unknown) => (e instanceof DiscordError ? `${e.message} (Discord ${e.status})` : (e as Error).message);

function slug(s: string, max = 24) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max) || "user";
}

function emojiOf(e?: string) {
  if (!e) return undefined;
  const m = e.match(/^<(a?):(\w+):(\d+)>$/);
  return m ? { name: m[2], id: m[3], animated: m[1] === "a" } : { name: e };
}

/** The subcommand path and its options: /tickets topic add name:x -> ["topic","add"], {name:"x"}. */
function walk(opts: Opt[] | undefined) {
  const path: string[] = [];
  let cur = opts ?? [];
  for (;;) {
    const s = cur.find((o) => o.type === 1 || o.type === 2);
    if (!s) break;
    path.push(s.name);
    cur = s.options ?? [];
  }
  const values: Record<string, string | number | boolean> = {};
  let focused: string | undefined;
  for (const o of cur) {
    if (o.value !== undefined) values[o.name] = o.value;
    if (o.focused) focused = o.name;
  }
  return { path, values, focused };
}

function isStaff(it: Interaction, cfg: Cfg | null) {
  const m = it.member;
  if (!m) return false;
  if (cfg && m.roles.includes(cfg.staff)) return true;
  try {
    return (BigInt(m.permissions ?? "0") & ADMIN_BITS) !== BigInt(0);
  } catch {
    return false;
  }
}

async function getCfg(g: string) {
  return (await redis().get<Cfg>(K.cfg(g))) ?? null;
}

async function send(channel: string, payload: Record<string, unknown>, file?: { name: string; data: string }) {
  if (!file) return (await discord(`/channels/${channel}/messages`, { method: "POST", headers: JH, body: JSON.stringify(payload) })) as { id: string };
  const form = new FormData();
  form.set("payload_json", JSON.stringify({ ...payload, attachments: [{ id: 0, filename: file.name }] }));
  form.set("files[0]", new Blob([file.data], { type: "text/plain" }), file.name);
  return (await discord(`/channels/${channel}/messages`, { method: "POST", body: form })) as { id: string };
}

async function editReply(it: Interaction, content: string) {
  await discord(`/webhooks/${it.application_id}/${it.token}/messages/@original`, {
    method: "PATCH",
    headers: JH,
    body: JSON.stringify({ content, allowed_mentions: NONE }),
  }).catch(() => {});
}

/** Run [work] after the response has gone out; a failure is reported in the deferred reply when there is one. */
function later(it: Interaction | null, work: () => Promise<void>) {
  after(async () => {
    try {
      await work();
    } catch (e) {
      console.error("ticket work failed", e);
      if (it) await editReply(it, `Something went wrong: ${errText(e)}`);
    }
  });
}

/** The member's open tickets in this server (channels that no longer exist are dropped). */
async function openTicketsOf(g: string, u: string): Promise<string[]> {
  const r = redis();
  const ids = await r.smembers(K.mine(g, u));
  const alive: string[] = [];
  for (const ch of ids) {
    if (await r.exists(K.t(ch))) alive.push(ch);
    else await r.srem(K.mine(g, u), ch);
  }
  return alive;
}

// ---- entry points ---------------------------------------------------------------------------------

/** Slash commands /tickets, /ticket and /tag. */
export async function ticketCommand(it: Interaction): Promise<Response> {
  const g = it.guild_id;
  if (!g || !it.member) return say("Tickets only work inside a server.");
  const { path, values } = walk(it.data?.options);
  const me = userOf(it)!;
  const cfg = await getCfg(g);
  const r = redis();

  if (it.data?.name === "tag") {
    if (!isStaff(it, cfg)) return say("Only staff can send saved replies.");
    const text = await r.hget<string>(K.tags(g), String(values.name ?? "").toLowerCase());
    if (!text) return say(`No saved reply called "${values.name}". See \`/tickets tag list\`.`);
    return pub({ content: text });
  }

  if (it.data?.name === "tickets") {
    const sub = path.join(" ");
    if (sub === "setup") {
      const next: Cfg = {
        ...(cfg ?? { limit: 1, autoCloseH: 0, topics: DEFAULT_TOPICS }),
        category: String(values.category),
        staff: String(values.staff),
        log: values.log ? String(values.log) : cfg?.log,
        limit: values.limit ? Number(values.limit) : (cfg?.limit ?? 1),
      };
      try {
        next.guildName = ((await discord(`/guilds/${g}`, { method: "GET" })) as { name: string }).name;
      } catch {}
      await r.set(K.cfg(g), next);
      await r.sadd(K.guilds, g);
      return say(
        `Saved. Tickets open in <#${next.category}>, answered by <@&${next.staff}>${next.log ? `, transcripts go to <#${next.log}>` : ""}, ${next.limit} open per member.\n` +
          "Next: run `/tickets panel` in the channel where members should open tickets. The bot needs **Manage Channels**, **Manage Messages**, **View Channels**, **Send Messages**, **Embed Links**, **Attach Files** and **Read Message History** (or Administrator).",
      );
    }
    if (!cfg) return say("Run `/tickets setup` first.");
    switch (sub) {
      case "panel": {
        if (!it.channel_id) return say("Use this in a channel.");
        const buttons = cfg.topics.slice(0, 25).map((t) => ({ type: 2, style: 2, label: t.name, emoji: emojiOf(t.emoji), custom_id: `tk:open:${t.id}` }));
        if (!buttons.length) return say("There are no topics. Add one with `/tickets topic add`.");
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
        try {
          await send(it.channel_id, {
            embeds: [{
              title: String(values.title ?? "Support"),
              description: String(values.message ?? "Need help, have a question about your purchase or found a bug? Pick a topic below and a private channel opens for you and the team."),
              color: COLORS.status,
              footer: { text: cfg.guildName ?? "3310" },
            }],
            components: rows,
          });
        } catch (e) {
          return say(`Couldn't post here: ${errText(e)}. The bot needs to see this channel and send messages in it.`);
        }
        return say("Posted the panel.");
      }
      case "topic add": {
        const name = String(values.name).trim();
        const questions = String(values.questions ?? "").split("|").map((q) => q.trim()).filter(Boolean).slice(0, 5);
        const long = questions.filter((q) => q.replace(/\s*\(optional\)\s*$/i, "").length > 45);
        if (long.length) return say(`Discord allows 45 characters per form question; shorten: ${long.map((q) => `"${q}"`).join(", ")}`);
        let id = slug(name, 20);
        while (cfg.topics.some((t) => t.id === id)) id = `${slug(name, 14)}-${randomBytes(2).toString("hex")}`;
        if (cfg.topics.length >= 25) return say("A panel has at most 25 topics.");
        cfg.topics.push({ id, name, emoji: values.emoji ? String(values.emoji) : undefined, questions });
        await r.set(K.cfg(g), cfg);
        return say(`Added **${name}**${questions.length ? ` with ${questions.length} question(s)` : " (no form)"}. Post the panel again with \`/tickets panel\` to show it.`);
      }
      case "topic remove": {
        const want = String(values.name).toLowerCase();
        const t = cfg.topics.find((x) => x.id === want || x.name.toLowerCase() === want);
        if (!t) return say(`No topic called "${values.name}".`);
        cfg.topics = cfg.topics.filter((x) => x !== t);
        await r.set(K.cfg(g), cfg);
        return say(`Removed **${t.name}**. Post the panel again with \`/tickets panel\` (the old one's button stops working).`);
      }
      case "topic list":
        return say(
          cfg.topics.map((t) => `- ${t.emoji ?? ""} **${t.name}**${t.questions.length ? `\n${t.questions.map((q) => `  - ${q}`).join("\n")}` : " (no form)"}`).join("\n") || "No topics.",
        );
      case "autoclose": {
        cfg.autoCloseH = Number(values.hours ?? 0);
        await r.set(K.cfg(g), cfg);
        return say(cfg.autoCloseH ? `Tickets with no messages for ${cfg.autoCloseH} h are closed (checked once a day, around 03:30 UTC).` : "Auto-close is off.");
      }
      case "blacklist":
        await r.sadd(K.bl(g), String(values.user));
        return say(`<@${values.user}> can't open tickets any more.`);
      case "unblacklist":
        await r.srem(K.bl(g), String(values.user));
        return say(`<@${values.user}> can open tickets again.`);
      case "stats": {
        const s = (await r.hgetall<Record<string, number>>(K.stats(g))) ?? {};
        const open = await r.scard(K.open(g));
        const rated = Number(s.ratingN ?? 0);
        return say(
          `**Tickets** - open now: ${open}, opened: ${s.opened ?? 0}, closed: ${s.closed ?? 0}\n` +
            `**Ratings** - ${rated ? `${(Number(s.ratingSum) / rated).toFixed(2)} / 5 from ${rated}` : "none yet"}`,
        );
      }
      case "tag add":
        await r.hset(K.tags(g), { [String(values.name).toLowerCase()]: String(values.content) });
        return say(`Saved **${String(values.name).toLowerCase()}**. Staff send it with \`/tag\`.`);
      case "tag remove":
        await r.hdel(K.tags(g), String(values.name).toLowerCase());
        return say(`Deleted **${values.name}**.`);
      case "tag list": {
        const all = (await r.hgetall<Record<string, string>>(K.tags(g))) ?? {};
        const names = Object.keys(all);
        return say(names.length ? names.map((n) => `- **${n}**: ${clip(all[n], 80)}`).join("\n") : "No saved replies. Add one with `/tickets tag add`.");
      }
    }
    return say("Unknown command.");
  }

  // /ticket ... inside a ticket channel
  const t = it.channel_id ? await r.get<Ticket>(K.t(it.channel_id)) : null;
  if (!t || !cfg) return say("This isn't a ticket channel.");
  const staff = isStaff(it, cfg);
  const owner = me.id === t.owner;
  switch (path[0]) {
    case "close": {
      if (!staff && !owner) return say("Only the member who opened it or staff can close this ticket.");
      const reason = values.reason ? String(values.reason) : undefined;
      later(null, () => closeTicket(t, cfg, { id: me.id, name: nameOf(me) }, reason));
      return pub({ content: "🔒 Closing this ticket..." });
    }
    case "closerequest": {
      if (!staff) return say("Only staff can ask to close.");
      const reason = values.reason ? String(values.reason) : undefined;
      await r.set(K.t(t.channel), { ...t, closeRequest: reason ?? "" });
      return pub({
        content: `<@${t.owner}>`,
        allowed_mentions: { users: [t.owner] },
        embeds: [{ title: "Can this ticket be closed?", description: `${nameOf(me)} thinks this is sorted${reason ? `: ${reason}` : "."}`, color: COLORS.info }],
        components: [{ type: 1, components: [
          { type: 2, style: 3, label: "Yes, close it", custom_id: "tk:cr:yes" },
          { type: 2, style: 2, label: "No, keep it open", custom_id: "tk:cr:no" },
        ] }],
      });
    }
    case "claim":
      return claim(it, t, cfg);
    case "unclaim": {
      if (!t.claimedBy) return say("Nobody has claimed this ticket.");
      if (t.claimedBy !== me.id && !isStaff({ ...it, member: { ...it.member!, roles: [] } }, null)) return say("Only whoever claimed it (or an admin) can unclaim it.");
      await r.set(K.t(t.channel), { ...t, claimedBy: undefined });
      return pub({ content: `<@${me.id}> gave this ticket back to the team.` });
    }
    case "transfer": {
      if (!staff) return say("Only staff can transfer tickets.");
      const to = String(values.user);
      await r.set(K.t(t.channel), { ...t, claimedBy: to });
      await discord(`/channels/${t.channel}/permissions/${to}`, { method: "PUT", headers: JH, body: JSON.stringify({ type: 1, allow: STAFF_ALLOW }) }).catch(() => {});
      return pub({ content: `<@${me.id}> handed this ticket to <@${to}>.`, allowed_mentions: { users: [to] } });
    }
    case "add":
    case "remove": {
      if (!staff) return say("Only staff can change who sees a ticket.");
      const id = String(values.who);
      const isRole = !!it.data?.resolved?.roles?.[id];
      if (path[0] === "remove" && (id === t.owner || id === cfg.staff)) return say("The member who opened it and the staff role always stay in.");
      try {
        if (path[0] === "add") await discord(`/channels/${t.channel}/permissions/${id}`, { method: "PUT", headers: JH, body: JSON.stringify({ type: isRole ? 0 : 1, allow: MEMBER_ALLOW }) });
        else await discord(`/channels/${t.channel}/permissions/${id}`, { method: "DELETE" });
      } catch (e) {
        return say(`Couldn't: ${errText(e)}`);
      }
      const who = isRole ? `<@&${id}>` : `<@${id}>`;
      return pub({ content: path[0] === "add" ? `Added ${who} to this ticket.` : `Removed ${who} from this ticket.`, allowed_mentions: path[0] === "add" && !isRole ? { users: [id] } : NONE });
    }
    case "rename": {
      if (!staff) return say("Only staff can rename tickets.");
      const name = slug(String(values.name), 90);
      try {
        await discord(`/channels/${t.channel}`, { method: "PATCH", headers: JH, body: JSON.stringify({ name }) });
      } catch (e) {
        return say(`Couldn't rename: ${errText(e)} (Discord allows 2 renames per 10 minutes).`);
      }
      return say(`Renamed to #${name}.`);
    }
  }
  return say("Unknown command.");
}

/** Autocomplete for topic / tag names. */
export async function ticketAutocomplete(it: Interaction): Promise<Response> {
  const g = it.guild_id;
  const { path, values, focused } = walk(it.data?.options);
  const typed = String((focused && values[focused]) ?? "").toLowerCase();
  let names: string[] = [];
  if (g && (it.data?.name === "tag" || path[0] === "tag")) names = Object.keys((await redis().hgetall<Record<string, string>>(K.tags(g))) ?? {});
  else if (g && path[0] === "topic") names = ((await getCfg(g))?.topics ?? []).map((t) => t.name);
  const choices = names.filter((n) => n.toLowerCase().includes(typed)).slice(0, 25).map((n) => ({ name: n, value: n }));
  return Response.json({ type: 8, data: { choices } });
}

/** Buttons: open, close (+ confirm), claim, close-request answers, ratings. */
export async function ticketComponent(it: Interaction): Promise<Response> {
  const id = it.data?.custom_id ?? "";
  const me = userOf(it);
  if (!me) return say("Couldn't tell who you are.");
  const r = redis();

  if (id.startsWith("tk:rate:")) return rate(it, me, id);

  const g = it.guild_id;
  if (!g) return say("This only works in the server.");
  const cfg = await getCfg(g);
  if (!cfg) return say("Tickets aren't set up here any more.");

  if (id.startsWith("tk:open:")) {
    const topic = cfg.topics.find((t) => t.id === id.slice(8));
    if (!topic) return say("That topic was removed. Ask staff to post the panel again.");
    if (await r.sismember(K.bl(g), me.id)) return say("You can't open tickets in this server.");
    const mine = await openTicketsOf(g, me.id);
    if (mine.length >= cfg.limit) return say(`You already have an open ticket: ${mine.map((c) => `<#${c}>`).join(", ")}`);
    if (!topic.questions.length) {
      later(it, () => openTicket(it, cfg, topic, []));
      return Response.json({ type: 5, data: { flags: EPH } });
    }
    return Response.json({
      type: 9,
      data: {
        custom_id: `tk:form:${topic.id}`,
        title: clip(topic.name, 45),
        components: topic.questions.map((q, i) => ({
          type: 1,
          components: [{
            type: 4,
            custom_id: `q${i}`,
            label: q.replace(/\s*\(optional\)\s*$/i, "").slice(0, 45),
            style: i === 0 ? 2 : 1,
            required: !/\(optional\)\s*$/i.test(q),
            max_length: i === 0 ? 1000 : 200,
          }],
        })),
      },
    });
  }

  const t = it.channel_id ? await r.get<Ticket>(K.t(it.channel_id)) : null;
  if (!t) return say("This ticket is already closed.");
  const staff = isStaff(it, cfg);
  switch (id) {
    case "tk:close":
      if (!staff && me.id !== t.owner) return say("Only the member who opened it or staff can close this ticket.");
      return say("Close this ticket? A transcript is kept.", [{ type: 1, components: [{ type: 2, style: 4, label: "Close ticket", custom_id: "tk:close:yes" }] }]);
    case "tk:close:yes":
      later(null, () => closeTicket(t, cfg, { id: me.id, name: nameOf(me) }));
      return update({ content: "🔒 Closing...", components: [] });
    case "tk:claim":
      return claim(it, t, cfg);
    case "tk:cr:yes":
    case "tk:cr:no": {
      if (me.id !== t.owner) return say("Only the member who opened the ticket can answer this.");
      if (id === "tk:cr:no") {
        await r.set(K.t(t.channel), { ...t, closeRequest: undefined });
        return update({ content: `<@${t.owner}> wants to keep this ticket open.`, embeds: [], components: [] });
      }
      later(null, () => closeTicket(t, cfg, { id: me.id, name: nameOf(me) }, t.closeRequest || "Close request accepted"));
      return update({ content: "🔒 Closing (accepted)...", embeds: [], components: [] });
    }
  }
  return say("Unknown button.");
}

/** The form for a topic was sent: open the ticket. */
export async function ticketModal(it: Interaction): Promise<Response> {
  const g = it.guild_id;
  const me = userOf(it);
  const id = it.data?.custom_id ?? "";
  if (!g || !me || !id.startsWith("tk:form:")) return say("Unknown form.");
  const cfg = await getCfg(g);
  const topic = cfg?.topics.find((t) => t.id === id.slice(8));
  if (!cfg || !topic) return say("That topic was removed.");
  const values = new Map<string, string>();
  for (const row of it.data?.components ?? []) for (const c of row.components) values.set(c.custom_id, c.value);
  const answers = topic.questions.map((q, i) => ({ q: q.replace(/\s*\(optional\)\s*$/i, ""), a: (values.get(`q${i}`) ?? "").trim() })).filter((x) => x.a);
  later(it, () => openTicket(it, cfg, topic, answers));
  return Response.json({ type: 5, data: { flags: EPH } });
}

// ---- actions ----------------------------------------------------------------------------------------

async function claim(it: Interaction, t: Ticket, cfg: Cfg): Promise<Response> {
  const me = userOf(it)!;
  if (!isStaff(it, cfg)) return say("Only staff can claim tickets.");
  if (t.claimedBy === me.id) return say("You already have this ticket.");
  if (t.claimedBy) return say(`<@${t.claimedBy}> has this ticket. Ask them to \`/ticket transfer\` it.`);
  await redis().set(K.t(t.channel), { ...t, claimedBy: me.id });
  return pub({ content: `🙋 <@${me.id}> will handle this ticket.` });
}

async function openTicket(it: Interaction, cfg: Cfg, topic: Topic, answers: Ticket["answers"]) {
  const g = it.guild_id!;
  const me = userOf(it)!;
  const r = redis();
  // a double click / two forms at once: one ticket
  if (!(await r.set(`tk:opening:${g}:${me.id}`, 1, { nx: true, ex: 20 }))) return editReply(it, "Already opening your ticket...");
  try {
    const mine = await openTicketsOf(g, me.id);
    if (mine.length >= cfg.limit) return editReply(it, `You already have an open ticket: ${mine.map((c) => `<#${c}>`).join(", ")}`);
    const n = await r.incr(K.num(g));
    const num = String(n).padStart(4, "0");
    const ch = (await discord(`/guilds/${g}/channels`, {
      method: "POST",
      headers: JH,
      body: JSON.stringify({
        name: `ticket-${num}-${slug(me.username)}`,
        type: 0,
        parent_id: cfg.category,
        topic: `${topic.name} · opened by ${nameOf(me)} (${me.id})`,
        permission_overwrites: [
          { id: g, type: 0, deny: String(VIEW) },
          { id: me.id, type: 1, allow: MEMBER_ALLOW },
          { id: cfg.staff, type: 0, allow: STAFF_ALLOW },
          { id: it.application_id, type: 1, allow: BOT_ALLOW },
        ],
      }),
    })) as { id: string };
    const t: Ticket = { guild: g, channel: ch.id, owner: me.id, ownerName: nameOf(me), number: n, topic: topic.name, answers, openedAt: Date.now() };
    await r.set(K.t(ch.id), t);
    await r.sadd(K.open(g), ch.id);
    await r.sadd(K.mine(g, me.id), ch.id);
    await r.hincrby(K.stats(g), "opened", 1);
    await send(ch.id, {
      content: `<@${me.id}> <@&${cfg.staff}>`,
      allowed_mentions: { users: [me.id], roles: [cfg.staff] },
      embeds: [{
        title: `${topic.emoji ? `${topic.emoji} ` : ""}${topic.name} · #${num}`,
        description: "Thanks for opening a ticket. Someone from the team will be with you soon - add anything else here (screenshots welcome).",
        fields: answers.map((x) => ({ name: clip(x.q, 256), value: clip(x.a, 1024) })),
        color: COLORS.status,
        footer: { text: "Close it with the button or /ticket close when you're done" },
      }],
      components: [{ type: 1, components: [
        { type: 2, style: 4, label: "Close", emoji: { name: "🔒" }, custom_id: "tk:close" },
        { type: 2, style: 2, label: "Claim", emoji: { name: "🙋" }, custom_id: "tk:claim" },
      ] }],
    });
    await editReply(it, `Your ticket is open: <#${ch.id}>`);
  } catch (e) {
    await editReply(it, `Couldn't open a ticket: ${errText(e)}. Tell a staff member - the bot may be missing permissions in the ticket category.`);
  } finally {
    await r.del(`tk:opening:${g}:${me.id}`);
  }
}

type RawMsg = {
  id: string;
  content: string;
  timestamp: string;
  author: DUser;
  attachments?: { filename: string; url: string }[];
  embeds?: { title?: string; description?: string }[];
};

async function fetchMessages(channel: string): Promise<TMsg[]> {
  const out: RawMsg[] = [];
  let before = "";
  while (out.length < MAX_MESSAGES) {
    const page = (await discord(`/channels/${channel}/messages?limit=100${before ? `&before=${before}` : ""}`, { method: "GET" })) as RawMsg[];
    if (!page.length) break;
    out.push(...page);
    before = page[page.length - 1].id;
    if (page.length < 100) break;
  }
  return out.reverse().map((m) => ({
    author: { id: m.author.id, name: nameOf(m.author), avatar: m.author.avatar, bot: m.author.bot },
    content: m.content,
    at: Date.parse(m.timestamp),
    attachments: (m.attachments ?? []).map((a) => ({ name: a.filename, url: a.url })),
    embeds: (m.embeds ?? []).filter((e) => e.title || e.description).map((e) => ({ title: e.title, description: e.description })),
  }));
}

function transcriptText(tr: Transcript) {
  const d = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const lines = [
    `Ticket #${String(tr.number).padStart(4, "0")} - ${tr.topic} - ${tr.guildName ?? tr.guild}`,
    `Opened by ${tr.ownerName} (${tr.owner}) ${d(tr.openedAt)}; closed by ${tr.closedBy} ${d(tr.closedAt)}${tr.reason ? ` - ${tr.reason}` : ""}`,
    ...tr.answers.map((x) => `${x.q}: ${x.a}`),
    "",
  ];
  for (const m of tr.messages) {
    const parts = [m.content, ...m.embeds.map((e) => `[embed] ${[e.title, e.description].filter(Boolean).join(" - ")}`), ...m.attachments.map((a) => `[file] ${a.name} ${a.url}`)];
    lines.push(`[${d(m.at)}] ${m.author.name}${m.author.bot ? " (bot)" : ""}: ${parts.filter(Boolean).join("\n    ")}`);
  }
  return lines.join("\n");
}

export async function closeTicket(t: Ticket, cfg: Cfg, by: { id: string; name: string }, reason?: string) {
  const r = redis();
  if (!(await r.set(`tk:closing:${t.channel}`, 1, { nx: true, ex: 120 }))) return;
  await send(t.channel, {
    embeds: [{ description: `🔒 Closed by <@${by.id}>${reason ? `: ${clip(reason, 300)}` : ""}. This channel is deleted in a few seconds.`, color: COLORS.warn }],
    allowed_mentions: NONE,
  }).catch(() => {});

  let messages: TMsg[] = [];
  try {
    messages = await fetchMessages(t.channel);
  } catch (e) {
    console.error("transcript fetch failed", e);
  }
  const tr: Transcript = {
    id: randomBytes(9).toString("base64url"),
    key: randomBytes(12).toString("base64url"),
    guild: t.guild,
    guildName: cfg.guildName,
    number: t.number,
    topic: t.topic,
    owner: t.owner,
    ownerName: t.ownerName,
    openedAt: t.openedAt,
    closedAt: Date.now(),
    closedBy: by.name,
    reason,
    claimedBy: t.claimedBy,
    answers: t.answers,
    messages,
    log: cfg.log,
  };
  await r.set(K.tr(tr.id), tr, { ex: TRANSCRIPT_TTL });
  const url = `${origin()}/transcript/${tr.id}?k=${tr.key}`;
  const num = String(t.number).padStart(4, "0");
  const link = [{ type: 1, components: [{ type: 2, style: 5, label: "View transcript", url }] }];

  if (cfg.log) {
    await send(cfg.log, {
      embeds: [{
        title: `Ticket #${num} closed`,
        color: COLORS.info,
        fields: [
          { name: "Opened by", value: `<@${t.owner}>`, inline: true },
          { name: "Topic", value: t.topic, inline: true },
          { name: "Claimed by", value: t.claimedBy ? `<@${t.claimedBy}>` : "-", inline: true },
          { name: "Closed by", value: by.name, inline: true },
          { name: "Opened", value: `<t:${Math.floor(t.openedAt / 1000)}:f>`, inline: true },
          { name: "Messages", value: String(messages.length), inline: true },
          ...(reason ? [{ name: "Reason", value: clip(reason, 1024) }] : []),
        ],
      }],
      components: link,
      allowed_mentions: NONE,
    }, { name: `ticket-${num}.txt`, data: transcriptText(tr) }).catch((e) => console.error("log post failed", e));
  }

  try {
    const dm = await dmChannel(t.owner);
    await send(dm, {
      embeds: [{
        title: `Your ticket in ${cfg.guildName ?? "the server"} was closed`,
        description: `${reason ? `**Reason:** ${clip(reason, 300)}\n` : ""}You can read the whole conversation for 180 days with the button below.\n\n**How did we do?**`,
        color: COLORS.status,
      }],
      components: [
        { type: 1, components: [1, 2, 3, 4, 5].map((n) => ({ type: 2, style: n >= 4 ? 3 : 2, label: `${n} ★`, custom_id: `tk:rate:${tr.id}:${n}` })) },
        ...link,
      ],
    });
  } catch {} // DMs closed: the log channel still has it

  await sleep(4000);
  try {
    await discord(`/channels/${t.channel}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof DiscordError && e.status === 404)) console.error("ticket channel delete failed", e);
  }
  await r.del(K.t(t.channel));
  await r.srem(K.open(t.guild), t.channel);
  await r.srem(K.mine(t.guild, t.owner), t.channel);
  await r.hincrby(K.stats(t.guild), "closed", 1);
}

async function rate(it: Interaction, me: DUser, id: string): Promise<Response> {
  const [, , trId, nStr] = id.split(":");
  const n = Math.max(1, Math.min(5, Number(nStr) || 0));
  const r = redis();
  const tr = await r.get<Transcript>(K.tr(trId));
  if (!tr) return say("This ticket is too old to rate.");
  if (tr.owner !== me.id) return say("Only the member who opened the ticket can rate it.");
  if (!(await r.set(`tk:rated:${trId}`, n, { nx: true, ex: TRANSCRIPT_TTL }))) return update({ content: "You already rated this ticket - thanks!", components: [] });
  await r.set(K.tr(trId), { ...tr, rating: n }, { keepTtl: true });
  await r.hincrby(K.stats(tr.guild), "ratingSum", n);
  await r.hincrby(K.stats(tr.guild), "ratingN", 1);
  if (tr.log) {
    const log = tr.log;
    later(null, async () => {
      await send(log, { content: `${stars(n)}  Ticket #${String(tr.number).padStart(4, "0")} (${tr.topic}) was rated ${n}/5 by <@${tr.owner}>`, allowed_mentions: NONE });
    });
  }
  return update({ content: `Thanks! You rated this ticket ${stars(n)}.`, components: [] });
}

// ---- transcript page + cron ------------------------------------------------------------------------

/** The transcript for 3310.nz/transcript/<id>?k=<key>, or null when the id or key is wrong. */
export async function transcriptFor(id: string, key: string): Promise<Transcript | null> {
  if (!/^[\w-]{6,32}$/.test(id)) return null;
  const tr = await redis().get<Transcript>(K.tr(id));
  if (!tr) return null;
  const a = Buffer.from(tr.key);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b) ? tr : null;
}

const snowflakeMs = (id: string) => Number(BigInt(id) >> BigInt(22)) + 1420070400000;

/** Daily cron: close tickets with no messages for the server's auto-close hours. */
export async function autoCloseSweep(): Promise<number> {
  const r = redis();
  let closed = 0;
  for (const g of await r.smembers(K.guilds)) {
    const cfg = await getCfg(g);
    if (!cfg?.autoCloseH) continue;
    for (const ch of await r.smembers(K.open(g))) {
      const t = await r.get<Ticket>(K.t(ch));
      if (!t) { await r.srem(K.open(g), ch); continue; }
      let last = t.openedAt;
      try {
        const c = (await discord(`/channels/${ch}`, { method: "GET" })) as { last_message_id?: string | null };
        if (c.last_message_id) last = Math.max(last, snowflakeMs(c.last_message_id));
      } catch (e) {
        if (e instanceof DiscordError && e.status === 404) {
          await r.del(K.t(ch));
          await r.srem(K.open(g), ch);
          await r.srem(K.mine(g, t.owner), ch);
        }
        continue;
      }
      if (Date.now() - last > cfg.autoCloseH * 3600_000) {
        await closeTicket(t, cfg, { id: process.env.DISCORD_APP_ID ?? "", name: "Auto-close" }, `No messages for ${cfg.autoCloseH} h`);
        closed++;
      }
    }
  }
  return closed;
}
