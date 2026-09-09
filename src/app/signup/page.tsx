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
            <h1 className="text-xl font-semibold text-white">Your company is ready!</h1>
            <p className="mt-2 text-sm text-slate-400">
              Your OMS Pro workspace for{" "}
              <strong className="text-slate-200">{state.success.email}</strong> is set up — your
              14-day free trial has started.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 font-medium text-white shadow-lg transition hover:opacity-90"
            >
              Open dashboard →
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-icon.png"
                alt="OMS Pro logo"
                className="mx-auto mb-4 h-14 w-14 rounded-2xl shadow-lg"
              />
              <h1 className="text-xl font-semibold text-white">Create your company</h1>
              <p className="mt-1 text-sm text-slate-400">
                14-day free trial · no credit card required
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <div>
                <label htmlFor="your_name" className="mb-1 block text-sm font-medium text-slate-300">
                  Your name
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
                  Company name
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  required
                  minLength={2}
                  placeholder="Your export / marketplace company"
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
                {pending ? "Creating your company…" : "Start free trial"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-amber-400 hover:text-amber-300">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
