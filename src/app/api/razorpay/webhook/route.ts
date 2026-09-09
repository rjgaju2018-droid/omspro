import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyWebhookSignature, ACTIVATION_PLAN } from "@/lib/saas/payments";

// Razorpay webhook (2026-09-09) — the authoritative server-to-server path.
// The checkout route's "verify" step already activates on success; this
// webhook is the safety net that also works when the buyer closes the tab
// before the redirect completes (payment.captured still arrives here).
//
// Configure in the Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<production-domain>/api/razorpay/webhook
//   Secret: (same value as RAZORPAY_WEBHOOK_SECRET env var)
//   Events: payment.captured, payment.failed
//
// Signature-verified with HMAC-SHA256 over the RAW body — read the body as
// text FIRST (not request.json()) or verification always fails.

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) {
    // Subscriptions/other events we don't handle yet — acknowledge OK so
    // Razorpay doesn't retry a non-applicable event forever.
    return NextResponse.json({ received: true, ignored: event.event ?? "unknown" });
  }

  const service = createServiceRoleClient();
  const { data: row } = await service
    .from("payments")
    .select("id, company_id, status")
    .eq("razorpay_order_id", payment.order_id)
    .maybeSingle();

  if (!row) return NextResponse.json({ received: true, ignored: "unknown order" });

  if (event.event === "payment.captured" && payment.status === "captured") {
    if (row.status !== "paid") {
      await service
        .from("payments")
        .update({ status: "paid", razorpay_payment_id: payment.id ?? null, paid_at: new Date().toISOString() })
        .eq("id", row.id);
      await service
        .from("companies")
        .update({ plan: ACTIVATION_PLAN, trial_ends_at: null })
        .eq("id", row.company_id);
    }
  } else if (event.event === "payment.failed") {
    await service.from("payments").update({ status: "failed" }).eq("id", row.id);
  }

  return NextResponse.json({ received: true });
}
