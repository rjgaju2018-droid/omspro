// Shared data for the OMS Pro Virtual Assistant character — moved here from
// src/app/dashboard/companion-preview/companion-config.ts on 2026-09-05 so
// both the (still-existing) preview/mockup page AND the live widget
// (companion-live-provider.tsx) share exactly one character definition —
// no forked copies to keep in sync. Pure data, no React here.
//
// 2026-09-12 — "Virtual Assistant" upgrade (replaces the old vest-mascot
// look): a stylized Indian-girl assistant with a proper ladies wardrobe —
// salwar suit, sharara, jeans-top, saree (plus 4 colorways each) — that
// auto-rotates DAILY ("24 me 24 baar nye outfit me aayegi"), a DANCE pose
// for celebrations ("dance karegi ... ab to party to banti hai"), a
// rotating daily makeup look (lipstick + bindi + eyeshadow), and long
// flowing hair. Live event types grew to cover birthdays, anniversaries,
// new-employee IDs, generic data saves and errors.

export type CompanionStateId =
  | "punch_in"
  | "task_completed"
  | "overdue"
  | "idle_night"
  | "focused"
  | "dance";

export interface CompanionStateConfig {
  id: CompanionStateId;
  buttonLabel: string; // what the simulate-button says
  label: string; // what the state label under the character says
  moodTag: string;
  signal: string; // the real app signal this maps to
  auraColor: string; // background glow behind the character for this mood
}

export const COMPANION_STATES: CompanionStateConfig[] = [
  {
    id: "punch_in",
    buttonLabel: "Simulate: Punch In",
    label: "Punched In",
    moodTag: "Energetic & happy",
    signal: "Real signal: attendance punch-in recorded for the day",
    auraColor: "#f59e0b",
  },
  {
    id: "task_completed",
    buttonLabel: "Simulate: Task Completed",
    label: "Task Completed",
    moodTag: "Celebratory",
    signal: "Real signal: a task or order gets marked complete",
    auraColor: "#eab308",
  },
  {
    id: "overdue",
    buttonLabel: "Simulate: Order Overdue",
    label: "Order Overdue",
    moodTag: "Concerned",
    signal: "Real signal: a task/order goes past its due date, or an error needs attention",
    auraColor: "#ef4444",
  },
  {
    id: "idle_night",
    buttonLabel: "Simulate: Idle (Late Night)",
    label: "Idle (Late Night)",
    moodTag: "Sleepy",
    signal: "Real signal: no activity + it's after-hours (e.g. past 10pm, nobody punched in)",
    auraColor: "#6366f1",
  },
  {
    id: "focused",
    buttonLabel: "Simulate: Normal Work",
    label: "Normal Work",
    moodTag: "Neutral & focused",
    signal: "Real signal: regular business hours, no special event — the day-to-day baseline",
    auraColor: "#64748b",
  },
  {
    // 2026-09-12 — the celebration dance ("birthday ho, anniversary ho dance
    // karegi ... ab to party to banti hai"). Bollywood-arms + hip-sway pose.
    id: "dance",
    buttonLabel: "Simulate: Dance",
    label: "Party Time!",
    moodTag: "Dancing & celebrating",
    signal: "Real signal: birthday, work anniversary, or a brand-new employee ID",
    auraColor: "#ec4899",
  },
];

export const DEFAULT_COMPANION_STATE: CompanionStateId = "focused";

// LIVE (real-world) event types — these drive the widget on every
// dashboard page (companion-live-provider.tsx), separate from the
// COMPANION_STATES above (which stay simulate-button-only on the preview
// page). Each maps onto one of the moods/poses above.
export type CompanionEventType =
  | "order_placed"
  | "task_assigned"
  | "return_processed"
  | "shipment_booked"
  | "attendance_marked"
  // 2026-09-12 — the celebration + awareness batch:
  | "birthday"
  | "work_anniversary"
  | "new_employee"
  | "data_saved"
  | "error";

export const EVENT_TYPE_TO_MOOD: Record<CompanionEventType, CompanionStateId> = {
  order_placed: "task_completed", // celebratory
  task_assigned: "punch_in", // energetic / "heads up, new thing to do"
  return_processed: "overdue", // concerned face fits a return best
  shipment_booked: "task_completed", // celebratory
  attendance_marked: "punch_in", // literally the mockup's original signal for this pose
  birthday: "dance", // "birthday ho ... dance karegi"
  work_anniversary: "dance", // same party treatment
  new_employee: "dance", // "naya employee ki id generate hogi ... ab to party to banti hai"
  data_saved: "task_completed", // a gentle celebratory nod on every save
  error: "overdue", // concerned — something needs attention
};

// Outfits — the 2026-09-12 ladies wardrobe. Each entry carries a `kind`
// (which base drawing companion-character.tsx uses) + its own colors, so
// 8 outfits come from 4 garment shapes. Daily rotation picks outfit index
// = day-of-year % 8, so the assistant wears a different one every day
// ("24 me 24 baar nye outfit me aayegi").
export type OutfitId =
  | "salwar_pink"
  | "salwar_teal"
  | "sharara_purple"
  | "sharara_gold"
  | "jeans_top_blue"
  | "jeans_top_rose"
  | "saree_red"
  | "saree_green";

export type OutfitKind = "salwar" | "sharara" | "jeans_top" | "saree";

export interface CompanionOutfit {
  id: OutfitId;
  label: string;
  kind: OutfitKind;
  /** Main garment color */
  primary: string;
  /** Shading / border tone of the same garment */
  shade: string;
  /** Dupatta / second-piece accent */
  accent: string;
  /** Footwear */
  shoeColor: string;
}

export const COMPANION_OUTFITS: CompanionOutfit[] = [
  // Salwar suits — kameez + salwar + dupatta
  { id: "salwar_pink", label: "Pink Salwar Suit", kind: "salwar", primary: "#ec4899", shade: "#be185d", accent: "#fbcfe8", shoeColor: "#9d174d" },
  { id: "salwar_teal", label: "Teal Salwar Suit", kind: "salwar", primary: "#14b8a6", shade: "#0f766e", accent: "#99f6e4", shoeColor: "#134e4a" },
  // Sharara — short kurti + flowing sharara pants
  { id: "sharara_purple", label: "Purple Sharara", kind: "sharara", primary: "#8b5cf6", shade: "#6d28d9", accent: "#fbbf24", shoeColor: "#4c1d95" },
  { id: "sharara_gold", label: "Golden Sharara", kind: "sharara", primary: "#d97706", shade: "#b45309", accent: "#fde68a", shoeColor: "#78350f" },
  // Jeans + top — modern casual
  { id: "jeans_top_blue", label: "Jeans & Blue Top", kind: "jeans_top", primary: "#2563eb", shade: "#1e40af", accent: "#60a5fa", shoeColor: "#1f2937" },
  { id: "jeans_top_rose", label: "Jeans & Rose Top", kind: "jeans_top", primary: "#f43f5e", shade: "#be123c", accent: "#1d4ed8", shoeColor: "#881337" },
  // Sarees — drape + pallu
  { id: "saree_red", label: "Red Silk Saree", kind: "saree", primary: "#dc2626", shade: "#991b1b", accent: "#fbbf24", shoeColor: "#7f1d1d" },
  { id: "saree_green", label: "Green Silk Saree", kind: "saree", primary: "#16a34a", shade: "#166534", accent: "#fcd34d", shoeColor: "#14532d" },
];

export const DEFAULT_OUTFIT: OutfitId = "salwar_pink";

/**
 * Daily outfit rotation — day-of-year mod the outfit count, so the outfit
 * changes once every day at midnight (server-stable: pure function of the
 * date, no state to keep in sync).
 */
export function outfitForDate(date: Date = new Date()): OutfitId {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return COMPANION_OUTFITS[dayOfYear % COMPANION_OUTFITS.length].id;
}

export type HairId = "long_wavy" | "braid" | "bun" | "wavy";

export interface CompanionHair {
  id: HairId;
  label: string;
}

export const COMPANION_HAIR: CompanionHair[] = [
  { id: "long_wavy", label: "Long Wavy" },
  { id: "braid", label: "Side Braid" },
  { id: "bun", label: "Classic Bun" },
  // Legacy id kept so the preview page's old saved choices keep resolving.
  { id: "wavy", label: "Wavy Brown" },
];

export const DEFAULT_HAIR: HairId = "long_wavy";

// 2026-09-12 — "live makeup bhi karti rahegi": a small daily makeup look —
// lipstick + bindi + eyeshadow — rotating alongside the outfit. Pure data,
// drawn by companion-character.tsx's renderMakeup().
export interface MakeupLook {
  lipstick: string;
  eyeshadow: string;
  bindi: string;
}

export const MAKEUP_LOOKS: MakeupLook[] = [
  { lipstick: "#e11d48", eyeshadow: "#f472b6", bindi: "#dc2626" }, // classic red
  { lipstick: "#db2777", eyeshadow: "#c084fc", bindi: "#7c3aed" }, // pink-purple
  { lipstick: "#be123c", eyeshadow: "#fbbf24", bindi: "#b45309" }, // maroon-gold
  { lipstick: "#f43f5e", eyeshadow: "#38bdf8", bindi: "#0ea5e9" }, // rose-blue
];

export function makeupForDate(date: Date = new Date()): MakeupLook {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return MAKEUP_LOOKS[dayOfYear % MAKEUP_LOOKS.length];
}

// 2026-09-05 — glasses overlay, on by default (matches every reference
// photo). Kept as its own boolean rather than folded into hair/outfit so
// it can be toggled independently on the wardrobe panel.
export const DEFAULT_GLASSES = false;
