"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Message } from "@/lib/messages";
import type { PublicUser } from "@/lib/users";
import UserName from "../../UserName";

const MAX = 2000;
const POLL_MS = 15_000;

function when(ts: number) {
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** One conversation: the messages, a box to write a new one, and a quiet refresh every 15 seconds. */
export default function Thread({ me, other, initial }: { me: PublicUser; other: PublicUser; initial: Message[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const res = await fetch(`/api/old/messages?with=${encodeURIComponent(other.id)}`).catch(() => null);
      if (res?.ok) setMessages(await res.json());
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [other.id]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/old/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: other.id, body: text }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setErr(data?.error ?? "Could not send the message");
    setMessages((m) => [...m, data]);
    setText("");
  }

  return (
    <>
      <div className="old-thread">
        {messages.length === 0 && <p className="old-note">no messages yet. say hi!</p>}
        {messages.map((m) => {
          const mine = m.from === me.id;
          return (
            <div key={m.id} className={`old-msg ${mine ? "mine" : ""}`}>
              <div className="old-msg-h">
                <UserName user={mine ? me : other} badge={false} /> <span>{when(m.at)}</span>
              </div>
              <div className="old-msg-body">{m.body}</div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      {other.deleted ? (
        <p className="old-note">this account was deleted, so you can&apos;t reply.</p>
      ) : (
        <form className="old-editor" onSubmit={send}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX}
            rows={4}
            placeholder={`write to ${other.name}...`}
            aria-label={`Message to ${other.name}`}
          />
          {err && <p className="old-err">⚠ {err}</p>}
          <button className="old-btn big" disabled={busy || !text.trim()}>
            {busy ? "sending..." : "send"}
          </button>
        </form>
      )}
    </>
  );
}
