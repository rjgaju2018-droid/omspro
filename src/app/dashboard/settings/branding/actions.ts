"use server";

// 2026-09-09 — subscriber company branding: upload/replace/remove the
// company's own logo. Gating: any ACTIVE employee of the current company
// may upload (the logo is shared company branding, not a capability tile;
// matches how the theme page is open to everyone — it only affects this
// company's own look). The file goes to the public `company-logos` bucket;
// companies.logo_url stores the public URL which the dashboard header and
// printed invoices already render.
//
// OMS Pro's own logo is deliberately NOT distributed here — the platform
// brand stays on marketing pages and in the export watermark line.
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getAuthedEmployee } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";

const LOGO_BUCKET = "company-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — logos don't need more

export type BrandingResult = { url: string | null; error: string | null };

export async function uploadCompanyLogo(formData: FormData): Promise<BrandingResult> {
  let employee;
  try {
    employee = await getAuthedEmployee();
  } catch {
    return { url: null, error: "Not signed in." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { url: null, error: "No file selected." };
  if (file.size > MAX_LOGO_BYTES) return { url: null, error: "Logo is too large — max 2 MB." };
  if (!file.type.startsWith("image/")) return { url: null, error: "Please upload an image file (PNG/JPG/SVG)." };

  const supabase = createServiceRoleClient();
  const safeName = file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const path = `${employee.currentCompanyId}/${randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { url: null, error: `Upload failed: ${uploadError.message}` };

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: url })
    .eq("id", employee.currentCompanyId);
  if (updateError) return { url: null, error: `Could not save the logo: ${updateError.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/branding");
  return { url, error: null };
}

export async function removeCompanyLogo(): Promise<BrandingResult> {
  let employee;
  try {
    employee = await getAuthedEmployee();
  } catch {
    return { url: null, error: "Not signed in." };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("companies")
    .update({ logo_url: null })
    .eq("id", employee.currentCompanyId);
  if (error) return { url: null, error: `Could not remove the logo: ${error.message}` };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/branding");
  return { url: null, error: null };
}
