// 2026-09-15 — shared storage upload helpers for company/employee images.
// Extracted from settings/branding/actions.ts's inline logic so the
// onboarding wizard's company-logo + owner-photo steps reuse the exact same
// bucket conventions (public `company-logos` bucket, `<owner>/<uuid>-<name>`
// paths) instead of forking a second uploader. Every caller passes a
// service-role client — these run inside already-authenticated Server
// Actions only.
import { randomUUID } from "node:crypto";

const LOGO_BUCKET = "company-logos";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — logos/photos don't need more

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 120);
}

// The service-role client is created with an untyped (`any`) Database
// generic upstream — reuse the same looseness here via eslint-disable rather
// than re-declaring the factory's type (its module namespace doesn't
// re-export the constructor type cleanly).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StorageClient = import("@supabase/supabase-js").SupabaseClient<any>;

/**
 * Uploads an image to the public company-logos bucket under the company's
 * folder and returns its public URL, or null when the bucket/file is
 * unavailable (e.g. the bucket migration hasn't run yet) — callers treat
 * null as "skip the logo, continue the flow", never as a hard failure.
 */
export async function uploadCompanyLogo(
  service: StorageClient,
  companyId: string,
  file: File
): Promise<string | null> {
  const path = `${companyId}/${randomUUID()}-${sanitizeName(file.name)}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await service.storage.from(LOGO_BUCKET).upload(path, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) {
      console.error("uploadCompanyLogo:", error.message);
      return null;
    }
    const { data } = service.storage.from(LOGO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("uploadCompanyLogo:", err);
    return null;
  }
}

/** Same bucket conventions for the owner's profile photo (own folder). */
export async function uploadEmployeePhoto(
  service: StorageClient,
  employeeId: string,
  file: File
): Promise<string | null> {
  const path = `employees/${employeeId}/${randomUUID()}-${sanitizeName(file.name)}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await service.storage.from(LOGO_BUCKET).upload(path, buffer, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (error) {
      console.error("uploadEmployeePhoto:", error.message);
      return null;
    }
    const { data } = service.storage.from(LOGO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error("uploadEmployeePhoto:", err);
    return null;
  }
}

export { MAX_IMAGE_BYTES };
