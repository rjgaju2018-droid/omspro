// Direct port of the old system's requireCapability_() (Code.gs) — every
// privileged Server Function must call this FIRST, before touching any
// data. It is the server-side re-check; never trust a client-side
// capability check alone (the old system's own comment on this point still
// applies: a client can be tampered with, this cannot).
//
// Unlike the old ROLE_CAPABILITIES hardcoded object, capabilities are now a
// real roles/capabilities/role_capabilities join — see db/schema.sql — so
// granting a role a new capability is a data change, not a redeploy.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { todayIST } from "@/lib/attendance/ist-date";
// 2026-09-15 — company module selection: a company chooses WHICH parts of
// OMS Pro it runs during onboarding; the intersection with the employee's
// role capabilities is applied right here so every page/action/layout in
// the app respects it without any per-page changes.
import { capabilitiesForGroups } from "@/lib/company-modules";

export class UnauthorizedError extends Error {
  constructor(message = "Not signed in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * 2026-08-24 — the signed-in user has a verified 2FA (TOTP) factor enrolled
 * but the current session hasn't completed that second factor yet
 * (Supabase's "AAL1 but AAL2 required" state — see
 * src/app/dashboard/profile/two-factor-actions.ts for enrollment and
 * src/app/login/verify-2fa/ for the challenge step).
 *
 * 2026-08-27 fix: getAuthedEmployee() used to `throw new MfaRequiredError()`
 * here and leave every CALLER responsible for catching it and redirecting.
 * dashboard/layout.tsx did (see its old comment), but that's only one of
 * 100+ call sites — every Server Action and every page.tsx that calls
 * requireCapability()/getAuthedEmployee() directly (not just through the
 * layout) had no such catch, so an AAL1 session hitting any of them (e.g.
 * submitting a form, or a page whose own redundant requireCapability() call
 * runs before/independent of the layout's) surfaced this as a raw unhandled
 * server error instead of a redirect to the 2FA challenge. Fixed by having
 * getAuthedEmployee() redirect() here directly — Next.js's redirect() is
 * safe to call from Server Components, Server Actions, and Route Handlers
 * alike, so this now protects every caller in one place. The class is kept
 * exported (still useful for an explicit instanceof check if ever needed)
 * but nothing in this codebase should expect to catch it anymore.
 */
export class MfaRequiredError extends Error {
  constructor(message = "Two-factor verification required.") {
    super(message);
    this.name = "MfaRequiredError";
  }
}

export class ForbiddenError extends Error {
  constructor(capability: string) {
    super(`Your role does not have the "${capability}" capability.`);
    this.name = "ForbiddenError";
  }
}

// 2026-08-05: user confirmed real staff work across all 3 companies from
// ONE login — this cookie holds "which company is this login currently
// acting as", switchable via the header's company dropdown (see
// src/lib/auth/switch-company.ts + src/components/company-switcher.tsx).
// It's read-only in most places (Server Components can't set cookies —
// see supabase/server.ts's same caveat) so a stale/tampered value simply
// falls back to the employee's home company below; it's never trusted for
// anything beyond "which company's data to show".
export const CURRENT_COMPANY_COOKIE = "oms_company_id";

export type AuthedEmployee = {
  id: string;
  homeCompanyId: string;
  currentCompanyId: string;
  companyIds: string[];
  storeIds: string[];
  name: string;
  photoUrl: string | null;
  roleId: string;
  roleName: string;
  capabilities: string[];
  isPlatformOwner: boolean;
  /** 2026-09-15 — the current company's chosen module groups (company_modules.enabled_groups). */
  enabledModuleGroups: string[];
  /** 2026-09-15 — null = the onboarding wizard hasn't been completed yet. */
  onboardingCompletedAt: string | null;
};

/**
 * Resolves the currently-signed-in employee (via Supabase Auth session),
 * their role's capabilities, and which company they're currently acting as.
 * Throws UnauthorizedError if no session / no matching active employee row.
 */
export async function getAuthedEmployee(): Promise<AuthedEmployee> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new UnauthorizedError();

  // 2026-08-24 — 2FA enforcement. A password-only sign-in leaves the
  // session at AAL1; if this account has since enrolled a verified TOTP
  // factor, Supabase reports nextLevel: "aal2" until the second factor is
  // also verified this session. Every /dashboard page and Server Action
  // goes through getAuthedEmployee() (this function), so this is the single
  // choke point — see the MfaRequiredError doc comment above for why this
  // redirects directly rather than throwing.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/login/verify-2fa");
  }

  // Plain queries rather than embedded-resource joins (`roles(name)`) — the
  // hand-rolled Database type (scripts/gen-types.mjs, used because this
  // sandbox has no working Docker for the official `supabase gen types`
  // CLI) doesn't emit full `Relationships` metadata for every join shape,
  // so those come back typed as `never`. Plain queries need no such
  // metadata and are just as correct.
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, company_id, name, role_id, active, photo_url, is_platform_owner")
    .eq("auth_user_id", user.id)
    .single();

  if (error || !employee || employee.active === false) {
    throw new UnauthorizedError("No active employee record for this account.");
  }

  const today = todayIST();
  // 2026-08-12 (round 8): "MD ADMIN KE APPROVE KARTE HI HO JAYE" — a Leave
  // Coverage assignment (leave_coverage_assignments — see
  // db/2026-08-12-leave-requests-coverage.sql) grants the covering
  // employee TEMPORARY access to a store, computed fresh on every request
  // rather than by writing/deleting rows elsewhere: any row here where
  // today falls within [from_date, to_date] is active right now. This is
  // what makes the grant start the instant MD/Admin saves the assignment
  // and end automatically after to_date, with no cleanup job. Read via the
  // service-role client — same RLS-vs-service-role reasoning as every
  // other brand-new table this project (this query runs on literally every
  // page load, so it must never silently return empty because of a
  // missing RLS policy on a table that legitimately has rows).
  const finSupabase = createServiceRoleClient();

  // 2026-09-15 — resolve "which company is this login acting as" BEFORE the
  // parallel query block below: company_modules (the company's chosen
  // module groups) is keyed by this id. The full companyIds union (extra
  // companies via employee_company_access + leave coverage) is only known
  // AFTER those queries, so this pre-resolution falls back to the home
  // company when the cookie holds an id the home company alone can't
  // justify; the post-query re-check below still corrects it against the
  // full union when they differ.
  const cookieStore0 = await cookies();
  const requested0 = cookieStore0.get(CURRENT_COMPANY_COOKIE)?.value;
  const currentCompanyId = requested0 && requested0 === employee.company_id ? requested0 : employee.company_id;

  const [{ data: role }, { data: caps }, { data: access }, { data: storeAccess }, { data: coverage }, { data: allCompanies }, { data: allCapabilities }, { data: companyModules }] = await Promise.all([
    supabase.from("roles").select("name").eq("id", employee.role_id).single(),
    supabase.from("role_capabilities").select("capability_code").eq("role_id", employee.role_id),
    supabase.from("employee_company_access").select("company_id").eq("employee_id", employee.id),
    // 2026-08-08: which store(s) this login is actually assigned to work on
    // — used to scope the Ad Spend module for anyone without the separate
    // ad_spend_report_all capability. See employee_store_access in
    // db/schema.sql. Empty on purpose for most logins (Finance/MD/Admin/
    // Higher Authority bypass this via ad_spend_report_all instead).
    supabase.from("employee_store_access").select("store_id").eq("employee_id", employee.id),
    finSupabase
      .from("leave_coverage_assignments")
      .select("store_id")
      .eq("covering_employee_id", employee.id)
      .lte("from_date", today)
      .gte("to_date", today),
    finSupabase.from("companies").select("id, access_mode, onboarding_completed_at").eq("active", true),
    finSupabase.from("capabilities").select("code"),
    // 2026-09-15 — the current company's module selection. One tiny PK
    // lookup; a missing row means "everything on" (pre-wizard companies,
    // handled by the migration seeding existing rows anyway).
    finSupabase.from("company_modules").select("enabled_groups").eq("company_id", currentCompanyId).maybeSingle(),
  ]);

  const isPlatformOwner = employee.is_platform_owner === true;

  const coverageStoreIds = Array.from(new Set((coverage ?? []).map((c) => c.store_id)));
  // The store list (ad-spend/page.tsx) is fetched `.in("company_id",
  // employee.companyIds)` BEFORE it's ever filtered down to storeIds — so a
  // covering employee also needs the covered store's own COMPANY unioned
  // in for the duration, or the store would never even appear to filter
  // down to. Only one extra query, and only when there's active coverage.
  const coverageCompanyIds =
    coverageStoreIds.length > 0
      ? ((await finSupabase.from("stores").select("company_id").in("id", coverageStoreIds)).data ?? []).map(
          (s) => s.company_id
        )
      : [];

  const companyIds = isPlatformOwner
    ? (allCompanies ?? []).map((company) => company.id)
    : Array.from(new Set([employee.company_id, ...(access ?? []).map((a) => a.company_id), ...coverageCompanyIds]));
  const storeIds = Array.from(new Set([...(storeAccess ?? []).map((a) => a.store_id), ...coverageStoreIds]));

  // Post-query re-check: now that the FULL company union is known, honor a
  // cookie id that the pre-query resolution (home company only) couldn't
  // justify. Same trust rules as always — the id must be one of the
  // employee's companies.
  const requested = cookieStore0.get(CURRENT_COMPANY_COOKIE)?.value;
  const resolvedCompanyId =
    requested && requested !== currentCompanyId && companyIds.includes(requested) ? requested : currentCompanyId;
  const currentCompany = (allCompanies ?? []).find((company) => company.id === resolvedCompanyId);
  if (!isPlatformOwner && currentCompany?.access_mode === "suspended") {
    throw new UnauthorizedError("This workspace access is currently suspended.");
  }

  // 2026-09-15 — company module selection. roleCaps are what the ROLE
  // grants; enabledModuleGroups are which parts of the product the COMPANY
  // actually runs. The effective capability list is the intersection, so a
  // company that switched HR off during onboarding simply has no HR tiles
  // and its employees' attendance actions are rejected server-side too.
  // Platform owners always keep everything (they administer the platform,
  // not one workspace's feature set). The module lookup in the parallel
  // block above was keyed to the PRE-query company id — when the post-query
  // re-check switched to a different (still valid) company, re-read that
  // company's modules. Null groups / missing row = everything on.
  const finalCompanyId = resolvedCompanyId;
  let enabledGroups = ((companyModules?.enabled_groups as string[] | null) ?? []).filter(
    (g): g is string => typeof g === "string"
  );
  if (finalCompanyId !== currentCompanyId) {
    const { data: modules2 } = await finSupabase
      .from("company_modules")
      .select("enabled_groups")
      .eq("company_id", finalCompanyId)
      .maybeSingle();
    enabledGroups = ((modules2?.enabled_groups as string[] | null) ?? []).filter((g): g is string => typeof g === "string");
  }
  const roleCaps = isPlatformOwner
    ? [...(allCapabilities ?? []).map((capability) => capability.code), "platform_owner"]
    : (caps ?? []).map((c) => c.capability_code);
  const enabledCaps = enabledGroups.length > 0 ? new Set(capabilitiesForGroups(enabledGroups)) : null;
  const capabilities =
    isPlatformOwner || !enabledCaps
      ? roleCaps
      : roleCaps.filter((c) => c === "platform_owner" || enabledCaps.has(c));

  return {
    id: employee.id,
    homeCompanyId: employee.company_id,
    currentCompanyId: finalCompanyId,
    companyIds,
    storeIds,
    name: employee.name,
    photoUrl: employee.photo_url,
    roleId: employee.role_id,
    roleName: role?.name ?? "",
    capabilities,
    isPlatformOwner,
    enabledModuleGroups: enabledGroups,
    onboardingCompletedAt: currentCompany?.onboarding_completed_at ?? null,
  };
}

/**
 * The one-line guard every capability-gated Server Function should start
 * with — mirrors requireCapability_(p, capability) exactly:
 *
 *   export async function saveCreditNote(input: CreditNoteInput) {
 *     'use server'
 *     const employee = await requireCapability('doc_entry')
 *     ...
 *   }
 */
export async function requireCapability(capability: string): Promise<AuthedEmployee> {
  const employee = await getAuthedEmployee();
  if (!employee.capabilities.includes(capability)) {
    throw new ForbiddenError(capability);
  }
  return employee;
}

export async function requirePlatformOwner(): Promise<AuthedEmployee> {
  const employee = await getAuthedEmployee();
  if (!employee.isPlatformOwner) throw new ForbiddenError("platform_owner");
  return employee;
}
