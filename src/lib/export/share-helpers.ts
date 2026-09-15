// 2026-09-15 — shared client-side send/print helpers backing the Universal
// Share system ("telegram whatsaap, email ka option bhi ho ... portrait &
// landscape me ho or file send karne par pdf forate me jaye").
//
// printWithOrientation(): the app's PDF convention is window.print() on a
// dedicated print area (the browser dialog's "Save as PDF" destination does
// the actual rendering — see export-bar.tsx / print-view.tsx). This helper
// injects a single shared @page rule so the printed/PDF output comes out in
// the requested A4 orientation, then restores the previous rules.
//
// telegramShare(): Telegram's public web share intent (t.me/share/url) —
// opens the user's own Telegram with the text pre-filled, chat of their
// choice. No bot token, no server hop, works for any logged-in user.
//
// whatsappShareText(): Web-Share-first (single message with text, and the
// platform can attach media in the same composer), wa.me text fallback —
// same one-message photo+caption behavior the order-photo share already
// uses. Kept here so every feature shares ONE implementation.

export type PrintOrientation = "portrait" | "landscape" | "both";

export function printWithOrientation(printAreaId: string, orientation: PrintOrientation, docTitle?: string): void {
  const pageRule =
    orientation === "landscape"
      ? "@page { size: A4 landscape; margin: 12mm; }"
      : orientation === "both"
        ? "@page { size: A4; margin: 12mm; }"
        : "@page { size: A4 portrait; margin: 12mm; }";

  let style = document.getElementById("oms-print-orientation-style") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "oms-print-orientation-style";
    document.head.appendChild(style);
  }
  const prev = style.textContent;
  style.textContent = pageRule;

  const area = document.getElementById(printAreaId);
  const prevTitle = document.title;
  if (docTitle) document.title = docTitle;
  // window.print() prints the whole document — every page's print CSS is
  // expected to hide app chrome (print:hidden) and show only its print
  // area, which is the app's existing convention.
  window.print();

  // Restore after the dialog closes (best-effort timers).
  setTimeout(() => {
    style.textContent = prev;
    document.title = prevTitle;
  }, 500);
}

export function telegramShare(title: string, text: string): void {
  const combined = `${title}\n\n${text}`.slice(0, 3500);
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(combined.slice(0, 900))}&text=${encodeURIComponent(combined)}`,
    "_blank",
    "noopener"
  );
}

export async function whatsappShareText(title: string, text: string, phone?: string | null): Promise<void> {
  const combined = `${title}\n\n${text}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text: combined });
      return;
    } catch {
      // user cancelled / unsupported — fall through to wa.me
    }
  }
  const base = phone ? `https://wa.me/${String(phone).replace(/[^\d]/g, "")}` : "https://wa.me/";
  window.open(`${base}?text=${encodeURIComponent(combined)}`, "_blank", "noopener");
}
