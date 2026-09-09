-- 2026-09-08 — Error Tab: a lightweight, unified log of "wrong entries" —
-- form validation failures, failed courier/API bookings, and manual flags
-- raised by staff — surfaced on a new /dashboard/error-log tab. User's own
-- ask (Hinglish): "agar koi galt entry karega to vo aajayegi or uska naam
-- vagera time jo bhi hona chahiye best vo aajayega" (if someone makes a
-- wrong entry it should show up here, with who/when).
--
-- Scoped via AskUserQuestion before building: which system (production OMS,
-- not the separate Claymorphism mockup), which error types (form validation
-- failures + manual staff flags + failed courier/API bookings), and which
-- fields (name+timestamp, order/reference no., reason, resolved/pending
-- status) — all confirmed by the user.
--
-- Deliberately its own new table, not folded into audit_log
-- (db/2026-08-24-audit-log.sql) — audit_log is an admin-mutation trail
-- ("who changed/deleted what"), this is a review queue for entries that
-- went WRONG (validation failures, failed bookings, staff-flagged
-- mistakes), with its own resolved/pending lifecycle audit_log doesn't
-- have. Mirrors audit_log's own shape closely where the concepts overlap
-- (employee_id + a denormalized name snapshot, company_id, created_at) —
-- see capability-info.ts and src/lib/error-log/log-entry-error.ts for the
-- write side, src/app/dashboard/error-log/ for the read/resolve side.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS entry_errors (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid REFERENCES companies(id),
  -- 'validation'  = a form submission was rejected before it could save
  --                 (e.g. an invalid recipient country code, a missing
  --                 required order field).
  -- 'courier_api'  = a real courier booking API call failed after the form
  --                 itself validated fine (FedEx/UPS/Aramex/Delhivery/
  --                 Shiprocket/DHL) — a sibling to courier_shipments' own
  --                 attempt log (status='failed'), kept here too so it
  --                 shows up in ONE place alongside the other 2 sources
  --                 instead of a separate screen.
  -- 'manual'       = an employee explicitly flagged something as wrong
  --                 from the app itself (e.g. the "🚩 Flag as Error"
  --                 button on an order's detail page).
  source                  text NOT NULL CHECK (source IN ('validation', 'courier_api', 'manual')),
  status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  reason                  text NOT NULL,
  -- Free-text pointer back to whatever this error is about — not a real FK
  -- since the target table varies (orders today, possibly others later)
  -- and the row this points to may not even exist yet (a validation
  -- failure can happen before anything was ever saved).
  reference_type          text,
  reference_id            text,
  reference_label         text,
  raised_by_employee_id   uuid REFERENCES employees(id),
  raised_by_name          text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz,
  resolved_by_employee_id uuid REFERENCES employees(id),
  resolved_by_name        text,
  resolution_notes        text
);
CREATE INDEX IF NOT EXISTS idx_entry_errors_company_created ON entry_errors(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_errors_status           ON entry_errors(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entry_errors_reference         ON entry_errors(reference_type, reference_id);

ALTER TABLE entry_errors ENABLE ROW LEVEL SECURITY;

-- Standard shape for a new table in this codebase (see BRAIN.md §4): real
-- authorization happens at the app layer (requireCapability()/
-- getAuthedEmployee() below), RLS here is just the usual blanket allow for
-- the authenticated role.
DROP POLICY IF EXISTS allow_authenticated_all ON entry_errors;
CREATE POLICY allow_authenticated_all ON entry_errors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- View + resolve the Error Tab — MD/Admin only (same 2 roles as
-- audit_log_view, same reasoning: a review/oversight screen, not something
-- every employee needs). Raising a flag (source='manual') does NOT require
-- this capability — any signed-in employee can flag an entry they notice
-- is wrong; see flagEntryError() in src/app/dashboard/error-log/actions.ts,
-- gated on getAuthedEmployee() only, same permissive model the order
-- detail page itself already uses.
INSERT INTO capabilities (code, description) VALUES
  ('error_log_view', 'View and resolve the Error Tab — validation failures, failed courier bookings, and staff-flagged wrong entries — Admin/MD only')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, 'error_log_view' FROM roles r WHERE r.name IN ('Admin', 'MD')
ON CONFLICT (role_id, capability_code) DO NOTHING;
