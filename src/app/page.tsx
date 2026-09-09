import type { Metadata } from "next";
import Link from "next/link";
import { LandingHero3D } from "@/components/landing/landing-hero-3d";
import { PLANS } from "@/lib/saas/plans";

// OMS Pro — public marketing landing page (2026-09-09). The root route used
// to be a bare redirect("/dashboard"); the public URL is now the product's
// front door: a scroll-driven, 3D-animated tour of what OMS Pro does, ending
// in trial signup / login CTAs. The 3D hero reuses the exact scene language
// from /login (rotating parcel, warm studio lights, terracotta accent) so
// landing → login → dashboard feels like one continuous product.
//
// Copy and code names (Nyko Mart / Rugara / CASA ARRA) stay out of the
// public page on purpose — this is now a multi-tenant product open to any
// company. Contact email shown is the developer/support contact of record.
export const metadata: Metadata = {
  title: "OMS Pro — Order Management System for export & marketplace sellers",
  description:
    "OMS Pro ek complete Order Management System hai — orders, dispatch, documents, finance, inventory aur HR, sab ek jagah. 14 din ka free trial, card ki zaroorat nahi.",
};

const FEATURES = [
  {
    icon: "📝",
    title: "Order Entry & Lifecycle",
    body:
      "Multi-currency orders, automatic PO/RG/RF numbering per company, duplicate detection, Hold/Cancel with reasons — order se dispatch tak ka pura lifecycle.",
  },
  {
    icon: "🚚",
    title: "Dispatch & Shipments",
    body:
      "Multi-package, multi-AWB tracking per order, bulk tracking updates via CSV, courier webhooks (Delhivery, Shiprocket, UPS, FedEx) aur freight estimator.",
  },
  {
    icon: "🧾",
    title: "Documents & Invoices",
    body:
      "Credit/Debit notes, washing entries, purchase/courier/duty bills, export invoices (CSB-V/CSB-IV) origin declarations ke sath — sab ek hi jagah.",
  },
  {
    icon: "💳",
    title: "Finance & Approvals",
    body:
      "Unified payable ledger, two-level bill approval workflow, party ledger, office expenses aur one-click Excel backup export.",
  },
  {
    icon: "📦",
    title: "Stock & Inventory",
    body:
      "Raw-material stock in/out (Chalan No. mandatory), finished-goods inventory with auto-restock on refund, reorder alerts 30-day cover ke hisab se.",
  },
  {
    icon: "📈",
    title: "Reports & CRM",
    body:
      "Filterable reports hub — orders, profit, outstanding, SKU × country × size — sab CSV/Excel/Word/PDF me export-ready, WhatsApp share ke sath.",
  },
  {
    icon: "🕒",
    title: "HR & Attendance",
    body:
      "Auto punch-in on login, daily work reports with timer, leave requests + coverage assignment, salary/advance tracking, HR letters.",
  },
  {
    icon: "🤖",
    title: "Automation & AI Companion",
    body:
      "Trigger → condition → action rules, full audit log, aur employees ke liye optional AI companion — kaam ko halka aur tez banata hai.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Free trial shuru karein",
    body: "Apna naam, email aur company ka naam bharein — 14 din ka trial turant activate, koi card nahi.",
  },
  {
    n: "2",
    title: "Company setup karein",
    body: "Apna workspace banao, stores/marketplaces add karo, roles & permissions khud decide karo.",
  },
  {
    n: "3",
    title: "Team ko bulayein",
    body: "Kis-kis ko kaunsa access milega — ye pura control company ke pass. Invite karo, role do, done.",
  },
  {
    n: "4",
    title: "Orders manage karein",
    body: "Order entry se dispatch, documents se finance tak — pura back-office ek hi dashboard me.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Mera data safe hai?",
    a: "Haan — har company ka data company-scoped hai aur Row Level Security se protect hota hai. Aapka data sirf aapki team dekh sakti hai; OMS Pro misuse nahi karta.",
  },
  {
    q: "Trial me kya-kya milta hai?",
    a: "14 din ke trial me sabhi modules milte hain — orders, documents, finance, inventory, HR. Card ki zaroorat nahi, trial khatam hone par bhi aapka data delete nahi hota.",
  },
  {
    q: "Kya multiple companies chala sakta hoon?",
    a: "Enterprise plan me ek hi login se multiple companies chala sakte hain — header me company switcher ke sath, bilkul aapke purane workflow jaisa.",
  },
  {
    q: "Support kaise milega?",
    a: "Email aur WhatsApp support har plan me hai. Enterprise plan me onboarding aur data migration help bhi included hai.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-lg font-black text-white shadow-lg">
              O
            </span>
            <span className="text-lg font-bold tracking-tight text-white">
              OMS <span className="text-amber-400">Pro</span>
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#how" className="transition hover:text-white">Kaise kaam karta hai</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-200 transition hover:text-white">
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
            >
              Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* HERO — 3D */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(217,122,74,0.12),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
              🚀 14 din ka free trial · card ki zaroorat nahi
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
              Aapke order business ka{" "}
              <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                pura back-office
              </span>
              , ek jagah
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-400 md:text-lg">
              OMS Pro ek complete Order Management System hai — order entry se dispatch tak, documents
              se finance tak, inventory se HR tak. Export aur marketplace sellers ke liye banaya gaya,
              real businesses me test kiya gaya.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-7 py-3.5 text-base font-bold text-white shadow-xl transition hover:scale-[1.02] hover:opacity-95"
              >
                Free Trial Shuru Karein →
              </Link>
              <a
                href="#how"
                className="rounded-xl border border-slate-700 px-7 py-3.5 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Kaise kaam karta hai
              </a>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              Support:{" "}
              <a href="mailto:bhankariwal@gmail.com" className="font-medium text-amber-400 hover:text-amber-300">
                bhankariwal@gmail.com
              </a>{" "}
              · +91 99830 00552
            </p>
          </div>
          <div className="relative h-72 w-full sm:h-96 md:h-[26rem]">
            <LandingHero3D />
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-slate-800/60 bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-center md:grid-cols-4">
          {[
            { v: "70+", l: "Managed tables" },
            { v: "30+", l: "Modules" },
            { v: "6+", l: "Courier integrations" },
            { v: "7", l: "Dashboard themes" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-3xl font-black text-amber-400">{s.v}</div>
              <div className="mt-1 text-sm text-slate-400">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Sab kuch jo ek order business ko chahiye
          </h2>
          <p className="mt-4 text-slate-400">
            Modules scroll karte hi 3D animation ke sath move hote dikhte hain — jaise-jaise aap
            scroll karenge, features saamne aayenge.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              style={{ transitionDelay: `${(i % 4) * 60}ms` }}
              className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/40 hover:shadow-[0_20px_60px_-20px_rgba(217,122,74,0.35)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-2xl shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                {f.icon}
              </div>
              <h3 className="mt-4 font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 border-y border-slate-800/60 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              Kaise kaam karta hai
            </h2>
            <p className="mt-4 text-slate-400">Signup se pehla order tak — sirf 4 steps.</p>
          </div>
          <ol className="mt-14 grid gap-8 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.n} className="relative">
                <div className="flex items-center gap-4 md:flex-col md:items-start">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-lg font-black text-white shadow-lg">
                    {s.n}
                  </span>
                  <div className="hidden h-0.5 flex-1 bg-gradient-to-r from-amber-500/60 to-transparent md:order-first md:absolute md:left-0 md:right-0 md:top-6 md:block" aria-hidden="true" />
                </div>
                <h3 className="mt-4 font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.body}</p>
                {i === 0 && (
                  <Link
                    href="/signup"
                    className="mt-3 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300"
                  >
                    Abhi shuru karein →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">Simple pricing</h2>
          <p className="mt-4 text-slate-400">
            Trial bilkul free — koi credit card nahi. Badhne par plan upgrade karein, data waise ka
            waisa.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1 ${
                plan.highlighted
                  ? "border-amber-500/60 bg-gradient-to-b from-amber-500/10 to-slate-900 shadow-[0_25px_80px_-30px_rgba(245,158,11,0.45)]"
                  : "border-slate-800 bg-slate-900/60"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-1 text-xs font-bold text-white shadow-lg">
                  MOST POPULAR
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{plan.label}</h3>
              <p className="mt-1 text-sm text-slate-400">{plan.tagline}</p>
              <div className="mt-5">
                {plan.priceInr === null ? (
                  <div className="text-4xl font-black text-white">Custom</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">₹{plan.priceInr.toLocaleString("en-IN")}</span>
                    <span className="text-sm text-slate-400">/month</span>
                  </div>
                )}
              </div>
              <div className="mt-2 text-sm font-medium text-amber-300">{plan.users} · {plan.ordersPerMonth}</div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-0.5 text-emerald-400">✓</span> {feat}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.id === "enterprise" ? "mailto:bhankariwal@gmail.com?subject=OMS%20Pro%20Enterprise" : "/signup"}
                className={`mt-8 rounded-xl px-4 py-3 text-center font-semibold transition ${
                  plan.highlighted
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg hover:opacity-90"
                    : "border border-slate-700 text-slate-200 hover:border-amber-500/50 hover:text-white"
                }`}
              >
                {plan.id === "enterprise" ? "Contact Sales" : "Free Trial Shuru Karein"}
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-y border-slate-800/60 bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <h2 className="text-center text-3xl font-black tracking-tight text-white md:text-4xl">FAQ</h2>
          <div className="mt-10 space-y-4">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4 open:border-amber-500/40"
              >
                <summary className="cursor-pointer list-none font-semibold text-slate-100 marker:hidden">
                  <span className="mr-2 text-amber-400 transition group-open:rotate-90 inline-block">▸</span>
                  {item.q}
                </summary>
                <p className="mt-3 pl-6 text-sm leading-relaxed text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
          Aaj hi apna OMS Pro workspace banayein
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          14 din ka free trial — sab modules unlocked, card ki zaroorat nahi. Trial ke baad bhi aapka
          data safe rehta hai.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-10 py-4 text-lg font-bold text-white shadow-2xl transition hover:scale-[1.02] hover:opacity-95"
        >
          Free Trial Shuru Karein →
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/60 bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-lg font-black text-white">
                O
              </span>
              <span className="text-lg font-bold text-white">
                OMS <span className="text-amber-400">Pro</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Export aur marketplace sellers ke liye complete Order Management System.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Product</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#features" className="text-slate-400 hover:text-white">Features</a></li>
              <li><a href="#pricing" className="text-slate-400 hover:text-white">Pricing</a></li>
              <li><Link href="/login" className="text-slate-400 hover:text-white">Login</Link></li>
              <li><Link href="/signup" className="text-slate-400 hover:text-white">Free Trial</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Support</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li>
                Email:{" "}
                <a href="mailto:bhankariwal@gmail.com" className="text-amber-400 hover:text-amber-300">
                  bhankariwal@gmail.com
                </a>
              </li>
              <li>Phone/WhatsApp: +91 99830 00552</li>
              <li>Developer: Gajanand Bhankariwal</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800/60 py-5 text-center text-xs text-slate-500">
          © 2026 OMS Pro. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
