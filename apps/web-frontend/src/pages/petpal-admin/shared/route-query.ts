export const getSingleRouteQueryValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
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
