"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CAPABILITY_INFO } from "@/lib/capability-info";

// 2026-09-09 — OMS Pro "window tab feature": a browser-style tab bar across
// the top of the dashboard content area. Every module page the employee
// opens gets a tab (icon + label + close ×); closing the active one
// navigates to the tab beside it, exactly like a browser. Tabs persist
// per-browser in localStorage (same convention as oms_nav_style in
// nav-style-context.tsx) so a refresh doesn't wipe the workspace.
//
// Titles/icons resolve from CAPABILITY_INFO plus a small static map for the
// routes that aren't capability tiles (My Profile, Theme, Billing, …).
// Unknown deep routes fall back to a prettified last segment — the tab bar
// must never block navigation, whatever path shows up.
//
// State-sync design (deliberately shaped around the project's
// react-hooks/set-state-in-effect lint rule — see company-switcher.tsx's
// note on it):
//   - current-route → tab list sync happens via the React-documented
//     "adjust state during render" pattern (prevPathname comparison below),
//     not an effect;
//   - localStorage persistence is a separate effect that only WRITES to the
//     external system (no setState inside);
//   - the one-time mount read keeps the same mounted-gate +
//     eslint-disable convention nav-style-context.tsx already established
//     for localStorage hydration reads.

export type WorkspaceTab = { href: string; title: string; icon: string };

const TABS_STORAGE_KEY = "oms_workspace_tabs_v1";
const MAX_TABS = 10;

// Non-capability routes that still deserve a proper tab title.
const EXTRA_ROUTES: { href: string; title: string; icon: string }[] = [
  { href: "/dashboard", title: "Home", icon: "🏠" },
  { href: "/dashboard/profile", title: "My Profile", icon: "👤" },
  { href: "/dashboard/settings/theme", title: "Theme Settings", icon: "🎨" },
  { href: "/dashboard/messages", title: "Messages", icon: "💬" },
  { href: "/dashboard/billing", title: "Plan & Billing", icon: "💳" },
  { href: "/dashboard/search", title: "Global Search", icon: "🔍" },
  { href: "/dashboard/attendance/admin", title: "Attendance Admin", icon: "🗓️" },
];

function routeInfo(pathname: string): { title: string; icon: string } {
  // Longest-prefix wins, so /dashboard/orders/new resolves to Order Entry.
  const candidates = [...CAPABILITY_INFO.map((c) => ({ href: c.href, title: c.label, icon: c.icon })), ...EXTRA_ROUTES];
  let best: { href: string; title: string; icon: string } | null = null;
  for (const r of candidates) {
    if ((pathname === r.href || pathname.startsWith(r.href + "/")) && (!best || r.href.length > best.href.length)) {
      best = r;
    }
  }
  if (best) return { title: best.title, icon: best.icon };
  const last = pathname.split("/").filter(Boolean).pop() ?? "Page";
  return {
    title: last.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    icon: "📄",
  };
}

function withTab(prev: WorkspaceTab[], pathname: string): WorkspaceTab[] {
  if (pathname === "/dashboard") return prev; // Home is pinned, never stored
  if (prev.some((t) => t.href === pathname)) return prev;
  const next = [...prev, { href: pathname, ...routeInfo(pathname) }];
  return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next;
}

type TabsContextValue = {
  tabs: WorkspaceTab[];
  activeHref: string;
  closeTab: (href: string) => void;
  closeAll: () => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export function WorkspaceTabsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [mounted, setMounted] = useState(false);

  // One-time localStorage read behind a mounted gate (hydration-safe; same
  // eslint-disable convention as nav-style-context.tsx's identical read).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TABS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkspaceTab[];
        if (Array.isArray(parsed)) {
          const restored = parsed.filter((t) => t && typeof t.href === "string" && t.href !== "/dashboard");
          // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration read, same convention as nav-style-context.tsx
          setTabs(restored);
        }
      }
    } catch {
      // corrupt/no storage — start with an empty strip
    }
    setMounted(true);
  }, []);

  // Current route → tab strip sync: the React "adjust state when a prop
  // changes" render pattern instead of an effect (see file-header note).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setTabs((prev) => withTab(prev, pathname));
  }

  // Persist to localStorage whenever the strip changes — an external-system
  // write only, never setState (lint-rule-friendly).
  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
    } catch {
      // storage full/blocked — tabs just won't persist
    }
  }, [tabs, mounted]);

  const closeTab = useCallback(
    (href: string) => {
      const idx = tabs.findIndex((t) => t.href === href);
      const next = tabs.filter((t) => t.href !== href);
      setTabs(next);
      // Closing the tab you're looking at navigates to its neighbour —
      // the browser-tab behavior users expect.
      if (href === pathname && next.length > 0) {
        router.push(next[Math.min(idx, next.length - 1)].href);
      }
    },
    [tabs, pathname, router]
  );

  const closeAll = useCallback(() => {
    setTabs([]);
    try {
      window.localStorage.removeItem(TABS_STORAGE_KEY);
    } catch {
      // ignore
    }
    if (pathname !== "/dashboard") router.push("/dashboard");
  }, [pathname, router]);

  return (
    <TabsContext.Provider value={{ tabs, activeHref: pathname, closeTab, closeAll }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useWorkspaceTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("useWorkspaceTabs() must be used within a WorkspaceTabsProvider");
  return ctx;
}
