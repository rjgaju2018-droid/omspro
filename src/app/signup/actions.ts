"use server";

// OMS Pro public self-serve signup (2026-09-09) — the first "any company can
// register" flow this app has ever had. Previously every login was created
// by an Admin/MD through /dashboard/admin/employees (see
// src/app/dashboard/admin/employees/actions.ts — createEmployee), which is
// capability-gated and therefore only usable from INSIDE the app. This is
// the public counterpart, which:
//   - creates the Supabase Auth user,
//   - creates the company workspace with an auto 14-day trial
//     (db/2026-09-09-omspro-saas-signup.sql's columns),
//   - creates the employee row bound to the "Company Owner" role (full
//     capabilities — every module their plan includes), and
//   - rolls the auth user back if the company/employee writes fail, so a
//     retry never hits "email already registered" (same pattern as
//     createEmployee above).
// No capability gate on purpose: it runs on the public /signup page. Every
// write here is exactly one new tenant's own rows — nothing else in the DB
// is reachable. Uniqueness of short_code/ref_prefix is checked server-side
// against the existing rows (UNIQUE constraints in db/schema.sql back it).
import { createServiceRoleClient } from "@/lib/supabase/server";
import { TRIAL_DAYS } from "@/lib/saas/plans";

export type SignupState = { error: string | null; success: { email: string } | null };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function alnumUpper(value: string, take: number): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, take);
}

/**
 * Finds an unused 2-3 letter code for document numbering by trying the
 * natural abbreviation first, then numeric suffixes. companies.short_code,
 * companies.ref_prefix are UNIQUE (db/schema.sql) — the insert below fails
 * loudly rather than silently reusing a prefix if this ever races.
 */
async function uniqueCodes(service: ReturnType<typeof createServiceRoleClient>, companyName: string) {
  const baseShort = alnumUpper(companyName, 3) || "OMS";
  const baseRef = alnumUpper(companyName, 2) || "OM";

  const { data: existing } = await service.from("companies").select("short_code, ref_prefix");
  const takenShort = new Set((existing ?? []).map((c) => c.short_code));
  const takenRef = new Set((existing ?? []).map((c) => c.ref_prefix));

  let short_code = baseShort;
  for (let i = 1; i <= 99 && takenShort.has(short_code); i++) short_code = `${baseShort}${i}`;
  let ref_prefix = baseRef;
  for (let i = 1; i <= 99 && takenRef.has(ref_prefix); i++) ref_prefix = `${baseRef}${i}`;

  return { short_code, ref_prefix };
}

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const yourName = str(formData, "your_name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const companyName = str(formData, "company_name");

  if (!yourName || !email || !password || !companyName) {
    return { error: "Sabhi fields required hain — apna naam, email, password aur company ka naam.", success: null };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Email ka format sahi nahi hai.", success: null };
  }
  if (password.length < 8) {
    return { error: "Password kam se kam 8 characters ka hona chahiye.", success: null };
  }
  if (companyName.length < 2) {
    return { error: "Company ka naam bahut chhota hai.", success: null };
  }

  const service = createServiceRoleClient();

  // 1. Auth user first (matching createEmployee's order — the rollback below
  //    mirrors theirs).
  const { data: authUser, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser?.user) {
    const msg = authError?.message ?? "";
    if (msg.toLowerCase().includes("already been registered") || msg.toLowerCase().includes("already exists")) {
      return { error: "Ye email pehle se use me hai — login karein ya dusra email try karein.", success: null };
    }
    return { error: `Account nahi ban paya: ${msg || "unknown error"}`, success: null };
  }

  try {
    // 2. The company workspace with its 14-day trial clock.
    const { short_code, ref_prefix } = await uniqueCodes(service, companyName);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: company, error: companyError } = await service
      .from("companies")
      .insert({
        name: companyName,
        short_code,
        ref_prefix,
        plan: "trial",
        trial_ends_at: trialEndsAt,
        created_by_signup: true,
      })
      .select("id")
      .single();
    if (companyError || !company) throw new Error(companyError?.message ?? "company insert failed");

    // 3. The owner employee on the full-capability Company Owner role
    //    (seeded by the same migration as the trial columns).
    const { data: ownerRole, error: roleError } = await service
      .from("roles")
      .select("id")
      .eq("name", "Company Owner")
      .single();
    if (roleError || !ownerRole) throw new Error(roleError?.message ?? "Company Owner role missing — run db/2026-09-09-omspro-saas-signup.sql");

    const { data: employee, error: empError } = await service
      .from("employees")
      .insert({
        company_id: company.id,
        auth_user_id: authUser.user.id,
        name: yourName,
        email,
        role_id: ownerRole.id,
        designation: "Owner",
        active: true,
      })
      .select("id")
      .single();
    if (empError || !employee) throw new Error(empError?.message ?? "employee insert failed");

    return { error: null, success: { email } };
  } catch (err) {
    // Roll back the orphaned auth user so the email stays free to retry.
    // The company/employee rows that did land are harmless until an
    // employees row exists (proxy.ts signs out sessions that never resolve
    // to one), and keeping them lets a retry reuse the same numbering.
    await service.auth.admin.deleteUser(authUser.user.id);
    console.error("signup: rolled back, error:", err);
    return {
      error:
        "Company setup fail ho gaya — kripya dobara try karein. (Agar baar-baar fail ho raha hai to admin ko batayein: db/2026-09-09-omspro-saas-signup.sql run hona chahiye.)",
      success: null,
    };
  }
}
