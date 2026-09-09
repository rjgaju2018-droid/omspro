// 2026-08-22 — Dashboard theme system: the single source of truth for
// which 5 themes exist, their display metadata, and the swatch colors used
// to render the picker UI (src/app/dashboard/settings/theme).
//
// User's confirmed spec: "pure desbord ke andar 5 theam banege example
// navy/gold or day night eye comfert and night mode ka option ho" — 5
// presets. The actual live CSS variable values for each theme live in
// src/app/globals.css under `[data-theme="<id>"]` blocks — this file only
// mirrors the handful of colors needed to draw a small preview swatch per
// theme in the settings UI, so it must be kept in sync by hand whenever a
// theme's palette changes in globals.css (both files say so in a comment).
//
// - navy-gold: the app's OWN existing established look — dark navy sidebar
//   (#0f172a, same slate-900 the sidebar already hardcoded) + gold accent
//   (#f59e0b, the same amber-500 already used everywhere: buttons, active
//   sidebar tile, focus rings) + light content area (matches today's
//   default, unstyled dashboard exactly — this theme is a no-visual-change
//   baseline). The deeper near-black navy (#0a0a1a) + pale gold (#f2d99b)
//   from the HR certificate are used as the *swatch* accent duo since
//   that's the more distinctly "navy/gold branded" combination to show in
//   a small preview chip.
// - day: a plain, fully-light mode — light sidebar too (not just content),
//   cool blue accent, for a clean daytime look distinct from the brand's
//   gold.
// - eye-comfort: warm, low-contrast, for long sessions — soft cream
//   background, muted brown/terracotta tones, nothing near-white or
//   near-black anywhere.
// - night: full dark mode — near-black everywhere (header + sidebar +
//   content), cool sky-blue accent (kept distinct from navy-gold's warm
//   gold so the two dark-leaning themes don't look identical).
// - ocean: 5th theme, picked by the build (not specified by the user) — a
//   cool, high-contrast professional teal/blue look, light content with a
//   deep teal sidebar and a teal accent. Documented in the build's report
//   as swappable if the user wants a different 5th theme later.
// - nova: 6th theme, added 2026-09-08 in response to "chose desgine and
//   use our system and redesgine UI with specil colour effect" — a design
//   language was picked from a supplied 74-brand design-token reference
//   collection and adapted as a new preset here (see
//   db/2026-09-08-nova-theme.sql for the full reasoning). Deep near-black
//   canvas everywhere (not just the sidebar, like navy-gold/day/ocean) with
//   an electric violet accent (#5e6ad2) — the most visually distinct of
//   the 6 presets, and the only one with its own extra "special colour
//   effect" flourish: an ambient violet glow behind the sidebar and a
//   soft pulse on the active nav tile, both scoped to
//   `[data-theme="nova"]` in globals.css so the other 5 themes are
//   untouched.
// - clay: 7th theme, added 2026-09-09 — the "Claymorphism" look from the
//   standalone UI mockup project, ported into this SAME theme system
//   (see db/2026-09-09-clay-theme.sql) rather than rewriting any page.
//   Warm cream canvas + a light warm-cream sidebar (not dark, unlike every
//   other theme except Day) + a terracotta accent (#d97a4a), matching the
//   mockup's own palette exactly. Its own "signature effect" (globals.css,
//   "Clay signature effect" section) is a soft embossed/pressed-in shadow
//   on the sidebar and the active nav tile — evoking the mockup's
//   neumorphic dual-shadow technique — scoped to `[data-theme="clay"]` so
//   the other 6 themes are untouched. Deliberately colors-plus-sidebar-
//   effect only, NOT a full per-page rebuild (the mockup's rounded-corner/
//   soft-shadow treatment on every individual card is hardcoded across 47+
//   files app-wide, not driven by this shared token system — a much
//   bigger, separate project if wanted later).
export type ThemeId = "navy-gold" | "day" | "eye-comfort" | "night" | "ocean" | "nova" | "clay";

export const THEME_IDS: ThemeId[] = [
  "navy-gold",
  "day",
  "eye-comfort",
  "night",
  "ocean",
  "nova",
  "clay",
];

export const DEFAULT_THEME: ThemeId = "navy-gold";

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  description: string;
  /** Small preview swatch colors — canvas/content bg, sidebar bg, accent, surface (card) bg. */
  swatch: { canvas: string; sidebar: string; accent: string; surface: string };
};

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  "navy-gold": {
    id: "navy-gold",
    label: "Navy / Gold",
    description: "The app's own established brand look — navy sidebar, gold accents. (Default)",
    swatch: { canvas: "#f1f5f9", sidebar: "#0a0a1a", accent: "#d9a441", surface: "#ffffff" },
  },
  day: {
    id: "day",
    label: "Day",
    description: "Clean, fully-light mode for daytime use.",
    swatch: { canvas: "#f8fafc", sidebar: "#ffffff", accent: "#2563eb", surface: "#ffffff" },
  },
  "eye-comfort": {
    id: "eye-comfort",
    label: "Eye Comfort",
    description: "Warm, low-contrast cream tones — easier on the eyes for long sessions.",
    swatch: { canvas: "#f3e9d6", sidebar: "#4a4030", accent: "#c97b4a", surface: "#fdf8ee" },
  },
  night: {
    id: "night",
    label: "Night",
    description: "Full dark mode for low-light use.",
    swatch: { canvas: "#0b0f19", sidebar: "#05070c", accent: "#38bdf8", surface: "#161b26" },
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    description: "Cool teal/blue professional look. (5th theme — build's pick, swap if you'd rather have something else)",
    swatch: { canvas: "#eef6f8", sidebar: "#0c344a", accent: "#0ea5a4", surface: "#ffffff" },
  },
  nova: {
    id: "nova",
    label: "Nova",
    description: "Deep near-black with an electric violet accent and an ambient glow effect — the boldest of the 6 looks.",
    swatch: { canvas: "#0a0a0c", sidebar: "#050506", accent: "#5e6ad2", surface: "#131318" },
  },
  clay: {
    id: "clay",
    label: "Clay",
    description: "Warm cream tones with a terracotta accent and a soft embossed sidebar — from the Claymorphism UI mockup.",
    swatch: { canvas: "#f6efe1", sidebar: "#fbf1e2", accent: "#d97a4a", surface: "#fffaf0" },
  },
};

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return !!value && (THEME_IDS as string[]).includes(value);
}

/** Loose hex validator matching the DB CHECK constraint (#abc or #aabbcc). */
export function isValidHexColor(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value);
}
