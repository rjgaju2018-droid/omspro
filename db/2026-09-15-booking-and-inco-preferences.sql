-- =============================================================================
-- 2026-09-15 — Booking workflow + Inco terms preferences, and courier credit
-- note adjustments (Tally/Zoho-style).
--
-- PART 1 — companies.preferences (jsonb): per-company switches the
-- onboarding wizard / settings page writes:
--   {
--     "booking_mode": "system" | "external",
--       — "order ship hoga to PEHLE invoice banega phir booking hogi, aur
--         step me chose ka option: booking system se karni hai ya bahar ke
--         kisi or option se" (system = OMS Pro Courier Booking; external =
--         book at the courier's own portal, record AWB here afterwards)
--     "default_inco_term": "CIF" | "CFR" | "CF" | "DDP" | "FOB" | "EXW" ...
--       — "invoice me terms add kar dena ki shipment CIF, CFR, CF, DDP jese
--         option me jayegi" — pre-fills the invoice generator.
--   }
--
-- PART 2 — courier_bill_note_links: a courier company's credit note arrives
-- covering N shipments ("10 awb ka credit note aaya to us credit note ki
-- entry ho un 10 shipment ke against"), and later that credit note must be
-- ADJUSTABLE against a specific courier bill ("phir jab party ka bill aaye
-- courier ka to us credit ko us bill me adjust ka option ho duplicate kuch
-- bhi nahi hona chahiye"). The existing credit_notes/debit_notes tables
-- stay as-is (order-scoped); this adds the courier-side join:
--   one credit note row <-> many shipments (AWB), plus an optional
--   adjustment onto one bill_pass_register bill (with a UNIQUE constraint
--   so the same note can never be adjusted twice — no duplicates).
--
-- Idempotent, additive only.
-- =============================================================================

-- 1) Per-company preferences jsonb.
alter table companies add column if not exists preferences jsonb not null default '{}'::jsonb;

comment on column companies.preferences is
  'Per-company switches: booking_mode ("system"|"external") — book shipments via OMS Pro after invoicing or record externally-booked AWBs; default_inco_term — pre-fills the invoice generator (CIF/CFR/CF/DDP/FOB/EXW).';

-- 2) Courier credit notes: which shipments (AWBs) a note covers.
create table if not exists courier_bill_note_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  credit_note_no text NOT NULL,                -- the courier's own CN reference
  note_date     date,
  note_amount   numeric(14,2) NOT NULL,        -- total credit amount from the courier
  -- The shipments/AWBs this note covers (one row per AWB).
  awb_no        text NOT NULL,
  awb_amount    numeric(14,2),                 -- credit attributable to this AWB (optional split)
  courier       text,                          -- free label: FedEx / UPS / Delhivery / ...
  -- Optional adjustment: once a courier BILL arrives, apply this note to it.
  -- UNIQUE keeps the adjustment one-to-one: the same note can never be
  -- adjusted against two bills (no duplicates, ever).
  adjusted_bill_id uuid REFERENCES bill_pass_register(id) ON DELETE SET NULL,
  adjusted_at   timestamptz,
  adjusted_amount numeric(14,2),
  entered_by    uuid REFERENCES employees(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_note_no, awb_no)
);

create index if not exists idx_courier_note_links_company on courier_bill_note_links(company_id);
create index if not exists idx_courier_note_links_bill    on courier_bill_note_links(adjusted_bill_id) where adjusted_bill_id is not null;

alter table courier_bill_note_links enable row level security;

drop policy if exists "courier_note_links_authenticated" on courier_bill_note_links;
create policy "courier_note_links_authenticated"
  on courier_bill_note_links
  for all
  to authenticated
  using (true)
  with check (true);

-- 3) Seed sensible defaults for existing companies (booking: system; no
--    term change — the invoice form's existing default stays).
update companies
set preferences = preferences || '{"booking_mode": "system"}'::jsonb
where preferences = '{}'::jsonb;
