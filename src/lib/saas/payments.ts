// OMS Pro payment integration (2026-09-09) — Razorpay.
//
// Product rule from the owner: a company on trial that PAYS goes straight
// to **enterprise** — starter/growth are displayed as price anchors on the
// pricing/billing UI, but every successful payment activates Enterprise.
// (If per-plan stops are wanted later, this file's ACTIVATION_PLAN is the
// single switch.)
//
// Keys come from env (never client-side):
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET
// When keys are absent (dev sandbox / before signup), createOrder() returns
// a structured "not_configured" result and the UI falls back to the
// contact-email flow it already had — nothing breaks.
import Razorpay from "razorpay";
import crypto from "node:crypto";

export type PayablePlanId = "starter" | "growth" | "enterprise";

/** What a successful payment actually activates. */
export const ACTIVATION_PLAN: PayablePlanId = "enterprise";

export const PLAN_AMOUNT_PAISE: Record<PayablePlanId, number> = {
  starter: 99900, // ₹999
  growth: 249900, // ₹2,499
  // Enterprise "price" charged through the self-serve button — the plan's
  // UI shows "Custom", but a subscriber clicking Pay still gets a working
  // checkout at this default; the owner can raise it in Razorpay later.
  enterprise: 499900, // ₹4,999
};

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

let client: Razorpay | null = null;
export function razorpayClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return client;
}

/** Verify the webhook signature Razorpay signs with RAZORPAY_WEBHOOK_SECRET. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Verify the checkout-handoff signature (payment_id|order_id with key secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
