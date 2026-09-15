-- =============================================================================
-- 2026-09-15 — Company module selection ("refurnish" round)
--
-- Part of the onboarding wizard: when a company signs up it now chooses
-- WHICH parts of OMS Pro it actually runs (HR, Salary, Inventory, Courier
-- Booking, Reports, ...). The dashboard then shows only those modules —
-- "after that show according to user company environment".
--
-- DESIGN: one row per company. enabled_modules text[] holds capability-code
-- GROUPS (see src/lib/company-modules.ts for the group->capability map —
-- the DB stores groups, the app expands them, so adding a new page to a
-- group never needs a migration). NULL/missing row = all modules (the
-- pre-onboarding default; existing companies keep everything).
--
-- onboarding_completed_at doubles as the wizard's "done" flag — the login
-- flow sends companies without it to /dashboard/onboarding.
--
-- Idempotent: safe to re-run. Additive only — no existing column changes.
-- =============================================================================

-- 1) Enabled-module groups per company (NULL row = everything on).
create table if not exists company_modules (
  company_id      uuid PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  -- Group ids from src/lib/company-modules.ts (orders, dispatch, documents,
  -- finance, inventory, hr, salary, reports, crm, courier, marketing,
  -- admin...). Stored as groups, expanded to capability codes in the app.
  enabled_groups  text[] NOT NULL DEFAULT '{orders,dispatch,documents,finance,inventory,hr,salary,reports,courier,admin}',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES employees(id)
);

-- 2) Wizard completion stamp + chosen display name/short-code snapshot
--    (the wizard lets the owner tweak these before first entry).
alter table companies add column if not exists onboarding_completed_at timestamptz;
alter table companies add column if not exists onboarding_step int not null default 0;

-- 3) Default row for every company that already exists (and any created by
--    the current signup action before this migration runs): full module
--    set, onboarding marked complete — nobody's dashboard changes until
--    they go through the new wizard themselves.
insert into company_modules (company_id, enabled_groups)
select c.id, '{orders,dispatch,documents,finance,inventory,hr,salary,reports,courier,marketing,admin}'
from companies c
on conflict (company_id) do nothing;

update companies c
set onboarding_completed_at = coalesce(c.onboarding_completed_at, c.created_at)
where c.onboarding_completed_at is null;

-- 4) RLS — same posture as the rest of the SaaS tables: signed-in employees
--    full access (app code scopes reads to the caller's company), anon
--    nothing.
alter table company_modules enable row level security;

drop policy if exists "company_modules_all_authenticated" on company_modules;
create policy "company_modules_all_authenticated"
  on company_modules
  for all
  to authenticated
  using (true)
  with check (true);
