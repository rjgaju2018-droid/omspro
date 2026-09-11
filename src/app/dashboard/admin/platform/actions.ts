"use server";

import { requirePlatformOwner } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null;
}

export async function updateCustomerControls(formData: FormData): Promise<void> {
  const owner = await requirePlatformOwner();
  const companyId = String(formData.get("company_id") ?? "");
  const accessMode = String(formData.get("access_mode") ?? "paid");
  const plan = String(formData.get("plan") ?? "trial");
  const discount = Number(formData.get("discount_percent") ?? 0);
  const monthlyPrice = numberOrNull(formData.get("monthly_price_inr"));

  if (!owner.companyIds.includes(companyId)) throw new Error("Company is not accessible.");
  if (!["paid", "free", "suspended"].includes(accessMode)) throw new Error("Invalid access mode.");
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error("Discount must be 0 to 100%.");
  if (!["trial", "starter", "growth", "enterprise"].includes(plan)) throw new Error("Invalid plan.");

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("companies")
    .update({
      access_mode: accessMode as "paid" | "free" | "suspended",
      plan,
      monthly_price_inr: monthlyPrice,
      discount_percent: discount,
    })
    .eq("id", companyId);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/platform");
  revalidatePath("/dashboard/billing");
}