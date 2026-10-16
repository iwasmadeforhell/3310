import { HWID_RE, currentUser, isActive, normHwid } from "@/lib/store";
import HwidForm from "./HwidForm";

export const metadata = { title: "Verify your PC" };

export default async function Verify({ searchParams }: { searchParams: Promise<{ hwid?: string }> }) {
  const sp = await searchParams;
  const hwid = sp.hwid && HWID_RE.test(normHwid(sp.hwid)) ? normHwid(sp.hwid) : "";
  const u = await currentUser().catch(() => null);
  const back = `/verify${hwid ? `?hwid=${hwid}` : ""}`;
  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 36 }}>Verify your PC</h1>
      <p className="st-dim">
        When 3310 Client starts for the first time it shows your hardware id and copies it to the clipboard. Paste it here to lock your licence to
        this PC. You can move it to another PC once every 24 hours.
      </p>
      <div className="st-card raised">
        {!u ? (
          <>
            <p>Log in first, then you'll come straight back here.</p>
            <a className="st-btn primary" href={`/login?next=${encodeURIComponent(back)}`}>
              Log in
            </a>
          </>
        ) : (
          <>
            {!isActive(u) && (
              <div className="st-msg">
                You can verify now, but the mod only runs once your licence is active. <a href="/purchase">Buy a month</a>.
              </div>
            )}
            {u.hwid && (
              <p className="st-dim st-small">
                Currently verified: <span className="st-mono">{u.hwid}</span>
              </p>
            )}
            <HwidForm initial={hwid} label={u.hwid ? "Move licence to this PC" : "Verify PC"} />
          </>
        )}
      </div>
    </div>
  );
}
