// Data-fetch + aggregation for "Courier Performance by Country" (2026-09-09)
// — a new tab on the Courier Ops Dashboard answering "which courier is
// actually best for shipping to which country". Pure reporting/aggregation
// on data ALREADY captured by the in-app booking flow — no new table.
//
// Real columns used (verified against db/schema.sql before writing this):
//   - courier_shipments: courier, manual_courier_name, status, order_id,
//     order_shipment_id, created_at (= booking timestamp — the closest
//     real "shipped" signal this schema has; writeOrderShipmentFromBooking
//     in actions.ts sets orders.shipment_status='Shipped' at this same
//     moment), cancelled_at.
//   - orders: destination_country, shipment_status, company_id.
//   - order_shipments: delivered_status, delivered_date — set by
//     src/lib/courier-webhooks/apply-tracking-event.ts from real courier
//     webhooks/polling (Delhivery/Shiprocket push, UPS push, FedEx cron
//     poll), NOT fabricated here.
//
// HONEST SCOPE, stated plainly rather than assumed:
//   1. There is no per-shipment RTO/returned flag anywhere in this schema —
//      order_shipments.delivered_status is only 'Delivered'/'NOT
//      Delivered' (apply-tracking-event.ts's own header comment: "RTO
//      isn't really either" of those two values). So "returned/cancelled"
//      here is the ORDER-level orders.shipment_status ('Returned' from an
//      RTO webhook event, or 'Cancelled' from either an RTO... no — from
//      Cancel Shipment) combined with this courier_shipments row's own
//      booking-level status='cancelled'. On the rare order with more than
//      one courier_shipments row (re-booked with a different courier —
//      UNIQUE(order_id, courier) allows at most one row per courier per
//      order), an order-level Returned/Cancelled is attributed to every
//      courier that touched that order, since no finer-grained signal
//      exists to split it by courier.
//   2. "Average time to deliver" is booking-timestamp → delivered_date, in
//      days. Only shipments that both (a) actually show delivered_status
//      = 'Delivered' and (b) have a delivered_date populated (the webhook
//      that set 'Delivered' always sets delivered_date in the same write,
//      so in practice this is nearly all of them) count toward the
//      average — see deliveredWithTimingCount on each row for exactly how
//      many did.
//   3. 'pending'/'failed' courier_shipments rows (a booking attempt that
//      never produced a real AWB) are excluded entirely — they were never
//      actually shipped, so counting them would understate every courier's
//      real success rate. 'created' and 'cancelled' are both included (an
//      AWB WAS generated in both cases) — see cancel-shipment-actions.ts:
//      cancelling flips courier_shipments.status to 'cancelled' and
//      orders.shipment_status to 'Cancelled', it never deletes the row.
import { createServiceRoleClient } from "@/lib/supabase/server";
import { COURIERS, type CourierKey } from "@/lib/couriers/credentials";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

export type CourierPerformanceFilters = {
  dateFrom?: string;
  dateTo?: string;
  courier?: CourierKey | "other" | "";
  destinationCountry?: string;
};

export type CourierPerformanceRow = {
  courier: CourierKey | "other";
  courierLabel: string;
  destinationCountry: string;
  shipmentCount: number;
  deliveredCount: number;
  returnedCancelledCount: number;
  inTransitOrOtherCount: number;
  successRatePct: number | null;
  avgDeliveryDays: number | null;
  deliveredWithTimingCount: number;
};

const SHIPMENT_ROW_CAP = 3000;

export async function getCourierPerformanceReport(
  supabase: ServiceClient,
  companyId: string,
  filters: CourierPerformanceFilters
): Promise<{ rows: CourierPerformanceRow[]; shipmentsMatched: number; rowCapHit: boolean }> {
  let shipmentQuery = supabase
    .from("courier_shipments")
    .select("id, courier, manual_courier_name, status, order_id, order_shipment_id, created_at")
    .in("status", ["created", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(SHIPMENT_ROW_CAP);
  if (filters.courier) shipmentQuery = shipmentQuery.eq("courier", filters.courier);
  if (filters.dateFrom) shipmentQuery = shipmentQuery.gte("created_at", filters.dateFrom);
  if (filters.dateTo) shipmentQuery = shipmentQuery.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);

  const { data: shipments } = await shipmentQuery;
  if (!shipments || shipments.length === 0) return { rows: [], shipmentsMatched: 0, rowCapHit: false };

  const orderIds = Array.from(new Set(shipments.map((s) => s.order_id)));
  let orderQuery = supabase
    .from("orders")
    .select("id, destination_country, shipment_status, company_id")
    .in("id", orderIds)
    .eq("company_id", companyId);
  if (filters.destinationCountry) orderQuery = orderQuery.eq("destination_country", filters.destinationCountry);
  const { data: orders } = await orderQuery;
  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  const shipmentIds = shipments.map((s) => s.order_shipment_id).filter((id): id is string => !!id);
  const { data: orderShipments } =
    shipmentIds.length > 0
      ? await supabase.from("order_shipments").select("id, delivered_status, delivered_date").in("id", shipmentIds)
      : { data: [] as { id: string; delivered_status: string | null; delivered_date: string | null }[] };
  const orderShipmentById = new Map((orderShipments ?? []).map((os) => [os.id, os]));

  type Group = {
    courier: CourierKey | "other";
    courierLabel: string;
    destinationCountry: string;
    shipmentCount: number;
    deliveredCount: number;
    returnedCancelledCount: number;
    deliveryDaysSum: number;
    deliveredWithTimingCount: number;
  };
  const groups = new Map<string, Group>();
  let matchedCount = 0;

  for (const s of shipments) {
    const order = orderById.get(s.order_id);
    if (!order) continue; // wrong company, or excluded by the destinationCountry filter
    matchedCount++;

    const courierKey = s.courier as CourierKey | "other";
    const courierLabel =
      courierKey === "other" ? s.manual_courier_name || "Other (unspecified)" : COURIERS.find((c) => c.key === courierKey)?.label ?? courierKey;
    const country = order.destination_country?.trim() || "Unknown";
    const groupKey = `${courierKey}::${courierLabel}::${country}`;

    let g = groups.get(groupKey);
    if (!g) {
      g = {
        courier: courierKey,
        courierLabel,
        destinationCountry: country,
        shipmentCount: 0,
        deliveredCount: 0,
        returnedCancelledCount: 0,
        deliveryDaysSum: 0,
        deliveredWithTimingCount: 0,
      };
      groups.set(groupKey, g);
    }
    g.shipmentCount++;

    const os = s.order_shipment_id ? orderShipmentById.get(s.order_shipment_id) : null;
    const isReturnedOrCancelled = s.status === "cancelled" || order.shipment_status === "Returned" || order.shipment_status === "Cancelled";
    const isDelivered = os?.delivered_status === "Delivered";

    if (isReturnedOrCancelled) {
      g.returnedCancelledCount++;
    } else if (isDelivered) {
      g.deliveredCount++;
      if (os?.delivered_date && s.created_at) {
        const bookedMs = new Date(s.created_at).getTime();
        const deliveredMs = new Date(`${os.delivered_date}T00:00:00Z`).getTime();
        const days = (deliveredMs - bookedMs) / (1000 * 60 * 60 * 24);
        if (Number.isFinite(days) && days >= 0) {
          g.deliveryDaysSum += days;
          g.deliveredWithTimingCount++;
        }
      }
    }
  }

  const rows: CourierPerformanceRow[] = Array.from(groups.values())
    .map((g) => ({
      courier: g.courier,
      courierLabel: g.courierLabel,
      destinationCountry: g.destinationCountry,
      shipmentCount: g.shipmentCount,
      deliveredCount: g.deliveredCount,
      returnedCancelledCount: g.returnedCancelledCount,
      inTransitOrOtherCount: g.shipmentCount - g.deliveredCount - g.returnedCancelledCount,
      successRatePct: g.shipmentCount > 0 ? Math.round((g.deliveredCount / g.shipmentCount) * 1000) / 10 : null,
      avgDeliveryDays: g.deliveredWithTimingCount > 0 ? Math.round((g.deliveryDaysSum / g.deliveredWithTimingCount) * 10) / 10 : null,
      deliveredWithTimingCount: g.deliveredWithTimingCount,
    }))
    .sort((a, b) => b.shipmentCount - a.shipmentCount);

  return { rows, shipmentsMatched: matchedCount, rowCapHit: shipments.length >= SHIPMENT_ROW_CAP };
}

const CSV_COLUMNS: { key: keyof CourierPerformanceRow; header: string }[] = [
  { key: "courierLabel", header: "Courier" },
  { key: "destinationCountry", header: "Destination Country" },
  { key: "shipmentCount", header: "Shipments" },
  { key: "deliveredCount", header: "Delivered" },
  { key: "returnedCancelledCount", header: "Returned/Cancelled" },
  { key: "inTransitOrOtherCount", header: "In Transit / Pending" },
  { key: "successRatePct", header: "Delivery Success Rate (%)" },
  { key: "avgDeliveryDays", header: "Avg. Days to Deliver" },
  { key: "deliveredWithTimingCount", header: "Delivered Shipments With Usable Dates" },
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: CourierPerformanceRow[]): string {
  const header = CSV_COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const body = rows.map((row) => CSV_COLUMNS.map((c) => csvEscape(row[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}
