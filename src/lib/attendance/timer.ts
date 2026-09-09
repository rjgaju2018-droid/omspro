// 2026-08-11 (round 2): shared Start/Pause watch helpers — used by both the
// Daily Work Report's "Submit Report" timer (replacing the old free-text
// Estimated Time field) and the new Task Assignment per-task timer. Both
// tables share the exact same 4-column shape: timer_started_at (non-null =
// currently running), time_spent_seconds (accumulated total), and
// first_started_at/last_paused_at (the "kitne baje start kiya / kitne baje
// khatm kiya" display fields).

/** live elapsed seconds right now, including any currently-running interval */
export function liveElapsedSeconds(row: { timeSpentSeconds: number; timerStartedAt: string | null }, nowMs: number): number {
  const running = row.timerStartedAt ? Math.max(0, Math.floor((nowMs - new Date(row.timerStartedAt).getTime()) / 1000)) : 0;
  return row.timeSpentSeconds + running;
}

/** "1h 24m" / "24m 05s" / "0m 12s" — compact, matches the legacy tool's elapsed-time display */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function formatISTTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

/**
 * 2026-09-09 — live "today so far" seconds for a task's timer, combining
 * (a) whatever's already committed into task_daily_time_log for today (via
 * add_task_daily_time, written on every Pause/Done) with (b) any
 * currently-running portion that falls on today's IST date — mirrors
 * liveElapsedSeconds() above but scoped to one IST calendar day instead of
 * the task's whole lifetime, so "today" correctly resets to 0 right after
 * IST midnight even while nothing has been paused yet today. If the timer
 * has been running continuously since before today's midnight, only the
 * post-midnight portion counts (matches splitIntervalByISTDay's own
 * day-boundary logic — see ist-date.ts).
 */
export function liveElapsedSecondsForToday(
  row: { timerStartedAt: string | null },
  committedTodaySeconds: number,
  nowMs: number
): number {
  if (!row.timerStartedAt) return committedTodaySeconds;
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const nowShiftedDate = new Date(nowMs + IST_OFFSET_MS);
  const todayMidnightShifted = Date.UTC(nowShiftedDate.getUTCFullYear(), nowShiftedDate.getUTCMonth(), nowShiftedDate.getUTCDate(), 0, 0, 0, 0);
  const todayMidnightReal = todayMidnightShifted - IST_OFFSET_MS;
  const timerStartReal = new Date(row.timerStartedAt).getTime();
  const runningSinceToday = Math.max(timerStartReal, todayMidnightReal);
  const liveTodaySeconds = Math.max(0, Math.floor((nowMs - runningSinceToday) / 1000));
  return committedTodaySeconds + liveTodaySeconds;
}
