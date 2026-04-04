import type {
  PetPalMessageComposerIdentity,
  PetPalMessageComposerScope,
  PetPalMessageDraftAttachment,
  PetPalMessageDraftState,
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

export const PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_PREFIX = 'petpal-message-composer';
export const PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR = '::';

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
