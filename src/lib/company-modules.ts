// 2026-09-15 — the "refurnish" round's module catalogue: which groups of
// OMS Pro a company can switch on/off during onboarding
// (/dashboard/onboarding) and later from Company Setup. The dashboard
// sidebar/dock filter their tiles by the intersection of
//   1. this employee's own capabilities (role-based, unchanged) and
//   2. the company's chosen module groups (company_modules.enabled_groups).
// A company that never touches onboarding keeps every group (the DB
// migration seeds the full set) — same behavior as before this round.
//
// GROUPS map module-group id -> the capability codes it unhides. Storage is
// group ids in company_modules.enabled_groups (db/2026-09-15-company-
// modules.sql); expansion to codes happens here so adding a page to a
// group never needs a DB migration.

export type ModuleGroupId =
  | "orders"
  | "dispatch"
  | "documents"
  | "finance"
  | "inventory"
  | "hr"
  | "salary"
  | "reports"
  | "crm"
  | "courier"
  | "marketing"
  | "admin";

export interface ModuleGroupDef {
  id: ModuleGroupId;
  label: string;
  icon: string;
  description: string;
  /** Capability codes unhidden when this group is enabled. */
  capabilities: string[];
  /** Suggested default for the onboarding picker. */
  defaultOn: boolean;
}

export const MODULE_GROUPS: ModuleGroupDef[] = [
  {
    id: "orders",
    label: "Orders",
    icon: "📝",
    description: "Order entry, lifecycle, duplicate checks, order packages & CSV bulk upload.",
    capabilities: ["order_entry", "csv_upload"],
    defaultOn: true,
  },
  {
    id: "dispatch",
    label: "Dispatch & Shipments",
    icon: "🚚",
    description: "Multi-package dispatch, AWB tracking, shipment recordings per order.",
    capabilities: ["order_entry"],
    defaultOn: true,
  },
  {
    id: "documents",
    label: "Documents & Invoices",
    icon: "🧾",
    description: "Credit/debit notes, washing entries, purchase/courier/duty bills, export invoices.",
    capabilities: ["doc_entry", "invoicing", "statement_entry"],
    defaultOn: true,
  },
  {
    id: "finance",
    label: "Finance & Approvals",
    icon: "💳",
    description: "Bill payments, two-level approvals, party master, office expenses, exchange rates.",
    capabilities: ["bill_payment", "approve_level1", "approve_level2", "party_admin", "exchange_rate_admin", "internal_expense_entry"],
    defaultOn: true,
  },
  {
    id: "inventory",
    label: "Stock & Inventory",
    icon: "📦",
    description: "Raw-material stock in/out, finished-goods inventory, reorder alerts.",
    capabilities: ["stock_entry", "finished_stock_view"],
    defaultOn: true,
  },
  {
    id: "hr",
    label: "HR & Attendance",
    icon: "🕒",
    description: "Punch in/out, leave requests, daily work reports, HR letters, tasks.",
    capabilities: ["attendance_punch", "attendance_admin", "hr_letters", "task_management", "task_admin"],
    defaultOn: true,
  },
  {
    id: "salary",
    label: "Salary & Payroll",
    icon: "💰",
    description: "Salary payments, advances, payroll runs linked to attendance.",
    capabilities: ["salary_admin"],
    defaultOn: true,
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    icon: "📈",
    description: "Orders, profit, outstanding, SKU×country×size — CSV/Excel/PDF export.",
    capabilities: ["reports", "performance_admin"],
    defaultOn: true,
  },
  {
    id: "crm",
    label: "CRM Dashboard",
    icon: "🤝",
    description: "Company-wide CRM overview, alerts and data-quality insights.",
    capabilities: ["crm_dashboard"],
    defaultOn: true,
  },
  {
    id: "courier",
    label: "Courier Booking",
    icon: "🌍",
    description: "Real shipments via FedEx/UPS/Aramex/Delhivery/Shiprocket/DHL + freight estimator.",
    capabilities: ["courier_booking_shipment", "courier_credentials_admin", "freight_estimate", "freight_rate_admin", "shipglobal_shipment"],
    defaultOn: true,
  },
  {
    id: "marketing",
    label: "Marketing & Ad Spend",
    icon: "📣",
    description: "Daily ad budget/spend per store and the combined Orders + Ad Spend report.",
    capabilities: ["ad_spend_entry", "ad_spend_report_all"],
    defaultOn: false,
  },
  {
    id: "admin",
    label: "Administration",
    icon: "🛡️",
    description: "Employees, roles & permissions, audit log, error log, company registry.",
    capabilities: ["employee_admin", "permissions_admin", "audit_log_view", "error_log_view", "company_item_admin", "data_export_admin"],
    defaultOn: true,
  },
];

export const DEFAULT_MODULE_GROUPS: ModuleGroupId[] = MODULE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id);
export const ALL_MODULE_GROUPS: ModuleGroupId[] = MODULE_GROUPS.map((g) => g.id);

/** Expands chosen group ids into the full set of capability codes they unhide. */
export function capabilitiesForGroups(groups: string[] | null | undefined): string[] {
  if (!groups || groups.length === 0) return [];
  const set = new Set<string>();
  for (const g of MODULE_GROUPS) {
    if (groups.includes(g.id)) g.capabilities.forEach((c) => set.add(c));
  }
  return [...set];
}

/** True when the group id stored in the DB is one we know (ignores stale ids). */
export function isKnownGroup(id: string): id is ModuleGroupId {
  return MODULE_GROUPS.some((g) => g.id === id);
}
