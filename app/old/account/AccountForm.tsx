"use client";
import { useState } from "react";
import type { PublicUser } from "@/lib/users";
import ColorPicker from "../ColorPicker";

export default function AccountForm({ me }: { me: PublicUser }) {
  const [color, setColor] = useState(me.color);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/old/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (res?.ok) window.location.reload();
    else setMsg(data?.error ?? "Save failed");
  }

  return (
    <div className="old-editor">
      <p>
        user name: <b>{me.name}</b> · user id: <b>{me.num ? `#${me.num}` : "?"}</b> · role: <b>{me.role}</b>
      </p>
      <label>name colour</label>
      <ColorPicker name={me.name} color={color} onChange={setColor} />
      {msg && <p className="old-err">⚠ {msg}</p>}
      <button type="button" className="old-btn big" onClick={save} disabled={busy || color === me.color}>
        {busy ? "saving..." : "save colour"}
      </button>
    </div>
  );
}
