/**
 * Helpers for persisting list filters in the URL (shareable / bookmarkable).
 */

export function buildListQuery(
  entries: Record<string, string | number | undefined | null>
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function readParam(
  searchParams: URLSearchParams,
  key: string,
  fallback = ""
): string {
  return searchParams.get(key) ?? fallback;
}
