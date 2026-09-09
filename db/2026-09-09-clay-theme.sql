-- 2026-09-09 — Add "Clay" as a 7th dashboard theme.
--
-- Request: apply the warm, rounded "Claymorphism" look from the standalone
-- UI mockup project to the REAL production app, at the real URL, with all
-- real data/functionality intact — scoped down (via AskUserQuestion) to
-- "colors + a clay effect on the sidebar/nav" rather than a full rebuild
-- of every card on every page (that would touch 47+ files with hardcoded
-- rounded-corner/shadow classes, a much bigger and separate project).
--
-- Same mechanism as Navy/Gold, Day, Eye Comfort, Night, Ocean and Nova —
-- plugs into the EXISTING per-employee theme system
-- (db/2026-08-22-employee-theme-prefs.sql, src/lib/theme/themes.ts,
-- src/app/globals.css) as a new preset, so it's opt-in, reversible from
-- Settings -> Theme, and applies consistently everywhere the existing 6
-- already do, with no risk to the default look anyone else keeps using.
--
-- Clay is a warm cream canvas with a light warm-cream sidebar (not dark —
-- the mockup itself is light throughout) and a terracotta accent
-- (#d97a4a), matching the mockup's own palette. Its "signature effect"
-- (see globals.css's "Clay signature effect" section) is a soft embossed/
-- pressed-in shadow on the sidebar and the active nav tile, evoking the
-- mockup's neumorphic dual-shadow cards — scoped entirely to
-- `[data-theme="clay"]` so it never touches the other 6 themes.
--
-- This migration ONLY widens the existing CHECK constraint so 'clay' can
-- be saved to employees.theme_id — the actual token values live in
-- globals.css and the picker metadata in themes.ts (both app-code changes,
-- not DB). Idempotent (DROP + re-ADD) — safe to re-run.

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_theme_id_check;
ALTER TABLE employees
  ADD CONSTRAINT employees_theme_id_check
    CHECK (theme_id IS NULL OR theme_id IN ('navy-gold', 'day', 'eye-comfort', 'night', 'ocean', 'nova', 'clay'));

COMMIT;
