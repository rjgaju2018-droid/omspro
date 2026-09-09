"use client";

import { Fragment, useState } from "react";
import { ExportBar } from "@/components/export-bar";
import type { ExportColumn } from "@/lib/export/export-table";
import { PrintArea } from "@/components/print-view";
import type { EtsyFeeMatch, EbayFeeMatch, AmazonFeeMatch } from "@/lib/orders/marketplace-fees";

export type ByOrderRow = {
  orderId: string;
  refNo: string | null;
  orderDate: string | null;
  companyName: string;
  storeName: string;
  status: string;
  marketplaceOrderNo: string | null;
  etsy: EtsyFeeMatch | null;
  ebay: EbayFeeMatch | null;
  amazon: AmazonFeeMatch | null;
};

export type MonthlyRow = { month: string; orderCount: number; etsyInr: number; ebayUsd: number; amazonText: string };
export type StoreRow = { storeName: string; orderCount: number; etsyInr: number; ebayUsd: number; amazonText: string };

function amazonMatchText(m: AmazonFeeMatch | null): string {
  if (!m) return "";
  return m.totalsByCurrency.map((t) => `${t.totalFees.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${t.currency}`).join(", ");
}

const BY_ORDER_COLUMNS: ExportColumn<ByOrderRow>[] = [
  { key: "orderDate", label: "Order Date", value: (r) => r.orderDate },
  { key: "refNo", label: "PO No.", value: (r) => r.refNo },
  { key: "companyName", label: "Company", value: (r) => r.companyName },
  { key: "storeName", label: "Store", value: (r) => r.storeName },
  { key: "marketplaceOrderNo", label: "Marketplace Order No.", value: (r) => r.marketplaceOrderNo },
  { key: "status", label: "Status", value: (r) => r.status },
  { key: "etsyInr", label: "Etsy Fee (₹)", value: (r) => (r.etsy ? r.etsy.totalFeesInr.toFixed(2) : "") },
  { key: "ebayUsd", label: "eBay Fee ($)", value: (r) => (r.ebay ? r.ebay.totalFeesUsd.toFixed(2) : "") },
  { key: "amazonFee", label: "Amazon Fee", value: (r) => amazonMatchText(r.amazon) },
];

const MONTHLY_COLUMNS: ExportColumn<MonthlyRow>[] = [
  { key: "month", label: "Month", value: (r) => r.month },
  { key: "orderCount", label: "Orders w/ matched fee", value: (r) => r.orderCount },
  { key: "etsyInr", label: "Etsy Fee (₹)", value: (r) => r.etsyInr.toFixed(2) },
  { key: "ebayUsd", label: "eBay Fee ($)", value: (r) => r.ebayUsd.toFixed(2) },
  { key: "amazonText", label: "Amazon Fee", value: (r) => r.amazonText },
];

const STORE_COLUMNS: ExportColumn<StoreRow>[] = [
  { key: "storeName", label: "Store", value: (r) => r.storeName },
  { key: "orderCount", label: "Orders w/ matched fee", value: (r) => r.orderCount },
  { key: "etsyInr", label: "Etsy Fee (₹)", value: (r) => r.etsyInr.toFixed(2) },
  { key: "ebayUsd", label: "eBay Fee ($)", value: (r) => r.ebayUsd.toFixed(2) },
  { key: "amazonText", label: "Amazon Fee", value: (r) => r.amazonText },
];

type Tab = "byOrder" | "monthly" | "store";

export function StoreExpenseReportTable({
  companies,
  stores,
  filters,
  byOrderRows,
  monthlyRows,
  storeRows,
}: {
  companies: { id: string; name: string }[];
  stores: { id: string; name: string; company_id: string }[];
  filters: { companyId: string; storeId: string; fromDate: string; toDate: string; q: string };
  byOrderRows: ByOrderRow[];
  monthlyRows: MonthlyRow[];
  storeRows: StoreRow[];
}) {
  const [tab, setTab] = useState<Tab>("byOrder");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";
  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-amber-500 text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`;

  const monthlyTotals = monthlyRows.reduce(
    (acc, r) => ({ orderCount: acc.orderCount + r.orderCount, etsyInr: acc.etsyInr + r.etsyInr, ebayUsd: acc.ebayUsd + r.ebayUsd }),
    { orderCount: 0, etsyInr: 0, ebayUsd: 0 }
  );
  const storeTotals = storeRows.reduce(
    (acc, r) => ({ orderCount: acc.orderCount + r.orderCount, etsyInr: acc.etsyInr + r.etsyInr, ebayUsd: acc.ebayUsd + r.ebayUsd }),
    { orderCount: 0, etsyInr: 0, ebayUsd: 0 }
  );

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="q">Search (PO/Order No.)</label>
          <input id="q" name="q" defaultValue={filters.q} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="from">From</label>
          <input id="from" name="from" type="date" defaultValue={filters.fromDate} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="to">To</label>
          <input id="to" name="to" type="date" defaultValue={filters.toDate} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="company">Company</label>
          <select id="company" name="company" defaultValue={filters.companyId} className={inputClass}>
            <option value="">All</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="store">Store</label>
          <select id="store" name="store" defaultValue={filters.storeId} className={inputClass}>
            <option value="">All</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600">
          Filter
        </button>
        <a href="/dashboard/reports/store-expenses" className="text-xs text-slate-400 underline">Clear</a>
      </form>

      <div className="flex gap-2 print:hidden">
        <button type="button" className={tabClass(tab === "byOrder")} onClick={() => setTab("byOrder")}>By Order</button>
        <button type="button" className={tabClass(tab === "monthly")} onClick={() => setTab("monthly")}>Monthly</button>
        <button type="button" className={tabClass(tab === "store")} onClick={() => setTab("store")}>Store-wise</button>
      </div>

      {tab === "byOrder" && (
        <PrintArea id="store-expense-byorder-print">
          <div className="mb-2 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold text-slate-700">
              By Order — {byOrderRows.length} order{byOrderRows.length === 1 ? "" : "s"} with a matched fee
            </h2>
            <ExportBar title="Store Expense — By Order" filenameBase="store-expense-by-order" columns={BY_ORDER_COLUMNS} rows={byOrderRows} printAreaId="store-expense-byorder-print" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">Order Date</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">PO No.</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">Store</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">Marketplace Order No.</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">Status</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-slate-500">Etsy Fee (₹)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-slate-500">eBay Fee ($)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-slate-500">Amazon Fee</th>
                  <th className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500 print:hidden"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {byOrderRows.map((r) => (
                  <Fragment key={r.orderId}>
                    <tr className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">{r.orderDate ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-800">{r.refNo ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.storeName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.marketplaceOrderNo ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.status}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-indigo-700">{r.etsy ? r.etsy.totalFeesInr.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-purple-700">{r.ebay ? r.ebay.totalFeesUsd.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-orange-700">{amazonMatchText(r.amazon) || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 print:hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === r.orderId ? null : r.orderId)}
                          className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                        >
                          {expandedId === r.orderId ? "▲" : "▾"}
                        </button>
                      </td>
                    </tr>
                    {expandedId === r.orderId && (
                      <tr className="bg-slate-50/60">
                        <td colSpan={9} className="px-3 py-3 print:hidden">
                          <div className="space-y-3">
                            {r.etsy && <FeeLinesTable title="Etsy" color="indigo" columns={["Date", "Type", "Title / Info", "Amount", "Fees & Taxes", "Net"]} rows={r.etsy.lines.map((l) => [l.date ?? "—", l.type ?? "—", l.title || l.info || "—", l.amount.toLocaleString("en-IN"), l.fees.toLocaleString("en-IN"), l.net.toLocaleString("en-IN")])} />}
                            {r.ebay && <FeeLinesTable title="eBay" color="purple" columns={["Date", "Fee Type", "Description / Memo", "Amount"]} rows={r.ebay.lines.map((l) => [l.date ?? "—", l.type ?? "—", l.description || l.memo || "—", l.amount.toLocaleString("en-US")])} />}
                            {r.amazon && <FeeLinesTable title="Amazon" color="orange" columns={["Date", "Type", "Product", "Amazon Fees", "Currency"]} rows={r.amazon.lines.map((l) => [l.date ?? "—", l.type ?? "—", l.productDetails ?? "—", l.amazonFees.toLocaleString("en-US"), l.currency])} />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {byOrderRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                      No matched marketplace fees for this filter. Either no orders in range matched a marketplace order
                      number, or the corresponding Etsy/eBay/Amazon statement for those orders hasn&apos;t been imported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </PrintArea>
      )}

      {tab === "monthly" && (
        <PrintArea id="store-expense-monthly-print">
          <div className="mb-2 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold text-slate-700">Monthly Roll-up</h2>
            <ExportBar title="Store Expense — Monthly" filenameBase="store-expense-monthly" columns={MONTHLY_COLUMNS} rows={monthlyRows} printAreaId="store-expense-monthly-print" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {MONTHLY_COLUMNS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyRows.map((r) => (
                  <tr key={r.month} className="hover:bg-slate-50">
                    {MONTHLY_COLUMNS.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700">{String(c.value(r) ?? "")}</td>
                    ))}
                  </tr>
                ))}
                {monthlyRows.length === 0 && (
                  <tr>
                    <td colSpan={MONTHLY_COLUMNS.length} className="px-3 py-8 text-center text-slate-400">No matched fees in this range.</td>
                  </tr>
                )}
              </tbody>
              {monthlyRows.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2">{monthlyTotals.orderCount}</td>
                    <td className="px-3 py-2">{monthlyTotals.etsyInr.toFixed(2)}</td>
                    <td className="px-3 py-2">{monthlyTotals.ebayUsd.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs font-normal text-slate-400">Amazon totals not summed across months (mixed currencies) — see each row.</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </PrintArea>
      )}

      {tab === "store" && (
        <PrintArea id="store-expense-store-print">
          <div className="mb-2 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold text-slate-700">Store-wise Roll-up</h2>
            <ExportBar title="Store Expense — Store-wise" filenameBase="store-expense-store-wise" columns={STORE_COLUMNS} rows={storeRows} printAreaId="store-expense-store-print" />
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {STORE_COLUMNS.map((c) => (
                    <th key={c.key} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-500">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {storeRows.map((r) => (
                  <tr key={r.storeName} className="hover:bg-slate-50">
                    {STORE_COLUMNS.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-slate-700">{String(c.value(r) ?? "")}</td>
                    ))}
                  </tr>
                ))}
                {storeRows.length === 0 && (
                  <tr>
                    <td colSpan={STORE_COLUMNS.length} className="px-3 py-8 text-center text-slate-400">No matched fees in this range.</td>
                  </tr>
                )}
              </tbody>
              {storeRows.length > 0 && (
                <tfoot className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2">{storeTotals.orderCount}</td>
                    <td className="px-3 py-2">{storeTotals.etsyInr.toFixed(2)}</td>
                    <td className="px-3 py-2">{storeTotals.ebayUsd.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs font-normal text-slate-400">Amazon totals not summed across stores (mixed currencies) — see each row.</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </PrintArea>
      )}
    </div>
  );
}

function FeeLinesTable({
  title,
  color,
  columns,
  rows,
}: {
  title: string;
  color: "indigo" | "purple" | "orange";
  columns: string[];
  rows: string[][];
}) {
  const borderClass = { indigo: "border-indigo-100 bg-indigo-50/50", purple: "border-purple-100 bg-purple-50/50", orange: "border-orange-100 bg-orange-50/50" }[color];
  const textClass = { indigo: "text-indigo-700", purple: "text-purple-700", orange: "text-orange-700" }[color];
  return (
    <div>
      <p className={`mb-1 text-xs font-semibold ${textClass}`}>🧾 {title} fees matched: {rows.length} line{rows.length === 1 ? "" : "s"}</p>
      <div className={`overflow-x-auto rounded-lg border ${borderClass}`}>
        <table className="min-w-full text-xs">
          <thead>
            <tr className={`border-b ${borderClass} text-left ${textClass}`}>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1 font-medium">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 text-slate-600">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
