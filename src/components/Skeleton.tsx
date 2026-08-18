/** Subtle pulse placeholders matching the muted SaaS palette */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[4px] bg-[#e5e7eb]/80 ${className}`}
      aria-hidden
    />
  );
}

export function TableSkeleton({
  rows = 6,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-[6px] border border-[#e5e7eb] bg-white md:block">
        <div className="border-b border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-[#f3f4f6]">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-3 py-3">
              {Array.from({ length: cols }).map((_, c) => (
                <Skeleton
                  key={c}
                  className={`h-3 ${c === 0 ? "w-32" : c === cols - 1 ? "w-12" : "w-20"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <div
            key={i}
            className="rounded-[6px] border border-[#e5e7eb] bg-white p-3.5"
          >
            <Skeleton className="h-3.5 w-[60%] max-w-[200px]" />
            <Skeleton className="mt-2 h-3 w-[40%] max-w-[140px]" />
            <Skeleton className="mt-3 h-2.5 w-[50%] max-w-[160px]" />
          </div>
        ))}
      </div>
    </>
  );
}

export function FormSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true" aria-label="Loading form">
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-3 rounded-[6px] border border-[#e5e7eb] bg-white p-4">
        <Skeleton className="h-4 w-28" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="flex gap-2 rounded-[6px] border border-[#e5e7eb] bg-white p-4">
        <Skeleton className="h-11 w-24 md:h-9" />
        <Skeleton className="h-11 w-24 md:h-9" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-[6px] border border-[#e5e7eb] bg-white p-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="mt-3 h-7 w-14" />
      <Skeleton className="mt-2 h-3 w-36" />
    </div>
  );
}
