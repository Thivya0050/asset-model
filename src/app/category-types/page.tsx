"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { HelpTip } from "@/components/HelpTip";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";
import { ImportDialog } from "@/components/ImportDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { Archive, Pencil, Upload } from "lucide-react";

type Category = {
  id: string;
  name: string;
  code: string;
  label?: string;
  isActive: boolean;
  assetCount: number;
  updatedAt: string;
  updatedBy: string;
};

const input =
  "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#4f46e5]";
const btnPrimary =
  "btn-touch inline-flex items-center justify-center rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca] disabled:opacity-50";
const btnGhost =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb]";

export default function CategoryTypesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const { confirm, dialog } = useConfirmDialog();
  const { success, error: toastError } = useToast();
  const { canManageCategories, canBulkImport } = usePermissions();

  const load = async () => {
    try {
      const data = await fetch("/api/category-types?all=1").then((r) => r.json());
      setRows(data ?? []);
    } catch {
      toastError("Couldn't load categories. Check your connection and try again.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManageCategories) return;
    setTriedSubmit(true);
    if (!name.trim() || !code.trim()) {
      setError("Required fields are missing.");
      toastError("Couldn't save — check required fields and try again.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(
        editId ? `/api/category-types/${editId}` : "/api/category-types",
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, code }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Couldn't save category. Try again.";
        setError(msg);
        toastError(msg);
        return;
      }
      success(editId ? "Category updated" : "Category added");
      setName("");
      setCode("");
      setEditId(null);
      setTriedSubmit(false);
      await load();
    } catch {
      toastError("Couldn't save category. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: Category) => {
    setEditId(row.id);
    setName(row.name);
    setCode(row.code ?? "");
    setError("");
    setTriedSubmit(false);
  };

  const cancelEdit = () => {
    setEditId(null);
    setName("");
    setCode("");
    setError("");
    setTriedSubmit(false);
  };

  const archive = async (id: string, rowName: string, rowCode: string) => {
    const label = rowCode ? `${rowName} (${rowCode})` : rowName;
    const ok = await confirm({
      title: "Archive category?",
      message: `Archive '${label}'? It will be hidden from new selections but existing records stay linked.`,
      confirmLabel: "Archive",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/category-types/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toastError("Couldn't archive category. Try again.");
        return;
      }
      success(`'${label}' archived`);
      await load();
    } catch {
      toastError("Couldn't archive category. Check your connection and try again.");
    }
  };

  const statusBadge = (active: boolean) => (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Archived"}
    </span>
  );

  const emptyText = canManageCategories
    ? "No categories yet. Add one above."
    : "No categories yet.";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1a1d23]">
            Categories
          </h2>
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Manage equipment categories.
          </p>
        </div>
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
      </div>

      {canManageCategories ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4"
        >
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">
            {editId ? "Edit Category" : "Add Category"}
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-[12px] font-medium text-[#4b5563] md:col-span-2">
              Name <span className="text-red-600">*</span>
              <HelpTip text="Display name without the short code, e.g. Weighing Scale." />
              <input
                className={`${input} ${
                  triedSubmit && !name.trim() ? "border-red-400 bg-red-50" : ""
                }`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weighing Scale"
              />
              {triedSubmit && !name.trim() ? (
                <p className="mt-1 text-[11px] text-red-600">This field is required</p>
              ) : null}
            </label>
            <label className="block text-[12px] font-medium text-[#4b5563]">
              Code <span className="text-red-600">*</span>
              <HelpTip text="Short code, e.g. SCL. Shown in parentheses next to the name in dropdowns." />
              <input
                className={`${input} ${
                  triedSubmit && !code.trim() ? "border-red-400 bg-red-50" : ""
                }`}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SCL"
              />
              {triedSubmit && !code.trim() ? (
                <p className="mt-1 text-[11px] text-red-600">This field is required</p>
              ) : null}
            </label>
          </div>
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {editId ? "Save" : "Add"}
            </button>
            <button type="button" onClick={cancelEdit} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {listLoading ? (
        <TableSkeleton cols={6} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Name
                  </th>
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Code
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-medium text-[#6b7280]">
                    Models
                    <HelpTip text="Number of asset models in this category." />
                  </th>
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Updated
                  </th>
                  {canManageCategories ? (
                    <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageCategories ? 6 : 5}
                      className="px-3 py-10 text-center text-[13px] text-[#6b7280]"
                    >
                      {emptyText}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]"
                    >
                      <td className="px-3 py-2 font-medium text-[#1a1d23]">
                        {r.name}
                      </td>
                      <td className="px-3 py-2 font-mono text-[12px] text-[#4b5563]">
                        {r.code}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#4b5563]">
                        {r.assetCount}
                      </td>
                      <td className="px-3 py-2">{statusBadge(r.isActive)}</td>
                      <td className="px-3 py-2 text-[#6b7280]">
                        {formatDateTime(r.updatedAt)}
                        <div className="text-[11px] text-[#9ca3af]">
                          {r.updatedBy}
                        </div>
                      </td>
                      {canManageCategories ? (
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(r)}
                              className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            {r.isActive ? (
                              <button
                                type="button"
                                onClick={() => archive(r.id, r.name, r.code)}
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

          <div className="space-y-2 md:hidden">
            {rows.length === 0 ? (
              <p className="rounded-[6px] border border-[#e5e7eb] bg-white p-6 text-center text-[13px] text-[#6b7280]">
                {emptyText}
              </p>
            ) : (
              rows.map((r) => (
                <article
                  key={r.id}
                  className="rounded-[6px] border border-[#e5e7eb] bg-white p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[13px] font-medium text-[#1a1d23]">
                      {r.name}{" "}
                      <span className="font-mono text-[12px] text-[#6b7280]">
                        ({r.code})
                      </span>
                    </h3>
                    {statusBadge(r.isActive)}
                  </div>
                  <p className="mt-1 text-[12px] text-[#6b7280]">
                    {r.assetCount} model{r.assetCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                    {formatDateTime(r.updatedAt)} · {r.updatedBy}
                  </p>
                  {canManageCategories ? (
                    <div className="mt-3 flex min-h-11 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      {r.isActive ? (
                        <button
                          type="button"
                          onClick={() => archive(r.id, r.name, r.code)}
                          className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                          title="Archive"
                        >
                          <Archive size={14} />
                        </button>
                      ) : null}
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
        entity="categories"
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setListLoading(false);
          load();
        }}
      />
    </div>
  );
}
