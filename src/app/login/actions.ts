"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { recordPunchIn } from "@/lib/attendance/punch";

export type LoginState = { error: string | null };

/**
 * Signs in via Supabase Auth (email + password), matching the old system's
 * verifyLogin() gate — but the actual capability check happens per-page via
 * requireCapability(), not here. This just establishes "who is this".
 *
 * 2026-08-11: "EMPLOYEE KI SYSTEM KO LOGIN KARTE HI PERSENT LAG JAYE" —
 * auto-punch-in right after a successful login, best-effort (never blocks
 * or fails the login itself if this write has a problem — attendance is
 * important but must never be the reason someone can't get into the app).
 * Idempotent: if today's row already has a punch_in (e.g. a second login
 * the same day), recordPunchIn() leaves it untouched.
 */
export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Both email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Login failed — incorrect email or password." };
  }

  try {
    if (data.user) {
      const service = createServiceRoleClient();
      const { data: employee } = await service
        .from("employees")
        .select("id, company_id")
        .eq("auth_user_id", data.user.id)
        .eq("active", true)
        .maybeSingle();
      if (employee) {
        await recordPunchIn(service, employee.id, employee.company_id, "Web Punch");

        // 2026-09-15 — brand-new workspaces go through the onboarding
        // wizard (profile → company setup → module selection) before the
        // dashboard. Best-effort: if this lookup fails for any reason the
        // default /dashboard destination still works (the wizard page
        // re-checks and the dashboard just renders normally).
        const { data: company } = await service
          .from("companies")
          .select("onboarding_completed_at")
          .eq("id", employee.company_id)
          .maybeSingle();
        if (company && !company.onboarding_completed_at) {
          redirect("/dashboard/onboarding");
        }
      }
    }
  } catch (err) {
    // redirect() throws NEXT_REDIRECT — it MUST propagate, never be eaten
    // by this catch. Only genuine attendance/lookup failures fall through.
    if (err && typeof err === "object" && "digest" in err && typeof err.digest === "string" && err.digest.startsWith("NEXT_REDIRECT")) throw err;
    // Never let an attendance hiccup block a successful login.
  }

  redirect("/dashboard");
}
