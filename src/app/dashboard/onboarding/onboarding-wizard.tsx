"use client";

// 2026-09-15 — the onboarding wizard UI ("refurnish" round): 3 steps in one
// page — 1) your profile, 2) company setup (name, short code, logo),
// 3) module selection ("system option chose: hr section, salary section
// etc."). Dark-theme first: every surface uses the app's existing dark
// slate tokens so all text stays readable. Completing step 3 stamps
// onboarding complete server-side and routes into the dashboard.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULE_GROUPS } from "@/lib/company-modules";
import { completeOnboarding, saveOnboardingCompany, saveOnboardingProfile, type OnboardingState } from "./actions";

const initialState: OnboardingState = { error: null, done: false };

const STEP_TITLES = ["Your profile", "Company setup", "Choose your modules"];

export function OnboardingWizard({
  ownerName,
  companyName,
  shortCode,
  logoUrl,
  photoUrl,
}: {
  ownerName: string;
  companyName: string;
  shortCode: string;
  logoUrl: string | null;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profileState, profileAction, profilePending] = useActionState(saveOnboardingProfile, initialState);
  const [companyState, companyAction, companyPending] = useActionState(saveOnboardingCompany, initialState);
  const [modulesState, modulesAction, modulesPending] = useActionState(completeOnboarding, initialState);
  const [selected, setSelected] = useState<string[]>(MODULE_GROUPS.filter((g) => g.defaultOn).map((g) => g.id));

  // Step advance on SUCCESS only: a successful Server Action flips pending
  // true→false with error:null. The initial state is also error:null, so a
  // submit counter separates "never submitted" from "saved cleanly" —
  // advancing in an effect (not the submit handler) keeps the click
  // declarative and can't race the action.
  const [profileSubmits, setProfileSubmits] = useState(0);
  const [companySubmits, setCompanySubmits] = useState(0);
  useEffect(() => {
    if (profileSubmits > 0 && !profilePending && profileState.error === null) setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileSubmits, profilePending]);
  useEffect(() => {
    if (companySubmits > 0 && !companyPending && companyState.error === null) setStep(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companySubmits, companyPending]);

  useEffect(() => {
    if (modulesState.done) {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [modulesState.done, router]);

  function toggleModule(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2">
        {STEP_TITLES.map((t, i) => {
          const n = i + 1;
          const active = n === step;
          const complete = n < step;
          return (
            <li key={t} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                  complete
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg"
                      : "border border-slate-700 bg-slate-900 text-slate-500"
                }`}
              >
                {complete ? "✓" : n}
              </span>
              <span className={`hidden text-sm font-medium sm:block ${active ? "text-white" : "text-slate-500"}`}>{t}</span>
              {n < STEP_TITLES.length && <span className="h-px flex-1 bg-slate-800" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl sm:p-8">
        {/* STEP 1 — profile */}
        {step === 1 && (
          <form action={profileAction} className="space-y-5">
            <div>
              <h1 className="text-2xl font-black text-white">Welcome, {ownerName} 👋</h1>
              <p className="mt-1 text-sm text-slate-400">
                Let&apos;s set up your workspace. First — your profile.
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Your full name</span>
              <input
                name="name"
                defaultValue={ownerName}
                required
                minLength={2}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder-slate-600 outline-none focus:border-amber-500/60"
                placeholder="e.g. Gajanand Bhankariwal"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Profile photo (optional)</span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:text-slate-200"
              />
            </label>
            {photoUrl && (
              <div className="flex items-center gap-3 text-sm text-slate-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Current photo" className="h-10 w-10 rounded-full object-cover" />
                Current photo
              </div>
            )}
            {profileState.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{profileState.error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={profilePending}
                onClick={() => setProfileSubmits((n) => n + 1)}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {profilePending ? "Saving…" : "Save & continue →"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2 — company */}
        {step === 2 && (
          <form action={companyAction} className="space-y-5">
            <div>
              <h1 className="text-2xl font-black text-white">Company setup</h1>
              <p className="mt-1 text-sm text-slate-400">
                Your workspace identity — shown on the dashboard, documents and invoices.
              </p>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Company name</span>
              <input
                name="company_name"
                defaultValue={companyName}
                required
                minLength={2}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-slate-100 placeholder-slate-600 outline-none focus:border-amber-500/60"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Short code</span>
              <input
                name="short_code"
                defaultValue={shortCode}
                required
                maxLength={5}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono uppercase text-slate-100 outline-none focus:border-amber-500/60"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Used in document numbers (e.g. {shortCode}/INV/26-27/0001). 2–5 letters/digits, unique across OMS Pro.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Company logo (optional)</span>
              <input
                type="file"
                name="logo"
                accept="image/*"
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:text-slate-200"
              />
              <span className="mt-1 block text-xs text-slate-500">Appears on the dashboard header and printed/exported documents.</span>
            </label>
            {logoUrl && (
              <div className="flex items-center gap-3 text-sm text-slate-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Current logo" className="h-10 w-10 rounded-lg object-contain" />
                Current logo
              </div>
            )}
            {companyState.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{companyState.error}</p>}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white">
                ← Back
              </button>
              <button
                type="submit"
                disabled={companyPending}
                onClick={() => setCompanySubmits((n) => n + 1)}
                className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {companyPending ? "Saving…" : "Save & continue →"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3 — modules */}
        {step === 3 && (
          <form action={modulesAction} className="space-y-5">
            <div>
              <h1 className="text-2xl font-black text-white">Choose your modules</h1>
              <p className="mt-1 text-sm text-slate-400">
                Pick which parts of OMS Pro your company runs. Your dashboard will show only these — you can change
                this anytime from Company Settings.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULE_GROUPS.map((g) => {
                const on = selected.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                      on ? "border-amber-500/60 bg-amber-500/10" : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="modules"
                      value={g.id}
                      checked={on}
                      onChange={() => toggleModule(g.id)}
                      className="mt-0.5 h-4 w-4 accent-amber-500"
                    />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-bold text-white">
                        <span aria-hidden="true">{g.icon}</span> {g.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400">{g.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {modulesState.error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{modulesState.error}</p>}
            <div className="flex justify-between pt-2">
              <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white">
                ← Back
              </button>
              <button
                type="submit"
                disabled={modulesPending}
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-2.5 font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {modulesPending ? "Setting up…" : "Finish setup 🎉"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
