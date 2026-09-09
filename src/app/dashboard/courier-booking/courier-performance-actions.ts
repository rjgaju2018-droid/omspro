"use server";

// "Download All" for the Courier Performance by Country tab (2026-09-09) —
// runs the same aggregation as the on-screen table (no row cap difference
// here, unlike Daily Report's CSV, since the output is already a small
// aggregated matrix, not one row per shipment) and returns it as CSV text
// for the client to save as a file. Same one-shot-button-triggered plain
// server-action shape as exportDailyShipmentReportCsv in
// daily-report-actions.ts.
import { requireCapability } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getCourierPerformanceReport, toCsv, type CourierPerformanceFilters } from "./courier-performance-data";

export async function exportCourierPerformanceCsv(filters: CourierPerformanceFilters): Promise<{ csv: string | null; error: string | null }> {
  try {
    const employee = await requireCapability("courier_booking_shipment");
    const supabase = createServiceRoleClient();
    const { rows } = await getCourierPerformanceReport(supabase, employee.currentCompanyId, filters);
    return { csv: toCsv(rows), error: null };
  } catch (err) {
    return { csv: null, error: err instanceof Error ? err.message : String(err) };
  }
}
