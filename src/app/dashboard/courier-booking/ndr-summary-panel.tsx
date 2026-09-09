import Link from "next/link";
import { COURIERS } from "@/lib/couriers/credentials";
import type { NdrSummary } from "./ndr-summary-data";

// NDR tab on the Courier Ops Dashboard — reason-wise breakdown tiles +
// the full unresolved queue, each row linking to that shipment's detail
// page where staff actually resolve it (see shipment/ndr-panel.tsx).
// Server Component — this tab's data is fetched once in page.tsx like
// every other tab here; no client interactivity needed on this list
// itself (resolving happens on the shipment detail page).
function reasonBadgeClass(reason: string): string {
  if (reason === "Refused") return "bg-red-100 text-red-700";
  if (reason === "Weather/Force Majeure") return "bg-sky-100 text-sky-700";
  if (reason === "Customer Unavailable") return "bg-amber-100 text-amber-700";
  if (reason === "Address Issue") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-600";
}

export function NdrSummaryPanel({ summary }: { summary: NdrSummary }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">NDR Summary — Unresolved</h2>
        <p className="mb-3 text-xs text-slate-400">
          Every failed-delivery-attempt entry logged against a shipment (see each shipment&apos;s own detail page) that hasn&apos;t been marked
          resolved yet. Manually entered by staff when a courier reports a failed attempt — not auto-parsed from any courier&apos;s tracking/webhook.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <p className="text-lg font-semibold text-slate-900">{summary.totalUnresolved}</p>
            <p className="text-[11px] text-slate-500">Total Unresolved</p>
          </div>
          {summary.byReason.map((r) => (
            <div key={r.reason} className="rounded-lg border border-slate-200 p-3 text-center">
              <p className="text-lg font-semibold text-slate-900">{r.count}</p>
              <p className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${reasonBadgeClass(r.reason)}`}>{r.reason}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Unresolved NDR Attempts</h2>
        {summary.rows.length === 0 ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">No unresolved NDRs right now. 🎉</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Ref No.</th>
                  <th className="px-3 py-2 font-medium">Courier</th>
                  <th className="px-3 py-2 font-medium">AWB</th>
                  <th className="px-3 py-2 font-medium">Attempt #</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Attempted</th>
                  <th className="px-3 py-2 font-medium">Logged By</th>
                  <th className="px-3 py-2 font-medium">Resolve</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/orders/${r.orderId}`} className="font-medium text-amber-700 hover:underline">
                        {r.refNo}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {r.courier === "other" ? `${r.manualCourierName ?? "Other"} (manual)` : COURIERS.find((c) => c.key === r.courier)?.label ?? r.courier}
                    </td>
                    <td className="px-3 py-2">{r.awbNo ?? "—"}</td>
                    <td className="px-3 py-2">{r.attemptNo}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${reasonBadgeClass(r.reason)}`}>{r.reason}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-[220px] truncate" title={r.note ?? undefined}>
                        {r.note ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.attemptedAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{r.loggedByName}</td>
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/courier-booking/shipment/${r.courierShipmentId}`} className="font-medium text-amber-700 hover:underline">
                        View & Resolve →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
