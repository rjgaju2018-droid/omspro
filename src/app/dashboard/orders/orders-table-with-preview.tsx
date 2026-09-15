"use client";

// 2026-09-15 — thin client wrapper around OrderListTable that owns the
// invoice-preview dialog state. The orders page itself stays a Server
// Component; it just renders this wrapper and passes the invoice-link map
// through. Clicking an invoice number opens the dialog IN PAGE (never a
// new window/tab).
import { useState } from "react";
import { OrderListTable } from "./order-list-table";
import { InvoicePreviewDialog, useInvoicePreview } from "./invoice-preview-dialog";

type OrderListTableProps = Parameters<typeof OrderListTable>[0];

export function OrdersTableWithPreview(props: Omit<OrderListTableProps, "onPreviewInvoice">) {
  const preview = useInvoicePreview();
  // The dialog keeps its own copy of the last opened invoice id so re-renders
  // of the table don't reset an open preview.
  const [activeId, setActiveId] = useState<string | null>(null);

  function openPreview(invoiceId: string) {
    setActiveId(invoiceId);
    void preview.open(invoiceId);
  }

  return (
    <>
      <OrderListTable {...props} onPreviewInvoice={openPreview} />
      <InvoicePreviewDialog data={preview.data} loading={preview.loading} error={preview.error} onClose={() => { preview.close(); setActiveId(null); }} />
      {/* keep activeId referenced for future inline-refresh niceties */}
      <span hidden data-active-invoice={activeId ?? ""} />
    </>
  );
}
