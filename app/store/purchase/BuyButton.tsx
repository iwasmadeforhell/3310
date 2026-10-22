"use client";

import { useState } from "react";
import { post } from "../client";

export default function BuyButton({ label, endpoint = "/api/store/checkout", primary = true }: { label: string; endpoint?: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button
        className={`st-btn ${primary ? "primary " : ""}wide`}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            const { url } = await post<{ url: string }>(endpoint);
            window.location.href = url;
          } catch (x) {
            setErr((x as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Opening checkout..." : label}
      </button>
      {err && <div className="st-msg err">{err}</div>}
    </>
  );
}
