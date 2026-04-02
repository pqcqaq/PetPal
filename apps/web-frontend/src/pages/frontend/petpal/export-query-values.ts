export const toPetPalOptionalQueryValue = <T extends string | number>(
  value: T | '' | null | undefined,
): T | undefined => {
  if (value === '' || value == null) {
    return undefined;
  }
  return value;
};

export const toPetPalOptionalTrimmedQueryText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const toPetPalOptionalTrueFlag = (value: boolean): true | undefined => (
  value ? true : undefined
);
