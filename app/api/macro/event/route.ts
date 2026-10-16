import { del, get } from "@vercel/blob";
import {
  CHUNK_PREFIX,
  COLORS,
  DiscordError,
  MAX_UPLOAD,
  accountFor,
  clip,
  deliver,
  getCfg,
  macroReady,
  touchAccount,
  type Embed,
  type OutFile,
} from "@/lib/macro";
import { rateLimited } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  kind?: "alert" | "status" | "info";
  title?: string;
  text?: string;
  fields?: { name?: string; value?: string; inline?: boolean }[];
  upload?: { id?: string; parts?: number; name?: string; type?: string };
};

const TYPES = /^(video\/mp4|image\/jpeg|image\/png)$/;

// An alert / status update from the mod -> the linked Discord user's DMs (or their chosen channel).
export async function POST(req: Request) {
  const why = macroReady();
  if (why) return Response.json({ error: why }, { status: 503 });
  const a = await accountFor(req);
  if (!a) return Response.json({ error: "Unknown token - pair again" }, { status: 401 });
  if (!a.acct.discordId) return Response.json({ error: "Not linked yet: type /link <code> in Discord" }, { status: 409 });
  if (await rateLimited(`macro:event:${a.hash}`, 40, 600)) return Response.json({ error: "Too many alerts" }, { status: 429 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const kind = b.kind === "status" || b.kind === "info" ? b.kind : "alert";
  const cfg = await getCfg(a.acct.discordId);
  await touchAccount(a.hash, a.acct, { lastSeen: Date.now(), lastStatus: kind === "status" ? clip(b.text, 300) : a.acct.lastStatus });

  // read the uploaded parts (if any) before deciding to skip, so they are always cleaned up
  let file: OutFile | undefined;
  const parts: string[] = [];
  if (b.upload?.id && /^[a-z0-9]{12,40}$/.test(b.upload.id)) {
    const n = Math.min(Number(b.upload.parts ?? 0), 10);
    const base = `${CHUNK_PREFIX}${a.hash.slice(0, 24)}/${b.upload.id}/`;
    const bufs: Buffer[] = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const p = `${base}${String(i).padStart(3, "0")}`;
      parts.push(p);
      const r = await get(p, { access: "private" });
      if (!r) break;
      const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
      total += buf.length;
      if (total > MAX_UPLOAD) break;
      bufs.push(buf);
    }
    const type = TYPES.test(b.upload.type ?? "") ? (b.upload.type as string) : "video/mp4";
    const name = /^[A-Za-z0-9._-]{1,80}$/.test(b.upload.name ?? "") ? (b.upload.name as string) : type === "video/mp4" ? "clip.mp4" : "frame.jpg";
    if (bufs.length === n && total <= MAX_UPLOAD && total > 0) file = { name, type, data: Buffer.concat(bufs) };
  }

  try {
    if (kind === "status" && !cfg.updates) return Response.json({ ok: true, skipped: "status updates are off" });
    const embed: Embed = {
      title: clip(b.title, 256) || (kind === "status" ? "Status update" : "Alert"),
      description: clip(b.text, 3500) || undefined,
      color: kind === "alert" ? COLORS.alert : kind === "status" ? COLORS.status : COLORS.info,
      fields: (b.fields ?? []).slice(0, 12).map((f) => ({ name: clip(f.name, 256) || "-", value: clip(f.value, 1024) || "-", inline: !!f.inline })),
      author: { name: a.acct.name, icon_url: `https://mc-heads.net/avatar/${a.acct.uuid}/64` },
      footer: { text: "3310 Client" },
      timestamp: new Date().toISOString(),
    };
    if (file?.type.startsWith("image/")) embed.image = { url: `attachment://${file.name}` };
    await deliver(a.acct.discordId, cfg, embed, kind === "alert", file);
    return Response.json({ ok: true, attached: !!file });
  } catch (e) {
    const err = e as DiscordError;
    const msg =
      err.code === 50007
        ? "Discord won't let the bot DM you: join the 3310 server or allow DMs, or use /alerts where:here in a channel"
        : err.message;
    return Response.json({ error: msg }, { status: 502 });
  } finally {
    if (parts.length) await del(parts).catch(() => {});
  }
}
