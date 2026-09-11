-- OMS Pro platform owner controls.
-- Run after the SaaS signup/payment migrations.
--
-- One-time bootstrap for the platform owner's existing Supabase login.
-- Do not put a password in this file.

-- PREREQUISITE: run db/schema.sql first, then the dated migrations through
-- db/2026-09-09-omspro-payments.sql. This migration cannot create the
-- core employees/companies tables because those are part of the base schema.
DO $$
BEGIN
  IF to_regclass('public.employees') IS NULL OR to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'OMS Pro base schema is missing. Run db/schema.sql first, then dated migrations in order.';
  END IF;
END
$$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_platform_owner boolean NOT NULL DEFAULT false;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS access_mode text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS monthly_price_inr integer,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_access_mode_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_access_mode_check
  CHECK (access_mode IN ('paid', 'free', 'suspended'));

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_discount_percent_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_discount_percent_check
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

UPDATE public.employees
SET is_platform_owner = true
WHERE lower(email) = lower('bhankariwal@gmail.com');

COMMENT ON COLUMN public.employees.is_platform_owner IS
  'Full OMS Pro platform-owner access. Set only for the trusted product owner.';
COMMENT ON COLUMN public.companies.access_mode IS
  'Platform owner override: paid, free, or suspended.';
COMMENT ON COLUMN public.companies.monthly_price_inr IS
  'Optional platform-owner negotiated monthly price in INR; NULL uses the selected plan price.';
COMMENT ON COLUMN public.companies.discount_percent IS
  'Optional platform-owner discount from the effective monthly price, 0 to 100.';