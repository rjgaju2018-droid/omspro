import Link from "next/link";
import { getAuthedEmployee } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/saas/plans";

// Plan & Billing (2026-09-09, OMS Pro SaaS launch) — reads the trial/plan
// columns added by db/2026-09-09-omspro-saas-signup.sql via its trial_status()
// SQL function, and shows every plan from the same PLANS constant the landing
// page prices from. No capability gate: every employee may LOOK at the plan;
// changing it is a contact-the-owner action (payment flow comes next).
export const metadata = { title: "Plan & Billing — OMS Pro" };

export default async function BillingPage() {
  const employee = await getAuthedEmployee();
  const service = createServiceRoleClient();
  const [{ data: company }, { data: status }] = await Promise.all([
    service.from("companies").select("name, plan, trial_ends_at").eq("id", employee.currentCompanyId).single(),
    service.rpc("trial_status", { p_company_id: employee.currentCompanyId }),
  ]);

  const statusText: Record<string, { label: string; className: string }> = {
    trial: { label: "Free trial chal raha hai", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
    expiring: { label: "Trial kuch hi dino me khatam ho raha hai", className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
    expired: { label: "Trial khatam ho gaya", className: "bg-red-500/10 text-red-300 border-red-500/30" },
    no_expiry: { label: "Founding account — koi trial expiry nahi", className: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
    paid: { label: "Paid plan active", className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  };
  const badge = statusText[typeof status === "string" ? status : "no_expiry"] ?? statusText.no_expiry;
  const currentPlanId = company?.plan ?? "trial";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Plan &amp; Billing</h1>
        <p className="mt-1 text-sm text-slate-600">
          {company?.name ?? "Aapki company"} — aapka current plan aur trial status.
        </p>
      </header>

      <div className={`rounded-xl border px-5 py-4 text-sm font-medium ${badge.className}`}>
        {badge.label}
        {company?.trial_ends_at && (
          <span className="font-normal opacity-90">
            {" "}
            — {new Date(company.trial_ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} tak
          </span>
        )}
      </div>

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
                  {plan.id === "enterprise" ? "Contact Sales" : "Upgrade karein"}
                </a>
              )}
            </article>
        );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <h2 className="font-bold text-slate-900">Payment / upgrade ke liye</h2>
        <p className="mt-2">
          UPI, bank transfer ya card — ke liye contact karein:{" "}
          <a href="mailto:bhankariwal@gmail.com" className="font-medium text-amber-700 hover:underline">
            bhankariwal@gmail.com
          </a>{" "}
          · +91 99830 00552 (WhatsApp bhi).
        </p>
      </section>

      <p className="text-center text-sm">
        <Link href="/dashboard" className="font-medium text-amber-700 hover:underline">
          ← Dashboard par wapas
        </Link>
      </p>
    </div>
  );
}
