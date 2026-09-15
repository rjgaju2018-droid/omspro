"use client";

// 2026-09-15 — "order ke samne invoice no show hota hai to link hona chahiye
// invoice dikh jaye jiske pass acces hai lekin diloge box me alag window me
// nahi": clicking an order's invoice number opens this in-page dialog with
// the invoice's key details + its order lines. Access is enforced
// server-side by /api/invoices/preview (same company rule as the full
// invoice page); the dialog renders whatever that endpoint returns and
// links onward to the full page for print/edit.
import { useEffect, useState } from "react";
import Link from "next/link";

type PreviewData = {
  invoice: {
    id: string;
    invoice_no: string | null;
    master_invoice_no: string | null;
    invoice_date: string;
    shipment_term: string;
    csb_type: string;
    courier_company: string | null;
    destination_country: string | null;
    invoice_value_usd: number | null;
    invoice_value_inr: number | null;
    weight_kg: number | null;
    ioss_number: string | null;
  };
  company: { name: string; logo_url: string | null } | null;
  storeName: string;
  orders: { id: string; ref_no: string; marketplace_order_no: string | null; sku_label: string | null; size_label: string | null; qty: number; order_value_usd: number | null; order_currency: string | null }[];
};

export function useInvoicePreview() {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open(invoiceId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/preview?id=${encodeURIComponent(invoiceId)}`);
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Could not load the invoice.");
      else setData(json as PreviewData);
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setData(null);
    setError(null);
  }

  return { open, close, data, loading, error };
}

export function InvoicePreviewDialog({
  data,
  loading,
  error,
  onClose,
}: {
  data: PreviewData | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  // Esc closes — small nicety, no focus-trap complexity for a read-only view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
        <div className="rounded-xl bg-white px-8 py-6 text-sm font-medium text-slate-600 shadow-2xl">Loading invoice…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl">
          <p className="text-sm font-medium text-red-600">{error}</p>
          <button type="button" onClick={onClose} className="mt-4 rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
            Close
          </button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { invoice, company, storeName, orders } = data;
  const totalUsd = orders.reduce((s, o) => s + Number(o.order_value_usd ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-3">
            {company?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
            )}
            <div>
              <h2 className="text-sm font-bold text-slate-900">{invoice.invoice_no ?? "Invoice"}</h2>
              <p className="text-[11px] text-slate-500">
                {company?.name ?? ""} · {storeName}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 py-4 text-xs sm:grid-cols-4">
          {[
            ["Date", invoice.invoice_date],
            ["Term", invoice.shipment_term],
            ["CSB", invoice.csb_type],
            ["Destination", invoice.destination_country ?? "—"],
            ["Courier", invoice.courier_company ?? "—"],
            ["Weight", invoice.weight_kg ? `${invoice.weight_kg} kg` : "—"],
            ["Value (USD)", invoice.invoice_value_usd != null ? invoice.invoice_value_usd.toFixed(2) : "—"],
            ["IOSS", invoice.ioss_number ?? "—"],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-lg bg-slate-50 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p>
              <p className="mt-0.5 font-semibold text-slate-800">{v}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {orders.length} order{orders.length === 1 ? "" : "s"} on this invoice
          </p>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400">
                <th className="py-1 pr-2 font-medium">Ref</th>
                <th className="py-1 pr-2 font-medium">SKU</th>
                <th className="py-1 pr-2 text-right font-medium">Qty</th>
                <th className="py-1 text-right font-medium">USD</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium text-slate-800">{o.ref_no}</td>
                  <td className="py-1 pr-2 text-slate-600">
                    {o.sku_label ?? "—"} {o.size_label ? `· ${o.size_label}` : ""}
                  </td>
                  <td className="py-1 pr-2 text-right text-slate-600">{o.qty}</td>
                  <td className="py-1 text-right text-slate-700">{o.order_value_usd != null ? Number(o.order_value_usd).toFixed(2) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-1.5 text-right font-semibold text-slate-600">
                  Orders total (USD)
                </td>
                <td className="py-1.5 text-right font-bold text-slate-900">{totalUsd.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3.5">
          <span className="text-[11px] text-slate-400">Esc to close</span>
          <Link
            href={`/dashboard/invoices/${invoice.id}`}
            className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
          >
            Open full invoice →
          </Link>
        </div>
      </div>
    </div>
  );
}
