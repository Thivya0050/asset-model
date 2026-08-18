"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

/**
 * Top-of-page back navigation for Add/Edit views.
 * Honors ?return=/path?filters when present (preserves list filters).
 */
export function BackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return");
  const target =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : href;

  return (
    <Link
      href={target}
      className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-[#6b7280] hover:text-[#1a1d23] md:min-h-0"
    >
      <ArrowLeft size={14} strokeWidth={1.75} />
      {label}
    </Link>
  );
}

/** Build an edit href that carries the current list URL for return navigation */
export function editHrefWithReturn(editPath: string, listPathWithQuery: string) {
  const q = listPathWithQuery.includes("?")
    ? listPathWithQuery.slice(listPathWithQuery.indexOf("?"))
    : "";
  if (!q || q === "?") return editPath;
  return `${editPath}?return=${encodeURIComponent(listPathWithQuery)}`;
}
