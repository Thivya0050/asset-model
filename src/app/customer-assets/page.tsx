"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Printer,
  Upload,
} from "lucide-react";
import {
  downloadCsv,
  formatDate,
  formatDateTime,
  formatListDateTime,
  lifecycleLabel,
} from "@/lib/format";
import { buildListQuery } from "@/lib/listUrl";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";
import { editHrefWithReturn } from "@/components/BackLink";
import { ImportDialog } from "@/components/ImportDialog";
import {
  CompactUpdatedCell,
  STICKY_ACTIONS_CELL,
  STICKY_ACTIONS_HEAD,
  TABLE_CELL,
  TABLE_HEAD,
  TruncatedCell,
} from "@/components/ListTableCells";
import { usePermissions } from "@/hooks/usePermissions";

type Option = {
  id: string;
  name: string;
  code?: string;
  label?: string;
  categoryTypeId?: string;
};
type Row = {
  id: string;
  serialNumber: string;
  assetStatus: string;
  warrantyExpiryDate: string | null;
  stampingExpiryDate: string | null;
  updatedAt: string;
  updatedBy: string;
  assetModel: { id: string; name: string };
  categoryType: { id: string; name: string };
  customer: { id: string; name: string };
};

type Filters = {
  serial: string;
  categoryTypeId: string;
  assetModelId: string;
  customerId: string;
  assetStatus: string;
  warrantyFrom: string;
  warrantyTo: string;
  stampingFrom: string;
  stampingTo: string;
};

const EMPTY: Filters = {
  serial: "",
  categoryTypeId: "",
  assetModelId: "",
  customerId: "",
  assetStatus: "",
  warrantyFrom: "",
  warrantyTo: "",
  stampingFrom: "",
  stampingTo: "",
};

const input =
  "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#4f46e5]";
const btnPrimary =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca]";
const btnGhost =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f9fafb]";

function filtersFromParams(sp: URLSearchParams): Filters {
  return {
    serial: sp.get("serial") ?? "",
    categoryTypeId: sp.get("category") ?? "",
    assetModelId: sp.get("model") ?? "",
    customerId: sp.get("customer") ?? "",
    assetStatus: sp.get("assetStatus") ?? "",
    warrantyFrom: sp.get("warrantyFrom") ?? "",
    warrantyTo: sp.get("warrantyTo") ?? "",
    stampingFrom: sp.get("stampingFrom") ?? "",
    stampingTo: sp.get("stampingTo") ?? "",
  };
}

function CustomerAssetsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, dialog } = useConfirmDialog();
  const { success, error: toastError } = useToast();
  const { canWriteCustomerAssets, canBulkImport } = usePermissions();

  const applied = useMemo(
    () => filtersFromParams(searchParams),
    [searchParams]
  );
  const liveSearch = searchParams.get("q") ?? "";

  const [draft, setDraft] = useState(applied);
  const [search, setSearch] = useState(liveSearch);
  const [rows, setRows] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    setDraft(applied);
    setSearch(liveSearch);
  }, [applied, liveSearch]);

  const listPath = useMemo(() => {
    const q = buildListQuery({
      serial: applied.serial,
      category: applied.categoryTypeId,
      model: applied.assetModelId,
      customer: applied.customerId,
      assetStatus: applied.assetStatus,
      warrantyFrom: applied.warrantyFrom,
      warrantyTo: applied.warrantyTo,
      stampingFrom: applied.stampingFrom,
      stampingTo: applied.stampingTo,
      q: liveSearch,
    });
    return `${pathname}${q}`;
  }, [pathname, applied, liveSearch]);

  const replaceParams = useCallback(
    (next: Filters & { q?: string }) => {
      const qs = buildListQuery({
        serial: next.serial,
        category: next.categoryTypeId,
        model: next.assetModelId,
        customer: next.customerId,
        assetStatus: next.assetStatus,
        warrantyFrom: next.warrantyFrom,
        warrantyTo: next.warrantyTo,
        stampingFrom: next.stampingFrom,
        stampingTo: next.stampingTo,
        q: next.q,
      });
      router.replace(qs ? `${pathname}${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/category-types").then((r) => r.json()),
      fetch("/api/asset-models?pageSize=100").then((r) => r.json()),
      fetch("/api/customers?all=1").then((r) => r.json()),
    ]).then(([cats, modelRes, custs]) => {
      setCategories(
        (cats ?? []).map(
          (c: { id: string; name: string; code?: string; label?: string }) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            label: c.label ?? (c.code ? `${c.name} (${c.code})` : c.name),
          })
        )
      );
      setModels(
        (modelRes.rows ?? []).map(
          (m: { id: string; name: string; categoryTypeId: string }) => ({
            id: m.id,
            name: m.name,
            categoryTypeId: m.categoryTypeId,
          })
        )
      );
      setCustomers(
        (custs ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
      );
    });
  }, []);

  const filteredModels = useMemo(() => {
    if (!draft.categoryTypeId) return models;
    return models.filter((m) => m.categoryTypeId === draft.categoryTypeId);
  }, [models, draft.categoryTypeId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const serial = applied.serial || liveSearch.trim();
      if (serial) params.set("serial", serial);
      if (applied.categoryTypeId)
        params.set("categoryTypeId", applied.categoryTypeId);
      if (applied.assetModelId) params.set("assetModelId", applied.assetModelId);
      if (applied.customerId) params.set("customerId", applied.customerId);
      if (applied.assetStatus) params.set("assetStatus", applied.assetStatus);
      if (applied.warrantyFrom) params.set("warrantyFrom", applied.warrantyFrom);
      if (applied.warrantyTo) params.set("warrantyTo", applied.warrantyTo);
      if (applied.stampingFrom) params.set("stampingFrom", applied.stampingFrom);
      if (applied.stampingTo) params.set("stampingTo", applied.stampingTo);

      const res = await fetch(`/api/customer-assets?${params}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setRows(data ?? []);
    } catch {
      toastError("Couldn't load customer assets. Check your connection and try again.");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [applied, liveSearch, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === liveSearch) return;
      replaceParams({ ...applied, q: next });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-debounce when local search text changes
  }, [search]);

  const applyFilters = () => replaceParams({ ...draft, q: search.trim() });

  const clearFilters = () => {
    setDraft(EMPTY);
    setSearch("");
    router.replace(pathname, { scroll: false });
  };

  const exportCsv = async () => {
    const count = rows.length;
    if (count === 0) return;
    const ok = await confirm({
      title: "Export to Excel?",
      message: `Export ${count} asset${count === 1 ? "" : "s"} to Excel?`,
      confirmLabel: "Export",
    });
    if (!ok) return;
    try {
      downloadCsv(
        "customer-assets.csv",
        rows.map((r) => ({
          Serial: r.serialNumber,
          Model: r.assetModel.name,
          Category: r.categoryType.name,
          Customer: r.customer.name,
          Status: lifecycleLabel(r.assetStatus),
          "Warranty Expiry": formatDate(r.warrantyExpiryDate),
          "Stamping Expiry": formatDate(r.stampingExpiryDate),
          Updated: formatDateTime(r.updatedAt),
          "Updated By": r.updatedBy,
        }))
      );
      success("Excel export ready");
    } catch {
      toastError("Couldn't export. Try again.");
    }
  };

  const runPrint = async (kind: "PDF" | "Print") => {
    const count = rows.length;
    if (count === 0) return;
    const ok = await confirm({
      title: kind === "PDF" ? "Export to PDF?" : "Print list?",
      message:
        kind === "PDF"
          ? `Export ${count} visible asset${count === 1 ? "" : "s"} to PDF?`
          : `Print ${count} visible asset${count === 1 ? "" : "s"}?`,
      confirmLabel: kind === "PDF" ? "Export" : "Print",
    });
    if (!ok) return;
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1a1d23]">
            Customer Assets
          </h2>
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Manage physical units linked to models and customers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canBulkImport ? (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className={btnGhost}
            >
              <Upload size={14} />
              Import
            </button>
          ) : null}
          {canWriteCustomerAssets ? (
            <Link href="/customer-assets/new" className={btnPrimary}>
              <Plus size={14} />
              Add Asset
            </Link>
          ) : null}
        </div>
      </div>

      <div className="no-print space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-3.5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Asset S/N
            <input
              className={input}
              value={draft.serial}
              onChange={(e) =>
                setDraft((d) => ({ ...d, serial: e.target.value }))
              }
              placeholder="Serial number…"
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Category
            <select
              className={input}
              value={draft.categoryTypeId}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  categoryTypeId: e.target.value,
                  assetModelId: "",
                }))
              }
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Model
            <select
              className={input}
              value={draft.assetModelId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, assetModelId: e.target.value }))
              }
            >
              <option value="">All</option>
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Customer
            <select
              className={input}
              value={draft.customerId}
              onChange={(e) =>
                setDraft((d) => ({ ...d, customerId: e.target.value }))
              }
            >
              <option value="">All</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Asset Status
            <select
              className={input}
              value={draft.assetStatus}
              onChange={(e) =>
                setDraft((d) => ({ ...d, assetStatus: e.target.value }))
              }
            >
              <option value="">All</option>
              <option>In Use</option>
              <option>In Storage</option>
              <option>Retired</option>
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Warranty From
            <input
              type="date"
              className={input}
              value={draft.warrantyFrom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, warrantyFrom: e.target.value }))
              }
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Warranty To
            <input
              type="date"
              className={input}
              value={draft.warrantyTo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, warrantyTo: e.target.value }))
              }
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Stamping From
            <input
              type="date"
              className={input}
              value={draft.stampingFrom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, stampingFrom: e.target.value }))
              }
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Stamping To
            <input
              type="date"
              className={input}
              value={draft.stampingTo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, stampingTo: e.target.value }))
              }
            />
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563] md:col-span-2">
            Quick search (S/N)
            <input
              className={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Live search serial…"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={applyFilters} className={btnPrimary}>
            Filter
          </button>
          <button type="button" onClick={clearFilters} className={btnGhost}>
            Clear
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={exportCsv} className={btnGhost}>
          <FileSpreadsheet size={13} /> Excel
        </button>
        <button type="button" onClick={() => runPrint("PDF")} className={btnGhost}>
          <FileText size={13} /> PDF
        </button>
        <button type="button" onClick={() => runPrint("Print")} className={btnGhost}>
          <Printer size={13} /> Print
        </button>
        {loading && !initialLoad ? (
          <span className="text-[12px] text-[#9ca3af]">Updating…</span>
        ) : null}
      </div>

      {initialLoad ? (
        <TableSkeleton cols={6} rows={7} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white md:block">
            <div className="data-table-scroll">
              <table className="data-table w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>Serial</th>
                    <th className={TABLE_HEAD}>Model</th>
                    <th className={TABLE_HEAD}>Category</th>
                    <th className={TABLE_HEAD}>Customer</th>
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>Status</th>
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>Warranty</th>
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>Stamping</th>
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>Updated</th>
                    {canWriteCustomerAssets ? (
                      <th className={STICKY_ACTIONS_HEAD}>Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canWriteCustomerAssets ? 9 : 8}
                        className="px-2 py-10 text-center text-[13px] text-[#6b7280]"
                      >
                        No customer assets match the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]"
                      >
                        <td
                          className={`${TABLE_CELL} max-w-[8rem] truncate font-mono text-[12px] text-[#1a1d23]`}
                          title={r.serialNumber}
                        >
                          {r.serialNumber}
                        </td>
                        <TruncatedCell text={r.assetModel.name} maxWidth="max-w-[9rem]" />
                        <TruncatedCell text={r.categoryType.name} maxWidth="max-w-[8rem]" />
                        <TruncatedCell text={r.customer.name} maxWidth="max-w-[9rem]" />
                        <td className={`${TABLE_CELL} whitespace-nowrap text-[#4b5563]`}>
                          {lifecycleLabel(r.assetStatus)}
                        </td>
                        <td className={`${TABLE_CELL} whitespace-nowrap text-[#4b5563]`}>
                          {formatDate(r.warrantyExpiryDate)}
                        </td>
                        <td className={`${TABLE_CELL} whitespace-nowrap text-[#4b5563]`}>
                          {formatDate(r.stampingExpiryDate)}
                        </td>
                        <CompactUpdatedCell
                          at={formatListDateTime(r.updatedAt)}
                          by={r.updatedBy}
                        />
                        {canWriteCustomerAssets ? (
                          <td className={STICKY_ACTIONS_CELL}>
                            <Link
                              href={editHrefWithReturn(
                                `/customer-assets/${r.id}/edit`,
                                listPath
                              )}
                              className="inline-flex rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </Link>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 md:hidden">
            {rows.length === 0 ? (
              <p className="rounded-[6px] border border-[#e5e7eb] bg-white p-6 text-center text-[13px] text-[#6b7280]">
                No customer assets match the current filters.
              </p>
            ) : (
              rows.map((r) => (
                <article
                  key={r.id}
                  className="rounded-[6px] border border-[#e5e7eb] bg-white p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-mono text-[13px] font-medium text-[#1a1d23]">
                      {r.serialNumber}
                    </h3>
                    <span className="text-[11px] font-medium text-[#6b7280]">
                      {lifecycleLabel(r.assetStatus)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[#4b5563]">
                    {r.assetModel.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#6b7280]">
                    {r.customer.name} · {r.categoryType.name}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                    Warranty {formatDate(r.warrantyExpiryDate)} · Stamping{" "}
                    {formatDate(r.stampingExpiryDate)}
                  </p>
                  {canWriteCustomerAssets ? (
                    <div className="mt-3 flex min-h-11 items-center gap-1">
                      <Link
                        href={editHrefWithReturn(
                          `/customer-assets/${r.id}/edit`,
                          listPath
                        )}
                        className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Link>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </>
      )}
      {dialog}
      <ImportDialog
        entity="customer-assets"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => load()}
      />
    </div>
  );
}

export default function CustomerAssetsPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={6} rows={7} />}>
      <CustomerAssetsPageInner />
    </Suspense>
  );
}
