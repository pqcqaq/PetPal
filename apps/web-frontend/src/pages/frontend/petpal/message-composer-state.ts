import { ref } from 'vue';

export type PetPalMessageDraftAttachment = {
  fileId: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

export type PetPalMessageDraftState = {
  content: string;
  attachments: PetPalMessageDraftAttachment[];
};

export type PetPalMessageRecoveryStage = 'upload' | 'send';

export type PetPalMessageRecoveryState = {
  stage: PetPalMessageRecoveryStage;
  message: string;
};

export type PersistedPetPalMessageComposerSnapshot = {
  drafts: Record<string, PetPalMessageDraftState>;
  recoveries: Record<string, PetPalMessageRecoveryState>;
};

const STORAGE_KEY = 'petpal-message-composer-state-v1';

const createEmptyPersistedSnapshot = (): PersistedPetPalMessageComposerSnapshot => ({
  drafts: {},
  recoveries: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  attachments.map((item) => ({
    fileId: item.fileId,
    url: item.url,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType,
  }));

const normalizePersistedValue = (rawValue: unknown) => {
  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return null;
  }
};

const toDraftAttachment = (rawValue: unknown): PetPalMessageDraftAttachment | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const { fileId, url, name, size, mimeType } = rawValue;
  if (
    typeof fileId !== 'string'
    || typeof url !== 'string'
    || typeof name !== 'string'
    || typeof mimeType !== 'string'
    || typeof size !== 'number'
    || !Number.isFinite(size)
    || size < 0
  ) {
    return null;
  }

  if (!fileId.trim() || !url.trim() || !name.trim() || !mimeType.trim()) {
    return null;
  }

  return {
    fileId,
    url,
    name,
    size,
    mimeType,
  };
};

const toDraftState = (rawValue: unknown): PetPalMessageDraftState | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const content = typeof rawValue.content === 'string' ? rawValue.content : '';
  const attachments = Array.isArray(rawValue.attachments)
    ? rawValue.attachments
      .map((item) => toDraftAttachment(item))
      .filter((item): item is PetPalMessageDraftAttachment => Boolean(item))
    : [];

  if (!content.trim() && !attachments.length) {
    return null;
  }

  return {
    content,
    attachments,
  };
};

const toRecoveryState = (rawValue: unknown): PetPalMessageRecoveryState | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const { stage, message } = rawValue;
  if ((stage !== 'upload' && stage !== 'send') || typeof message !== 'string' || !message.trim()) {
    return null;
  }

  return {
    stage,
    message,
  };
};

export function parsePersistedPetPalMessageComposerSnapshot(rawValue: unknown): PersistedPetPalMessageComposerSnapshot {
  const normalized = normalizePersistedValue(rawValue);
  if (!isRecord(normalized)) {
    return createEmptyPersistedSnapshot();
  }

  const rawDrafts = isRecord(normalized.drafts) ? normalized.drafts : {};
  const drafts = Object.fromEntries(
    Object.entries(rawDrafts).flatMap(([orderId, rawDraft]) => {
      if (!orderId.trim()) {
        return [];
      }

      const draft = toDraftState(rawDraft);
      return draft ? [[orderId, draft] as const] : [];
    }),
  );

  const rawRecoveries = isRecord(normalized.recoveries) ? normalized.recoveries : {};
  const recoveries = Object.fromEntries(
    Object.entries(rawRecoveries).flatMap(([orderId, rawRecovery]) => {
      if (!orderId.trim()) {
        return [];
      }

      const recovery = toRecoveryState(rawRecovery);
      return recovery ? [[orderId, recovery] as const] : [];
    }),
  );

  return {
    drafts,
    recoveries,
  };
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

const readPersistedPetPalMessageComposerSnapshot = (): PersistedPetPalMessageComposerSnapshot => {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return createEmptyPersistedSnapshot();
  }

  try {
    return parsePersistedPetPalMessageComposerSnapshot(storage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyPersistedSnapshot();
  }
};

const persistedSnapshot = readPersistedPetPalMessageComposerSnapshot();

const messageDrafts = ref<Record<string, PetPalMessageDraftState>>(persistedSnapshot.drafts);
const messageRecoveries = ref<Record<string, PetPalMessageRecoveryState>>(persistedSnapshot.recoveries);

function syncPersistedPetPalMessageComposerSnapshot() {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return;
  }

  try {
    if (!Object.keys(messageDrafts.value).length && !Object.keys(messageRecoveries.value).length) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify({
      drafts: messageDrafts.value,
      recoveries: messageRecoveries.value,
    } satisfies PersistedPetPalMessageComposerSnapshot));
  } catch {
    // Ignore storage quota or privacy-mode failures and keep runtime state usable.
  }
}

export function hasPetPalMessageDraft(orderId: string) {
  return Boolean(messageDrafts.value[orderId]);
}

export function restorePetPalMessageDraft(orderId: string) {
  const draft = messageDrafts.value[orderId];
  if (!draft) {
    return null;
  }
  return {
    content: draft.content,
    attachments: cloneMessageDraftAttachments(draft.attachments),
  } satisfies PetPalMessageDraftState;
}

export function clearPetPalMessageDraft(orderId: string) {
  if (!messageDrafts.value[orderId]) {
    return;
  }

  const nextDrafts = { ...messageDrafts.value };
  delete nextDrafts[orderId];
  messageDrafts.value = nextDrafts;
  syncPersistedPetPalMessageComposerSnapshot();
}

export function persistPetPalMessageDraft(
  orderId: string,
  content: string,
  attachments: PetPalMessageDraftAttachment[],
) {
  if (!orderId) {
    return;
  }

  const nextAttachments = cloneMessageDraftAttachments(attachments);
  const hasDraft = content.trim().length > 0 || nextAttachments.length > 0;
  if (!hasDraft) {
    clearPetPalMessageDraft(orderId);
    return;
  }

  messageDrafts.value = {
    ...messageDrafts.value,
    [orderId]: {
      content,
      attachments: nextAttachments,
    },
  };
  syncPersistedPetPalMessageComposerSnapshot();
}

export function hasPetPalMessageRecovery(orderId: string) {
  return Boolean(messageRecoveries.value[orderId]);
}

export function getPetPalMessageRecovery(orderId: string) {
  return messageRecoveries.value[orderId] ?? null;
}

export function clearPetPalMessageRecovery(orderId: string) {
  if (!messageRecoveries.value[orderId]) {
    return;
  }

  const nextRecoveries = { ...messageRecoveries.value };
  delete nextRecoveries[orderId];
  messageRecoveries.value = nextRecoveries;
  syncPersistedPetPalMessageComposerSnapshot();
}

export function setPetPalMessageRecovery(
  orderId: string,
  stage: PetPalMessageRecoveryStage,
  message: string,
) {
  if (!orderId) {
    return;
  }

  messageRecoveries.value = {
    ...messageRecoveries.value,
    [orderId]: {
      stage,
      message,
    },
  };
  syncPersistedPetPalMessageComposerSnapshot();
}
