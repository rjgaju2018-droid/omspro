"use server";

// Error Tab — 2026-09-08. See db/2026-09-08-error-log.sql for the table and
// src/lib/error-log/log-entry-error.ts for the shared write helper other
// modules call into (courier-booking/actions.ts, orders/new/actions.ts).
//
// Two actions live here:
//   - flagEntryError: raising a manual flag needs NO capability — any
//     signed-in employee can flag something they notice is wrong (matches
//     the order detail page's own permissive read-access model, see
//     order-view.tsx's header comment). Deliberately just
//     getAuthedEmployee(), not requireCapability().
//   - resolveEntryError: closing a flag out (marking it resolved) requires
//     "error_log_view" — the same capability that gates viewing the tab at
//     all (Admin/MD only) — reviewing/closing is a review-team action, not
//     something every employee does.
import { revalidatePath } from "next/cache";
import { getAuthedEmployee, requireCapability } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logEntryError } from "@/lib/error-log/log-entry-error";

export type FlagErrorState = { error: string | null; success: boolean };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v ? v : null;
}

/**
 * "🚩 Flag as Error" — an employee explicitly marking something as wrong
 * from inside the app itself (source='manual'), e.g. from the order detail
 * page. Any signed-in employee may do this.
 */
export async function flagEntryError(_prev: FlagErrorState, formData: FormData): Promise<FlagErrorState> {
  const employee = await getAuthedEmployee();
  const supabase = createServiceRoleClient();

  const reason = str(formData, "reason");
  if (!reason) return { error: "Please describe what's wrong.", success: false };

  const referenceType = strOrNull(formData, "reference_type");
  const referenceId = strOrNull(formData, "reference_id");
  const referenceLabel = strOrNull(formData, "reference_label");
  const companyId = strOrNull(formData, "company_id") ?? employee.currentCompanyId;

  await logEntryError(supabase, {
    companyId,
    source: "manual",
    reason,
    referenceType,
    referenceId,
    referenceLabel,
    raisedByEmployeeId: employee.id,
    raisedByName: employee.name,
  });

  if (referenceType === "order" && referenceId) {
    revalidatePath(`/dashboard/orders/${referenceId}`);
  }
  revalidatePath("/dashboard/error-log");

  return { error: null, success: true };
}

export type SimpleResult = { error: string | null; success: boolean };

/** Mark a pending Error Tab entry resolved. Admin/MD only (error_log_view). */
export async function resolveEntryError(entryId: string, notes: string | null): Promise<SimpleResult> {
  const employee = await requireCapability("error_log_view");
  const supabase = createServiceRoleClient();

  const { data: entry } = await supabase.from("entry_errors").select("id, company_id").eq("id", entryId).single();
  if (!entry) return { error: "This entry was not found.", success: false };
  if (entry.company_id && !employee.companyIds.includes(entry.company_id)) {
    return { error: "You don't have access to this entry's company.", success: false };
  }

  const { error } = await supabase
    .from("entry_errors")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by_employee_id: employee.id,
      resolved_by_name: employee.name,
      resolution_notes: notes,
    })
    .eq("id", entryId);

  if (error) return { error: error.message, success: false };

  revalidatePath("/dashboard/error-log");
  return { error: null, success: true };
}

/** Reopen a resolved entry back to pending — a resolve marked by mistake. */
export async function reopenEntryError(entryId: string): Promise<SimpleResult> {
  const employee = await requireCapability("error_log_view");
  const supabase = createServiceRoleClient();

  const { data: entry } = await supabase.from("entry_errors").select("id, company_id").eq("id", entryId).single();
  if (!entry) return { error: "This entry was not found.", success: false };
  if (entry.company_id && !employee.companyIds.includes(entry.company_id)) {
    return { error: "You don't have access to this entry's company.", success: false };
  }

  const { error } = await supabase
    .from("entry_errors")
    .update({ status: "pending", resolved_at: null, resolved_by_employee_id: null, resolved_by_name: null, resolution_notes: null })
    .eq("id", entryId);

  if (error) return { error: error.message, success: false };

  revalidatePath("/dashboard/error-log");
  return { error: null, success: true };
}
