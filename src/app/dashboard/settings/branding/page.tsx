import { getAuthedEmployee } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { BrandingPanel } from "./branding-panel";

// 2026-09-09 — Company Branding settings: the subscriber uploads its own
// logo; it renders in the dashboard header and on printed/exported
// documents (via companies.logo_url, already wired everywhere). Open to
// every signed-in employee of the company — same reasoning as Theme
// (personalization/branding of one's own workspace, no capability tile).
export const metadata = { title: "Company Branding — OMS Pro" };

export default async function BrandingPage() {
  const employee = await getAuthedEmployee();
  const service = createServiceRoleClient();
  const { data: company } = await service
    .from("companies")
    .select("name, logo_url")
    .eq("id", employee.currentCompanyId)
    .single();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--oms-text)]">Company Branding</h1>
        <p className="mt-0.5 text-sm text-[var(--oms-text-muted)]">
          Upload your company&apos;s logo — it appears in the dashboard header and on your printed invoices and
          documents. The OMS Pro mark stays on the marketing site and as a small &quot;Powered by OMS Pro&quot; line on
          exported files.
        </p>
      </div>
      <BrandingPanel companyName={company?.name ?? "Your company"} initialLogoUrl={company?.logo_url ?? null} />
    </div>
  );
}
