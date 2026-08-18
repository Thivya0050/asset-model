"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { HelpTip } from "@/components/HelpTip";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { TableSkeleton } from "@/components/Skeleton";
import { ImportDialog } from "@/components/ImportDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { Archive, List, Map as MapIcon, Pencil, Upload } from "lucide-react";
import type { MapCustomer } from "@/components/CustomersMap";

const CustomersMap = dynamic(
  () =>
    import("@/components/CustomersMap").then((m) => m.CustomersMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(28rem,70vh)] items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-white text-[13px] text-[#6b7280]">
        Loading map…
      </div>
    ),
  }
);

type Customer = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  latitude: number | null;
  longitude: number | null;
  assetCount: number;
  updatedAt: string;
  updatedBy: string;
  assetStats?: MapCustomer["assetStats"];
};

const input =
  "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#4f46e5]";
const btnPrimary =
  "btn-touch inline-flex items-center justify-center rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca] disabled:opacity-50";
const btnGhost =
  "btn-touch inline-flex items-center justify-center gap-1.5 rounded-[6px] border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb]";

type ViewMode = "list" | "map";

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const { confirm, dialog } = useConfirmDialog();
  const { success, error: toastError } = useToast();
  const { canWriteCustomers, canBulkImport } = usePermissions();

  const load = async () => {
    try {
      const data = await fetch("/api/customers?all=1&stats=1").then((r) =>
        r.json()
      );
      setRows(data ?? []);
    } catch {
      toastError("Couldn't load customers. Check your connection and try again.");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setEditId(null);
    setName("");
    setStatus("Active");
    setLatitude("");
    setLongitude("");
    setTriedSubmit(false);
    setError("");
  };

  const parseOptionalCoord = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWriteCustomers) return;
    setTriedSubmit(true);
    if (!name.trim()) {
      setError("Required fields are missing.");
      toastError("Couldn't save — check required fields and try again.");
      return;
    }
    const lat = parseOptionalCoord(latitude);
    const lng = parseOptionalCoord(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Latitude and longitude must be valid numbers, or left blank.");
      toastError("Couldn't save — check coordinates and try again.");
      return;
    }
    if ((lat == null) !== (lng == null)) {
      setError("Provide both latitude and longitude, or leave both blank.");
      toastError("Couldn't save — check coordinates and try again.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(
        editId ? `/api/customers/${editId}` : "/api/customers",
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            status,
            latitude: lat,
            longitude: lng,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Couldn't save customer. Try again.";
        setError(msg);
        toastError(msg);
        return;
      }
      success(editId ? "Customer updated" : "Customer added");
      resetForm();
      await load();
    } catch {
      toastError("Couldn't save customer. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: Customer) => {
    setEditId(row.id);
    setName(row.name);
    setStatus(row.status);
    setLatitude(row.latitude != null ? String(row.latitude) : "");
    setLongitude(row.longitude != null ? String(row.longitude) : "");
    setError("");
    setTriedSubmit(false);
    setView("list");
  };

  const restoreCustomer = async (id: string, rowName: string) => {
    try {
      const existing = await fetch(`/api/customers/${id}`).then((r) => r.json());
      if (existing.error) {
        toastError("Couldn't undo archive. Try again from Edit.");
        return;
      }
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: existing.name,
          status: "Active",
          latitude: existing.latitude,
          longitude: existing.longitude,
        }),
      });
      if (!res.ok) {
        toastError("Couldn't undo archive. Try again from Edit.");
        return;
      }
      success(`'${rowName}' restored`);
      await load();
    } catch {
      toastError("Couldn't undo archive. Check your connection and try again.");
    }
  };

  const archive = async (id: string, rowName: string) => {
    const ok = await confirm({
      title: "Archive customer?",
      message: `Archive '${rowName}'? It will be hidden from new selections but existing records stay linked.`,
      confirmLabel: "Archive",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toastError("Couldn't archive customer. Try again.");
        return;
      }
      success(`'${rowName}' archived`, {
        actionLabel: "Undo",
        onAction: () => restoreCustomer(id, rowName),
        durationMs: 6000,
      });
      await load();
    } catch {
      toastError("Couldn't archive customer. Check your connection and try again.");
    }
  };

  const statusBadge = (s: string) => (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
        s === "Active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {s === "Active" ? "Active" : "Archived"}
    </span>
  );

  const emptyText = canWriteCustomers
    ? "No customers yet. Add one above."
    : "No customers yet.";

  const viewToggle = (
    <div className="inline-flex rounded-[6px] border border-[#e5e7eb] bg-white p-0.5">
      <button
        type="button"
        onClick={() => setView("list")}
        className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12px] font-medium ${
          view === "list"
            ? "bg-[#4f46e5] text-white"
            : "text-[#4b5563] hover:bg-[#f9fafb]"
        }`}
        aria-pressed={view === "list"}
      >
        <List size={13} />
        List
      </button>
      <button
        type="button"
        onClick={() => setView("map")}
        className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1.5 text-[12px] font-medium ${
          view === "map"
            ? "bg-[#4f46e5] text-white"
            : "text-[#4b5563] hover:bg-[#f9fafb]"
        }`}
        aria-pressed={view === "map"}
      >
        <MapIcon size={13} />
        Map
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-[#1a1d23]">
            Customers
          </h2>
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Manage customer / site master records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewToggle}
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
      </div>

      {canWriteCustomers && view === "list" ? (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4"
        >
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">
            {editId ? "Edit Customer" : "Add Customer"}
          </h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-[12px] font-medium text-[#4b5563] md:col-span-2">
              Name <span className="text-red-600">*</span>
              <input
                className={`${input} ${
                  triedSubmit && !name.trim() ? "border-red-400 bg-red-50" : ""
                }`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AEON QUEENSBAY MALL"
              />
              {triedSubmit && !name.trim() ? (
                <p className="mt-1 text-[11px] text-red-600">This field is required</p>
              ) : null}
            </label>
            {editId ? (
              <label className="block text-[12px] font-medium text-[#4b5563]">
                Status
                <HelpTip text="Active customers can be selected for new customer assets." />
                <select
                  className={input}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "Active" | "Inactive")
                  }
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Archived</option>
                </select>
              </label>
            ) : null}
            <label className="block text-[12px] font-medium text-[#4b5563]">
              Latitude
              <HelpTip text="Optional map coordinate. Leave blank if unknown." />
              <input
                className={input}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 5.3321"
                inputMode="decimal"
              />
            </label>
            <label className="block text-[12px] font-medium text-[#4b5563]">
              Longitude
              <HelpTip text="Optional map coordinate. Leave blank if unknown." />
              <input
                className={input}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 100.3065"
                inputMode="decimal"
              />
            </label>
          </div>
          {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {editId ? "Save" : "Add"}
            </button>
            <button type="button" onClick={resetForm} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {listLoading ? (
        <TableSkeleton cols={5} />
      ) : view === "map" ? (
        <CustomersMap customers={rows} />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Name
                  </th>
                  <th className="px-3 py-2 text-right text-[12px] font-medium text-[#6b7280]">
                    Assets
                    <HelpTip text="Number of customer assets linked to this customer." />
                  </th>
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-[12px] font-medium text-[#6b7280]">
                    Updated
                  </th>
                  {canWriteCustomers ? (
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
                      colSpan={canWriteCustomers ? 5 : 4}
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
                        <Link
                          href={`/customers/${r.id}`}
                          className="hover:text-[#4f46e5] hover:underline"
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#4b5563]">
                        {r.assetCount}
                      </td>
                      <td className="px-3 py-2">{statusBadge(r.status)}</td>
                      <td className="px-3 py-2 text-[#6b7280]">
                        {formatDateTime(r.updatedAt)}
                        <div className="text-[11px] text-[#9ca3af]">
                          {r.updatedBy}
                        </div>
                      </td>
                      {canWriteCustomers ? (
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
                            {r.status === "Active" ? (
                              <button
                                type="button"
                                onClick={() => archive(r.id, r.name)}
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
                    <Link
                      href={`/customers/${r.id}`}
                      className="text-[13px] font-medium text-[#1a1d23] hover:text-[#4f46e5]"
                    >
                      {r.name}
                    </Link>
                    {statusBadge(r.status)}
                  </div>
                  <p className="mt-1 text-[12px] text-[#6b7280]">
                    {r.assetCount} asset{r.assetCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                    {formatDateTime(r.updatedAt)} · {r.updatedBy}
                  </p>
                  {canWriteCustomers ? (
                    <div className="mt-3 flex min-h-11 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="rounded-[4px] p-1 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1a1d23]"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      {r.status === "Active" ? (
                        <button
                          type="button"
                          onClick={() => archive(r.id, r.name)}
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
        entity="customers"
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
