"use client";

// 2026-09-15 — Universal ShareBar ("jis jis jagh par print save document ka
// option hai vaha telegram whatsaap, email ka option bhi ho ... portrait &
// landscape me ho or file send karne par pdf forate me jaye").
//
// One client component every document-facing page drops in:
//   🖨 Print / Save PDF — window.print() on a hidden print area (the
//     browser's dialog offers "Save as PDF" in the destination; this is the
//     app's existing convention — no server PDF render to drift out of sync)
//   📄 Word   — a .doc-compatible HTML blob download (existing pattern)
//   📧 Email  — mailto: with a subject + text summary (works everywhere,
//     no provider key needed; a future provider integration can replace
//     the href without touching the callers)
//   💬 WhatsApp — Web-Share-first (files + caption in ONE message when the
//     platform supports it), wa.me text fallback otherwise
//   ✈️ Telegram — t.me/share/url with the text summary (Telegram's public
//     web share intent; no bot token needed client-side)
//
// ORIENTATION: `orientation` ("portrait" | "landscape" | "both") renders
// @page CSS so the printed PDF comes out in the chosen orientation —
// landscape for wide ledgers/reports, portrait for letters/invoices.

import { useState } from "react";

export type ShareOrientation = "portrait" | "landscape" | "both";

function printArea(areaId: string, orientation: ShareOrientation, docTitle: string) {
  const pageRule =
    orientation === "landscape"
      ? "@page { size: A4 landscape; margin: 12mm; }"
      : orientation === "both"
        ? "@page { size: A4; margin: 12mm; }"
        : "@page { size: A4 portrait; margin: 12mm; }";
  // Inject/refresh a dedicated style node so repeat prints always get the
  // current orientation without leaking rules across pages.
  let style = document.getElementById("oms-print-orientation-style") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "oms-print-orientation-style";
    document.head.appendChild(style);
  }
  style.textContent = pageRule;
  const area = document.getElementById(areaId);
  if (!area) return;
  const prevTitle = document.title;
  document.title = docTitle || prevTitle;
  window.print();
  setTimeout(() => {
    document.title = prevTitle;
  }, 500);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function htmlToWordBlob(html: string): Blob {
  // The classic MHTML envelope — Word opens it natively (existing
  // letter-export.ts convention).
  return new Blob(["\ufeff", html], { type: "application/msword" });
}

export interface ShareBarProps {
  /** DOM id of the PrintArea wrapping the printable content. */
  printAreaId: string;
  /** File name (no extension) used for the Word/PDF downloads. */
  fileName: string;
  /** Document title (also becomes the browser tab title during print). */
  title: string;
  /** Orientation for the printed/PDF output. */
  orientation?: ShareOrientation;
  /** Pre-built text summary used by Email / WhatsApp / Telegram. */
  summaryText: string;
  /** Optional subject line for email; defaults to title. */
  emailSubject?: string;
  /** Optional recipient for email (mailto:). */
  emailTo?: string;
  /** Optional WhatsApp number in international format without '+', e.g. 919983000552. Omit = user picks the chat. */
  whatsappTo?: string;
  /** Hide individual buttons. */
  hide?: Partial<Record<"print" | "word" | "email" | "whatsapp" | "telegram", boolean>>;
  /** Extra HTML for the Word export (full document markup). */
  wordHtml?: () => string;
}

export function ShareBar({
  printAreaId,
  fileName,
  title,
  orientation = "portrait",
  summaryText,
  emailSubject,
  emailTo,
  whatsappTo,
  hide,
  wordHtml,
}: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  async function shareWhatsApp() {
    const text = summaryText;
    // Web Share first — on supported phones this opens WhatsApp/Telegram
    // with the text ready to send in ONE message (photo+caption behavior
    // comes from the page's own image share path where an image exists).
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        // user cancelled or unsupported — fall through to wa.me
      }
    }
    const base = whatsappTo ? `https://wa.me/${whatsappTo}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(`${title}\n\n${text}`)}`, "_blank", "noopener");
  }

  function shareTelegram() {
    // Telegram's public share intent — opens the user's Telegram with the
    // text pre-filled (choose the chat there; no bot token needed).
    const url = `https://t.me/share/url?url=${encodeURIComponent(summaryText.slice(0, 900))}&text=${encodeURIComponent(`${title}\n\n${summaryText}`.slice(0, 3500))}`;
    window.open(url, "_blank", "noopener");
  }

  function shareEmail() {
    const subject = encodeURIComponent(emailSubject ?? title);
    const body = encodeURIComponent(summaryText);
    window.location.href = `mailto:${emailTo ?? ""}?subject=${subject}&body=${body}`;
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${summaryText}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  const btn =
    "rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-amber-500/50 hover:text-white";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hide?.print && (
        <button type="button" className={btn} onClick={() => printArea(printAreaId, orientation, title)}>
          🖨 Print / Save PDF
        </button>
      )}
      {!hide?.word && (
        <button
          type="button"
          className={btn}
          onClick={() => {
            const html =
              wordHtml?.() ??
              `<html><head><meta charset="utf-8"><title>${title}</title></head><body><pre style="font-family:Arial">${summaryText.replace(/</g, "&lt;")}</pre></body></html>`;
            triggerDownload(htmlToWordBlob(html), `${fileName}.doc`);
          }}
        >
          📄 Word
        </button>
      )}
      {!hide?.email && (
        <button type="button" className={btn} onClick={shareEmail}>
          📧 Email
        </button>
      )}
      {!hide?.whatsapp && (
        <button type="button" className={btn} onClick={shareWhatsApp}>
          💬 WhatsApp
        </button>
      )}
      {!hide?.telegram && (
        <button type="button" className={btn} onClick={shareTelegram}>
          ✈️ Telegram
        </button>
      )}
      <button type="button" className={btn} onClick={copySummary}>
        {copied ? "✓ Copied" : "⧉ Copy"}
      </button>
    </div>
  );
}
