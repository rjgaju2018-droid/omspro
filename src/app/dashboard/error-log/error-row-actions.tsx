"use client";

import { useState, useTransition } from "react";
import { resolveEntryError, reopenEntryError } from "./actions";

// Compact per-row Resolve/Reopen control for the Error Tab — mirrors the
// established small-inline-form pattern (see order-hold-cancel-actions.tsx):
// optimistic disable while pending, inline error text, no page navigation.
export function ErrorRowActions({ id, status }: { id: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");

  function handleResolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveEntryError(id, notes || null);
      if (result.error) setError(result.error);
      else setShowNotes(false);
    });
  }

  function handleReopen() {
    setError(null);
    startTransition(async () => {
      const result = await reopenEntryError(id);
      if (result.error) setError(result.error);
    });
  }

  if (status === "resolved") {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={handleReopen}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          ↩️ Reopen
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!showNotes ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setShowNotes(true)}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
        >
          ✓ Resolve
        </button>
      ) : (
        <div className="w-56 space-y-1">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Resolution note (optional)"
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={handleResolve}
              className="flex-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              onClick={() => setShowNotes(false)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
