export const hasSelectOptionValue = <T extends string>(
  options: ReadonlyArray<{ value: T }>,
  value: string,
): value is T => options.some((item) => item.value === value);
