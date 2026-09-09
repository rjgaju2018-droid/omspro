"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Client half of the Razorpay upgrade flow (2026-09-09). Loads Razorpay's
// checkout JS on demand, creates the order via our API route, opens the
// Checkout popup, then hands the returned signature back to the same route
// for server-side verification + Enterprise activation. Falls back to the
// mailto contact flow when payments aren't configured (no keys yet) or the
// popup can't open (script blocked).
type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PlanUpgradeButtons({ razorpayReady }: { razorpayReady: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function startCheckout(planId: "growth" | "enterprise") {
    setMessage(null);
    setPending(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        setMessage("Payment popup could not load — please use the contact email below.");
        return;
      }

      const createRes = await fetch("/api/razorpay/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", plan: planId }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        setMessage(createData.error ?? "Could not start the payment.");
        return;
      }

      const rzp = new window.Razorpay({
        key: createData.keyId,
        amount: createData.amount,
        currency: createData.currency,
        name: "OMS Pro",
        description: "Enterprise plan — OMS Pro subscription",
        order_id: createData.orderId,
        theme: { color: "#f59e0b" },
        handler: async (response) => {
          const verifyRes = await fetch("/api/razorpay/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify", ...response }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            setMessage("Payment successful — your company is now on Enterprise! 🎉");
            router.refresh();
          } else {
            setMessage(verifyData.error ?? "Payment verification failed — contact support.");
          }
        },
        modal: {
          ondismiss: () => setMessage("Payment cancelled — no charge was made."),
        },
      });
      rzp.open();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startCheckout("enterprise")}
          className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Opening checkout…" : "Pay & upgrade to Enterprise"}
        </button>
        <a
          href="mailto:bhankariwal@gmail.com?subject=OMS%20Pro%20upgrade"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-amber-500 hover:text-amber-700"
        >
          Contact Sales
        </a>
      </div>
      {!razorpayReady && (
        <p className="mt-2 text-xs text-slate-500">
          Online checkout activates once payment keys are configured — meanwhile use &quot;Contact Sales&quot;.
        </p>
      )}
      {message && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p>}
    </div>
  );
}
