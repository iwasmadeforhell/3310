"use client";
import { useCallback, useEffect, useState } from "react";

export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  year: string;
  images: { src: string; w?: number; h?: number }[];
};

const block = (e: React.SyntheticEvent) => e.preventDefault();

/** Image that can't be dragged or right-click-saved casually. (The real
 *  protection is server-side: the files only stream to logged-in sessions.) */
function Protected({ src, alt, w, h, eager }: { src: string; alt: string; w?: number; h?: number; eager?: boolean }) {
  return (
    <span className="pf-img" onContextMenu={block} style={w && h ? { aspectRatio: `${w} / ${h}` } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} loading={eager ? "eager" : "lazy"} decoding="async" />
      <span className="pf-shield" aria-hidden />
    </span>
  );
}

export default function Gallery({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<{ item: number; img: number } | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) =>
      setOpen((o) => {
        if (!o) return o;
        const n = items[o.item].images.length;
        return { ...o, img: (o.img + d + n) % n };
      }),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close, step]);

  const cur = open ? items[open.item] : null;

  return (
    <>
      <div className="pf-grid">
        {items.map((it, i) => (
          <button key={it.id} className="pf-card" onClick={() => setOpen({ item: i, img: 0 })}>
            <Protected src={it.images[0].src} w={it.images[0].w} h={it.images[0].h} alt={it.title} eager={i < 4} />
            <span className="pf-card-meta">
              <span className="pf-card-title">{it.title}</span>
              <span className="pf-card-year">
                {it.year}
                {it.images.length > 1 ? ` · ${it.images.length}` : ""}
              </span>
            </span>
          </button>
        ))}
      </div>

      {cur && open && (
        <div className="pf-lightbox" role="dialog" aria-modal="true" aria-label={cur.title} onClick={close} onContextMenu={block}>
          <div className="pf-lb-stage" onClick={(e) => e.stopPropagation()}>
            <Protected src={cur.images[open.img].src} alt={cur.title} eager />
          </div>
          <aside className="pf-lb-info" onClick={(e) => e.stopPropagation()}>
            <p className="pf-eyebrow">
              {cur.year} {cur.images.length > 1 && `· ${open.img + 1} / ${cur.images.length}`}
            </p>
            <h2>{cur.title}</h2>
            {cur.description && <p className="pf-lb-desc">{cur.description}</p>}
            <div className="pf-lb-nav">
              {cur.images.length > 1 && (
                <>
                  <button onClick={() => step(-1)} aria-label="Previous">←</button>
                  <button onClick={() => step(1)} aria-label="Next">→</button>
                </>
              )}
              <button onClick={close} aria-label="Close">Close ✕</button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
