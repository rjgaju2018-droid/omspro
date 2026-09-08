// Client-side postal-code auto-fill (2026-09-08) — see
// db/2026-09-08-order-address-fields-and-vendor-assignments.sql for the
// structured buyer_address1/2/3/city/state/postal_code columns this feeds.
//
// Goal: when an employee types a postal/zip code into the new structured
// address section (order-form.tsx / order-edit-form.tsx), try to save them
// re-typing City and State by hand — but never block or error if it can't.
// Two free, no-auth, CORS-enabled public services cover this, called
// straight from the browser (no API key, no server round-trip needed):
//
//   - India Post's PIN-code API (https://api.postalpincode.in) — used for
//     any 6-digit PIN when the Destination Country field is blank or reads
//     as some form of "India" (the overwhelming common case for this
//     business's domestic orders, where the country field is often just
//     left empty at first).
//   - Zippopotam.us (https://api.zippopotam.us) — used for the small set of
//     countries this business commonly ships to internationally (US, UK,
//     Canada, Australia, and the major EU/Gulf/APAC destinations — see
//     COUNTRY_CODE_ALIASES below), resolved from whatever free text was
//     typed into Destination Country via a simple alias match.
//
// Both lookups are wrapped in try/catch and resolve to `null` on ANY
// failure (network error, unexpected shape, unknown country, no match) —
// autofill is purely additive. City/State always stay ordinary editable
// text inputs (never readOnly/disabled) so the employee can always
// overwrite whatever came back — "phir bhi kuch change karna ho to usi
// time kar sake". Callers (see the onBlur handlers in the order forms)
// additionally only apply the result when City/State are still empty, so
// this never silently clobbers something already typed.

export type PostalLookupResult = { city: string; state: string; country?: string };

const INDIA_PIN_RE = /^\d{6}$/;

// Small alias dictionary -> ISO-3166 alpha-2, matched case-insensitively as
// a substring against whatever free text is in Destination Country. Not
// meant to be exhaustive — just the countries this business's own courier
// setup (FedEx/UPS/Aramex/DHL/Delhivery/Shiprocket/Shipglobal) commonly
// ships to, per the migration note. Longest alias first so e.g. "united
// arab emirates" is tried before a shorter, coincidentally-contained one.
const COUNTRY_CODE_ALIASES: { alias: string; code: string }[] = [
  { alias: "united states of america", code: "US" },
  { alias: "united states", code: "US" },
  { alias: "usa", code: "US" },
  { alias: "u.s.a.", code: "US" },
  { alias: "united kingdom", code: "GB" },
  { alias: "great britain", code: "GB" },
  { alias: "britain", code: "GB" },
  { alias: "uk", code: "GB" },
  { alias: "canada", code: "CA" },
  { alias: "australia", code: "AU" },
  { alias: "germany", code: "DE" },
  { alias: "france", code: "FR" },
  { alias: "italy", code: "IT" },
  { alias: "spain", code: "ES" },
  { alias: "netherlands", code: "NL" },
  { alias: "united arab emirates", code: "AE" },
  { alias: "uae", code: "AE" },
  { alias: "saudi arabia", code: "SA" },
  { alias: "singapore", code: "SG" },
  { alias: "new zealand", code: "NZ" },
  { alias: "ireland", code: "IE" },
  { alias: "sweden", code: "SE" },
  { alias: "switzerland", code: "CH" },
  { alias: "belgium", code: "BE" },
  { alias: "japan", code: "JP" },
  { alias: "south korea", code: "KR" },
].sort((a, b) => b.alias.length - a.alias.length);

function countryCodeFor(countryFreeText: string): string | null {
  const cleaned = countryFreeText.trim().toLowerCase();
  if (!cleaned) return null;
  for (const { alias, code } of COUNTRY_CODE_ALIASES) {
    if (cleaned.includes(alias)) return code;
  }
  return null;
}

async function lookupIndiaPin(postalCode: string): Promise<PostalLookupResult | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(postalCode)}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { Status?: string; PostOffice?: { District?: string; State?: string }[] };
    if (first?.Status !== "Success" || !Array.isArray(first.PostOffice) || first.PostOffice.length === 0) return null;
    const po = first.PostOffice[0];
    if (!po?.District || !po?.State) return null;
    return { city: po.District, state: po.State, country: "India" };
  } catch {
    return null;
  }
}

async function lookupZippopotam(code: string, postalCode: string): Promise<PostalLookupResult | null> {
  try {
    const res = await fetch(`https://api.zippopotam.us/${code}/${encodeURIComponent(postalCode)}`);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const obj = data as { places?: { "place name"?: string; state?: string }[]; "country abbreviation"?: string };
    if (!Array.isArray(obj?.places) || obj.places.length === 0) return null;
    const place = obj.places[0];
    const city = place?.["place name"];
    const state = place?.state;
    if (!city || !state) return null;
    return { city, state, country: obj["country abbreviation"] };
  } catch {
    return null;
  }
}

/**
 * Best-effort City/State lookup from a postal/zip code, for the "Structured
 * Address" section's onBlur autofill. Always resolves — never throws — and
 * returns null whenever nothing can be confidently resolved (unrecognized
 * country, malformed postcode, the service being unreachable, etc.); the
 * caller then just leaves City/State for manual entry, same as before this
 * existed.
 */
export async function lookupPostalCode(
  postalCode: string,
  countryFreeText: string
): Promise<PostalLookupResult | null> {
  const pin = postalCode.trim();
  if (!pin) return null;

  const country = countryFreeText.trim();
  const isIndia = country === "" || /india/i.test(country);

  if (isIndia && INDIA_PIN_RE.test(pin)) {
    return lookupIndiaPin(pin);
  }

  const code = countryCodeFor(country);
  if (!code) return null;

  return lookupZippopotam(code, pin);
}
