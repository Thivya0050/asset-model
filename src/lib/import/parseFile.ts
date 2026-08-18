import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedSheet = {
  headers: string[];
  rows: Record<string, unknown>[];
};

function normalizeRowKeys(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = String(k).trim();
    if (!key) continue;
    out[key] = v;
  }
  return out;
}

export async function parseImportFile(file: File): Promise<ParsedSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return parseCsv(file);
  }
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel")
  ) {
    return parseXlsx(file);
  }
  throw new Error("Please upload a .csv or .xlsx file.");
}

function parseCsv(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (result) => {
        if (result.errors.length && !result.data.length) {
          reject(
            new Error(
              result.errors[0]?.message || "Could not read this CSV file."
            )
          );
          return;
        }
        const rows = result.data
          .map(normalizeRowKeys)
          .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()));
        const headers =
          result.meta.fields?.map((f) => f.trim()).filter(Boolean) ??
          (rows[0] ? Object.keys(rows[0]) : []);
        resolve({ headers, rows });
      },
      error: (err) => reject(err),
    });
  });
}

async function parseXlsx(file: File): Promise<ParsedSheet> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("This Excel file has no sheets.");
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const rows = json
    .map(normalizeRowKeys)
    .filter((r) => Object.values(r).some((v) => String(v ?? "").trim()));
  const headers =
    rows.length > 0
      ? Object.keys(rows[0])
      : ((XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[]) ?? [])
          .map((h) => String(h ?? "").trim())
          .filter(Boolean);
  return { headers, rows };
}

export function downloadCsvTemplate(
  filename: string,
  headers: string[],
  sampleRow?: string[]
) {
  const lines = [
    headers.map(escapeCsv).join(","),
    ...(sampleRow ? [sampleRow.map(escapeCsv).join(",")] : []),
  ];
  const blob = new Blob([lines.join("\n") + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function downloadXlsxTemplate(
  filename: string,
  headers: string[],
  sampleRow?: string[]
) {
  const data = [headers, ...(sampleRow ? [sampleRow] : [])];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(
    blob,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  );
}

function escapeCsv(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadRowsCsv(
  filename: string,
  rows: Record<string, string>[]
) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => headers.map((h) => escapeCsv(String(r[h] ?? ""))).join(",")),
  ];
  const blob = new Blob([lines.join("\n") + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  triggerDownload(blob, filename);
}
