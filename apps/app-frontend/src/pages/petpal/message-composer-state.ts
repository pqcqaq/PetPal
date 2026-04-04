import {
  adoptLegacyPetPalMessageComposerRecordsForIdentity,
  buildPetPalMessageComposerStorageKey as buildSharedPetPalMessageComposerStorageKey,
  cloneManagedAttachmentRecords,
  clonePetPalMessageDraftState as cloneSharedPetPalMessageDraftState,
  getPetPalMessageComposerEntry,
  getPetPalMessageComposerKeysToClear,
  PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR,
  parsePetPalMessageDraftState,
  parsePetPalMessageRecoveryState,
  resolvePersistedPetPalMessageComposerIdentity,
  resolvePetPalMessageComposerIdentity,
  stripSharedPetPalMessageComposerRecord,
  type PetPalMessageComposerIdentity as SharedPetPalMessageComposerIdentity,
  type PetPalMessageComposerScope as SharedPetPalMessageComposerScope,
  type PetPalMessageComposerVersionedRecord,
  type ManagedAttachmentRecord,
  type PetPalMessageDraftState as SharedPetPalMessageDraftState,
  type PetPalMessageRecoveryStage as SharedPetPalMessageRecoveryStage,
  type PetPalMessageRecoveryState as SharedPetPalMessageRecoveryState,
  type ResolvedPetPalMessageComposerIdentity,
} from '@rbac/api-common'
import { ref } from 'vue'

export type PetPalMessageDraftAttachment = ManagedAttachmentRecord

export type PetPalMessageDraftState = SharedPetPalMessageDraftState
export type PetPalMessageRecoveryStage = SharedPetPalMessageRecoveryStage
export type PetPalMessageRecoveryState = SharedPetPalMessageRecoveryState

export type PetPalMessageComposerScope = SharedPetPalMessageComposerScope
export type PetPalMessageComposerIdentity = SharedPetPalMessageComposerIdentity

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

const STORAGE_KEY = 'petpal-message-composer-state-v1'
const MAX_PERSISTED_THREADS = 12
const MAX_PERSISTED_AGE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS = 24 * 60 * 60 * 1000

const createEmptyPersistedSnapshot = (): PersistedPetPalMessageComposerRecords => ({
  drafts: {},
  recoveries: {},
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const buildPetPalMessageComposerStorageKey = buildSharedPetPalMessageComposerStorageKey

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  cloneManagedAttachmentRecords(attachments)

const cloneMessageDraftState = (draft: PetPalMessageDraftState): PetPalMessageDraftState =>
  cloneSharedPetPalMessageDraftState(draft)

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

const resolvePersistedRecordIdentity = (
  storageKey: string,
  rawValue: Record<string, unknown>,
  fallbackScope: PetPalMessageComposerScope = 'shared',
): ResolvedPetPalMessageComposerIdentity | null =>
  resolvePersistedPetPalMessageComposerIdentity(storageKey, rawValue, fallbackScope)

const toDraftRecord = (
  storageKey: string,
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageDraftRecord | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const draft = parsePetPalMessageDraftState(rawValue)
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

const toRecoveryRecord = (
  storageKey: string,
  rawValue: unknown,
  fallbackUpdatedAt: string,
): PersistedPetPalMessageRecoveryRecord | null => {
  if (!isRecord(rawValue)) {
    return null
  }

  const recovery = parsePetPalMessageRecoveryState(rawValue)
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

    const bucketKey = `${identity.userId}${PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${identity.scope}`
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
        const bucketKey = `${draft.userId}${PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${draft.scope}`
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
        const bucketKey = `${recovery.userId}${PETPAL_MESSAGE_COMPOSER_STORAGE_KEY_SEPARATOR}${recovery.scope}`
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
    drafts: adoptLegacyPetPalMessageComposerRecordsForIdentity(snapshot.drafts, identity),
    recoveries: adoptLegacyPetPalMessageComposerRecordsForIdentity(snapshot.recoveries, identity),
  })
}

const hasMessageComposerStorage = () =>
  typeof uni !== 'undefined'
  && typeof uni.getStorageSync === 'function'
  && typeof uni.setStorageSync === 'function'
  && typeof uni.removeStorageSync === 'function'

const parsePersistedPetPalMessageComposerStorageValue = (
  rawValue: unknown,
  now = Date.now(),
): PersistedPetPalMessageComposerRecords => {
  try {
    return parsePersistedPetPalMessageComposerRecords(rawValue, now)
  }
  catch {
    return createEmptyPersistedSnapshot()
  }
}

const writePersistedPetPalMessageComposerSnapshot = (
  snapshot: PersistedPetPalMessageComposerRecords,
) => {
  if (!Object.keys(snapshot.drafts).length && !Object.keys(snapshot.recoveries).length) {
    uni.removeStorageSync(STORAGE_KEY)
    return
  }

  uni.setStorageSync(STORAGE_KEY, {
    drafts: snapshot.drafts,
    recoveries: snapshot.recoveries,
  } satisfies PersistedPetPalMessageComposerRecords)
}

const readPersistedPetPalMessageComposerSnapshot = (): PersistedPetPalMessageComposerRecords => {
  if (!hasMessageComposerStorage()) {
    return createEmptyPersistedSnapshot()
  }

  return parsePersistedPetPalMessageComposerStorageValue(uni.getStorageSync(STORAGE_KEY))
}

const persistedSnapshot = readPersistedPetPalMessageComposerSnapshot()

const messageDrafts = ref<Record<string, PersistedPetPalMessageDraftRecord>>(persistedSnapshot.drafts)
const messageRecoveries = ref<Record<string, PersistedPetPalMessageRecoveryRecord>>(persistedSnapshot.recoveries)

export function warmupPetPalMessageComposerPersistence(
  options: {
    now?: number
  } = {},
) {
  if (!hasMessageComposerStorage()) {
    return
  }

  try {
    const persistedSnapshot = parsePersistedPetPalMessageComposerStorageValue(
      uni.getStorageSync(STORAGE_KEY),
      options.now,
    )
    messageDrafts.value = persistedSnapshot.drafts
    messageRecoveries.value = persistedSnapshot.recoveries
    writePersistedPetPalMessageComposerSnapshot(persistedSnapshot)
  }
  catch {
    // Ignore storage failures and keep runtime state usable.
  }
}

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
    writePersistedPetPalMessageComposerSnapshot(compactedSnapshot)
  }
  catch {
    // Ignore storage failures and keep runtime state usable.
  }
}

warmupPetPalMessageComposerPersistence()

const getMessageComposerEntryForIdentity = <
  T extends PetPalMessageComposerVersionedRecord,
>(
  recordsRef: {
    value: Record<string, T>
  },
  identity: PetPalMessageComposerIdentity,
): [string, T] | null => {
  const currentEntry = getPetPalMessageComposerEntry(recordsRef.value, identity)
  if (currentEntry) {
    return currentEntry
  }

  const adoptedRecords = adoptLegacyPetPalMessageComposerRecordsForIdentity(recordsRef.value, identity)
  if (adoptedRecords === recordsRef.value) {
    return null
  }

  recordsRef.value = adoptedRecords
  syncPersistedPetPalMessageComposerSnapshot()
  return getPetPalMessageComposerEntry(recordsRef.value, identity)
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
  const keysToClear = getPetPalMessageComposerKeysToClear(messageDrafts.value, identity)
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
  const resolvedIdentity = resolvePetPalMessageComposerIdentity(
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
    ...stripSharedPetPalMessageComposerRecord(messageDrafts.value, resolvedIdentity),
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
  const keysToClear = getPetPalMessageComposerKeysToClear(messageRecoveries.value, identity)
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
  const resolvedIdentity = resolvePetPalMessageComposerIdentity(
    identity,
    getPetPalMessageComposerScope(identity) ?? 'shared',
  )
  if (!resolvedIdentity) {
    return
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
  }
  syncPersistedPetPalMessageComposerSnapshot()
}
