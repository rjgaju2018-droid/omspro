// 2026-09-08 (follow-up) — composes a full printable "Name + Address" block
// from an order's fields, for every place that needs the FULL mailing
// address as text (packing-slip print sheet, CSB-V export invoice
// buyer_name_address auto-pull).
//
// WHY THIS EXISTS: the original `orders.buyer_name_address` column used to
// be the ONLY address data on an order — a free-text box where an employee
// pasted the buyer's full name + complete address together as one blob.
// Once structured fields (buyer_address1/2/3, buyer_city, buyer_state,
// buyer_postal_code, destination_country) were added, keeping that same box
// labeled "Buyer Name & Address" became actively confusing — two places to
// enter the same address, with no clear source of truth. Per explicit user
// feedback, the box is now just "Buyer Name" in both order forms
// (order-form.tsx / order-edit-form.tsx) — a single line, name only, for
// any order entered from this point on.
//
// That means anything that used to treat buyer_name_address as "the full
// address to print" must now build that full text from the name field PLUS
// the structured fields instead — which is exactly what this function does.
// It has to handle BOTH shapes, because existing orders entered before this
// change still have the old full blob sitting in buyer_name_address with no
// structured fields filled in at all:
//
//   - Structured fields present (buyer_address1 or city/state/postcode) →
//     order was entered after this round → buyer_name_address is just the
//     name → compose Name + Address1/2/3 + City/State/Postcode + Country as
//     separate lines.
//   - Structured fields ALL empty → legacy order (or structured section
//     simply wasn't filled in for this one) → buyer_name_address still
//     holds everything (name AND address together) exactly as it always
//     did → return it completely unchanged. This is what keeps every
//     historical order's packing slip and every already-generated invoice
//     looking exactly as before — nothing retroactively breaks.
export type BuyerAddressSource = {
  buyer_name_address: string | null;
  buyer_address1?: string | null;
  buyer_address2?: string | null;
  buyer_address3?: string | null;
  buyer_city?: string | null;
  buyer_state?: string | null;
  buyer_postal_code?: string | null;
  destination_country?: string | null;
};

export function composeBuyerNameAndAddress(order: BuyerAddressSource): string {
  const hasStructuredAddress = !!(
    order.buyer_address1?.trim() ||
    order.buyer_address2?.trim() ||
    order.buyer_address3?.trim() ||
    order.buyer_city?.trim() ||
    order.buyer_state?.trim() ||
    order.buyer_postal_code?.trim()
  );

  if (!hasStructuredAddress) {
    // Legacy shape — buyer_name_address is the whole thing, untouched.
    return order.buyer_name_address ?? "";
  }

  const cityStatePostcode = [order.buyer_city, order.buyer_state, order.buyer_postal_code]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(", ");

  const lines = [
    order.buyer_name_address, // just the name, in the post-2026-09-08 shape
    order.buyer_address1,
    order.buyer_address2,
    order.buyer_address3,
    cityStatePostcode || null,
    order.destination_country,
  ]
    .map((v) => v?.trim())
    .filter((v): v is string => !!v);

  return lines.join("\n");
}
