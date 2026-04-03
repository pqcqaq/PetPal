export type PetPalFilterPresenceValue = string | number | boolean | null | undefined;

export const hasPetPalFilterValue = (value: PetPalFilterPresenceValue): boolean => {
  if (typeof value === 'string') {
    return Boolean(value.trim());
  }
  if (typeof value === 'number') {
    return !Number.isNaN(value);
  }
  return Boolean(value);
};

export const hasPetPalActiveFilters = (...values: PetPalFilterPresenceValue[]): boolean => (
  values.some((value) => hasPetPalFilterValue(value))
);
