"use client";

import { useActionState, useState, useTransition } from "react";
import {
  markNoLedgerMatch,
  saveBankAccount,
  uploadBankStatement,
  uploadCardStatement,
  verifyBankLine,
  verifyCardLine,
  type SimpleResult,
} from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";
const labelClass = "mb-1 block text-xs font-medium text-slate-500";
const initialState: SimpleResult = { error: null, success: false };

type Account = {
  id: string;
  company_id: string;
  account_name: string;
  account_type: string;
  bank_name: string | null;
  account_no: string | null;
  ifsc_code: string | null;
  card_last4: string | null;
  card_holder_name: string | null;
  credit_limit: number | null;
  card_due_date: string | null;
  opening_balance: number;
  active: boolean;
};

type MatchRow = {
  line_id: string;
  account_id: string;
  account_name: string;
  account_type: string;
  txn_date: string | null;
  txn_no: string | null;
  description: string | null;
  dr_amount: number | null;
  cr_amount: number | null;
  balance: number | null;
  match_status: string;
  match_source: string | null;
  match_confidence: string | null;
  match_reason: string | null;
  matched_invoice_no: string | null;
  matched_vendor_invoice_no: string | null;
  matched_payment_amount: number | null;
  matched_payment_date: string | null;
  matched_reference_no: string | null;
  matched_payment_remark: string | null;
};

type CardSummary = {
  account_id: string;
  company_id: string;
  account_name: string;
  bank_name: string | null;
  card_last4: string | null;
  credit_limit: number | null;
  card_due_date: string | null;
  total_spent: number;
  total_paid: number;
  card_outstanding: number;
  available_limit: number;
  pending_match_count: number;
  total_txn_count: number;
};

type MonthlyCheck = {
  company_id: string;
  account_id: string;
  account_name: string;
  month: string;
  portal_etsy_inr: number;
  portal_amazon_inr: number;
  bank_etsy_inr: number;
  bank_amazon_inr: number;
  bank_other_inr: number;
  etsy_variance_inr: number;
  amazon_variance_inr: number;
};

const inr = (n: number | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const statusBadge: Record<string, string> = {
  Verified: "bg-green-100 text-green-800",
  Proposed: "bg-amber-100 text-amber-800",
  Unmatched: "bg-red-100 text-red-700",
  "No Ledger Match": "bg-slate-200 text-slate-600",
};

export function BankReconciliationClient({
  companies,
  currentCompanyId,
  accounts,
  matchRows,
  cardSummaries,
  monthlyCheck,
}: {
  companies: { id: string; name: string }[];
  currentCompanyId: string;
  accounts: Account[];
  matchRows: MatchRow[];
  cardSummaries: CardSummary[];
  monthlyCheck: MonthlyCheck[];
}) {
  const [tab, setTab] = useState<"bank" | "card" | "monthly">("bank");
  const bankAccounts = accounts.filter((a) => a.account_type === "Bank");
  const cardAccounts = accounts.filter((a) => a.account_type === "Credit Card");
  const activeTabAccounts = tab === "card" ? cardAccounts : bankAccounts;
  const [filter, setFilter] = useState<"all" | "Unmatched" | "Proposed" | "Verified">("all");
  const shownRows = matchRows.filter(
    (r) =>
      (tab === "card" ? r.account_type === "Credit Card" : r.account_type !== "Credit Card") &&
      (filter === "all" || r.match_status === filter)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {(
          [
            ["bank", `🏦 Bank Accounts (${bankAccounts.length})`],
            ["card", `💳 Credit Cards (${cardAccounts.length})`],
            ["monthly", "📆 Monthly Cross-check"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === key ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <AccountsStrip accounts={activeTabAccounts} cardSummaries={cardSummaries} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <UploadForm tab={tab} accounts={activeTabAccounts} />
        <AddAccountForm tab={tab} companies={companies} currentCompanyId={currentCompanyId} />
        <MatchSummary matchRows={matchRows} tab={tab} />
      </div>

      <MatchReviewTable
        rows={shownRows}
        filter={filter}
        setFilter={setFilter}
        onVerify={tab === "card" ? verifyCardLine : verifyBankLine}
      />

      {tab === "monthly" && <MonthlyTable monthlyCheck={monthlyCheck} />}
    </div>
  );
}

function AccountsStrip({ accounts, cardSummaries }: { accounts: Account[]; cardSummaries: CardSummary[] }) {
  const summaryByAccount = new Map(cardSummaries.map((c) => [c.account_id, c]));
  if (!accounts.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Koi account add nahi hua hai — neeche form se pehla bank account ya credit card add karo.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {accounts.map((a) => {
        const s = summaryByAccount.get(a.id);
        return (
          <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{a.account_name}</p>
                <p className="text-xs text-slate-500">
                  {a.bank_name ?? "—"} {a.account_no ? `••${a.account_no.slice(-4)}` : a.card_last4 ? `••${a.card_last4}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.account_type === "Credit Card" ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"}`}>
                {a.account_type}
              </span>
            </div>
            {a.account_type === "Credit Card" && s ? (
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between"><dt className="text-slate-500">Spent</dt><dd className="font-medium">{inr(s.total_spent)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Paid back</dt><dd className="font-medium text-green-700">{inr(s.total_paid)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Outstanding</dt><dd className="font-semibold text-red-600">{inr(s.card_outstanding)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Available</dt><dd>{inr(s.available_limit)}</dd></div>
                {s.pending_match_count > 0 && (
                  <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">⚠️ {s.pending_match_count} lines pending match</p>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Opening: {inr(a.opening_balance)}</p>
            )}
            {a.account_type === "Credit Card" && a.card_due_date && (
              <p className="mt-1 text-[11px] text-slate-400">Bill due {a.card_due_date}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UploadForm({ tab, accounts }: { tab: "bank" | "card" | "monthly"; accounts: Account[] }) {
  const isCard = tab === "card";
  const [state, formAction, pending] = useActionState(isCard ? uploadCardStatement : uploadBankStatement, initialState);
  const formKey = isCard ? "card" : "bank";

  return (
    <form key={formKey} action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">
        {isCard ? "💳 Upload Card Statement" : "🏦 Upload Bank Statement"}
      </h2>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>}
      {state.success && state.message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">✓ {state.message}</p>
      )}
      <div>
        <label className={labelClass} htmlFor={`account_id_${formKey}`}>Account *</label>
        <select id={`account_id_${formKey}`} name="account_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>Select {isCard ? "card" : "account"}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.account_name}</option>
          ))}
        </select>
      </div>
      {isCard && (
        <div>
          <label className={labelClass} htmlFor="card_last4">Card last 4 (if multi-card statement)</label>
          <input id="card_last4" name="card_last4" maxLength={4} className={inputClass} />
        </div>
      )}
      <div>
        <label className={labelClass} htmlFor={`file_${formKey}`}>CSV / Excel file *</label>
        <input
          id={`file_${formKey}`}
          name="file"
          type="file"
          accept=".csv,.xlsx,.xls"
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-amber-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-amber-700"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Columns auto-adjust (Date/Description/Debit/Credit/Balance — koi bhi spelling chalega). Same file dobara
          upload karne par duplicate entry nahi hogi.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
      >
        {pending ? "Uploading & matching..." : "Upload & Auto-Match"}
      </button>
    </form>
  );
}

function AddAccountForm({
  tab,
  companies,
  currentCompanyId,
}: {
  tab: "bank" | "card" | "monthly";
  companies: { id: string; name: string }[];
  currentCompanyId: string;
}) {
  const isCard = tab === "card";
  const [state, formAction, pending] = useActionState(saveBankAccount, initialState);
  const formKey = isCard ? "card-add" : "bank-add";

  return (
    <form key={formKey} action={formAction} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">
        {isCard ? "➕ Add Credit Card" : "➕ Add Bank Account"}
      </h2>
      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{state.error}</p>}
      {state.success && state.message && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">✓ {state.message}</p>}
      <input type="hidden" name="account_type" value={isCard ? "Credit Card" : "Bank"} />
      <input type="hidden" name="company_id" value={currentCompanyId} />
      <div>
        <label className={labelClass} htmlFor={`account_name_${formKey}`}>Name *</label>
        <input id={`account_name_${formKey}`} name="account_name" required placeholder={isCard ? "HDFC Amazon Card" : "PNB Current"} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor={`bank_name_${formKey}`}>Bank</label>
          <input id={`bank_name_${formKey}`} name="bank_name" placeholder="PNB / HDFC / ICICI" className={inputClass} />
        </div>
        {isCard ? (
          <>
            <div>
              <label className={labelClass} htmlFor={`card_last4_${formKey}`}>Last 4</label>
              <input id={`card_last4_${formKey}`} name="card_last4" maxLength={4} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`credit_limit_${formKey}`}>Credit limit</label>
              <input id={`credit_limit_${formKey}`} name="credit_limit" type="number" step="0.01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`card_due_date_${formKey}`}>Bill due date</label>
              <input id={`card_due_date_${formKey}`} name="card_due_date" type="date" className={inputClass} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelClass} htmlFor={`account_no_${formKey}`}>A/c no.</label>
              <input id={`account_no_${formKey}`} name="account_no" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`ifsc_code_${formKey}`}>IFSC</label>
              <input id={`ifsc_code_${formKey}`} name="ifsc_code" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`opening_balance_${formKey}`}>Opening bal.</label>
              <input id={`opening_balance_${formKey}`} name="opening_balance" type="number" step="0.01" defaultValue={0} className={inputClass} />
            </div>
          </>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-60"
      >
        {pending ? "Saving..." : "Add"}
      </button>
    </form>
  );
}

function MatchSummary({ matchRows, tab }: { matchRows: MatchRow[]; tab: "bank" | "card" | "monthly" }) {
  const relevant = matchRows.filter((r) => (tab === "card" ? r.account_type === "Credit Card" : r.account_type !== "Credit Card"));
  const counts = {
    Verified: relevant.filter((r) => r.match_status === "Verified").length,
    Proposed: relevant.filter((r) => r.match_status === "Proposed").length,
    Unmatched: relevant.filter((r) => r.match_status === "Unmatched").length,
    "No Ledger Match": relevant.filter((r) => r.match_status === "No Ledger Match").length,
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800">Reconciliation status</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">✅ Verified</dt>
          <dd className="font-semibold text-green-700">{counts.Verified}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">🟡 Proposed (verify karo)</dt>
          <dd className="font-semibold text-amber-600">{counts.Proposed}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">🔴 Unmatched (missed?)</dt>
          <dd className="font-semibold text-red-600">{counts.Unmatched}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">⚪ No Ledger Match</dt>
          <dd className="font-medium text-slate-500">{counts["No Ledger Match"]}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] text-slate-400">
        Matching sirf statement lines ko update karti hai — kisi purane payment row ko kabhi touch nahi karti.
      </p>
    </div>
  );
}

function MatchReviewTable({
  rows,
  filter,
  setFilter,
  onVerify,
}: {
  rows: MatchRow[];
  filter: "all" | "Unmatched" | "Proposed" | "Verified";
  setFilter: (f: "all" | "Unmatched" | "Proposed" | "Verified") => void;
  onVerify: (lineId: string) => Promise<SimpleResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = (fn: () => Promise<unknown>) => {
    startTransition(async () => {
      await fn();
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Statement lines — review &amp; verify ({rows.length})</h2>
        <div className="flex gap-1">
          {(["all", "Proposed", "Unmatched", "Verified"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                filter === f ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">DR</th>
              <th className="px-3 py-2 text-right">CR</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Linked payment / reason</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  Koi line nahi — statement upload karo.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.line_id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{r.txn_date ?? "—"}</td>
                <td className="max-w-[260px] px-3 py-2">
                  <p className="truncate text-slate-800" title={r.description ?? ""}>{r.description ?? "—"}</p>
                  <p className="text-[10px] text-slate-400">{r.account_name}</p>
                </td>
                <td className="px-3 py-2 text-right text-red-600">{r.dr_amount != null ? inr(r.dr_amount) : ""}</td>
                <td className="px-3 py-2 text-right text-green-700">{r.cr_amount != null ? inr(r.cr_amount) : ""}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge[r.match_status] ?? "bg-slate-100"}`}>
                    {r.match_status}
                  </span>
                  {r.match_confidence && <p className="mt-1 text-[10px] text-slate-400">{r.match_confidence}</p>}
                </td>
                <td className="max-w-[300px] px-3 py-2 text-slate-600">
                  {r.matched_reference_no || r.matched_invoice_no || r.matched_vendor_invoice_no ? (
                    <p>
                      {r.matched_invoice_no ?? r.matched_vendor_invoice_no ?? "Payment"} — {inr(r.matched_payment_amount)} @ {r.matched_payment_date}
                      {r.matched_reference_no && <span className="block text-[10px] text-slate-400">Ref: {r.matched_reference_no}</span>}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">{r.match_reason ?? "—"}</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {r.match_status !== "Verified" && (
                    <button
                      type="button"
                      disabled={pending || busyId === r.line_id}
                      onClick={() => {
                        setBusyId(r.line_id);
                        act(async () => {
                          const res = await onVerify(r.line_id);
                          setBusyId(null);
                          if (res.error) console.error(res.error);
                        });
                      }}
                      className="rounded-lg bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      ✓ Verify
                    </button>
                  )}
                  {r.match_status === "Unmatched" && (
                    <button
                      type="button"
                      disabled={pending || busyId === r.line_id}
                      onClick={() => {
                        setBusyId(r.line_id);
                        act(async () => {
                          await markNoLedgerMatch("bank", r.line_id);
                          setBusyId(null);
                        });
                      }}
                      className="ml-1 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      No match
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
        ✓ Verify karte hi payment reference auto-link lock ho jata hai —Verified lines dobara re-propose nahi hoti,
        isliye calculation kabhi gadbadi nahi karti.
      </p>
    </div>
  );
}

function MonthlyTable({ monthlyCheck }: { monthlyCheck: MonthlyCheck[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Monthly cross-check — portal sale vs bank inflow</h2>
        <p className="text-[11px] text-slate-400">
          Har mahine Etsy/Amazon statement ka total vs bank me actually aaye paise — variance = koi entry miss hui ya
          calculation off hai, turant dikh jayega.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2 text-right">Etsy (portal)</th>
              <th className="px-3 py-2 text-right">Etsy (bank)</th>
              <th className="px-3 py-2 text-right">Etsy variance</th>
              <th className="px-3 py-2 text-right">Amazon (portal)</th>
              <th className="px-3 py-2 text-right">Amazon (bank)</th>
              <th className="px-3 py-2 text-right">Amazon variance</th>
            </tr>
          </thead>
          <tbody>
            {monthlyCheck.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                  Abhi koi monthly data nahi — statement upload hone par bharega.
                </td>
              </tr>
            )}
            {monthlyCheck.map((m) => {
              const ev = Math.abs(m.etsy_variance_inr) > 1;
              const av = Math.abs(m.amazon_variance_inr) > 1;
              return (
                <tr key={`${m.account_id}-${m.month}`} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{m.month}</td>
                  <td className="px-3 py-2 text-slate-600">{m.account_name}</td>
                  <td className="px-3 py-2 text-right">{inr(m.portal_etsy_inr)}</td>
                  <td className="px-3 py-2 text-right">{inr(m.bank_etsy_inr)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${ev ? "text-red-600" : "text-green-700"}`}>
                    {inr(m.etsy_variance_inr)}
                  </td>
                  <td className="px-3 py-2 text-right">{inr(m.portal_amazon_inr)}</td>
                  <td className="px-3 py-2 text-right">{inr(m.bank_amazon_inr)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${av ? "text-red-600" : "text-green-700"}`}>
                    {inr(m.amazon_variance_inr)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
