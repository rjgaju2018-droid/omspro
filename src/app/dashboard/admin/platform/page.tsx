import { requirePlatformOwner } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { updateCustomerControls } from "./actions";

export const metadata = { title: "Platform Control — OMS Pro" };

export default async function PlatformControlPage() {
  const owner = await requirePlatformOwner();
  const supabase = createServiceRoleClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, plan, access_mode, monthly_price_inr, discount_percent")
    .in("id", owner.companyIds)
    .order("name");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Platform owner</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Customer Access &amp; Pricing</h1>
        <p className="mt-1 text-sm text-slate-600">Control access, plan, negotiated monthly price, and discount for every customer workspace.</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Monthly price (INR)</th>
                <th className="px-4 py-3">Discount %</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(companies ?? []).map((company) => (
                <tr key={company.id}>
                  <td className="px-4 py-4 font-semibold text-slate-900">{company.name}</td>
                  <td className="px-4 py-4">
                    <form id={`controls-${company.id}`} action={updateCustomerControls} />
                      <input form={`controls-${company.id}`} type="hidden" name="company_id" value={company.id} />
                      <select form={`controls-${company.id}`} name="access_mode" defaultValue={company.access_mode} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                        <option value="free">Free access</option>
                        <option value="paid">Paid</option>
                        <option value="suspended">Suspended</option>
                      </select>
                  </td>
                  <td className="px-4 py-4">
                      <select form={`controls-${company.id}`} name="plan" defaultValue={company.plan} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
                        <option value="trial">Trial</option>
                        <option value="starter">Starter</option>
                        <option value="growth">Growth</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                  </td>
                  <td className="px-4 py-4">
                      <input form={`controls-${company.id}`} name="monthly_price_inr" type="number" min="0" step="1" defaultValue={company.monthly_price_inr ?? ""} placeholder="Plan price" className="w-32 rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-4">
                      <input form={`controls-${company.id}`} name="discount_percent" type="number" min="0" max="100" step="0.01" defaultValue={company.discount_percent} className="w-24 rounded-lg border border-slate-300 px-2 py-2 text-sm" />
                  </td>
                  <td className="px-4 py-4 text-right">
                      <button form={`controls-${company.id}`} type="submit" className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}