import { warmupPetPalMessageComposerPersistence } from '../pages/frontend/petpal/message-composer-state';

let petPalStartupReady = false;

export function ensurePetPalStartup(
  options: {
    warmup?: () => void;
  } = {},
) {
  if (petPalStartupReady) {
    return false;
  }

  petPalStartupReady = true;
  (options.warmup ?? warmupPetPalMessageComposerPersistence)();
  return true;
}

export function resetPetPalStartupForTest() {
  petPalStartupReady = false;
}
