import Link from "next/link";
import { getAuthedEmployee } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/saas/plans";
import { razorpayConfigured } from "@/lib/saas/payments";
import { PlanUpgradeButtons } from "./upgrade-buttons";

// Plan & Billing (2026-09-09, OMS Pro SaaS launch) — reads the trial/plan
// columns added by db/2026-09-09-omspro-saas-signup.sql via its trial_status()
// SQL function, and shows every plan from the same PLANS constant the landing
// page prices from. No capability gate: every employee may LOOK at the plan;
// changing it requires completing payment (Razorpay) — or, while Razorpay
// keys are not configured, contacting the owner by email.
//
// Plan access rule (owner, 2026-09-09): a paying trial company jumps
// STRAIGHT to Enterprise. The comparison table below spells out exactly
// what the trial has vs what Enterprise adds.
export const metadata = { title: "Plan & Billing — OMS Pro" };

const PLAN_ACCESS: { feature: string; trial: string; enterprise: string }[] = [
  { feature: "Orders, dispatch & documents", trial: "✓ Full access", enterprise: "✓ Full access" },
  { feature: "Finance, stock & HR modules", trial: "✓ Full access", enterprise: "✓ Full access" },
  { feature: "Reports + CSV/Excel/Word/PDF export", trial: "✓ Full access", enterprise: "✓ Full access" },
  { feature: "Users", trial: "Unlimited during trial", enterprise: "Unlimited" },
  { feature: "Companies (multi-company, one login)", trial: "—", enterprise: "✓ Included" },
  { feature: "Courier API integrations (FedEx, UPS, DHL…)", trial: "Manual tracking only", enterprise: "✓ Auto-tracking webhooks" },
  { feature: "Automation rules & audit log", trial: "✓", enterprise: "✓" },
  { feature: "AI companion", trial: "✓ (admin-configured)", enterprise: "✓ Priority" },
  { feature: "Trial countdown", trial: "14 days, then read-only", enterprise: "— never expires" },
  { feature: "Onboarding & data migration help", trial: "—", enterprise: "✓ Included" },
  { feature: "Support", trial: "Email + WhatsApp", enterprise: "Priority email + WhatsApp" },
];

export default async function BillingPage() {
  const employee = await getAuthedEmployee();
  const service = createServiceRoleClient();
  const [{ data: company }, { data: status }, { data: history }] = await Promise.all([
    service.from("companies").select("name, plan, trial_ends_at, access_mode, monthly_price_inr, discount_percent").eq("id", employee.currentCompanyId).single(),
    service.rpc("trial_status", { p_company_id: employee.currentCompanyId }),
    service
      .from("payments")
      .select("plan_id, amount, status, created_at, razorpay_payment_id")
      .eq("company_id", employee.currentCompanyId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const statusText: Record<string, { label: string; className: string }> = {
    trial: { label: "Free trial in progress", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
    expiring: { label: "Your trial is ending soon", className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
    expired: { label: "Trial has ended", className: "bg-red-500/10 text-red-300 border-red-500/30" },
    no_expiry: { label: "Founding account — no trial expiry", className: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
    paid: { label: "Paid plan active", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  };
  const badge = statusText[typeof status === "string" ? status : "no_expiry"] ?? statusText.no_expiry;
  const currentPlanId = company?.plan ?? "trial";
  const isTrialLike = currentPlanId === "trial";
  const accessLabel = company?.access_mode === "free" ? "Free access granted by platform owner" : company?.access_mode === "suspended" ? "Workspace suspended" : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Plan &amp; Billing</h1>
        <p className="mt-1 text-sm text-slate-600">
          {company?.name ?? "Your company"} — your current plan and trial status.
        </p>
      </header>

      <div className={`rounded-xl border px-5 py-4 text-sm font-medium ${badge.className}`}>
        {badge.label}
        {company?.trial_ends_at && (
          <span className="font-normal opacity-90">
            {" "}
            — {new Date(company.trial_ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        )}
      </div>

      {accessLabel && (
        <div className={`rounded-xl border px-5 py-4 text-sm font-semibold ${company?.access_mode === "suspended" ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-700"}`}>
          {accessLabel}
          {company?.monthly_price_inr != null && company.discount_percent > 0 && (
            <span className="ml-2 font-normal">Negotiated price: ₹{company.monthly_price_inr.toLocaleString("en-IN")} with {company.discount_percent}% discount</span>
          )}
        </div>
      )}

      {isTrialLike && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-slate-900">Upgrade to Enterprise</h2>
          <p className="mt-1 text-sm text-slate-600">
            Any successful payment moves this company straight to the <strong>Enterprise</strong> plan — everything
            unlocked, unlimited users, multi-company, courier integrations, and your trial clock is removed.
          </p>
          <PlanUpgradeButtons razorpayReady={razorpayConfigured()} />
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <article
              key={plan.id}
              className={`rounded-2xl border p-6 ${
                isCurrent ? "border-amber-500 bg-amber-50 shadow-lg" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900">{plan.label}</h2>
                {isCurrent && (
                  <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">CURRENT</span>
                )}
              </div>
              <div className="mt-3">
                {plan.priceInr === null ? (
                  <div className="text-3xl font-black text-slate-900">Custom</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">₹{plan.priceInr.toLocaleString("en-IN")}</span>
                    <span className="text-xs text-slate-500">/month</span>
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs font-medium text-amber-700">{plan.users} · {plan.ordersPerMonth}</p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 text-emerald-600">✓</span> {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan.id !== "trial" && (
                <a
                  href={`mailto:bhankariwal@gmail.com?subject=${encodeURIComponent(
                    `OMS Pro upgrade — ${company?.name ?? "company"} → ${plan.label}`
                  )}`}
                  className="mt-5 block rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:border-amber-500 hover:text-amber-700"
                >
                  {plan.id === "enterprise" ? "Contact Sales" : "Upgrade"}
                </a>
              )}
            </article>
          );
        })}
      </section>

      {isTrialLike && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="font-bold text-slate-900">Trial vs Enterprise — what changes</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The trial already includes every module. Enterprise removes the 14-day limit and adds scale/integration features.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-semibold">Feature</th>
                <th className="px-5 py-2.5 font-semibold">Trial</th>
                <th className="px-5 py-2.5 font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ACCESS.map((row) => (
                <tr key={row.feature} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-700">{row.feature}</td>
                  <td className="px-5 py-2.5 text-slate-600">{row.trial}</td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {history && history.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 className="font-bold text-slate-900">Payment history</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-semibold">Date</th>
                <th className="px-5 py-2.5 font-semibold">Plan</th>
                <th className="px-5 py-2.5 font-semibold">Amount</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-2.5 text-slate-600">
                    {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-2.5 text-slate-700">{p.plan_id}</td>
                  <td className="px-5 py-2.5 text-slate-700">₹{(p.amount / 100).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : p.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <h2 className="font-bold text-slate-900">Payment / upgrade</h2>
        <p className="mt-2">
          For UPI, bank transfer or card payments, contact:{" "}
          <a href="mailto:bhankariwal@gmail.com" className="font-medium text-amber-700 hover:underline">
            bhankariwal@gmail.com
          </a>{" "}
          · +91 99830 00552 (WhatsApp also available).
        </p>
      </section>

      <p className="text-center text-sm">
        <Link href="/dashboard" className="font-medium text-amber-700 hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
