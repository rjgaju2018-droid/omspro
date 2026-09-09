import { COMPANIES, MARKET_SPLIT } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  FileText,
  Globe2,
  HeartHandshake,
  Package,
  PackageCheck,
  Ship,
  Sparkles,
  Wallet,
  CalendarClock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import {
  ClayButton,
  ClayChip,
  ClaySurface,
  MotionDiv,
} from "@/components/clay";
import nykoLogo from "@/assets/nyko-logo.png";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
});

function Nav() {
  return (
    <motion.header
      {...fadeUp(0)}
      className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6"
    >
      <Link to="/" className="flex items-center gap-3">
        <img
          src={nykoLogo}
          alt="Nyko Mart · Rugara · CASA ARRA"
          className="size-12 rounded-full object-cover shadow-[var(--shadow-clay)]"
        />
        <div className="leading-tight">
          <p className="font-display text-lg font-bold text-foreground">NykoMart OMS</p>
          <p className="-mt-0.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Nyko Mart · Rugara · CASA ARRA
          </p>
        </div>
      </Link>
      <nav className="hidden items-center gap-6 text-sm font-bold text-muted-foreground md:flex">
        <a href="#features" className="transition-colors hover:text-foreground">
          Modules
        </a>
        <a href="#companies" className="transition-colors hover:text-foreground">
          Companies
        </a>
        <a href="#error-sheet" className="transition-colors hover:text-foreground">
          Error Sheet
        </a>
      </nav>
      <div className="flex items-center gap-3">
        <Link
          to="/auth"
          className="hidden rounded-full px-4 py-2 text-sm font-extrabold text-foreground transition-colors hover:bg-[oklch(0.9_0.02_75)] sm:block"
        >
          Sign in
        </Link>
        <ClayButton onClick={undefined}>
          <Link to="/auth" className="inline-flex items-center gap-2">
            Open dashboard
            <ArrowRight className="size-4" />
          </Link>
        </ClayButton>
      </div>
    </motion.header>
  );
}

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pt-10 pb-20 text-center">
      <MotionDiv delay={0.05} className="flex justify-center">
        <ClayChip
          label="v1.0 mockup · built for the dev team"
          className="bg-[oklch(0.92_0.045_155)] text-[oklch(0.4_0.08_155)]"
          dot="#6fbf8f"
        />
      </MotionDiv>
      <MotionDiv delay={0.12}>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
          Every order, every rug,{" "}
          <span className="relative inline-block text-[oklch(0.58_0.13_42)]">
            one clay-soft
            <svg
              className="absolute -bottom-2 left-0 w-full text-[oklch(0.7_0.13_42)]"
              viewBox="0 0 300 12"
              fill="none"
            >
              <path
                d="M3 9c60-6 180-8 294-3"
                stroke="currentColor"
                strokeWidth={5}
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          dashboard.
        </h1>
      </MotionDiv>
      <MotionDiv delay={0.2}>
        <p className="mx-auto mt-7 max-w-2xl text-base font-semibold leading-relaxed text-muted-foreground sm:text-lg">
          The order management backbone for{" "}
          <span className="font-extrabold text-foreground">Nyko Mart</span>,{" "}
          <span className="font-extrabold text-foreground">Rugara</span> and{" "}
          <span className="font-extrabold text-foreground">CASA ARRA</span> —
          orders, dispatch, documents, finance, inventory and HR, ported from
          Google Sheets into one tactile workspace.
        </p>
      </MotionDiv>
      <MotionDiv delay={0.28} className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <ClayButton className="px-7 py-3.5 text-base">
          <Link to="/auth" className="inline-flex items-center gap-2">
            Enter the dashboard
            <ArrowRight className="size-5" />
          </Link>
        </ClayButton>
        <ClayButton variant="secondary" className="px-7 py-3.5 text-base">
          <a href="#error-sheet" className="inline-flex items-center gap-2">
            Review the error sheet
          </a>
        </ClayButton>
      </MotionDiv>

      {/* Hero mockup card */}
      <MotionDiv delay={0.4} className="relative mx-auto mt-16 max-w-4xl">
        <div className="absolute -inset-6 rounded-[2.5rem] bg-[oklch(0.7_0.13_42/0.12)] blur-2xl" />
        <ClaySurface className="relative overflow-hidden text-left">
          <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-[oklch(0.62_0.17_27)]" />
              <span className="size-3 rounded-full bg-[oklch(0.82_0.11_95)]" />
              <span className="size-3 rounded-full bg-[oklch(0.68_0.09_155)]" />
            </div>
            <ClayChip
              label="Dashboard · NYM-2214 dispatched"
              className="bg-[oklch(0.93_0.05_155)] text-[oklch(0.4_0.08_155)]"
              dot="#6fbf8f"
            />
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-4">
            {[
              { label: "Open orders", value: "24", accent: "bg-[oklch(0.93_0.05_45)] text-[oklch(0.55_0.13_42)]", icon: <PackageCheck className="size-5" /> },
              { label: "In transit", value: "12", accent: "bg-[oklch(0.93_0.04_240)] text-[oklch(0.45_0.09_240)]", icon: <Ship className="size-5" /> },
              { label: "Monthly sales", value: "₹9.2L", accent: "bg-[oklch(0.92_0.045_155)] text-[oklch(0.45_0.09_155)]", icon: <Wallet className="size-5" /> },
              { label: "Team on shift", value: "7", accent: "bg-[oklch(0.94_0.06_95)] text-[oklch(0.55_0.1_80)]", icon: <Users className="size-5" /> },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-3xl bg-[oklch(0.96_0.012_80)] p-4 shadow-[var(--shadow-clay-inset)]"
              >
                <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", s.accent)}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </p>
                  <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6">
            <div className="rounded-3xl bg-[oklch(0.96_0.012_80)] p-4 shadow-[var(--shadow-clay-inset)]">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>Handwoven Wool Rug 5×7 — 4 pcs · $1,840</span>
                <ClayChip label="Dispatched" className="bg-[oklch(0.93_0.05_155)] text-[oklch(0.4_0.08_155)]" dot="#6fbf8f" />
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-[oklch(0.88_0.024_72)] shadow-[var(--shadow-clay-inset)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "72%" }}
                  transition={{ duration: 1.2, delay: 0.7, ease: "easeOut" }}
                  className="h-full rounded-full bg-[oklch(0.68_0.09_155)] shadow-[var(--shadow-clay-sm)]"
                />
              </div>
              <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                Jaipur → San Francisco · ETA 11 Sep · 2 packages · Delhivery + UPS
              </p>
            </div>
          </div>
        </ClaySurface>
        <div className="pointer-events-none absolute -right-6 -top-6 hidden rotate-12 sm:block">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-[oklch(0.82_0.11_95)] text-[oklch(0.5_0.13_45)] shadow-[var(--shadow-clay)]">
            <Sparkles className="size-9" />
          </div>
        </div>
        <div className="pointer-events-none absolute -left-8 bottom-10 hidden -rotate-6 sm:block">
          <div className="flex size-16 items-center justify-center rounded-3xl bg-[oklch(0.92_0.045_155)] text-[oklch(0.45_0.09_155)] shadow-[var(--shadow-clay)]">
            <HeartHandshake className="size-7" />
          </div>
        </div>
      </MotionDiv>
    </section>
  );
}

const MODULES = [
  {
    icon: PackageCheck,
    title: "Order entry & lifecycle",
    desc: "Multi-currency capture, automatic PO/RF/RG numbering per company, hold/cancel with reasons, buyer-batch grouping.",
    accent: "bg-[oklch(0.93_0.05_45)] text-[oklch(0.55_0.13_42)]",
  },
  {
    icon: Ship,
    title: "Dispatch & shipments",
    desc: "Multi-package tracking, bulk CSV updates, Shipglobal labels, courier webhooks and a freight cost estimator.",
    accent: "bg-[oklch(0.93_0.04_240)] text-[oklch(0.45_0.09_240)]",
  },
  {
    icon: FileText,
    title: "Documents",
    desc: "Credit/debit notes, washing entry, internal invoices, CSB-V/CSB-IV export invoices, shipment chalan.",
    accent: "bg-[oklch(0.94_0.06_95)] text-[oklch(0.55_0.1_80)]",
  },
  {
    icon: Wallet,
    title: "Finance",
    desc: "Bill Pass Register with two-level approval, party ledger, office expenses and one-click Excel backup.",
    accent: "bg-[oklch(0.92_0.045_155)] text-[oklch(0.45_0.09_155)]",
  },
  {
    icon: Boxes,
    title: "Inventory & stock",
    desc: "Chalan-mandatory stock in/out, finished-goods auto-restock on refund, reorder alerts.",
    accent: "bg-[oklch(0.93_0.05_320)] text-[oklch(0.5_0.1_320)]",
  },
  {
    icon: CalendarClock,
    title: "HR & attendance",
    desc: "Auto punch in/out, daily work reports, leave with coverage, salary tracking and HR letters.",
    accent: "bg-[oklch(0.94_0.04_200)] text-[oklch(0.45_0.08_200)]",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-16">
      <MotionDiv className="text-center">
        <ClayChip label="The full back office" className="bg-[oklch(0.93_0.05_45)] text-[oklch(0.55_0.13_42)]" />
        <h2 className="mt-5 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          One login, three companies, every workflow
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-muted-foreground sm:text-base">
          Capability-based access means each employee sees exactly what they need —
          re-checked server-side on every action.
        </p>
      </MotionDiv>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m, i) => (
          <MotionDiv key={m.title} delay={0.05 * i}>
            <ClaySurface hover className="flex h-full flex-col p-6">
              <div
                className={cn(
                  "mb-4 flex size-12 items-center justify-center rounded-2xl shadow-[var(--shadow-clay-sm)]",
                  m.accent,
                )}
              >
                <m.icon className="size-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">{m.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
                {m.desc}
              </p>
            </ClaySurface>
          </MotionDiv>
        ))}
      </div>
    </section>
  );
}

function Companies() {
  return (
    <section id="companies" className="mx-auto max-w-6xl px-5 py-16">
      <MotionDiv className="text-center">
        <ClayChip label="Reference data" className="bg-[oklch(0.92_0.045_155)] text-[oklch(0.4_0.08_155)]" />
        <h2 className="mt-5 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Three companies, one ownership
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold text-muted-foreground sm:text-base">
          Jaipur, Rajasthan — home textiles handmade and shipped worldwide.
        </p>
      </MotionDiv>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {COMPANIES.map((c, i) => (
          <MotionDiv key={c.key} delay={0.06 * i}>
            <ClaySurface hover className="flex h-full flex-col p-6">
              <div className="flex items-center justify-between">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-[oklch(0.96_0.012_80)] font-display text-base font-extrabold text-foreground shadow-[var(--shadow-clay-inset)]">
                  {c.short}
                </div>
                <ClayChip label={`${c.orderPrefix} series`} className="bg-[oklch(0.93_0.02_240)] text-[oklch(0.42_0.05_240)]" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-foreground">{c.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                <Globe2 className="size-3.5" />
                {c.markets.join(" · ")} · exporting worldwide
              </p>
              <p className="mt-4 rounded-2xl bg-[oklch(0.96_0.012_80)] px-3 py-2 text-[11px] font-bold text-muted-foreground shadow-[var(--shadow-clay-inset)]">
                GSTIN {c.gstin}
              </p>
            </ClaySurface>
          </MotionDiv>
        ))}
      </div>
      <MotionDiv delay={0.2} className="mx-auto mt-12 max-w-3xl">
        <ClaySurface className="p-6">
          <p className="text-center font-display text-xl font-extrabold text-foreground">
            Where the orders come from
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {MARKET_SPLIT.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="clay-chip bg-[oklch(0.96_0.012_80)] text-foreground shadow-[var(--shadow-clay-inset)]">
                  {m.name}
                </span>
                <span className="font-display text-lg font-bold text-[oklch(0.58_0.13_42)]">
                  {m.value}%
                </span>
              </div>
            ))}
          </div>
        </ClaySurface>
      </MotionDiv>
    </section>
  );
}

const SHEET_ITEMS = [
  { code: "NUM-GAP", title: "PO/RF/RG number gaps on duplicate detection", sev: "Critical", sevCls: "bg-[oklch(0.93_0.07_27)] text-[oklch(0.45_0.11_27)]" },
  { code: "CHALAN-MANDATE", title: "Stock movement without Chalan No. must be blocked", sev: "Critical", sevCls: "bg-[oklch(0.93_0.07_27)] text-[oklch(0.45_0.11_27)]" },
  { code: "FX-MIX", title: "Multi-currency totals mix INR/USD/EUR in ledger export", sev: "High", sevCls: "bg-[oklch(0.94_0.06_60)] text-[oklch(0.45_0.1_55)]" },
  { code: "AWB-DUP", title: "Duplicate AWB accepted in Bulk Tracking CSV", sev: "High", sevCls: "bg-[oklch(0.94_0.06_60)] text-[oklch(0.45_0.1_55)]" },
  { code: "RLS-AUDIT", title: "Audit log misses voided documents", sev: "High", sevCls: "bg-[oklch(0.94_0.06_60)] text-[oklch(0.45_0.1_55)]" },
  { code: "CSB-INV", title: "CSB-V/CSB-IV origin declaration mismatch", sev: "Medium", sevCls: "bg-[oklch(0.94_0.05_95)] text-[oklch(0.45_0.07_80)]" },
];

function ErrorSheetTeaser() {
  return (
    <section id="error-sheet" className="mx-auto max-w-6xl px-5 py-16">
      <MotionDiv className="relative overflow-hidden">
        <ClaySurface className="p-8 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <ClayChip
                label="Dev-team deliverable"
                className="bg-[oklch(0.94_0.06_60)] text-[oklch(0.45_0.1_55)]"
              />
              <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
                The error sheet is built in
              </h2>
              <p className="mt-4 max-w-lg text-sm font-semibold leading-relaxed text-muted-foreground sm:text-base">
                Known issues from the Sheets → OMS migration, tracked with
                owners, severity and status — right inside the dashboard so the
                dev team fixes them from the same screen they test in.
              </p>
              <ul className="mt-6 space-y-3">
                {SHEET_ITEMS.slice(0, 4).map((s) => (
                  <li key={s.code} className="flex items-center gap-3">
                    <ClayChip label={s.sev} className={s.sevCls} />
                    <span className="text-sm font-bold text-foreground">{s.code}</span>
                    <span className="truncate text-sm font-semibold text-muted-foreground">
                      {s.title}
                    </span>
                  </li>
                ))}
              </ul>
              <ClayButton className="mt-8 px-7 py-3">
                <Link to="/auth" className="inline-flex items-center gap-2">
                  Open the error sheet
                  <ArrowRight className="size-5" />
                </Link>
              </ClayButton>
            </div>
            <div className="hidden lg:block">
              <div className="rounded-[2rem] bg-[oklch(0.96_0.012_80)] p-6 shadow-[var(--shadow-clay-inset)]">
                <div className="mb-4 flex items-center justify-between">
                  <p className="font-display text-sm font-extrabold text-foreground">
                    ERROR_SHEET.md · v1
                  </p>
                  <span className="clay-chip bg-[oklch(0.93_0.07_27)] text-[oklch(0.45_0.11_27)]">
                    4 open · 2 critical
                  </span>
                </div>
                <div className="space-y-2.5">
                  {SHEET_ITEMS.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-center gap-3 rounded-2xl bg-[oklch(0.99_0.01_80)] px-4 py-3 shadow-[var(--shadow-clay-sm)]"
                    >
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", s.sevCls)}>
                        {s.sev}
                      </span>
                      <code className="font-mono text-[11px] font-bold text-[oklch(0.55_0.13_42)]">
                        {s.code}
                      </code>
                      <span className="truncate text-xs font-semibold text-muted-foreground">
                        {s.title}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-[oklch(0.92_0.045_155)] px-4 py-3 shadow-[var(--shadow-clay-inset)]">
                  <span className="text-xs font-extrabold text-[oklch(0.4_0.08_155)]">
                    Severity distribution
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="clay-chip bg-[oklch(0.93_0.07_27)] text-[oklch(0.45_0.11_27)]">2 critical</span>
                    <span className="clay-chip bg-[oklch(0.94_0.06_60)] text-[oklch(0.45_0.1_55)]">3 high</span>
                    <span className="clay-chip bg-[oklch(0.94_0.05_95)] text-[oklch(0.45_0.07_80)]">3 medium</span>
                    <span className="clay-chip bg-[oklch(0.93_0.04_240)] text-[oklch(0.4_0.05_240)]">2 low</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ClaySurface>
      </MotionDiv>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <MotionDiv>
        <ClaySurface className="relative overflow-hidden p-10 text-center sm:p-16">
          <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-[oklch(0.82_0.11_95/0.3)] blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 size-44 rounded-full bg-[oklch(0.88_0.05_155/0.3)] blur-2xl" />
          <ClayChip
            label="Version 1 · static mockup"
            className="bg-[oklch(0.93_0.05_45)] text-[oklch(0.55_0.13_42)]"
          />
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-extrabold leading-tight text-foreground sm:text-5xl">
            Ready to poke every screen?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm font-semibold text-muted-foreground sm:text-base">
            The mockup covers orders, dispatch, documents, finance, inventory,
            reports, HR and the error sheet — sign in and walk the whole flow.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <ClayButton className="px-8 py-4 text-base">
              <Link to="/auth" className="inline-flex items-center gap-2">
                <ShieldCheck className="size-5" />
                Sign in as guest & explore
              </Link>
            </ClayButton>
            <ClayButton variant="secondary" className="px-8 py-4 text-base">
              <Link to="/download" className="inline-flex items-center gap-2">
                <Package className="size-5" />
                Download the zip
              </Link>
            </ClayButton>
          </div>
        </ClaySurface>
      </MotionDiv>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-[oklch(0.955_0.014_78)] py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row">
        <p className="text-xs font-bold text-muted-foreground">
          © 2026 NykoMart OMS · Developed by Gajanand Bhankariwal · Jaipur, Rajasthan
        </p>
        <p className="text-xs font-bold text-muted-foreground">
          Nyko Mart · Rugara · CASA ARRA — proprietary internal tool
        </p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="clay-bg flex min-h-screen flex-col"
    >
      <Nav />
      <main className="flex-1">
        <Hero />
        <Features />
        <Companies />
        <ErrorSheetTeaser />
        <CTA />
      </main>
      <Footer />
    </motion.div>
  );
}