import Link from "next/link";
import { requireCapability } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { BankReconciliationClient } from "./bank-reconciliation-client";

// Bank & Credit-Card Reconciliation (2026-09-16) — the dashboard tile for
// capability `bank_reconciliation` (see
// db/2026-09-16-bank-card-reconciliation.sql for the full design rationale:
// multiple bank accounts + credit cards per company, statement upload with
// DB-level dedupe, read-only auto-matching against the payment/portal
// ledgers, verify-to-link, and a missed-entries list that keeps both marked
// and unmarked lines visible).
export default async function BankReconciliationPage() {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();
  const companyId = employee.currentCompanyId;

  const [
    { data: accounts },
    { data: matchRows },
    { data: cardSummaries },
    { data: monthlyCheck },
  ] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("company_id", companyId)
      .order("account_type")
      .order("account_name"),
    supabase
      .from("bank_statement_match_view")
      .select("*")
      .eq("company_id", companyId)
      .order("txn_date", { ascending: false })
      .limit(500),
    supabase
      .from("card_statement_summary_view")
      .select("*")
      .eq("company_id", companyId),
    supabase
      .from("bank_vs_portal_monthly_view")
      .select("*")
      .eq("company_id", companyId)
      .order("month", { ascending: false })
      .limit(12),
  ]);

  const cardLineCounts = new Map(
    (cardSummaries ?? []).map((c) => [c.account_id, { spent: c.total_spent, paid: c.total_paid, outstanding: c.card_outstanding, pending: c.pending_match_count }])
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">🏦 Bank &amp; Card Reconciliation</h1>
        </div>
        <Link
          href="/dashboard/csv-upload"
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          📤 Portal statement CSVs
        </Link>
      </div>

      <BankReconciliationClient
        companies={(await supabase.from("companies").select("id, name").in("id", employee.companyIds).order("name")).data ?? []}
        currentCompanyId={companyId}
        accounts={accounts ?? []}
        matchRows={matchRows ?? []}
        cardSummaries={cardSummaries ?? []}
        monthlyCheck={monthlyCheck ?? []}
      />
    </div>
  );
}
