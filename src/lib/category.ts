/**
 * Category display helpers — Name + Code stored separately,
 * shown together as "Name (CODE)" in dropdowns/labels.
 */

/** Parse "Weighing Scale (SCL)" → { name: "Weighing Scale", code: "SCL" } */
export function parseCategoryLabel(raw: string): {
  name: string;
  code: string;
} {
  const s = raw.trim();
  const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    return { name: m[1].trim(), code: m[2].trim() };
  }
  return { name: s, code: "" };
}

/** Format stored fields for UI: "Weighing Scale (SCL)" */
export function formatCategoryLabel(
  name: string,
  code?: string | null
): string {
  const n = (name ?? "").trim();
  const c = (code ?? "").trim();
  if (n && c) return `${n} (${c})`;
  return n || c || "";
}
