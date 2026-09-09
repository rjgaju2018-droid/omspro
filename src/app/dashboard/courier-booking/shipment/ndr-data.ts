// Data-fetch for NDR (Non-Delivery Report / failed delivery attempt) rows
// against one shipment — server-only, no "use server" directive (a read,
// called from a Server Component page, same convention as
// shipment-detail-data.ts). See db/2026-09-09-ndr-tracking.sql for the
// full context comment on why this exists and what it deliberately does
// NOT do (no courier webhook auto-parsing — manual entry only).
//
// No company check here: the caller (shipment/[id]/page.tsx) already
// resolved+authorized the parent shipment via getShipmentDetail() before
// ever calling this, same as order_packages/freight_bill_awb_assignments
// are fetched in that same file without a second company check.
import { createServiceRoleClient } from "@/lib/supabase/server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type NdrReason = "Address Issue" | "Customer Unavailable" | "Refused" | "Weather/Force Majeure" | "Other";
export const NDR_REASONS: NdrReason[] = ["Address Issue", "Customer Unavailable", "Refused", "Weather/Force Majeure", "Other"];

export type NdrAttempt = {
  id: string;
  attemptNo: number;
  reason: NdrReason;
  note: string | null;
  attemptedAt: string;
  loggedByName: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolvedNote: string | null;
};

export async function getNdrAttemptsForShipment(supabase: ServiceClient, courierShipmentId: string): Promise<NdrAttempt[]> {
  const { data } = await supabase
    .from("courier_shipment_ndr_attempts")
    .select("id, attempt_no, reason, note, attempted_at, logged_by_name, created_at, resolved_at, resolved_by_name, resolved_note")
    .eq("courier_shipment_id", courierShipmentId)
    .order("attempt_no", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id,
    attemptNo: r.attempt_no,
    reason: r.reason as NdrReason,
    note: r.note,
    attemptedAt: r.attempted_at,
    loggedByName: r.logged_by_name,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedByName: r.resolved_by_name,
    resolvedNote: r.resolved_note,
  }));
}
