"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useMemo, useState } from "react";
import { fmtDate, post } from "../client";
import type { PublicUser } from "../dashboard/Dashboard";
import { TIERS, TIER_ORDER, isStaffTier, tierClass } from "@/lib/tiers";

type Rel = { channel: string; version: string; name: string; size: number; uploadedAt: number };
type Data = { users: PublicUser[]; devHwids: string[]; releases: Rel[] };


export default function Admin() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "active" | "inactive" | "banned">("all");
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/store/admin/users");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      setData(j);
    } catch (x) {
      setErr((x as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    setErr("");
    if (action === "delete" && !confirm("Delete this user and free their PC + accounts? This can't be undone.")) return;
    try {
      const r = await post<{ user?: PublicUser; deleted?: boolean }>("/api/store/admin/user", { id, action, ...extra });
      setData((d) =>
        d && { ...d, users: r.deleted ? d.users.filter((u) => u.id !== id) : d.users.map((u) => (u.id === id && r.user ? r.user : u)) },
      );
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  const users = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.users ?? [])
      .filter((u) => show === "all" || (show === "banned" ? u.banned : show === "active" ? u.active : !u.active && !u.banned))
      .filter(
        (u) =>
          !needle ||
          [u.email, u.discordName, u.discordId, u.hwid, u.id, u.note, ...u.mc.map((m) => m.name), ...u.mc.map((m) => m.uuid)]
            .filter(Boolean)
            .some((s) => s!.toLowerCase().includes(needle)),
      )
      .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.createdAt - a.createdAt);
  }, [data, q, show]);

  if (!data) return <p className="st-dim">{err || "Loading..."}</p>;
  const all = data.users;
  return (
    <>
      <h1 style={{ fontSize: 32 }}>Admin</h1>
      <div className="st-stats">
        <div className="st-stat">
          <b>{all.length}</b>
          <span>accounts</span>
        </div>
        <div className="st-stat">
          <b>{all.filter((u) => u.active).length}</b>
          <span>active licences</span>
        </div>
        <div className="st-stat">
          <b>{all.filter((u) => u.tier === "beta").length}</b>
          <span>beta</span>
        </div>
        <div className="st-stat">
          <b>{all.filter((u) => isStaffTier(u.tier)).length + data.devHwids.length}</b>
          <span>owner / dev (accounts + PCs)</span>
        </div>
        <div className="st-stat">
          <b>{all.filter((u) => u.hwid).length}</b>
          <span>verified PCs</span>
        </div>
      </div>
      {err && <div className="st-msg err">{err}</div>}

      <div className="st-card">
        <div className="st-toolbar">
          <input className="st-input" style={{ maxWidth: 320 }} placeholder="Search email, Discord, HWID, Minecraft name..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="st-input" style={{ width: "auto" }} value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
            <option value="all">Everyone</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="banned">Banned</option>
          </select>
          <button className="st-btn small" onClick={load}>
            Refresh
          </button>
          <span className="st-dim st-small">{users.length} shown</span>
        </div>
        <div className="st-scroll">
          <table className="st-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Tier</th>
                <th>Licence</th>
                <th>PC</th>
                <th>Minecraft</th>
                <th>Last check</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} u={u} open={open === u.id} toggle={() => setOpen(open === u.id ? null : u.id)} act={act} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="st-dash" style={{ marginTop: 16 }}>
        <PaypalOrders reload={load} />
        <Releases releases={data.releases} reload={load} />
        <div className="st-card">
          <h2>Developer PCs</h2>
          <p className="st-dim st-small">
            Always licensed as dev, no account needed. Set in the <span className="st-mono">STORE_DEV_HWIDS</span> environment variable.
          </p>
          {data.devHwids.map((h) => (
            <div className="st-mono" key={h}>
              {h}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function UserRow({ u, open, toggle, act }: { u: PublicUser; open: boolean; toggle: () => void; act: (id: string, a: string, x?: Record<string, unknown>) => void }) {
  const [hwid, setHwid] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState(u.note ?? "");
  const lic = u.banned ? (
    <span className="st-pill bad">banned</span>
  ) : isStaffTier(u.tier) || u.expiresAt === null ? (
    <span className="st-pill ok">never expires</span>
  ) : u.active ? (
    <span className="st-pill ok">until {fmtDate(u.expiresAt)}</span>
  ) : (
    <span className="st-pill warn">{u.expiresAt ? `ran out ${fmtDate(u.expiresAt)}` : "not bought"}</span>
  );
  return (
    <>
      <tr className={open ? "sel" : ""} onClick={toggle} style={{ cursor: "pointer" }}>
        <td>
          <b>{u.discordName ?? u.email ?? u.id}</b>
          {u.admin && <span className="st-pill" style={{ marginLeft: 6 }}>admin</span>}
          <br />
          <span className="st-dim">{u.discordName && u.email ? u.email : `joined ${fmtDate(u.createdAt)}`}</span>
        </td>
        <td>
          <span className={`st-pill ${tierClass(u.tier)}`}>{u.tier}</span>
        </td>
        <td>{lic}</td>
        <td className="st-mono">{u.hwid ?? <span className="st-dim">-</span>}</td>
        <td>{u.mc.map((m) => m.name).join(", ") || <span className="st-dim">-</span>}</td>
        <td>
          {fmtDate(u.lastCheck)}
          {u.lastVersion && <span className="st-dim"> · v{u.lastVersion}</span>}
        </td>
      </tr>
      {open && (
        <tr className="sel">
          <td colSpan={6}>
            <div className="st-dash">
              <div>
                <h3>Tier &amp; licence</h3>
                <div className="st-actions-row" style={{ marginBottom: 8 }}>
                  <select className="st-input" style={{ width: "auto" }} value={u.tier} onChange={(e) => act(u.id, "tier", { tier: e.target.value })}>
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button className="st-btn small" onClick={() => act(u.id, "addMonth")}>
                    +1 month
                  </button>
                  <button className="st-btn small" onClick={() => act(u.id, "removeMonth")}>
                    -1 month
                  </button>
                  <button className="st-btn small" onClick={() => act(u.id, "never")}>
                    Never expires
                  </button>
                </div>
                <div className="st-actions-row">
                  <input className="st-input" style={{ width: "auto" }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <button className="st-btn small" disabled={!date} onClick={() => act(u.id, "expires", { expiresAt: new Date(`${date}T23:59:59`).getTime() })}>
                    Set end date
                  </button>
                </div>
              </div>
              <div>
                <h3>PC</h3>
                <div className="st-actions-row" style={{ marginBottom: 8 }}>
                  <input className="st-input st-mono" placeholder="3310-..." value={hwid} onChange={(e) => setHwid(e.target.value)} />
                  <button className="st-btn small" disabled={!hwid} onClick={() => act(u.id, "setHwid", { hwid })}>
                    Set (no cooldown)
                  </button>
                  <button className="st-btn small" disabled={!u.hwid} onClick={() => act(u.id, "resetHwid")}>
                    Reset PC
                  </button>
                </div>
                <h3>Minecraft accounts</h3>
                {u.mc.length === 0 && <p className="st-dim">none</p>}
                {u.mc.map((m) => (
                  <div className="st-actions-row" key={m.uuid} style={{ alignItems: "center", marginBottom: 4 }}>
                    <span>
                      <b>{m.name}</b> <span className="st-dim st-mono">{m.uuid}</span>
                    </span>
                    <button className="st-btn small danger" onClick={() => act(u.id, "removeMc", { uuid: m.uuid })}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="full">
                <h3>Note</h3>
                <div className="st-actions-row">
                  <input className="st-input" style={{ flex: 1 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only admins see this" />
                  <button className="st-btn small" onClick={() => act(u.id, "note", { note })}>
                    Save note
                  </button>
                  {u.banned ? (
                    <button className="st-btn small" onClick={() => act(u.id, "unban")}>
                      Unban
                    </button>
                  ) : (
                    <button className="st-btn small danger" onClick={() => act(u.id, "ban")}>
                      Ban
                    </button>
                  )}
                  <button className="st-btn small danger" onClick={() => act(u.id, "delete")}>
                    Delete
                  </button>
                </div>
                <p className="st-dim st-small" style={{ marginTop: 6 }}>
                  id {u.id}
                  {u.discordId && ` · Discord ${u.discordId}`}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Releases({ releases, reload }: { releases: Rel[]; reload: () => void }) {
  const [channel, setChannel] = useState("stable");
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [pct, setPct] = useState<number | null>(null);

  async function send() {
    if (!file) return;
    setMsg("");
    try {
      const blob = await upload(`releases/${channel}/${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`, file, {
        access: "private",
        handleUploadUrl: "/api/store/admin/release",
        onUploadProgress: (p) => setPct(Math.round(p.percentage)),
      });
      await post("/api/store/admin/release", { channel, pathname: blob.pathname, name: file.name, version, size: file.size }, "PUT");
      setMsg("Uploaded.");
      setFile(null);
      reload();
    } catch (x) {
      setMsg((x as Error).message);
    }
    setPct(null);
  }

  return (
    <div className="st-card">
      <h2>Builds</h2>
      {releases.map((r) => (
        <div className="st-row" key={r.channel}>
          <span>
            <b>{r.channel}</b> v{r.version || "?"} <span className="st-dim st-small">{r.name}</span>
          </span>
          <span className="st-dim st-small">{fmtDate(r.uploadedAt)}</span>
        </div>
      ))}
      <div className="st-actions-row" style={{ marginTop: 12 }}>
        <select className="st-input" style={{ width: "auto" }} value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="stable">stable (everyone)</option>
          <option value="beta">beta (beta + dev)</option>
        </select>
        <input className="st-input" style={{ width: 110 }} placeholder="1.19.0" value={version} onChange={(e) => setVersion(e.target.value)} />
      </div>
      <div className="st-actions-row" style={{ marginTop: 8 }}>
        <input type="file" accept=".jar" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="st-btn small primary" disabled={!file || pct !== null} onClick={send}>
          {pct !== null ? `${pct}%` : "Upload"}
        </button>
      </div>
      {msg && <div className="st-msg">{msg}</div>}
    </div>
  );
}

type PaypalOrder = { code: string; userId: string; who: string; at: number };

/** Open PayPal.me orders: match the code in the PayPal note, then confirm to add the month. */
function PaypalOrders({ reload }: { reload: () => void }) {
  const [orders, setOrders] = useState<PaypalOrder[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch("/api/store/admin/paypal")
      .then((r) => r.json())
      .then((j) => (j.error ? setErr(j.error) : setOrders(j.orders)))
      .catch((x) => setErr((x as Error).message));
  }, []);

  async function resolve(code: string, action: "confirm" | "dismiss") {
    if (action === "confirm" && !confirm(`Add one month for ${code}? Only do this once the payment is in your PayPal.`)) return;
    setErr("");
    try {
      setOrders((await post<{ orders: PaypalOrder[] }>("/api/store/admin/paypal", { code, action })).orders);
      if (action === "confirm") reload();
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <div className="st-card">
      <h2>PayPal orders</h2>
      <p className="st-dim st-small">Buyers put their code in the PayPal note. Confirm once the money is in your PayPal; dismiss stale ones.</p>
      {err && <div className="st-msg err">{err}</div>}
      {orders === null ? (
        <p className="st-dim">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="st-dim st-small">No open orders.</p>
      ) : (
        orders.map((o) => (
          <div className="st-row" key={o.code}>
            <span className="st-mono">{o.code}</span>
            <span className="st-dim">
              {o.who} · {fmtDate(o.at)}
            </span>
            <span>
              <button className="st-btn small primary" onClick={() => resolve(o.code, "confirm")}>
                Confirm
              </button>{" "}
              <button className="st-btn small" onClick={() => resolve(o.code, "dismiss")}>
                Dismiss
              </button>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
