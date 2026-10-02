"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  year: string;
  category: "photography" | "art";
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

const SECTIONS = [
  { key: "photography", label: "Photography" },
  { key: "art", label: "Art" },
] as const;

export default function Gallery({ items: all }: { items: GalleryItem[] }) {
  const [section, setSection] = useState<(typeof SECTIONS)[number]["key"]>("photography");
  const [open, setOpen] = useState<{ item: number; img: number } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const items = useMemo(() => all.filter((i) => i.category === section), [all, section]);
  const counts = useMemo(
    () => ({ photography: all.filter((i) => i.category === "photography").length, art: all.filter((i) => i.category === "art").length }),
    [all],
  );

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

  // Slide the carousel to the chosen image (arrows / keys / thumbnails).
  useEffect(() => {
    const el = track.current;
    if (!el || !open) return;
    const target = open.img * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 4) el.scrollTo({ left: target, behavior: "smooth" });
  }, [open]);

  // Scrolling/swiping the carousel updates the current image.
  const onScroll = () => {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setOpen((o) => (o && o.img !== i && i < items[o.item].images.length ? { ...o, img: i } : o));
  };

  return (
    <>
      <div className="pf-tabs" role="tablist">
        {SECTIONS.map((s) => (
          <button key={s.key} role="tab" aria-selected={section === s.key} className={section === s.key ? "on" : ""} onClick={() => setSection(s.key)}>
            {s.label} <small>{String(counts[s.key]).padStart(2, "0")}</small>
          </button>
        ))}
      </div>
      {items.length === 0 && <p className="pf-note">Nothing in {section === "art" ? "Art" : "Photography"} yet.</p>}

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
            <div className="pf-track" ref={track} onScroll={onScroll} tabIndex={0}>
              {cur.images.map((im, k) => (
                <div className="pf-slide" key={im.src}>
                  <Protected src={im.src} alt={`${cur.title} (${k + 1})`} eager={Math.abs(k - open.img) <= 1} />
                </div>
              ))}
            </div>
            {cur.images.length > 1 && (
              <div className="pf-dots">
                {cur.images.map((im, k) => (
                  <button key={im.src} className={k === open.img ? "on" : ""} onClick={() => setOpen({ ...open, img: k })} aria-label={`Image ${k + 1}`} />
                ))}
              </div>
            )}
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
