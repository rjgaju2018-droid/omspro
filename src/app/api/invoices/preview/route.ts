import { NextResponse } from "next/server";
import { getAuthedEmployee, UnauthorizedError } from "@/lib/auth/require-capability";
import { createServiceRoleClient } from "@/lib/supabase/server";

// 2026-09-15 — compact invoice JSON for the Orders page' invoice-preview
// dialog ("agar order ke samne invoice no show hota hai to link hona chahiye
// invoice dikh jaye jiske pass acces hai lekin diloge box me alag window me
// nahi"). Same access rule as the invoice page itself: caller must be
// signed in AND the invoice's company must be one of theirs.
//
//   GET /api/invoices/preview?id=<sales_invoices.id>
export async function GET(request: Request) {
  let employee;
  try {
    employee = await getAuthedEmployee();
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    throw e;
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const service = createServiceRoleClient();
  const { data: invoice } = await service
    .from("sales_invoices")
    .select(
      "id, invoice_no, master_invoice_no, invoice_date, shipment_term, csb_type, courier_company, destination_country, invoice_value_usd, invoice_value_inr, weight_kg, company_id, store_id, ioss_number"
    )
    .eq("id", id)
    .maybeSingle();
  if (!invoice || !employee.companyIds.includes(invoice.company_id)) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const [{ data: orders }, { data: company }, { data: store }] = await Promise.all([
    service
      .from("orders")
      .select("id, ref_no, marketplace_order_no, sku_label, size_label, qty, order_value_usd, order_currency")
      .eq("invoice_id", id),
    service.from("companies").select("name, logo_url").eq("id", invoice.company_id).single(),
    service.from("stores").select("name").eq("id", invoice.store_id).single(),
  ]);

  return NextResponse.json({
    invoice,
    company: company ?? null,
    storeName: store?.name ?? "",
    orders: orders ?? [],
  });
}
