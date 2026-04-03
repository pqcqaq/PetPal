export const getSingleRouteQueryValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

export const hasAnyStringRouteQuery = (
  keys: ReadonlyArray<string>,
  query: Record<string, unknown>,
) => keys.some((key) => typeof query[key] === 'string');

export const parsePositiveIntegerRouteQuery = (
  value: unknown,
  fallback = 1,
) => {
  const parsed = Number.parseInt(getSingleRouteQueryValue(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const parseAllowedIntegerRouteQuery = (
  value: unknown,
  allowedValues: ReadonlyArray<number>,
  fallback: number,
) => {
  const parsed = Number.parseInt(getSingleRouteQueryValue(value), 10);
  return allowedValues.includes(parsed) ? parsed : fallback;
};

export const normalizeStringRouteQuery = (query: Record<string, unknown>) => Object.entries(query)
  .reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});

export const buildRouteQuerySnapshot = (query: Record<string, string>) => JSON.stringify(
  Object.entries(query).sort(([left], [right]) => left.localeCompare(right)),
);
