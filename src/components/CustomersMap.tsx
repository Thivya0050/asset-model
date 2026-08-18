"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type MapCustomer = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  latitude: number | null;
  longitude: number | null;
  assetCount: number;
  assetStats?: {
    total: number;
    inUse: number;
    inStorage: number;
    retired: number;
  };
};

function hasCoords(
  c: MapCustomer
): c is MapCustomer & { latitude: number; longitude: number } {
  return (
    c.latitude != null &&
    c.longitude != null &&
    Number.isFinite(c.latitude) &&
    Number.isFinite(c.longitude)
  );
}

function pinIcon(count: number, archived: boolean) {
  const bg = archived ? "#94a3b8" : "#4f46e5";
  const label = count > 99 ? "99+" : String(count);
  return L.divIcon({
    className: "customer-map-pin",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      min-width:28px;height:28px;padding:0 6px;
      border-radius:999px;background:${bg};color:#fff;
      font:600 11px/1 ui-sans-serif,system-ui,sans-serif;
      box-shadow:0 1px 4px rgba(26,29,35,.25);
      border:2px solid #fff;
    ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
  }, [map, points]);
  return null;
}

export function CustomersMap({ customers }: { customers: MapCustomer[] }) {
  const mapped = useMemo(() => customers.filter(hasCoords), [customers]);
  const unmapped = useMemo(
    () => customers.filter((c) => !hasCoords(c)),
    [customers]
  );
  const points = useMemo(
    () => mapped.map((c) => [c.latitude, c.longitude] as [number, number]),
    [mapped]
  );

  // Malaysia-ish default when nothing is plotted yet
  const defaultCenter: [number, number] = [4.2105, 101.9758];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white">
        <div className="relative h-[min(28rem,70vh)] w-full">
          <MapContainer
            center={defaultCenter}
            zoom={6}
            className="h-full w-full"
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} />
            {mapped.map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude, c.longitude]}
                icon={pinIcon(c.assetCount, c.status !== "Active")}
              >
                <Popup>
                  <div className="min-w-[11rem] space-y-2 p-0.5 font-[inherit] text-[13px] text-[#1a1d23]">
                    <div>
                      <p className="font-semibold leading-snug">{c.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#6b7280]">
                        {c.status === "Active" ? "Active" : "Archived"}
                      </p>
                    </div>
                    <div className="space-y-0.5 text-[12px] text-[#4b5563]">
                      <p>
                        <span className="font-medium text-[#1a1d23]">
                          {c.assetStats?.total ?? c.assetCount}
                        </span>{" "}
                        asset
                        {(c.assetStats?.total ?? c.assetCount) === 1
                          ? ""
                          : "s"}
                      </p>
                      <p>
                        In Use {c.assetStats?.inUse ?? 0} · In Storage{" "}
                        {c.assetStats?.inStorage ?? 0} · Retired{" "}
                        {c.assetStats?.retired ?? 0}
                      </p>
                    </div>
                    <Link
                      href={`/customers/${c.id}`}
                      className="inline-flex rounded-[6px] bg-[#4f46e5] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#4338ca]"
                    >
                      View Details
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {mapped.length === 0 ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
              <div className="rounded-[6px] border border-[#e5e7eb] bg-white/95 px-3 py-2 text-center text-[12px] text-[#4b5563] shadow-sm">
                No customers have coordinates yet. Locations will appear here
                once latitude and longitude are set.
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-[11px] text-[#6b7280]">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4f46e5] px-1 text-[10px] font-semibold text-white">
              n
            </span>
            Active — badge shows asset count
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#94a3b8] px-1 text-[10px] font-semibold text-white">
              n
            </span>
            Archived
          </span>
          <span className="ml-auto tabular-nums">
            {mapped.length} mapped · {unmapped.length} unmapped
          </span>
        </div>
      </div>

      {unmapped.length > 0 ? (
        <div className="rounded-[6px] border border-[#e5e7eb] bg-white">
          <div className="border-b border-[#e5e7eb] px-3 py-2">
            <h3 className="text-[13px] font-semibold text-[#1a1d23]">
              Unmapped locations
            </h3>
            <p className="mt-0.5 text-[12px] text-[#6b7280]">
              These customers have no latitude/longitude and are not shown on
              the map.
            </p>
          </div>
          <ul className="divide-y divide-[#f3f4f6]">
            {unmapped.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[13px]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/customers/${c.id}`}
                    className="font-medium text-[#1a1d23] hover:text-[#4f46e5] hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-[11px] text-[#9ca3af]">
                    {c.assetCount} asset{c.assetCount === 1 ? "" : "s"} ·{" "}
                    {c.status === "Active" ? "Active" : "Archived"}
                  </p>
                </div>
                <Link
                  href={`/customers/${c.id}`}
                  className="shrink-0 text-[12px] font-medium text-[#4f46e5] hover:underline"
                >
                  View Details
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
