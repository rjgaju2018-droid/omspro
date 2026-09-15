import type { Metadata } from "next";
import Link from "next/link";
import { LandingHero3D } from "@/components/landing/landing-hero-3d";
import { ExportJourneyScene } from "@/components/landing/export-journey-scene";
import { CountUp, Marquee, Reveal, SplitText } from "@/components/landing/animated-bits";
import { PLANS } from "@/lib/saas/plans";

// OMS Pro — public marketing landing page (2026-09-09, refurnished
// 2026-09-15). The scroll now tells the full export story: hero → products
// we ship → a scroll-driven 3D journey (parcel → truck → airport → flight →
// sky → USA/Canada/Mexico/UK/France → last-mile delivery truck) → features →
// how it works → pricing → FAQ → trial CTA. The 3D journey is a new
// dedicated section between products and features; the hero keeps the
// original parcel scene so returning visitors still feel at home.
//
// Copy and code names (Nyko Mart / Rugara / CASA ARRA) stay out of the
// public page on purpose — this is now a multi-tenant product open to any
// company. Contact email shown is the developer/support contact of record.
export const metadata: Metadata = {
  title: "OMS Pro — Order Management System for export & marketplace sellers",
  description:
    "OMS Pro is a complete Order Management System — orders, dispatch, documents, finance, inventory and HR in one place. 14-day free trial, no credit card required.",
};

// 2026-09-15 — "landing page me sabhi prakar ke product jo export kiye ja
// sake" — the exportable product categories OMS Pro's own first business
// ships, shown as a scrolling marquee ribbon + a category grid.
const EXPORT_PRODUCTS: { icon: string; label: string }[] = [
  { icon: "🪑", label: "Handcrafted Furniture" },
  { icon: "🧵", label: "Textiles & Home Furnishing" },
  { icon: "🪔", label: "Home Decor & Handicrafts" },
  { icon: "💍", label: "Jewelry & Accessories" },
  { icon: "👜", label: "Leather Goods & Bags" },
  { icon: "🧴", label: "Beauty & Wellness" },
  { icon: "☕", label: "Food & Spices" },
  { icon: "🎨", label: "Art & Paintings" },
  { icon: "🧶", label: "Carpets & Rugs" },
  { icon: "🏺", label: "Ceramics & Pottery" },
  { icon: "👕", label: "Apparel & Fashion" },
  { icon: "📜", label: "Paper & Stationery" },
];

const FEATURES = [
  {
    icon: "📝",
    title: "Order Entry & Lifecycle",
    body:
      "Multi-currency orders, automatic PO/RG/RF numbering per company, duplicate detection, Hold/Cancel with reasons — the full lifecycle from order to dispatch.",
  },
  {
    icon: "🚚",
    title: "Dispatch & Shipments",
    body:
      "Multi-package, multi-AWB tracking per order, bulk tracking updates via CSV, courier webhooks (Delhivery, Shiprocket, UPS, FedEx) and a freight estimator.",
  },
  {
    icon: "🧾",
    title: "Documents & Invoices",
    body:
      "Credit/Debit notes, washing entries, purchase/courier/duty bills, export invoices (CSB-V/CSB-IV) with origin declarations — all in one place.",
  },
  {
    icon: "💳",
    title: "Finance & Approvals",
    body:
      "Unified payable ledger, two-level bill approval workflow, party ledger, office expenses and one-click Excel backup export.",
  },
  {
    icon: "📦",
    title: "Stock & Inventory",
    body:
      "Raw-material stock in/out (Chalan No. mandatory), finished-goods inventory with auto-restock on refund, reorder alerts based on 30-day cover.",
  },
  {
    icon: "📈",
    title: "Reports & CRM",
    body:
      "A filterable reports hub — orders, profit, outstanding, SKU × country × size — export-ready as CSV/Excel/Word/PDF, with WhatsApp share.",
  },
  {
    icon: "🕒",
    title: "HR & Attendance",
    body:
      "Auto punch-in on login, daily work reports with timer, leave requests + coverage assignment, salary/advance tracking, HR letters.",
  },
  {
    icon: "🧚",
    title: "Virtual Assistant",
    body:
      "A photo-real AI assistant on every page — new outfit daily, dances on birthdays & new-employee IDs, narrates every save and error. Work just got lighter.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Start your free trial",
    body: "Enter your name, email and company name — the 14-day trial activates instantly, no card needed.",
  },
  {
    n: "2",
    title: "Walk the setup wizard",
    body: "Profile → company setup with your own logo & stores → choose exactly which modules your company runs.",
  },
  {
    n: "3",
    title: "Your dashboard, your rules",
    body: "Only the modules you chose appear — roles, permissions and workflows shaped to your company, not the other way round.",
  },
  {
    n: "4",
    title: "Manage your orders",
    body: "From order entry to dispatch, documents to finance — your entire back office in one dashboard.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is my data safe?",
    a: "Yes — every company's data is company-scoped and protected by Row Level Security. Only your own team can see your data; OMS Pro never misuses it.",
  },
  {
    q: "What does the trial include?",
    a: "The 14-day trial includes every module — orders, documents, finance, inventory, HR. No card required, and your data is not deleted when the trial ends.",
  },
  {
    q: "Can I run multiple companies?",
    a: "The Enterprise plan lets you run multiple companies from a single login — with a company switcher in the header, just like your existing workflow.",
  },
  {
    q: "How do I get support?",
    a: "Email and WhatsApp support are included in every plan. The Enterprise plan also includes onboarding and data migration help.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="OMS Pro logo" className="h-9 w-9 rounded-xl shadow-lg" />
            <span className="text-lg font-bold tracking-tight text-white">
              OMS <span className="text-amber-400">Pro</span>
            </span>
          </div>
          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#products" className="transition hover:text-white">Products</a>
            <a href="#journey" className="transition hover:text-white">The Journey</a>
            <a href="#features" className="transition hover:text-white">Features</a>
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
              🚀 14-day free trial · no credit card required
            </span>
            <SplitText
              as="h1"
              text="Your order business's entire back office, in one place"
              className="mt-5 block text-4xl font-black leading-tight tracking-tight text-white md:text-5xl"
            />
            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-400 md:text-lg">
              OMS Pro is a complete Order Management System — from order entry to dispatch, documents
              to finance, inventory to HR. Built for export and marketplace sellers,
              tested in real businesses.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-7 py-3.5 text-base font-bold text-white shadow-xl transition hover:scale-[1.02] hover:opacity-95"
              >
                Start Free Trial →
              </Link>
              <a
                href="#journey"
                className="rounded-xl border border-slate-700 px-7 py-3.5 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                Watch the journey ↓
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
            { v: 70, s: "+", l: "Managed tables" },
            { v: 30, s: "+", l: "Modules" },
            { v: 8, s: "+", l: "Courier integrations" },
            { v: 7, s: "", l: "Dashboard themes" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-3xl font-black text-amber-400">
                <CountUp to={s.v} suffix={s.s} />
              </div>
              <div className="mt-1 text-sm text-slate-400">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* EXPORT PRODUCTS — "sabhi prakar ke product jo export kiye ja sake" */}
      <section id="products" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                Everything you export, everything it ships
              </h2>
              <p className="mt-4 text-slate-400">
                From handicrafts to textiles — OMS Pro runs the back office for every product category
                that leaves the country. Scroll to follow one parcel&apos;s journey.
              </p>
            </Reveal>
          </div>
        </div>
        {/* Marquee ribbon — two rows, opposite directions */}
        <Reveal className="mt-12" delay={100}>
          <Marquee speed={38}>
            {EXPORT_PRODUCTS.map((p) => (
              <span
                key={p.label}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-slate-800 bg-slate-900/70 px-5 py-2.5 text-sm font-semibold text-slate-200"
              >
                <span aria-hidden="true" className="text-lg">{p.icon}</span> {p.label}
              </span>
            ))}
          </Marquee>
        </Reveal>
        <Reveal className="mt-4" delay={180}>
          <Marquee speed={46} reverse>
            {[...EXPORT_PRODUCTS].reverse().map((p) => (
              <span
                key={`r-${p.label}`}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-full border border-slate-800/70 bg-slate-900/40 px-5 py-2.5 text-sm text-slate-400"
              >
                <span aria-hidden="true" className="text-lg">{p.icon}</span> {p.label}
              </span>
            ))}
          </Marquee>
        </Reveal>
        {/* Category grid */}
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 px-4 sm:grid-cols-3 lg:grid-cols-4">
          {EXPORT_PRODUCTS.slice(0, 8).map((p, i) => (
            <Reveal key={p.label} delay={i * 60}>
              <div className="group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-[0_18px_50px_-20px_rgba(217,122,74,0.35)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-xl shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  {p.icon}
                </span>
                <span className="text-sm font-bold text-white">{p.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* THE EXPORT JOURNEY — scroll-driven 3D */}
      <section id="journey" className="relative scroll-mt-20">
        <ExportJourneyScene />
      </section>

      {/* FEATURES */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
              Everything an order business needs
            </h2>
            <p className="mt-4 text-slate-400">
              Modules animate in 3D as you scroll — the further you scroll, the more features appear.
            </p>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 70}>
              <article className="group h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/40 hover:shadow-[0_20px_60px_-20px_rgba(217,122,74,0.35)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 text-2xl shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                  {f.icon}
                </div>
                <h3 className="mt-4 font-bold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — now reflects the onboarding wizard */}
      <section id="how" className="scroll-mt-20 border-y border-slate-800/60 bg-slate-900/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                How it works
              </h2>
              <p className="mt-4 text-slate-400">From signup to your first order — just 4 steps.</p>
            </Reveal>
          </div>
          <ol className="mt-14 grid gap-8 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <li className="relative h-full">
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
                      Get started now →
                    </Link>
                  )}
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">Simple pricing</h2>
            <p className="mt-4 text-slate-400">
              The trial is completely free — no credit card. Upgrade when you grow; your data stays exactly as it is.
            </p>
          </Reveal>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.id} delay={i * 90}>
              <article
                className={`relative flex h-full flex-col rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1 ${
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
                  {plan.id === "enterprise" ? "Contact Sales" : "Start Free Trial"}
                </Link>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-y border-slate-800/60 bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 py-20">
          <Reveal>
            <h2 className="text-center text-3xl font-black tracking-tight text-white md:text-4xl">FAQ</h2>
          </Reveal>
          <div className="mt-10 space-y-4">
            {FAQS.map((item, i) => (
              <Reveal key={item.q} delay={i * 60}>
                <details className="group rounded-xl border border-slate-800 bg-slate-900/70 px-5 py-4 open:border-amber-500/40">
                  <summary className="cursor-pointer list-none font-semibold text-slate-100 marker:hidden">
                    <span className="mr-2 inline-block text-amber-400 transition group-open:rotate-90">▸</span>
                    {item.q}
                  </summary>
                  <p className="mt-3 pl-6 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <SplitText
          as="h2"
          text="Create your OMS Pro workspace today"
          className="text-3xl font-black tracking-tight text-white md:text-4xl"
        />
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          14-day free trial — all modules unlocked, no credit card required. Your data stays safe even after the trial ends.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-10 py-4 text-lg font-bold text-white shadow-2xl transition hover:scale-[1.02] hover:opacity-95"
        >
          Start Free Trial →
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/60 bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-lockup.png" alt="OMS Pro" className="h-9 w-auto" />
              <span className="text-lg font-bold text-white">
                OMS <span className="text-amber-400">Pro</span>
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-400">
              A complete Order Management System for export and marketplace sellers.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Product</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li><a href="#products" className="text-slate-400 hover:text-white">Export Products</a></li>
              <li><a href="#journey" className="text-slate-400 hover:text-white">The Journey</a></li>
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
