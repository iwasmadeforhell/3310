"use client";
import { useState } from "react";
import type { Votes } from "@/lib/votes";

/** Like / dislike buttons. Visitors without an account get a prompt to make one. */
export default function Vote({ id, initial, loggedIn }: { id: string; initial: Votes; loggedIn: boolean }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);

  async function cast(vote: 1 | -1) {
    if (!loggedIn) return setAsk(true);
    if (busy) return;
    setBusy(true);
    const res = await fetch("/api/old/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, vote: v.mine === vote ? 0 : vote }), // pressing again takes the vote back
    }).catch(() => null);
    setBusy(false);
    if (res?.status === 401) return setAsk(true);
    if (res?.ok) setV(await res.json());
  }

  return (
    <span className="old-vote">
      <button type="button" className={v.mine === 1 ? "on up" : "up"} onClick={() => cast(1)} aria-pressed={v.mine === 1} aria-label="Like" title="like">
        ▲ {v.up}
      </button>
      <button type="button" className={v.mine === -1 ? "on down" : "down"} onClick={() => cast(-1)} aria-pressed={v.mine === -1} aria-label="Dislike" title="dislike">
        ▼ {v.down}
      </button>
      {ask && (
        <div className="old-modal" role="dialog" aria-modal="true" aria-label="Account needed" onClick={() => setAsk(false)}>
          <div className="win" onClick={(e) => e.stopPropagation()}>
            <div className="win-title">
              <span>✋ Members only</span>
              <button type="button" className="win-x" aria-label="Close" onClick={() => setAsk(false)}>
                ×
              </button>
            </div>
            <div className="win-body">
              <div className="win-row">
                <div className="win-icon" aria-hidden>
                  !
                </div>
                <p>
                  You need an account to like or dislike posts. It takes ten seconds: pick a name, a password and a name colour.
                </p>
              </div>
              <div className="win-actions">
                <a href="/register" className="win-btn">
                  Register
                </a>
                <a href="/login" className="win-btn">
                  Log in
                </a>
                <button type="button" className="win-btn" onClick={() => setAsk(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
