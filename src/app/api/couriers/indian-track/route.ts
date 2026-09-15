import { NextResponse } from "next/server";
import { getAuthedEmployee, UnauthorizedError } from "@/lib/auth/require-capability";
import { trackViaIndianCourierApi, type IndianCourierKey } from "@/lib/couriers/indian-courier-tracking";

// 2026-09-15 — server-side proxy for the self-hosted indian-courier-api
// service (see src/lib/couriers/indian-courier-tracking.ts). Keeps the base
// URL server-only and the caller authenticated — the browser never talks to
// the tracking service directly.
//
//   GET /api/couriers/indian-track?courier=ekart&trackingId=FMPC0279658213
//
// Any signed-in employee may call this: a tracking ID for one's own company
// is exactly what the existing tracking UI already shows; this adds the
// Indian-courier sources (Ekart/DTDC/Bluedart/Ecom/…) to that same view.

const VALID: readonly string[] = ["ekart", "ecom", "dtdc", "bluedart", "shadowfax", "gati", "maruti", "dhl"];

export async function GET(request: Request) {
  let employee;
  try {
    employee = await getAuthedEmployee();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
    }
    throw e;
  }
  void employee;

  const url = new URL(request.url);
  const courier = (url.searchParams.get("courier") ?? "").toLowerCase();
  const trackingId = (url.searchParams.get("trackingId") ?? "").trim();

  if (!VALID.includes(courier)) {
    return NextResponse.json({ ok: false, error: `Unknown courier "${courier}".` }, { status: 400 });
  }
  if (!trackingId) {
    return NextResponse.json({ ok: false, error: "trackingId is required." }, { status: 400 });
  }

  const result = await trackViaIndianCourierApi(courier as IndianCourierKey, trackingId);
  return NextResponse.json(result, { status: result.ok ? 200 : result.kind === "not_configured" ? 503 : 200 });
}
