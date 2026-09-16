"use server";

// Bank & Credit-Card Reconciliation (2026-09-16) — see
// db/2026-09-16-bank-card-reconciliation.sql for the full design.
//
// User ask (Hindi): bank ke alawa dusre accounts (jisme pese aate hain) add
// karne ka option + unka statement upload karne ka option, jo AUTOMATIC
// match kar de (UTR/ref no/invoice no/party name se) — lekin purane payments
// ko disturb na kare. Ek se jyada credit card add ho sakein; card ki entry
// bhi mark ho; jo mark nahi hui vo bhi dikhe; check-and-verify karte hi
// payment reference auto link ho jaye; duplicate statement upload par
// duplicate entry na hoye.
//
// SAFETY GUARANTEES implemented here:
// 1. matchBankStatementLines / matchCardStatementLines RPCs are pure
//    SELECT-then-UPDATE-on-the-statement-line — they never INSERT/UPDATE any
//    bill_pass_register_payments row, so historical payments can never be
//    disturbed by running them (only Unmatched lines are considered).
// 2. Uploads are UPSERTS keyed on the DB's own (company_id, account_id,
//    line_fingerprint) unique index — the same statement re-uploaded (daily
//    ya monthly, jo bhi ho) dedupes at the DB level, the same backstop the
//    2026-08-17 payment-import double-run lacked.
// 3. Every write is company-scoped: the target account must belong to a
//    company in employee.companyIds (requireCapability gates the page).
import { requireCapability } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { readStatementFileRows } from "@/lib/bank-statement/parse";

export type SimpleResult = { error: string | null; success: boolean; message?: string };

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v ? v : null;
}
function numOrNull(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ── Accounts (bank + credit cards — jitne chahiye utne add karo) ────────────
export async function saveBankAccount(_prev: SimpleResult, formData: FormData): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const accountName = str(formData, "account_name");
  const accountType = str(formData, "account_type") || "Bank";
  if (!accountName) return { error: "Account name is required.", success: false };
  if (!["Bank", "Credit Card"].includes(accountType)) {
    return { error: "Account type must be Bank or Credit Card.", success: false };
  }

  const companyId = str(formData, "company_id") || employee.currentCompanyId;
  if (!employee.companyIds.includes(companyId)) {
    return { error: "You don't have access to that company.", success: false };
  }

  const payload: Record<string, unknown> = {
    company_id: companyId,
    account_name: accountName,
    account_type: accountType,
    bank_name: strOrNull(formData, "bank_name"),
    account_no: strOrNull(formData, "account_no"),
    ifsc_code: strOrNull(formData, "ifsc_code"),
    opening_balance: numOrNull(formData, "opening_balance") ?? 0,
  };
  if (accountType === "Credit Card") {
    payload.card_last4 = strOrNull(formData, "card_last4");
    payload.card_holder_name = strOrNull(formData, "card_holder_name");
    payload.credit_limit = numOrNull(formData, "credit_limit");
    payload.card_due_date = strOrNull(formData, "card_due_date");
  }

  const { error } = await supabase.from("bank_accounts").insert(payload);
  if (error) {
    if (error.message.toLowerCase().includes("duplicate key")) {
      return { error: "An account with this name already exists for this company.", success: false };
    }
    return { error: error.message, success: false };
  }

  revalidatePath("/dashboard/bank-reconciliation");
  return { error: null, success: true, message: "Account added." };
}

// ── Bank statement upload (CSV/Excel) — dedupe upsert + auto-match ─────────
export async function uploadBankStatement(_prev: SimpleResult, formData: FormData): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const accountId = str(formData, "account_id");
  if (!accountId) return { error: "Select the account this statement belongs to.", success: false };

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id, company_id, account_type")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "Account not found.", success: false };
  if (!employee.companyIds.includes(account.company_id)) {
    return { error: "You don't have access to that account's company.", success: false };
  }

  const parsed = await readStatementFileRows(formData.get("file"));
  if (parsed.error || !parsed.rows.length) {
    return { error: parsed.error ?? "No data rows found in the file.", success: false };
  }
  if (parsed.rows.length > 2000) {
    return { error: `${parsed.rows.length} rows — please upload 2,000 or fewer at a time.`, success: false };
  }

  const companyId = account.company_id;
  const dbRows = parsed.rows.map((r) => ({
    company_id: companyId,
    account_id: accountId,
    txn_no: r.txn_no,
    txn_date: r.txn_date,
    description: r.description,
    branch_name: r.branch_name,
    cheque_no: r.cheque_no,
    dr_amount: r.dr_amount,
    cr_amount: r.cr_amount,
    balance: r.balance,
    line_fingerprint: r.fingerprint,
    uploaded_by_employee_id: employee.id,
  }));

  // Upsert on the DB's own unique index — duplicates in this upload AND
  // duplicates against every previously-uploaded statement skip silently
  // (ignoreDuplicates), so a monthly or daily re-download never double-counts.
  const { error, count } = await supabase
    .from("bank_statement_lines")
    .upsert(dbRows, { onConflict: "company_id,account_id,line_fingerprint", ignoreDuplicates: true, count: "exact" })
    .select("id");

  if (error) {
    return {
      error: error.message.includes("duplicate key")
        ? "Duplicate rows detected that don't share the exact fingerprint — check for manual edits in the file."
        : error.message,
      success: false,
    };
  }

  // Auto-match right after upload (bank side: bills + portal). Read-only
  // over payments — purane payments kabhi disturb nahi hote.
  await supabase.rpc("match_bank_statement_lines", {
    p_company_id: companyId,
    p_account_id: accountId,
    p_source: "all",
  });

  revalidatePath("/dashboard/bank-reconciliation");
  const inserted = count ?? 0;
  const skipped = dbRows.length - inserted;
  return {
    error: null,
    success: true,
    message:
      `${inserted} new line${inserted === 1 ? "" : "s"} imported, ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped. ` +
      `Auto-match ran — review the proposals below and ✓ Verify.`,
  };
}

// ── Credit-card statement upload — same dedupe guarantees ──────────────────
export async function uploadCardStatement(_prev: SimpleResult, formData: FormData): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const accountId = str(formData, "account_id");
  if (!accountId) return { error: "Select the card this statement belongs to.", success: false };

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id, company_id, account_type")
    .eq("id", accountId)
    .single();
  if (!account || account.account_type !== "Credit Card") {
    return { error: "Select a Credit Card account.", success: false };
  }
  if (!employee.companyIds.includes(account.company_id)) {
    return { error: "You don't have access to that card's company.", success: false };
  }

  const parsed = await readStatementFileRows(formData.get("file"));
  if (parsed.error || !parsed.rows.length) {
    return { error: parsed.error ?? "No data rows found in the file.", success: false };
  }
  if (parsed.rows.length > 2000) {
    return { error: `${parsed.rows.length} rows — please upload 2,000 or fewer at a time.`, success: false };
  }

  const companyId = account.company_id;
  const dbRows = parsed.rows
    .map((r) => {
      // A card statement may carry the amount in one column with a sign or
      // a Dr/Cr label — normalize into amount + direction.
      let amount = r.cr_amount ?? r.dr_amount;
      let direction: "Debit" | "Credit" = r.cr_amount != null ? "Credit" : "Debit";
      if (r.dr_amount != null && r.cr_amount == null && r.dr_amount < 0) {
        // negative single-column format = payment received INTO the card
        amount = Math.abs(r.dr_amount);
        direction = "Credit";
      }
      if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
      return {
        account_id: accountId,
        company_id: companyId,
        statement_month: r.statement_month,
        txn_date: r.txn_date,
        description: r.description,
        reference_no: r.cheque_no ?? r.txn_no,
        card_last4: str(formData, "card_last4") || null,
        amount,
        txn_direction: direction,
        txn_category: r.branch_name, // free-text category column reused
        line_fingerprint: [
          r.txn_date ?? "",
          direction.toLowerCase(),
          amount,
          (r.description ?? "").toLowerCase().replace(/\s+/g, " ").trim(),
        ].join("|"),
        uploaded_by_employee_id: employee.id,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!dbRows.length) return { error: "No rows with a valid amount + date were found in the file.", success: false };

  const { error, count } = await supabase
    .from("credit_card_statement_lines")
    .upsert(dbRows, { onConflict: "account_id,line_fingerprint", ignoreDuplicates: true, count: "exact" })
    .select("id");

  if (error) return { error: error.message, success: false };

  await supabase.rpc("match_card_statement_lines", {
    p_company_id: companyId,
    p_account_id: accountId,
  });

  revalidatePath("/dashboard/bank-reconciliation");
  const inserted = count ?? 0;
  const skipped = dbRows.length - inserted;
  return {
    error: null,
    success: true,
    message: `${inserted} new card line${inserted === 1 ? "" : "s"} imported, ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped. Auto-match ran.`,
  };
}

// ── Verify — "check and verify karte hi payment reference auto link ho jaye"
export async function verifyBankLine(lineId: string): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const { data: line } = await supabase
    .from("bank_statement_lines")
    .select("id, company_id, match_status")
    .eq("id", lineId)
    .single();
  if (!line) return { error: "Statement line not found.", success: false };
  if (!employee.companyIds.includes(line.company_id)) {
    return { error: "You don't have access to this line's company.", success: false };
  }

  // Auto-link: line abhi bhi Unmatched hai to verify se pehle matcher ko
  // ek mauka do (p_line_id scoped — sirf isi line par chalega).
  if (line.match_status === "Unmatched") {
    await supabase.rpc("match_bank_statement_lines", {
      p_company_id: line.company_id,
      p_account_id: (await supabase.from("bank_statement_lines").select("account_id").eq("id", lineId).single()).data
        ?.account_id,
      p_line_id: lineId,
    });
  }

  const { error } = await supabase.rpc("verify_bank_statement_line", {
    p_line_id: lineId,
    p_by_employee_id: employee.id,
  });
  if (error) return { error: error.message, success: false };

  revalidatePath("/dashboard/bank-reconciliation");
  return { error: null, success: true };
}

export async function verifyCardLine(lineId: string): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const { data: line } = await supabase
    .from("credit_card_statement_lines")
    .select("id, company_id, account_id, match_status")
    .eq("id", lineId)
    .single();
  if (!line) return { error: "Card line not found.", success: false };
  if (!employee.companyIds.includes(line.company_id)) {
    return { error: "You don't have access to this line's company.", success: false };
  }

  if (line.match_status === "Unmatched") {
    await supabase.rpc("match_card_statement_lines", {
      p_company_id: line.company_id,
      p_account_id: line.account_id,
      p_line_id: lineId,
    });
  }

  const { error } = await supabase.rpc("verify_card_statement_line", {
    p_line_id: lineId,
    p_by_employee_id: employee.id,
  });
  if (error) return { error: error.message, success: false };

  revalidatePath("/dashboard/bank-reconciliation");
  return { error: null, success: true };
}

// Mark a line that genuinely has no ledger counterpart (fees, ATM, personal)
// — it stays visible in the missed-entries list as "No Ledger Match" instead
// of "Unmatched", so the Unmatched list stays honest.
export async function markNoLedgerMatch(kind: "bank" | "card", lineId: string): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const table = kind === "bank" ? "bank_statement_lines" : "credit_card_statement_lines";
  const { data: line } = await supabase.from(table).select("id, company_id").eq("id", lineId).single();
  if (!line) return { error: "Line not found.", success: false };
  if (!employee.companyIds.includes(line.company_id)) {
    return { error: "You don't have access to this line's company.", success: false };
  }

  const { error } = await supabase
    .from(table)
    .update({
      match_status: "No Ledger Match",
      match_source: kind === "bank" ? "manual" : "manual",
      verified_by_employee_id: employee.id,
      verified_at: new Date().toISOString(),
    })
    .eq("id", lineId);
  if (error) return { error: error.message, success: false };

  revalidatePath("/dashboard/bank-reconciliation");
  return { error: null, success: true };
}

// Re-run the matcher for one account (naya payment entry hone ke baad).
export async function rematchAccount(accountId: string): Promise<SimpleResult> {
  const employee = await requireCapability("bank_reconciliation");
  const supabase = createServiceRoleClient();

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id, company_id, account_type")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "Account not found.", success: false };
  if (!employee.companyIds.includes(account.company_id)) {
    return { error: "You don't have access to that account's company.", success: false };
  }

  const rpc =
    account.account_type === "Credit Card" ? "match_card_statement_lines" : "match_bank_statement_lines";
  const { error } = await supabase.rpc(rpc, {
    p_company_id: account.company_id,
    p_account_id: accountId,
    ...(account.account_type === "Credit Card" ? {} : { p_source: "all" }),
  });
  if (error) return { error: error.message, success: false };

  revalidatePath("/dashboard/bank-reconciliation");
  return { error: null, success: true };
}
