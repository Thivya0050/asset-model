"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { TableSkeleton } from "@/components/Skeleton";
import { formatDate, formatDateTime, lifecycleLabel } from "@/lib/format";
import {
  TABLE_CELL,
  TABLE_HEAD,
  TruncatedCell,
} from "@/components/ListTableCells";

type AssetRow = {
  id: string;
  serialNumber: string;
  assetStatus: string;
  warrantyExpiryDate: string | null;
  stampingExpiryDate: string | null;
  assetModel: { id: string; name: string };
  categoryType: { id: string; name: string };
};

type CustomerDetail = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
  updatedBy: string;
  assetStats: {
    total: number;
    inUse: number;
    inStorage: number;
    retired: number;
  };
  assets: AssetRow[];
};

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[6px] border border-[#e5e7eb] bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#9ca3af]">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#1a1d23]">
        {value}
      </p>
    </div>
  );
}

function CustomerDetailInner() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/customers/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error || "Customer not found");
          setData(null);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Couldn't load customer.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <BackLink href="/customers" label="Back to Customers" />
        <TableSkeleton cols={6} rows={5} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <BackLink href="/customers" label="Back to Customers" />
        <p className="rounded-[6px] border border-[#e5e7eb] bg-white p-6 text-center text-[13px] text-[#6b7280]">
          {error || "Customer not found"}
        </p>
      </div>
    );
  }

  const statusBadge =
    data.status === "Active" ? (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        Active
      </span>
    ) : (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
        Archived
      </span>
    );

  return (
    <div className="space-y-4">
      <BackLink href="/customers" label="Back to Customers" />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[#1a1d23]">
              {data.name}
            </h2>
            {statusBadge}
          </div>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            Updated {formatDateTime(data.updatedAt)} · {data.updatedBy}
          </p>
          {data.latitude != null && data.longitude != null ? (
            <p className="mt-0.5 text-[11px] tabular-nums text-[#9ca3af]">
              {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-[#9ca3af]">
              No map coordinates set
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Total Assets" value={data.assetStats.total} />
        <StatCard label="In Use" value={data.assetStats.inUse} />
        <StatCard label="In Storage" value={data.assetStats.inStorage} />
        <StatCard label="Retired" value={data.assetStats.retired} />
      </div>

      <div>
        <h3 className="mb-2 text-[14px] font-semibold text-[#1a1d23]">
          Customer Assets
        </h3>

        <div className="hidden overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white md:block">
          <div className="data-table-scroll">
            <table className="data-table w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
                  <th className={`${TABLE_HEAD} whitespace-nowrap`}>Serial</th>
                  <th className={TABLE_HEAD}>Model</th>
                  <th className={TABLE_HEAD}>Category</th>
                  <th className={`${TABLE_HEAD} whitespace-nowrap`}>Status</th>
                  <th className={`${TABLE_HEAD} whitespace-nowrap`}>
                    Warranty Expiry
                  </th>
                  <th className={`${TABLE_HEAD} whitespace-nowrap`}>
                    Stamping Expiry
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.assets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-2 py-10 text-center text-[13px] text-[#6b7280]"
                    >
                      No customer assets linked to this customer.
                    </td>
                  </tr>
                ) : (
                  data.assets.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#fafafa]"
                    >
                      <td
                        className={`${TABLE_CELL} max-w-[8rem] truncate font-mono text-[12px] text-[#1a1d23]`}
                        title={a.serialNumber}
                      >
                        <Link
                          href={`/customer-assets/${a.id}/edit`}
                          className="hover:text-[#4f46e5] hover:underline"
                        >
                          {a.serialNumber}
                        </Link>
                      </td>
                      <TruncatedCell
                        text={a.assetModel.name}
                        maxWidth="max-w-[9rem]"
                      />
                      <TruncatedCell
                        text={a.categoryType.name}
                        maxWidth="max-w-[8rem]"
                      />
                      <td
                        className={`${TABLE_CELL} whitespace-nowrap text-[#4b5563]`}
                      >
                        {lifecycleLabel(a.assetStatus)}
                      </td>
                      <td
                        className={`${TABLE_CELL} whitespace-nowrap text-[#4b5563]`}
                      >
                        {formatDate(a.warrantyExpiryDate)}
                      </td>
                      <td
                        className={`${TABLE_CELL} whitespace-nowrap text-[#4b5563]`}
                      >
                        {formatDate(a.stampingExpiryDate)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2 md:hidden">
          {data.assets.length === 0 ? (
            <p className="rounded-[6px] border border-[#e5e7eb] bg-white p-6 text-center text-[13px] text-[#6b7280]">
              No customer assets linked to this customer.
            </p>
          ) : (
            data.assets.map((a) => (
              <article
                key={a.id}
                className="rounded-[6px] border border-[#e5e7eb] bg-white p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/customer-assets/${a.id}/edit`}
                    className="font-mono text-[13px] font-medium text-[#1a1d23] hover:text-[#4f46e5]"
                  >
                    {a.serialNumber}
                  </Link>
                  <span className="text-[11px] font-medium text-[#6b7280]">
                    {lifecycleLabel(a.assetStatus)}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[#4b5563]">
                  {a.assetModel.name}
                </p>
                <p className="mt-0.5 text-[12px] text-[#6b7280]">
                  {a.categoryType.name}
                </p>
                <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                  Warranty {formatDate(a.warrantyExpiryDate)} · Stamping{" "}
                  {formatDate(a.stampingExpiryDate)}
                </p>
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<TableSkeleton cols={6} rows={5} />}>
      <CustomerDetailInner />
    </Suspense>
  );
}
