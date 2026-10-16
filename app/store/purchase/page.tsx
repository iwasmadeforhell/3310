import { MC_SLOTS, PRICE_CENTS, currentUser, isActive, isStaffTier } from "@/lib/store";
import BuyButton from "./BuyButton";

export const metadata = { title: "Purchase" };

export default async function Purchase({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const sp = await searchParams;
  const u = await currentUser().catch(() => null);
  const price = (PRICE_CENTS / 100).toFixed(2);
  const running = u && isActive(u) && u.expiresAt !== null && !isStaffTier(u.tier);
  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <h1 style={{ fontSize: 36, textAlign: "center" }}>Get 3310 Client</h1>
      {sp.cancelled && <div className="st-msg">Checkout cancelled. Nothing was charged.</div>}
      <div className="st-card raised">
        <div className="st-price">
          €{price} <small>/ month</small>
        </div>
        <p className="st-dim st-small">One payment = 30 days. Nothing renews automatically; buy another month whenever you want to keep going.</p>
        <ul className="st-list">
          <li>Every macro and feature in the client</li>
          <li>One PC (hardware id), changeable once every 24 hours</li>
          <li>Up to {MC_SLOTS} Minecraft accounts</li>
          <li>Discord alerts, status updates and failsafe clips</li>
          <li>Updates while your month runs</li>
        </ul>
        {u ? (
          <BuyButton label={running ? `Add another month (€${price})` : `Buy one month (€${price})`} />
        ) : (
          <a className="st-btn primary wide" href="/login?next=/purchase">
            Log in to buy
          </a>
        )}
        {running && u?.expiresAt && (
          <p className="st-dim st-small" style={{ marginTop: 12 }}>
            Your month runs until {new Date(u.expiresAt).toUTCString().slice(0, 16)}. A new month is added on top.
          </p>
        )}
      </div>
      <p className="st-dim st-small" style={{ marginTop: 16, textAlign: "center" }}>
        Payments are handled by Stripe. 3310 Client is a third-party mod; using macros may break the rules of the server you play on.
      </p>
    </div>
  );
}
