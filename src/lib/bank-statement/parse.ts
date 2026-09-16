// Bank/credit-card statement file parser (2026-09-16) — used by
// src/app/dashboard/bank-reconciliation/actions.ts. Mirrors the generic
// statement importer's proven pattern (see
// src/app/dashboard/csv-upload/actions.ts readBulkFile) but with FUZZY
// header matching, because the user's exact ask was: "statement kesa bhi ho
// auto adjust kare, column vagera sabhi — ese nahi ki ye column to hai hi
// nahi". Banks rename/translate/reorder the same columns constantly
// ("Withdrawal" vs "DR" vs "Debit", "narration" vs "Description",
// DD/MM vs DD-MM vs DD-MMM), so matching is by synonym groups + fuzzy
// scoring, never by one exact header string. Any column that isn't found
// simply stays null — a row still imports with whatever the file DID have
// (a date plus any one amount column is enough; a row with neither a date
// nor a description is skipped as junk).
export type StatementRow = {
  txn_no: string | null;
  txn_date: string | null;
  description: string | null;
  branch_name: string | null;
  cheque_no: string | null;
  dr_amount: number | null;
  cr_amount: number | null;
  balance: number | null;
  statement_month: string | null;
  fingerprint: string;
};

export type ParsedStatement =
  | { rows: StatementRow[]; error: null }
  | { rows: StatementRow[]; error: string };

// Every synonym group is matched case/punctuation-insensitively against the
// file's headers. Order matters within the row scan: a cell maps to the
// FIRST field it fuzzy-matches, and each cell maps to at most one field.
const HEADER_SYNONYMS: Record<string, string[]> = {
  txn_date: ["txn date", "date", "transaction date", "value date", "posting date", "post date", "tran date"],
  description: ["description", "narration", "particulars", "details", "remarks", "transaction remarks", "transaction details"],
  txn_no: ["txn no", "transaction id", "ref no", "reference no", "reference number", "utr", "txn id"],
  cheque_no: ["cheque no", "chq no", "cheque number", "chq number"],
  dr_amount: ["dr amount", "withdrawal", "debit amount", "paid out", "withdrawal amt", "debit", "dr"],
  cr_amount: ["cr amount", "deposit", "credit amount", "paid in", "deposit amt", "credit", "cr"],
  balance: ["balance", "closing balance", "running balance", "avail bal", "available balance"],
  branch_name: ["branch name", "branch", "category", "type"],
};

// A bare combined-amount column (single "Amount" / "Amt" / "Value" header,
// signed or Dr/Cr-labelled) — only used when no DR/CR pair was found.
const AMOUNT_COLUMN_HEADERS = new Set(["amount", "amt", "transaction amount", "value", "txn amount"]);

const MAX_BULK_ROWS = 2000;

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function toNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Accepts: 2026-09-15 | 15/09/2026 | 15-09-2026 | 15.09.2026 | 15-Sep-2026 |
// 15 Sep 2026 | Sep 15, 2026. Ambiguous numeric a/b (both ≤ 12) resolves
// DD/MM — the Indian bank-statement default.
function parseDate(raw: string): string | null {
  if (!raw) return null;
  const v = raw.trim();
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  };
  const dmy = v.match(/^(\d{1,2})[-/. ]([a-z]+|\d{1,2})[-/. ](\d{2,4})/i);
  if (dmy) {
    const day = dmy[1];
    const monToken = dmy[2].toLowerCase();
    const mon = /^\d+$/.test(monToken) ? Number(monToken) : months[monToken.slice(0, 4)] ?? months[monToken.slice(0, 3)];
    let year = dmy[3];
    if (year.length === 2) year = `20${year}`;
    if (mon && mon >= 1 && mon <= 12) {
      return `${year}-${String(mon).padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  const mdy = v.match(/^([a-z]+) (\d{1,2}),? (\d{4})/i);
  if (mdy) {
    const mon = months[mdy[1].toLowerCase().slice(0, 3)];
    if (mon) return `${mdy[3]}-${String(mon).padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  return null;
}

function monthStartOf(dateIso: string | null): string | null {
  return dateIso ? `${dateIso.slice(0, 7)}-01` : null;
}

// Header-row detection: score each of the first 40 rows by how many cells
// fuzzy-match any known synonym, pick the best-scoring row — handles the
// multi-line metadata preambles real bank exports carry (same approach as
// the generic importer's readBulkFile).
function findHeaderRow(aoa: unknown[][]): { idx: number; mapping: Map<number, string>; amountCol: number | null } | null {
  let bestIdx = -1;
  let bestScore = 0;
  let bestMap = new Map<number, string>();
  let bestAmountCol: number | null = null;

  const synEntries = Object.entries(HEADER_SYNONYMS);

  for (let i = 0; i < Math.min(40, aoa.length); i++) {
    const row = aoa[i] ?? [];
    const map = new Map<number, string>();
    let score = 0;
    let amountCol: number | null = null;
    row.forEach((cell, colIdx) => {
      const h = normHeader(String(cell ?? ""));
      if (!h) return;
      for (const [field, syns] of synEntries) {
        for (const syn of syns) {
          if (h === syn || h.includes(syn)) {
            map.set(colIdx, field);
            score += 1;
            return;
          }
        }
      }
      if (amountCol === null && AMOUNT_COLUMN_HEADERS.has(h)) amountCol = colIdx;
    });
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
      bestMap = map;
      bestAmountCol = amountCol;
    }
  }

  // Need at least a date + one amount-ish column to be usable.
  if (bestIdx < 0 || bestScore < 2) return null;
  return { idx: bestIdx, mapping: bestMap, amountCol: bestAmountCol };
}

export async function readStatementFileRows(file: FormDataEntryValue | null): Promise<ParsedStatement> {
  if (!(file instanceof File) || file.size === 0) {
    return { rows: [], error: "Choose a CSV or Excel file first." };
  }
  try {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    // raw: true keeps CSV cells as literal text — same silent date/number
    // auto-conversion guard as the generic importer (see its comment for
    // the 10/08 → 8 Oct class of bug this prevents).
    const wb = XLSX.read(buf, { type: "array", raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" }) as unknown[][];
    if (!aoa.length) return { rows: [], error: "Could not read that file — is it empty?" };

    const header = findHeaderRow(aoa);
    if (!header) {
      return {
        rows: [],
        error:
          "Could not find a header row — the file needs at least a Date column and any amount column (any common spelling).",
      };
    }

    const rows: StatementRow[] = [];
    for (let i = header.idx + 1; i < aoa.length; i++) {
      const raw = aoa[i] ?? [];
      if (raw.every((c) => String(c ?? "").trim() === "")) continue;

      const get = (field: string): string => {
        for (const [colIdx, f] of header.mapping) {
          if (f === field) {
            const v = raw[colIdx];
            return v === null || v === undefined ? "" : String(v).trim();
          }
        }
        return "";
      };

      const firstCell = raw.map((c) => String(c ?? "").trim()).find((c) => c !== "") ?? "";
      if (/^(total|grand total|subtotal|sub total|opening balance|closing balance|b\/f|c\/f)$/i.test(firstCell)) continue;

      const txn_date = parseDate(get("txn_date"));
      const description = get("description") || null;

      let dr = toNumber(get("dr_amount"));
      let cr = toNumber(get("cr_amount"));

      // Single combined-amount column fallback: positive = credit into the
      // account, negative (or an explicit "-"/"DR" marker in the cell) =
      // debit out. Only consulted when no DR/CR pair existed in the file.
      if (dr == null && cr == null && header.amountCol !== null) {
        const amountCell = String(raw[header.amountCol] ?? "").trim();
        const amt = toNumber(amountCell);
        if (amt != null) {
          const signedNegative = amt < 0 || /\b(dr|debit)\b/i.test(amountCell);
          if (signedNegative) {
            dr = Math.abs(amt);
          } else {
            cr = amt;
          }
        }
      }

      if (dr == null && cr == null) continue; // no amount at all — can't reconcile
      if (txn_date == null && !description) continue; // not a usable data row

      const dateIso = txn_date ?? "";
      const drStr = dr != null ? String(dr) : "0";
      const crStr = cr != null ? String(cr) : "0";
      const descFp = (description ?? "").toLowerCase().replace(/\s+/g, " ").trim();
      const fingerprint = `${dateIso}|${drStr}|${crStr}|${descFp}`;

      rows.push({
        txn_no: get("txn_no") || null,
        txn_date: txn_date,
        description,
        branch_name: get("branch_name") || null,
        cheque_no: get("cheque_no") || null,
        dr_amount: dr,
        cr_amount: cr,
        balance: toNumber(get("balance")),
        statement_month: monthStartOf(txn_date),
        fingerprint,
      });
      if (rows.length > MAX_BULK_ROWS) break;
    }

    return { rows, error: null };
  } catch {
    return { rows: [], error: "Could not read that file — make sure it's a valid CSV or Excel statement export." };
  }
}
