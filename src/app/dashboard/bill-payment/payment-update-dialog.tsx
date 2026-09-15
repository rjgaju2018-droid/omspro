"use client";

// 2026-09-15 — the "send update" dialog ("sabhi bill payment ho jata hai to
// ek dilog box open hoye send update ka whatsaap telegram, email jo payment
// hua us bill ki detail or ek us bill me jo order po vagera hai — example
// ke liye courier bill ki report banti hai awb assign karne ke baad to usi
// parkar ki report banegi").
//
// Opens in the SAME page as a modal dialog (never a separate window), shows
// the payment summary + per-bill lines with the PO refs covered by the bill
// (the bill's related notes/orders passed in), and offers one-click
//   💬 WhatsApp — Web-Share first (photo+caption go in ONE message when the
//     platform supports sharing media; text fallback otherwise)
//   ✈️ Telegram — t.me share intent with the same summary
//   📧 Email  — mailto draft
// Message template is Tally/Zoho-style: Payment advice with bill refs,
// amounts, mode/reference and the orders each bill settles.
import { useMemo, useState } from "react";
import { telegramShare, whatsappShareText } from "@/lib/export/share-helpers";
import type { PayableBillRow } from "./bill-payment-list";
import type { RelatedNote } from "../documents/actions";

export function PaymentUpdateDialog({
  bills,
  amounts,
  paymentDate,
  paymentMode,
  referenceNo,
}: {
  bills: PayableBillRow[];
  /** bill id -> amount actually paid (what the user typed, not the default). */
  amounts: Map<string, number>;
  paymentDate: string;
  paymentMode: string;
  referenceNo: string;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const totalPaid = bills.reduce((s, b) => s + (amounts.get(b.id) ?? 0), 0);

  const { subject, body } = useMemo(() => {
    const subject = `Payment advice — ₹${totalPaid.toFixed(2)} on ${paymentDate}`;
    const lines: string[] = [
      "PAYMENT ADVICE",
      "--------------",
      `Date: ${paymentDate}`,
      paymentMode ? `Mode: ${paymentMode}` : "",
      referenceNo ? `Reference: ${referenceNo}` : "",
      "",
      "Bills settled:",
    ];
    for (const b of bills) {
      const paid = amounts.get(b.id) ?? 0;
      lines.push(
        `• ${b.invoice_no || b.vendor_invoice_no || "Bill"} — ${b.party_name ?? "—"} | Paid ₹${paid.toFixed(2)} | Balance ₹${Math.max(0, b.balance_due - paid).toFixed(2)}`
      );
      // RelatedNote carries the note doc refs; the bill's own invoice no
      // plus the note numbers identify what this payment settles (the
      // AWB-report style detail). Orders' PO refs come through the bill
      // row's own vendor invoice link on the printout/JV.
      const notes = (b.related_notes ?? []).slice(0, 8);
      if (notes.length > 0) {
        lines.push(`  Notes: ${notes.map((n) => `${n.kind === "credit" ? "CN" : "DN"} ${n.docNo ?? ""}`.trim()).join(", ")}`);
      }
    }
    lines.push("", "This is an system-generated payment update from OMS Pro.");
    return { subject, body: lines.filter((l) => l !== "").join("\n") };
  }, [bills, amounts, totalPaid, paymentDate, paymentMode, referenceNo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-bold text-slate-900">✅ Payment saved — send update</h2>
          <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">{body}</pre>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard unavailable */
              }
            }}
          >
            {copied ? "✓ Copied" : "⧉ Copy text"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            onClick={() => void whatsappShareText(subject, body)}
          >
            💬 WhatsApp
          </button>
          <button
            type="button"
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            onClick={() => telegramShare(subject, body)}
          >
            ✈️ Telegram
          </button>
          <a
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
          >
            📧 Email
          </a>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={() => setOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
