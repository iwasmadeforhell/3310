"use client";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";
import type { DropFile, ShortLink } from "@/lib/drop";
import { logout } from "@/components/useLogin";
// lib/compress is only loaded when a video actually gets compressed.
const isVideo = (f: File) => f.type.startsWith("video/") || /\.(mp4|m4v|mov|webm|mkv)$/i.test(f.name);

type Pending = { key: string; name: string; pct: number; stage?: "waiting" | "compressing"; error?: string };

const THUMB_TYPES = /^image\/(png|jpe?g|gif|webp|avif)$/;
const THUMB_MAX = 8 * 1024 * 1024; // don't pull big images just for a preview

function bytes(n: number) {
  if (n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  // 1023.5 so a value that would round up to "1024 MB" becomes "1.0 GB" instead
  while (n >= 1023.5 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function ago(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function timeLeft(ms: number) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";
}

export default function DropClient({
  initialLinks,
  initialFiles,
  configured,
  quota,
  otherBytes,
}: {
  initialLinks: ShortLink[];
  initialFiles: DropFile[];
  configured: boolean;
  /** Total space in the shared Blob store, and how much the portfolio already uses. */
  quota: number;
  otherBytes: number;
}) {
  const [base, setBase] = useState("");
  const [tab, setTab] = useState<"links" | "files">("links");
  const [links, setLinks] = useState(initialLinks);
  const [files, setFiles] = useState(initialFiles);
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [temp, setTemp] = useState(false); // true = new uploads auto-delete after 24 hours
  const [shrink, setShrink] = useState(false); // true = videos are compressed to 480p 60fps before upload
  const [now, setNow] = useState(() => Date.now());
  const compressQueue = useRef<Promise<unknown>>(Promise.resolve()); // one video at a time
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBase(window.location.origin.replace("//drop.", "//"));
    try {
      setTemp(localStorage.getItem("dr-expiry") === "24h");
      setShrink(localStorage.getItem("dr-video") === "480p");
    } catch {}
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  function chooseExpiry(t: boolean) {
    setTemp(t);
    try {
      localStorage.setItem("dr-expiry", t ? "24h" : "never");
    } catch {}
  }

  function chooseVideo(s: boolean) {
    setShrink(s);
    try {
      localStorage.setItem("dr-video", s ? "480p" : "original");
    } catch {}
  }

  // Expired files drop out of the list on their own; the server deletes them.
  const liveFiles = files.filter((f) => !f.expiresAt || f.expiresAt > now);
  const used = otherBytes + liveFiles.reduce((n, f) => n + (f.size || 0), 0);
  const left = Math.max(0, quota - used);
  const usedPct = Math.min(100, (used / quota) * 100);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied((c) => (c === text ? null : c)), 1400);
    } catch {
      prompt("Copy this:", text);
    }
  }

  async function shorten(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/drop/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(data.error ?? "Failed");
    setLinks((l) => [data, ...l]);
    setUrl("");
    setCode("");
    copy(`${base}/s/${data.code}`);
  }

  async function removeLink(c: string) {
    if (!confirm(`Delete /s/${c}?`)) return;
    const res = await fetch(`/api/drop/links?code=${encodeURIComponent(c)}`, { method: "DELETE" });
    if (res.ok) setLinks((l) => l.filter((x) => x.code !== c));
  }

  async function sendFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    if (!arr.length) return;
    setTab("files");
    const expires = temp ? "24h" : "never";
    let room = left;
    await Promise.all(
      arr.map(async (original) => {
        let file = original;
        const key = `${file.name}-${file.size}-${Math.random()}`;
        setPending((p) => [...p, { key, name: file.name, pct: 0 }]);
        const set = (patch: Partial<Pending>) =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
        try {
          if (shrink && isVideo(file)) {
            set({ stage: "waiting" });
            const job = compressQueue.current.then(async () => {
              set({ stage: "compressing" });
              const { compressVideo } = await import("@/lib/compress");
              return compressVideo(original, (pct) => set({ pct }));
            });
            compressQueue.current = job.catch(() => {});
            file = await job;
            set({ stage: undefined, pct: 0, name: file.name });
          }
          if (file.size > room) return set({ error: `Not enough storage left (${bytes(left)} free)` });
          room -= file.size;
          const blob = await upload(`drop/${safeName(file.name)}`, file, {
            access: "private",
            handleUploadUrl: "/api/drop/upload",
            multipart: file.size > 20 * 1024 * 1024,
            onUploadProgress: ({ percentage }) => set({ pct: percentage }),
          });
          const res = await fetch("/api/drop/files", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pathname: blob.pathname,
              name: file.name,
              size: file.size,
              contentType: blob.contentType || file.type,
              expires,
            }),
          });
          if (!res.ok) throw new Error("Could not save file record");
          const saved: DropFile = await res.json();
          setFiles((f) => [saved, ...f]);
          setPending((p) => p.filter((x) => x.key !== key));
        } catch (err) {
          set({ error: (err as Error).message });
        }
      }),
    );
  }

  async function removeFile(f: DropFile) {
    if (!confirm(`Delete ${f.name}? The link will stop working.`)) return;
    const res = await fetch(`/api/drop/files?id=${encodeURIComponent(f.id)}`, { method: "DELETE" });
    if (res.ok) setFiles((x) => x.filter((y) => y.id !== f.id));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) sendFiles(e.dataTransfer.files);
  }

  return (
    <main
      className={`dr-main ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <header className="dr-head">
        <div className="dr-logo small">
          Drop<span>.</span>
        </div>
        <nav>
          <span className="dr-stat">
            {links.length} links · {liveFiles.length} files
          </span>
          <button className="dr-ghost" onClick={() => logout()}>
            lock
          </button>
        </nav>
      </header>

      {!configured && (
        <div className="dr-warn">Storage not connected — add Upstash Redis + a private Blob store in Vercel (see README).</div>
      )}

      <div className="dr-storage">
        <div className="dr-storage-row">
          <span>
            <strong>{bytes(left)}</strong> of storage left
          </span>
          <span>
            {bytes(used)} of {bytes(quota)} used
          </span>
        </div>
        <div
          className={`dr-meter ${usedPct > 90 ? "full" : ""}`}
          role="meter"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedPct)}
        >
          <div style={{ width: `${usedPct}%` }} />
        </div>
      </div>

      <div className="dr-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "links"} className={tab === "links" ? "on" : ""} onClick={() => setTab("links")}>
          01 / Shorten
        </button>
        <button role="tab" aria-selected={tab === "files"} className={tab === "files" ? "on" : ""} onClick={() => setTab("files")}>
          02 / Files
        </button>
      </div>

      {tab === "links" && (
        <section className="dr-panel">
          <form className="dr-shorten" onSubmit={shorten}>
            <input
              className="dr-url"
              placeholder="paste a long url…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              aria-label="URL to shorten"
            />
            <div className="dr-code">
              <span>{base.replace(/^https?:\/\//, "")}/s/</span>
              <input
                placeholder="random"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\w-]/g, ""))}
                maxLength={48}
                aria-label="Custom code (optional)"
              />
            </div>
            <button className="dr-go" disabled={busy || !url.trim()}>
              {busy ? "…" : "shorten"}
            </button>
          </form>
          {msg && <p className="dr-msg">{msg}</p>}

          <ul className="dr-list">
            {links.map((l) => {
              const short = `${base}/s/${l.code}`;
              return (
                <li key={l.code}>
                  <div className="dr-li-main">
                    <button className="dr-short" onClick={() => copy(short)} title="Copy">
                      /s/{l.code}
                      <em>{copied === short ? "copied ✓" : "copy"}</em>
                    </button>
                    <a className="dr-long" href={l.url} target="_blank" rel="noopener noreferrer">
                      {l.url}
                    </a>
                  </div>
                  <div className="dr-li-meta">
                    <span>{l.clicks ?? 0} clicks</span>
                    <span>{ago(l.createdAt)}</span>
                    <button className="dr-x" onClick={() => removeLink(l.code)} aria-label={`Delete ${l.code}`}>
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
            {!links.length && <li className="dr-empty">No links yet.</li>}
          </ul>
        </section>
      )}

      {tab === "files" && (
        <section className="dr-panel">
          <button className="dr-zone" onClick={() => fileInput.current?.click()}>
            <strong>Drop files anywhere</strong>
            <span>or click to choose · up to 500 MB each</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) sendFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="dr-expiry" role="radiogroup" aria-label="How long to keep new uploads">
            <span>new uploads:</span>
            <button type="button" role="radio" aria-checked={!temp} className={!temp ? "on" : ""} onClick={() => chooseExpiry(false)}>
              permanent link
            </button>
            <button type="button" role="radio" aria-checked={temp} className={temp ? "on" : ""} onClick={() => chooseExpiry(true)}>
              delete after 24 hours
            </button>
          </div>
          <div className="dr-expiry" role="radiogroup" aria-label="How to upload videos">
            <span>videos:</span>
            <button type="button" role="radio" aria-checked={!shrink} className={!shrink ? "on" : ""} onClick={() => chooseVideo(false)}>
              keep original
            </button>
            <button type="button" role="radio" aria-checked={shrink} className={shrink ? "on" : ""} onClick={() => chooseVideo(true)}>
              compress to 480p 60fps
            </button>
          </div>

          <ul className="dr-list">
            {pending.map((p) => (
              <li key={p.key} className="dr-pending">
                <div className="dr-li-main">
                  <span className="dr-fname">{p.name}</span>
                  <div className="dr-progress">
                    <div style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
                <div className="dr-li-meta">
                  {p.error ? (
                    <>
                      <span className="dr-bad">{p.error}</span>
                      <button className="dr-x" onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                        ✕
                      </button>
                    </>
                  ) : (
                    <span>
                      {p.stage === "waiting" ? "waiting to compress" : `${p.stage ?? "uploading"} ${Math.round(p.pct)}%`}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {liveFiles.map((f) => {
              const link = `${base}/f/${f.id}`;
              return (
                <li key={f.id}>
                  <div className="dr-li-main">
                    {THUMB_TYPES.test(f.contentType) && f.size <= THUMB_MAX ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="dr-thumb" src={`/f/${f.id}`} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="dr-thumb" aria-hidden>
                        {(f.name.split(".").pop() ?? "").slice(0, 4) || "file"}
                      </span>
                    )}
                    <button className="dr-short" onClick={() => copy(link)} title="Copy link">
                      /f/{f.id}
                      <em>{copied === link ? "copied ✓" : "copy"}</em>
                    </button>
                    <a className="dr-long" href={link} target="_blank" rel="noopener noreferrer">
                      {f.name}
                    </a>
                  </div>
                  <div className="dr-li-meta">
                    <span>{bytes(f.size)}</span>
                    <span>{ago(f.createdAt)}</span>
                    {f.expiresAt ? (
                      <span className="dr-exp">deletes in {timeLeft(f.expiresAt - now)}</span>
                    ) : (
                      <span className="dr-perm">permanent</span>
                    )}
                    <a className="dr-x" href={`${link}?dl`} aria-label="Download">
                      ↓
                    </a>
                    <button className="dr-x" onClick={() => removeFile(f)} aria-label={`Delete ${f.name}`}>
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
            {!liveFiles.length && !pending.length &&<li className="dr-empty">No files yet.</li>}
          </ul>
        </section>
      )}

      {dragging && (
        <div className="dr-overlay" aria-hidden>
          <span>release to upload</span>
        </div>
      )}
    </main>
  );
}
