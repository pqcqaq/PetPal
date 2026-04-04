import {
  adoptLegacyPetPalMessageComposerSnapshot as adoptSharedPetPalMessageComposerSnapshot,
  buildPetPalMessageComposerStorageKey as buildSharedPetPalMessageComposerStorageKey,
  cloneManagedAttachmentRecords,
  clonePetPalMessageDraftState as cloneSharedPetPalMessageDraftState,
  compactPersistedPetPalMessageComposerRecords as compactSharedPersistedPetPalMessageComposerRecords,
  createPersistedPetPalMessageComposerCompactionOptions,
  createPersistedPetPalMessageComposerParseOptions,
  createEmptyPersistedPetPalMessageComposerRecords,
  getPetPalMessageComposerEntryWithLegacyAdoption,
  getPetPalMessageComposerKeysToClear,
  parsePersistedPetPalMessageComposerRecords as parseSharedPersistedPetPalMessageComposerRecords,
  parsePersistedPetPalMessageComposerSnapshot as parseSharedPersistedPetPalMessageComposerSnapshot,
  resolvePetPalMessageComposerIdentity,
  stripSharedPetPalMessageComposerRecord,
  type PetPalMessageComposerIdentity as SharedPetPalMessageComposerIdentity,
  type PetPalMessageComposerScope as SharedPetPalMessageComposerScope,
  type PetPalMessageComposerVersionedRecord,
  type PersistedPetPalMessageComposerRecords as SharedPersistedPetPalMessageComposerRecords,
  type PersistedPetPalMessageComposerSnapshot as SharedPersistedPetPalMessageComposerSnapshot,
  type PersistedPetPalMessageDraftRecord as SharedPersistedPetPalMessageDraftRecord,
  type PersistedPetPalMessageRecoveryRecord as SharedPersistedPetPalMessageRecoveryRecord,
  type ManagedAttachmentRecord,
  type PetPalMessageDraftState as SharedPetPalMessageDraftState,
  type PetPalMessageRecoveryStage as SharedPetPalMessageRecoveryStage,
  type PetPalMessageRecoveryState as SharedPetPalMessageRecoveryState,
} from '@rbac/api-common';
import { ref } from 'vue';

export type PetPalMessageDraftAttachment = ManagedAttachmentRecord;

export type PetPalMessageDraftState = SharedPetPalMessageDraftState;
export type PetPalMessageRecoveryStage = SharedPetPalMessageRecoveryStage;
export type PetPalMessageRecoveryState = SharedPetPalMessageRecoveryState;

export type PetPalMessageComposerScope = SharedPetPalMessageComposerScope;
export type PetPalMessageComposerIdentity = SharedPetPalMessageComposerIdentity;

export type PersistedPetPalMessageComposerSnapshot = SharedPersistedPetPalMessageComposerSnapshot;

type PersistedPetPalMessageDraftRecord = SharedPersistedPetPalMessageDraftRecord;

type PersistedPetPalMessageRecoveryRecord = SharedPersistedPetPalMessageRecoveryRecord;

type PersistedPetPalMessageComposerRecords = SharedPersistedPetPalMessageComposerRecords;

const STORAGE_KEY = 'petpal-message-composer-state-v1';

export const buildPetPalMessageComposerStorageKey = buildSharedPetPalMessageComposerStorageKey;

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  cloneManagedAttachmentRecords(attachments);

const cloneMessageDraftState = (draft: PetPalMessageDraftState): PetPalMessageDraftState =>
  cloneSharedPetPalMessageDraftState(draft);

export function parsePersistedPetPalMessageComposerSnapshot(
  rawValue: unknown,
  options: {
    now?: number;
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  return parseSharedPersistedPetPalMessageComposerSnapshot(
    rawValue,
    createPersistedPetPalMessageComposerParseOptions({
      now: options.now,
      fallbackDraftAttachmentUploadedAtToNow: true,
    }),
  );
}

export function adoptLegacyPetPalMessageComposerSnapshot(
  rawValue: unknown,
  identity: PetPalMessageComposerIdentity,
  options: {
    now?: number;
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  return adoptSharedPetPalMessageComposerSnapshot(
    rawValue,
    identity,
    createPersistedPetPalMessageComposerParseOptions({
      now: options.now,
      fallbackDraftAttachmentUploadedAtToNow: true,
    }),
  );
}

const getMessageComposerStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const parsePersistedPetPalMessageComposerStorageValue = (
  rawValue: unknown,
  now = Date.now(),
): PersistedPetPalMessageComposerRecords => {
  try {
    return parseSharedPersistedPetPalMessageComposerRecords(
      rawValue,
      createPersistedPetPalMessageComposerParseOptions({
        now,
        fallbackDraftAttachmentUploadedAtToNow: true,
      }),
    );
  } catch {
    return createEmptyPersistedPetPalMessageComposerRecords();
  }
};

const writePersistedPetPalMessageComposerSnapshot = (
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  snapshot: PersistedPetPalMessageComposerRecords,
) => {
  if (!Object.keys(snapshot.drafts).length && !Object.keys(snapshot.recoveries).length) {
    storage.removeItem(STORAGE_KEY);
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify({
    drafts: snapshot.drafts,
    recoveries: snapshot.recoveries,
  } satisfies PersistedPetPalMessageComposerRecords));
};

const readPersistedPetPalMessageComposerSnapshot = (): PersistedPetPalMessageComposerRecords => {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return createEmptyPersistedPetPalMessageComposerRecords();
  }

  return parsePersistedPetPalMessageComposerStorageValue(storage.getItem(STORAGE_KEY));
};

const persistedSnapshot = readPersistedPetPalMessageComposerSnapshot();

const messageDrafts = ref<Record<string, PersistedPetPalMessageDraftRecord>>(persistedSnapshot.drafts);
const messageRecoveries = ref<Record<string, PersistedPetPalMessageRecoveryRecord>>(persistedSnapshot.recoveries);

export function warmupPetPalMessageComposerPersistence(
  options: {
    now?: number;
  } = {},
) {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return;
  }

  try {
    const persistedSnapshot = parsePersistedPetPalMessageComposerStorageValue(
      storage.getItem(STORAGE_KEY),
      options.now,
    );
    messageDrafts.value = persistedSnapshot.drafts;
    messageRecoveries.value = persistedSnapshot.recoveries;
    writePersistedPetPalMessageComposerSnapshot(storage, persistedSnapshot);
  } catch {
    // Ignore storage quota or privacy-mode failures and keep runtime state usable.
  }
}

function syncPersistedPetPalMessageComposerSnapshot() {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return;
  }

  try {
    const compactedSnapshot = compactSharedPersistedPetPalMessageComposerRecords({
      drafts: messageDrafts.value,
      recoveries: messageRecoveries.value,
    }, createPersistedPetPalMessageComposerCompactionOptions());

    messageDrafts.value = compactedSnapshot.drafts;
    messageRecoveries.value = compactedSnapshot.recoveries;
    writePersistedPetPalMessageComposerSnapshot(storage, compactedSnapshot);
  } catch {
    // Ignore storage quota or privacy-mode failures and keep runtime state usable.
  }
}

warmupPetPalMessageComposerPersistence();

const getMessageComposerEntryForIdentity = <
  T extends PetPalMessageComposerVersionedRecord,
>(
  recordsRef: {
    value: Record<string, T>;
  },
  identity: PetPalMessageComposerIdentity,
): [string, T] | null => {
  const resolved = getPetPalMessageComposerEntryWithLegacyAdoption(recordsRef.value, identity);
  if (resolved.records !== recordsRef.value) {
    recordsRef.value = resolved.records;
    syncPersistedPetPalMessageComposerSnapshot();
  }
  return resolved.entry;
};

export function hasPetPalMessageDraft(identity: PetPalMessageComposerIdentity) {
  return Boolean(getMessageComposerEntryForIdentity(messageDrafts, identity));
}

export function restorePetPalMessageDraft(identity: PetPalMessageComposerIdentity) {
  const draftEntry = getMessageComposerEntryForIdentity(messageDrafts, identity);
  if (!draftEntry) {
    return null;
  }
  return cloneMessageDraftState(draftEntry[1]);
}

export function clearPetPalMessageDraft(identity: PetPalMessageComposerIdentity) {
  const keysToClear = getPetPalMessageComposerKeysToClear(messageDrafts.value, identity);
  if (!keysToClear.length) {
    return;
  }

  const nextDrafts = { ...messageDrafts.value };
  keysToClear.forEach((storageKey) => {
    delete nextDrafts[storageKey];
  });
  messageDrafts.value = nextDrafts;
  syncPersistedPetPalMessageComposerSnapshot();
}

export function getPetPalMessageComposerScope(identity: PetPalMessageComposerIdentity): PetPalMessageComposerScope | null {
  return getMessageComposerEntryForIdentity(messageDrafts, identity)?.[1].scope
    ?? getMessageComposerEntryForIdentity(messageRecoveries, identity)?.[1].scope
    ?? null;
}

export function persistPetPalMessageDraft(
  identity: PetPalMessageComposerIdentity,
  content: string,
  attachments: PetPalMessageDraftAttachment[],
) {
  const resolvedIdentity = resolvePetPalMessageComposerIdentity(
    identity,
    getPetPalMessageComposerScope(identity) ?? 'shared',
  );
  if (!resolvedIdentity) {
    return;
  }

  const nextAttachments = cloneMessageDraftAttachments(attachments);
  const hasDraft = content.trim().length > 0 || nextAttachments.length > 0;
  if (!hasDraft) {
    clearPetPalMessageDraft(resolvedIdentity);
    return;
  }

  messageDrafts.value = {
    ...stripSharedPetPalMessageComposerRecord(messageDrafts.value, resolvedIdentity),
    [buildPetPalMessageComposerStorageKey(resolvedIdentity)]: {
      orderId: resolvedIdentity.orderId,
      userId: resolvedIdentity.userId,
      content,
      attachments: nextAttachments,
      updatedAt: new Date().toISOString(),
      scope: resolvedIdentity.scope,
    },
  };
  syncPersistedPetPalMessageComposerSnapshot();
}

export function hasPetPalMessageRecovery(identity: PetPalMessageComposerIdentity) {
  return Boolean(getMessageComposerEntryForIdentity(messageRecoveries, identity));
}

export function getPetPalMessageRecovery(identity: PetPalMessageComposerIdentity) {
  const recoveryEntry = getMessageComposerEntryForIdentity(messageRecoveries, identity);
  if (!recoveryEntry) {
    return null;
  }
  const recovery = recoveryEntry[1];

  return {
    stage: recovery.stage,
    message: recovery.message,
  } satisfies PetPalMessageRecoveryState;
}

export function clearPetPalMessageRecovery(identity: PetPalMessageComposerIdentity) {
  const keysToClear = getPetPalMessageComposerKeysToClear(messageRecoveries.value, identity);
  if (!keysToClear.length) {
    return;
  }

  const nextRecoveries = { ...messageRecoveries.value };
  keysToClear.forEach((storageKey) => {
    delete nextRecoveries[storageKey];
  });
  messageRecoveries.value = nextRecoveries;
  syncPersistedPetPalMessageComposerSnapshot();
}

export function setPetPalMessageRecovery(
  identity: PetPalMessageComposerIdentity,
  stage: PetPalMessageRecoveryStage,
  message: string,
) {
  const resolvedIdentity = resolvePetPalMessageComposerIdentity(
    identity,
    getPetPalMessageComposerScope(identity) ?? 'shared',
  );
  if (!resolvedIdentity) {
    return;
  }

  messageRecoveries.value = {
    ...stripSharedPetPalMessageComposerRecord(messageRecoveries.value, resolvedIdentity),
    [buildPetPalMessageComposerStorageKey(resolvedIdentity)]: {
      orderId: resolvedIdentity.orderId,
      userId: resolvedIdentity.userId,
      stage,
      message,
      updatedAt: new Date().toISOString(),
      scope: resolvedIdentity.scope,
    },
  };
  syncPersistedPetPalMessageComposerSnapshot();
}
