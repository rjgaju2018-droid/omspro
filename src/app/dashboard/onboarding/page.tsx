import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthedEmployee } from "@/lib/auth/require-capability";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

// 2026-09-15 — the onboarding wizard route ("refurnish" round). The login
// flow routes brand-new owners here when companies.onboarding_completed_at
// is null; the wizard's final step stamps it and the employee lands in the
// dashboard proper. Already-onboarded visitors are bounced to /dashboard —
// re-running the wizard is deliberately not possible through this route
// (module changes happen from Company Settings instead).
export const metadata: Metadata = { title: "Set up your workspace — OMS Pro" };

export default async function OnboardingPage() {
  let employee;
  try {
    employee = await getAuthedEmployee();
  } catch {
    redirect("/login");
  }

  if (employee.onboardingCompletedAt) redirect("/dashboard");

  const service = createServiceRoleClient();
  const [{ data: company }, { data: profile }] = await Promise.all([
    service
      .from("companies")
      .select("name, short_code, logo_url")
      .eq("id", employee.currentCompanyId)
      .single(),
    service.from("employees").select("name, photo_url").eq("id", employee.id).single(),
  ]);

  const supabase = await createClient();
  void supabase;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <OnboardingWizard
        ownerName={profile?.name ?? employee.name}
        companyName={company?.name ?? ""}
        shortCode={company?.short_code ?? ""}
        logoUrl={company?.logo_url ?? null}
        photoUrl={profile?.photo_url ?? null}
      />
    </div>
  );
}
