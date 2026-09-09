"use client";

import { useMemo, useState, useTransition } from "react";
import { COURIERS, type CourierKey } from "@/lib/couriers/credentials";
import type { CourierPerformanceRow, CourierPerformanceFilters } from "./courier-performance-data";
import { exportCourierPerformanceCsv } from "./courier-performance-actions";

const selectClass =
  "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type SortKey = "courierLabel" | "destinationCountry" | "shipmentCount" | "successRatePct" | "avgDeliveryDays";

// Rows where a courier is the best-delivering option for a given
// destination country, among couriers with at least MIN_FOR_BEST_BADGE
// shipments to that country there — flagging a "best courier" off of 1-2
// shipments would be misleading, not helpful.
const MIN_FOR_BEST_BADGE = 5;

export function CourierPerformanceReport({
  rows,
  filters,
  shipmentsMatched,
  rowCapHit,
}: {
  rows: CourierPerformanceRow[];
  filters: CourierPerformanceFilters;
  shipmentsMatched: number;
  rowCapHit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("shipmentCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleExport() {
    setExportError(null);
    startTransition(async () => {
      const result = await exportCourierPerformanceCsv(filters);
      if (result.error || !result.csv) {
        setExportError(result.error ?? "Export failed.");
        return;
      }
      downloadCsv(result.csv, `courier-performance-by-country-${new Date().toISOString().slice(0, 10)}.csv`);
    });
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const bestCourierByCountry = useMemo(() => {
    const best = new Map<string, { courier: CourierKey | "other"; rate: number }>();
    for (const r of rows) {
      if (r.shipmentCount < MIN_FOR_BEST_BADGE || r.successRatePct === null) continue;
      const current = best.get(r.destinationCountry);
      if (!current || r.successRatePct > current.rate) best.set(r.destinationCountry, { courier: r.courier, rate: r.successRatePct });
    }
    return best;
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else {
        const an = av === null ? -Infinity : Number(av);
        const bn = bv === null ? -Infinity : Number(bv);
        cmp = an - bn;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const totalDelivered = rows.reduce((sum, r) => sum + r.deliveredCount, 0);
  const totalShipments = rows.reduce((sum, r) => sum + r.shipmentCount, 0);
  const lowDataWarning = shipmentsMatched > 0 && shipmentsMatched < 20;

  function sortHeader(key: SortKey, label: string) {
    const active = sortKey === key;
    return (
      <th
        className="cursor-pointer select-none px-3 py-2 font-medium hover:text-slate-800"
        onClick={() => toggleSort(key)}
        title="Click to sort"
      >
        {label}
        {active && <span className="ml-1 text-slate-400">{sortDir === "desc" ? "▼" : "▲"}</span>}
      </th>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        One row per courier + destination country, aggregated from real booked shipments (courier_shipments + order_shipments delivery
        tracking) — use this to compare which courier actually delivers best, and fastest, to a given country. Click a column header to
        sort.
      </p>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="performance" />
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Booked From</label>
          <input type="date" name="perf_date_from" defaultValue={filters.dateFrom ?? ""} className={selectClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Booked To</label>
          <input type="date" name="perf_date_to" defaultValue={filters.dateTo ?? ""} className={selectClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Courier</label>
          <select name="perf_courier" defaultValue={filters.courier ?? ""} className={selectClass}>
            <option value="">All</option>
            {COURIERS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
            <option value="other">Other (manual entry)</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Destination Country</label>
          <input name="perf_destination_country" defaultValue={filters.destinationCountry ?? ""} className={selectClass} />
        </div>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filter
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={isPending}
          className="ml-auto rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {isPending ? "Preparing..." : "⬇ Download All (CSV)"}
        </button>
      </form>

      {exportError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{exportError}</p>}
      {rowCapHit && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Scanned the most recent {shipmentsMatched.toLocaleString()}+ booked shipments and stopped there — narrow the date range to make
          sure this covers everything you want compared.
        </p>
      )}
      {lowDataWarning && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Only {shipmentsMatched} booked shipment{shipmentsMatched === 1 ? "" : "s"} match these filters so far — the comparison below
          will get more meaningful as more shipments are booked and tracked through to delivery. Numbers shown are real, not
          estimated/filled-in.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          No booked shipments match — try clearing a filter, or check back after some shipments have been booked and delivered.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {sortHeader("courierLabel", "Courier")}
                  {sortHeader("destinationCountry", "Destination Country")}
                  {sortHeader("shipmentCount", "Shipments")}
                  <th className="px-3 py-2 font-medium">Delivered</th>
                  <th className="px-3 py-2 font-medium">Returned/Cancelled</th>
                  <th className="px-3 py-2 font-medium">In Transit/Pending</th>
                  {sortHeader("successRatePct", "Delivery Success Rate")}
                  {sortHeader("avgDeliveryDays", "Avg. Days to Deliver")}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((r, i) => {
                  const isBest = bestCourierByCountry.get(r.destinationCountry)?.courier === r.courier;
                  return (
                    <tr key={`${r.courier}-${r.courierLabel}-${r.destinationCountry}-${i}`} className={isBest ? "bg-emerald-50/60" : ""}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {r.courierLabel}
                        {isBest && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Best for this country
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{r.destinationCountry}</td>
                      <td className="px-3 py-2">{r.shipmentCount}</td>
                      <td className="px-3 py-2">{r.deliveredCount}</td>
                      <td className="px-3 py-2">{r.returnedCancelledCount}</td>
                      <td className="px-3 py-2">{r.inTransitOrOtherCount}</td>
                      <td className="px-3 py-2">
                        {r.successRatePct !== null ? (
                          <span className="font-medium">{r.successRatePct.toFixed(1)}%</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {r.avgDeliveryDays !== null ? (
                          <>
                            {r.avgDeliveryDays.toFixed(1)} days
                            <span className="ml-1 text-slate-400">(n={r.deliveredWithTimingCount})</span>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">
            {rows.length} courier + country combination{rows.length === 1 ? "" : "s"} across {totalShipments.toLocaleString()} booked
            shipment{totalShipments === 1 ? "" : "s"} ({totalDelivered.toLocaleString()} delivered so far). &quot;Best for this
            country&quot; only appears where a courier has at least {MIN_FOR_BEST_BADGE} shipments to that country — too few to call a
            winner below that. Avg. Days to Deliver is booking date → delivered date, from real courier tracking updates only (n = how
            many delivered shipments actually had both dates to compute from).
          </p>
        </>
      )}
    </div>
  );
}
