"use client";
import { useLogin } from "@/components/useLogin";

export default function DropLogin() {
  const { password, setPassword, error, busy, submit } = useLogin("drop", "/");
  return (
    <main className="dr-login">
      <div className="dr-tape" aria-hidden>
        <span>RESTRICTED · DROP · 3310.NZ · RESTRICTED · DROP · 3310.NZ · RESTRICTED · DROP · 3310.NZ ·</span>
      </div>
      <form className="dr-login-box" onSubmit={submit}>
        <div className="dr-logo">
          Drop<span>.</span>
        </div>
        <p className="dr-sub">links + files · authorised use only</p>
        <div className="dr-inputrow">
          <input
            type="password"
            placeholder="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            aria-label="Password"
          />
          <button disabled={busy || !password} aria-label="Unlock">
            {busy ? "…" : "→"}
          </button>
        </div>
        <p className="dr-err" role="alert">{error ?? " "}</p>
      </form>
      <div className="dr-tape dr-tape-2" aria-hidden>
        <span>NO ENTRY · NO ENTRY · NO ENTRY · NO ENTRY · NO ENTRY · NO ENTRY · NO ENTRY · NO ENTRY ·</span>
      </div>
    </main>
  );
}
