-- db/2026-09-12-virtual-assistant.sql
-- OMS Pro Virtual Assistant upgrade (2026-09-12) — replaces the old
-- Automation Rules entry with the always-on Virtual Assistant:
--   1. companion_enabled flips to DEFAULT true and every EXISTING employee
--      row is switched on (the assistant now greets/celebrates for everyone;
--      Admin can still turn her off per employee via /dashboard/admin/
--      companion-access)
--   2. new companion_events.event_type values the live widget now
--      understands: birthday / work_anniversary / new_employee /
--      data_saved / error (existing rows keep their old values — the
--      column is plain text, so nothing to migrate there)
--   3. DB trigger: every INSERT into employees fires a new_employee
--      companion event for that employee ("naya employee ki id generate
--      hogi ... ab to party to banti hai")
--   4. today's birthday + work-anniversary people get their dance event
--      written on demand by the app (see src/lib/companion/celebrate.ts) —
--      no cron needed, computed fresh on each dashboard load
--
-- Idempotent (IF NOT EXISTS / DO NOTHING) per this repo's migration
-- convention. Run once in the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 0. Base pieces the fresh 2026-09-09 projects never got (this file is the
--    ONLY companion migration those projects need — the older
--    2026-09-05-ai-companion-live.sql / -refinements.sql were written for
--    the legacy database). Idempotent: safe if those already ran.
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS companion_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS companion_name text;

-- companion_character_image (the optional Admin-generated photo) + its
-- "who may manage the assistant" capability — from
-- db/2026-09-05-ai-companion-refinements.sql / -live.sql. The layout
-- queries the table unconditionally, so it must exist even in a fresh
-- project where the 2026-09-05 files never ran.
CREATE TABLE IF NOT EXISTS companion_character_image (
  id           text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  image_url    text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO capabilities (code, description)
VALUES ('companion_admin', 'Manage AI Companion access (per-employee on/off)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, 'companion_admin'
FROM roles r
WHERE r.name IN ('Admin', 'MD', 'Company Owner')
ON CONFLICT (role_id, capability_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS companion_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type    text NOT NULL,
  message       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companion_events_employee_created ON companion_events(employee_id, created_at);

ALTER TABLE companion_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companion_events_select_own ON companion_events;
CREATE POLICY companion_events_select_own ON companion_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e WHERE e.id = companion_events.employee_id AND e.auth_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 1. Companion on for everyone (default + one-time backfill)
-- ---------------------------------------------------------------------------
ALTER TABLE employees
  ALTER COLUMN companion_enabled SET DEFAULT true;

UPDATE employees SET companion_enabled = true WHERE companion_enabled = false;

-- ---------------------------------------------------------------------------
-- 2. Fire a new_employee celebration whenever a new employee row appears.
--    AFTER INSERT trigger — the notifyCompanion() app-level path covers
--    actions that already ran through the app; this trigger catches every
--    writer (SQL Editor inserts, seeds, imports) so the "ab to party to
--    banti hai" dance never gets skipped.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_companion_new_employee() RETURNS trigger AS $$
BEGIN
  INSERT INTO companion_events (employee_id, event_type, message)
  VALUES (
    NEW.id,
    'new_employee',
    'Welcome to the team, ' || NEW.name || '! Your ID is ready — ab to party to banti hai! 🎉'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_employees_companion_new_employee ON employees;
CREATE TRIGGER trg_employees_companion_new_employee
  AFTER INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION trg_companion_new_employee();

-- ---------------------------------------------------------------------------
-- 3. One celebration per (employee, type, day): the app re-queues today's
--    birthday/anniversary dances on every dashboard load (see
--    src/lib/companion/celebrate.ts) — this expression index makes the
--    repeat inserts no-op instead of stacking duplicate dances. Pre-clean
--    any same-day duplicates first (possible on a legacy DB) so the unique
--    index can't fail to build; newest row of each group wins.
-- ---------------------------------------------------------------------------
DELETE FROM companion_events a
USING companion_events b
WHERE a.employee_id = b.employee_id
  AND a.event_type = b.event_type
  AND (a.created_at AT TIME ZONE 'utc')::date = (b.created_at AT TIME ZONE 'utc')::date
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id::text > b.id::text));

CREATE UNIQUE INDEX IF NOT EXISTS uq_companion_events_once_per_day
  ON companion_events (employee_id, event_type, ((created_at AT TIME ZONE 'utc')::date));

-- ---------------------------------------------------------------------------
-- 4. queue_companion_celebrations(p_events jsonb) — one round-trip fan-out
--    the dashboard layout calls with today's celebrations. Each celebration
--    is delivered to EVERY active colleague of the star's company (everyone
--    sees the assistant dance for the birthday person), and ON CONFLICT DO
--    NOTHING against the once-per-day index above means reloading the
--    dashboard never stacks duplicate dances. SECURITY DEFINER + revoked
--    from anon/public: only the app's service-role client and logged-in
--    sessions can call it, and it needs to write rows for people other
--    than the caller (RLS would otherwise block the fan-out).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION queue_companion_celebrations(p_events jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO companion_events (employee_id, event_type, message)
  SELECT m.id,
         ev ->> 'event_type',
         ev ->> 'message'
  FROM jsonb_array_elements(p_events) ev
  JOIN employees star ON star.id = (ev ->> 'employee_id')::uuid
  JOIN employees m    ON m.company_id = star.company_id AND m.active
  ON CONFLICT DO NOTHING;
$$;

REVOKE ALL ON FUNCTION queue_companion_celebrations(jsonb) FROM anon, public;

-- ---------------------------------------------------------------------------
-- Sanity checks (run by hand, informational only):
--   select count(*) from employees where companion_enabled;      -- all rows
--   select event_type, count(*) from companion_events group by 1; -- new types appear over time
-- ---------------------------------------------------------------------------
