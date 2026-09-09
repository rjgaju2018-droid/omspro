"use client";

// Pending Orders tab (EGS-integration round, 2026-09-04) — mirrors EGS's
// own Pending Orders / /shipment page: a staging list of orders not yet
// booked with any courier, with a Combine/Split view toggle (grouped by
// ref_no_base — the same buyer-batch unit the Invoice Generation module
// already groups by) and a buyer-info-edit modal. "use client" for the
// combine/split toggle, accordion expand state, and the edit modal —
// filtering itself stays a plain GET <form> (server-rendered, same
// pattern as shipments-tracking.tsx) so filters are shareable/bookmarkable
// URLs like every other filter form in this dashboard.
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { PendingOrderRow, PendingOrderBatch, PendingOrdersFilters } from "./pending-orders-data";
import { updateOrderBuyerInfo, bulkUpdateOrderWeightDims, type BuyerInfoEditState, type BulkWeightDimsState } from "./pending-orders-actions";

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";
const inputClass = selectClass;
const editInitial: BuyerInfoEditState = { error: null, success: false };
const bulkWeightDimsInitial: BulkWeightDimsState = { error: null, success: false, results: null };

function dueBadgeClass(due: PendingOrderRow["dueBucket"]): string {
  if (due === "overdue") return "bg-red-100 text-red-700";
  if (due === "due_soon") return "bg-amber-100 text-amber-700";
  if (due === "later") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-500";
}
function dueLabel(due: PendingOrderRow["dueBucket"]): string {
  if (due === "overdue") return "Overdue";
  if (due === "due_soon") return "Due in 2 days";
  if (due === "later") return "2+ days";
  return "No dispatch date set";
}

function BuyerInfoEditModal({ order, onClose }: { order: PendingOrderRow; onClose: () => void }) {
  const [state, action, pending] = useActionState(updateOrderBuyerInfo, editInitial);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Edit Buyer Info — {order.refNo}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>
        {state.success ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Saved.</p>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm">
              Close
            </button>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="order_id" value={order.id} />
            {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Buyer Name & Address</label>
              <textarea name="buyer_name_address" defaultValue={order.buyerNameAddress ?? ""} rows={3} className={`${inputClass} w-full`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Contact No.</label>
                <input name="contact_no" defaultValue={order.contactNo ?? ""} className={`${inputClass} w-full`} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                <input name="email_id" defaultValue={order.emailId ?? ""} className={`${inputClass} w-full`} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Destination Country</label>
              <input name="destination_country" defaultValue={order.destinationCountry ?? ""} className={`${inputClass} w-full`} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Bulk Update Weight/Dims (2026-09-09) — correct/fill weight+dimensions for
// several selected Pending Orders in one save, BEFORE any of them are
// booked with a courier, to stop wrong-weight bookings that only surface
// later as a courier weight-discrepancy charge on the existing Booked vs
// Billed freight reconciliation. Writes through bulkUpdateOrderWeightDims
// (pending-orders-actions.ts) — see that file's header comment for why this
// is orders.weight_kg/length_cm/width_cm/height_cm and not a reuse of
// dispatch_invoices/order_packages/sales_invoices' same-named columns.
//
// Shape: a compact per-order table (each row keeps its own value, so a
// batch of different-sized items can each get their own correction) PLUS a
// one-time "Apply to all rows below" fill-in above it for the common case
// of one box size across the whole selected batch — same plain
// uncontrolled-input / direct-DOM-write style create-shipment-form.tsx's
// handleRecipientPostalBlur already uses in this dashboard, rather than
// lifting every row into React state just for this one convenience button.
function BulkWeightDimsModal({ orders, onClose }: { orders: PendingOrderRow[]; onClose: () => void }) {
  const [state, action, pending] = useActionState(bulkUpdateOrderWeightDims, bulkWeightDimsInitial);
  const orderIdsField = orders.map((o) => o.id).join(",");

  function applyToAll() {
    const w = (document.getElementById("bulk_apply_weight") as HTMLInputElement | null)?.value ?? "";
    const l = (document.getElementById("bulk_apply_length") as HTMLInputElement | null)?.value ?? "";
    const wd = (document.getElementById("bulk_apply_width") as HTMLInputElement | null)?.value ?? "";
    const h = (document.getElementById("bulk_apply_height") as HTMLInputElement | null)?.value ?? "";
    for (const o of orders) {
      if (w) {
        const el = document.getElementById(`w_${o.id}`) as HTMLInputElement | null;
        if (el) el.value = w;
      }
      if (l) {
        const el = document.getElementById(`l_${o.id}`) as HTMLInputElement | null;
        if (el) el.value = l;
      }
      if (wd) {
        const el = document.getElementById(`wd_${o.id}`) as HTMLInputElement | null;
        if (el) el.value = wd;
      }
      if (h) {
        const el = document.getElementById(`h_${o.id}`) as HTMLInputElement | null;
        if (el) el.value = h;
      }
    }
  }

  const successCount = state.results?.filter((r) => !r.error && !r.skipped).length ?? 0;
  const skippedCount = state.results?.filter((r) => r.skipped).length ?? 0;
  const errorRows = state.results?.filter((r) => r.error) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Bulk Update Weight/Dims — {orders.length} order{orders.length === 1 ? "" : "s"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {state.success ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Updated {successCount} order{successCount === 1 ? "" : "s"}
              {skippedCount > 0 ? ` — ${skippedCount} left blank, unchanged.` : "."}
            </p>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm">
              Close
            </button>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="order_ids" value={orderIdsField} />
            {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>}
            {errorRows.length > 0 && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                {successCount} saved. {errorRows.length} row{errorRows.length === 1 ? "" : "s"} failed:
                <ul className="mt-1 list-disc pl-4">
                  {errorRows.map((r) => (
                    <li key={r.orderId}>
                      {r.refNo}: {r.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2.5">
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                Same box size for this whole batch? Type it once and apply to every row below.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Weight (kg)</label>
                  <input id="bulk_apply_weight" type="number" step="0.001" className={`${inputClass} w-24`} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">L (cm)</label>
                  <input id="bulk_apply_length" type="number" step="0.1" className={`${inputClass} w-20`} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">W (cm)</label>
                  <input id="bulk_apply_width" type="number" step="0.1" className={`${inputClass} w-20`} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">H (cm)</label>
                  <input id="bulk_apply_height" type="number" step="0.1" className={`${inputClass} w-20`} />
                </div>
                <button
                  type="button"
                  onClick={applyToAll}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Apply to all rows below
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Ref No.</th>
                    <th className="px-2.5 py-1.5 font-medium">Weight (kg)</th>
                    <th className="px-2.5 py-1.5 font-medium">L (cm)</th>
                    <th className="px-2.5 py-1.5 font-medium">W (cm)</th>
                    <th className="px-2.5 py-1.5 font-medium">H (cm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="px-2.5 py-1.5 font-medium text-slate-700">{o.refNo}</td>
                      <td className="px-2.5 py-1">
                        <input
                          id={`w_${o.id}`}
                          name={`weight_kg__${o.id}`}
                          type="number"
                          step="0.001"
                          defaultValue={o.weightKg ?? ""}
                          className={`${inputClass} w-24`}
                        />
                      </td>
                      <td className="px-2.5 py-1">
                        <input id={`l_${o.id}`} name={`length_cm__${o.id}`} type="number" step="0.1" defaultValue={o.lengthCm ?? ""} className={`${inputClass} w-20`} />
                      </td>
                      <td className="px-2.5 py-1">
                        <input id={`wd_${o.id}`} name={`width_cm__${o.id}`} type="number" step="0.1" defaultValue={o.widthCm ?? ""} className={`${inputClass} w-20`} />
                      </td>
                      <td className="px-2.5 py-1">
                        <input id={`h_${o.id}`} name={`height_cm__${o.id}`} type="number" step="0.1" defaultValue={o.heightCm ?? ""} className={`${inputClass} w-20`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400">
              A row left completely blank is skipped — its existing weight/dims (if any) stay unchanged.
            </p>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {pending ? "Saving..." : `Save ${orders.length} Order${orders.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  selected,
  onToggleSelect,
  onEdit,
  onBook,
}: {
  order: PendingOrderRow;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onBook: () => void;
}) {
  return (
    <tr className={selected ? "bg-amber-50/60" : undefined}>
      <td className="px-3 py-2">
        <input type="checkbox" checked={selected} onChange={onToggleSelect} aria-label={`Select ${order.refNo}`} />
      </td>
      <td className="px-3 py-2 font-medium text-slate-800">{order.refNo}</td>
      <td className="px-3 py-2">{order.orderDate}</td>
      <td className="px-3 py-2">{order.marketplaceOrderNo ?? "—"}</td>
      <td className="px-3 py-2">
        <div className="max-w-[220px] truncate" title={order.buyerNameAddress ?? ""}>
          {order.buyerNameAddress ?? "—"}
        </div>
        <div className="text-slate-400">{order.contactNo ?? "—"}</div>
      </td>
      <td className="px-3 py-2">{order.destinationCountry ?? "—"}</td>
      <td className="px-3 py-2">
        {order.skuLabel ?? "—"} × {order.qty}
      </td>
      <td className="px-3 py-2">{order.orderValueInr != null ? `₹${order.orderValueInr.toFixed(2)}` : "—"}</td>
      <td className="px-3 py-2">
        {/* 2026-09-09: quick pre-booking weight visibility, no new column —
            same table stays 9 data columns wide; this piggybacks on the
            existing Due cell instead of crowding in an 11th header. */}
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${dueBadgeClass(order.dueBucket)}`}>{dueLabel(order.dueBucket)}</span>
        {order.weightKg != null && <div className="mt-0.5 text-[10px] text-slate-400">⚖ {order.weightKg} kg</div>}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <button type="button" onClick={onEdit} className="text-xs font-medium text-slate-500 hover:text-slate-800">
            ✏️ Edit
          </button>
          <button type="button" onClick={onBook} className="text-xs font-semibold text-amber-700 hover:underline">
            📦 Book
          </button>
        </div>
      </td>
    </tr>
  );
}

function tableHead(allSelected: boolean, someSelected: boolean, onToggleAll: () => void) {
  return (
    <thead className="bg-slate-50 text-slate-500">
      <tr>
        <th className="px-3 py-2 font-medium">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={onToggleAll}
            aria-label="Select all visible orders"
          />
        </th>
        <th className="px-3 py-2 font-medium">Ref No.</th>
        <th className="px-3 py-2 font-medium">Order Date</th>
        <th className="px-3 py-2 font-medium">Marketplace Order No.</th>
        <th className="px-3 py-2 font-medium">Buyer</th>
        <th className="px-3 py-2 font-medium">Destination</th>
        <th className="px-3 py-2 font-medium">SKU × Qty</th>
        <th className="px-3 py-2 font-medium">Value</th>
        <th className="px-3 py-2 font-medium">Due</th>
        <th className="px-3 py-2 font-medium">Actions</th>
      </tr>
    </thead>
  );
}

export function PendingOrders({ rows, batches, filters }: { rows: PendingOrderRow[]; batches: PendingOrderBatch[]; filters: PendingOrdersFilters }) {
  const router = useRouter();
  const [view, setView] = useState<"combine" | "split">("split");
  const [editingOrder, setEditingOrder] = useState<PendingOrderRow | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 2026-09-09 — Bulk Update Weight/Dims selection. One Set shared across
  // Split/Combine view (both render the same underlying PendingOrderRow
  // objects by id, just grouped differently), so switching views mid-
  // selection doesn't lose it.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkWeightDims, setShowBulkWeightDims] = useState(false);
  const MAX_BULK_SELECT = 100; // mirrors bulkUpdateOrderWeightDims's own server-side cap

  function goBook(refNo: string, combinedOrderIds: string[]) {
    const params = new URLSearchParams({ tab: "book", book_ref_no: refNo });
    if (combinedOrderIds.length > 0) params.set("book_combined_ids", combinedOrderIds.join(","));
    router.push(`/dashboard/courier-booking?${params.toString()}`);
  }

  function toggleExpand(refNoBase: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(refNoBase)) next.delete(refNoBase);
      else next.add(refNoBase);
      return next;
    });
  }

  function toggleSelect(orderId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function toggleSelectAll(list: PendingOrderRow[]) {
    setSelected((prev) => {
      const allIn = list.every((o) => prev.has(o.id));
      const next = new Set(prev);
      for (const o of list) {
        if (allIn) next.delete(o.id);
        else next.add(o.id);
      }
      return next;
    });
  }

  const selectedOrders = rows.filter((o) => selected.has(o.id));

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="pending" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Order Date From</label>
          <input type="date" name="date_from" defaultValue={filters.dateFrom ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Order Date To</label>
          <input type="date" name="date_to" defaultValue={filters.dateTo ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Due</label>
          <select name="due" defaultValue={filters.due ?? ""} className={selectClass}>
            <option value="">All</option>
            <option value="overdue">Overdue</option>
            <option value="due_soon">In 2 days</option>
            <option value="later">2+ days</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Destination Country</label>
          <input name="destination_country" defaultValue={filters.destinationCountry ?? ""} placeholder="e.g. USA" className={inputClass} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="mb-1 block text-xs font-medium text-slate-500">Search (Ref No. / Order No. / Buyer / Contact)</label>
          <input name="q" defaultValue={filters.q ?? ""} className={`${inputClass} w-full`} />
        </div>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filter
        </button>
      </form>

      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium text-slate-600">Show Orders:</span>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={view === "split"} onChange={() => setView("split")} /> Split (one row per order)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={view === "combine"} onChange={() => setView("combine")} /> Combine (group by buyer-batch)
        </label>
        <span className="ml-auto text-xs text-slate-400">{rows.length} pending order{rows.length === 1 ? "" : "s"}</span>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <span className="font-medium text-amber-800">
            {selected.size} order{selected.size === 1 ? "" : "s"} selected
          </span>
          {selected.size > MAX_BULK_SELECT && (
            <span className="text-red-700">Bulk Update supports up to {MAX_BULK_SELECT} at a time — deselect a few first.</span>
          )}
          <button
            type="button"
            disabled={selected.size > MAX_BULK_SELECT}
            onClick={() => setShowBulkWeightDims(true)}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ⚖ Bulk Update Weight/Dims
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-slate-500 hover:underline">
            Clear selection
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">No pending orders match — try clearing a filter.</p>
      ) : view === "split" ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            {tableHead(
              rows.length > 0 && rows.every((o) => selected.has(o.id)),
              rows.some((o) => selected.has(o.id)),
              () => toggleSelectAll(rows)
            )}
            <tbody className="divide-y divide-slate-100">
              {rows.map((o) => (
                <OrderRow
                  key={o.id}
                  order={o}
                  selected={selected.has(o.id)}
                  onToggleSelect={() => toggleSelect(o.id)}
                  onEdit={() => setEditingOrder(o)}
                  onBook={() => goBook(o.refNo, [])}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {batches.map((batch) => {
            const isOpen = expanded.has(batch.refNoBase);
            const totalValue = batch.orders.reduce((sum, o) => sum + (o.orderValueInr ?? 0), 0);
            return (
              <div key={batch.refNoBase} className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-3 py-2">
                  <button type="button" onClick={() => toggleExpand(batch.refNoBase)} className="flex-1 text-left text-sm font-medium text-slate-800">
                    {isOpen ? "▾" : "▸"} {batch.refNoBase} — {batch.orders.length} order{batch.orders.length === 1 ? "" : "s"} — ₹{totalValue.toFixed(2)}
                  </button>
                  {batch.orders.length > 1 && (
                    <button
                      type="button"
                      onClick={() => goBook(batch.orders[0].refNo, batch.orders.slice(1).map((o) => o.id))}
                      className="ml-3 whitespace-nowrap text-xs font-semibold text-amber-700 hover:underline"
                    >
                      📦 Combine & Book all {batch.orders.length}
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-left text-xs">
                      {tableHead(
                        batch.orders.every((o) => selected.has(o.id)),
                        batch.orders.some((o) => selected.has(o.id)),
                        () => toggleSelectAll(batch.orders)
                      )}
                      <tbody className="divide-y divide-slate-100">
                        {batch.orders.map((o) => (
                          <OrderRow
                            key={o.id}
                            order={o}
                            selected={selected.has(o.id)}
                            onToggleSelect={() => toggleSelect(o.id)}
                            onEdit={() => setEditingOrder(o)}
                            onBook={() => goBook(o.refNo, [])}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingOrder && <BuyerInfoEditModal order={editingOrder} onClose={() => setEditingOrder(null)} />}
      {showBulkWeightDims && selectedOrders.length > 0 && (
        <BulkWeightDimsModal
          orders={selectedOrders}
          onClose={() => {
            setShowBulkWeightDims(false);
            setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
