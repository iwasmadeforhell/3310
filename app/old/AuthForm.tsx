"use client";
import { useState, type FormEvent } from "react";
import ColorPicker, { NAME_COLORS } from "./ColorPicker";

/** The Win98-style box used for both logging in and registering. */
export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [color, setColor] = useState(NAME_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (register && password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/old/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, username, password, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return window.location.assign("/");
      setError(data.error ?? "That didn't work.");
      if (!register) setPassword("");
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  }

  return (
    <div className="old-desktop">
      <form className={`win ${register ? "wide" : ""}`} onSubmit={submit}>
        <div className="win-title">
          <span>{register ? "📝 New Member" : "🔑 Log In"}</span>
          <a href="/" className="win-x" aria-label="Close">
            ×
          </a>
        </div>
        <div className="win-body">
          <div className="win-row">
            <div className="win-icon" aria-hidden>
              ?
            </div>
            <p>
              {register ? (
                <>
                  Make an account on <b>forum.3310.nz</b> to post on the board and to like or dislike posts.
                </>
              ) : (
                <>
                  Type your user name and password to log in to <b>forum.3310.nz</b>.
                </>
              )}
            </p>
          </div>
          <label className="win-field">
            <span>
              <u>U</u>ser name:
            </span>
            <input
              type="text"
              autoFocus
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={register ? 20 : 64}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="win-field">
            <span>
              <u>P</u>assword:
            </span>
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          {register && (
            <>
              <label className="win-field">
                <span>Once more:</span>
                <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} disabled={busy} />
              </label>
              <div className="win-field">
                <span>Name colour:</span>
                <ColorPicker name={username} color={color} onChange={setColor} />
              </div>
              <p className="win-hint">3–20 letters, numbers, _ or - for the name. 8+ characters for the password. There is no password reset, so keep it somewhere safe.</p>
            </>
          )}
          {error && <p className="win-err">⚠ {error}</p>}
          <div className="win-actions">
            <a href={register ? "/login" : "/register"} className="win-link">
              {register ? "I already have an account" : "No account? Register"}
            </a>
            <button type="submit" className="win-btn" disabled={busy || !username || !password || (register && !again)}>
              {busy ? "Wait..." : "OK"}
            </button>
            <a href="/" className="win-btn">
              Cancel
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}
