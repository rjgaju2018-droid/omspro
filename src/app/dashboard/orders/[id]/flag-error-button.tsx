"use client";

import { useActionState, useState } from "react";
import { flagEntryError, type FlagErrorState } from "@/app/dashboard/error-log/actions";

const initialState: FlagErrorState = { error: null, success: false };

// "🚩 Flag as Error" (2026-09-08) — any signed-in employee viewing an
// order's detail page can flag it as a wrong/problem entry, which shows up
// on the Error Tab (⚠️, error_log_view capability, Admin/MD review it) with
// this employee's name + timestamp attached automatically. See
// db/2026-09-08-error-log.sql and src/app/dashboard/error-log/actions.ts.
export function FlagErrorButton({ orderId, orderRefNo }: { orderId: string; orderRefNo: string }) {
  const [state, formAction, isPending] = useActionState(flagEntryError, initialState);
  const [open, setOpen] = useState(false);

  if (state.success && !open) {
    return <p className="text-xs font-medium text-emerald-700 print:hidden">🚩 Flagged — the review team will see this on the Error Tab.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 print:hidden"
      >
        🚩 Flag as Error
      </button>
    );
  }

  return (
    <form action={formAction} className="w-72 space-y-1.5 rounded-lg border border-red-200 bg-red-50/50 p-2.5 print:hidden">
      <input type="hidden" name="reference_type" value="order" />
      <input type="hidden" name="reference_id" value={orderId} />
      <input type="hidden" name="reference_label" value={orderRefNo} />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div>
        <label className="mb-0.5 block text-[10px] font-medium text-slate-500">What&apos;s wrong with this entry? *</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          placeholder="e.g. wrong buyer address, item qty looks off…"
        />
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Flagging…" : "Flag it"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
