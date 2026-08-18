"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Archive,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Printer,
  Upload,
} from "lucide-react";
import { downloadCsv, formatDateTime, formatListDateTime } from "@/lib/format";
import { buildListQuery } from "@/lib/listUrl";
import { HelpTip } from "@/components/HelpTip";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";
import { editHrefWithReturn } from "@/components/BackLink";
import { ImportDialog } from "@/components/ImportDialog";
import { usePermissions } from "@/hooks/usePermissions";
import {
  CompactUpdatedCell,
  STICKY_ACTIONS_CELL,
  STICKY_ACTIONS_HEAD,
  TABLE_CELL,
  TABLE_HEAD,
  TruncatedCell,
} from "@/components/ListTableCells";

type Category = { id: string; name: string; code?: string; label?: string };
type Row = {
  id: string;
  name: string;
  categoryTypeId: string;
  categoryName: string;
  status: "Active" | "Inactive";
  updatedAt: string;
  updatedBy: string;
  customerAssetCount: number;
};

type SortKey = "name" | "status" | "updatedAt" | "updatedBy" | "categoryName";

const ARCHIVE_TIP =
  "Hides from new entries; history is retained. Nothing is deleted.";

const btnPrimary =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca]";
const btnGhost =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#4b5563] hover:bg-[#f9fafb]";
const input =
  "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[13px] text-[#1a1d23] outline-none focus:border-[#4f46e5]";

function AssetModelsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { confirm, dialog } = useConfirmDialog();
  const { success, error: toastError } = useToast();
  const { canWriteAssetModels, canBulkImport } = usePermissions();

  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const appliedCategory = searchParams.get("category") ?? "";
  const appliedStatus = searchParams.get("status") ?? "";
  const debouncedSearch = searchParams.get("q") ?? "";
  const sort = (searchParams.get("sort") as SortKey) || "updatedAt";
  const order = (searchParams.get("order") as "asc" | "desc") || "desc";
  const page = Math.max(1, Number(searchParams.get("page") || "1") || 1);
  const pageSize = Number(searchParams.get("pageSize") || "10") || 10;

  const [draftCategory, setDraftCategory] = useState(appliedCategory);
  const [draftStatus, setDraftStatus] = useState(appliedStatus);
  const [search, setSearch] = useState(debouncedSearch);

  useEffect(() => {
    setDraftCategory(appliedCategory);
    setDraftStatus(appliedStatus);
    setSearch(debouncedSearch);
  }, [appliedCategory, appliedStatus, debouncedSearch]);

  const listPath = useMemo(() => {
    const q = buildListQuery({
      category: appliedCategory,
      status: appliedStatus,
      q: debouncedSearch,
      sort: sort !== "updatedAt" ? sort : undefined,
      order: order !== "desc" ? order : undefined,
      page: page !== 1 ? page : undefined,
      pageSize: pageSize !== 10 ? pageSize : undefined,
    });
    return `${pathname}${q}`;
  }, [
    pathname,
    appliedCategory,
    appliedStatus,
    debouncedSearch,
    sort,
    order,
    page,
    pageSize,
  ]);

  const replaceParams = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      }
      // Drop defaults to keep URLs clean
      if (params.get("sort") === "updatedAt") params.delete("sort");
      if (params.get("order") === "desc") params.delete("order");
      if (params.get("page") === "1") params.delete("page");
      if (params.get("pageSize") === "10") params.delete("pageSize");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  useEffect(() => {
    fetch("/api/category-types")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = search.trim();
      if (next === debouncedSearch) return;
      replaceParams({ q: next || null, page: 1 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-debounce when local search text changes
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sort === "categoryName" ? "name" : sort,
        order,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (appliedCategory) params.set("categoryTypeId", appliedCategory);
      if (appliedStatus) params.set("status", appliedStatus);

      if (sort === "categoryName") {
        params.set("page", "1");
        params.set("pageSize", "100");
      }

      const res = await fetch(`/api/asset-models?${params}`);
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      let list: Row[] = data.rows ?? [];

      if (sort === "categoryName") {
        list = [...list].sort((a, b) => {
          const cmp = a.categoryName.localeCompare(b.categoryName);
          return order === "asc" ? cmp : -cmp;
        });
        const start = (page - 1) * pageSize;
        setTotal(list.length);
        setRows(list.slice(start, start + pageSize));
      } else {
        setTotal(data.total ?? 0);
        setRows(list);
      }
      setSelected(new Set());
    } catch {
      toastError("Couldn't load models. Check your connection and try again.");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [
    page,
    pageSize,
    sort,
    order,
    debouncedSearch,
    appliedCategory,
    appliedStatus,
    toastError,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    replaceParams({
      category: draftCategory || null,
      status: draftStatus || null,
      page: 1,
    });
  };

  const clearFilters = () => {
    setDraftCategory("");
    setDraftStatus("");
    setSearch("");
    router.replace(pathname, { scroll: false });
  };

  const toggleSort = (key: SortKey) => {
    if (sort === key) {
      replaceParams({ order: order === "asc" ? "desc" : "asc" });
    } else {
      replaceParams({
        sort: key,
        order: key === "name" || key === "categoryName" ? "asc" : "desc",
        page: 1,
      });
    }
  };

  const allOnPageSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allOnPageSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restoreModel = async (id: string, name: string) => {
    try {
      const existing = await fetch(`/api/asset-models/${id}`).then((r) =>
        r.json()
      );
      if (existing.error) {
        toastError("Couldn't undo archive. Try again from Edit.");
        return;
      }
      const res = await fetch(`/api/asset-models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...existing, status: "Active" }),
      });
      if (!res.ok) {
        toastError("Couldn't undo archive. Try again from Edit.");
        return;
      }
      success(`'${name}' restored`);
      await load();
    } catch {
      toastError("Couldn't undo archive. Check your connection and try again.");
    }
  };

  const archiveOne = async (id: string, name: string) => {
    const ok = await confirm({
      title: "Archive model?",
      message: `Archive '${name}'? It will be hidden from new selections but existing records stay linked.`,
      confirmLabel: "Archive",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/asset-models/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toastError("Couldn't archive model. Try again.");
        return;
      }
      success(`'${name}' archived`, {
        actionLabel: "Undo",
        onAction: () => restoreModel(id, name),
        durationMs: 6000,
      });
      await load();
    } catch {
      toastError("Couldn't archive model. Check your connection and try again.");
    }
  };

  const bulkArchive = async () => {
    if (selected.size === 0) return;
    const count = selected.size;
    const ok = await confirm({
      title: "Archive selected models?",
      message: `Archive ${count} selected model${count === 1 ? "" : "s"}? They will be hidden from new selections but existing records stay linked.`,
      confirmLabel: "Archive",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/asset-models/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selected),
        }),
      });
      if (!res.ok) {
        toastError("Couldn't archive selected models. Try again.");
        return;
      }
      success(
        `${count} model${count === 1 ? "" : "s"} archived`
      );
      await load();
    } catch {
      toastError("Couldn't archive selected models. Check your connection and try again.");
    }
  };

  const runExport = async (onlySelected: boolean) => {
    const count = onlySelected ? selected.size : total;
    if (count === 0) return;

    const ok = await confirm({
      title: onlySelected ? "Export selected?" : "Export to Excel?",
      message: onlySelected
        ? `Export ${count} selected model${count === 1 ? "" : "s"} to Excel?`
        : `Export ${count} model${count === 1 ? "" : "s"} to Excel?`,
      confirmLabel: "Export",
    });
    if (!ok) return;

    try {
      let exportList = rows;
      if (onlySelected) {
        const params = new URLSearchParams({
          ids: Array.from(selected).join(","),
        });
        const data = await fetch(`/api/asset-models?${params}`).then((r) =>
          r.json()
        );
        exportList = data.rows ?? [];
      } else {
        const params = new URLSearchParams({
          page: "1",
          pageSize: "100",
          sort: "name",
          order: "asc",
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (appliedCategory) params.set("categoryTypeId", appliedCategory);
        if (appliedStatus) params.set("status", appliedStatus);
        const data = await fetch(`/api/asset-models?${params}`).then((r) =>
          r.json()
        );
        exportList = data.rows ?? [];
      }

      downloadCsv(
        onlySelected ? "asset-models-selected.csv" : "asset-models.csv",
        exportList.map((r) => ({
          "Model Name": r.name,
          Category: r.categoryName,
          Status: r.status === "Inactive" ? "Archived" : "Active",
          "Updated On": formatDateTime(r.updatedAt),
          "Updated By": r.updatedBy,
          "Customer Assets": r.customerAssetCount,
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
          ? `Export ${count} visible model${count === 1 ? "" : "s"} to PDF?`
          : `Print ${count} visible model${count === 1 ? "" : "s"}?`,
      confirmLabel: kind === "PDF" ? "Export" : "Print",
    });
    if (!ok) return;
    window.print();
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = Boolean(
    debouncedSearch || appliedCategory || appliedStatus
  );

  const emptyMessage = hasFilters
    ? "No models match the current filters."
    : canWriteAssetModels
      ? "No models yet. Click Add Model to create one."
      : "No models yet.";

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(col)}
      className="inline-flex items-center gap-0.5 text-[12px] font-medium text-[#6b7280] hover:text-[#1a1d23]"
    >
      {label}
      {sort === col ? (order === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

  const statusBadge = (status: string) => (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        status === "Active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {status === "Inactive" ? "Archived" : "Active"}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1a1d23]">
            Asset Models
          </h2>
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Manage equipment models in the catalogue.
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
          {canWriteAssetModels ? (
            <Link href="/asset-models/new" className={btnPrimary}>
              <Plus size={14} />
              Add Model
            </Link>
          ) : null}
        </div>
      </div>

      <div className="no-print rounded-[6px] border border-[#e5e7eb] bg-white p-3.5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Category
            <select
              className={input}
              value={draftCategory}
              onChange={(e) => setDraftCategory(e.target.value)}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? (c.code ? `${c.name} (${c.code})` : c.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Status
            <select
              className={input}
              value={draftStatus}
              onChange={(e) => setDraftStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Archived</option>
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563] md:col-span-2">
            Search
            <input
              className={input}
              placeholder="Model name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={applyFilters} className={btnPrimary}>
            Filter
          </button>
          <button type="button" onClick={clearFilters} className={btnGhost}>
            Clear
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => runExport(false)} className={btnGhost}>
          <FileSpreadsheet size={13} /> Excel
        </button>
        <button type="button" onClick={() => runPrint("PDF")} className={btnGhost}>
          <FileText size={13} /> PDF
        </button>
        <button type="button" onClick={() => runPrint("Print")} className={btnGhost}>
          <Printer size={13} /> Print
        </button>
        {canWriteAssetModels && selected.size > 0 ? (
          <>
            <button
              type="button"
              onClick={bulkArchive}
              title={ARCHIVE_TIP}
              className="btn-touch inline-flex items-center gap-1.5 rounded-[6px] border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] font-medium text-amber-800"
            >
              <Archive size={13} /> Archive ({selected.size})
              <HelpTip text={ARCHIVE_TIP} />
            </button>
            <button type="button" onClick={() => runExport(true)} className={btnGhost}>
              Export selected
            </button>
          </>
        ) : null}
        {loading && !initialLoad ? (
          <span className="text-[12px] text-[#9ca3af]">Updating…</span>
        ) : null}
      </div>

      {initialLoad ? (
        <TableSkeleton cols={7} rows={8} />
      ) : (
        <div ref={printRef}>
          <div className="hidden overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white md:block">
            <div className="data-table-scroll">
              <table className="data-table w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                    {canWriteAssetModels ? (
                      <th className="no-print data-table-cell w-9 px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleAll}
                          aria-label="Select all"
                        />
                      </th>
                    ) : null}
                    <th className={TABLE_HEAD}>
                      <SortBtn col="name" label="Model Name" />
                    </th>
                    <th className={TABLE_HEAD}>
                      <SortBtn col="categoryName" label="Category" />
                    </th>
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>
                      <SortBtn col="status" label="Status" />
                    </th>
                    <th className={`${TABLE_HEAD} whitespace-nowrap`}>
                      <SortBtn col="updatedAt" label="Updated" />
                    </th>
                    {canWriteAssetModels ? (
                      <th className={STICKY_ACTIONS_HEAD}>Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canWriteAssetModels ? 6 : 4}
                        className="px-2 py-10 text-center text-[13px] text-[#6b7280]"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]"
                      >
                        {canWriteAssetModels ? (
                          <td className="no-print data-table-cell px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={selected.has(r.id)}
                              onChange={() => toggleOne(r.id)}
                              aria-label={`Select ${r.name}`}
                            />
                          </td>
                        ) : null}
                        <td
                          className={`${TABLE_CELL} max-w-[12rem] truncate font-medium text-[#1a1d23]`}
                          title={r.name}
                        >
                          {r.name}
                        </td>
                        <TruncatedCell text={r.categoryName} maxWidth="max-w-[8rem]" />
                        <td className={`${TABLE_CELL} whitespace-nowrap`}>
                          {statusBadge(r.status)}
                        </td>
                        <CompactUpdatedCell
                          at={formatListDateTime(r.updatedAt)}
                          by={r.updatedBy}
                        />
                        {canWriteAssetModels ? (
                          <td className={STICKY_ACTIONS_CELL}>
                            <div className="flex items-center gap-1">
                              <Link
                                href={editHrefWithReturn(
                                  `/asset-models/${r.id}/edit`,
                                  listPath
                                )}
                                className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                                title="Edit"
                              >
                                <Pencil size={14} />
                              </Link>
                              {r.status === "Active" ? (
                                <button
                                  type="button"
                                  onClick={() => archiveOne(r.id, r.name)}
                                  className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                                  title="Archive"
                                >
                                  <Archive size={14} />
                                </button>
                              ) : null}
                            </div>
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
                {emptyMessage}
              </p>
            ) : (
              rows.map((r) => (
                <article
                  key={r.id}
                  className="rounded-[6px] border border-[#e5e7eb] bg-white p-3.5"
                >
                  <div className="flex items-start gap-2.5">
                    {canWriteAssetModels ? (
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[13px] font-medium text-[#1a1d23]">
                          {r.name}
                        </h3>
                        {statusBadge(r.status)}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[#6b7280]">
                        {r.categoryName}
                      </p>
                      <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                        {formatDateTime(r.updatedAt)} · {r.updatedBy}
                      </p>
                      {canWriteAssetModels ? (
                        <div className="mt-2 flex min-h-11 items-center gap-1">
                          <Link
                            href={editHrefWithReturn(
                              `/asset-models/${r.id}/edit`,
                              listPath
                            )}
                            className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </Link>
                          {r.status === "Active" ? (
                            <button
                              type="button"
                              onClick={() => archiveOne(r.id, r.name)}
                              className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                              title="Archive"
                            >
                              <Archive size={14} />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {!initialLoad ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#6b7280]">
          <p>
            Showing {from}–{to} of {total}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              Rows
              <select
                className="rounded-[6px] border border-[#e5e7eb] px-1.5 py-1"
                value={pageSize}
                onChange={(e) =>
                  replaceParams({ pageSize: Number(e.target.value), page: 1 })
                }
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => replaceParams({ page: page - 1 })}
              className="btn-touch rounded-[6px] border border-[#e5e7eb] px-2 py-1 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              {page}/{pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => replaceParams({ page: page + 1 })}
              className="btn-touch rounded-[6px] border border-[#e5e7eb] px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
      {dialog}
      <ImportDialog
        entity="asset-models"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => load()}
      />
    </div>
  );
}

export default function AssetModelsPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={7} rows={8} />}>
      <AssetModelsPageInner />
    </Suspense>
  );
}
