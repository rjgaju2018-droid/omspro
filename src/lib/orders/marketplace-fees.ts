import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// 2026-09-09 — extracted from src/app/dashboard/orders/page.tsx (built
// 2026-08-13, "store par jab order aaya to kon kon si fee lagi vo uske
// store ke statement se milani padegi") so the exact same matching logic
// can be reused by the new Store Expense Report
// (src/app/dashboard/reports/store-expenses/page.tsx) instead of being
// re-derived a second time and risking drift between the two. Orders hub's
// own page.tsx now calls this too — nothing about the matching semantics
// changed in this extraction, only where the code lives.
//
// marketplace_order_no is sometimes typed with a leading "#" and sometimes
// without; none of the 3 ledger-side columns ever contain one.
export function normalizeOrderNo(v: string | null | undefined): string | null {
  const t = v?.trim().replace(/^#/, "").trim();
  return t || null;
}

export type EtsyFeeLine = {
  date: string | null;
  type: string | null;
  title: string | null;
  info: string | null;
  amount: number;
  fees: number;
  net: number;
  currency: string | null;
};
export type EtsyFeeMatch = { lines: EtsyFeeLine[]; totalFeesInr: number };

export type EbayFeeLine = {
  date: string | null;
  type: string | null;
  description: string | null;
  memo: string | null;
  amount: number;
  currency: string | null;
};
export type EbayFeeMatch = { lines: EbayFeeLine[]; totalFeesUsd: number };

export type AmazonFeeLine = {
  date: string | null;
  type: string | null;
  productDetails: string | null;
  amazonFees: number;
  totalAmount: number;
  currency: string;
};
export type AmazonFeeMatch = {
  lines: AmazonFeeLine[];
  totalsByCurrency: { currency: string; totalFees: number }[];
};

export type MarketplaceFeeMatches = {
  etsyFeesByOrder: Record<string, EtsyFeeMatch>;
  ebayFeesByOrder: Record<string, EbayFeeMatch>;
  amazonFeesByOrder: Record<string, AmazonFeeMatch>;
};

type OrderForMatching = { id: string; company_id: string; marketplace_order_no: string | null };

/**
 * For every order given, finds any matching Etsy/eBay/Amazon fee lines
 * (matched by company_id + normalized marketplace order number against
 * etsy_ledger_lines.order_number / ebay_tax_invoice_lines.order_number /
 * amazon_transactions.order_id) and returns them grouped by order id.
 * Orders with no marketplace_order_no, or no matching ledger rows, are
 * simply absent from the relevant map — never a forced/empty entry, so
 * callers can test `matches.etsyFeesByOrder[order.id]` truthily.
 *
 * `companyIds` scopes the ledger queries (never wider than what the caller
 * is allowed to see) — pass the same company scoping already applied to
 * `orders` itself.
 */
export async function matchMarketplaceFees(
  supabase: SupabaseClient<Database>,
  orders: OrderForMatching[],
  companyIds: string[]
): Promise<MarketplaceFeeMatches> {
  const marketplaceOrderNos = Array.from(
    new Set(orders.map((o) => normalizeOrderNo(o.marketplace_order_no)).filter((x): x is string => !!x))
  );

  const [{ data: etsyLines }, { data: ebayTaxLines }, { data: amazonLines }] = await Promise.all([
    marketplaceOrderNos.length
      ? supabase
          .from("etsy_ledger_lines")
          .select("company_id, order_number, txn_date, type, title, info, amount, fees_and_taxes, net, currency")
          .in("company_id", companyIds)
          .in("order_number", marketplaceOrderNos)
      : { data: [] },
    marketplaceOrderNos.length
      ? supabase
          .from("ebay_tax_invoice_lines")
          .select("company_id, order_number, txn_date, description, memo, fee_type, currency, net_amount, igst_amount, total_amount")
          .in("company_id", companyIds)
          .in("order_number", marketplaceOrderNos)
      : { data: [] },
    marketplaceOrderNos.length
      ? supabase
          .from("amazon_transactions")
          .select("company_id, order_id, txn_date, transaction_type, product_details, amazon_fees, total_amount, currency")
          .in("company_id", companyIds)
          .in("order_id", marketplaceOrderNos)
      : { data: [] },
  ]);

  const etsyFeesByOrder: Record<string, EtsyFeeMatch> = {};
  for (const o of orders) {
    const orderNo = normalizeOrderNo(o.marketplace_order_no);
    if (!orderNo) continue;
    const matches = (etsyLines ?? []).filter((l) => l.company_id === o.company_id && l.order_number === orderNo);
    if (matches.length === 0) continue;
    etsyFeesByOrder[o.id] = {
      lines: matches
        .map((l) => ({
          date: l.txn_date,
          type: l.type,
          title: l.title,
          info: l.info,
          amount: Number(l.amount ?? 0),
          fees: Number(l.fees_and_taxes ?? 0),
          net: Number(l.net ?? 0),
          currency: l.currency,
        }))
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
      // Fees & Taxes is negative for charges, positive for TCS credits —
      // summing it directly (not abs()) gives the real net fee impact.
      totalFeesInr: matches.reduce((sum, l) => sum + Number(l.fees_and_taxes ?? 0), 0),
    };
  }

  const ebayFeesByOrder: Record<string, EbayFeeMatch> = {};
  for (const o of orders) {
    const orderNo = normalizeOrderNo(o.marketplace_order_no);
    if (!orderNo) continue;
    const matches = (ebayTaxLines ?? []).filter((l) => l.company_id === o.company_id && l.order_number === orderNo);
    if (matches.length === 0) continue;
    ebayFeesByOrder[o.id] = {
      lines: matches
        .map((l) => ({
          date: l.txn_date,
          type: l.fee_type,
          description: l.description,
          memo: l.memo,
          amount: -Number(l.total_amount ?? 0),
          currency: l.currency,
        }))
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
      totalFeesUsd: matches.reduce((sum, l) => sum - Number(l.total_amount ?? 0), 0),
    };
  }

  const amazonFeesByOrder: Record<string, AmazonFeeMatch> = {};
  for (const o of orders) {
    const orderNo = normalizeOrderNo(o.marketplace_order_no);
    if (!orderNo) continue;
    const matches = (amazonLines ?? []).filter((l) => l.company_id === o.company_id && l.order_id === orderNo);
    if (matches.length === 0) continue;
    const byCurrency = new Map<string, number>();
    for (const l of matches) {
      const cur = l.currency ?? "?";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + Number(l.amazon_fees ?? 0));
    }
    amazonFeesByOrder[o.id] = {
      lines: matches
        .map((l) => ({
          date: l.txn_date,
          type: l.transaction_type,
          productDetails: l.product_details,
          amazonFees: Number(l.amazon_fees ?? 0),
          totalAmount: Number(l.total_amount ?? 0),
          currency: l.currency ?? "?",
        }))
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
      totalsByCurrency: Array.from(byCurrency.entries()).map(([currency, totalFees]) => ({ currency, totalFees })),
    };
  }

  return { etsyFeesByOrder, ebayFeesByOrder, amazonFeesByOrder };
}
