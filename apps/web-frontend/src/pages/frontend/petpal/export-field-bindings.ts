import { computed, type WritableComputedRef } from 'vue';

type PetPalFieldBindingOptions<T> = {
  get: () => T;
  set: (value: T) => void;
};

export const createPetPalFieldBinding = <T>(
  options: PetPalFieldBindingOptions<T>,
): WritableComputedRef<T> => computed({
  get: options.get,
  set: options.set,
});

export const createPetPalClearableFieldBinding = <T extends string>(
  options: PetPalFieldBindingOptions<T>,
): WritableComputedRef<T> => createPetPalFieldBinding<T>({
  get: options.get,
  set: (value) => {
    options.set((value || '') as T);
  },
});

export const createPetPalTrimmedTextFieldBinding = <T extends string>(
  options: PetPalFieldBindingOptions<T>,
): WritableComputedRef<string> => computed({
  get: () => options.get() || '',
  set: (value) => {
    options.set(value.trimStart() as T);
  },
});
