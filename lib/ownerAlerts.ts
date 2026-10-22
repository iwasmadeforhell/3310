import "server-only";
import { redis } from "./redis";
import { COLORS, discord, dmChannel, type Embed } from "./macro";

// Owner-only store alerts through the 3310 bot: a message for every purchase (crypto, PayPal, card) and for PayPal
// orders waiting to be confirmed. The owner is whoever owns the Discord application (or its team); /purchases sets
// where they go (DMs by default, a channel, or off). An alert never makes a payment fail.

type Where = { mode: "dm" | "channel" | "off"; channel?: string };
const WHERE_KEY = "bot:purchases";
const OWNER_KEY = "bot:owner";

/** The Discord user id of the application's owner (team owner for team apps), cached for a day. */
export async function ownerId(): Promise<string | null> {
  const r = redis();
  const cached = await r.get<string>(OWNER_KEY);
  if (cached) return cached;
  const app = (await discord("/applications/@me", { method: "GET" })) as { owner?: { id: string }; team?: { owner_user_id: string } | null };
  const id = app.team?.owner_user_id ?? app.owner?.id ?? null;
  if (id) await r.set(OWNER_KEY, id, { ex: 86400 });
  return id;
}

export async function getWhere(): Promise<Where> {
  return (await redis().get<Where>(WHERE_KEY)) ?? { mode: "dm" };
}

export async function setWhere(w: Where) {
  await redis().set(WHERE_KEY, w);
}

export async function alertOwner(embed: Embed, force = false) {
  try {
    if (!process.env.DISCORD_BOT_TOKEN) return;
    const w = await getWhere();
    if (w.mode === "off" && !force) return;
    const owner = await ownerId();
    if (!owner) return;
    const channel = w.mode === "channel" && w.channel ? w.channel : await dmChannel(owner);
    await discord(`/channels/${channel}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: w.mode === "channel" ? `<@${owner}>` : undefined,
        embeds: [{ footer: { text: "3310 store" }, timestamp: new Date().toISOString(), ...embed }],
        allowed_mentions: { users: w.mode === "channel" ? [owner] : [] },
      }),
    });
  } catch (e) {
    console.error("owner alert failed", e);
  }
}

const METHODS: [string, string][] = [["np_", "Crypto (NOWPayments)"], ["pp_", "PayPal"]];
export const methodOf = (paymentId: string) => METHODS.find(([p]) => paymentId.startsWith(p))?.[1] ?? "Card (Stripe)";

export function purchaseEmbed(p: {
  who: string;
  userId: string;
  paymentId: string;
  amount: number;
  currency: string;
  until: number | null;
  renewal: boolean;
}): Embed {
  return {
    title: p.renewal ? "💸 Renewal" : "💸 New purchase",
    color: COLORS.info,
    fields: [
      { name: "Customer", value: p.who, inline: true },
      { name: "Paid", value: `${(p.amount / 100).toFixed(2)} ${p.currency.toUpperCase()}`, inline: true },
      { name: "Method", value: methodOf(p.paymentId), inline: true },
      { name: "Licence until", value: p.until ? `<t:${Math.floor(p.until / 1000)}:D>` : "never expires", inline: true },
      { name: "Payment", value: `\`${p.paymentId.slice(0, 60)}\``, inline: true },
      { name: "User id", value: `\`${p.userId}\``, inline: true },
    ],
  };
}
