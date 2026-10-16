import type { Metadata } from "next";
import { Inter, VT323 } from "next/font/google";
import { currentUser, isAdmin } from "@/lib/store";
import "./store.css";

const sans = Inter({ subsets: ["latin"], variable: "--sans" });
const pixel = VT323({ weight: "400", subsets: ["latin"], variable: "--pixel" });

export const metadata: Metadata = {
  title: { default: "3310 Client", template: "%s · 3310 Client" },
  description: "3310 Client - a Hypixel SkyBlock mining client for Minecraft 26.2 (Fabric).",
  openGraph: { title: "3310 Client", description: "Hypixel SkyBlock mining client for Minecraft 26.2.", siteName: "3310.nz" },
};

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser().catch(() => null);
  const root = process.env.ROOT_DOMAIN ?? "3310.nz";
  return (
    <div className={`st ${sans.variable} ${pixel.variable}`}>
      <header className="st-head">
        <div className="st-wrap">
          <a href="/" className="st-logo">
            <b>3310</b> Client
          </a>
          <nav className="st-nav">
            <a href="/#features">Features</a>
            <a href="/purchase">Purchase</a>
            {u ? <a href="/dashboard">Dashboard</a> : <a href="/login">Log in</a>}
            {isAdmin(u) && <a href="/admin">Admin</a>}
          </nav>
        </div>
      </header>
      <main className="st-main">
        <div className="st-wrap">{children}</div>
      </main>
      <footer className="st-foot">
        <div className="st-wrap">
          <span>3310 Client · not affiliated with Mojang, Microsoft or Hypixel</span>
          <span>
            <a href={`https://archive.${root}`}>old 3310.nz</a> · <a href={`https://forum.${root}`}>forum</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
