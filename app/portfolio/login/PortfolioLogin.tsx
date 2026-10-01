"use client";
import { useLogin } from "@/components/useLogin";

export default function PortfolioLogin({ asAdmin }: { asAdmin: boolean }) {
  const { password, setPassword, error, busy, submit } = useLogin(asAdmin ? "manage" : "portfolio", asAdmin ? "/manage" : "/");

  return (
    <main className="pf-login">
      <div className="pf-login-grain" aria-hidden />
      <form onSubmit={submit} className="pf-login-card">
        <p className="pf-eyebrow">{asAdmin ? "admin" : "private"} · 3310.nz</p>
        <h1>
          Selected <em>work</em>
        </h1>
        <p className="pf-login-sub">
          {asAdmin ? "Sign in to manage the portfolio." : "This collection is private. Enter the password to view it."}
        </p>
        <label className="pf-field">
          <span>Password</span>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" className="pf-btn" disabled={busy || !password}>
          {busy ? "Checking…" : "Enter →"}
        </button>
        <p className="pf-error" role="alert">{error ?? " "}</p>
      </form>
    </main>
  );
}
