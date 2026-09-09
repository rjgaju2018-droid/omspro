-- db/2026-09-09-omspro-saas-signup.sql
-- OMS Pro public SaaS launch (2026-09-09):
--   1. a per-company "Company Owner" role grant so every self-serve signup
--      gets a capability-complete admin role, created from the same global
--      roles/capabilities tables the existing 9 roles live in (the shared
--      "Admin"/"MD" rows keep their hand-tuned capability sets untouched)
--   2. per-company trial/plan columns for the 14-day free trial
--   3. a trial_status() helper the /dashboard/billing page banner reads
--
-- Idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING) per this repo's
-- migration convention. Run once in the Supabase SQL Editor, in date order
-- after every earlier db/*.sql file.

-- ---------------------------------------------------------------------------
-- 1. The "Company Owner" role + full-capability grant (data, not code —
--    granting a role a new capability later is just a row here, per
--    require-capability.ts's design).
-- ---------------------------------------------------------------------------
INSERT INTO roles (name) VALUES ('Company Owner')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, c.code
FROM roles r
CROSS JOIN capabilities c
WHERE r.name = 'Company Owner'
ON CONFLICT (role_id, capability_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Trial / plan columns on companies. Defaults keep every pre-existing
--    company fully active — the legacy Nyko Mart / Rugara / CASA ARRA rows
--    were created before SaaS signup existed and must never hit a wall.
-- ---------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Companies created before this migration get no trial end date (NULL =
-- "no trial tracking", billing page shows "Founding account — no expiry").
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS created_by_signup boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. trial_status(p_company_id) — one lookup the billing banner and the
--    landing-time dashboard checks use. Returns 'no_expiry' for legacy
--    rows, 'active'/'expiring'/'expired'/'trial' otherwise.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trial_status(p_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN c.plan <> 'trial' THEN 'paid'
    WHEN c.trial_ends_at IS NULL THEN 'no_expiry'
    WHEN c.trial_ends_at < now() THEN 'expired'
    WHEN c.trial_ends_at < now() + interval '3 days' THEN 'expiring'
    ELSE 'trial'
  END
  FROM companies c
  WHERE c.id = p_company_id;
$$;

COMMENT ON FUNCTION trial_status(p_company_id uuid) IS
  'OMS Pro SaaS: ''paid'' | ''no_expiry'' (pre-SaaS legacy rows) | ''expiring'' (<3 days left) | ''expired'' | ''trial''.';
