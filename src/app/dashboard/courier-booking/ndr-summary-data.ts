// Data-fetch for the NDR summary panel (new "NDR" tab on the Courier Ops
// Dashboard) — every currently-UNRESOLVED NDR across every shipment, plus
// a reason-wise breakdown count, same shape a Shiprocket-style NDR panel
// shows ("5 Address Issues, 2 Customer Unavailable" etc). See
// db/2026-09-09-ndr-tracking.sql for the full context comment.
//
// Server-only, no "use server" directive — a read, only called from
// courier-booking/page.tsx (a Server Component), same convention as
// tracking-data.ts/pending-orders-data.ts in this same directory.
//
// Plain queries, not an embedded-resource join — see tracking-data.ts's
// own comment on why this codebase's hand-rolled Database type doesn't
// emit Relationships metadata for join shapes.
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CourierKey } from "@/lib/couriers/credentials";
import { NDR_REASONS, type NdrReason } from "./shipment/ndr-data";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type NdrSummaryRow = {
  id: string;
  courierShipmentId: string;
  attemptNo: number;
  reason: NdrReason;
  note: string | null;
  attemptedAt: string;
  loggedByName: string;
  orderId: string;
  refNo: string;
  courier: CourierKey | "other";
  manualCourierName: string | null;
  awbNo: string | null;
};

export type NdrSummary = {
  totalUnresolved: number;
  byReason: { reason: NdrReason; count: number }[];
  rows: NdrSummaryRow[]; // capped for display — see MAX_ROWS
};

// Unresolved NDRs should stay a small, actively-worked queue in practice
// (this is a "clear it out" list, not a historical report) — a cap this
// generous is defensive, not expected to ever actually bind.
const MAX_UNRESOLVED_SCAN = 2000;
const MAX_ROWS_SHOWN = 300;

export async function getUnresolvedNdrSummary(supabase: ServiceClient, companyIds: string[]): Promise<NdrSummary> {
  const { data: unresolved } = await supabase
    .from("courier_shipment_ndr_attempts")
    .select("id, courier_shipment_id, attempt_no, reason, note, attempted_at, logged_by_name")
    .is("resolved_at", null)
    .order("attempted_at", { ascending: false })
    .limit(MAX_UNRESOLVED_SCAN);

  if (!unresolved || unresolved.length === 0) {
    return { totalUnresolved: 0, byReason: NDR_REASONS.map((reason) => ({ reason, count: 0 })), rows: [] };
  }

  const shipmentIds = Array.from(new Set(unresolved.map((r) => r.courier_shipment_id)));
  const { data: shipments } = await supabase
    .from("courier_shipments")
    .select("id, order_id, courier, manual_courier_name, awb_no")
    .in("id", shipmentIds);
  const shipmentById = new Map((shipments ?? []).map((s) => [s.id, s]));

  const orderIds = Array.from(new Set((shipments ?? []).map((s) => s.order_id)));
  const { data: orders } = await supabase.from("orders").select("id, ref_no, company_id").in("id", orderIds).in("company_id", companyIds);
  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  const rows: NdrSummaryRow[] = [];
  const byReasonCount = new Map<NdrReason, number>(NDR_REASONS.map((r) => [r, 0]));

  for (const r of unresolved) {
    const shipment = shipmentById.get(r.courier_shipment_id);
    if (!shipment) continue;
    const order = orderById.get(shipment.order_id);
    if (!order) continue; // not in a company this employee can see

    const reason = r.reason as NdrReason;
    byReasonCount.set(reason, (byReasonCount.get(reason) ?? 0) + 1);

    if (rows.length < MAX_ROWS_SHOWN) {
      rows.push({
        id: r.id,
        courierShipmentId: r.courier_shipment_id,
        attemptNo: r.attempt_no,
        reason,
        note: r.note,
        attemptedAt: r.attempted_at,
        loggedByName: r.logged_by_name,
        orderId: shipment.order_id,
        refNo: order.ref_no,
        courier: shipment.courier as CourierKey | "other",
        manualCourierName: shipment.manual_courier_name,
        awbNo: shipment.awb_no,
      });
    }
  }

  const totalUnresolved = Array.from(byReasonCount.values()).reduce((a, b) => a + b, 0);
  const byReason = NDR_REASONS.map((reason) => ({ reason, count: byReasonCount.get(reason) ?? 0 }));

  return { totalUnresolved, byReason, rows };
}
