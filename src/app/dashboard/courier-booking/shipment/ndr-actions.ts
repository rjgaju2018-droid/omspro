"use server";

// NDR (Non-Delivery Report / failed delivery attempt) manual logging —
// see db/2026-09-09-ndr-tracking.sql for the full context comment. Same
// "log an event against a shipment, staff-entered, reason dropdown + free
// text" shape as cancel-shipment-actions.ts, and the same
// resolved_at/resolved_by/resolved_note lifecycle as entry_errors
// (src/app/dashboard/error-log/actions.ts) — deliberately mirrors both
// rather than inventing a third pattern.
//
// Gated on the existing `courier_booking_shipment` capability (same one
// Track Shipments / Shipment Detail already use) — no new capability, per
// the confirmed scope. Company scoping: resolve the shipment's order's
// company_id and check employee.companyIds.includes(...) before any write,
// same pattern as cancel-shipment-actions.ts.
import { requireCapability } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { NDR_REASONS, type NdrReason } from "./ndr-data";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v ? v : null;
}
// <input type="datetime-local"> gives "YYYY-MM-DDTHH:mm" with no timezone
// (interpreted as the browser's local time) — new Date() on it is correct
// enough for this app's existing timezone handling (IST-only business, no
// other patterns in this codebase parse datetime-local more precisely
// either). Falls back to now() when left blank.
function parseAttemptedAt(formData: FormData): string {
  const raw = str(formData, "attempted_at");
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Resolves the company_id a courier_shipments row belongs to (via its
// order), same lookup cancel-shipment-actions.ts does for the same table.
async function getShipmentCompanyId(supabase: ServiceClient, courierShipmentId: string): Promise<{ orderId: string; companyId: string } | null> {
  const { data: shipment } = await supabase.from("courier_shipments").select("id, order_id").eq("id", courierShipmentId).maybeSingle();
  if (!shipment) return null;
  const { data: order } = await supabase.from("orders").select("id, company_id").eq("id", shipment.order_id).maybeSingle();
  if (!order) return null;
  return { orderId: shipment.order_id, companyId: order.company_id };
}

export type LogNdrState = { error: string | null; success: boolean };
const LOG_INITIAL: LogNdrState = { error: null, success: false };

export async function logNdrAttempt(_prev: LogNdrState, formData: FormData): Promise<LogNdrState> {
  const employee = await requireCapability("courier_booking_shipment");
  const supabase = createServiceRoleClient();

  const courierShipmentId = str(formData, "courier_shipment_id");
  const reason = str(formData, "reason") as NdrReason;
  if (!courierShipmentId) return { ...LOG_INITIAL, error: "Missing shipment." };
  if (!NDR_REASONS.includes(reason)) return { ...LOG_INITIAL, error: "Pick a valid NDR reason." };

  const target = await getShipmentCompanyId(supabase, courierShipmentId);
  if (!target) return { ...LOG_INITIAL, error: "Shipment not found." };
  if (!employee.companyIds.includes(target.companyId)) return { ...LOG_INITIAL, error: "Not authorized for this shipment's company." };

  // Next attempt_no for this shipment — not fully race-proof (two staff
  // submitting within the same instant could both compute the same next
  // number), but the table's own UNIQUE(courier_shipment_id, attempt_no)
  // constraint catches that case: the second insert fails cleanly instead
  // of silently overwriting, and the error message below tells the user to
  // retry (which re-reads the now-correct max).
  const { data: existing } = await supabase
    .from("courier_shipment_ndr_attempts")
    .select("attempt_no")
    .eq("courier_shipment_id", courierShipmentId)
    .order("attempt_no", { ascending: false })
    .limit(1);
  const nextAttemptNo = (existing?.[0]?.attempt_no ?? 0) + 1;

  const { error } = await supabase.from("courier_shipment_ndr_attempts").insert({
    courier_shipment_id: courierShipmentId,
    attempt_no: nextAttemptNo,
    reason,
    note: strOrNull(formData, "note"),
    attempted_at: parseAttemptedAt(formData),
    logged_by_employee_id: employee.id,
    logged_by_name: employee.name,
  });
  if (error) {
    return {
      ...LOG_INITIAL,
      error: error.code === "23505" ? "Another attempt was just logged for this shipment at the same moment — please try again." : error.message,
    };
  }

  revalidatePath(`/dashboard/courier-booking/shipment/${courierShipmentId}`);
  revalidatePath("/dashboard/courier-booking");
  return { error: null, success: true };
}

export type ResolveNdrState = { error: string | null; success: boolean };
const RESOLVE_INITIAL: ResolveNdrState = { error: null, success: false };

export async function resolveNdrAttempt(_prev: ResolveNdrState, formData: FormData): Promise<ResolveNdrState> {
  const employee = await requireCapability("courier_booking_shipment");
  const supabase = createServiceRoleClient();

  const ndrAttemptId = str(formData, "ndr_attempt_id");
  if (!ndrAttemptId) return { ...RESOLVE_INITIAL, error: "Missing NDR attempt." };

  const { data: attempt } = await supabase
    .from("courier_shipment_ndr_attempts")
    .select("id, courier_shipment_id, resolved_at")
    .eq("id", ndrAttemptId)
    .maybeSingle();
  if (!attempt) return { ...RESOLVE_INITIAL, error: "NDR attempt not found." };
  if (attempt.resolved_at) return { ...RESOLVE_INITIAL, error: "Already resolved." };

  const target = await getShipmentCompanyId(supabase, attempt.courier_shipment_id);
  if (!target) return { ...RESOLVE_INITIAL, error: "Shipment not found." };
  if (!employee.companyIds.includes(target.companyId)) return { ...RESOLVE_INITIAL, error: "Not authorized for this shipment's company." };

  const { error } = await supabase
    .from("courier_shipment_ndr_attempts")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_employee_id: employee.id,
      resolved_by_name: employee.name,
      resolved_note: strOrNull(formData, "resolved_note"),
    })
    .eq("id", ndrAttemptId);
  if (error) return { ...RESOLVE_INITIAL, error: error.message };

  revalidatePath(`/dashboard/courier-booking/shipment/${attempt.courier_shipment_id}`);
  revalidatePath("/dashboard/courier-booking");
  return { error: null, success: true };
}
