import { PRICE_CENTS, currentUser, isActive } from "@/lib/store";

const FEATURES: [string, string][] = [
  ["Commissions", "Claims, travels and completes Dwarven Mines commissions in a loop: mining, slayers, Glacite Walkers, goblins, Great Spook fears."],
  ["Powder grinding", "Tunnels hardstone through the Crystal Hollows, opens treasure chests and hops lobbies when an area is mined out."],
  ["Pathing & Etherwarp", "Plans routes over the whole Dwarven Mines, chaining Etherwarps and Instant Transmission like a player would."],
  ["Failsafes", "Watches for players coming close, teleports and staff-style chat, and reacts: hops lobbies or stops and moves naturally."],
  ["Discord alerts", "Get a DM when a macro gets stuck or stops, a status update every 5 to 15 minutes, and a clip of what happened."],
  ["Clip recorder", "Keeps the last 15 seconds to 5 minutes at 480p 60 fps and sends it to Discord whenever a failsafe triggers."],
];

export default async function Home() {
  const u = await currentUser().catch(() => null);
  const price = (PRICE_CENTS / 100).toFixed(2);
  return (
    <>
      <section className="st-hero">
        <div>
          <span className="st-pill beta">Minecraft 26.2 · Fabric</span>
          <h1 style={{ marginTop: 14 }}>
            Mining on Hypixel SkyBlock,
            <br />
            handled.
          </h1>
          <p className="lead">
            3310 Client runs your commissions and powder grinding, keeps an eye out while it does, and tells you on Discord when something
            needs you.
          </p>
          <div className="st-actions">
            {u && isActive(u) ? (
              <a className="st-btn primary" href="/dashboard">
                Download
              </a>
            ) : (
              <a className="st-btn primary" href="/purchase">
                Get it for €{price} / month
              </a>
            )}
            <a className="st-btn" href={u ? "/dashboard" : "/login"}>
              {u ? "Dashboard" : "Log in"}
            </a>
          </div>
        </div>
        <div className="st-screen" aria-hidden>
          <pre>{"> commissions  ON\n> mithril  4/350\n> failsafe armed\n> discord  linked\n\n  ■■■■■■■□□□"}</pre>
        </div>
      </section>

      <section id="features" className="st-section">
        <h2>What it does</h2>
        <div className="st-grid">
          {FEATURES.map(([t, d]) => (
            <div className="st-card" key={t}>
              <h3>{t}</h3>
              <p className="st-dim st-small" style={{ margin: 0 }}>
                {d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="st-section">
        <h2>How it works</h2>
        <div className="st-card">
          <ol className="st-steps">
            <li>
              <span>
                <a href="/purchase">Buy a month</a> (€{price}) and download the mod from your dashboard.
              </span>
            </li>
            <li>
              <span>Start Minecraft. On first launch the mod shows your hardware id and copies it to your clipboard.</span>
            </li>
            <li>
              <span>
                Paste it at <a href="/verify">3310.nz/verify</a>. That PC is now licensed, for up to 3 of your Minecraft accounts.
              </span>
            </li>
          </ol>
        </div>
      </section>
    </>
  );
}
