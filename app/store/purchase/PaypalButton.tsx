"use client";

import { useState } from "react";
import { post } from "../client";

export default function PaypalButton({ price }: { price: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [order, setOrder] = useState<{ code: string; url: string } | null>(null);
  if (order) {
    return (
      <div className="st-msg">
        <p>
          Send <b>€{price}</b> on PayPal and put this code in the note:
        </p>
        <p className="st-mono" style={{ fontSize: 22, margin: "8px 0" }}>
          {order.code}
        </p>
        <a className="st-btn primary wide" href={order.url} target="_blank" rel="noreferrer">
          Open PayPal
        </a>
        <p className="st-dim st-small" style={{ marginTop: 8 }}>
          Your month is added by hand once the payment is checked, usually within a few hours. Without the code we can't match the payment to your account.
        </p>
      </div>
    );
  }
  return (
    <>
      <button
        className="st-btn wide"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            setOrder(await post<{ code: string; url: string }>("/api/store/paypal/checkout"));
          } catch (x) {
            setErr((x as Error).message);
          }
          setBusy(false);
        }}
      >
        {busy ? "Getting your code..." : `Pay with PayPal (€${price})`}
      </button>
      {err && <div className="st-msg err">{err}</div>}
    </>
  );
}
