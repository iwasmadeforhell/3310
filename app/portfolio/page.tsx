import { redirect } from "next/navigation";
import { canViewPortfolio, hasSession } from "@/lib/auth";
import { hasRedis } from "@/lib/redis";
import { imageUrl, listPortfolio } from "@/lib/portfolio";
import Gallery, { type GalleryItem } from "./Gallery";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  // Real gate: checked on the server for every request.
  if (!(await canViewPortfolio())) redirect("/login");

  const [items, isAdmin] = await Promise.all([listPortfolio(), hasSession("manage")]);
  const gallery: GalleryItem[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    year: i.year,
    images: i.images.map((im) => ({ src: imageUrl(im.pathname), w: im.w, h: im.h })),
  }));

  return (
    <main className="pf-main">
      <header className="pf-head">
        <div>
          <p className="pf-eyebrow">3310.nz / portfolio</p>
          <h1>
            Selected <em>work</em>
          </h1>
        </div>
        <nav className="pf-nav">
          <span className="pf-count">{String(items.length).padStart(2, "0")} pieces</span>
          {isAdmin && <a href="/manage">Manage</a>}
          <LogoutButton className="pf-link" />
        </nav>
      </header>

      {!hasRedis() && (
        <p className="pf-note">Storage isn&apos;t connected yet. Add Upstash Redis and a private Blob store in Vercel (see README).</p>
      )}
      {hasRedis() && items.length === 0 && (
        <p className="pf-note">
          Nothing here yet.{isAdmin ? " Add your first piece from Manage." : ""}
        </p>
      )}

      <Gallery items={gallery} />

      <footer className="pf-foot">
        <span>© {new Date().getFullYear()} 3310.nz</span>
        <span>All work private. Please don&apos;t share.</span>
      </footer>
    </main>
  );
}
