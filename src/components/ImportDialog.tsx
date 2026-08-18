"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import {
  ENTITY_LABELS,
  applyMapping,
  autoMapColumns,
  fieldsForImport,
  type ImportEntity,
  type MappedRow,
} from "@/lib/import/schema";
import {
  downloadCsvTemplate,
  downloadRowsCsv,
  downloadXlsxTemplate,
  parseImportFile,
} from "@/lib/import/parseFile";

type Step = "upload" | "map" | "preview" | "importing";

type ValidatedRow = {
  rowIndex: number;
  status: "ok" | "error" | "duplicate";
  message?: string;
  data: MappedRow;
};

type Props = {
  entity: ImportEntity;
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  /** Ignored — server sets Updated By from session (or file in Migration Mode). */
  updatedBy?: string;
};

const btnPrimary =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca] disabled:opacity-50";
const btnGhost =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f9fafb] disabled:opacity-50";

export function ImportDialog({
  entity,
  open,
  onClose,
  onImported,
}: Props) {
  const { confirm, dialog } = useConfirmDialog();
  const { success, error: toastError } = useToast();

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState<ValidatedRow[]>([]);
  const [summary, setSummary] = useState({
    ready: 0,
    errors: 0,
    duplicates: 0,
    total: 0,
  });
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [migrationMode, setMigrationMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const fields = fieldsForImport(entity, migrationMode);
  const label = ENTITY_LABELS[entity];

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setValidated([]);
    setSummary({ ready: 0, errors: 0, duplicates: 0, total: 0 });
    setIncludeDuplicates(false);
    setMigrationMode(false);
    setBusy(false);
    setProgress(0);
  }, []);

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const downloadTemplate = (format: "csv" | "xlsx") => {
    const headers = fields.map((f) => f.label);
    const sample =
      entity === "categories"
        ? ["Weighing Scale", "SCL"]
        : entity === "customers"
          ? ["AEON QUEENSBAY MALL"]
          : entity === "asset-models"
            ? ["DIGI SM5300X (P) (30KG)", "Weighing Scale (SCL)", "DIGI", "", "12", "12", ""]
            : [
                "SN-001",
                "DIGI SM5300X (P) (30KG)",
                "AEON QUEENSBAY MALL",
                "In Use",
                "2027-01-15",
                "2026-06-01",
              ];
    const base = `${entity}-import-template`;
    if (format === "csv") downloadCsvTemplate(base, headers, sample);
    else downloadXlsxTemplate(base, headers, sample);
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseImportFile(file);
      if (!parsed.headers.length) {
        toastError("No columns found in this file.");
        return;
      }
      if (!parsed.rows.length) {
        toastError("This file has headers but no data rows.");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMigrationMode(false);
      setMapping(autoMapColumns(parsed.headers, entity, false));
      setStep("map");
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Couldn't read this file. Try CSV or Excel."
      );
    } finally {
      setBusy(false);
    }
  };

  const mappingComplete = useMemo(() => {
    return fields
      .filter((f) => f.required)
      .every((f) => Boolean(mapping[f.key]));
  }, [fields, mapping]);

  const runValidate = async () => {
    if (!mappingComplete) {
      toastError("Map all required fields before continuing.");
      return;
    }
    setBusy(true);
    try {
      const mapped = applyMapping(rawRows, mapping);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          mode: "validate",
          rows: mapped,
          migrationMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || "Couldn't validate this file.");
        return;
      }
      setValidated(data.rows);
      setSummary(data.summary);
      setIncludeDuplicates(false);
      setStep("preview");
    } catch {
      toastError("Couldn't validate. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const importCount = useMemo(() => {
    return validated.filter(
      (r) =>
        r.status === "ok" || (includeDuplicates && r.status === "duplicate")
    ).length;
  }, [validated, includeDuplicates]);

  const runImport = async () => {
    if (importCount === 0) {
      toastError("Nothing to import — fix errors or include duplicates.");
      return;
    }
    const ok = await confirm({
      title: `Import ${importCount} record${importCount === 1 ? "" : "s"}?`,
      message: `This will create ${importCount} new ${label.toLowerCase()}. Existing records will not be changed.`,
      confirmLabel: "Import",
    });
    if (!ok) return;

    setStep("importing");
    setBusy(true);
    setProgress(15);
    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + 8, 85));
    }, 200);

    try {
      const mapped = applyMapping(rawRows, mapping);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          mode: "commit",
          rows: mapped,
          includeDuplicates,
          migrationMode,
        }),
      });
      clearInterval(tick);
      setProgress(100);
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || "Import failed. Try again.");
        setStep("preview");
        return;
      }
      const skipped = data.skipped ?? 0;
      success(
        skipped > 0
          ? `${data.imported} imported, ${skipped} skipped`
          : `${data.imported} ${label.toLowerCase()} imported`
      );
      if (Array.isArray(data.skippedRows) && data.skippedRows.length > 0) {
        // Keep dialog open briefly? Better: auto-download option via toast — offer download now
        downloadRowsCsv(
          `${entity}-import-skipped.csv`,
          data.skippedRows.map(
            (r: Record<string, string | number>) => {
              const out: Record<string, string> = {};
              for (const [k, v] of Object.entries(r)) {
                out[k] = String(v ?? "");
              }
              return out;
            }
          )
        );
      }
      onImported();
      reset();
      onClose();
    } catch {
      clearInterval(tick);
      toastError("Import failed. Check your connection and try again.");
      setStep("preview");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          className="absolute inset-0 bg-[#1a1d23]/40"
          aria-label="Dismiss"
          onClick={handleClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-title"
          className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white shadow-lg"
        >
          <div className="border-b border-[#e5e7eb] px-5 py-4">
            <h2
              id="import-title"
              className="text-[15px] font-semibold tracking-tight text-[#1a1d23]"
            >
              Import {label}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#6b7280]">
              {step === "upload" && "Step 1 of 3 — Upload a CSV or Excel file"}
              {step === "map" && "Step 2 of 3 — Map columns to fields"}
              {step === "preview" && "Step 3 of 3 — Review and import"}
              {step === "importing" && "Importing…"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {step === "upload" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => downloadTemplate("csv")}
                  >
                    <Download size={13} /> Template (CSV)
                  </button>
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => downloadTemplate("xlsx")}
                  >
                    <Download size={13} /> Template (Excel)
                  </button>
                </div>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed border-[#d1d5db] bg-[#fafafa] px-4 py-10 text-center hover:border-[#4f46e5] hover:bg-[#eef2ff]/40">
                  <Upload size={20} className="text-[#9ca3af]" />
                  <span className="mt-2 text-[13px] font-medium text-[#1a1d23]">
                    Choose .csv or .xlsx file
                  </span>
                  <span className="mt-1 text-[12px] text-[#6b7280]">
                    Headers in the first row; one record per row
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    disabled={busy}
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            ) : null}

            {step === "map" ? (
              <div className="space-y-3">
                <p className="text-[13px] text-[#6b7280]">
                  File: <span className="font-medium text-[#1a1d23]">{fileName}</span>{" "}
                  · {rawRows.length} row{rawRows.length === 1 ? "" : "s"}
                </p>

                <label className="flex items-start gap-2 rounded-[6px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5 text-[13px] text-[#4b5563]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={migrationMode}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMigrationMode(on);
                      setMapping((prev) => {
                        const next = autoMapColumns(headers, entity, on);
                        // Keep any existing mappings the user already chose
                        for (const [k, v] of Object.entries(prev)) {
                          if (v && (on || (k !== "updatedAt" && k !== "updatedBy"))) {
                            next[k] = v;
                          }
                        }
                        if (!on) {
                          delete next.updatedAt;
                          delete next.updatedBy;
                        }
                        return next;
                      });
                    }}
                  />
                  <span>
                    <span className="font-medium text-[#1a1d23]">
                      Migration Mode
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#6b7280]">
                      Preserve original Updated On / Updated By from the file
                      instead of today&apos;s date and the current user.
                    </span>
                  </span>
                </label>

                {migrationMode ? (
                  <p className="rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                    Preserving original dates and authors from the file — use
                    this only for historical data migration, not everyday
                    additions.
                  </p>
                ) : null}

                <div className="overflow-hidden rounded-[6px] border border-[#e5e7eb]">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                        <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                          System field
                        </th>
                        <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                          File column
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f) => (
                        <tr
                          key={f.key}
                          className="border-b border-[#f3f4f6] last:border-0"
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium text-[#1a1d23]">
                              {f.label}
                            </span>
                            {f.required ? (
                              <span className="ml-1 text-red-600">*</span>
                            ) : (
                              <span className="ml-1 text-[11px] text-[#9ca3af]">
                                optional
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="w-full rounded-[6px] border border-[#e5e7eb] px-2 py-1.5 text-[13px] outline-none focus:border-[#4f46e5]"
                              value={mapping[f.key] ?? ""}
                              onChange={(e) =>
                                setMapping((m) => ({
                                  ...m,
                                  [f.key]: e.target.value,
                                }))
                              }
                            >
                              <option value="">— Not mapped —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[12px] text-[#6b7280]">
                  Category, Model, and Customer columns are matched by{" "}
                  <strong>name</strong> (not ID) during import.
                  {migrationMode
                    ? " Updated By is free text (any name from your file)."
                    : ""}
                </p>
              </div>
            ) : null}

            {step === "preview" ? (
              <div className="space-y-3">
                <p className="text-[13px] text-[#1a1d23]">
                  <span className="font-semibold">{summary.ready}</span> rows ready
                  <span className="text-[#6b7280]"> · </span>
                  <span className="font-semibold text-red-700">
                    {summary.errors}
                  </span>{" "}
                  errors
                  <span className="text-[#6b7280]"> · </span>
                  <span className="font-semibold text-amber-800">
                    {summary.duplicates}
                  </span>{" "}
                  possible duplicates
                </p>

                {(entity === "asset-models" || entity === "customer-assets") &&
                summary.duplicates > 0 ? (
                  <label className="flex items-start gap-2 text-[13px] text-[#4b5563]">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={includeDuplicates}
                      onChange={(e) => setIncludeDuplicates(e.target.checked)}
                    />
                    <span>
                      Also import {summary.duplicates} duplicate warning
                      {summary.duplicates === 1 ? "" : "s"} (creates new
                      records anyway)
                    </span>
                  </label>
                ) : null}

                <div className="max-h-64 overflow-auto rounded-[6px] border border-[#e5e7eb]">
                  <table className="w-full text-left text-[12px]">
                    <thead className="sticky top-0 bg-[#fafafa]">
                      <tr className="border-b border-[#e5e7eb]">
                        <th className="px-2 py-1.5 font-medium text-[#6b7280]">
                          Row
                        </th>
                        <th className="px-2 py-1.5 font-medium text-[#6b7280]">
                          Status
                        </th>
                        <th className="px-2 py-1.5 font-medium text-[#6b7280]">
                          Detail
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {validated.map((r) => (
                        <tr
                          key={r.rowIndex}
                          className={`border-b border-[#f3f4f6] last:border-0 ${
                            r.status === "error"
                              ? "bg-red-50/80"
                              : r.status === "duplicate"
                                ? "bg-amber-50/80"
                                : ""
                          }`}
                        >
                          <td className="px-2 py-1.5 tabular-nums text-[#6b7280]">
                            {r.rowIndex + 2}
                          </td>
                          <td className="px-2 py-1.5 font-medium">
                            {r.status === "ok"
                              ? "Ready"
                              : r.status === "duplicate"
                                ? "Duplicate"
                                : "Error"}
                          </td>
                          <td className="px-2 py-1.5 text-[#4b5563]">
                            {r.message ||
                              previewLabel(entity, r.data) ||
                              "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {step === "importing" ? (
              <div className="space-y-3 py-6">
                <p className="text-center text-[13px] text-[#6b7280]">
                  Creating records…
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
                  <div
                    className="h-full rounded-full bg-[#4f46e5] transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[#e5e7eb] px-5 py-3">
            {step !== "importing" ? (
              <button type="button" className={btnGhost} onClick={handleClose}>
                Cancel
              </button>
            ) : null}
            {step === "map" ? (
              <>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setStep("upload")}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={runValidate}
                  disabled={busy || !mappingComplete}
                >
                  {busy ? "Checking…" : "Continue"}
                </button>
              </>
            ) : null}
            {step === "preview" ? (
              <>
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setStep("map")}
                  disabled={busy}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  onClick={runImport}
                  disabled={busy || importCount === 0}
                >
                  Import {importCount} ready
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {dialog}
    </>
  );
}

function previewLabel(entity: ImportEntity, data: MappedRow): string {
  if (entity === "categories" || entity === "customers") {
    return data.name || "";
  }
  if (entity === "asset-models") {
    return [data.name, data.category].filter(Boolean).join(" · ");
  }
  return [data.serialNumber, data.assetModel, data.customer]
    .filter(Boolean)
    .join(" · ");
}
