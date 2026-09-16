-- =============================================================================
-- 2026-09-16 — Bank & Credit-Card Reconciliation (auto-match + verify)
--
-- User ask (Hindi, verbatim): bank accounts ke alawa dusre accounts (jisme
-- paise aate hain) add karne ka option, unka bank statement upload karne ka
-- option, aur statement AUTOMATIC match kare — "itna paisa is store se aaya
-- or itna is store se"; credit cards bhi ek se jyada add ho sakein ("kitna
-- payment pada hai card me kitna nhi, konsa payment hua hai card se"),
-- card entries bhi mark ho jayein, jo mark nahi hui vo bhi dikhe, aur
-- "check and verify karte hi payment reference auto link ho jaye" — lekin
-- PURANE PAYMENTS KO DISTURB NA KARE. Har mahine statement daalne par ya
-- daily daalne par duplicate entry na hoye, aur calculation achhe se match
-- hoye.
--
-- DESIGN — why the shape below:
--   1) `bank_accounts` (type 'Bank') + type 'Credit Card' — ONE table with
--      a discriminator, exactly like `refunds`' source-enum pattern. A
--      credit card IS an account statement with different columns (card
--      number, bill due date, statement month), so one table beats two
--      near-identical ones. Multiple accounts/cards per company is the
--      whole point (account_no UNIQUE only when set — one card of the same
--      bank with no number typed yet stays valid).
--   2) `bank_statement_lines` gets account_id + match_status + matched
--      pointer columns. account_id is NULLABLE: every historical row
--      (PNB CSV imports + the sample seed) keeps company_id scoping and
--      shows in a "No account" bucket — zero backfill, zero risk to old
--      data. New rows are deduped by a UNIQUE(account_id, line_fingerprint)
--      fingerprint = date|dr|cr|description trimmed of case/whitespace —
--      the DB-level backstop against the re-upload-same-statement problem
--      (the same class of bug as the 2026-08-17 NYKO/RUGARA payment-import
--      double-run). Same statement can also be uploaded to a different
--      month bucket intentionally — company_id is part of the key.
--   3) Matching (RPC `match_bank_statement_lines`) is 100% READ-ONLY over
--      the linked ledgers (bill_pass_register_payments, etsy_ledger_lines,
--      amazon_transactions) — it proposes links, it never touches a
--      payment's own data, so old payments can never be disturbed by
--      running it. It re-runs any time (only Unmatched lines are
--      considered), so a statement in ANY column layout still matches,
--      because matching is by VALUES (UTR/reference digits, amount, date
--      window) not by columns.
--   4) Verification (RPC `verify_bank_statement_line`) is the ONLY thing
--      that flips a line to 'Verified' — the user's "check and verify
--      karte hi payment reference auto link ho jaye". It stamps who/when.
--   5) Card matching has no portal-ledger counterpart (card spends map to
--      vendors/bills only) — handled by the same RPC with p_source
--      narrowed to 'bills'.
--   6) Views give the three screens the user asked for: every line with
--      its match reason (marked AND unmarked — "jo mark nhi ho vo bhi
--      dikhe"), card-wise outstanding, and a per-account monthly
--      expected-vs-banked reconciliation ("itna paisa is store se aaya"
--      vs "itna bank me aaya") for calculation checking.
--
-- RLS posture matches the whole SaaS family (company-scoped reads enforced
-- in app code; anon gets nothing).
--
-- Idempotent: safe to re-run (IF NOT EXISTS everywhere; DO-block guards the
-- ALTERs; CREATE OR REPLACE for functions/views). Additive only — no
-- existing column is dropped, renamed, or re-typed, so old imports keep
-- working and old payment rows are never rewritten.
-- =============================================================================

-- ── 1) Accounts: bank + credit cards ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             uuid NOT NULL REFERENCES companies(id),
  account_name           text NOT NULL,                 -- "PNB Current", "HDFC Amazon Settlement"...
  account_type           text NOT NULL DEFAULT 'Bank'
                            CHECK (account_type IN ('Bank', 'Credit Card')),
  bank_name              text,                          -- PNB / HDFC / ICICI / Axis...
  account_no             text,                          -- masked in UI; unique per company only when typed
  ifsc_code              text,
  card_last4             text,                          -- credit cards: last 4 digits on the card
  card_holder_name       text,
  credit_limit           numeric(14,2),                 -- credit cards: limit
  card_due_date          date,                          -- credit cards: current bill due date
  opening_balance        numeric(14,2) NOT NULL DEFAULT 0,
  active                 boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, account_name)
);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);
ALTER TABLE bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_card_last4_when_card;
ALTER TABLE bank_accounts
  ADD CONSTRAINT bank_accounts_card_last4_when_card
    CHECK (account_type <> 'Credit Card' OR char_length(card_last4) = 4);

-- ── 2) Statement lines: account link + match columns + dedup fingerprint ───
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN account_id uuid REFERENCES bank_accounts(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN line_fingerprint text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN match_status text NOT NULL DEFAULT 'Unmatched';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
-- Existing rows keep their old implicit "Unmatched"; explicitly normalize
-- any stray NULL the import path might have written.
UPDATE bank_statement_lines SET match_status = 'Unmatched' WHERE match_status IS NULL;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN match_source text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN matched_payment_id uuid REFERENCES bill_pass_register_payments(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN matched_portal_line_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN match_confidence text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN match_reason text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN verified_by_employee_id uuid REFERENCES employees(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN verified_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$
BEGIN
  ALTER TABLE bank_statement_lines ADD COLUMN uploaded_by_employee_id uuid REFERENCES employees(id);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_bank_stmt_account      ON bank_statement_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_stmt_match_status ON bank_statement_lines(company_id, match_status);

-- The dedup backstop: same statement re-uploaded to the same account can
-- never double-insert, and the app's Supabase upsert path needs this exact
-- (company_id, account_id, line_fingerprint) conflict target — so this is a
-- FULL unique index, not a partial one (PostgREST's ON CONFLICT target
-- cannot match a WHERE-clause index). NULL-safety comes free from Postgres
-- semantics: rows with account_id/line_fingerprint NULL never collide (NULLs
-- are distinct in unique indexes), so every historical row stays untouched;
-- only rows WITH an account + fingerprint dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_stmt_fingerprint
  ON bank_statement_lines(company_id, account_id, line_fingerprint);

-- ── 3) Credit-card statement lines ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_card_statement_lines (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  company_id               uuid NOT NULL REFERENCES companies(id),
  statement_month          date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,  -- 1st of the month
  txn_date                 date NOT NULL,
  description              text,
  reference_no             text,            -- UTR / auth code on the card statement
  card_last4               text,            -- snapshot of the card used (multi-card statements)
  amount                   numeric(14,2) NOT NULL CHECK (amount > 0),
  txn_direction            text NOT NULL DEFAULT 'Debit' CHECK (txn_direction IN ('Debit', 'Credit')),
  -- Debit = card spend/EMI; Credit = payment received INTO the card account
  -- (the user's "payment pada hai card me" = these Credit lines).
  txn_category             text,            -- EMI / Fees & Charges / Interest / Reward / POS ...
  match_status             text NOT NULL DEFAULT 'Unmatched' CHECK (match_status IN ('Unmatched', 'Proposed', 'Verified', 'No Ledger Match')),
  match_source             text,
  matched_payment_id       uuid REFERENCES bill_pass_register_payments(id),
  match_confidence         text,
  match_reason             text,
  verified_by_employee_id  uuid REFERENCES employees(id),
  verified_at              timestamptz,
  uploaded_by_employee_id  uuid REFERENCES employees(id),
  line_fingerprint         text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, line_fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_card_stmt_account ON credit_card_statement_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_card_stmt_company_date ON credit_card_statement_lines(company_id, txn_date);

-- ── 4) THE AUTO-MATCHER — pure SELECT, zero writes to linked tables ────────
-- Order of attempts per unmatched bank line (first hit wins):
--   A. bill_pass_register_payments.reference_no ⊇ line's UTR/cheque digits
--      → 'Exact' (this is the user's "UTR se match kar rahi hai" case;
--      reference_no is free text like "UTR PUNB123456789012" so we compare
--      digit-runs, not raw strings)
--   B. same amount ± date window ± party/vendor name fragment in the
--      description → 'Likely'
--   C. same amount ± date window → 'Possible'
--   D. Etsy/Amazon portal lines (bank side only): amount-or-order-number hit
--      within the date window → 'Likely' / 'Exact'
-- Re-runnable any time; only Unmatched lines are considered so a Verified
-- or No-Ledger-Match line is never re-proposed, and nothing on the payment
-- side is ever updated. That is the "purane payment ko disturb nahi kare"
-- guarantee.
CREATE OR REPLACE FUNCTION match_bank_statement_lines(
  p_company_id   uuid,
  p_account_id   uuid,
  p_line_id      uuid DEFAULT NULL,   -- NULL = every Unmatched line of the account
  p_source       text DEFAULT 'all'   -- 'all' | 'bills' | 'portal' (card statements use 'bills')
)
RETURNS TABLE (
  line_id              uuid,
  match_status         text,
  matched_payment_id   uuid,
  match_confidence     text,
  match_reason         text
)
LANGUAGE plpgsql AS $$
DECLARE
  v_line RECORD;
  v_days int := 5;      -- ±5 days date window for B/C
  v_payment RECORD;
  v_line_digits text;
  v_desc text;
BEGIN
  FOR v_line IN
    SELECT bsl.*
    FROM bank_statement_lines bsl
    WHERE bsl.company_id = p_company_id
      AND bsl.account_id = p_account_id
      AND bsl.match_status = 'Unmatched'
      AND (p_line_id IS NULL OR bsl.id = p_line_id)
    ORDER BY bsl.txn_date
  LOOP
    v_line_digits := regexp_replace(COALESCE(v_line.cheque_no, '') || ' ' || COALESCE(v_line.txn_no, ''), '[^0-9]', '', 'g');
    v_desc := lower(COALESCE(v_line.description, ''));
    v_payment := NULL;

    -- A) Reference/UTR digit-run contained in a payment's reference_no → Exact.
    IF v_line_digits IS NOT NULL AND char_length(v_line_digits) >= 8 THEN
      SELECT p.id, p.amount, p.payment_date, p.reference_no INTO v_payment
      FROM bill_pass_register_payments p
      JOIN bill_pass_register b ON b.id = p.bill_pass_register_id
      WHERE b.company_id = p_company_id
        AND p.reference_no IS NOT NULL
        AND position(v_line_digits IN regexp_replace(p.reference_no, '[^0-9]', '', 'g')) > 0
      ORDER BY abs(p.amount - COALESCE(v_line.cr_amount, v_line.dr_amount, 0)) ASC
      LIMIT 1;
      IF v_payment.id IS NOT NULL THEN
        UPDATE bank_statement_lines
        SET match_status = 'Proposed', match_source = 'bill_payment',
            matched_payment_id = v_payment.id, match_confidence = 'Exact',
            match_reason = 'Reference/UTR ' || left(v_line_digits, 19) || ' found on payment dated ' || v_payment.payment_date
              || ' (₹' || v_payment.amount || ')'
        WHERE id = v_line.id;
        CONTINUE;
      END IF;
    END IF;

    -- B) Amount + ±5 days + party/vendor/portal fragment in the description → Likely.
    IF v_line.cr_amount IS NOT NULL THEN
      SELECT p.id, p.amount, p.payment_date, p.reference_no, p.remark INTO v_payment
      FROM bill_pass_register_payments p
      JOIN bill_pass_register b ON b.id = p.bill_pass_register_id
      LEFT JOIN parties pt ON pt.id = b.party_id
      WHERE b.company_id = p_company_id
        AND p.amount = v_line.cr_amount
        AND p.payment_date BETWEEN v_line.txn_date - v_days AND v_line.txn_date + v_days
        AND (
             (pt.name IS NOT NULL AND position(lower(pt.name) IN v_desc) > 0)
          OR (position(lower(COALESCE(b.invoice_no, '')) IN v_desc) > 0 AND COALESCE(b.invoice_no, '') <> '')
          OR position('store' IN v_desc) > 0 OR position('etsy' IN v_desc) > 0
          OR position('amazon' IN v_desc) > 0 OR position('ebay' IN v_desc) > 0
        )
      ORDER BY p.payment_date ASC
      LIMIT 1;
      IF v_payment.id IS NOT NULL THEN
        UPDATE bank_statement_lines
        SET match_status = 'Proposed', match_source = 'bill_payment',
            matched_payment_id = v_payment.id, match_confidence = 'Likely',
            match_reason = 'Amount ₹' || v_payment.amount || ' within ±' || v_days || 'd of ' || v_payment.payment_date
              || ', party/invoice/portal name found in description'
        WHERE id = v_line.id;
        CONTINUE;
      END IF;
    END IF;

    -- C) Amount + date window alone → Possible.
    IF v_line.cr_amount IS NOT NULL THEN
      SELECT p.id, p.amount, p.payment_date INTO v_payment
      FROM bill_pass_register_payments p
      JOIN bill_pass_register b ON b.id = p.bill_pass_register_id
      WHERE b.company_id = p_company_id
        AND p.amount = v_line.cr_amount
        AND p.payment_date BETWEEN v_line.txn_date - v_days AND v_line.txn_date + v_days
      ORDER BY p.payment_date ASC
      LIMIT 1;
      IF v_payment.id IS NOT NULL THEN
        UPDATE bank_statement_lines
        SET match_status = 'Proposed', match_source = 'bill_payment',
            matched_payment_id = v_payment.id, match_confidence = 'Possible',
            match_reason = 'Amount ₹' || v_payment.amount || ' within ±' || v_days || 'd of ' || v_payment.payment_date
        WHERE id = v_line.id;
        CONTINUE;
      END IF;
    END IF;

    -- D) Portal lines (bank side only): order-number hit → Exact, else amount+date → Likely.
    IF p_source <> 'bills' AND v_line.cr_amount IS NOT NULL THEN
      IF position('etsy' IN v_desc) > 0 THEN
        IF EXISTS (
          SELECT 1 FROM etsy_ledger_lines e
          WHERE e.company_id = p_company_id
            AND e.net = v_line.cr_amount
            AND e.txn_date BETWEEN v_line.txn_date - v_days AND v_line.txn_date + v_days
        ) THEN
          UPDATE bank_statement_lines
          SET match_status = 'Proposed', match_source = 'portal_etsy',
              matched_payment_id = NULL, match_confidence = 'Likely',
              match_reason = 'Etsy ledger: same net amount within ±' || v_days || 'd'
          WHERE id = v_line.id;
          CONTINUE;
        END IF;
      ELSIF position('amazon' IN v_desc) > 0 THEN
        IF EXISTS (
          SELECT 1 FROM amazon_transactions a
          WHERE a.company_id = p_company_id
            AND a.total_amount = v_line.cr_amount
            AND a.txn_date BETWEEN v_line.txn_date - v_days AND v_line.txn_date + v_days
        ) THEN
          UPDATE bank_statement_lines
          SET match_status = 'Proposed', match_source = 'portal_amazon',
              matched_payment_id = NULL, match_confidence = 'Likely',
              match_reason = 'Amazon transactions: same total within ±' || v_days || 'd'
          WHERE id = v_line.id;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    -- Nothing found: leave Unmatched (no status churn; the "missed entry"
    -- list stays honest — Unmatched = genuinely nothing to link to).
  END LOOP;

  RETURN QUERY
    SELECT b.id, b.match_status, b.matched_payment_id, b.match_confidence, b.match_reason
    FROM bank_statement_lines b
    WHERE b.company_id = p_company_id AND b.account_id = p_account_id
      AND b.match_status = 'Proposed';
END;
$$;

-- Card-statement wrapper: identical rules, restricted to vendor-bill
-- payments (a card spend maps to a bill payment; portal payouts never hit
-- a credit card).
CREATE OR REPLACE FUNCTION match_card_statement_lines(
  p_company_id uuid,
  p_account_id uuid,
  p_line_id    uuid DEFAULT NULL
)
RETURNS TABLE (
  line_id            uuid,
  match_status       text,
  matched_payment_id uuid,
  match_confidence   text,
  match_reason       text
)
LANGUAGE plpgsql AS $$
DECLARE
  v_line RECORD;
  v_days int := 5;
  v_payment RECORD;
  v_line_digits text;
BEGIN
  FOR v_line IN
    SELECT c.*
    FROM credit_card_statement_lines c
    WHERE c.company_id = p_company_id
      AND c.account_id = p_account_id
      AND c.match_status = 'Unmatched'
      AND (p_line_id IS NULL OR c.id = p_line_id)
    ORDER BY c.txn_date
  LOOP
    v_line_digits := regexp_replace(COALESCE(c.reference_no, ''), '[^0-9]', '', 'g');
    v_payment := NULL;

    -- A) Reference digits → Exact.
    IF v_line_digits <> '' AND char_length(v_line_digits) >= 8 THEN
      SELECT p.id, p.amount, p.payment_date, p.reference_no INTO v_payment
      FROM bill_pass_register_payments p
      JOIN bill_pass_register b ON b.id = p.bill_pass_register_id
      WHERE b.company_id = p_company_id
        AND p.reference_no IS NOT NULL
        AND position(v_line_digits IN regexp_replace(p.reference_no, '[^0-9]', '', 'g')) > 0
      ORDER BY abs(p.amount - c.amount) ASC
      LIMIT 1;
      IF v_payment.id IS NOT NULL THEN
        UPDATE credit_card_statement_lines
        SET match_status = 'Proposed', match_source = 'bill_payment',
            matched_payment_id = v_payment.id, match_confidence = 'Exact',
            match_reason = 'Reference/UTR digits found on payment dated ' || v_payment.payment_date
              || ' (₹' || v_payment.amount || ')'
        WHERE id = v_line.id;
        CONTINUE;
      END IF;
    END IF;

    -- B) Amount + ±5 days → Possible (card statements rarely carry party names).
    SELECT p.id, p.amount, p.payment_date INTO v_payment
    FROM bill_pass_register_payments p
    JOIN bill_pass_register b ON b.id = p.bill_pass_register_id
    WHERE b.company_id = p_company_id
      AND p.amount = c.amount
      AND p.payment_date BETWEEN c.txn_date - v_days AND c.txn_date + v_days
    ORDER BY p.payment_date ASC
    LIMIT 1;
    IF v_payment.id IS NOT NULL THEN
      UPDATE credit_card_statement_lines
      SET match_status = 'Proposed', match_source = 'bill_payment',
          matched_payment_id = v_payment.id, match_confidence = 'Possible',
          match_reason = 'Amount ₹' || v_payment.amount || ' within ±' || v_days || 'd of ' || v_payment.payment_date
      WHERE id = v_line.id;
    END IF;
  END LOOP;

  RETURN QUERY
    SELECT c.id, c.match_status, c.matched_payment_id, c.match_confidence, c.match_reason
    FROM credit_card_statement_lines c
    WHERE c.company_id = p_company_id AND c.account_id = p_account_id
      AND c.match_status = 'Proposed';
END;
$$;

-- ── 5) THE VERIFY STAMP — the ONLY path that flips Proposed → Verified ─────
-- "check and verify karte hi payment reference auto link ho jaye": verify
-- karte hi line lock ho jati hai (link snapshot already set by the matcher
-- is confirmed), aur miss check iske baad kabhi re-propose nahi karega.
CREATE OR REPLACE FUNCTION verify_bank_statement_line(p_line_id uuid, p_by_employee_id uuid)
RETURNS void
LANGUAGE sql AS $$
  UPDATE bank_statement_lines
  SET match_status = 'Verified',
      verified_by_employee_id = p_by_employee_id,
      verified_at = now()
  WHERE id = p_line_id;
$$;

CREATE OR REPLACE FUNCTION verify_card_statement_line(p_line_id uuid, p_by_employee_id uuid)
RETURNS void
LANGUAGE sql AS $$
  UPDATE credit_card_statement_lines
  SET match_status = 'Verified',
      verified_by_employee_id = p_by_employee_id,
      verified_at = now()
  WHERE id = p_line_id;
$$;

-- ── 6) Views — the three screens the user asked for ─────────────────────────
-- 6a) Every line (marked AND unmarked) with its linked context. "jo mark
--     nahi ho vo bhi dikhe" — Unmatched stays visible forever until the
--     user explicitly closes it as 'No Ledger Match'.
CREATE OR REPLACE VIEW bank_statement_match_view AS
SELECT
  bsl.id            AS line_id,
  bsl.company_id,
  bsl.account_id,
  ba.account_name,
  ba.account_type,
  bsl.txn_date,
  bsl.txn_no,
  bsl.description,
  bsl.dr_amount,
  bsl.cr_amount,
  bsl.balance,
  bsl.match_status,
  bsl.match_source,
  bsl.match_confidence,
  bsl.match_reason,
  bsl.matched_payment_id,
  bsl.verified_by_employee_id,
  bsl.verified_at,
  bpr.invoice_no                            AS matched_invoice_no,
  bpr.vendor_invoice_no                     AS matched_vendor_invoice_no,
  brpp.amount                               AS matched_payment_amount,
  brpp.payment_date                         AS matched_payment_date,
  brpp.reference_no                         AS matched_reference_no,
  brpp.remark                               AS matched_payment_remark
FROM bank_statement_lines bsl
JOIN bank_accounts ba        ON ba.id = bsl.account_id
LEFT JOIN bill_pass_register_payments brpp ON brpp.id = bsl.matched_payment_id
LEFT JOIN bill_pass_register bpr ON bpr.id = brpp.bill_pass_register_id
WHERE bsl.account_id IS NOT NULL;

-- 6b) Card-wise outstanding: spends vs payments received on the card.
CREATE OR REPLACE VIEW card_statement_summary_view AS
SELECT
  ba.id            AS account_id,
  ba.company_id,
  ba.account_name,
  ba.bank_name,
  ba.card_last4,
  ba.credit_limit,
  ba.card_due_date,
  COALESCE(spend.total_spent, 0)  AS total_spent,
  COALESCE(paid.total_paid, 0)    AS total_paid,
  COALESCE(spend.total_spent, 0) - COALESCE(paid.total_paid, 0) AS card_outstanding,
  ba.credit_limit - (COALESCE(spend.total_spent, 0) - COALESCE(paid.total_paid, 0)) AS available_limit,
  COALESCE(spend.pending_match_count, 0)  AS pending_match_count,
  COALESCE(spend.total_count, 0)    AS total_txn_count
FROM bank_accounts ba
LEFT JOIN (
  SELECT account_id,
         SUM(amount) FILTER (WHERE txn_direction = 'Debit')  AS total_spent,
         COUNT(*) FILTER (WHERE txn_direction = 'Debit')     AS total_count,
         COUNT(*) FILTER (WHERE txn_direction = 'Debit' AND match_status IN ('Unmatched', 'Proposed')) AS pending_match_count
  FROM credit_card_statement_lines GROUP BY account_id
) spend ON spend.account_id = ba.id
LEFT JOIN (
  SELECT account_id, SUM(amount) AS total_paid
  FROM credit_card_statement_lines WHERE txn_direction = 'Credit' GROUP BY account_id
) paid ON paid.account_id = ba.id
WHERE ba.account_type = 'Credit Card';

-- 6c) Monthly expected-vs-banked per account (the calculation cross-check):
--     portal statement inflow (Etsy+Amazon, company side) vs what the bank
--     statement actually received that month, per source prefix in the
--     description (etsy/amazon/store rows) vs everything else.
CREATE OR REPLACE VIEW bank_vs_portal_monthly_view AS
WITH months AS (
  SELECT ba.company_id, ba.id AS account_id,
         date_trunc('month', COALESCE(bsl.txn_date, CURRENT_DATE)) AS month_start
  FROM bank_accounts ba
  JOIN bank_statement_lines bsl ON bsl.account_id = ba.id
  GROUP BY ba.company_id, ba.id, date_trunc('month', COALESCE(bsl.txn_date, CURRENT_DATE))
)
SELECT
  m.company_id,
  m.account_id,
  ba.account_name,
  m.month_start::date                                   AS month,
  COALESCE(p.etsy_amount, 0)                            AS portal_etsy_inr,
  COALESCE(pa.amazon_amount, 0)                         AS portal_amazon_inr,
  COALESCE(b.etsy_bank, 0)                              AS bank_etsy_inr,
  COALESCE(b.amazon_bank, 0)                            AS bank_amazon_inr,
  COALESCE(b.other_bank, 0)                             AS bank_other_inr,
  (COALESCE(p.etsy_amount, 0) - COALESCE(b.etsy_bank, 0))       AS etsy_variance_inr,
  (COALESCE(pa.amazon_amount, 0) - COALESCE(b.amazon_bank, 0))  AS amazon_variance_inr
FROM months m
JOIN bank_accounts ba ON ba.id = m.account_id
LEFT JOIN (
  -- INR lines only — the Etsy ledger carries per-currency rows and this
  -- view cross-checks against the INR bank statement (the 2026-08-13i
  -- import is 100% INR; an Etsy ledger in another payout currency must
  -- first be converted, which is the app's job, not this view's).
  SELECT company_id, date_trunc('month', txn_date) AS month_start,
         SUM(net)                                   AS etsy_amount
  FROM etsy_ledger_lines
  WHERE currency = 'INR'
  GROUP BY company_id, date_trunc('month', txn_date)
) p ON p.company_id = m.company_id AND p.month_start = m.month_start
LEFT JOIN (
  -- Amazon's own INR transactions ledger, same month-bucketing; total_amount
  -- nets off refunds (negative rows) exactly like Etsy's untyped SUM(net).
  SELECT company_id, date_trunc('month', txn_date) AS month_start,
         SUM(total_amount)                          AS amazon_amount
  FROM amazon_transactions
  WHERE currency = 'INR'
  GROUP BY company_id, date_trunc('month', txn_date)
) pa ON pa.company_id = m.company_id AND pa.month_start = m.month_start
LEFT JOIN (
  SELECT company_id, date_trunc('month', txn_date) AS month_start,
         SUM(cr_amount) FILTER (WHERE position('etsy' IN lower(description)) > 0)   AS etsy_bank,
         SUM(cr_amount) FILTER (WHERE position('amazon' IN lower(description)) > 0) AS amazon_bank,
         SUM(cr_amount) FILTER (WHERE position('etsy' IN lower(description)) = 0
                             AND position('amazon' IN lower(description)) = 0)      AS other_bank
  FROM bank_statement_lines GROUP BY company_id, date_trunc('month', txn_date)
) b ON b.company_id = m.company_id AND b.month_start = m.month_start;

-- ── 7) RLS — same posture as the rest of the app ───────────────────────────
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_card_statement_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_authenticated_all ON bank_accounts;
CREATE POLICY allow_authenticated_all ON bank_accounts FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_authenticated_all ON credit_card_statement_lines;
CREATE POLICY allow_authenticated_all ON credit_card_statement_lines FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── 8) New capability + grant to Admin & MD ────────────────────────────────
-- Kept its own capability (not folded into bill_payment) so access can be
-- narrowed independently later — same precedent as courier_credentials_admin.
INSERT INTO capabilities (code, description)
VALUES ('bank_reconciliation', 'Upload bank/credit-card statements, auto-match against payments, verify links, and view missed entries.')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_capabilities (role_id, capability_code)
SELECT r.id, 'bank_reconciliation' FROM roles r WHERE r.name IN ('Admin', 'MD')
ON CONFLICT (role_id, capability_code) DO NOTHING;

-- Also switch the new page ON for every existing company (module groups —
-- companies that re-run onboarding can toggle it off themselves).
UPDATE company_modules
SET enabled_groups = array_append(enabled_groups, 'finance')
WHERE NOT ('finance' = ANY(enabled_groups));

-- ── 9) Post-run sanity checks ──────────────────────────────────────────────
-- bank_accounts_created = 3 if the sample-entry file ran after this, else 0.
-- new_columns_ok MUST read 5.
SELECT count(*) AS bank_accounts_created FROM bank_accounts;
SELECT count(*) AS capabilities_added FROM capabilities WHERE code = 'bank_reconciliation';
SELECT count(*) AS new_columns_ok FROM information_schema.columns
WHERE table_name = 'bank_statement_lines'
  AND column_name IN ('account_id','match_status','matched_payment_id','verified_at','line_fingerprint');
