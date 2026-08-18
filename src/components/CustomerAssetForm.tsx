"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpTip } from "@/components/HelpTip";
import { BackLink } from "@/components/BackLink";
import { FormSkeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { usePermissions } from "@/hooks/usePermissions";
import { toDateInputValue } from "@/lib/format";

type Option = { id: string; name: string; categoryTypeId?: string };
type FormState = {
  serialNumber: string;
  assetModelId: string;
  customerId: string;
  assetStatus: string;
  warrantyExpiryDate: string;
  stampingExpiryDate: string;
};

const input =
  "mt-1 w-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#4f46e5]";
const section =
  "space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4";

const EMPTY: FormState = {
  serialNumber: "",
  assetModelId: "",
  customerId: "",
  assetStatus: "In Use",
  warrantyExpiryDate: "",
  stampingExpiryDate: "",
};

function useReturnHref(fallback: string) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return");
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function CustomerAssetFormInner({ assetId }: { assetId?: string }) {
  const router = useRouter();
  const listHref = useReturnHref("/customer-assets");
  const { success, error: toastError } = useToast();
  const { canWriteCustomerAssets } = usePermissions();
  const isEdit = Boolean(assetId);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [models, setModels] = useState<Option[]>([]);
  const [customers, setCustomers] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    Promise.all([
      fetch("/api/asset-models?status=Active&pageSize=100").then((r) =>
        r.json()
      ),
      fetch("/api/customers").then((r) => r.json()),
    ]).then(([modelRes, customerRows]) => {
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
        (customerRows ?? []).map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
      );
    });
  }, []);

  useEffect(() => {
    if (!assetId) return;
    fetch(`/api/customer-assets/${assetId}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (data.error) {
          setError(data.error);
          toastError("Couldn't load this customer asset.");
          setLoaded(true);
          return;
        }
        setModels((prev) => {
          if (prev.some((m) => m.id === data.assetModelId)) return prev;
          return [
            ...prev,
            {
              id: data.assetModel.id,
              name: `${data.assetModel.name} (archived)`,
              categoryTypeId: data.categoryTypeId,
            },
          ];
        });
        setCustomers((prev) => {
          if (prev.some((c) => c.id === data.customerId)) return prev;
          return [
            ...prev,
            {
              id: data.customer.id,
              name: `${data.customer.name} (archived)`,
            },
          ];
        });
        const statusLabel =
          data.assetStatus === "InStorage"
            ? "In Storage"
            : data.assetStatus === "Retired"
              ? "Retired"
              : "In Use";
        setForm({
          serialNumber: data.serialNumber ?? "",
          assetModelId: data.assetModelId ?? "",
          customerId: data.customerId ?? "",
          assetStatus: statusLabel,
          warrantyExpiryDate: toDateInputValue(data.warrantyExpiryDate),
          stampingExpiryDate: toDateInputValue(data.stampingExpiryDate),
        });
        setLoaded(true);
      })
      .catch(() => {
        toastError(
          "Couldn't load this customer asset. Check your connection and try again."
        );
        setLoaded(true);
      });
  }, [assetId, toastError]);

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const canSave = useMemo(
    () =>
      Boolean(
        form.serialNumber.trim() && form.assetModelId && form.customerId
      ),
    [form]
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canWriteCustomerAssets) {
      toastError("You don't have permission to save customer assets.");
      return;
    }
    setTriedSubmit(true);
    if (!canSave) {
      setError("Required fields are missing.");
      toastError("Couldn't save — check required fields and try again.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        isEdit ? `/api/customer-assets/${assetId}` : "/api/customer-assets",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Couldn't save customer asset. Try again.";
        setError(msg);
        toastError(msg);
        return;
      }
      success(isEdit ? "Customer asset updated" : "Customer asset added");
      setTimeout(() => router.push(listHref), 700);
    } catch {
      toastError(
        "Couldn't save customer asset. Check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    return <FormSkeleton />;
  }

  const serialMissing = triedSubmit && !form.serialNumber.trim();
  const modelMissing = triedSubmit && !form.assetModelId;
  const customerMissing = triedSubmit && !form.customerId;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <div>
        <BackLink href="/customer-assets" label="Back to Customer Assets" />
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#1a1d23]">
          {isEdit ? "Edit Customer Asset" : "Add Customer Asset"}
        </h2>
        {isEdit && form.serialNumber ? (
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Editing: {form.serialNumber}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-[#6b7280]">
            Link a physical unit to a catalogue model and customer site.
          </p>
        )}
      </div>

      <section className={section}>
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">
            Identification
          </h3>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Serial, model, and customer. Only active models and customers are
            selectable for new records.
          </p>
        </div>
        <label className="block text-[12px] font-medium text-[#4b5563]">
          Serial Number <span className="text-red-600">*</span>
          <HelpTip text="Unique identifier on the physical unit." />
          <input
            className={`${input} ${
              serialMissing ? "border-red-400 bg-red-50" : ""
            }`}
            value={form.serialNumber}
            onChange={set("serialNumber")}
          />
          {serialMissing ? (
            <p className="mt-1 text-[11px] text-red-600">This field is required</p>
          ) : null}
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Asset Model <span className="text-red-600">*</span>
            <HelpTip text="Catalogue model this unit belongs to." />
            <select
              className={`${input} ${
                modelMissing ? "border-red-400 bg-red-50" : ""
              }`}
              value={form.assetModelId}
              onChange={set("assetModelId")}
            >
              <option value="">Select…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {modelMissing ? (
              <p className="mt-1 text-[11px] text-red-600">This field is required</p>
            ) : null}
          </label>
          <label className="block text-[12px] font-medium text-[#4b5563]">
            Customer <span className="text-red-600">*</span>
            <HelpTip text="Customer / site master record." />
            <select
              className={`${input} ${
                customerMissing ? "border-red-400 bg-red-50" : ""
              }`}
              value={form.customerId}
              onChange={set("customerId")}
            >
              <option value="">Select…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {customerMissing ? (
              <p className="mt-1 text-[11px] text-red-600">This field is required</p>
            ) : null}
          </label>
        </div>
      </section>

      <section className={`${section} bg-[#fafafa]`}>
        <div>
          <h3 className="text-[14px] font-semibold text-[#1a1d23]">
            Status &amp; Dates
          </h3>
          <p className="mt-0.5 text-[12px] text-[#6b7280]">
            Lifecycle status and optional warranty / stamping expiry dates.
          </p>
        </div>
        <div className="grid items-end gap-3 md:grid-cols-3">
          <label className="flex flex-col text-[12px] font-medium text-[#4b5563]">
            <span>
              Asset Status
              <HelpTip text="Current lifecycle state of the unit." />
            </span>
            <select
              className={input}
              value={form.assetStatus}
              onChange={set("assetStatus")}
            >
              <option>In Use</option>
              <option>In Storage</option>
              <option>Retired</option>
            </select>
          </label>
          <label className="flex flex-col text-[12px] font-medium text-[#4b5563]">
            <span>
              Warranty Expiry Date
              <HelpTip text="Date warranty coverage ends for this unit." />
            </span>
            <input
              type="date"
              className={input}
              value={form.warrantyExpiryDate}
              onChange={set("warrantyExpiryDate")}
            />
          </label>
          <label className="flex flex-col text-[12px] font-medium text-[#4b5563]">
            <span>
              Stamping Expiry Date
              <HelpTip text="Date stamping / calibration is due." />
            </span>
            <input
              type="date"
              className={input}
              value={form.stampingExpiryDate}
              onChange={set("stampingExpiryDate")}
            />
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {canWriteCustomerAssets ? (
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
            {canWriteCustomerAssets ? "Cancel" : "Back"}
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function CustomerAssetForm({ assetId }: { assetId?: string }) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <CustomerAssetFormInner assetId={assetId} />
    </Suspense>
  );
}
