import type {
  PetPalMessageComposerIdentity,
  PetPalMessageComposerScope,
  PetPalMessageDraftAttachment,
  PetPalMessageDraftState,
  PersistedPetPalMessageComposerSnapshot,
  PetPalMessageRecoveryState,
} from '../types/petpal';
import {
  cloneManagedAttachmentRecords,
  parseManagedAttachmentRecord,
  type ParseManagedAttachmentRecordOptions,
} from './managed-attachments';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export type ResolvedPetPalMessageComposerIdentity = {
  orderId: string;
  userId: string;
  scope: PetPalMessageComposerScope;
};

export type PetPalMessageComposerLookupIdentity = {
  orderId: string;
  userId: string;
  scope?: PetPalMessageComposerScope;
};

export type PetPalMessageComposerScopedRecord = {
  orderId: string;
  userId: string;
  scope: PetPalMessageComposerScope;
};

export type PetPalMessageComposerVersionedRecord = PetPalMessageComposerScopedRecord & {
  updatedAt: string;
};

export type PersistedPetPalMessageDraftRecord = PetPalMessageDraftState & PetPalMessageComposerVersionedRecord;
export type PersistedPetPalMessageRecoveryRecord = PetPalMessageRecoveryState & PetPalMessageComposerVersionedRecord;

export type PersistedPetPalMessageComposerRecords = {
  drafts: Record<string, PersistedPetPalMessageDraftRecord>;
  recoveries: Record<string, PersistedPetPalMessageRecoveryRecord>;
};

export type CompactPersistedPetPalMessageComposerOptions = {
  maxPersistedThreads: number;
  maxPersistedAgeMs: number;
  maxLegacyAnonymousPersistedAgeMs: number;
  now?: number;
};

export type ParsePersistedPetPalMessageComposerOptions = CompactPersistedPetPalMessageComposerOptions & {
  fallbackDraftAttachmentUploadedAtToNow?: boolean;
};

export const PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_PREFIX = 'petpal-message-composer';
export const PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR = '::';
export const PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_THREADS = 12;
export const PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000;

const normalizeMessageComposerScope = (value: unknown): PetPalMessageComposerScope =>
  value === 'owner' || value === 'caregiver' ? value : 'shared';

const normalizeMessageComposerOrderId = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const normalizeMessageComposerUserId = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

export const resolvePetPalMessageComposerLookupIdentity = (
  identity: PetPalMessageComposerIdentity,
): PetPalMessageComposerLookupIdentity | null => {
  const orderId = normalizeMessageComposerOrderId(identity.orderId);
  const userId = normalizeMessageComposerUserId(identity.userId);
  if (!orderId || !userId) {
    return null;
  }

  return identity.scope
    ? {
        orderId,
        userId,
        scope: normalizeMessageComposerScope(identity.scope),
      }
    : {
        orderId,
        userId,
      };
};

export const resolvePetPalMessageComposerIdentity = (
  identity: PetPalMessageComposerIdentity,
  fallbackScope: PetPalMessageComposerScope = 'shared',
): ResolvedPetPalMessageComposerIdentity | null => {
  const lookupIdentity = resolvePetPalMessageComposerLookupIdentity(identity);
  if (!lookupIdentity) {
    return null;
  }

  return {
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: lookupIdentity.scope ?? fallbackScope,
  };
};

export const buildPetPalMessageComposerStorageKey = (
  identity: {
    orderId: string;
    userId: string;
    scope: PetPalMessageComposerScope;
  },
) => [
  PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_PREFIX,
  `order=${encodeURIComponent(identity.orderId)}`,
  `scope=${identity.scope}`,
  `user=${encodeURIComponent(identity.userId)}`,
].join(PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR);

export const parsePetPalMessageComposerStorageKey = (
  storageKey: string,
): ResolvedPetPalMessageComposerIdentity | null => {
  const segments = storageKey.split(PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR);
  if (segments.length !== 4 || segments[0] !== PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_PREFIX) {
    return null;
  }

  const orderId = segments[1]?.startsWith('order=')
    ? decodeURIComponent(segments[1].slice('order='.length))
    : '';
  const scope = segments[2]?.startsWith('scope=')
    ? normalizeMessageComposerScope(segments[2].slice('scope='.length))
    : 'shared';
  const userId = segments[3]?.startsWith('user=')
    ? decodeURIComponent(segments[3].slice('user='.length))
    : '';

  const normalizedOrderId = normalizeMessageComposerOrderId(orderId);
  if (!normalizedOrderId) {
    return null;
  }

  return {
    orderId: normalizedOrderId,
    userId: typeof userId === 'string' ? userId : '',
    scope,
  };
};

export const resolvePersistedPetPalMessageComposerIdentity = (
  storageKey: string,
  rawValue: Record<string, unknown>,
  fallbackScope: PetPalMessageComposerScope = 'shared',
): ResolvedPetPalMessageComposerIdentity | null => {
  const parsedIdentity = parsePetPalMessageComposerStorageKey(storageKey);
  const orderId = normalizeMessageComposerOrderId(rawValue.orderId)
    || parsedIdentity?.orderId
    || normalizeMessageComposerOrderId(storageKey);
  if (!orderId) {
    return null;
  }

  return {
    orderId,
    userId: normalizeMessageComposerUserId(rawValue.userId) || parsedIdentity?.userId || '',
    scope: rawValue.scope !== undefined
      ? normalizeMessageComposerScope(rawValue.scope)
      : parsedIdentity?.scope ?? fallbackScope,
  };
};

export const matchesPetPalMessageComposerLookup = <
  T extends PetPalMessageComposerScopedRecord,
>(
  record: T,
  identity: PetPalMessageComposerLookupIdentity,
) =>
  record.orderId === identity.orderId
  && record.userId === identity.userId
  && (!identity.scope || record.scope === identity.scope);

export const getLatestPetPalMessageComposerEntry = <
  T extends PetPalMessageComposerVersionedRecord,
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerLookupIdentity,
): [string, T] | null => {
  const matchingEntries = Object.entries(records).filter(([, record]) =>
    matchesPetPalMessageComposerLookup(record, identity));
  if (!matchingEntries.length) {
    return null;
  }

  return matchingEntries.sort((left, right) =>
    (toTimestamp(right[1].updatedAt) ?? 0) - (toTimestamp(left[1].updatedAt) ?? 0))[0] ?? null;
};

export const getPetPalMessageComposerEntry = <
  T extends PetPalMessageComposerVersionedRecord,
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerIdentity,
): [string, T] | null => {
  const lookupIdentity = resolvePetPalMessageComposerLookupIdentity(identity);
  if (!lookupIdentity) {
    return null;
  }

  if (!lookupIdentity.scope) {
    return getLatestPetPalMessageComposerEntry(records, lookupIdentity);
  }

  const exactKey = buildPetPalMessageComposerStorageKey({
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: lookupIdentity.scope,
  });
  const exactRecord = records[exactKey];
  if (exactRecord && matchesPetPalMessageComposerLookup(exactRecord, lookupIdentity)) {
    return [exactKey, exactRecord];
  }

  if (lookupIdentity.scope === 'shared') {
    return null;
  }

  const sharedKey = buildPetPalMessageComposerStorageKey({
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: 'shared',
  });
  const sharedRecord = records[sharedKey];
  if (sharedRecord && matchesPetPalMessageComposerLookup(sharedRecord, {
    ...lookupIdentity,
    scope: 'shared',
  })) {
    return [sharedKey, sharedRecord];
  }

  return null;
};

export const stripSharedPetPalMessageComposerRecord = <
  T extends PetPalMessageComposerScopedRecord,
>(
  records: Record<string, T>,
  identity: ResolvedPetPalMessageComposerIdentity,
) => {
  if (identity.scope === 'shared') {
    return records;
  }

  const sharedKey = buildPetPalMessageComposerStorageKey({
    orderId: identity.orderId,
    userId: identity.userId,
    scope: 'shared',
  });
  if (!records[sharedKey]) {
    return records;
  }

  const nextRecords = { ...records };
  delete nextRecords[sharedKey];
  return nextRecords;
};

export const adoptLegacyPetPalMessageComposerRecordsForIdentity = <
  T extends PetPalMessageComposerVersionedRecord,
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerIdentity,
) => {
  const lookupIdentity = resolvePetPalMessageComposerLookupIdentity(identity);
  if (!lookupIdentity || getPetPalMessageComposerEntry(records, identity)) {
    return records;
  }

  const matchingLegacyEntries = Object.entries(records)
    .filter(([, record]) =>
      record.orderId === lookupIdentity.orderId
      && !record.userId
      && (
        !lookupIdentity.scope
        || record.scope === lookupIdentity.scope
        || (lookupIdentity.scope !== 'shared' && record.scope === 'shared')
      ))
    .sort((left, right) => {
      const leftScopeScore = lookupIdentity.scope && left[1].scope === lookupIdentity.scope ? 1 : 0;
      const rightScopeScore = lookupIdentity.scope && right[1].scope === lookupIdentity.scope ? 1 : 0;
      if (leftScopeScore !== rightScopeScore) {
        return rightScopeScore - leftScopeScore;
      }
      return (toTimestamp(right[1].updatedAt) ?? 0) - (toTimestamp(left[1].updatedAt) ?? 0);
    });
  const legacyEntry = matchingLegacyEntries[0];
  if (!legacyEntry) {
    return records;
  }

  const [legacyStorageKey, legacyRecord] = legacyEntry;
  const adoptedScope = lookupIdentity.scope && legacyRecord.scope === 'shared'
    ? lookupIdentity.scope
    : legacyRecord.scope;
  const adoptedIdentity = {
    orderId: legacyRecord.orderId,
    userId: lookupIdentity.userId,
    scope: adoptedScope,
  } satisfies ResolvedPetPalMessageComposerIdentity;
  const nextRecords = {
    ...stripSharedPetPalMessageComposerRecord(records, adoptedIdentity),
    [buildPetPalMessageComposerStorageKey(adoptedIdentity)]: {
      ...legacyRecord,
      userId: adoptedIdentity.userId,
      scope: adoptedIdentity.scope,
    },
  };
  delete nextRecords[legacyStorageKey];
  return nextRecords;
};

export const getPetPalMessageComposerKeysToClear = <
  T extends PetPalMessageComposerVersionedRecord,
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerIdentity,
) => {
  const lookupIdentity = resolvePetPalMessageComposerLookupIdentity(identity);
  if (!lookupIdentity) {
    return [] as string[];
  }

  if (!lookupIdentity.scope) {
    return Object.entries(records)
      .filter(([, record]) => matchesPetPalMessageComposerLookup(record, lookupIdentity))
      .map(([storageKey]) => storageKey);
  }

  const exactKey = buildPetPalMessageComposerStorageKey({
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: lookupIdentity.scope,
  });
  const sharedKey = lookupIdentity.scope === 'shared'
    ? null
    : buildPetPalMessageComposerStorageKey({
        orderId: lookupIdentity.orderId,
        userId: lookupIdentity.userId,
        scope: 'shared',
      });

  return [exactKey, sharedKey]
    .filter((storageKey): storageKey is string => Boolean(storageKey && records[storageKey]))
    .filter((storageKey, index, source) => source.indexOf(storageKey) === index);
};

export const createEmptyPersistedPetPalMessageComposerRecords = (): PersistedPetPalMessageComposerRecords => ({
  drafts: {},
  recoveries: {},
});

export const clonePetPalMessageDraftState = (
  draft: PetPalMessageDraftState,
): PetPalMessageDraftState => ({
  content: draft.content,
  attachments: cloneManagedAttachmentRecords(draft.attachments),
});

export const parsePetPalMessageDraftState = (
  rawValue: unknown,
  options: ParseManagedAttachmentRecordOptions = {},
): PetPalMessageDraftState | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const content = typeof rawValue.content === 'string' ? rawValue.content : '';
  const attachments = Array.isArray(rawValue.attachments)
    ? rawValue.attachments
      .map((item) => parseManagedAttachmentRecord(item, options))
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

export const parsePetPalMessageRecoveryState = (
  rawValue: unknown,
): PetPalMessageRecoveryState | null => {
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

export const compactPersistedPetPalMessageComposerRecords = (
  snapshot: PersistedPetPalMessageComposerRecords,
  options: CompactPersistedPetPalMessageComposerOptions,
): PersistedPetPalMessageComposerRecords => {
  const {
    maxPersistedThreads,
    maxPersistedAgeMs,
    maxLegacyAnonymousPersistedAgeMs,
    now = Date.now(),
  } = options;

  const identityMetadataByBucket = new Map<string, Map<string, {
    timestamp: number;
    userId: string;
  }>>();
  const collectTimestamp = (
    identity: ResolvedPetPalMessageComposerIdentity,
    updatedAt: string,
  ) => {
    const timestamp = toTimestamp(updatedAt);
    if (timestamp === null) {
      return;
    }

    const bucketKey = `${identity.userId}${PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${identity.scope}`;
    const identityKey = buildPetPalMessageComposerStorageKey(identity);
    const bucketMetadata = identityMetadataByBucket.get(bucketKey) ?? new Map<string, {
      timestamp: number;
      userId: string;
    }>();
    const previousMetadata = bucketMetadata.get(identityKey);
    if (previousMetadata === undefined || timestamp > previousMetadata.timestamp) {
      bucketMetadata.set(identityKey, {
        timestamp,
        userId: identity.userId,
      });
      identityMetadataByBucket.set(bucketKey, bucketMetadata);
    }
  };

  Object.values(snapshot.drafts).forEach((draft) => {
    collectTimestamp({
      orderId: draft.orderId,
      userId: draft.userId,
      scope: draft.scope,
    }, draft.updatedAt);
  });
  Object.values(snapshot.recoveries).forEach((recovery) => {
    collectTimestamp({
      orderId: recovery.orderId,
      userId: recovery.userId,
      scope: recovery.scope,
    }, recovery.updatedAt);
  });

  const retainedIdentityKeysByBucket = new Map(
    Array.from(identityMetadataByBucket.entries()).map(([bucketKey, identityMetadata]) => [
      bucketKey,
      new Set(
        Array.from(identityMetadata.entries())
          .filter(([, metadata]) =>
            now - metadata.timestamp <= (metadata.userId ? maxPersistedAgeMs : maxLegacyAnonymousPersistedAgeMs))
          .sort((left, right) => right[1].timestamp - left[1].timestamp)
          .slice(0, maxPersistedThreads)
          .map(([identityKey]) => identityKey),
      ),
    ] as const),
  );

  return {
    drafts: Object.fromEntries(
      Object.values(snapshot.drafts).flatMap((draft) => {
        const identity = {
          orderId: draft.orderId,
          userId: draft.userId,
          scope: draft.scope,
        } satisfies ResolvedPetPalMessageComposerIdentity;
        const storageKey = buildPetPalMessageComposerStorageKey(identity);
        const bucketKey = `${draft.userId}${PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${draft.scope}`;
        return retainedIdentityKeysByBucket.get(bucketKey)?.has(storageKey)
          ? [[
              storageKey,
              {
                ...clonePetPalMessageDraftState(draft),
                orderId: draft.orderId,
                userId: draft.userId,
                updatedAt: draft.updatedAt,
                scope: draft.scope,
              } satisfies PersistedPetPalMessageDraftRecord,
            ] as const]
          : [];
      }),
    ),
    recoveries: Object.fromEntries(
      Object.values(snapshot.recoveries).flatMap((recovery) => {
        const identity = {
          orderId: recovery.orderId,
          userId: recovery.userId,
          scope: recovery.scope,
        } satisfies ResolvedPetPalMessageComposerIdentity;
        const storageKey = buildPetPalMessageComposerStorageKey(identity);
        const bucketKey = `${recovery.userId}${PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${recovery.scope}`;
        return retainedIdentityKeysByBucket.get(bucketKey)?.has(storageKey)
          ? [[
              storageKey,
              {
                orderId: recovery.orderId,
                userId: recovery.userId,
                stage: recovery.stage,
                message: recovery.message,
                updatedAt: recovery.updatedAt,
                scope: recovery.scope,
              } satisfies PersistedPetPalMessageRecoveryRecord,
            ] as const]
          : [];
      }),
    ),
  };
};

export const createPersistedPetPalMessageComposerCompactionOptions = (
  options: {
    now?: number;
  } = {},
): CompactPersistedPetPalMessageComposerOptions => ({
  now: options.now,
  maxPersistedThreads: PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_THREADS,
  maxPersistedAgeMs: PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_AGE_MS,
  maxLegacyAnonymousPersistedAgeMs: PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS,
});

export const createPersistedPetPalMessageComposerParseOptions = (
  options: {
    now?: number;
    fallbackDraftAttachmentUploadedAtToNow?: boolean;
  } = {},
): ParsePersistedPetPalMessageComposerOptions => ({
  ...createPersistedPetPalMessageComposerCompactionOptions({
    now: options.now,
  }),
  fallbackDraftAttachmentUploadedAtToNow: options.fallbackDraftAttachmentUploadedAtToNow,
});

export const toPublicPersistedPetPalMessageComposerSnapshot = (
  snapshot: PersistedPetPalMessageComposerRecords,
): PersistedPetPalMessageComposerSnapshot => ({
  drafts: Object.fromEntries(
    Object.entries(snapshot.drafts).map(([storageKey, draft]) => [
      storageKey,
      clonePetPalMessageDraftState(draft),
    ]),
  ),
  recoveries: Object.fromEntries(
    Object.entries(snapshot.recoveries).map(([storageKey, recovery]) => [
      storageKey,
      {
        stage: recovery.stage,
        message: recovery.message,
      } satisfies PetPalMessageRecoveryState,
    ]),
  ),
});

const normalizePersistedPetPalMessageComposerValue = (rawValue: unknown) => {
  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  }
  catch {
    return null;
  }
};

const toPersistedPetPalMessageDraftRecord = (
  storageKey: string,
  rawValue: unknown,
  fallbackUpdatedAt: string,
  options: {
    fallbackDraftAttachmentUploadedAtToNow?: boolean;
  } = {},
): PersistedPetPalMessageDraftRecord | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const draft = parsePetPalMessageDraftState(rawValue, options.fallbackDraftAttachmentUploadedAtToNow
    ? { fallbackUploadedAt: fallbackUpdatedAt }
    : undefined);
  if (!draft) {
    return null;
  }

  const identity = resolvePersistedPetPalMessageComposerIdentity(storageKey, rawValue);
  if (!identity) {
    return null;
  }

  const updatedAt = typeof rawValue.updatedAt === 'string' && toTimestamp(rawValue.updatedAt)
    ? rawValue.updatedAt
    : fallbackUpdatedAt;

  return {
    ...clonePetPalMessageDraftState(draft),
    orderId: identity.orderId,
    userId: identity.userId,
    updatedAt,
    scope: identity.scope,
  };
};

const toPersistedPetPalMessageRecoveryRecord = (
  storageKey: string,
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageRecoveryRecord | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const recovery = parsePetPalMessageRecoveryState(rawValue);
  if (!recovery) {
    return null;
  }

  const identity = resolvePersistedPetPalMessageComposerIdentity(storageKey, rawValue);
  if (!identity) {
    return null;
  }

  const updatedAt = typeof rawValue.updatedAt === 'string' && toTimestamp(rawValue.updatedAt)
    ? rawValue.updatedAt
    : fallbackUpdatedAt;

  return {
    orderId: identity.orderId,
    userId: identity.userId,
    stage: recovery.stage,
    message: recovery.message,
    updatedAt,
    scope: identity.scope,
  };
};

export const parsePersistedPetPalMessageComposerRecords = (
  rawValue: unknown,
  options: ParsePersistedPetPalMessageComposerOptions,
): PersistedPetPalMessageComposerRecords => {
  const {
    maxPersistedThreads,
    maxPersistedAgeMs,
    maxLegacyAnonymousPersistedAgeMs,
    now = Date.now(),
    fallbackDraftAttachmentUploadedAtToNow = false,
  } = options;
  const normalized = normalizePersistedPetPalMessageComposerValue(rawValue);
  if (!isRecord(normalized)) {
    return createEmptyPersistedPetPalMessageComposerRecords();
  }

  const fallbackUpdatedAt = new Date(now).toISOString();
  const rawDrafts = isRecord(normalized.drafts) ? normalized.drafts : {};
  const drafts = Object.fromEntries(
    Object.entries(rawDrafts).flatMap(([storageKey, rawDraft]) => {
      const draft = toPersistedPetPalMessageDraftRecord(storageKey, rawDraft, fallbackUpdatedAt, {
        fallbackDraftAttachmentUploadedAtToNow,
      });
      if (!draft) {
        return [];
      }

      return [[buildPetPalMessageComposerStorageKey({
        orderId: draft.orderId,
        userId: draft.userId,
        scope: draft.scope,
      }), draft] as const];
    }),
  );

  const rawRecoveries = isRecord(normalized.recoveries) ? normalized.recoveries : {};
  const recoveries = Object.fromEntries(
    Object.entries(rawRecoveries).flatMap(([storageKey, rawRecovery]) => {
      const recovery = toPersistedPetPalMessageRecoveryRecord(storageKey, rawRecovery, fallbackUpdatedAt);
      if (!recovery) {
        return [];
      }

      return [[buildPetPalMessageComposerStorageKey({
        orderId: recovery.orderId,
        userId: recovery.userId,
        scope: recovery.scope,
      }), recovery] as const];
    }),
  );

  return compactPersistedPetPalMessageComposerRecords({
    drafts,
    recoveries,
  }, {
    now,
    maxPersistedThreads,
    maxPersistedAgeMs,
    maxLegacyAnonymousPersistedAgeMs,
  });
};

export const parsePersistedPetPalMessageComposerSnapshot = (
  rawValue: unknown,
  options: ParsePersistedPetPalMessageComposerOptions,
): PersistedPetPalMessageComposerSnapshot =>
  toPublicPersistedPetPalMessageComposerSnapshot(
    parsePersistedPetPalMessageComposerRecords(rawValue, options),
  );

export const adoptLegacyPetPalMessageComposerSnapshot = (
  rawValue: unknown,
  identity: PetPalMessageComposerIdentity,
  options: ParsePersistedPetPalMessageComposerOptions,
): PersistedPetPalMessageComposerSnapshot => {
  const snapshot = parsePersistedPetPalMessageComposerRecords(rawValue, options);
  return toPublicPersistedPetPalMessageComposerSnapshot({
    drafts: adoptLegacyPetPalMessageComposerRecordsForIdentity(snapshot.drafts, identity),
    recoveries: adoptLegacyPetPalMessageComposerRecordsForIdentity(snapshot.recoveries, identity),
  });
};
