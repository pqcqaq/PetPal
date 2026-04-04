import {
  adoptLegacyPetPalMessageComposerSnapshot as adoptSharedPetPalMessageComposerSnapshot,
  buildPetPalMessageComposerStorageKey as buildSharedPetPalMessageComposerStorageKey,
  cloneManagedAttachmentRecords,
  clonePetPalMessageDraftState as cloneSharedPetPalMessageDraftState,
  compactPersistedPetPalMessageComposerRecords as compactSharedPersistedPetPalMessageComposerRecords,
  clearPetPalMessageComposerRecordsForIdentity,
  createPersistedPetPalMessageComposerCompactionOptions,
  createPersistedPetPalMessageComposerParseOptions,
  createEmptyPersistedPetPalMessageComposerRecords,
  getPetPalMessageComposerEntryWithLegacyAdoption,
  getPetPalMessageComposerScopeWithLegacyAdoption,
  parsePersistedPetPalMessageComposerRecords as parseSharedPersistedPetPalMessageComposerRecords,
  parsePersistedPetPalMessageComposerSnapshot as parseSharedPersistedPetPalMessageComposerSnapshot,
  resolvePetPalMessageComposerRuntimeIdentity,
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
  upsertPersistedPetPalMessageDraftRecord,
  upsertPersistedPetPalMessageRecoveryRecord,
} from '@rbac/api-common'
import { ref } from 'vue'

export type PetPalMessageDraftAttachment = ManagedAttachmentRecord

export type PetPalMessageDraftState = SharedPetPalMessageDraftState
export type PetPalMessageRecoveryStage = SharedPetPalMessageRecoveryStage
export type PetPalMessageRecoveryState = SharedPetPalMessageRecoveryState

export type PetPalMessageComposerScope = SharedPetPalMessageComposerScope
export type PetPalMessageComposerIdentity = SharedPetPalMessageComposerIdentity

export type PersistedPetPalMessageComposerSnapshot = SharedPersistedPetPalMessageComposerSnapshot

type PersistedPetPalMessageDraftRecord = SharedPersistedPetPalMessageDraftRecord

type PersistedPetPalMessageRecoveryRecord = SharedPersistedPetPalMessageRecoveryRecord

type PersistedPetPalMessageComposerRecords = SharedPersistedPetPalMessageComposerRecords

const STORAGE_KEY = 'petpal-message-composer-state-v1'

export const buildPetPalMessageComposerStorageKey = buildSharedPetPalMessageComposerStorageKey

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  cloneManagedAttachmentRecords(attachments)

const cloneMessageDraftState = (draft: PetPalMessageDraftState): PetPalMessageDraftState =>
  cloneSharedPetPalMessageDraftState(draft)

export function parsePersistedPetPalMessageComposerSnapshot(
  rawValue: unknown,
  options: {
    now?: number
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  return parseSharedPersistedPetPalMessageComposerSnapshot(
    rawValue,
    createPersistedPetPalMessageComposerParseOptions({
      now: options.now,
    }),
  )
}

export function adoptLegacyPetPalMessageComposerSnapshot(
  rawValue: unknown,
  identity: PetPalMessageComposerIdentity,
  options: {
    now?: number
  } = {},
): PersistedPetPalMessageComposerSnapshot {
  return adoptSharedPetPalMessageComposerSnapshot(
    rawValue,
    identity,
    createPersistedPetPalMessageComposerParseOptions({
      now: options.now,
    }),
  )
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
    return parseSharedPersistedPetPalMessageComposerRecords(
      rawValue,
      createPersistedPetPalMessageComposerParseOptions({
        now,
      }),
    )
  }
  catch {
    return createEmptyPersistedPetPalMessageComposerRecords()
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
    return createEmptyPersistedPetPalMessageComposerRecords()
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
    const compactedSnapshot = compactSharedPersistedPetPalMessageComposerRecords({
      drafts: messageDrafts.value,
      recoveries: messageRecoveries.value,
    }, createPersistedPetPalMessageComposerCompactionOptions())

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
  const resolved = getPetPalMessageComposerEntryWithLegacyAdoption(recordsRef.value, identity)
  if (resolved.records !== recordsRef.value) {
    recordsRef.value = resolved.records
    syncPersistedPetPalMessageComposerSnapshot()
  }
  return resolved.entry
}

const applyResolvedMessageComposerRecords = (
  resolved: {
    drafts: Record<string, PersistedPetPalMessageDraftRecord>
    recoveries: Record<string, PersistedPetPalMessageRecoveryRecord>
  },
) => {
  let didChange = false
  if (resolved.drafts !== messageDrafts.value) {
    messageDrafts.value = resolved.drafts
    didChange = true
  }
  if (resolved.recoveries !== messageRecoveries.value) {
    messageRecoveries.value = resolved.recoveries
    didChange = true
  }
  if (didChange) {
    syncPersistedPetPalMessageComposerSnapshot()
  }
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
  const nextDrafts = clearPetPalMessageComposerRecordsForIdentity(messageDrafts.value, identity)
  if (nextDrafts === messageDrafts.value) {
    return
  }

  messageDrafts.value = nextDrafts
  syncPersistedPetPalMessageComposerSnapshot()
}

export function getPetPalMessageComposerScope(identity: PetPalMessageComposerIdentity): PetPalMessageComposerScope | null {
  const resolved = getPetPalMessageComposerScopeWithLegacyAdoption(
    messageDrafts.value,
    messageRecoveries.value,
    identity,
  )
  applyResolvedMessageComposerRecords(resolved)
  return resolved.scope
}

export function persistPetPalMessageDraft(
  identity: PetPalMessageComposerIdentity,
  content: string,
  attachments: PetPalMessageDraftAttachment[],
) {
  const resolvedRuntime = resolvePetPalMessageComposerRuntimeIdentity(
    messageDrafts.value,
    messageRecoveries.value,
    identity,
  )
  applyResolvedMessageComposerRecords(resolvedRuntime)
  const resolvedIdentity = resolvedRuntime.resolvedIdentity
  if (!resolvedIdentity) {
    return
  }

  const nextAttachments = cloneMessageDraftAttachments(attachments)
  const hasDraft = content.trim().length > 0 || nextAttachments.length > 0
  if (!hasDraft) {
    clearPetPalMessageDraft(resolvedIdentity)
    return
  }

  messageDrafts.value = upsertPersistedPetPalMessageDraftRecord(messageDrafts.value, resolvedIdentity, {
    content,
    attachments: nextAttachments,
  })
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
  const nextRecoveries = clearPetPalMessageComposerRecordsForIdentity(messageRecoveries.value, identity)
  if (nextRecoveries === messageRecoveries.value) {
    return
  }

  messageRecoveries.value = nextRecoveries
  syncPersistedPetPalMessageComposerSnapshot()
}

export function setPetPalMessageRecovery(
  identity: PetPalMessageComposerIdentity,
  stage: PetPalMessageRecoveryStage,
  message: string,
) {
  const resolvedRuntime = resolvePetPalMessageComposerRuntimeIdentity(
    messageDrafts.value,
    messageRecoveries.value,
    identity,
  )
  applyResolvedMessageComposerRecords(resolvedRuntime)
  const resolvedIdentity = resolvedRuntime.resolvedIdentity
  if (!resolvedIdentity) {
    return
  }

  messageRecoveries.value = upsertPersistedPetPalMessageRecoveryRecord(messageRecoveries.value, resolvedIdentity, {
    stage,
    message,
  })
  syncPersistedPetPalMessageComposerSnapshot()
}
