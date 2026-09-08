-- 2026-09-08 — Add "Nova" as a 6th dashboard theme.
--
-- Request: "chose desgine and use our system and redesgine UI with specil
-- colour effect" — pick a design language from a supplied 74-brand design-
-- token reference collection and apply it to this app's UI with a
-- distinctive color treatment. Rather than hand-rewriting pages (this app
-- has 90+ routes), this plugs into the EXISTING per-employee theme system
-- (db/2026-08-22-employee-theme-prefs.sql, src/lib/theme/themes.ts,
-- src/app/globals.css) as a new preset — same mechanism as Navy/Gold, Day,
-- Eye Comfort, Night and Ocean, so it's opt-in, reversible from Settings ->
-- Theme, and applies consistently everywhere the existing 5 already do,
-- with no risk to the default look anyone else keeps using.
--
-- Nova is a deep near-black canvas with an electric violet accent
-- (#5e6ad2), inspired by the "dense, technical, quietly luxurious" dark
-- product-software palette in the supplied design-md/linear.app reference
-- (not literally branded as that company's name anywhere in this app's UI
-- — described here only as this migration's own reasoning). It's the
-- most visually distinct of the 6 presets: the other 5 are either
-- light-with-dark-sidebar or a single flat dark hue, where Nova commits to
-- near-black everywhere plus a genuine "special colour effect" — an
-- ambient violet glow behind the sidebar and a soft pulse on the active
-- nav tile (see globals.css's "Nova signature effect" section and
-- dashboard-sidebar.tsx) — scoped entirely to `[data-theme="nova"]` so it
-- never touches the other 5 themes.
--
-- This migration ONLY widens the existing CHECK constraint so 'nova' can
-- be saved to employees.theme_id — the actual token values live in
-- globals.css and the picker metadata in themes.ts (both app-code changes,
-- not DB). Idempotent (DROP + re-ADD) — safe to re-run.

BEGIN;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_theme_id_check;
ALTER TABLE employees
  ADD CONSTRAINT employees_theme_id_check
    CHECK (theme_id IS NULL OR theme_id IN ('navy-gold', 'day', 'eye-comfort', 'night', 'ocean', 'nova'));

COMMIT;
