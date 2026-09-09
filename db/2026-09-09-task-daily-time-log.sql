-- 2026-09-09 — Per-day time breakdown for Task Assignment's live Start/Pause
-- timer.
--
-- Context: "tasks" already has a correct live timer (timer_started_at /
-- time_spent_seconds / first_started_at / last_paused_at) — pausing already
-- commits elapsed time into time_spent_seconds immediately, it does NOT wait
-- for the task to be marked Done. That part was already right.
--
-- What was missing: time_spent_seconds is a single LIFETIME total on the
-- task row. A task that spans multiple days (started Monday, still not Done
-- Wednesday) has no way to show "how much did I do on Monday vs today" —
-- the owner's own spec: "Monday: 2h15m ... Tuesday: 0h00m -> starts counting
-- again ... Total time spent: 2h15m + Tuesday's time". Scoped via
-- AskUserQuestion: the task itself is NOT frozen/recreated day to day (it
-- already persists correctly, unlike daily_work_logs' one-row-per-day
-- design) — only a per-day breakdown + an automatic midnight reset of
-- "today's" counter is needed, no explicit "Carry On" click.
--
-- This table is purely an additive breakdown of the SAME time already being
-- tracked in tasks.time_spent_seconds — it is never the source of truth for
-- the lifetime total (that stays tasks.time_spent_seconds, unchanged), only
-- for "how was that lifetime total distributed across days". Every write
-- here happens in the exact same request that already updates
-- tasks.time_spent_seconds (pauseTaskTimer / markTaskDone), split across
-- IST calendar-day boundaries via splitIntervalByISTDay() so a session that
-- runs past midnight IST correctly credits each day its own share.

BEGIN;

CREATE TABLE IF NOT EXISTS task_daily_time_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  log_date       date NOT NULL,
  seconds_spent  int  NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, log_date)
);
CREATE INDEX IF NOT EXISTS idx_task_daily_time_log_task ON task_daily_time_log(task_id, log_date);

ALTER TABLE task_daily_time_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_authenticated_all ON task_daily_time_log;
CREATE POLICY allow_authenticated_all ON task_daily_time_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Atomic add-or-create — called once per IST-day segment of a stopped timer
-- interval. SQL (not PL/pgSQL) function, same shape as this codebase's other
-- single-statement RPC helpers (e.g. get_unread_group_message_count).
CREATE OR REPLACE FUNCTION add_task_daily_time(p_task_id uuid, p_log_date date, p_seconds int)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO task_daily_time_log (task_id, log_date, seconds_spent, updated_at)
  VALUES (p_task_id, p_log_date, GREATEST(p_seconds, 0), now())
  ON CONFLICT (task_id, log_date)
  DO UPDATE SET
    seconds_spent = task_daily_time_log.seconds_spent + GREATEST(p_seconds, 0),
    updated_at = now();
$$;

COMMENT ON TABLE task_daily_time_log IS
  '2026-09-09: additive per-IST-day breakdown of tasks.time_spent_seconds — never the source of truth for the lifetime total, only for how it is distributed across days. See tasks.time_spent_seconds for the real running total.';
COMMENT ON FUNCTION add_task_daily_time IS
  '2026-09-09: atomic upsert-add for one IST-day segment of a stopped task timer interval — called from pauseTaskTimer/markTaskDone in src/app/dashboard/tasks/actions.ts.';

COMMIT;
