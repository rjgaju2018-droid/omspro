"use client";

// 2026-09-12 — tablet/mobile menu toggle. Below 1024px the Work Menu
// sidebar becomes a fixed overlay drawer (the @media rule in globals.css
// that ships alongside this component) but until now nothing could open
// or close it — the layout only rendered the header + sidebar side by
// side for desktop. This button lives in the DashboardHeader, shows only
// below lg (1024px), and flips a `data-nav-open` attribute on <body>
// which the sidebar's overlay CSS keys off to slide in/out. A scrim
// (also below lg only) closes it on tap. Desktop is untouched — the
// button doesn't even render at lg+.
import { useEffect, useState } from "react";

export function MobileMenuToggle() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  // Matches the CSS breakpoint driving the sidebar's overlay behavior —
  // evaluated after mount (SSR-safe: renders nothing until then).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setVisible(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Reflect state onto <body> for the CSS, and lock body scroll while the
  // drawer is open so the page behind doesn't scroll under it.
  useEffect(() => {
    document.body.dataset.navOpen = open ? "true" : "false";
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      delete document.body.dataset.navOpen;
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        title={open ? "Close menu" : "Open menu"}
        className="oms-icon-btn flex h-9 w-9 items-center justify-center rounded-lg text-lg lg:hidden"
      >
        {open ? "✕" : "☰"}
      </button>
      {/* Tap-away scrim — only exists while the drawer is open. */}
      {open ? (
        <div
          className="fixed inset-0 z-[54] bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      ) : null}
    </>
  );
}
