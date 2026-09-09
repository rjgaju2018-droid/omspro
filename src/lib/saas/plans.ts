// OMS Pro SaaS plans — single source of truth for the landing page's
// pricing section AND the in-app Plan & Billing page. Prices are monthly
// INR; limits are soft marketing numbers, not hard enforcement (trial is
// 14 days from signup, configured in db/2026-09-09-omspro-saas-signup.sql
// and written at signup time — see src/app/signup/actions.ts).
export type PlanId = "trial" | "starter" | "growth" | "enterprise";

export type Plan = {
  id: PlanId;
  label: string;
  priceInr: number | null; // null = free trial (no card needed)
  tagline: string;
  users: string;
  ordersPerMonth: string;
  features: string[];
  highlighted?: boolean;
};

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: "starter",
    label: "Starter",
    priceInr: 999,
    tagline: "For a small team, one company — the easiest way to start.",
    users: "Up to 3 users",
    ordersPerMonth: "500 orders / month",
    features: [
      "Order entry & full lifecycle",
      "Dispatch + shipment tracking",
      "Credit/Debit notes & documents",
      "Stock & inventory",
      "1 company workspace",
    ],
  },
  {
    id: "growth",
    label: "Growth",
    priceInr: 2499,
    tagline: "For growing export/marketplace businesses.",
    users: "Up to 15 users",
    ordersPerMonth: "5,000 orders / month",
    features: [
      "Everything in Starter",
      "Finance: bills, approvals, payments",
      "Reports suite + Excel/CSV export",
      "HR: attendance, leave, salary",
      "Automation rules + audit log",
      "1 company workspace",
    ],
    highlighted: true,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    priceInr: null,
    tagline: "Multi-company operations, unlimited scale.",
    users: "Unlimited users",
    ordersPerMonth: "Unlimited orders",
    features: [
      "Everything in Growth",
      "Multi-company (one login, many companies)",
      "Courier API integrations (FedEx, UPS, DHL…)",
      "Priority WhatsApp + email support",
      "Onboarding & data migration help",
    ],
  },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
