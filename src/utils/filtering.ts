export function normalizeFilterValues(values?: string | string[]): string[] | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = (Array.isArray(values) ? values : [values])
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

export function matchesPrefix(value: string, prefixes?: string[]): boolean {
  if (!prefixes || prefixes.length === 0) {
    return true;
  }

  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function filterRecordByPrefix<T>(
  values: Record<string, T>,
  prefixes?: string[],
): Record<string, T> {
  if (!prefixes || prefixes.length === 0) {
    return values;
  }

  return Object.fromEntries(
    Object.entries(values).filter(([key]) => matchesPrefix(key, prefixes)),
  );
}

export function stringifySearchValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function matchesSearchQuery(values: unknown[], query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return values.some((value) =>
    stringifySearchValue(value).toLowerCase().includes(normalizedQuery),
  );
}
