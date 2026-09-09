"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = { error: null, success: null };

// OMS Pro's public signup — the visual twin of /login (same slate-950
// canvas + amber gradient CTA), so the public marketing pages → auth handoff
// feels like one product. On success we show the "go to dashboard" card
// rather than auto-redirecting: the user's very first dashboard load doubles
// as their workspace-setup moment (company profile, first order, invite
// teammates).
export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        {state.success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-3xl">
              🎉
            </div>
            <h1 className="text-xl font-semibold text-white">Company ban gayi!</h1>
            <p className="mt-2 text-sm text-slate-400">
              <strong className="text-slate-200">{state.success.email}</strong> ke sath aapka OMS Pro
              workspace ready hai — 14 din ka free trial shuru ho gaya hai.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 font-medium text-white shadow-lg transition hover:opacity-90"
            >
              Dashboard kholein →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-2xl font-black text-white shadow-lg">
                O
              </div>
              <h1 className="text-xl font-semibold text-white">Apni company shuru karein</h1>
              <p className="mt-1 text-sm text-slate-400">
                14 din ka free trial · card ki zaroorat nahi
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <div>
                <label htmlFor="your_name" className="mb-1 block text-sm font-medium text-slate-300">
                  Aapka naam
                </label>
                <input
                  id="your_name"
                  name="your_name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Gajanand Bhankariwal"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="company_name" className="mb-1 block text-sm font-medium text-slate-300">
                  Company ka naam
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  required
                  minLength={2}
                  placeholder="Aapki export / marketplace company"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-300">
                  Work email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="•••••••• (min 8 characters)"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 outline-none focus:border-amber-500"
                />
              </div>

              {state.error && (
                <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 font-medium text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Company ban rahe hai…" : "Free trial shuru karein"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Pehle se account hai?{" "}
              <Link href="/login" className="font-medium text-amber-400 hover:text-amber-300">
                Login karein
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
