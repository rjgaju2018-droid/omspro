"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CAPABILITY_INFO } from "@/lib/capability-info";

// 2026-09-09 — OMS Pro "vertical assistant": a collapsible side panel
// pinned to the right edge of the dashboard. A one-click vertical launcher
// for every module the employee's role can open (the same CAPABILITY_INFO
// tiles the sidebar shows — access control is unchanged, a link to a route
// your role lacks simply lands on the app's own access error), plus
// type-to-filter search and the support contact. Client-only state
// (open/closed + filter text), no server round-trips, and it renders itself
// AFTER mount so SSR output is unchanged.
const SUPPORT_EMAIL = "bhankariwal@gmail.com";

export function VerticalAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();

  const items = useMemo(() => {
    const base = CAPABILITY_INFO.map((c) => ({ href: c.href, label: c.label, icon: c.icon }));
    base.push({ href: "/dashboard/profile", label: "My Profile", icon: "👤" });
    base.push({ href: "/dashboard/billing", label: "Plan & Billing", icon: "💳" });
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    return base
      .filter((i) => {
        if (seen.has(i.href)) return false;
        seen.add(i.href);
        return !q || i.label.toLowerCase().includes(q);
      })
      .slice(0, 24);
  }, [query]);

  return (
    <>
      {/* Launcher tab on the right edge — always visible after mount. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open/close assistant"
        className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-xl border border-l-0 border-[var(--oms-sidebar-border)] bg-[var(--oms-sidebar-bg)] px-2 py-4 text-sm shadow-xl transition hover:px-3"
        title="Assistant"
      >
        {open ? "›" : "‹"}
      </button>

      {/* Slide-in panel */}
      <aside
        aria-label="OMS Pro Assistant"
        className={`fixed right-0 top-16 bottom-16 z-40 flex w-72 flex-col rounded-l-2xl border border-[var(--oms-sidebar-border)] bg-[var(--oms-sidebar-bg)] shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--oms-sidebar-border)] px-4 py-3">
          <div>
            <div className="text-sm font-bold text-[var(--oms-text)]">🧭 Assistant</div>
            <div className="text-[11px] text-[var(--oms-sidebar-text-muted)]">Every module, one panel</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close assistant"
            className="rounded px-2 py-1 text-xs text-[var(--oms-sidebar-text-muted)] hover:text-[var(--oms-text)]"
          >
            ✕
          </button>
        </div>

        <div className="px-3 py-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules…"
            className="w-full rounded-lg border border-[var(--oms-sidebar-border)] bg-transparent px-3 py-2 text-xs text-[var(--oms-text)] placeholder-[var(--oms-sidebar-text-muted)] outline-none focus:border-[var(--oms-accent)]"
          />
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--oms-accent)]/15 text-[var(--oms-accent)]"
                    : "text-[var(--oms-sidebar-text)] hover:bg-[var(--oms-text)]/5"
                }`}
                title={item.label}
              >
                <span aria-hidden="true" className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--oms-sidebar-text-muted)]">
              No modules found — try a different keyword.
            </p>
          )}
        </nav>

        <div className="border-t border-[var(--oms-sidebar-border)] px-4 py-3">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("OMS Pro support")}`}
            className="block rounded-lg border border-[var(--oms-sidebar-border)] px-3 py-2 text-center text-xs font-semibold text-[var(--oms-text)] transition hover:border-[var(--oms-accent)] hover:text-[var(--oms-accent)]"
          >
            💬 Contact support
          </a>
        </div>
      </aside>
    </>
  );
}
