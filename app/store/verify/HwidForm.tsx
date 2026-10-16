"use client";

import { useState } from "react";
import { post } from "../client";
import type { PublicUser } from "../dashboard/Dashboard";

/** Paste the hardware id the mod copied to the clipboard and bind it to this account. */
export default function HwidForm({ initial = "", label = "Verify PC", onDone }: { initial?: string; label?: string; onDone?: (u: PublicUser) => void }) {
  const [hwid, setHwid] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { user } = await post<{ user: PublicUser }>("/api/store/hwid", { hwid });
      setMsg({ ok: true, text: "PC verified. Go back to Minecraft and press Check again (or restart the game)." });
      onDone?.(user);
    } catch (x) {
      setMsg({ ok: false, text: (x as Error).message });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <div className="st-field">
        <label htmlFor="hwid">Hardware id</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="hwid"
            className="st-input st-mono"
            placeholder="3310-XXXXX-XXXXX-XXXXX-XXXXX"
            value={hwid}
            onChange={(e) => setHwid(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="st-btn small"
            title="Paste from clipboard"
            onClick={async () => {
              try {
                setHwid((await navigator.clipboard.readText()).trim());
              } catch {
                setMsg({ ok: false, text: "Your browser blocked clipboard access. Paste with Ctrl+V instead." });
              }
            }}
          >
            Paste
          </button>
        </div>
      </div>
      <button className="st-btn primary" disabled={busy || !hwid.trim()}>
        {busy ? "..." : label}
      </button>
      {msg && <div className={`st-msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
    </form>
  );
}
