"use server";

// 2026-09-15 — the onboarding wizard's server side ("refurnish" round):
//   1. Profile — the owner's display name + photo.
//   2. Company — display name, short code (document numbering), logo upload.
//   3. Modules — which parts of OMS Pro this company actually runs
//      (HR on/off, Salary on/off, etc. — "system option chose").
// Every step re-verifies the caller and that onboarding is NOT already
// complete, so a finished workspace can't be re-configured through these
// actions. Completing the wizard stamps companies.onboarding_completed_at,
// which is what stops the login flow from routing here again.
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ALL_MODULE_GROUPS, isKnownGroup } from "@/lib/company-modules";
import { uploadCompanyLogo, uploadEmployeePhoto } from "@/lib/company/logo-upload";

export type OnboardingState = { error: string | null; done: boolean };

type OnboarderContext =
  | { error: string; employee?: undefined; company?: undefined; service?: undefined }
  | { error: null; employee: { id: string }; company: { id: string }; service: ReturnType<typeof createServiceRoleClient> };

async function requirePendingOnboarder(): Promise<OnboarderContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const service = createServiceRoleClient();
  const { data: employee } = await service
    .from("employees")
    .select("id, company_id, name, active")
    .eq("auth_user_id", user.id)
    .single();
  if (!employee || employee.active === false) return { error: "No active employee record." };

  const { data: company } = await service
    .from("companies")
    .select("id, name, short_code, onboarding_completed_at")
    .eq("id", employee.company_id)
    .single();
  if (!company) return { error: "Company not found." };
  if (company.onboarding_completed_at) return { error: "Onboarding is already complete." };

  return { error: null, employee: { id: employee.id }, company: { id: company.id }, service };
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Step 1 — profile: owner display name + optional photo upload. */
export async function saveOnboardingProfile(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const ctx = await requirePendingOnboarder();
  if (ctx.error || !ctx.employee || !ctx.service) return { error: ctx.error ?? "Not signed in.", done: false };
  const { employee, service } = ctx;

  const name = str(formData, "name");
  if (name.length < 2) return { error: "Please enter your full name.", done: false };

  const updates: Record<string, unknown> = { name };

  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 2 * 1024 * 1024) return { error: "Photo must be under 2 MB.", done: false };
    const url = await uploadEmployeePhoto(service, employee.id, photo);
    if (url) updates.photo_url = url;
  }

  const { error } = await service.from("employees").update(updates).eq("id", employee.id);
  if (error) return { error: error.message, done: false };
  revalidatePath("/dashboard/onboarding");
  return { error: null, done: false };
}

/** Step 2 — company: display name, short code, logo upload. */
export async function saveOnboardingCompany(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const ctx = await requirePendingOnboarder();
  if (ctx.error || !ctx.company || !ctx.service) return { error: ctx.error ?? "Not signed in.", done: false };
  const { company, service } = ctx;

  const name = str(formData, "company_name");
  const shortCode = str(formData, "short_code").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  if (name.length < 2) return { error: "Company name is too short.", done: false };
  if (shortCode.length < 2) return { error: "Short code must be 2-5 letters/digits (used in document numbers).", done: false };

  // short_code is UNIQUE across companies (db/schema.sql) — fail with a
  // clear message instead of the raw constraint error.
  const { data: taken } = await service
    .from("companies")
    .select("id")
    .eq("short_code", shortCode)
    .neq("id", company.id)
    .maybeSingle();
  if (taken) return { error: `Short code "${shortCode}" is already used by another company.`, done: false };

  const updates: Record<string, unknown> = { name, short_code: shortCode };

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024) return { error: "Logo must be under 2 MB.", done: false };
    const url = await uploadCompanyLogo(service, company.id, logo);
    if (url) updates.logo_url = url;
  }

  const { error } = await service.from("companies").update(updates).eq("id", company.id);
  if (error) return { error: error.message, done: false };
  revalidatePath("/dashboard/onboarding");
  return { error: null, done: false };
}

/** Step 3 — modules: persist chosen groups, stamp onboarding complete. */
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const ctx = await requirePendingOnboarder();
  if (ctx.error || !ctx.employee || !ctx.company || !ctx.service) return { error: ctx.error ?? "Not signed in.", done: false };
  const { employee, company, service } = ctx;

  const chosen = formData.getAll("modules").map((v) => String(v)).filter(isKnownGroup);
  // An empty selection would blank the whole dashboard — fall back to all.
  const enabledGroups = chosen.length > 0 ? chosen : ALL_MODULE_GROUPS;

  const { error: modulesError } = await service
    .from("company_modules")
    .upsert(
      { company_id: company.id, enabled_groups: enabledGroups, updated_at: new Date().toISOString(), updated_by: employee.id },
      { onConflict: "company_id" }
    );
  if (modulesError) return { error: modulesError.message, done: false };

  const { error: companyError } = await service
    .from("companies")
    .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: 3 })
    .eq("id", company.id);
  if (companyError) return { error: companyError.message, done: false };

  revalidatePath("/dashboard");
  return { error: null, done: true };
}
