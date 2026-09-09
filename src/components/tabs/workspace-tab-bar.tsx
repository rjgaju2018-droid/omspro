"use client";

import Link from "next/link";
import { useWorkspaceTabs } from "./tab-context";

// 2026-09-09 — the visible half of the "window tab feature" (see
// tab-context.tsx for the state design). Renders nothing until tabs exist,
// so first-load dashboards look exactly like before. The pinned Home tab
// plus the strip live in the normal flex flow (no fixed positioning), so
// pages that scroll inside <main> keep the tabs visible the same way the
// header is — the layout shell owns the pinning.
export function WorkspaceTabBar() {
  const { tabs, activeHref, closeTab, closeAll } = useWorkspaceTabs();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--oms-header-border)] bg-[var(--oms-header-bg)] px-3 py-1.5">
      {/* Pinned Home — always first, never closable. */}
      <Link
        href="/dashboard"
        className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
          activeHref === "/dashboard"
            ? "border-[var(--oms-accent)] bg-[var(--oms-accent)]/10 text-[var(--oms-accent)]"
            : "border-transparent text-[var(--oms-text-muted)] hover:text-[var(--oms-text)]"
        }`}
        title="Home"
      >
        <span>🏠</span>
        <span className="hidden sm:inline">Home</span>
      </Link>

      <div className="mx-1 h-5 w-px shrink-0 bg-[var(--oms-header-border)]" aria-hidden="true" />

      {tabs.map((tab) => {
        const isActive = activeHref === tab.href;
        return (
          <div
            key={tab.href}
            className={`group flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-[var(--oms-accent)] bg-[var(--oms-accent)]/10 text-[var(--oms-accent)]"
                : "border-transparent text-[var(--oms-text-muted)] hover:bg-[var(--oms-text)]/5 hover:text-[var(--oms-text)]"
            }`}
          >
            <Link href={tab.href} className="flex items-center gap-1.5" title={tab.title}>
              <span aria-hidden="true">{tab.icon}</span>
              <span className="max-w-40 truncate">{tab.title}</span>
            </Link>
            <button
              type="button"
              onClick={() => closeTab(tab.href)}
              aria-label={`Close ${tab.title} tab`}
              className="ml-0.5 rounded px-1 text-[10px] leading-none opacity-0 transition group-hover:opacity-60 hover:!opacity-100 focus:opacity-100"
            >
              ✕
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={closeAll}
        className="ml-1 shrink-0 rounded px-2 py-1 text-[11px] text-[var(--oms-text-muted)] transition hover:text-[var(--oms-text)]"
        title="Close all tabs"
      >
        Sab band karein
      </button>
    </div>
  );
}
