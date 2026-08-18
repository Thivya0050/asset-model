"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Building2, Tags, Wrench } from "lucide-react";
import { StatCardSkeleton } from "@/components/Skeleton";

type Bucket = { total: number; active: number; archived: number };
type AssetBucket = {
  total: number;
  inUse: number;
  inStorage: number;
  retired: number;
};

type Stats = {
  categories: Bucket;
  models: Bucket;
  customers: Bucket;
  customerAssets: AssetBucket;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: "Categories",
      href: "/category-types",
      icon: Tags,
      total: stats?.categories.total,
      sub:
        stats != null
          ? `${stats.categories.active} active · ${stats.categories.archived} archived`
          : "—",
    },
    {
      label: "Asset Models",
      href: "/asset-models",
      icon: Boxes,
      total: stats?.models.total,
      sub:
        stats != null
          ? `${stats.models.active} active · ${stats.models.archived} archived`
          : "—",
    },
    {
      label: "Customers",
      href: "/customers",
      icon: Building2,
      total: stats?.customers.total,
      sub:
        stats != null
          ? `${stats.customers.active} active · ${stats.customers.archived} archived`
          : "—",
    },
    {
      label: "Customer Assets",
      href: "/customer-assets",
      icon: Wrench,
      total: stats?.customerAssets.total,
      sub:
        stats != null
          ? `${stats.customerAssets.inUse} in use · ${stats.customerAssets.inStorage} in storage · ${stats.customerAssets.retired} retired`
          : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-[#1a1d23]">
          Dashboard
        </h2>
        <p className="mt-1 text-[13px] text-[#6b7280]">
          Overview of categories, models, customers, and customer assets.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : cards.map(({ label, href, icon: Icon, total, sub }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-[6px] border border-[#e5e7eb] bg-white p-4 transition-colors hover:border-[#c7c9d1]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      size={14}
                      strokeWidth={1.75}
                      className="text-[#9ca3af]"
                    />
                    <span className="text-[13px] font-medium text-[#4b5563]">
                      {label}
                    </span>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-[#d1d5db] transition-colors group-hover:text-[#6b7280]"
                  />
                </div>
                <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[#1a1d23]">
                  {total ?? "—"}
                </p>
                <p className="mt-2 text-[12px] text-[#6b7280]">{sub}</p>
              </Link>
            ))}
      </div>

      <div className="rounded-[6px] border border-[#e5e7eb] bg-white p-5">
        <h3 className="text-[14px] font-semibold text-[#1a1d23]">Structure</h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#6b7280]">
          Every asset model belongs to a category. Every customer asset
          references a model and a customer. Archiving a model or customer
          hides it from new entries; existing links remain intact.
        </p>
        <Link
          href="/asset-models"
          className="btn-touch mt-4 inline-flex items-center gap-1.5 rounded-[6px] bg-[#4f46e5] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca]"
        >
          Open Asset Models
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
