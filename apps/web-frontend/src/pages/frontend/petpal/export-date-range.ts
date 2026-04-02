export type PetPalExportDateRangeSnapshot = {
  startDate: string;
  endDate: string;
};

export const parsePetPalExportDate = (value: string) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parsePetPalExportDateRange = (
  snapshot: PetPalExportDateRangeSnapshot,
): [Date, Date] | null => {
  const startDate = parsePetPalExportDate(snapshot.startDate);
  const endDate = parsePetPalExportDate(snapshot.endDate);
  return startDate && endDate ? [startDate, endDate] : null;
};

export const serializePetPalExportDateRange = (
  value: [Date, Date] | null,
): PetPalExportDateRangeSnapshot => ({
  startDate: value?.[0]?.toISOString() ?? '',
  endDate: value?.[1]?.toISOString() ?? '',
});

export const withPetPalExportDateRange = <T extends PetPalExportDateRangeSnapshot>(
  snapshot: T,
  value: [Date, Date] | null,
): T => ({
  ...snapshot,
  ...serializePetPalExportDateRange(value),
});
