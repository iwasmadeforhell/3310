"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { upload } from "@vercel/blob/client";

type Row = { id: string; title: string; year: string; description: string; count: number; thumb: string };

async function dimensions(file: File): Promise<{ w?: number; h?: number }> {
  try {
    const bmp = await createImageBitmap(file);
    const out = { w: bmp.width, h: bmp.height };
    bmp.close();
    return out;
  } catch {
    return {};
  }
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "image";
}

export default function ManageClient({ items }: { items: Row[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!files.length || busy) return;
    setBusy(true);
    try {
      const images: { pathname: string; w?: number; h?: number }[] = [];
      for (const [i, file] of files.entries()) {
        setStatus(`Uploading ${i + 1}/${files.length}: ${file.name}`);
        const dims = await dimensions(file);
        const blob = await upload(`portfolio/${safeName(file.name)}`, file, {
          access: "private",
          handleUploadUrl: "/api/portfolio/upload",
          multipart: file.size > 10 * 1024 * 1024,
          onUploadProgress: ({ percentage }) =>
            setStatus(`Uploading ${i + 1}/${files.length}: ${file.name} — ${Math.round(percentage)}%`),
        });
        images.push({ pathname: blob.pathname, ...dims });
      }
      setStatus("Saving…");
      const res = await fetch("/api/portfolio/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, year, description, images }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Save failed");
      setTitle("");
      setDescription("");
      setFiles([]);
      setStatus("Added ✓");
      router.refresh();
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete “${name}” and its images? This can't be undone.`)) return;
    const res = await fetch(`/api/portfolio/items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else alert("Delete failed");
  }

  async function toTop(id: string) {
    await fetch("/api/portfolio/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, move: "top" }),
    });
    router.refresh();
  }

  async function edit(row: Row) {
    const t = prompt("Title", row.title);
    if (t === null) return;
    const y = prompt("Year", row.year);
    if (y === null) return;
    const d = prompt("Description", row.description);
    if (d === null) return;
    await fetch("/api/portfolio/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, title: t, year: y, description: d }),
    });
    router.refresh();
  }

  return (
    <div className="pf-manage">
      <form className="pf-form" onSubmit={submit}>
        <h2>Add a piece</h2>
        <label className="pf-field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="Untitled" />
        </label>
        <label className="pf-field">
          <span>Year</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} maxLength={12} />
        </label>
        <label className="pf-field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={4000} />
        </label>
        <label className="pf-drop">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <span>{files.length ? `${files.length} image${files.length > 1 ? "s" : ""} selected` : "Choose images (JPG, PNG, WebP, GIF, AVIF · max 50 MB each)"}</span>
        </label>
        {files.length > 0 && (
          <div className="pf-previews">
            {files.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.name + f.size} src={URL.createObjectURL(f)} alt="" />
            ))}
          </div>
        )}
        <button className="pf-btn" disabled={busy || !files.length}>
          {busy ? "Working…" : "Upload & add"}
        </button>
        {status && <p className="pf-status">{status}</p>}
      </form>

      <section className="pf-list">
        <h2>{items.length} pieces</h2>
        {items.map((r) => (
          <div key={r.id} className="pf-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.thumb ? <img src={r.thumb} alt="" draggable={false} /> : <span />}
            <div>
              <strong>{r.title}</strong>
              <small>
                {r.year} · {r.count} image{r.count === 1 ? "" : "s"}
              </small>
            </div>
            <div className="pf-row-actions">
              <button onClick={() => toTop(r.id)}>↑ Top</button>
              <button onClick={() => edit(r)}>Edit</button>
              <button onClick={() => remove(r.id, r.title)} className="danger">
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
