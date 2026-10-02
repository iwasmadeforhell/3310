import { redirect } from "next/navigation";
import { hasSession } from "@/lib/auth";
import { hasRedis } from "@/lib/redis";
import { asCategory, imageUrl, listPortfolio } from "@/lib/portfolio";
import ManageClient from "./ManageClient";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  if (!(await hasSession("manage"))) redirect("/login?as=admin");
  const items = await listPortfolio();

  return (
    <main className="pf-main">
      <header className="pf-head">
        <div>
          <p className="pf-eyebrow">3310.nz / portfolio / manage</p>
          <h1>
            Manage <em>work</em>
          </h1>
        </div>
        <nav className="pf-nav">
          <a href="/">← Back to gallery</a>
        </nav>
      </header>
      {!hasRedis() && <p className="pf-note">Connect Upstash Redis and a private Blob store first (see README).</p>}
      <ManageClient
        items={items.map((i) => ({
          id: i.id,
          title: i.title,
          year: i.year,
          category: asCategory(i.category),
          description: i.description,
          count: i.images.length,
          thumb: i.images[0] ? imageUrl(i.images[0].pathname) : "",
        }))}
      />
    </main>
  );
}
