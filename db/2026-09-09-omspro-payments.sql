-- db/2026-09-09-omspro-payments.sql — OMS Pro payment/subscription support.
-- Run once in the Supabase SQL Editor AFTER
-- db/2026-09-09-omspro-saas-signup.sql (which adds companies.plan etc.).
--
-- What the payment flow (src/app/api/razorpay/**) writes:
--   1. companies.plan            ← 'starter' | 'growth' | 'enterprise'
--   2. companies.trial_ends_at   ← NULL once paid (no trial clock anymore)
--   3. One row per payment event in payments (full audit trail, including
--      failures — never delete, this is the billing history shown nowhere
--      else yet but kept for disputes/refunds).
--
-- Plan upgrade rule (product owner's spec, 2026-09-09): paying moves a
-- trial company DIRECTLY to Enterprise — no intermediate plan stops. The
-- starter/growth rows stay in the UI as price anchors.
--
-- Idempotent — safe to run again.

-- ---------------------------------------------------------------------------
-- 1. payments table — one row per Razorpay event we accepted
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- razorpay ids (text, not uuid — provider-owned formats)
  razorpay_order_id       text,
  razorpay_payment_id     text,
  razorpay_subscription_id text,
  amount          integer NOT NULL,              -- paise (INR * 100)
  currency        text NOT NULL DEFAULT 'INR',
  plan_id         text NOT NULL,                 -- 'starter' | 'growth' | 'enterprise'
  status          text NOT NULL,                 -- 'created' | 'paid' | 'failed'
  notes           jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  paid_at         timestamptz
);

-- Only one live order per company at a time keeps the UI simple: the
-- "Pay & upgrade" button always creates a fresh order anyway.
CREATE INDEX IF NOT EXISTS payments_company_idx ON public.payments (company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. RLS — payments are read by the company's own employees only; all
--    writes happen through the service-role webhook/action (no client
--    write path exists, so a permissive INSERT/UPDATE policy is
--    deliberately absent).
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members read own payments" ON public.payments;
CREATE POLICY "company members read own payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.company_id = payments.company_id
        AND e.auth_user_id = auth.uid()
        AND e.active = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Marketing-only price anchors: trial users see starter/growth as
--    "upgrade paths", but per the owner's rule ANY successful payment
--    lands the company on Enterprise directly.
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.companies.plan IS
  'trial | starter | growth | enterprise. Payment (2026-09-09) always lands on enterprise regardless of which button was clicked — starter/growth are price anchors only.';
