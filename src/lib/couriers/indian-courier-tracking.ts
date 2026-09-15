// 2026-09-15 — indian-courier-api adapter ("install our system" per the
// refurnish request: github.com/rajatdhoot123/indian-courier-api).
//
// WHAT THIS REPO IS: a small self-hosted Node service that scrapes/normalizes
// tracking for Indian couriers the big APIs don't always cover — Ekart,
// Ecom Express, DTDC, Bluedart, Shadowfax, Gati, Maruti — and exposes one
// GET endpoint per courier:
//     GET {base}/{courier}/{trackingId}
// returning an array of checkpoints:
//     { "location": "BENGALURU", "detail": "Shipment delivered", "date": "26 Mar, 2018 12:50 hrs" }
// (It can also front AfterShip with /api/track/{provider}/{id}.)
//
// WHY AN ADAPTER AND NOT A MERGE: it's a separate Express service with its
// own process — like the OpenWA decision (see BRAIN.md §9), merging it into
// this Next.js app is neither possible nor desirable. Instead we treat it
// exactly like every other courier here (FedEx/UPS/DHL/Aramex pattern):
// a small client module + a base-URL env var, called from server code only.
//
// SETUP (one-time, for the user):
//   1. git clone https://github.com/rajatdhoot123/indian-courier-api
//   2. npm install && npm start          # listens on :5050 by default
//   3. Deploy it anywhere reachable (same Vercel project won't host it —
//      use a tiny VPS/Render/Railway) and put its URL in
//      INDIAN_COURIER_API_BASE (e.g. https://courier-track.example.com)
//   4. Tracking page: the new "Indian" tab calls the app's own
//      /api/couriers/indian-track route (below), which proxies this module.
//
// SECURITY: the base URL is server-only env (never NEXT_PUBLIC_). The
// service has no auth of its own — keep it private (VPC / basic auth at the
// proxy) and it only ever sees tracking IDs, no customer PII goes out.

const DEFAULT_TIMEOUT_MS = 12_000;

export type IndianCourierKey = "ekart" | "ecom" | "dtdc" | "bluedart" | "shadowfax" | "gati" | "maruti" | "dhl";

export const INDIAN_COURIERS: { key: IndianCourierKey; label: string; status: "working" | "beta" | "unknown" }[] = [
  { key: "ekart", label: "Ekart", status: "working" },
  { key: "ecom", label: "Ecom Express", status: "working" },
  { key: "dtdc", label: "DTDC", status: "working" },
  { key: "bluedart", label: "Bluedart", status: "working" },
  { key: "shadowfax", label: "Shadowfax", status: "unknown" },
  { key: "gati", label: "Gati", status: "unknown" },
  { key: "maruti", label: "Maruti", status: "beta" },
  { key: "dhl", label: "DHL", status: "working" },
];

export interface IndianCheckpoint {
  location: string;
  detail: string;
  date: string;
}

export type IndianTrackResult =
  | { ok: true; checkpoints: IndianCheckpoint[] }
  | { ok: false; error: string; kind: "not_configured" | "upstream_error" | "not_found" };

function baseUrl(): string | null {
  const raw = process.env.INDIAN_COURIER_API_BASE?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Fetches the checkpoint list for one (courier, trackingId) pair from the
 * self-hosted indian-courier-api service. Never throws — every failure mode
 * comes back as a typed { ok:false } so the UI can render a clean message.
 */
export async function trackViaIndianCourierApi(
  courier: IndianCourierKey,
  trackingId: string
): Promise<IndianTrackResult> {
  const base = baseUrl();
  if (!base) {
    return {
      ok: false,
      kind: "not_configured",
      error:
        "Indian courier tracking is not configured yet — set INDIAN_COURIER_API_BASE to your indian-courier-api deployment URL (see src/lib/couriers/indian-courier-tracking.ts header).",
    };
  }

  const id = trackingId.trim();
  if (!id) return { ok: false, kind: "not_found", error: "Tracking ID is required." };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const res = await fetch(`${base}/${encodeURIComponent(courier)}/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return { ok: false, kind: "not_found", error: `No tracking found for ${id} on ${courier}.` };
    }
    if (!res.ok) {
      return { ok: false, kind: "upstream_error", error: `Tracking service returned ${res.status}.` };
    }

    const data: unknown = await res.json();
    // The service returns either an array of checkpoints or an object with
    // a nested array — normalize both.
    const rows: unknown[] = Array.isArray(data)
      ? data
      : data && typeof data === "object" && Array.isArray((data as { checkpoints?: unknown[] }).checkpoints)
        ? (data as { checkpoints: unknown[] }).checkpoints
        : [];

    const checkpoints: IndianCheckpoint[] = rows
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        location: String(r.location ?? r.city ?? "").trim(),
        detail: String(r.detail ?? r.status ?? r.activity ?? "").trim(),
        date: String(r.date ?? r.timestamp ?? "").trim(),
      }))
      .filter((c) => c.detail || c.location);

    if (checkpoints.length === 0) {
      return { ok: false, kind: "not_found", error: `No checkpoints yet for ${id} on ${courier}.` };
    }
    return { ok: true, checkpoints };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, kind: "upstream_error", error: `Could not reach the tracking service: ${msg}` };
  }
}
