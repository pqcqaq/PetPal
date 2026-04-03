import { ref } from 'vue'

export type PetPalMessageDraftAttachment = {
  fileId: string
  url: string
  name: string
  mimeType: string
  size: number
  uploadedAt: string
}

export type PetPalMessageDraftState = {
  content: string
  attachments: PetPalMessageDraftAttachment[]
}

export type PetPalMessageRecoveryStage = 'upload' | 'send'

export type PetPalMessageRecoveryState = {
  stage: PetPalMessageRecoveryStage
  message: string
}

export type PetPalMessageComposerScope = 'owner' | 'caregiver' | 'shared'

export type PetPalMessageComposerIdentity = {
  orderId: string
  userId: string
  scope?: PetPalMessageComposerScope
}

export type PersistedPetPalMessageComposerSnapshot = {
  drafts: Record<string, PetPalMessageDraftState>
  recoveries: Record<string, PetPalMessageRecoveryState>
}

type PersistedPetPalMessageDraftRecord = PetPalMessageDraftState & {
  orderId: string
  userId: string
  updatedAt: string
  scope: PetPalMessageComposerScope
}

type PersistedPetPalMessageRecoveryRecord = PetPalMessageRecoveryState & {
  orderId: string
  userId: string
  updatedAt: string
  scope: PetPalMessageComposerScope
}

type PersistedPetPalMessageComposerRecords = {
  drafts: Record<string, PersistedPetPalMessageDraftRecord>
  recoveries: Record<string, PersistedPetPalMessageRecoveryRecord>
}

type ResolvedPetPalMessageComposerIdentity = {
  orderId: string
  userId: string
  scope: PetPalMessageComposerScope
}

type PetPalMessageComposerLookupIdentity = {
  orderId: string
  userId: string
  scope?: PetPalMessageComposerScope
}

const STORAGE_KEY = 'petpal-message-composer-state-v1'
const MESSAGE_COMPOSER_STORAGE_KEY_PREFIX = 'petpal-message-composer'
const MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR = '::'
const MAX_PERSISTED_THREADS = 12
const MAX_PERSISTED_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000

const createEmptyPersistedSnapshot = (): PersistedPetPalMessageComposerRecords => ({
  drafts: {},
  recoveries: {},
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeMessageComposerScope = (value: unknown): PetPalMessageComposerScope =>
  value === 'owner' || value === 'caregiver' ? value : 'shared'

const normalizeMessageComposerOrderId = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const normalizeMessageComposerUserId = (value: unknown) =>
  typeof value === 'string' ? value.trim() : ''

const resolveMessageComposerLookupIdentity = (
  identity: PetPalMessageComposerIdentity,
): PetPalMessageComposerLookupIdentity | null => {
  const orderId = normalizeMessageComposerOrderId(identity.orderId)
  const userId = normalizeMessageComposerUserId(identity.userId)
  if (!orderId || !userId) {
    return null
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
      }
}

const resolveMessageComposerIdentity = (
  identity: PetPalMessageComposerIdentity,
  fallbackScope: PetPalMessageComposerScope = 'shared',
): ResolvedPetPalMessageComposerIdentity | null => {
  const lookupIdentity = resolveMessageComposerLookupIdentity(identity)
  if (!lookupIdentity) {
    return null
  }

  return {
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: lookupIdentity.scope ?? fallbackScope,
  }
}

export function buildPetPalMessageComposerStorageKey(
  identity: {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
  },
) {
  return [
    MESSAGE_COMPOSER_STORAGE_KEY_PREFIX,
    `order=${encodeURIComponent(identity.orderId)}`,
    `scope=${identity.scope}`,
    `user=${encodeURIComponent(identity.userId)}`,
  ].join(MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR)
}

const parsePetPalMessageComposerStorageKey = (
  storageKey: string,
): ResolvedPetPalMessageComposerIdentity | null => {
  const segments = storageKey.split(MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR)
  if (segments.length !== 4 || segments[0] !== MESSAGE_COMPOSER_STORAGE_KEY_PREFIX) {
    return null
  }

  const orderId = segments[1]?.startsWith('order=')
    ? decodeURIComponent(segments[1].slice('order='.length))
    : ''
  const scope = segments[2]?.startsWith('scope=')
    ? normalizeMessageComposerScope(segments[2].slice('scope='.length))
    : 'shared'
  const userId = segments[3]?.startsWith('user=')
    ? decodeURIComponent(segments[3].slice('user='.length))
    : ''

  const normalizedOrderId = normalizeMessageComposerOrderId(orderId)
  if (!normalizedOrderId) {
    return null
  }

  return {
    orderId: normalizedOrderId,
    userId: typeof userId === 'string' ? userId : '',
    scope,
  }
}

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  attachments.map(item => ({
    fileId: item.fileId,
    url: item.url,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    uploadedAt: item.uploadedAt,
  }))

const cloneMessageDraftState = (draft: PetPalMessageDraftState): PetPalMessageDraftState => ({
  content: draft.content,
  attachments: cloneMessageDraftAttachments(draft.attachments),
})

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

const normalizePersistedValue = (rawValue: unknown) => {
  if (typeof rawValue !== 'string') {
    return rawValue
  }

  try {
    return JSON.parse(rawValue) as unknown
  }
  catch {
    return null
  }
}

const toDraftAttachment = (rawValue: unknown): PetPalMessageDraftAttachment | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const { fileId, url, name, mimeType, size, uploadedAt } = rawValue
  if (
    typeof fileId !== 'string'
    || typeof url !== 'string'
    || typeof name !== 'string'
    || typeof mimeType !== 'string'
    || typeof uploadedAt !== 'string'
    || typeof size !== 'number'
    || !Number.isFinite(size)
    || size < 0
  ) {
    return null
  }

  if (!fileId.trim() || !url.trim() || !name.trim() || !mimeType.trim() || !uploadedAt.trim()) {
    return null
  }

  return {
    fileId,
    url,
    name,
    mimeType,
    size,
    uploadedAt,
  }
}

const toDraftState = (rawValue: unknown): PetPalMessageDraftState | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const content = typeof rawValue.content === 'string' ? rawValue.content : ''
  const attachments = Array.isArray(rawValue.attachments)
    ? rawValue.attachments
      .map(item => toDraftAttachment(item))
      .filter((item): item is PetPalMessageDraftAttachment => Boolean(item))
    : []

  if (!content.trim() && !attachments.length) {
    return null
  }

  return {
    content,
    attachments,
  }
}

const resolvePersistedRecordIdentity = (
  storageKey: string,
  rawValue: Record<string, unknown>,
  fallbackScope: PetPalMessageComposerScope = 'shared',
): ResolvedPetPalMessageComposerIdentity | null => {
  const parsedIdentity = parsePetPalMessageComposerStorageKey(storageKey)
  const orderId = normalizeMessageComposerOrderId(rawValue.orderId)
    || parsedIdentity?.orderId
    || normalizeMessageComposerOrderId(storageKey)
  if (!orderId) {
    return null
  }

  return {
    orderId,
    userId: normalizeMessageComposerUserId(rawValue.userId) || parsedIdentity?.userId || '',
    scope: rawValue.scope !== undefined
      ? normalizeMessageComposerScope(rawValue.scope)
      : parsedIdentity?.scope ?? fallbackScope,
  }
}

const toDraftRecord = (
  storageKey: string,
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageDraftRecord | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const draft = toDraftState(rawValue)
  if (!draft) {
    return null
  }

  const identity = resolvePersistedRecordIdentity(storageKey, rawValue)
  if (!identity) {
    return null
  }

  const updatedAt = typeof rawValue.updatedAt === 'string' && toTimestamp(rawValue.updatedAt)
    ? rawValue.updatedAt
    : fallbackUpdatedAt

  return {
    ...cloneMessageDraftState(draft),
    orderId: identity.orderId,
    userId: identity.userId,
    updatedAt,
    scope: identity.scope,
  }
}

const toRecoveryState = (rawValue: unknown): PetPalMessageRecoveryState | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const { stage, message } = rawValue
  if ((stage !== 'upload' && stage !== 'send') || typeof message !== 'string' || !message.trim()) {
    return null
  }

  return {
    stage,
    message,
  }
}

const toRecoveryRecord = (
  storageKey: string,
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageRecoveryRecord | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const recovery = toRecoveryState(rawValue)
  if (!recovery) {
    return null
  }

  const identity = resolvePersistedRecordIdentity(storageKey, rawValue)
  if (!identity) {
    return null
  }

  const updatedAt = typeof rawValue.updatedAt === 'string' && toTimestamp(rawValue.updatedAt)
    ? rawValue.updatedAt
    : fallbackUpdatedAt

  return {
    orderId: identity.orderId,
    userId: identity.userId,
    stage: recovery.stage,
    message: recovery.message,
    updatedAt,
    scope: identity.scope,
  }
}

const compactPersistedPetPalMessageComposerRecords = (
  snapshot: PersistedPetPalMessageComposerRecords,
  now = Date.now(),
): PersistedPetPalMessageComposerRecords => {
  const identityMetadataByBucket = new Map<string, Map<string, {
    timestamp: number
    userId: string
  }>>()
  const collectTimestamp = (
    identity: ResolvedPetPalMessageComposerIdentity,
    updatedAt: string,
  ) => {
    const timestamp = toTimestamp(updatedAt)
    if (timestamp === null) {
      return
    }

    const bucketKey = `${identity.userId}${MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${identity.scope}`
    const identityKey = buildPetPalMessageComposerStorageKey(identity)
    const bucketMetadata = identityMetadataByBucket.get(bucketKey) ?? new Map<string, {
      timestamp: number
      userId: string
    }>()
    const previousMetadata = bucketMetadata.get(identityKey)
    if (previousMetadata === undefined || timestamp > previousMetadata.timestamp) {
      bucketMetadata.set(identityKey, {
        timestamp,
        userId: identity.userId,
      })
      identityMetadataByBucket.set(bucketKey, bucketMetadata)
    }
  }

  Object.values(snapshot.drafts).forEach((draft) => {
    collectTimestamp({
      orderId: draft.orderId,
      userId: draft.userId,
      scope: draft.scope,
    }, draft.updatedAt)
  })
  Object.values(snapshot.recoveries).forEach((recovery) => {
    collectTimestamp({
      orderId: recovery.orderId,
      userId: recovery.userId,
      scope: recovery.scope,
    }, recovery.updatedAt)
  })

  const retainedIdentityKeysByBucket = new Map(
    Array.from(identityMetadataByBucket.entries()).map(([bucketKey, identityMetadata]) => [
      bucketKey,
      new Set(
        Array.from(identityMetadata.entries())
          .filter(([, metadata]) =>
            now - metadata.timestamp <= (metadata.userId ? MAX_PERSISTED_AGE_MS : MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS))
          .sort((left, right) => right[1].timestamp - left[1].timestamp)
          .slice(0, MAX_PERSISTED_THREADS)
          .map(([identityKey]) => identityKey),
      ),
    ] as const),
  )

  return {
    drafts: Object.fromEntries(
      Object.values(snapshot.drafts).flatMap((draft) => {
        const identity = {
          orderId: draft.orderId,
          userId: draft.userId,
          scope: draft.scope,
        } satisfies ResolvedPetPalMessageComposerIdentity
        const storageKey = buildPetPalMessageComposerStorageKey(identity)
        const bucketKey = `${draft.userId}${MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${draft.scope}`
        return retainedIdentityKeysByBucket.get(bucketKey)?.has(storageKey)
          ? [[
              storageKey,
              {
                ...cloneMessageDraftState(draft),
                orderId: draft.orderId,
                userId: draft.userId,
                updatedAt: draft.updatedAt,
                scope: draft.scope,
              } satisfies PersistedPetPalMessageDraftRecord,
            ] as const]
          : []
      }),
    ),
    recoveries: Object.fromEntries(
      Object.values(snapshot.recoveries).flatMap((recovery) => {
        const identity = {
          orderId: recovery.orderId,
          userId: recovery.userId,
          scope: recovery.scope,
        } satisfies ResolvedPetPalMessageComposerIdentity
        const storageKey = buildPetPalMessageComposerStorageKey(identity)
        const bucketKey = `${recovery.userId}${MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${recovery.scope}`
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
          : []
      }),
    ),
  }
}

const matchesMessageComposerLookup = (
  record: {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
  },
  identity: PetPalMessageComposerLookupIdentity,
) =>
  record.orderId === identity.orderId
  && record.userId === identity.userId
  && (!identity.scope || record.scope === identity.scope)

const getLatestMessageComposerEntry = <
  T extends {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
    updatedAt: string
  },
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerLookupIdentity,
): [string, T] | null => {
  const matchingEntries = Object.entries(records).filter(([, record]) =>
    matchesMessageComposerLookup(record, identity))
  if (!matchingEntries.length) {
    return null
  }

  return matchingEntries.sort((left, right) =>
    (toTimestamp(right[1].updatedAt) ?? 0) - (toTimestamp(left[1].updatedAt) ?? 0))[0] ?? null
}

const getMessageComposerEntry = <
  T extends {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
    updatedAt: string
  },
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerIdentity,
): [string, T] | null => {
  const lookupIdentity = resolveMessageComposerLookupIdentity(identity)
  if (!lookupIdentity) {
    return null
  }

  if (!lookupIdentity.scope) {
    return getLatestMessageComposerEntry(records, lookupIdentity)
  }

  const exactKey = buildPetPalMessageComposerStorageKey({
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: lookupIdentity.scope,
  })
  const exactRecord = records[exactKey]
  if (exactRecord && matchesMessageComposerLookup(exactRecord, lookupIdentity)) {
    return [exactKey, exactRecord]
  }

  if (lookupIdentity.scope === 'shared') {
    return null
  }

  const sharedKey = buildPetPalMessageComposerStorageKey({
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: 'shared',
  })
  const sharedRecord = records[sharedKey]
  if (sharedRecord && matchesMessageComposerLookup(sharedRecord, {
    ...lookupIdentity,
    scope: 'shared',
  })) {
    return [sharedKey, sharedRecord]
  }

  return null
}

const adoptLegacyMessageComposerRecordsForIdentity = <
  T extends {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
    updatedAt: string
  },
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerIdentity,
) => {
  const lookupIdentity = resolveMessageComposerLookupIdentity(identity)
  if (!lookupIdentity || getMessageComposerEntry(records, identity)) {
    return records
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
      const leftScopeScore = lookupIdentity.scope && left[1].scope === lookupIdentity.scope ? 1 : 0
      const rightScopeScore = lookupIdentity.scope && right[1].scope === lookupIdentity.scope ? 1 : 0
      if (leftScopeScore !== rightScopeScore) {
        return rightScopeScore - leftScopeScore
      }
      return (toTimestamp(right[1].updatedAt) ?? 0) - (toTimestamp(left[1].updatedAt) ?? 0)
    })
  const legacyEntry = matchingLegacyEntries[0]
  if (!legacyEntry) {
    return records
  }

  const [legacyStorageKey, legacyRecord] = legacyEntry
  const adoptedScope = lookupIdentity.scope && legacyRecord.scope === 'shared'
    ? lookupIdentity.scope
    : legacyRecord.scope
  const adoptedIdentity = {
    orderId: legacyRecord.orderId,
    userId: lookupIdentity.userId,
    scope: adoptedScope,
  } satisfies ResolvedPetPalMessageComposerIdentity
  const nextRecords = {
    ...stripSharedMessageComposerRecord(records, adoptedIdentity),
    [buildPetPalMessageComposerStorageKey(adoptedIdentity)]: {
      ...legacyRecord,
      userId: adoptedIdentity.userId,
      scope: adoptedIdentity.scope,
    },
  }
  delete nextRecords[legacyStorageKey]
  return nextRecords
}

const getMessageComposerKeysToClear = <
  T extends {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
    updatedAt: string
  },
>(
  records: Record<string, T>,
  identity: PetPalMessageComposerIdentity,
) => {
  const lookupIdentity = resolveMessageComposerLookupIdentity(identity)
  if (!lookupIdentity) {
    return [] as string[]
  }

  if (!lookupIdentity.scope) {
    return Object.entries(records)
      .filter(([, record]) => matchesMessageComposerLookup(record, lookupIdentity))
      .map(([storageKey]) => storageKey)
  }

  const exactKey = buildPetPalMessageComposerStorageKey({
    orderId: lookupIdentity.orderId,
    userId: lookupIdentity.userId,
    scope: lookupIdentity.scope,
  })
  const sharedKey = lookupIdentity.scope === 'shared'
    ? null
    : buildPetPalMessageComposerStorageKey({
        orderId: lookupIdentity.orderId,
        userId: lookupIdentity.userId,
        scope: 'shared',
      })

  return [exactKey, sharedKey]
    .filter((storageKey): storageKey is string => Boolean(storageKey && records[storageKey]))
    .filter((storageKey, index, source) => source.indexOf(storageKey) === index)
}

const stripSharedMessageComposerRecord = <
  T extends {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
  },
>(
  records: Record<string, T>,
  identity: ResolvedPetPalMessageComposerIdentity,
) => {
  if (identity.scope === 'shared') {
    return records
  }

  const sharedKey = buildPetPalMessageComposerStorageKey({
    orderId: identity.orderId,
    userId: identity.userId,
    scope: 'shared',
  })
  if (!records[sharedKey]) {
    return records
  }

  const nextRecords = { ...records }
  delete nextRecords[sharedKey]
  return nextRecords
}

const toPublicPersistedSnapshot = (
  snapshot: PersistedPetPalMessageComposerRecords,
): PersistedPetPalMessageComposerSnapshot => ({
  drafts: Object.fromEntries(
    Object.entries(snapshot.drafts).map(([storageKey, draft]) => [
      storageKey,
      cloneMessageDraftState(draft),
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
})

const parsePersistedPetPalMessageComposerRecords = (
  rawValue: unknown,
  now = Date.now(),
): PersistedPetPalMessageComposerRecords => {
  const normalized = normalizePersistedValue(rawValue)
  if (!isRecord(normalized)) {
    return createEmptyPersistedSnapshot()
  }

  const fallbackUpdatedAt = new Date(now).toISOString()
  const rawDrafts = isRecord(normalized.drafts) ? normalized.drafts : {}
  const drafts = Object.fromEntries(
    Object.entries(rawDrafts).flatMap(([storageKey, rawDraft]) => {
      const draft = toDraftRecord(storageKey, rawDraft, fallbackUpdatedAt)
      if (!draft) {
        return []
      }

      return [[buildPetPalMessageComposerStorageKey({
        orderId: draft.orderId,
        userId: draft.userId,
        scope: draft.scope,
      }), draft] as const]
    }),
  )

  const rawRecoveries = isRecord(normalized.recoveries) ? normalized.recoveries : {}
  const recoveries = Object.fromEntries(
    Object.entries(rawRecoveries).flatMap(([storageKey, rawRecovery]) => {
      const recovery = toRecoveryRecord(storageKey, rawRecovery, fallbackUpdatedAt)
      if (!recovery) {
        return []
      }

      return [[buildPetPalMessageComposerStorageKey({
        orderId: recovery.orderId,
        userId: recovery.userId,
        scope: recovery.scope,
      }), recovery] as const]
    }),
  )

  return compactPersistedPetPalMessageComposerRecords({
    drafts,
    recoveries,
  }, now)
}

export function parsePersistedPetPalMessageComposerSnapshot(
  rawValue: unknown,
  options: {
    now?: number
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  return toPublicPersistedSnapshot(
    parsePersistedPetPalMessageComposerRecords(rawValue, options.now),
  )
}

export function adoptLegacyPetPalMessageComposerSnapshot(
  rawValue: unknown,
  identity: PetPalMessageComposerIdentity,
  options: {
    now?: number
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  const snapshot = parsePersistedPetPalMessageComposerRecords(rawValue, options.now)
  return toPublicPersistedSnapshot({
    drafts: adoptLegacyMessageComposerRecordsForIdentity(snapshot.drafts, identity),
    recoveries: adoptLegacyMessageComposerRecordsForIdentity(snapshot.recoveries, identity),
  })
}

const hasMessageComposerStorage = () =>
  typeof uni !== 'undefined'
  && typeof uni.getStorageSync === 'function'
  && typeof uni.setStorageSync === 'function'
  && typeof uni.removeStorageSync === 'function'

const readPersistedPetPalMessageComposerSnapshot = (): PersistedPetPalMessageComposerRecords => {
  if (!hasMessageComposerStorage()) {
    return createEmptyPersistedSnapshot()
  }

  try {
    return parsePersistedPetPalMessageComposerRecords(uni.getStorageSync(STORAGE_KEY))
  }
  catch {
    return createEmptyPersistedSnapshot()
  }
}

const persistedSnapshot = readPersistedPetPalMessageComposerSnapshot()

const messageDrafts = ref<Record<string, PersistedPetPalMessageDraftRecord>>(persistedSnapshot.drafts)
const messageRecoveries = ref<Record<string, PersistedPetPalMessageRecoveryRecord>>(persistedSnapshot.recoveries)

function syncPersistedPetPalMessageComposerSnapshot() {
  if (!hasMessageComposerStorage()) {
    return
  }

  try {
    const compactedSnapshot = compactPersistedPetPalMessageComposerRecords({
      drafts: messageDrafts.value,
      recoveries: messageRecoveries.value,
    })

    messageDrafts.value = compactedSnapshot.drafts
    messageRecoveries.value = compactedSnapshot.recoveries

    if (!Object.keys(compactedSnapshot.drafts).length && !Object.keys(compactedSnapshot.recoveries).length) {
      uni.removeStorageSync(STORAGE_KEY)
      return
    }

    uni.setStorageSync(STORAGE_KEY, {
      drafts: compactedSnapshot.drafts,
      recoveries: compactedSnapshot.recoveries,
    } satisfies PersistedPetPalMessageComposerRecords)
  }
  catch {
    // Ignore storage failures and keep runtime state usable.
  }
}

syncPersistedPetPalMessageComposerSnapshot()

const getMessageComposerEntryForIdentity = <
  T extends {
    orderId: string
    userId: string
    scope: PetPalMessageComposerScope
    updatedAt: string
  },
>(
  recordsRef: {
    value: Record<string, T>
  },
  identity: PetPalMessageComposerIdentity,
): [string, T] | null => {
  const currentEntry = getMessageComposerEntry(recordsRef.value, identity)
  if (currentEntry) {
    return currentEntry
  }

  const adoptedRecords = adoptLegacyMessageComposerRecordsForIdentity(recordsRef.value, identity)
  if (adoptedRecords === recordsRef.value) {
    return null
  }

  recordsRef.value = adoptedRecords
  syncPersistedPetPalMessageComposerSnapshot()
  return getMessageComposerEntry(recordsRef.value, identity)
}

export function hasPetPalMessageDraft(identity: PetPalMessageComposerIdentity) {
  return Boolean(getMessageComposerEntryForIdentity(messageDrafts, identity))
}

export function restorePetPalMessageDraft(identity: PetPalMessageComposerIdentity) {
  const draftEntry = getMessageComposerEntryForIdentity(messageDrafts, identity)
  if (!draftEntry) {
    return null
  }
  return cloneMessageDraftState(draftEntry[1])
}

export function clearPetPalMessageDraft(identity: PetPalMessageComposerIdentity) {
  const keysToClear = getMessageComposerKeysToClear(messageDrafts.value, identity)
  if (!keysToClear.length) {
    return
  }

  const nextDrafts = { ...messageDrafts.value }
  keysToClear.forEach((storageKey) => {
    delete nextDrafts[storageKey]
  })
  messageDrafts.value = nextDrafts
  syncPersistedPetPalMessageComposerSnapshot()
}

export function getPetPalMessageComposerScope(identity: PetPalMessageComposerIdentity): PetPalMessageComposerScope | null {
  return getMessageComposerEntryForIdentity(messageDrafts, identity)?.[1].scope
    ?? getMessageComposerEntryForIdentity(messageRecoveries, identity)?.[1].scope
    ?? null
}

export function persistPetPalMessageDraft(
  identity: PetPalMessageComposerIdentity,
  content: string,
  attachments: PetPalMessageDraftAttachment[],
) {
  const resolvedIdentity = resolveMessageComposerIdentity(
    identity,
    getPetPalMessageComposerScope(identity) ?? 'shared',
  )
  if (!resolvedIdentity) {
    return
  }

  const nextAttachments = cloneMessageDraftAttachments(attachments)
  const hasDraft = content.trim().length > 0 || nextAttachments.length > 0
  if (!hasDraft) {
    clearPetPalMessageDraft(resolvedIdentity)
    return
  }

  messageDrafts.value = {
    ...stripSharedMessageComposerRecord(messageDrafts.value, resolvedIdentity),
    [buildPetPalMessageComposerStorageKey(resolvedIdentity)]: {
      orderId: resolvedIdentity.orderId,
      userId: resolvedIdentity.userId,
      content,
      attachments: nextAttachments,
      updatedAt: new Date().toISOString(),
      scope: resolvedIdentity.scope,
    },
  }
  syncPersistedPetPalMessageComposerSnapshot()
}

export function hasPetPalMessageRecovery(identity: PetPalMessageComposerIdentity) {
  return Boolean(getMessageComposerEntryForIdentity(messageRecoveries, identity))
}

export function getPetPalMessageRecovery(identity: PetPalMessageComposerIdentity) {
  const recoveryEntry = getMessageComposerEntryForIdentity(messageRecoveries, identity)
  if (!recoveryEntry) {
    return null
  }
  const recovery = recoveryEntry[1]

  return {
    stage: recovery.stage,
    message: recovery.message,
  } satisfies PetPalMessageRecoveryState
}

export function clearPetPalMessageRecovery(identity: PetPalMessageComposerIdentity) {
  const keysToClear = getMessageComposerKeysToClear(messageRecoveries.value, identity)
  if (!keysToClear.length) {
    return
  }

  const nextRecoveries = { ...messageRecoveries.value }
  keysToClear.forEach((storageKey) => {
    delete nextRecoveries[storageKey]
  })
  messageRecoveries.value = nextRecoveries
  syncPersistedPetPalMessageComposerSnapshot()
}

export function setPetPalMessageRecovery(
  identity: PetPalMessageComposerIdentity,
  stage: PetPalMessageRecoveryStage,
  message: string,
) {
  const resolvedIdentity = resolveMessageComposerIdentity(
    identity,
    getPetPalMessageComposerScope(identity) ?? 'shared',
  )
  if (!resolvedIdentity) {
    return
  }

  messageRecoveries.value = {
    ...stripSharedMessageComposerRecord(messageRecoveries.value, resolvedIdentity),
    [buildPetPalMessageComposerStorageKey(resolvedIdentity)]: {
      orderId: resolvedIdentity.orderId,
      userId: resolvedIdentity.userId,
      stage,
      message,
      updatedAt: new Date().toISOString(),
      scope: resolvedIdentity.scope,
    },
  }
  syncPersistedPetPalMessageComposerSnapshot()
}
