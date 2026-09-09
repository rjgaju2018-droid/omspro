"use server";

// Pending Orders tab (EGS-integration round, 2026-09-04) — the
// buyer-info-edit modal (EGS's own Pending Orders page has one: address/
// contact fields, editable inline before booking). Deliberately a small,
// FOCUSED action touching only the fields that modal edits — NOT a
// reimplementation of orders/actions.ts's updateOrder (the full Order Edit
// form), which also recomputes currency conversion and touches many more
// fields this modal never shows. Same requireCapability gate as the rest
// of this dashboard (courier_booking_shipment — booking staff, not full
// Order Entry access, are exactly who uses this tab).
import { requireCapability } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log-audit";
import { revalidatePath } from "next/cache";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v ? v : null;
}
function numOrNull(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type BuyerInfoEditState = { error: string | null; success: boolean };
const INITIAL: BuyerInfoEditState = { error: null, success: false };

export async function updateOrderBuyerInfo(_prev: BuyerInfoEditState, formData: FormData): Promise<BuyerInfoEditState> {
  const employee = await requireCapability("courier_booking_shipment");
  const supabase = createServiceRoleClient();

  const orderId = str(formData, "order_id");
  if (!orderId) return { ...INITIAL, error: "Missing order." };

  const { error } = await supabase
    .from("orders")
    .update({
      buyer_name_address: strOrNull(formData, "buyer_name_address"),
      contact_no: strOrNull(formData, "contact_no"),
      email_id: strOrNull(formData, "email_id"),
      destination_country: strOrNull(formData, "destination_country"),
    })
    .eq("id", orderId)
    .in("company_id", employee.companyIds);

  if (error) return { ...INITIAL, error: error.message };
  revalidatePath("/dashboard/courier-booking");
  return { error: null, success: true };
}

// -----------------------------------------------------------------------
// Bulk Update Weight/Dims (2026-09-09) — the pre-booking correction the
// business asked for: fix/fill weight+dimensions for several selected
// Pending Orders in one save, BEFORE any of them get booked with a courier,
// to stop wrong-weight bookings that only surface later as a courier
// weight-discrepancy charge on the existing Booked vs Billed freight
// reconciliation (documents/freight-bill-section.tsx and friends).
//
// Writes orders.weight_kg/length_cm/width_cm/height_cm directly — see
// db/2026-09-09-order-weight-dims-bulk.sql's header for why this is a new
// column set rather than reusing dispatch_invoices/order_packages/
// sales_invoices' own same-named columns (each is a distinct, deliberately
// separate value already, per that migration's investigation). This is a
// genuinely NEW mechanism, not an extension of an existing one — no
// pre-booking, order-level weight/dims writer existed anywhere in this
// codebase before this round (confirmed by reading pending-orders.tsx,
// create-shipment-form.tsx/actions.ts, and every table in db/schema.sql
// that stores a weight_kg/length_cm/width_cm/height_cm shape). It's built
// as the same small, FOCUSED "use server" shape as updateOrderBuyerInfo
// just above — same capability gate, same company-scoping, same
// revalidatePath — just accepting N order ids instead of one, and each row
// gets its OWN weight/dims values (the modal's "Apply to all rows below"
// button is a client-side convenience for the common "one box size for the
// whole batch" case — see BulkWeightDimsModal in pending-orders.tsx — not a
// separate server code path).
//
// Field-naming convention: one FormData field per (orderId, column) pair —
// `weight_kg__<orderId>` etc — since FormData has no native nested-array
// shape and this avoids inventing a JSON-blob-in-a-hidden-input convention
// this codebase doesn't otherwise use anywhere.
//
// A selected row left COMPLETELY blank (all 4 fields empty) is treated as
// "didn't want to touch this one" and skipped with no write — protects
// against accidentally blanking out an order's existing weight/dims just
// because it was swept up in a bulk selection. Any row with at least one
// field filled in is a FULL replace of all 4 columns (same semantics as
// updateOrderBuyerInfo above — the modal always shows the current value as
// defaultValue, so a blank field the employee can see is an intentional
// clear, not an accidental one).
export type BulkWeightDimsRowResult = {
  orderId: string;
  refNo: string;
  skipped: boolean;
  error: string | null;
};
export type BulkWeightDimsState = {
  error: string | null;
  success: boolean;
  results: BulkWeightDimsRowResult[] | null;
};
const BULK_WEIGHT_DIMS_INITIAL: BulkWeightDimsState = { error: null, success: false, results: null };
const MAX_BULK_WEIGHT_DIMS_ROWS = 100; // sane cap, same order of magnitude as bulk-tracking-update's MAX_ROWS guard rail

export async function bulkUpdateOrderWeightDims(_prev: BulkWeightDimsState, formData: FormData): Promise<BulkWeightDimsState> {
  const employee = await requireCapability("courier_booking_shipment");
  const supabase = createServiceRoleClient();

  const orderIds = Array.from(
    new Set(
      str(formData, "order_ids")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
  if (orderIds.length === 0) return { ...BULK_WEIGHT_DIMS_INITIAL, error: "No orders selected." };
  if (orderIds.length > MAX_BULK_WEIGHT_DIMS_ROWS) {
    return { ...BULK_WEIGHT_DIMS_INITIAL, error: `${orderIds.length} orders selected — please update ${MAX_BULK_WEIGHT_DIMS_ROWS} or fewer at a time.` };
  }

  // Batched lookup + company-scope check up front (same shape as
  // bulk-tracking-update/actions.ts's ordersByRefNo pass) — an id that
  // doesn't resolve here (wrong company, deleted since the page loaded)
  // reports as a per-row error instead of silently succeeding or throwing.
  const { data: existing, error: lookupError } = await supabase
    .from("orders")
    .select("id, ref_no")
    .in("id", orderIds)
    .in("company_id", employee.companyIds);
  if (lookupError) return { ...BULK_WEIGHT_DIMS_INITIAL, error: `Order lookup failed: ${lookupError.message}` };
  const byId = new Map((existing ?? []).map((o) => [o.id, o.ref_no]));

  const results: BulkWeightDimsRowResult[] = new Array(orderIds.length);
  const CHUNK_SIZE = 20;
  for (let c = 0; c < orderIds.length; c += CHUNK_SIZE) {
    const chunk = orderIds.slice(c, c + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (orderId, offset) => {
        const index = c + offset;
        const refNo = byId.get(orderId);
        if (!refNo) {
          results[index] = { orderId, refNo: orderId, skipped: false, error: "Order not found (or not in a company you can access)." };
          return;
        }

        const weightKg = numOrNull(formData, `weight_kg__${orderId}`);
        const lengthCm = numOrNull(formData, `length_cm__${orderId}`);
        const widthCm = numOrNull(formData, `width_cm__${orderId}`);
        const heightCm = numOrNull(formData, `height_cm__${orderId}`);

        if (weightKg == null && lengthCm == null && widthCm == null && heightCm == null) {
          results[index] = { orderId, refNo, skipped: true, error: null };
          return;
        }

        const { error } = await supabase
          .from("orders")
          .update({ weight_kg: weightKg, length_cm: lengthCm, width_cm: widthCm, height_cm: heightCm })
          .eq("id", orderId);

        results[index] = { orderId, refNo, skipped: false, error: error?.message ?? null };
      })
    );
  }

  const updatedRefNos = results.filter((r) => !r.error && !r.skipped).map((r) => r.refNo);
  if (updatedRefNos.length > 0) {
    await logAudit(supabase, {
      companyId: employee.currentCompanyId,
      employeeId: employee.id,
      employeeName: employee.name,
      action: "order.bulk_weight_dims_updated",
      entityType: "order",
      entityLabel: `${updatedRefNos.length} order(s)`,
      changes: { refNos: updatedRefNos },
    });
  }

  revalidatePath("/dashboard/courier-booking");
  return { error: null, success: results.every((r) => !r.error), results };
}
