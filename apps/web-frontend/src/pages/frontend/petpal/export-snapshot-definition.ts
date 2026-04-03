import { clonePetPalExportSnapshot } from './export-snapshot-helpers';

export type PetPalExportSnapshotDefinition<T extends Record<string, unknown>> = {
  defaults: Readonly<T>;
  keys: ReadonlyArray<keyof T>;
  createEmpty: () => T;
};

export const definePetPalExportSnapshot = <T extends Record<string, unknown>>(
  defaults: T,
): PetPalExportSnapshotDefinition<T> => {
  const frozenDefaults = Object.freeze({ ...defaults }) as Readonly<T>;
  const keys = Object.freeze(Object.keys(frozenDefaults) as Array<keyof T>);
  return {
    defaults: frozenDefaults,
    keys,
    createEmpty: () => clonePetPalExportSnapshot(frozenDefaults, keys),
  };
};
