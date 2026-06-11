/** Parse a display name into last + first for alphabetical sorting. */
export function parseNameForSort(displayName: string): { last: string; first: string } {
  const trimmed = displayName.trim();
  if (!trimmed) return { last: "", first: "" };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { last: parts[0] ?? "", first: "" };
  return {
    last: parts[parts.length - 1] ?? "",
    first: parts.slice(0, -1).join(" "),
  };
}

/** Sort key: last name, then first name (case-insensitive). */
export function compareLastFirstName(a: string, b: string): number {
  const pa = parseNameForSort(a);
  const pb = parseNameForSort(b);
  const lastCmp = pa.last.localeCompare(pb.last, undefined, { sensitivity: "base" });
  if (lastCmp !== 0) return lastCmp;
  return pa.first.localeCompare(pb.first, undefined, { sensitivity: "base" });
}

export function sortByLastFirstName<T>(
  items: readonly T[],
  getName: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => compareLastFirstName(getName(a), getName(b)));
}
