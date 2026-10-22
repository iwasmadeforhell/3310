import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { transcriptFor } from "@/lib/tickets";

export const metadata: Metadata = { title: "Ticket transcript", robots: { index: false, follow: false } };

const fmt = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

function avatar(id: string, hash?: string | null) {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=64`;
  return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(id) >> BigInt(22)) % 6}.png`;
}

// 3310.nz/transcript/<id>?k=<key>: a closed ticket, readable by whoever has the link (the member and the log channel).
export default async function TranscriptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> }) {
  const { id } = await params;
  const { k } = await searchParams;
  const tr = k ? await transcriptFor(id, k) : null;
  if (!tr) notFound();
  const num = String(tr.number).padStart(4, "0");
  return (
    <main className="st-wrap" style={{ padding: "32px 0 64px" }}>
      <div className="st-card">
        <h1 style={{ margin: 0 }}>
          Ticket #{num} <span className="st-dim">· {tr.topic}</span>
        </h1>
        <p className="st-dim st-small" style={{ marginBottom: 0 }}>
          {tr.guildName ?? "Server"} · opened by <b>{tr.ownerName}</b> {fmt(tr.openedAt)} · closed by <b>{tr.closedBy}</b> {fmt(tr.closedAt)}
          {tr.reason ? ` · ${tr.reason}` : ""}
          {tr.rating ? ` · rated ${"★".repeat(tr.rating)}${"☆".repeat(5 - tr.rating)}` : ""}
        </p>
        {tr.answers.length > 0 && (
          <dl style={{ margin: "16px 0 0" }}>
            {tr.answers.map((a, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <dt className="st-dim st-small">{a.q}</dt>
                <dd style={{ margin: 0, whiteSpace: "pre-wrap" }}>{a.a}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="st-card">
        {tr.messages.length === 0 && <p className="st-dim">No messages.</p>}
        {tr.messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--line)" : undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar(m.author.id, m.author.avatar)} alt="" width={36} height={36} style={{ borderRadius: "50%", flex: "none" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div>
                <b>{m.author.name}</b>
                {m.author.bot && <span className="st-pill" style={{ marginLeft: 6 }}>bot</span>}
                <span className="st-dim st-small" style={{ marginLeft: 8 }}>{fmt(m.at)}</span>
              </div>
              {m.content && <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.content}</div>}
              {m.embeds.map((e, j) => (
                <div key={j} style={{ borderLeft: "3px solid var(--line)", paddingLeft: 10, marginTop: 6 }}>
                  {e.title && <b>{e.title}</b>}
                  {e.description && <div className="st-dim" style={{ whiteSpace: "pre-wrap" }}>{e.description}</div>}
                </div>
              ))}
              {m.attachments.map((a, j) => (
                <div key={j} className="st-small">
                  📎{" "}
                  <a href={a.url} target="_blank" rel="noreferrer">
                    {a.name}
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="st-dim st-small">Kept for 180 days after the ticket was closed. Attachment links are Discord&apos;s and can stop working sooner.</p>
    </main>
  );
}
