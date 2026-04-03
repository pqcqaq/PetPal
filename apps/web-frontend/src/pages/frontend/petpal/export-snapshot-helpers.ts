export const clonePetPalExportSnapshot = <
  T extends Record<string, unknown>,
  K extends readonly (keyof T)[],
>(
  snapshot: Readonly<T>,
  keys: K,
): T => {
  const next = {} as T;
  for (const key of keys) {
    next[key] = snapshot[key];
  }
  return next;
};

export const applyPetPalExportSnapshot = <
  T extends Record<string, unknown>,
  K extends readonly (keyof T)[],
>(
  target: T,
  snapshot: Readonly<T>,
  keys: K,
): T => {
  for (const key of keys) {
    target[key] = snapshot[key];
  }
  return target;
};
