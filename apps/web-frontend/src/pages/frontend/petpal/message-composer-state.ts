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

export type PetPalMessageComposerScope = 'owner' | 'caregiver' | 'shared';

export type PersistedPetPalMessageComposerSnapshot = {
  drafts: Record<string, PetPalMessageDraftState>;
  recoveries: Record<string, PetPalMessageRecoveryState>;
};

type PersistedPetPalMessageDraftRecord = PetPalMessageDraftState & {
  updatedAt: string;
  scope: PetPalMessageComposerScope;
};

type PersistedPetPalMessageRecoveryRecord = PetPalMessageRecoveryState & {
  updatedAt: string;
  scope: PetPalMessageComposerScope;
};

type PersistedPetPalMessageComposerRecords = {
  drafts: Record<string, PersistedPetPalMessageDraftRecord>;
  recoveries: Record<string, PersistedPetPalMessageRecoveryRecord>;
};

const STORAGE_KEY = 'petpal-message-composer-state-v1';
const MAX_PERSISTED_THREADS = 12;
const MAX_PERSISTED_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const createEmptyPersistedSnapshot = (): PersistedPetPalMessageComposerRecords => ({
  drafts: {},
  recoveries: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeMessageComposerScope = (value: unknown): PetPalMessageComposerScope =>
  value === 'owner' || value === 'caregiver' ? value : 'shared';

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  attachments.map((item) => ({
    fileId: item.fileId,
    url: item.url,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType,
  }));

const cloneMessageDraftState = (draft: PetPalMessageDraftState): PetPalMessageDraftState => ({
  content: draft.content,
  attachments: cloneMessageDraftAttachments(draft.attachments),
});

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

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

const toDraftRecord = (
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageDraftRecord | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const draft = toDraftState(rawValue);
  if (!draft) {
    return null;
  }

  const updatedAt = typeof rawValue.updatedAt === 'string' && toTimestamp(rawValue.updatedAt)
    ? rawValue.updatedAt
    : fallbackUpdatedAt;

  return {
    ...cloneMessageDraftState(draft),
    updatedAt,
    scope: normalizeMessageComposerScope(rawValue.scope),
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

const toRecoveryRecord = (
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageRecoveryRecord | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const recovery = toRecoveryState(rawValue);
  if (!recovery) {
    return null;
  }

  const updatedAt = typeof rawValue.updatedAt === 'string' && toTimestamp(rawValue.updatedAt)
    ? rawValue.updatedAt
    : fallbackUpdatedAt;

  return {
    stage: recovery.stage,
    message: recovery.message,
    updatedAt,
    scope: normalizeMessageComposerScope(rawValue.scope),
  };
};

const compactPersistedPetPalMessageComposerRecords = (
  snapshot: PersistedPetPalMessageComposerRecords,
  now = Date.now(),
): PersistedPetPalMessageComposerRecords => {
  const orderTimestampsByScope = new Map<PetPalMessageComposerScope, Map<string, number>>();
  const collectTimestamp = (
    orderId: string,
    updatedAt: string,
    scope: PetPalMessageComposerScope,
  ) => {
    const timestamp = toTimestamp(updatedAt);
    if (timestamp === null) {
      return;
    }

    const scopedTimestamps = orderTimestampsByScope.get(scope) ?? new Map<string, number>();
    const previousTimestamp = scopedTimestamps.get(orderId);
    if (previousTimestamp === undefined || timestamp > previousTimestamp) {
      scopedTimestamps.set(orderId, timestamp);
      orderTimestampsByScope.set(scope, scopedTimestamps);
    }
  };

  Object.entries(snapshot.drafts).forEach(([orderId, draft]) => {
    collectTimestamp(orderId, draft.updatedAt, draft.scope);
  });
  Object.entries(snapshot.recoveries).forEach(([orderId, recovery]) => {
    collectTimestamp(orderId, recovery.updatedAt, recovery.scope);
  });

  const retainedOrderIdsByScope = new Map(
    Array.from(orderTimestampsByScope.entries()).map(([scope, orderTimestamps]) => [
      scope,
      new Set(
        Array.from(orderTimestamps.entries())
          .filter(([, timestamp]) => now - timestamp <= MAX_PERSISTED_AGE_MS)
          .sort((left, right) => right[1] - left[1])
          .slice(0, MAX_PERSISTED_THREADS)
          .map(([orderId]) => orderId),
      ),
    ] as const),
  );

  return {
    drafts: Object.fromEntries(
      Object.entries(snapshot.drafts)
        .filter(([orderId, draft]) => retainedOrderIdsByScope.get(draft.scope)?.has(orderId))
        .map(([orderId, draft]) => [
          orderId,
          {
            ...cloneMessageDraftState(draft),
            updatedAt: draft.updatedAt,
            scope: draft.scope,
          } satisfies PersistedPetPalMessageDraftRecord,
        ]),
    ),
    recoveries: Object.fromEntries(
      Object.entries(snapshot.recoveries)
        .filter(([orderId, recovery]) => retainedOrderIdsByScope.get(recovery.scope)?.has(orderId))
        .map(([orderId, recovery]) => [
          orderId,
          {
            stage: recovery.stage,
            message: recovery.message,
            updatedAt: recovery.updatedAt,
            scope: recovery.scope,
          } satisfies PersistedPetPalMessageRecoveryRecord,
        ]),
    ),
  };
};

const toPublicPersistedSnapshot = (
  snapshot: PersistedPetPalMessageComposerRecords,
): PersistedPetPalMessageComposerSnapshot => ({
  drafts: Object.fromEntries(
    Object.entries(snapshot.drafts).map(([orderId, draft]) => [
      orderId,
      cloneMessageDraftState(draft),
    ]),
  ),
  recoveries: Object.fromEntries(
    Object.entries(snapshot.recoveries).map(([orderId, recovery]) => [
      orderId,
      {
        stage: recovery.stage,
        message: recovery.message,
      } satisfies PetPalMessageRecoveryState,
    ]),
  ),
});

const parsePersistedPetPalMessageComposerRecords = (
  rawValue: unknown,
  now = Date.now(),
): PersistedPetPalMessageComposerRecords => {
  const normalized = normalizePersistedValue(rawValue);
  if (!isRecord(normalized)) {
    return createEmptyPersistedSnapshot();
  }

  const fallbackUpdatedAt = new Date(now).toISOString();
  const rawDrafts = isRecord(normalized.drafts) ? normalized.drafts : {};
  const drafts = Object.fromEntries(
    Object.entries(rawDrafts).flatMap(([orderId, rawDraft]) => {
      if (!orderId.trim()) {
        return [];
      }

      const draft = toDraftRecord(rawDraft, fallbackUpdatedAt);
      return draft ? [[orderId, draft] as const] : [];
    }),
  );

  const rawRecoveries = isRecord(normalized.recoveries) ? normalized.recoveries : {};
  const recoveries = Object.fromEntries(
    Object.entries(rawRecoveries).flatMap(([orderId, rawRecovery]) => {
      if (!orderId.trim()) {
        return [];
      }

      const recovery = toRecoveryRecord(rawRecovery, fallbackUpdatedAt);
      return recovery ? [[orderId, recovery] as const] : [];
    }),
  );

  return compactPersistedPetPalMessageComposerRecords({
    drafts,
    recoveries,
  }, now);
};

export function parsePersistedPetPalMessageComposerSnapshot(
  rawValue: unknown,
  options: {
    now?: number;
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  return toPublicPersistedSnapshot(
    parsePersistedPetPalMessageComposerRecords(rawValue, options.now),
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

const readPersistedPetPalMessageComposerSnapshot = (): PersistedPetPalMessageComposerRecords => {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return createEmptyPersistedSnapshot();
  }

  try {
    return parsePersistedPetPalMessageComposerRecords(storage.getItem(STORAGE_KEY));
  } catch {
    return createEmptyPersistedSnapshot();
  }
};

const persistedSnapshot = readPersistedPetPalMessageComposerSnapshot();

const messageDrafts = ref<Record<string, PersistedPetPalMessageDraftRecord>>(persistedSnapshot.drafts);
const messageRecoveries = ref<Record<string, PersistedPetPalMessageRecoveryRecord>>(persistedSnapshot.recoveries);

function syncPersistedPetPalMessageComposerSnapshot() {
  const storage = getMessageComposerStorage();
  if (!storage) {
    return;
  }

  try {
    const compactedSnapshot = compactPersistedPetPalMessageComposerRecords({
      drafts: messageDrafts.value,
      recoveries: messageRecoveries.value,
    });

    messageDrafts.value = compactedSnapshot.drafts;
    messageRecoveries.value = compactedSnapshot.recoveries;

    if (!Object.keys(compactedSnapshot.drafts).length && !Object.keys(compactedSnapshot.recoveries).length) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify({
      drafts: compactedSnapshot.drafts,
      recoveries: compactedSnapshot.recoveries,
    } satisfies PersistedPetPalMessageComposerRecords));
  } catch {
    // Ignore storage quota or privacy-mode failures and keep runtime state usable.
  }
}

syncPersistedPetPalMessageComposerSnapshot();

export function hasPetPalMessageDraft(orderId: string) {
  return Boolean(messageDrafts.value[orderId]);
}

export function restorePetPalMessageDraft(orderId: string) {
  const draft = messageDrafts.value[orderId];
  if (!draft) {
    return null;
  }
  return cloneMessageDraftState(draft);
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

export function getPetPalMessageComposerScope(orderId: string): PetPalMessageComposerScope | null {
  return messageDrafts.value[orderId]?.scope
    ?? messageRecoveries.value[orderId]?.scope
    ?? null;
}

export function persistPetPalMessageDraft(
  orderId: string,
  content: string,
  attachments: PetPalMessageDraftAttachment[],
  scope?: PetPalMessageComposerScope,
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
      updatedAt: new Date().toISOString(),
      scope: scope ?? getPetPalMessageComposerScope(orderId) ?? 'shared',
    },
  };
  syncPersistedPetPalMessageComposerSnapshot();
}

export function hasPetPalMessageRecovery(orderId: string) {
  return Boolean(messageRecoveries.value[orderId]);
}

export function getPetPalMessageRecovery(orderId: string) {
  const recovery = messageRecoveries.value[orderId];
  if (!recovery) {
    return null;
  }

  return {
    stage: recovery.stage,
    message: recovery.message,
  } satisfies PetPalMessageRecoveryState;
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
  scope?: PetPalMessageComposerScope,
) {
  if (!orderId) {
    return;
  }

  messageRecoveries.value = {
    ...messageRecoveries.value,
    [orderId]: {
      stage,
      message,
      updatedAt: new Date().toISOString(),
      scope: scope ?? getPetPalMessageComposerScope(orderId) ?? 'shared',
    },
  };
  syncPersistedPetPalMessageComposerSnapshot();
}
