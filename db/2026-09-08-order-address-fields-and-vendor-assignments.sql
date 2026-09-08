-- 2026-09-08 — Structured buyer address fields + multi-cycle vendor
-- assignment tracking on Orders.
--
-- Two independent additions, bundled in one migration because both came out
-- of the same round of work:
--
-- 1. ORDERS.buyer_address1/2/3, buyer_city, buyer_state, buyer_postal_code
--    ------------------------------------------------------------------
--    Root-cause fix for addresses never populating correctly at courier
--    booking time: `orders.buyer_name_address` is a single free-text
--    multi-line "paste it all in one box" field (kept for packing-slip
--    printing — NOT removed here), and until now it was the ONLY address
--    data captured on an order. There has never been a structured
--    address1/city/state/postcode anywhere in this schema. Courier booking
--    (create-shipment-form.tsx) needs these as separate fields per courier
--    API norms (FedEx/UPS/Aramex/DHL/Delhivery/Shiprocket/Shipglobal all
--    take address line(s) + city + state + postcode as distinct fields,
--    never a single blob) — this migration is what lets the Order page
--    finally collect that structured data at entry time instead of an
--    employee re-typing it from scratch during every booking.
--
--    COUNTRY is NOT a new column here — `orders.destination_country` (free
--    text, already on the schema and already wired into both order forms)
--    is reused as the structured Country field. No redundant new country
--    column.
--
--    All 6 columns are nullable: existing rows and any order entered
--    before this round (or via bulk import) simply have them NULL, same
--    as every other optional order field. buyer_name_address stays as the
--    single source of truth for anyone who hasn't filled in the structured
--    fields yet; the courier-booking lookup (actions.ts) prefers the
--    structured fields when present and falls back sensibly otherwise —
--    see that file for the exact precedence.
--
-- 2. order_vendor_assignments — multi-cycle vendor assign/receive history
--    ------------------------------------------------------------------
--    `orders.vendor_party_id` / `vendor_date` / `received_date` already
--    exist on this table, but (confirmed by grep across src/app before
--    writing this) `vendor_date` and `received_date` have ZERO usages
--    anywhere in the app — dead columns. `vendor_party_id` IS wired (the
--    "Purchasing From (if known)" select at order-creation time) and is
--    read by ~20 other files (reports, purchase-bill forms, order list
--    filters) as "the order's current vendor" — that usage is NOT being
--    changed or removed here.
--
--    Per explicit user instruction, a single assigned_date/received_date
--    pair is not enough: if a vendor gets an order wrong, it needs to be
--    reassigned and the whole cycle repeats. That needs a real history
--    table, not two columns. This table is that history; `cycle_no` gives
--    each row a stable "assignment 1 of N" position on the order (same
--    pattern as order_shipments.shipment_no).
--
--    orders.vendor_party_id keeps meaning "current vendor" — the
--    application code that writes a new row here (see
--    src/app/dashboard/orders/vendor-assignment-actions.ts) also updates
--    orders.vendor_party_id (and vendor_date/received_date, so those two
--    previously-dead columns finally mirror the latest cycle instead of
--    sitting unused) to the latest cycle's values, so every existing
--    report/filter/form that already reads orders.vendor_party_id keeps
--    working unchanged and stays current after a reassignment.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, DROP
-- POLICY IF EXISTS + re-CREATE) — safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Structured buyer address fields on orders
-- ---------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_address1    text,
  ADD COLUMN IF NOT EXISTS buyer_address2    text,
  ADD COLUMN IF NOT EXISTS buyer_address3    text,
  ADD COLUMN IF NOT EXISTS buyer_city        text,
  ADD COLUMN IF NOT EXISTS buyer_state       text,
  ADD COLUMN IF NOT EXISTS buyer_postal_code text;

COMMENT ON COLUMN orders.buyer_address1 IS 'Structured address line 1 (street/house). Added 2026-09-08 — see migration header. NULL for orders entered before this round or not yet backfilled; buyer_name_address remains the fallback.';
COMMENT ON COLUMN orders.buyer_address2 IS 'Structured address line 2 (optional — apartment/area/etc).';
COMMENT ON COLUMN orders.buyer_address3 IS 'Structured address line 3 (optional — rarely needed; some courier APIs, e.g. Shipglobal, accept a 3rd line).';
COMMENT ON COLUMN orders.buyer_city IS 'Structured city. Auto-filled client-side from buyer_postal_code + destination_country where a free lookup service covers that country (see src/lib/postal-lookup.ts); always employee-editable after auto-fill.';
COMMENT ON COLUMN orders.buyer_state IS 'Structured state/province. Same auto-fill note as buyer_city.';
COMMENT ON COLUMN orders.buyer_postal_code IS 'Structured postal/zip/PIN code. Country context for it is orders.destination_country (existing free-text column — not duplicated here).';

-- ---------------------------------------------------------------------
-- 2. order_vendor_assignments — multi-cycle assign/receive history
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_vendor_assignments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                uuid NOT NULL REFERENCES orders(id),
  cycle_no                integer NOT NULL,   -- 1-based; "assignment i of N" for this order — same pattern as order_shipments.shipment_no
  party_id                uuid NOT NULL REFERENCES parties(id),
  assigned_date           date NOT NULL,
  received_date           date,               -- NULL until marked received
  remark                  text,
  created_by_employee_id  uuid REFERENCES employees(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (cycle_no > 0),
  UNIQUE (order_id, cycle_no)
);
CREATE INDEX IF NOT EXISTS idx_order_vendor_assignments_order ON order_vendor_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_vendor_assignments_party ON order_vendor_assignments(party_id);

ALTER TABLE order_vendor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_vendor_assignments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_authenticated_all ON order_vendor_assignments;
CREATE POLICY allow_authenticated_all ON order_vendor_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE order_vendor_assignments IS 'Multi-cycle vendor assign/receive history for an order — see migration header 2026-09-08-order-address-fields-and-vendor-assignments.sql. orders.vendor_party_id/vendor_date/received_date are kept in sync to the LATEST row here by application code (src/app/dashboard/orders/vendor-assignment-actions.ts); this table is the source of truth for the full history, those columns are a current-value mirror for existing reports/forms.';

COMMIT;
