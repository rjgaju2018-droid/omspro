# OMS Pro — System Architecture

> Complete architecture reference for the OMS Pro multi-tenant Order
> Management System. Diagrams are [Mermaid](https://mermaid.js.org/) — they
> render on GitHub. Companion docs: `README.md` (business rules),
> `db/schema.sql` (the database itself, 74+ tables, numbered sections),
> `BRAIN.md` (decision log).

---

## 1. The big picture

OMS Pro is a **single Next.js app + one Postgres (Supabase) database**,
multi-tenant by design: every company that signs up gets its own workspace
(own logo, own document numbering, own module selection) inside one shared
database, isolated by Row Level Security + server-side company scoping.

```mermaid
flowchart LR
    subgraph Public["Public (no auth)"]
        L["/ Landing — 3D export journey"]
        S["/signup — company self-registration"]
        LI["/login — email+password (+2FA)"]
    end

    subgraph App["Next.js app (Vercel)"]
        W["Onboarding wizard\nprofile → company → modules"]
        D["Dashboard modules\norders · dispatch · documents · finance\ninventory · HR · salary · reports · courier"]
        A["Server Actions\nrequireCapability() gate"]
        CRON["Cron routes\norder sync · courier polling"]
        WH["Webhooks\nDelhivery · Shiprocket · UPS · generic"]
    end

    subgraph Data["Supabase (Postgres + Auth + Storage)"]
        AUTH["Auth users"]
        DB[("74+ tables\nRLS enabled")]
        STORE["Storage buckets\ncompany-logos · photos"]
        RT["Realtime\ncompanion_events · messages"]
    end

    subgraph External["External services"]
        RZP["Razorpay\nsubscriptions"]
        CR["Couriers\nFedEx · UPS · DHL · Aramex\nDelhivery · Shiprocket"]
        ICA["indian-courier-api\n(self-hosted tracker)\nEkart · DTDC · Bluedart · Ecom"]
        MP["Marketplaces\nEtsy · eBay · Amazon"]
    end

    Public --> App
    W --> DB
    D --> A --> DB
    CRON --> MP
    CRON --> CR
    WH --> DB
    App <--> RT
    App --> RZP
    App --> CR
    App --> ICA
    App --> STORE
```

---

## 2. Request lifecycle & the security spine

Every privileged read/write passes through **one choke point**:
`getAuthedEmployee()` in `src/lib/auth/require-capability.ts`.

```mermaid
sequenceDiagram
    participant B as Browser
    participant MW as proxy.ts (middleware)
    participant SA as Server Action / RSC
    participant GA as getAuthedEmployee()
    participant DB as Supabase

    B->>MW: request /dashboard/*
    MW->>DB: getUser() + employee check
    MW-->>B: 401 → /login (no session / no employee row)
    B->>SA: action or page
    SA->>GA: requireCapability("doc_entry")
    GA->>GA: 2FA level check (AAL2)
    GA->>DB: employees, role_capabilities,<br/>company access, company_modules
    GA->>GA: capabilities ∩ company's enabled modules
    GA-->>SA: employee + effective capabilities
    SA->>DB: service-role query (company-scoped)
    SA-->>B: result / revalidate
```

Guarantees:

1. **Role capabilities** — what the employee's role grants (`role_capabilities`).
2. **Company module selection** — what the company switched on during
   onboarding (`company_modules.enabled_groups`). The effective capability
   list is the **intersection**, applied inside `getAuthedEmployee()` — so a
   company that turned HR off has no HR tiles *and* its HR actions are
   rejected server-side.
3. **RLS** — every table denies `anon`; the anon key alone reads nothing.
4. **Service-role only in actions** — after identity + capability are proven.

---

## 3. Multi-tenancy & onboarding

```mermaid
flowchart TD
    SU["/signup\nname + email + company"] --> AU["auth.users row"]
    AU --> CO["companies row\ntrial=14d, short_code auto"]
    CO --> EM["employees row\nCompany Owner role"]
    CO --> CM["company_modules row\ndefault groups"]
    EM --> LG["First login"]
    LG -->|"onboarding_completed_at IS NULL"| OB["/dashboard/onboarding wizard"]
    OB --> P1["Step 1: profile\nname + photo"]
    OB --> P2["Step 2: company\nname, short_code, logo"]
    OB --> P3["Step 3: modules\ntick what you run"]
    P3 --> ST["companies.onboarding_completed_at = now()"]
    ST --> DH["Dashboard shows ONLY chosen modules"]
    LG -->|"already complete"| DH
```

- **Old companies** (pre-wizard) are stamped complete by the migration —
  nothing changes for them until they opt in.
- **Module groups** (`src/lib/company-modules.ts`): orders, dispatch,
  documents, finance, inventory, hr, salary, reports, crm, courier,
  marketing, admin. DB stores group ids; the app expands them to capability
  codes, so adding a page to a group never needs a migration.
- **Re-branding**: logo uploads go to the public `company-logos` bucket;
  `companies.logo_url` feeds the dashboard header, printed invoices, and the
  small "Powered by OMS Pro" export watermark.

---

## 4. Data model (core slice)

```mermaid
erDiagram
    companies ||--o{ employees : "employs"
    companies ||--o{ stores : "sells on"
    companies ||--o{ company_modules : "chooses"
    companies ||--o{ orders : "owns"
    roles ||--o{ employees : "role"
    roles ||--o{ role_capabilities : ""
    capabilities ||--o{ role_capabilities : ""
    orders ||--o{ order_packages : "ships as"
    order_packages }o--o{ shipments : "AWB groups"
    shipments }o--|| couriers : "booked via"
    companies ||--o{ courier_credentials : "encrypted keys"
    orders ||--o{ order_refunds : "returns"
    companies ||--o{ bill_pass_register : "payables"
    employees ||--o{ attendance : "punches"
    employees ||--o{ companion_events : "assistant"
```

- `db/schema.sql` is the single source of truth — numbered sections, 74+
  tables, triggers for document numbering (`reserve_next_number`), views for
  reconciliation (freight/duty variance).
- Migrations are dated SQL files in `db/` — additive, idempotent.

---

## 5. Courier & tracking integrations

Two complementary families:

| Family | Couriers | Direction | Where |
|---|---|---|---|
| Direct APIs | FedEx, UPS, DHL, Aramex, Delhivery, Shiprocket, Shipglobal | Booking (create label/AWB) + webhooks + polling crons | `src/lib/couriers/*-ship.ts`, `src/app/api/webhooks/courier/*`, `vercel.json` crons |
| indian-courier-api | Ekart, Ecom, DTDC, Bluedart, Shadowfax, Gati, Maruti (+DHL) | Tracking-only, via self-hosted service | `src/lib/couriers/indian-courier-tracking.ts` + `/api/couriers/indian-track` |

```mermaid
flowchart LR
    UI["Courier Booking page"] -->|"book"| LIB["src/lib/couriers/*"]
    LIB -->|"OAuth/token"| FEDEX[FedEx]
    LIB --> UPSAPI[UPS]
    LIB --> DHLAPI[DHL]
    LIB --> DEL[Delhivery]
    LIB --> SR[Shiprocket]
    WH["Webhook routes\nHMAC-verified"] --> DB2[("shipments +\ntracking_events")]
    CRONJ["Vercel cron 3am\npoll FedEx/DHL/Aramex"] --> DB2
    SUB["/api/couriers/indian-track"] --> SVC["indian-courier-api\nself-hosted :5050"]
    SVC --> EK[Ekart] & DT[DTDC] & BL[Bluedart] & EC[Ecom]
    SUB --> DB2
```

**indian-courier-api setup** (user task, one-time):
```bash
git clone https://github.com/rajatdhoot123/indian-courier-api
cd indian-courier-api && npm install && npm start   # :5050
# deploy anywhere reachable, then set env var on the OMS Pro project:
#   INDIAN_COURIER_API_BASE=https://your-tracker.example.com
```

---

## 6. The AI-operated layer

OMS Pro is increasingly **AI-operated**: software that notices, narrates,
and celebrates instead of waiting to be asked.

| Signal | Automated reaction |
|---|---|
| Birthday / work anniversary | Virtual Assistant dances on every dashboard + banner; company-wide |
| New employee ID created | DB trigger queues a welcome dance — "ab to party to banti hai" |
| Data saved (invoice, credit/debit note, purchase bill) | Assistant pops with a celebratory nod |
| Error logged (booking failure, validation) | Assistant concerned + Error Tab entry for Admin/MD |
| Trial ending / plan limits | Billing nudges + Enterprise upsell path |
| Order sync (Etsy/eBay/Amazon) | Nightly cron imports, dedupes, attributes to a System employee |

The Virtual Assistant itself: photo-first portrait (user-supplied look),
daily outfit + makeup rotation (pure function of date — no scheduler),
state-driven animations (punch-in, focused, dance, concerned), realtime
events via Supabase `postgres_changes` on `companion_events`.

**Open Code Review** (github.com/alibaba/open-code-review) is the
recommended CI reviewer for this repo — deterministic diff selection +
LLM line-level comments. Suggested wiring:

```yaml
# .github/workflows — user task (needs an LLM API key):
#   npm i -g @alibaba-group/open-code-review
#   ocr config provider   # one-time
#   ocr review --from main --to feature-branch --format json
```

Run it locally against a branch before requesting review; CI integration is
documented in their docs and left as a deliberate user step (needs their
model key).

---

## 7. Frontend architecture

- **App Router** (Next.js 16), Server Components by default; `"use client"`
  only for interactive islands (wizard, sidebar, assistant, 3D scenes).
- **Theming**: 7 dashboard themes + custom accent per employee
  (`employees.theme_id`, `custom_accent_color`) via CSS variables; all
  public pages are dark-first (`slate-950`) so every font stays readable —
  the "every font showing dark according to theme" rule.
- **Navigation**: Work Menu sidebar ⇄ bottom Dock ⇄ browser-style workspace
  tabs — all capability-filtered, now also module-filtered.
- **3D**: plain `three.js` (no react-three-fiber) with two failure layers —
  try/catch around setup + render loop, React error boundary in the parent —
  so a WebGL glitch can never break a page.
- **Animation bits** (`src/components/landing/animated-bits.tsx`):
  SplitText, Reveal, CountUp, Marquee — react-bits-style, dependency-free,
  honoring `prefers-reduced-motion`.

```mermaid
flowchart TD
    ROOT["app/layout.tsx"] --> LAND["/ page.tsx"]
    ROOT --> AUTH["/login /signup"]
    ROOT --> DASH["/dashboard/layout.tsx"]
    DASH --> GA["getAuthedEmployee()"]
    GA --> SIDEBAR["Sidebar/Dock/Tabs\n(capabilities ∩ modules)"]
    GA --> HDR["Header\ncompany switcher · notifications"]
    GA --> COMP["Virtual Assistant\ncompanion-live-provider"]
    DASH --> PAGES["30+ module pages"]
    PAGES --> ACTIONS["Server Actions\nrequireCapability"]
```

---

## 8. Environments & deployment

- **Vercel** (Next.js defaults) + **Supabase** project (Postgres/Auth/
  Storage/Realtime).
- Env vars: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ENCRYPTION_KEY` (AES-256-GCM for stored courier/marketplace keys),
  `CRON_SECRET`, per-courier API keys, `INDIAN_COURIER_API_BASE`.
- Crons: `/api/cron/sync-orders` (2am), `/api/cron/poll-fedex-tracking`
  (3am, also DHL/Aramex).
- Deploys: push to `main` → Vercel build. SQL migrations run manually in
  Supabase SQL Editor (additive, idempotent).

---

## 9. Where to add what

| Task | File(s) |
|---|---|
| New module group / toggle | `src/lib/company-modules.ts` (+ wizard reads it automatically) |
| New dashboard capability | `db/schema.sql` seed + `src/lib/capability-info.ts` |
| New courier | `src/lib/couriers/<name>-*.ts` + `credentials.ts` field defs |
| New landing animation | `src/components/landing/animated-bits.tsx` |
| New celebration trigger | `src/lib/companion/celebrate.ts` + event type in `companion-config.ts` |
| New table | `db/2026-MM-DD-*.sql` (additive, idempotent) + regenerate types |
