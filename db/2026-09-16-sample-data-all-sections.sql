-- =============================================================================
-- SAMPLE DATA — one entry in EVERY section
-- (run AFTER db/2026-09-16-bank-card-reconciliation.sql, in the Supabase
-- SQL Editor)
--
-- Kya hai ye: har dashboard section me ek-ek real-looking SAMPLE entry, taaki
-- ek nazar me check ho jaye ki sab ache se kaam kar rahe hain — Order,
-- Dispatch, Invoice, Freight Bill + AWB assignment, Duty Bill, Purchase
-- Bill, Washing Entry, Credit Note, Debit Note, Internal Invoice, JV, Bill
-- Pass entry, Bill Payment, Bank account + statement (auto-match),
-- Credit Card + card statement (auto-match), Office Expense.
--
-- SAB KUCH EK KAHANI SE JUDA HAI: sample order SAMPLE-001 → uska dispatch +
-- AWB → uski sales invoice → uska freight + duty bill → uska purchase bill →
-- uske par credit/debit note → Bill Pass entry → us par ₹10,000 payment
-- (bank statement line se auto-match hota hai) → card statement ki ek line
-- bhi payment reference se auto-match hoti hai.
--
-- SAFE TO RE-RUN (idempotent): har INSERT `WHERE NOT EXISTS` guard par
-- chalta hai — dobara chalane par koi bhi row dobara nahi ginegi. Kisi bhi
-- REAL row ko delete/update nahi karta. Document-numbering triggers (DN/CN/
-- CH/II/JV) apne normal sequences par hi chalte hain — koi counter reset
-- nahi hota. Real stores/companies/parties ko touch nahi karta — sab
-- "Sample"-naami rows hain.
-- =============================================================================

-- ── 0) Reusable sample reference rows (party / category / SKU / store) ──────
INSERT INTO parties (name, party_type, payment_type, invoice_type, address, contact_no, email, remark)
SELECT 'Sample Vendor', 'Sample Vendor', 'AGAINST BILL', 'Purchase',
       'D-100, Sector-29, Pratap Nagar, Jaipur', '+91 90000 00000', 'sample.vendor@example.com',
       'Sample data — db/2026-09-16-sample-data-all-sections.sql'
WHERE NOT EXISTS (SELECT 1 FROM parties WHERE name = 'Sample Vendor');

INSERT INTO item_categories (name, hsn_code)
SELECT 'Sample Category', '5705'
WHERE NOT EXISTS (SELECT 1 FROM item_categories WHERE name = 'Sample Category');

INSERT INTO skus (item_category_id, sku_code, notes)
SELECT (SELECT id FROM item_categories WHERE name = 'Sample Category'),
       'SAMPLE-SKU-001', 'Sample data entry'
WHERE NOT EXISTS (SELECT 1 FROM skus WHERE sku_code = 'SAMPLE-SKU-001');

INSERT INTO stores (company_id, name)
SELECT id, 'Sample Store (Demo)' FROM companies WHERE name = 'Nyko Mart'
  AND NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Sample Store (Demo)');

-- Reusable handles (single-row views) — every INSERT below reads from these.
CREATE OR REPLACE VIEW v_sample_company   AS SELECT id, name, short_code FROM companies WHERE name = 'Nyko Mart';
CREATE OR REPLACE VIEW v_sample_store     AS SELECT s.id AS store_id, s.company_id FROM stores s WHERE s.name = 'Sample Store (Demo)';
CREATE OR REPLACE VIEW v_sample_party     AS SELECT id FROM parties WHERE name = 'Sample Vendor';
CREATE OR REPLACE VIEW v_sample_category  AS SELECT id FROM item_categories WHERE name = 'Sample Category';
CREATE OR REPLACE VIEW v_sample_sku       AS SELECT id FROM skus WHERE sku_code = 'SAMPLE-SKU-001';
CREATE OR REPLACE VIEW v_sample_order     AS SELECT id, company_id FROM orders WHERE ref_no = 'SAMPLE-001';

-- Many sections' rows carry a NOT NULL employee FK (orders.entry_by_employee_id
-- etc.). On a real DB the company's own active employee is found by the
-- correlated subqueries below — but on a FRESH schema (employees table empty
-- for this company) every one of them would return NULL and the run would
-- die at the first INSERT. This guard creates one sample employee ONLY when
-- the company has no active employee at all; otherwise it is a no-op.
INSERT INTO employees (company_id, name, role_id, active)
SELECT c.id, 'Sample Employee',
       COALESCE((SELECT r.id FROM roles r WHERE r.name = 'Order Entry' LIMIT 1),
                (SELECT r.id FROM roles r LIMIT 1)),
       true
FROM companies c
WHERE c.name = 'Nyko Mart'
  AND NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.company_id = c.id AND e.active
  );

-- =============================================================================
-- 1) ORDERS — sample order. Deliberately does NOT touch the PO/RF/RG number
--    sequence: its ref_no 'SAMPLE-001' can never collide with it.
-- =============================================================================
INSERT INTO orders (
  company_id, store_id, remark, order_date, ref_no, po_date,
  marketplace_order_no, status, sku_id, sku_label, size_label, qty,
  item_category_id, buyer_name_address, contact_no, email_id, destination_country,
  order_currency, order_value_original, order_value_usd, order_value_inr,
  exchange_rate_source, entry_by_employee_id
)
SELECT
  c.id, st.store_id, 'Sample order — all-sections demo', DATE '2026-09-01', 'SAMPLE-001', DATE '2026-09-01',
  'SAMPLE-MP-001', 'Dispatched', sk.id, 'SAMPLE-SKU-001', '5X7 ft', 2,
  cat.id, 'John Sample, 12 Demo Street, Sampletown', '+1 555 0100', 'john.sample@example.com', 'US',
  'USD', 500.00, 500.00, 42000.00, 'Sample seed data',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN v_sample_store st     ON st.company_id = c.id
JOIN v_sample_sku sk       ON true
JOIN v_sample_category cat ON true
WHERE NOT EXISTS (SELECT 1 FROM orders WHERE ref_no = 'SAMPLE-001');

-- =============================================================================
-- 2) SHIPMENT (order_shipments) — the AWB the rest of the story hangs off.
-- =============================================================================
INSERT INTO order_shipments (
  order_id, shipment_no, courier_name, awb_no, delivered_status, delivered_date,
  booked_freight_amt, booked_currency, booked_amount_source, remark, created_by_employee_id
)
SELECT
  o.id, 1, 'FedEx', 'SAMPLEAWB0001', 'Delivered', DATE '2026-09-08',
  4000.00, 'INR', 'manual', 'Sample shipment',
  (SELECT e.id FROM employees e WHERE e.company_id = o.company_id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_order o
WHERE NOT EXISTS (
  SELECT 1 FROM order_shipments os WHERE os.order_id = o.id AND os.shipment_no = 1
);

-- =============================================================================
-- 3) DISPATCH & INVOICE — dispatch record for the sample order.
-- =============================================================================
INSERT INTO dispatch_invoices (order_id, invoice_no, invoice_date, sq_feet, org_sale_amt_usd, org_sale_amt_inr,
  invoice_amt_usd, invoice_amt_inr, hsn_no, buyer_name, buyer_mail, buyer_contact, buyer_country,
  courier_name, awb_no, duty_tax_mode, shipping_weight_kg, courier_shipping_charge, our_freight_amt,
  demand_surcharge_other_charge, base_rate, discount, fuel_amt, gst_18pct, total_amt, remark)
SELECT o.id, 'SAMPLE-INV-001', DATE '2026-09-02', 35.0, 500.00, 42000.00, 500.00, 42000.00, '5705',
  'John Sample', 'john.sample@example.com', '+1 555 0100', 'US', 'FedEx', 'SAMPLEAWB0001', 'CSB-V', 10.000,
  3500.00, 3000.00, 100.00, 250.00, 50.00, 150.00, 630.00, 4000.00, 'Sample dispatch entry'
FROM v_sample_order o
WHERE NOT EXISTS (SELECT 1 FROM dispatch_invoices di WHERE di.order_id = o.id);

-- =============================================================================
-- 4) SALES INVOICE (CSB-V) + link the order to it.
-- =============================================================================
INSERT INTO sales_invoices (
  company_id, store_id, invoice_no, master_invoice_no, invoice_date, shipment_term, csb_type,
  courier_company, destination_country, origin_declaration, buyer_name_address, remark, created_by_employee_id
)
SELECT
  c.id, st.store_id, 'SAMPLE-NL-0001', 'SAMPLE-NYM-0001', DATE '2026-09-02', 'DDU', 'CSB-V',
  'FedEx', 'US', 'Brand-new hand block printed rugs', 'John Sample, 12 Demo Street, Sampletown',
  'Sample sales invoice',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN v_sample_store st ON st.company_id = c.id
WHERE NOT EXISTS (SELECT 1 FROM sales_invoices WHERE invoice_no = 'SAMPLE-NL-0001');

UPDATE orders o
SET invoice_id = (SELECT id FROM sales_invoices WHERE invoice_no = 'SAMPLE-NL-0001')
FROM v_sample_order so
WHERE o.id = so.id AND o.invoice_id IS NULL
  AND EXISTS (SELECT 1 FROM sales_invoices WHERE invoice_no = 'SAMPLE-NL-0001');

-- =============================================================================
-- 5) FREIGHT BILL + AWB ASSIGNMENT (courier's invoice; one AWB billed under it).
-- =============================================================================
INSERT INTO freight_bills (invoice_date, invoice_no, bill_weight_kg, freight_amt, fuel_amt, other_charges, credit_note_amt)
SELECT DATE '2026-09-05', 'SAMPLE-FB-001', 10.000, 3000.00, 150.00, 100.00, 0
WHERE NOT EXISTS (SELECT 1 FROM freight_bills WHERE invoice_no = 'SAMPLE-FB-001');

INSERT INTO freight_bill_awb_assignments (
  freight_bill_id, order_id, order_shipment_id, bill_weight_kg, difference_amt, remark
)
SELECT fb.id, o.id, os.id, 10.000, 0, 'Sample AWB assignment'
FROM freight_bills fb
JOIN v_sample_order o    ON true
JOIN order_shipments os  ON os.order_id = o.id AND os.shipment_no = 1
WHERE fb.invoice_no = 'SAMPLE-FB-001'
  AND NOT EXISTS (
    SELECT 1 FROM freight_bill_awb_assignments fa
    WHERE fa.freight_bill_id = fb.id AND fa.order_id = o.id
  );

-- =============================================================================
-- 6) DUTY & TAX BILL — customs/duty invoice for the same shipment.
-- =============================================================================
INSERT INTO duty_tax_bills (invoice_date, invoice_no, duty_tax_amt_usd, duty_tax_amt_inr, gst_18pct_amt,
  credit_note_amt, disbursement_fee, courier_duty_charges_adj, total_payable_amt)
SELECT DATE '2026-09-06', 'SAMPLE-DT-001', 0, 1500.00, 270.00, 0, 50.00, 0, 1820.00
WHERE NOT EXISTS (SELECT 1 FROM duty_tax_bills WHERE invoice_no = 'SAMPLE-DT-001');

-- =============================================================================
-- 7) PURCHASE BILL — raw material bought for the sample order.
--    (2 qty × 35 sq ft × ₹400 = ₹28,000; +5% GST = ₹29,400 — auto-generated.)
-- =============================================================================
INSERT INTO purchase_bills (vendor_party_id, vendor_invoice_no, vendor_invoice_date, qty, sq_feet, qty_unit,
  work_description, unit_rate, order_id, company_id, gst_rate_pct, gst_type, round_off_amt)
SELECT p.id, 'SAMPLE-PB-001', DATE '2026-08-28', 2, 35.0, 'FT', 'Sample fabric purchase', 400.00,
  o.id, o.company_id, 2.5, 'CGST_SGST', 0
FROM v_sample_party p
JOIN v_sample_order o ON true
WHERE NOT EXISTS (
  SELECT 1 FROM purchase_bills pb
  WHERE pb.vendor_party_id = p.id AND pb.vendor_invoice_no = 'SAMPLE-PB-001' AND pb.order_id = o.id
);

-- =============================================================================
-- 8) WASHING ENTRY — chalan no. (NM/CH/26-27/xxxx) auto-assigned by trigger.
-- =============================================================================
INSERT INTO washing_entries (company_id, party_id, chalan_date, order_id, sku_id, item_size, pcs, sq_mtr_ft, rate, store_id)
SELECT c.id, p.id, DATE '2026-09-03', o.id, sk.id, '5X7 ft', 2, 35.0, 25.00, st.store_id
FROM v_sample_company c
JOIN v_sample_party p ON true
JOIN v_sample_order o ON o.company_id = c.id
JOIN v_sample_sku sk  ON true
JOIN v_sample_store st ON st.company_id = c.id
WHERE NOT EXISTS (
  SELECT 1 FROM washing_entries we
  WHERE we.company_id = c.id AND we.party_id = p.id AND we.order_id = o.id
    AND we.chalan_date = DATE '2026-09-03'
);

-- =============================================================================
-- 9) CREDIT NOTE — buyer-side partial refund against the sample order
--    (CN no. NM/CN/26-27/xxxx auto-assigned by trigger).
-- =============================================================================
INSERT INTO credit_notes (company_id, store_id, credit_note_date, order_id, buyer_name,
  refund_amount, refund_type, remark, created_by_employee_id)
SELECT o.company_id, (SELECT store_id FROM v_sample_store), DATE '2026-09-09', o.id, 'John Sample',
  100.00, 'PARTIAL REFUND', 'Sample credit note',
  (SELECT e.id FROM employees e WHERE e.company_id = o.company_id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_order o
WHERE NOT EXISTS (SELECT 1 FROM credit_notes cn WHERE cn.order_id = o.id AND cn.remark = 'Sample credit note');

-- =============================================================================
-- 10) DEBIT NOTE — vendor rate-difference (vendor billed ₹410/ft vs PO ₹400/ft)
--     (DN no. NM/DN/26-27/xxxx auto-assigned by trigger).
-- =============================================================================
INSERT INTO debit_notes (company_id, debit_note_date, against_invoice_bill_no, party_id, order_id,
  particulars, bill_no, bill_date, sq_ft, qty, rate, po_rate, billed_rate, debit_amount, remark)
SELECT o.company_id, DATE '2026-09-09', 'SAMPLE-PB-001', p.id, o.id,
  'Rate difference — billed 410 vs PO 400', 'SAMPLE-PB-001', DATE '2026-08-28',
  35.0, 2, 400.00, 400.00, 410.00, 350.00, 'Sample debit note'
FROM v_sample_party p
JOIN v_sample_order o ON true
WHERE NOT EXISTS (SELECT 1 FROM debit_notes dn WHERE dn.party_id = p.id AND dn.remark = 'Sample debit note');

-- =============================================================================
-- 11) INTERNAL INVOICE — Nyko Mart billing Rugara for an inter-company move
--     (II no. NM/II/26-27/xxxx auto-assigned by trigger).
-- =============================================================================
INSERT INTO internal_invoices (from_company_id, to_company_id, invoice_date, description, qty, rate, remark)
SELECT c.id, (SELECT id FROM companies WHERE name = 'Rugara'), DATE '2026-09-10',
  'Sample inter-company transfer', 1, 5000.00, 'Sample internal invoice'
FROM v_sample_company c
WHERE (SELECT id FROM companies WHERE name = 'Rugara') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM internal_invoices ii
    WHERE ii.from_company_id = c.id AND ii.remark = 'Sample internal invoice'
  );

-- =============================================================================
-- 12) JOURNAL VOUCHER — manual, unlinked JV (JV no. auto by trigger).
-- =============================================================================
INSERT INTO journal_vouchers (company_id, jv_date, party_id, vendor_invoice_no, invoice_date,
  debit_amount, item_details, qty, qty_unit, particulars, remark, created_by_employee_id)
SELECT c.id, DATE '2026-09-10', p.id, 'SAMPLE-PB-001', DATE '2026-08-28',
  29400.00, 'Sample fabric', 2, 'FT', 'Sample JV — fabric purchase', 'Sample JV entry',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN v_sample_party p ON true
WHERE NOT EXISTS (SELECT 1 FROM journal_vouchers jv WHERE jv.company_id = c.id AND jv.remark = 'Sample JV entry');

-- =============================================================================
-- 13) BILL PASS REGISTER — the payable-ledger mirror of the purchase bill
--     (exactly what the app auto-inserts when a Purchase Bill is saved:
--     source='purchase_bill', source_id=purchase_bills.id).
-- =============================================================================
INSERT INTO bill_pass_register (company_id, invoice_no, vendor_invoice_no, invoice_type, invoice_date,
  invoice_recv_date, total_amt, party_id, source, source_id, prepared_by_employee_id, remark)
SELECT o.company_id, 'SAMPLE-PB-001', 'SAMPLE-PB-001', 'Purchase', DATE '2026-08-28',
  DATE '2026-09-05', pb.g_total_plus_gst, p.id, 'purchase_bill', pb.id, NULL, 'Sample bill pass entry'
FROM v_sample_order o
JOIN purchase_bills pb ON pb.order_id = o.id AND pb.vendor_invoice_no = 'SAMPLE-PB-001'
JOIN v_sample_party p  ON p.id = pb.vendor_party_id
WHERE NOT EXISTS (
  SELECT 1 FROM bill_pass_register bpr
  WHERE bpr.source = 'purchase_bill' AND bpr.source_id = pb.id
);

-- =============================================================================
-- 14) BILL PAYMENT — ₹10,000 paid against that bill (the payment ledger the
--     Bill Payment screen writes; payment ref is what the bank statement
--     line below will auto-match on).
-- =============================================================================
INSERT INTO bill_pass_register_payments (bill_pass_register_id, amount, payment_date, payment_mode, reference_no, remark, entered_by)
SELECT bpr.id, 10000.00, DATE '2026-09-15', 'NEFT', 'PUNB123456789012', 'Sample bill payment',
       (SELECT e.id FROM employees e WHERE e.company_id = bpr.company_id AND e.active ORDER BY e.created_at LIMIT 1)
FROM bill_pass_register bpr
WHERE bpr.source = 'purchase_bill'
  AND bpr.invoice_no = 'SAMPLE-PB-001'
  AND bpr.company_id = (SELECT id FROM v_sample_company)
  AND NOT EXISTS (
    SELECT 1 FROM bill_pass_register_payments brpp
    WHERE brpp.bill_pass_register_id = bpr.id AND brpp.remark = 'Sample bill payment'
  );

-- =============================================================================
-- 15) OFFICE EXPENSE — electricity bill, feeds the P&L Dashboard overhead line.
-- =============================================================================
INSERT INTO internal_expenses (company_id, expense_date, category, amount_inr, payment_mode, remark, created_by_employee_id)
SELECT c.id, DATE '2026-09-12', 'Electricity', 3500.00, 'Cash', 'Sample office expense',
       (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
WHERE NOT EXISTS (
  SELECT 1 FROM internal_expenses ie
  WHERE ie.company_id = c.id AND ie.remark = 'Sample office expense'
);

-- =============================================================================
-- 16) BANK ACCOUNT + CREDIT CARD — the new multi-account feature.
--     (Two NEW accounts, deliberately not the company's real PNB row.)
-- =============================================================================
INSERT INTO bank_accounts (company_id, account_name, account_type, bank_name, account_no, ifsc_code, opening_balance)
SELECT c.id, 'Sample PNB Current Account', 'Bank', 'PNB Bank', 'SAMPLE0099', 'PUNB0SAMPLE9', 500000.00
FROM v_sample_company c
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts ba WHERE ba.company_id = c.id AND ba.account_name = 'Sample PNB Current Account'
);

INSERT INTO bank_accounts (company_id, account_name, account_type, bank_name, card_last4, card_holder_name,
  credit_limit, card_due_date)
SELECT c.id, 'Sample HDFC Credit Card', 'Credit Card', 'HDFC Bank', '4242', 'Sample Holder', 200000.00, DATE '2026-10-05'
FROM v_sample_company c
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts ba WHERE ba.company_id = c.id AND ba.account_name = 'Sample HDFC Credit Card'
);

-- =============================================================================
-- 17) BANK STATEMENT — 3 lines, one per outcome:
--     a) ₹10,000 credit, UTR PUNB123456789012 → EXACT match to the sample
--        bill payment (UTR reference digit-match).
--     b) ₹16,590 credit, "ETSY PAYOUT" → LIKELY match to the Etsy ledger's
--        ₹16,590 sale line dated 2026-09-05 (amount + ±5 days + 'etsy').
--     c) ₹999 cash withdrawal → nothing matches on purpose — ye "missed
--        entry" list me dikhega (Unmatched), jaisa user ne kaha tha.
--     Fingerprint = date|dr|cr|description (dedupe key — re-upload safe).
-- =============================================================================
INSERT INTO bank_statement_lines (company_id, account_id, txn_no, txn_date, description, cheque_no,
  dr_amount, cr_amount, balance, line_fingerprint, uploaded_by_employee_id)
SELECT c.id, ba.id, 'TXN-SAMPLE-1', DATE '2026-09-15', 'NEFT CR PUNB123456789012 SAMPLE VENDOR', 'PUNB123456789012',
  NULL, 10000.00, 510000.00, '2026-09-15|0|10000|neft cr punb123456789012 sample vendor',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN bank_accounts ba ON ba.company_id = c.id AND ba.account_name = 'Sample PNB Current Account'
WHERE NOT EXISTS (
  SELECT 1 FROM bank_statement_lines bsl
  WHERE bsl.company_id = c.id AND bsl.account_id = ba.id
    AND bsl.line_fingerprint = '2026-09-15|0|10000|neft cr punb-sample-0001 sample vendor'
);

INSERT INTO bank_statement_lines (company_id, account_id, txn_no, txn_date, description,
  dr_amount, cr_amount, balance, line_fingerprint, uploaded_by_employee_id)
SELECT c.id, ba.id, 'TXN-SAMPLE-2', DATE '2026-09-10', 'ETSY PAYOUT SETTLEMENT',
  NULL, 16590.00, 493410.00, '2026-09-10|0|16590|etsy payout settlement',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN bank_accounts ba ON ba.company_id = c.id AND ba.account_name = 'Sample PNB Current Account'
WHERE NOT EXISTS (
  SELECT 1 FROM bank_statement_lines bsl
  WHERE bsl.company_id = c.id AND bsl.account_id = ba.id
    AND bsl.line_fingerprint = '2026-09-10|0|16590|etsy payout settlement'
);

INSERT INTO bank_statement_lines (company_id, account_id, txn_no, txn_date, description,
  dr_amount, cr_amount, balance, line_fingerprint, uploaded_by_employee_id)
SELECT c.id, ba.id, 'TXN-SAMPLE-3', DATE '2026-09-12', 'ATM CASH WITHDRAWAL JAIPUR',
  999.00, NULL, 492411.00, '2026-09-12|999|0|atm cash withdrawal jaipur',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN bank_accounts ba ON ba.company_id = c.id AND ba.account_name = 'Sample PNB Current Account'
WHERE NOT EXISTS (
  SELECT 1 FROM bank_statement_lines bsl
  WHERE bsl.company_id = c.id AND bsl.account_id = ba.id
    AND bsl.line_fingerprint = '2026-09-12|999|0|atm cash withdrawal jaipur'
);

-- Etsy ledger sale line the bank line (b) above should match against.
INSERT INTO etsy_ledger_lines (company_id, txn_date, type, title, currency, amount, fees_and_taxes, net, tax_details)
SELECT c.id, DATE '2026-09-05', 'Sale', 'Payment for Order #SAMPLE-MP-001', 'INR', 16590.00, NULL, 16590.00, NULL
FROM v_sample_company c
WHERE NOT EXISTS (
  SELECT 1 FROM etsy_ledger_lines e
  WHERE e.company_id = c.id AND e.title = 'Payment for Order #SAMPLE-MP-001'
);

-- =============================================================================
-- 18) RUN THE AUTO-MATCHER on the sample bank account.
--     Line 1 → Exact (UTR), Line 2 → Likely (Etsy), Line 3 → stays Unmatched.
--     Result rows are the proposals; verification happens in the UI
--     (Bank Reconciliation → ✓ Verify) — verify karte hi link lock ho jata hai.
-- =============================================================================
SELECT * FROM match_bank_statement_lines(
  (SELECT id FROM v_sample_company),
  (SELECT ba.id FROM bank_accounts ba WHERE ba.company_id = (SELECT id FROM v_sample_company)
     AND ba.account_name = 'Sample PNB Current Account')
);

-- =============================================================================
-- 19) CREDIT-CARD STATEMENT — 3 lines on the sample card:
--     spends: ₹12,000 AWS (no match → missed list), ₹8,500 vendor payment
--     with ref PUNB123456789013 (Exact match to the card payment below),
--     credit: ₹20,500 "bill payment received" (kitna payment pada hai card me).
-- =============================================================================
INSERT INTO bill_pass_register_payments (bill_pass_register_id, amount, payment_date, payment_mode, reference_no, remark, entered_by)
SELECT bpr.id, 8500.00, DATE '2026-09-14', 'Credit Card', 'PUNB123456789013', 'Sample card payment',
       (SELECT e.id FROM employees e WHERE e.company_id = bpr.company_id AND e.active ORDER BY e.created_at LIMIT 1)
FROM bill_pass_register bpr
WHERE bpr.source = 'purchase_bill'
  AND bpr.invoice_no = 'SAMPLE-PB-001'
  AND bpr.company_id = (SELECT id FROM v_sample_company)
  AND NOT EXISTS (
    SELECT 1 FROM bill_pass_register_payments brpp
    WHERE brpp.bill_pass_register_id = bpr.id AND brpp.remark = 'Sample card payment'
  );

INSERT INTO credit_card_statement_lines (account_id, company_id, statement_month, txn_date, description,
  reference_no, card_last4, amount, txn_direction, txn_category, line_fingerprint, uploaded_by_employee_id)
SELECT ba.id, c.id, DATE '2026-09-01', DATE '2026-09-08', 'AMAZON WEB SERVICES INR 12000',
  NULL, '4242', 12000.00, 'Debit', 'POS', '2026-09-08|debit|12000|aws',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN bank_accounts ba ON ba.company_id = c.id AND ba.account_name = 'Sample HDFC Credit Card'
WHERE NOT EXISTS (
  SELECT 1 FROM credit_card_statement_lines csl
  WHERE csl.account_id = ba.id AND csl.line_fingerprint = '2026-09-08|debit|12000|aws'
);

INSERT INTO credit_card_statement_lines (account_id, company_id, statement_month, txn_date, description,
  reference_no, card_last4, amount, txn_direction, txn_category, line_fingerprint, uploaded_by_employee_id)
SELECT ba.id, c.id, DATE '2026-09-01', DATE '2026-09-14', 'NEFT DR VENDOR PAYMENT', 'PUNB123456789013',
  '4242', 8500.00, 'Debit', 'NEFT', '2026-09-14|debit|8500|vendor payment',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN bank_accounts ba ON ba.company_id = c.id AND ba.account_name = 'Sample HDFC Credit Card'
WHERE NOT EXISTS (
  SELECT 1 FROM credit_card_statement_lines csl
  WHERE csl.account_id = ba.id AND csl.line_fingerprint = '2026-09-14|debit|8500|vendor payment'
);

INSERT INTO credit_card_statement_lines (account_id, company_id, statement_month, txn_date, description,
  reference_no, card_last4, amount, txn_direction, txn_category, line_fingerprint, uploaded_by_employee_id)
SELECT ba.id, c.id, DATE '2026-09-01', DATE '2026-09-15', 'BILL PAYMENT RECEIVED - THANK YOU',
  NULL, '4242', 20500.00, 'Credit', 'Payment', '2026-09-15|credit|20500|bill payment received',
  (SELECT e.id FROM employees e WHERE e.company_id = c.id AND e.active ORDER BY e.created_at LIMIT 1)
FROM v_sample_company c
JOIN bank_accounts ba ON ba.company_id = c.id AND ba.account_name = 'Sample HDFC Credit Card'
WHERE NOT EXISTS (
  SELECT 1 FROM credit_card_statement_lines csl
  WHERE csl.account_id = ba.id AND csl.line_fingerprint = '2026-09-15|credit|20500|bill payment received'
);

-- Run the card auto-matcher (the ₹8,500 line → Exact via reference digits).
SELECT * FROM match_card_statement_lines(
  (SELECT id FROM v_sample_company),
  (SELECT ba.id FROM bank_accounts ba WHERE ba.company_id = (SELECT id FROM v_sample_company)
     AND ba.account_name = 'Sample HDFC Credit Card')
);

-- =============================================================================
-- 20) SANITY CHECK — what you should see after running (counts).
-- =============================================================================
SELECT
  (SELECT count(*) FROM orders WHERE ref_no = 'SAMPLE-001')                        AS orders,
  (SELECT count(*) FROM dispatch_invoices WHERE invoice_no = 'SAMPLE-INV-001')     AS dispatch,
  (SELECT count(*) FROM sales_invoices WHERE invoice_no = 'SAMPLE-NL-0001')        AS sales_invoice,
  (SELECT count(*) FROM freight_bills WHERE invoice_no = 'SAMPLE-FB-001')          AS freight_bills,
  (SELECT count(*) FROM duty_tax_bills WHERE invoice_no = 'SAMPLE-DT-001')         AS duty_bills,
  (SELECT count(*) FROM purchase_bills WHERE vendor_invoice_no = 'SAMPLE-PB-001')  AS purchase_bills,
  (SELECT count(*) FROM washing_entries WHERE order_id = (SELECT id FROM v_sample_order))  AS washing,
  (SELECT count(*) FROM credit_notes WHERE remark = 'Sample credit note')          AS credit_notes,
  (SELECT count(*) FROM debit_notes WHERE remark = 'Sample debit note')            AS debit_notes,
  (SELECT count(*) FROM internal_invoices WHERE remark = 'Sample internal invoice') AS internal_invoices,
  (SELECT count(*) FROM journal_vouchers WHERE remark = 'Sample JV entry')         AS journal_vouchers,
  (SELECT count(*) FROM bill_pass_register WHERE invoice_no = 'SAMPLE-PB-001')     AS bill_pass,
  (SELECT count(*) FROM bank_accounts WHERE company_id = (SELECT id FROM v_sample_company)) AS bank_accounts,
  (SELECT count(*) FROM bank_statement_lines WHERE company_id = (SELECT id FROM v_sample_company) AND account_id IS NOT NULL) AS bank_lines,
  (SELECT count(*) FROM credit_card_statement_lines WHERE company_id = (SELECT id FROM v_sample_company)) AS card_lines,
  (SELECT count(*) FROM bank_statement_lines WHERE company_id = (SELECT id FROM v_sample_company) AND match_status = 'Proposed') AS bank_proposed,
  (SELECT count(*) FROM credit_card_statement_lines WHERE company_id = (SELECT id FROM v_sample_company) AND match_status = 'Proposed') AS card_proposed;
