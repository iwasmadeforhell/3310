"use client";

import { useState } from "react";
import { post } from "../client";

export default function AuthForm({ next, error }: { next: string; error?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(error ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await post(`/api/store/${mode}`, { email, password });
      window.location.href = next;
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="st-auth">
      <div className="st-card">
        <h2 style={{ textAlign: "center" }}>{mode === "login" ? "Log in" : "Create an account"}</h2>
        <a className="st-btn discord wide" href={`/api/store/discord?next=${encodeURIComponent(next)}`}>
          Continue with Discord
        </a>
        <div className="st-or">or with email</div>
        <div className="st-tabs" role="tablist">
          <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>
            Log in
          </button>
          <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>
            Sign up
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="st-field">
            <label htmlFor="email">Email</label>
            <input id="email" className="st-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="st-field">
            <label htmlFor="pw">Password{mode === "register" ? " (8+ characters)" : ""}</label>
            <input
              id="pw"
              className="st-input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "register" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <div className="st-msg err">{err}</div>}
          <button className="st-btn primary wide" disabled={busy}>
            {busy ? "..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
