import { NextResponse } from "next/server";
import { getAuthedEmployee } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  razorpayClient,
  razorpayConfigured,
  PLAN_AMOUNT_PAISE,
  ACTIVATION_PLAN,
  verifyCheckoutSignature,
  type PayablePlanId,
} from "@/lib/saas/payments";

// OMS Pro checkout (2026-09-09) — POST with a plan id:
//   { action: "create", plan: "growth" }  → creates a Razorpay order +
//     a `payments` row (status 'created'); returns order id + public key
//     for the Razorpay Checkout JS.
//   { action: "verify", razorpay_order_id, razorpay_payment_id,
//     razorpay_signature } → signature-verified activation: company goes
//     straight to ACTIVATION_PLAN (enterprise), trial clock cleared,
//     payments row marked 'paid'.
//
// Any signed-in employee may START an upgrade for their own company — the
// actual plan change happens only here, server-side, after Razorpay's
// signature check (and separately via the webhook route for
// payment.captured events, whichever arrives first).

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const employee = await getAuthedEmployee().catch(() => null);
  if (!employee) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured yet — contact support (bhankariwal@gmail.com)." },
      { status: 503 }
    );
  }

  const action = String(body.action ?? "");

  if (action === "create") {
    const plan = String(body.plan ?? "") as PayablePlanId;
    if (!(plan in PLAN_AMOUNT_PAISE)) {
      return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const { data: company } = await createServiceRoleClient()
      .from("companies")
      .select("access_mode, monthly_price_inr, discount_percent")
      .eq("id", employee.currentCompanyId)
      .single();
    if (company?.access_mode === "suspended") {
      return NextResponse.json({ error: "This workspace is suspended. Contact support." }, { status: 403 });
    }
    const baseAmount = company?.monthly_price_inr != null ? company.monthly_price_inr * 100 : PLAN_AMOUNT_PAISE[plan];
    const amount = Math.max(100, Math.round(baseAmount * (1 - Number(company?.discount_percent ?? 0) / 100)));

    const rzp = razorpayClient();
    const order = await rzp.orders.create({
      amount,
      currency: "INR",
      receipt: `omspro-${employee.currentCompanyId.slice(0, 8)}-${Date.now()}`,
      notes: { company_id: employee.currentCompanyId, plan_id: plan },
    });

    const service = createServiceRoleClient();
    await service.from("payments").insert({
      company_id: employee.currentCompanyId,
      razorpay_order_id: order.id,
      amount,
      plan_id: plan,
      status: "created",
    });

    return NextResponse.json({
      orderId: order.id,
      amount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      plan,
    });
  }

  if (action === "verify") {
    const orderId = String(body.razorpay_order_id ?? "");
    const paymentId = String(body.razorpay_payment_id ?? "");
    const signature = String(body.razorpay_signature ?? "");
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json({ error: "Missing payment confirmation fields." }, { status: 400 });
    }

    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const service = createServiceRoleClient();

    // Find the payments row for this order — it also pins which company
    // gets upgraded (never trust a company_id from the client).
    const { data: payment } = await service
      .from("payments")
      .select("id, company_id, plan_id, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();
    if (!payment) {
      return NextResponse.json({ error: "Unknown order." }, { status: 404 });
    }

    if (payment.status !== "paid") {
      await service.from("payments").update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() }).eq("id", payment.id);
      // THE ACTIVATION: trial → enterprise, trial clock cleared.
      await service
        .from("companies")
        .update({ plan: ACTIVATION_PLAN, trial_ends_at: null })
        .eq("id", payment.company_id);
    }

    return NextResponse.json({ ok: true, plan: ACTIVATION_PLAN });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
