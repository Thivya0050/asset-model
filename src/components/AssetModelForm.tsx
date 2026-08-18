"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpTip } from "@/components/HelpTip";
import { BackLink } from "@/components/BackLink";
import { FormSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { usePermissions } from "@/hooks/usePermissions";

type Category = { id: string; name: string; code?: string; label?: string };
type ModelDetail = {
  id?: string;
  name: string;
  categoryTypeId: string;
  manufacturer: string;
  description: string;
  defaultWarrantyMonths: string;
  defaultStampingMonths: string;
  unitCost: string;
  imageUrl: string;
  attachmentUrl: string;
  status: "Active" | "Inactive";
  customerAssetCount?: number;
};

const EMPTY: ModelDetail = {
  name: "",
  categoryTypeId: "",
  manufacturer: "",
  description: "",
  defaultWarrantyMonths: "",
  defaultStampingMonths: "",
  unitCost: "",
  imageUrl: "",
  attachmentUrl: "",
  status: "Active",
};

const input =
  "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#4f46e5]";
const section =
  "space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4";

function useReturnHref(fallback: string) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return");
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function AssetModelFormInner({ modelId }: { modelId?: string }) {
  const router = useRouter();
  const listHref = useReturnHref("/asset-models");
  const { success, error: toastError } = useToast();
  const { canWriteAssetModels } = usePermissions();
  const isEdit = Boolean(modelId);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ModelDetail>(EMPTY);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    fetch("/api/category-types")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  useEffect(() => {
    if (!modelId) return;
    fetch(`/api/asset-models/${modelId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          toastError("Couldn't load this model.");
          setLoaded(true);
          return;
        }
        setForm({
          id: data.id,
          name: data.name ?? "",
          categoryTypeId: data.categoryTypeId ?? "",
          manufacturer: data.manufacturer ?? "",
          description: data.description ?? "",
          defaultWarrantyMonths:
            data.defaultWarrantyMonths != null
              ? String(data.defaultWarrantyMonths)
              : "",
          defaultStampingMonths:
            data.defaultStampingMonths != null
              ? String(data.defaultStampingMonths)
              : "",
          unitCost: data.unitCost != null ? String(data.unitCost) : "",
          imageUrl: data.imageUrl ?? "",
          attachmentUrl: data.attachmentUrl ?? "",
          status: data.status === "Inactive" ? "Inactive" : "Active",
          customerAssetCount: data.customerAssetCount ?? 0,
        });
        setLoaded(true);
      })
      .catch(() => {
        toastError("Couldn't load this model. Check your connection and try again.");
        setLoaded(true);
      });
  }, [modelId, toastError]);

  const set =
    (key: keyof ModelDetail) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const onFilePick =
    (field: "imageUrl" | "attachmentUrl") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setForm((f) => ({ ...f, [field]: file.name }));
    };

  const nameMissing = !form.name.trim();
  const categoryMissing = !form.categoryTypeId;
  const canSave = useMemo(
    () => Boolean(form.name.trim() && form.categoryTypeId),
    [form.name, form.categoryTypeId]
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWriteAssetModels) {
      toastError("You don't have permission to save models.");
      return;
    }
    setTriedSubmit(true);
    if (!canSave) {
      setError("Required fields are missing.");
      toastError("Couldn't save — check required fields and try again.");
      return;
    }
    setError("");
    setWarning("");
    setLoading(true);
    try {
      const res = await fetch(
        isEdit ? `/api/asset-models/${modelId}` : "/api/asset-models",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Couldn't save model. Try again.";
        setError(msg);
        toastError(msg);
        return;
      }
      if (data.duplicateWarning) {
        setWarning(
          "Saved. Another model with this name already exists in this category."
        );
        success(isEdit ? "Model updated" : "Model added");
        setTimeout(() => router.push(listHref), 1400);
        return;
      }
      success(isEdit ? "Model updated" : "Model added");
      setTimeout(() => router.push(listHref), 700);
    } catch {
      toastError("Couldn't save model. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    return <FormSkeleton />;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <div>
        <BackLink href="/asset-models" label="Back to Asset Models" />
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1a1d23]">
          {isEdit ? "Edit Asset Model" : "Add Asset Model"}
        </h2>
        {isEdit && form.name ? (
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Editing: {form.name}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            {isEdit
              ? "Update catalogue details for this model."
              : "Create a new model in the catalogue."}
          </p>
        )}
        {isEdit ? (
          <p className="mt-2 rounded-[6px] border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-[13px] text-[#4b5563]">
            Used by <strong>{form.customerAssetCount ?? 0}</strong> customer
            asset{(form.customerAssetCount ?? 0) === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      <section className={section}>
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">Basic Info</h3>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Name and category used for identification and filtering.
          </p>
        </div>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Model Name <span className="text-red-600">*</span>
          <HelpTip text="Brand, model number, and capacity in one field (e.g. DIGI SM5300X (P) (30KG))." />
          <input
            className={`${input} ${
              triedSubmit && nameMissing ? "border-red-400 bg-red-50" : ""
            }`}
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. DIGI SM5300X (P) (30KG)"
          />
          {triedSubmit && nameMissing ? (
            <p className="mt-1 text-[11px] text-red-600">This field is required</p>
          ) : null}
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Category <span className="text-red-600">*</span>
            <HelpTip text="Equipment group for this model." />
            <select
              className={`${input} ${
                triedSubmit && categoryMissing
                  ? "border-red-400 bg-red-50"
                  : ""
              }`}
              value={form.categoryTypeId}
              onChange={set("categoryTypeId")}
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label ?? (c.code ? `${c.name} (${c.code})` : c.name)}
                </option>
              ))}
            </select>
            {triedSubmit && categoryMissing ? (
              <p className="mt-1 text-[11px] text-red-600">This field is required</p>
            ) : null}
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Manufacturer
            <HelpTip text="Optional maker name." />
            <input
              className={input}
              value={form.manufacturer}
              onChange={set("manufacturer")}
            />
          </label>
        </div>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Description
          <textarea
            className={input}
            rows={3}
            value={form.description}
            onChange={set("description")}
          />
        </label>
        {isEdit ? (
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Status
            <HelpTip text="Active models can be selected for new customer assets. Archived models remain in history." />
            <select
              className={`${input} md:max-w-xs`}
              value={form.status}
              onChange={set("status")}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Archived</option>
            </select>
          </label>
        ) : null}
      </section>

      <section className={`${section} bg-[#fafafa]`}>
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">Defaults</h3>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Applied automatically when adding new units of this model.
          </p>
        </div>
        <div className="grid items-end gap-3 md:grid-cols-3">
          <label className="flex flex-col text-[12px] font-medium text-[#4b5563]">
            <span>
              Default Warranty (months)
              <HelpTip text="Default warranty period for new units." />
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={input}
              value={form.defaultWarrantyMonths}
              onChange={set("defaultWarrantyMonths")}
            />
          </label>
          <label className="flex flex-col text-[12px] font-medium text-[#4b5563]">
            <span>
              Default Stamping / Calibration (months)
              <HelpTip text="Default calibration interval (e.g. weighing scales)." />
            </span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className={input}
              value={form.defaultStampingMonths}
              onChange={set("defaultStampingMonths")}
            />
          </label>
          <label className="flex flex-col text-[12px] font-medium text-[#4b5563]">
            <span>
              Unit Cost
              <HelpTip text="Optional reference purchase cost." />
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className={input}
              value={form.unitCost}
              onChange={set("unitCost")}
            />
          </label>
        </div>
      </section>

      <section className={section}>
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">Media</h3>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Optional image or document reference (URL or filename).
          </p>
        </div>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Image URL
          <HelpTip text="Paste a URL, or choose a file to store its filename." />
          <input
            className={input}
            value={form.imageUrl}
            onChange={set("imageUrl")}
          />
        </label>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Image file
          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-[12px]"
            onChange={onFilePick("imageUrl")}
          />
        </label>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Attachment
          <HelpTip text="Optional datasheet or manual (URL or filename)." />
          <input
            className={input}
            value={form.attachmentUrl}
            onChange={set("attachmentUrl")}
          />
        </label>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Attachment file
          <input
            type="file"
            className="mt-1 block w-full text-[12px]"
            onChange={onFilePick("attachmentUrl")}
          />
        </label>
      </section>

      <div className="flex flex-wrap items-end gap-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {canWriteAssetModels ? (
            <button
              type="submit"
              disabled={loading}
              className="btn-touch rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca] disabled:opacity-50"
            >
              {loading ? "Saving…" : isEdit ? "Save" : "Add"}
            </button>
          ) : null}
          <Link
            href={listHref}
            className="btn-touch inline-flex items-center rounded-[6px] border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-medium text-[#4b5563] hover:bg-[#f9fafb]"
          >
            {canWriteAssetModels ? "Cancel" : "Back"}
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          {warning}
        </p>
      ) : null}
    </form>
  );
}

export function AssetModelForm({ modelId }: { modelId?: string }) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <AssetModelFormInner modelId={modelId} />
    </Suspense>
  );
}
