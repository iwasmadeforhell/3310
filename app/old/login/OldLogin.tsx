"use client";
import { useLogin } from "@/components/useLogin";

export default function OldLogin() {
  const { username, setUsername, password, setPassword, error, busy, submit } = useLogin("admin", "/");
  return (
    <div className="old-desktop">
      <form className="win" onSubmit={submit}>
        <div className="win-title">
          <span>🔑 Admin Login</span>
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
              Type your user name and password to post news &amp; updates to <b>old.3310.nz</b>.
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
              maxLength={64}
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          {error && <p className="win-err">⚠ {error}</p>}
          <div className="win-actions">
            <button type="submit" className="win-btn" disabled={busy || !username || !password}>
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
