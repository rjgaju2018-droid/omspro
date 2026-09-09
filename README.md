# OMS Pro — Order Management System

**OMS Pro** is a complete, multi-tenant Order Management System for export and
marketplace businesses — orders, dispatch, documents, finance, inventory and
HR in one dashboard. Any company can self-register from the public landing
page, get a **14-day free trial** (no card needed), and manage its own data
with its own team.

Originally built as the in-house system of a real export group — every
business rule below was battle-tested in daily production before the public
SaaS launch.

**Proprietary software** — all rights belong to the owner. Developed by
Mr. Gajanand Bhankariwal — bhankariwal@gmail.com · +91 99830 00552.

## Stack

- **Frontend + backend**: Next.js 16 (App Router, Server Actions, TypeScript)
- **Database**: PostgreSQL via [Supabase](https://supabase.com) (Postgres + Auth + Storage)
- **3D**: [three.js](https://threejs.org) — animated hero scenes on the landing & login pages
- **Styling**: Tailwind CSS
- **Hosting**: Vercel — auto-deploys from `main`

## Public site & SaaS flow

| Route | What it is |
|---|---|
| `/` | **3D animated landing page** — scroll-driven feature tour, pricing, FAQ, support contact. Signed-in visitors are routed to the dashboard. |
| `/signup` | **Self-serve company signup** — creates the auth user, a company workspace with a 14-day trial, and the owner login (full-capability "Company Owner" role). |
| `/login` | Sign-in (with optional TOTP 2FA challenge at `/login/verify-2fa`). |
| `/dashboard/billing` | **Plan & Billing** — current plan, trial countdown/expiry banner, plan comparison, upgrade contact. |

### Signup & trial internals

- `src/app/signup/actions.ts` — public Server Action. Creates the Supabase
  auth user → the `companies` row (`plan='trial'`, `trial_ends_at=now()+14d`,
  `created_by_signup=true`) → the owner `employees` row on the **Company
  Owner** role. Rollback of the auth user on failure, so a retry never hits
  "email already registered". Document prefixes (`short_code`, `ref_prefix`)
  are auto-derived from the company name with collision fallbacks.
- `db/2026-09-09-omspro-saas-signup.sql` — one-time migration: seeds the
  **Company Owner** role with every capability, adds the
  `plan` / `trial_ends_at` / `created_by_signup` columns (defaults keep all
  pre-existing companies fully active), and the `trial_status(company_id)`
  helper returning `paid | no_expiry | expiring | expired | trial`.
  **Run once in the Supabase SQL Editor before using signup/billing.**

## Dashboard modules

A day-to-day back office covering the full order lifecycle:

- **Order entry & lifecycle** — multi-currency order capture, automatic
  PO/RF/RG numbering per company, Hold/Cancel with reason tracking,
  buyer-batch grouping.
- **Dispatch & shipments** — multi-package/multi-AWB tracking per order,
  bulk tracking updates via CSV, real courier bookings (Shipglobal,
  FedEx, UPS, Aramex, Delhivery, Shiprocket, DHL), courier webhook
  ingestion, a courier-rate card and freight cost estimator.
- **Documents** — Credit/Debit Notes, Washing Entry, Internal Invoice,
  Purchase/Freight/Duty Bills, CSB-V/CSB-IV export invoices, Shipment Chalan.
- **Finance** — Bill Pass Register with a two-level approval workflow,
  Party Ledger, Office Expenses, Bill Payment, one-click Excel backup export.
- **Inventory & stock** — raw-material Stock In/Out (Chalan-No.-mandatory),
  finished-goods inventory with auto-restock on refund, reorder alerts.
- **Reports & CRM** — filterable reports hub (Orders, Purchase Bill,
  Freight/Duty, Outstanding, Party Ledger, Sale & Profit, SKU × Country ×
  Size, Returns/Refunds), each exportable to CSV/Excel/Word/PDF or
  shareable via Email/WhatsApp; P&L dashboard, Top Buyers.
- **HR & attendance** — auto punch-in on login, Daily Work Report with
  timers, leave requests + coverage-based temporary access, salary/advance
  tracking, HR letters, task assignment.
- **Admin** — Employees, Roles & Permissions (capability-based, fully
  data-driven), Companies/Items master, Help Center, Audit Log, Automation
  Rules, Error Tab, AI Companion access control.
- **Workspace UX (2026-09-09)** — browser-style **workspace tabs** across the
  top of the content area (`src/components/tabs/` — every visited module
  becomes a closable tab, persisted per browser) and a **vertical
  assistant** panel on the right edge (`src/components/assistant/` —
  searchable quick-launcher for every module + support contact).

## Security model

- Capability-based access control re-checked server-side on every action
  (`src/lib/auth/require-capability.ts`) — never trusting the client.
- Company scoping enforced server-side on every write, not just filtered in
  the UI; each signup company only ever sees its own data (RLS enabled on
  every table; the browser-facing anon key has zero direct table access).
- Encrypted marketplace/courier credentials (AES-256-GCM), HMAC-verified
  courier webhooks, optional per-login TOTP two-factor auth.
- Audit log for sensitive actions.

## Local setup

```bash
npm install
cp .env.example .env.local   # Supabase URL + keys (see .env.example)
npm run dev
```

Open http://localhost:3000 — the landing page. Sign up from there, or go
straight to `/login`.

## Database schema

`db/schema.sql` is the cumulative source of truth (70+ tables, RLS on every
one, trigger-based document numbering). Dated files under `db/` are one-time
idempotent migrations — apply each once, in date order, via the Supabase SQL
Editor. `src/types/database.ts` is regenerated after schema changes (see
`scripts/gen-types.mjs`) — the `companies` trial columns and `trial_status`
function entries were added by hand to match
`db/2026-09-09-omspro-saas-signup.sql`.

## Project structure

```
src/
  app/
    page.tsx             Public 3D landing page (scroll-driven features, pricing, FAQ)
    signup/              Self-serve company signup (action + page)
    login/               Sign-in + 2FA challenge
    dashboard/           One route per module, under app/dashboard/*
    api/                 Courier webhooks, cron jobs, AI companion chat
  components/
    landing/             three.js hero scene + error boundary
    tabs/                Workspace tab bar (window-tab feature)
    assistant/           Vertical assistant side panel
    ...                  Shared UI (header, sidebar/dock, theme, messaging)
  lib/
    saas/plans.ts        Plan definitions shared by landing + billing
    auth/                requireCapability() / getAuthedEmployee()
    audit/               Audit log helper
    automation/          Automation rules engine
    attendance/          Punch, carry-over, work-hours calculations
  types/database.ts      Generated from db/schema.sql — do not hand-edit
db/
  schema.sql             Full PostgreSQL schema (cumulative source of truth)
  YYYY-MM-DD-*.sql       Dated, idempotent incremental migrations
scripts/
  gen-types.mjs          Local type generator
```

## Operating rules for anyone working on this codebase

- Database-altering SQL ships as a dated `.sql` file under `db/`, run
  manually by an authorized person via the Supabase SQL Editor, and
  re-verified afterward. It is never executed directly against the live
  database by tooling.
- Every migration file is idempotent (`IF NOT EXISTS`,
  `ON CONFLICT DO NOTHING`) and dry-run tested before delivery.
- Capability checks stay server-side; company scoping is re-checked on
  every write. A UI-level check alone is never trusted.
