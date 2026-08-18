/** Shared list-table cells and sticky Actions column classes */

export const TABLE_CELL = "data-table-cell px-2 py-1.5";
export const TABLE_HEAD = "data-table-cell px-2 py-1.5 text-[12px] font-medium text-[#6b7280]";
export const STICKY_ACTIONS_HEAD =
  "no-print data-table-cell data-table-sticky-actions w-[1%] whitespace-nowrap px-2 py-1.5 text-[12px] font-medium text-[#6b7280]";
export const STICKY_ACTIONS_CELL =
  "no-print data-table-cell data-table-sticky-actions w-[1%] whitespace-nowrap px-2 py-1.5";

type TruncatedCellProps = {
  text: string;
  className?: string;
  maxWidth?: string;
};

export function TruncatedCell({
  text,
  className = "",
  maxWidth = "max-w-[10rem]",
}: TruncatedCellProps) {
  return (
    <td
      className={`${TABLE_CELL} truncate text-[#4b5563] ${maxWidth} ${className}`}
      title={text}
    >
      {text}
    </td>
  );
}

export function CompactUpdatedCell({
  at,
  by,
}: {
  at: string;
  by: string;
}) {
  return (
    <td className={`${TABLE_CELL} min-w-[8.5rem] whitespace-nowrap text-[#6b7280]`}>
      <div className="text-[12px] leading-tight">{at}</div>
      <div className="truncate text-[11px] leading-tight text-[#9ca3af]" title={by}>
        {by}
      </div>
    </td>
  );
}
