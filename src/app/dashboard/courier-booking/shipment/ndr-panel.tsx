"use client";

// NDR (Non-Delivery Report) section on the Shipment Detail page — log a
// failed delivery attempt reported by the courier (phone/email, outside
// the app) and view/resolve past attempts for this shipment. See
// db/2026-09-09-ndr-tracking.sql for the full context comment.
import { useActionState, useState } from "react";
import { logNdrAttempt, resolveNdrAttempt, type LogNdrState, type ResolveNdrState } from "./ndr-actions";
import { NDR_REASONS, type NdrAttempt } from "./ndr-data";

const inputClass = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500";
const labelClass = "mb-1 block text-xs font-medium text-slate-500";
const LOG_INITIAL: LogNdrState = { error: null, success: false };
const RESOLVE_INITIAL: ResolveNdrState = { error: null, success: false };

function reasonBadgeClass(reason: string): string {
  if (reason === "Refused") return "bg-red-100 text-red-700";
  if (reason === "Weather/Force Majeure") return "bg-sky-100 text-sky-700";
  if (reason === "Customer Unavailable") return "bg-amber-100 text-amber-700";
  if (reason === "Address Issue") return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-600";
}

// datetime-local default value = now, in the browser's own local time
// (this app is IST-only in practice; no timezone conversion needed beyond
// what the browser does natively for this input type).
function nowForDatetimeLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function NdrPanel({ courierShipmentId, attempts }: { courierShipmentId: string; attempts: NdrAttempt[] }) {
  const [logState, logAction, logPending] = useActionState(logNdrAttempt, LOG_INITIAL);
  const [showForm, setShowForm] = useState(false);

  const unresolvedCount = attempts.filter((a) => !a.resolvedAt).length;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">
          🚫 NDR / Failed Delivery Attempts
          {attempts.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {attempts.length} logged{unresolvedCount > 0 ? ` · ${unresolvedCount} unresolved` : ""}
            </span>
          )}
        </h2>
        {!showForm && !logState.success && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            + Log Failed Attempt
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-slate-400">
        Manually entered when a courier reports (phone/email, outside this app) that a delivery attempt failed — this app does not auto-parse NDRs
        from courier webhooks/tracking. Log as many attempts as actually happened before the shipment is finally resolved (redelivered, or genuinely
        returned).
      </p>

      {logState.success ? (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Logged. Refresh to see it in the list below.</p>
      ) : showForm ? (
        <form action={logAction} className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="courier_shipment_id" value={courierShipmentId} />
          {logState.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{logState.error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Reason *</label>
              <select name="reason" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Select a reason
                </option>
                {NDR_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>When did the attempt happen?</label>
              <input type="datetime-local" name="attempted_at" defaultValue={nowForDatetimeLocal()} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Note</label>
            <textarea name="note" rows={2} placeholder="Anything the courier said, e.g. exact address issue, callback number, etc." className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              disabled={logPending}
              className="rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {logPending ? "Saving..." : "Save Attempt"}
            </button>
          </div>
        </form>
      ) : null}

      {attempts.length === 0 ? (
        <p className="text-xs text-slate-400">No NDR attempts logged for this shipment yet.</p>
      ) : (
        <div className="space-y-2">
          {attempts.map((a) => (
            <NdrAttemptRow key={a.id} attempt={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function NdrAttemptRow({ attempt }: { attempt: NdrAttempt }) {
  const [resolving, setResolving] = useState(false);
  const [state, action, pending] = useActionState(resolveNdrAttempt, RESOLVE_INITIAL);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Attempt #{attempt.attemptNo}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${reasonBadgeClass(attempt.reason)}`}>{attempt.reason}</span>
            {attempt.resolvedAt ? (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Resolved</span>
            ) : (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Unresolved</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {new Date(attempt.attemptedAt).toLocaleString()} · logged by {attempt.loggedByName}
          </p>
          {attempt.note && <p className="mt-1 text-xs text-slate-600">{attempt.note}</p>}
        </div>
        {!attempt.resolvedAt && !resolving && !state.success && (
          <button
            type="button"
            onClick={() => setResolving(true)}
            className="shrink-0 rounded-lg border border-green-300 px-2.5 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50"
          >
            ✓ Mark Resolved
          </button>
        )}
      </div>

      {attempt.resolvedAt && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
          Resolved {new Date(attempt.resolvedAt).toLocaleString()} by {attempt.resolvedByName}
          {attempt.resolvedNote ? ` — ${attempt.resolvedNote}` : ""}
        </p>
      )}

      {state.success && <p className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-800">Marked resolved. Refresh to update the list.</p>}

      {resolving && !state.success && (
        <form action={action} className="mt-2 space-y-2 border-t border-slate-100 pt-2">
          <input type="hidden" name="ndr_attempt_id" value={attempt.id} />
          {state.error && <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] text-red-800">{state.error}</p>}
          <div>
            <label className={labelClass}>How was it resolved? (e.g. redelivery succeeded, became a return)</label>
            <input name="resolved_note" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setResolving(false)} className="rounded-lg border border-slate-300 px-3 py-1 text-xs">
              Back
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {pending ? "Saving..." : "Confirm Resolved"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
