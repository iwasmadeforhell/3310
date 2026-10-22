"use client";

import { useState } from "react";
import { fmtDate, post } from "../client";
import HwidForm from "../verify/HwidForm";
import { isStaffTier, tierClass } from "@/lib/tiers";
import type { publicUser, Payment } from "@/lib/store";

export type PublicUser = ReturnType<typeof publicUser>;
type Rel = { channel: string; version: string; name: string; size: number; uploadedAt: number };

function TierPill({ tier }: { tier: string }) {
  return <span className={`st-pill ${tierClass(tier)}`}>{tier}</span>;
}

export default function Dashboard(props: { initial: PublicUser; payments: Payment[]; releases: Rel[]; cooldownMs: number; paid: string }) {
  const [u, setU] = useState(props.initial);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState({ email: "", current: "", password: "" });
  const [pwMsg, setPwMsg] = useState("");

  const left = u.expiresAt === null || isStaffTier(u.tier) ? null : u.expiresAt ? u.expiresAt - Date.now() : 0;
  const days = left === null ? null : Math.max(0, Math.ceil(left / 86400000));
  const slots = isStaffTier(u.tier) ? "unlimited" : "3";

  async function removeMc(uuid: string) {
    setErr("");
    try {
      setU((await post<{ user: PublicUser }>("/api/store/mc", { uuid })).user);
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <>
      <div className="st-toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 32, marginBottom: 4 }}>Dashboard</h1>
          <span className="st-dim">
            {u.discordName ?? u.email} · <TierPill tier={u.tier} />
          </span>
        </div>
        <button
          className="st-btn small"
          onClick={async () => {
            await post("/api/store/logout");
            window.location.href = "/";
          }}
        >
          Log out
        </button>
      </div>
      {props.paid === "crypto" ? (
        <div className="st-msg ok">Thanks! Your month is added once the payment is confirmed on the blockchain (usually 5-30 minutes depending on the coin; refresh to check).</div>
      ) : (
        props.paid && <div className="st-msg ok">Thanks! Your month is added as soon as Stripe confirms the payment (usually a few seconds; refresh if needed).</div>
      )}
      {u.banned && <div className="st-msg err">This account is banned.</div>}
      {err && <div className="st-msg err">{err}</div>}

      <div className="st-dash">
        <div className="st-card">
          <h2>Licence</h2>
          <p>
            {u.active ? <span className="st-pill ok">active</span> : <span className="st-pill bad">inactive</span>}{" "}
            {days === null ? (
              <span className="st-dim">never expires</span>
            ) : u.expiresAt ? (
              <span className="st-dim">
                {left! > 0 ? `${days} day${days === 1 ? "" : "s"} left · until ${fmtDate(u.expiresAt)}` : `ran out ${fmtDate(u.expiresAt)}`}
              </span>
            ) : (
              <span className="st-dim">nothing bought yet</span>
            )}
          </p>
          {!isStaffTier(u.tier) && u.expiresAt !== null && (
            <a className="st-btn primary" href="/purchase">
              {u.active ? "Add a month" : "Buy a month"}
            </a>
          )}
        </div>

        <div className="st-card">
          <h2>Download</h2>
          {!u.active ? (
            <p className="st-dim">Downloads open once your licence is active.</p>
          ) : props.releases.length ? (
            props.releases.map((r) => (
              <div className="st-row" key={r.channel}>
                <span>
                  <b>{r.channel === "beta" ? "Beta" : "Stable"}</b> {r.version && <span className="st-dim">v{r.version}</span>}
                  <br />
                  <span className="st-dim st-small">
                    {(r.size / 1048576).toFixed(1)} MB · {fmtDate(r.uploadedAt)}
                  </span>
                </span>
                <a className="st-btn small primary" href={`/api/store/download?channel=${r.channel}`}>
                  Download
                </a>
              </div>
            ))
          ) : (
            <p className="st-dim">No build is up yet. Check back soon.</p>
          )}
          <p className="st-dim st-small" style={{ marginTop: 10 }}>
            Put the jar in <span className="st-mono">.minecraft/mods</span> (Minecraft 26.2, Fabric Loader + Fabric API + Fabric Language Kotlin).
          </p>
        </div>

        <div className="st-card">
          <h2>Hardware id</h2>
          <p className="st-dim st-small">
            Your licence works on one PC. The mod shows its hardware id on first launch and copies it to your clipboard. You can change it once every 24 hours.
          </p>
          {u.hwid ? (
            <dl className="st-kv" style={{ marginBottom: 14 }}>
              <dt>Verified PC</dt>
              <dd className="st-mono">{u.hwid}</dd>
              <dt>Since</dt>
              <dd>{fmtDate(u.hwidSetAt)}</dd>
              {u.hwidSetAt && Date.now() - u.hwidSetAt < props.cooldownMs && (
                <>
                  <dt>Next change</dt>
                  <dd>{fmtDate(u.hwidSetAt + props.cooldownMs)}</dd>
                </>
              )}
            </dl>
          ) : (
            <div className="st-msg">No PC verified yet.</div>
          )}
          <HwidForm onDone={setU} label={u.hwid ? "Change PC" : "Verify PC"} />
        </div>

        <div className="st-card">
          <h2>Minecraft accounts</h2>
          <p className="st-dim st-small">
            Accounts are added automatically the first time the mod runs on them ({u.mc.length} of {slots} used).
          </p>
          {u.mc.length === 0 && <p className="st-dim">None yet.</p>}
          {u.mc.map((m) => (
            <div className="st-row" key={m.uuid}>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://mc-heads.net/avatar/${m.uuid}/28`} width={28} height={28} alt="" style={{ borderRadius: 6 }} />
                <span>
                  <b>{m.name || "?"}</b>
                  <br />
                  <span className="st-dim st-small">added {fmtDate(m.addedAt)}</span>
                </span>
              </span>
              <button className="st-btn small danger" onClick={() => removeMc(m.uuid)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="st-card">
          <h2>Discord alerts</h2>
          <ol className="st-steps st-small">
            <li>
              <span>In Minecraft open the menu (Right Shift), QoL → <b>Discord Alerts</b>, press <b>Link Discord</b>.</span>
            </li>
            <li>
              <span>
                Type <span className="st-mono">/link CODE</span> to the 3310 bot on Discord.
              </span>
            </li>
            <li>
              <span>Stuck / stopped macros, failsafe clips and status updates now come to your DMs.</span>
            </li>
          </ol>
          {!u.discordId && (
            <a className="st-btn discord small" style={{ marginTop: 14 }} href="/api/store/discord?next=/dashboard">
              Link Discord to this account
            </a>
          )}
        </div>

        <div className="st-card">
          <h2>Login</h2>
          <dl className="st-kv" style={{ marginBottom: 14 }}>
            <dt>Discord</dt>
            <dd>{u.discordName ?? <span className="st-dim">not linked</span>}</dd>
            <dt>Email</dt>
            <dd>{u.email ?? <span className="st-dim">none</span>}</dd>
          </dl>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPwMsg("");
              try {
                await post("/api/store/password", pw);
                setPwMsg("Saved. Other sessions were signed out.");
                setPw({ email: "", current: "", password: "" });
                if (!u.email) window.location.reload();
              } catch (x) {
                setPwMsg((x as Error).message);
              }
            }}
          >
            {!u.email && (
              <input className="st-input" style={{ marginBottom: 8 }} type="email" placeholder="Email" value={pw.email} onChange={(e) => setPw({ ...pw, email: e.target.value })} />
            )}
            {u.hasPassword && (
              <input
                className="st-input"
                style={{ marginBottom: 8 }}
                type="password"
                placeholder="Current password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            )}
            <input
              className="st-input"
              style={{ marginBottom: 8 }}
              type="password"
              placeholder={u.hasPassword ? "New password" : "Password (8+ characters)"}
              autoComplete="new-password"
              value={pw.password}
              onChange={(e) => setPw({ ...pw, password: e.target.value })}
            />
            <button className="st-btn small">{u.hasPassword ? "Change password" : "Add email login"}</button>
            {pwMsg && <div className="st-msg">{pwMsg}</div>}
          </form>
        </div>

        {props.payments.length > 0 && (
          <div className="st-card full">
            <h2>Payments</h2>
            {props.payments.map((p) => (
              <div className="st-row" key={p.id}>
                <span>{fmtDate(p.at)}</span>
                <span className="st-dim">1 month</span>
                <span>
                  {(p.amount / 100).toFixed(2)} {p.currency.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
