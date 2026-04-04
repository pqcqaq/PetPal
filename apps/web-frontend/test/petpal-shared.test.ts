import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adoptLegacyPetPalMessageComposerSnapshot,
  adoptLegacyPetPalMessageComposerRecordsForIdentity,
  buildPetPalMessageComposerStorageKey,
  clearPetPalMessageComposerRecordsForIdentity,
  cloneManagedAttachmentRecords,
  clonePetPalMessageDraftState,
  compactPersistedPetPalMessageComposerRecords,
  createPersistedPetPalMessageComposerCompactionOptions,
  createPersistedPetPalMessageComposerParseOptions,
  createEmptyPersistedPetPalMessageComposerRecords,
  createManagedAttachmentRecord,
  createManagedAttachmentRecordFromMediaAsset,
  getPetPalMessageComposerEntry,
  getPetPalMessageComposerEntryWithLegacyAdoption,
  getPetPalMessageComposerKeysToClear,
  getPetPalMessageComposerScopeWithLegacyAdoption,
  parsePetPalMessageDraftState,
  parsePersistedPetPalMessageComposerSnapshot,
  parsePetPalMessageComposerStorageKey,
  parseManagedAttachmentRecord,
  parsePetPalMessageRecoveryState,
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
  PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT,
  PETPAL_CAREGIVER_QUALIFICATION_UPLOAD_MAX_COUNT,
  PETPAL_COMPLAINT_ATTACHMENT_MAX_COUNT,
  PETPAL_COMPLAINT_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS,
  PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_AGE_MS,
  PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_THREADS,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
  PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
  PETPAL_PENALTY_RECTIFY_ATTACHMENT_MAX_COUNT,
  PETPAL_PENALTY_RECTIFY_ATTACHMENT_SCOPE,
  PETPAL_PENALTY_RECTIFY_ATTACHMENT_TAG,
  PETPAL_SERVICE_LOG_ATTACHMENT_TAG,
  resolvePersistedPetPalMessageComposerIdentity,
  resolvePetPalMessageComposerIdentity,
  resolvePetPalMessageComposerRuntimeIdentity,
  toPublicPersistedPetPalMessageComposerSnapshot,
  upsertPersistedPetPalMessageDraftRecord,
  upsertPersistedPetPalMessageRecoveryRecord,
} from '@rbac/api-common';
import {
  getPetPalCaregiverAuditLabel,
  getPetPalComplaintSlaStatusLabel,
  petPalCaregiverAuditOptions,
  petPalComplaintSlaStatusOptions,
} from '../src/pages/frontend/petpal/shared.ts';

test('exposes complaint SLA options in a stable order for export forms', () => {
  assert.deepEqual(petPalComplaintSlaStatusOptions, [
    { label: 'SLA正常', value: 'NORMAL' },
    { label: '即将超时', value: 'DUE_SOON' },
    { label: '投诉已超时', value: 'OVERDUE' },
  ]);

  for (const option of petPalComplaintSlaStatusOptions) {
    assert.equal(getPetPalComplaintSlaStatusLabel(option.value), option.label);
  }
});

test('exposes caregiver audit options in a stable order for shared admin and frontend flows', () => {
  assert.deepEqual(petPalCaregiverAuditOptions, [
    { label: '待审核', value: 'PENDING' },
    { label: '已通过', value: 'APPROVED' },
    { label: '已驳回', value: 'REJECTED' },
  ]);

  assert.equal(getPetPalCaregiverAuditLabel('APPROVED'), '已通过');
  assert.equal(getPetPalCaregiverAuditLabel('REJECTED'), '已驳回');
});

test('exposes stable complaint attachment governance constants for web and app uploads', () => {
  assert.equal(PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG, 'petpal-order-complaint');
  assert.equal(PETPAL_COMPLAINT_ATTACHMENT_MAX_COUNT, 3);
  assert.equal(PETPAL_COMPLAINT_ATTACHMENT_MAX_SIZE_MB, 8);
});

test('exposes stable message and caregiver attachment governance constants for shared uploads', () => {
  assert.equal(PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG, 'petpal-order-message');
  assert.equal(PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT, 3);
  assert.equal(PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_MB, 8);

  assert.equal(PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG, 'petpal-caregiver-qualification');
  assert.equal(PETPAL_CAREGIVER_QUALIFICATION_UPLOAD_MAX_COUNT, 3);
  assert.equal(PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT, 12);
  assert.equal(PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_MAX_SIZE_MB, 8);
});

test('exposes stable service log and penalty attachment governance constants for shared uploads', () => {
  assert.equal(PETPAL_SERVICE_LOG_ATTACHMENT_TAG, 'petpal-service-log');
  assert.equal(PETPAL_PENALTY_RECTIFY_ATTACHMENT_TAG, 'petpal-penalty');
  assert.equal(PETPAL_PENALTY_RECTIFY_ATTACHMENT_SCOPE, 'rectify');
  assert.equal(PETPAL_PENALTY_RECTIFY_ATTACHMENT_MAX_COUNT, 10);
});

test('builds managed attachment records from upload metadata and media assets', () => {
  const fromUpload = createManagedAttachmentRecord({
    fileId: 'file-1',
    url: 'https://example.com/a.jpg',
    name: 'a.jpg',
    mimeType: 'image/jpeg',
    size: 123,
    uploadedAt: new Date('2026-04-04T10:00:00.000Z'),
  });

  assert.deepEqual(fromUpload, {
    fileId: 'file-1',
    url: 'https://example.com/a.jpg',
    name: 'a.jpg',
    mimeType: 'image/jpeg',
    size: 123,
    uploadedAt: '2026-04-04T10:00:00.000Z',
  });

  const fromAsset = createManagedAttachmentRecordFromMediaAsset({
    id: 'file-2',
    originalName: 'b.pdf',
    mimeType: 'application/pdf',
    size: 456,
    url: 'https://example.com/b.pdf',
    createdAt: '2026-04-04T09:00:00.000Z',
    completedAt: null,
  });

  assert.deepEqual(fromAsset, {
    fileId: 'file-2',
    url: 'https://example.com/b.pdf',
    name: 'b.pdf',
    mimeType: 'application/pdf',
    size: 456,
    uploadedAt: '2026-04-04T09:00:00.000Z',
  });
});

test('clones and parses managed attachment records with stable timestamps', () => {
  const original = [{
    fileId: 'file-3',
    url: 'https://example.com/c.png',
    name: 'c.png',
    mimeType: 'image/png',
    size: 789,
    uploadedAt: '2026-04-04T11:00:00.000Z',
  }];

  const cloned = cloneManagedAttachmentRecords(original);
  assert.deepEqual(cloned, original);
  assert.notEqual(cloned, original);
  assert.notEqual(cloned[0], original[0]);

  const parsedWithFallback = parseManagedAttachmentRecord({
    fileId: 'file-4',
    url: 'https://example.com/d.png',
    name: 'd.png',
    mimeType: 'image/png',
    size: 321,
  }, {
    fallbackUploadedAt: new Date('2026-04-04T12:00:00.000Z'),
  });

  assert.deepEqual(parsedWithFallback, {
    fileId: 'file-4',
    url: 'https://example.com/d.png',
    name: 'd.png',
    mimeType: 'image/png',
    size: 321,
    uploadedAt: '2026-04-04T12:00:00.000Z',
  });
});

test('clones and parses petpal message draft and recovery states', () => {
  const parsedDraft = parsePetPalMessageDraftState({
    content: 'Need a quick update',
    attachments: [{
      fileId: 'file-5',
      url: 'https://example.com/e.png',
      name: 'e.png',
      mimeType: 'image/png',
      size: 456,
    }],
  }, {
    fallbackUploadedAt: '2026-04-04T13:00:00.000Z',
  });

  assert.deepEqual(parsedDraft, {
    content: 'Need a quick update',
    attachments: [{
      fileId: 'file-5',
      url: 'https://example.com/e.png',
      name: 'e.png',
      mimeType: 'image/png',
      size: 456,
      uploadedAt: '2026-04-04T13:00:00.000Z',
    }],
  });

  const clonedDraft = clonePetPalMessageDraftState(parsedDraft!);
  assert.deepEqual(clonedDraft, parsedDraft);
  assert.notEqual(clonedDraft, parsedDraft);
  assert.notEqual(clonedDraft.attachments, parsedDraft?.attachments);
  assert.notEqual(clonedDraft.attachments[0], parsedDraft?.attachments[0]);

  assert.deepEqual(parsePetPalMessageRecoveryState({
    stage: 'upload',
    message: 'Upload failed',
  }), {
    stage: 'upload',
    message: 'Upload failed',
  });
});

test('builds and resolves petpal message composer identities in a stable way', () => {
  const ownerKey = buildPetPalMessageComposerStorageKey({
    orderId: 'order-1',
    userId: 'user-1',
    scope: 'owner',
  });

  assert.equal(ownerKey, 'petpal-message-composer::order=order-1::scope=owner::user=user-1');
  assert.deepEqual(parsePetPalMessageComposerStorageKey(ownerKey), {
    orderId: 'order-1',
    userId: 'user-1',
    scope: 'owner',
  });
  assert.deepEqual(resolvePetPalMessageComposerIdentity({
    orderId: ' order-1 ',
    userId: ' user-1 ',
    scope: 'owner',
  }), {
    orderId: 'order-1',
    userId: 'user-1',
    scope: 'owner',
  });
  assert.deepEqual(resolvePersistedPetPalMessageComposerIdentity('order-legacy', {
    userId: ' user-2 ',
    scope: 'caregiver',
  }), {
    orderId: 'order-legacy',
    userId: 'user-2',
    scope: 'caregiver',
  });
});

test('exposes stable persisted petpal message composer retention defaults', () => {
  assert.equal(PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_THREADS, 12);
  assert.equal(PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_PERSISTED_AGE_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(PETPAL_MESSAGE_COMPOSER_DEFAULT_MAX_LEGACY_ANONYMOUS_PERSISTED_AGE_MS, 24 * 60 * 60 * 1000);

  assert.deepEqual(createPersistedPetPalMessageComposerCompactionOptions({
    now: 123,
  }), {
    now: 123,
    maxPersistedThreads: 12,
    maxPersistedAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxLegacyAnonymousPersistedAgeMs: 24 * 60 * 60 * 1000,
  });

  assert.deepEqual(createPersistedPetPalMessageComposerParseOptions({
    now: 456,
    fallbackDraftAttachmentUploadedAtToNow: true,
  }), {
    now: 456,
    maxPersistedThreads: 12,
    maxPersistedAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxLegacyAnonymousPersistedAgeMs: 24 * 60 * 60 * 1000,
    fallbackDraftAttachmentUploadedAtToNow: true,
  });
});

test('adopts legacy message composer records and clears scoped keys predictably', () => {
  const sharedKey = buildPetPalMessageComposerStorageKey({
    orderId: 'order-2',
    userId: 'user-9',
    scope: 'shared',
  });
  const ownerKey = buildPetPalMessageComposerStorageKey({
    orderId: 'order-2',
    userId: 'user-9',
    scope: 'owner',
  });
  const adopted = adoptLegacyPetPalMessageComposerRecordsForIdentity({
    'order-2': {
      orderId: 'order-2',
      userId: '',
      scope: 'shared',
      updatedAt: '2026-04-04T14:00:00.000Z',
      stage: 'upload',
      message: 'retry',
    },
  }, {
    orderId: 'order-2',
    userId: 'user-9',
    scope: 'owner',
  });

  assert.equal(getPetPalMessageComposerEntry(adopted, {
    orderId: 'order-2',
    userId: 'user-9',
    scope: 'owner',
  })?.[0], ownerKey);
  assert.equal(adopted[ownerKey]?.userId, 'user-9');
  assert.equal(adopted[sharedKey], undefined);
  assert.deepEqual(
    getPetPalMessageComposerKeysToClear({
      [sharedKey]: {
        orderId: 'order-2',
        userId: 'user-9',
        scope: 'shared',
        updatedAt: '2026-04-04T14:00:00.000Z',
        stage: 'upload',
        message: 'retry',
      },
      [ownerKey]: {
        orderId: 'order-2',
        userId: 'user-9',
        scope: 'owner',
        updatedAt: '2026-04-04T14:01:00.000Z',
        stage: 'send',
        message: 'send again',
      },
    }, {
      orderId: 'order-2',
      userId: 'user-9',
      scope: 'owner',
    }).sort(),
    [ownerKey, sharedKey].sort(),
  );
});

test('resolves petpal message composer entries with legacy adoption when needed', () => {
  const legacySharedKey = buildPetPalMessageComposerStorageKey({
    orderId: 'order-legacy-entry',
    userId: '',
    scope: 'shared',
  });
  const records = {
    [legacySharedKey]: {
      orderId: 'order-legacy-entry',
      userId: '',
      scope: 'shared',
      updatedAt: '2026-04-04T09:00:00.000Z',
      content: 'legacy draft',
      attachments: [],
    },
  };

  const resolved = getPetPalMessageComposerEntryWithLegacyAdoption(records, {
    orderId: 'order-legacy-entry',
    userId: 'user-1',
    scope: 'owner',
  });

  assert.deepEqual(resolved.entry, [
    buildPetPalMessageComposerStorageKey({
      orderId: 'order-legacy-entry',
      userId: 'user-1',
      scope: 'owner',
    }),
    {
      orderId: 'order-legacy-entry',
      userId: 'user-1',
      scope: 'owner',
      updatedAt: '2026-04-04T09:00:00.000Z',
      content: 'legacy draft',
      attachments: [],
    },
  ]);
  assert.deepEqual(resolved.records, {
    [buildPetPalMessageComposerStorageKey({
      orderId: 'order-legacy-entry',
      userId: 'user-1',
      scope: 'owner',
    })]: {
      orderId: 'order-legacy-entry',
      userId: 'user-1',
      scope: 'owner',
      updatedAt: '2026-04-04T09:00:00.000Z',
      content: 'legacy draft',
      attachments: [],
    },
  });
});

test('upserts and clears persisted petpal message composer records predictably', () => {
  const ownerIdentity = {
    orderId: 'order-mutate',
    userId: 'user-1',
    scope: 'owner',
  } as const;
  const sharedIdentity = {
    orderId: 'order-mutate',
    userId: 'user-1',
    scope: 'shared',
  } as const;

  const draftRecords = upsertPersistedPetPalMessageDraftRecord({
    [buildPetPalMessageComposerStorageKey(sharedIdentity)]: {
      orderId: 'order-mutate',
      userId: 'user-1',
      scope: 'shared',
      updatedAt: '2026-04-04T08:00:00.000Z',
      content: 'shared draft',
      attachments: [],
    },
  }, ownerIdentity, {
    content: 'owner draft',
    attachments: [],
  }, {
    updatedAt: '2026-04-04T10:00:00.000Z',
  });

  assert.deepEqual(draftRecords, {
    [buildPetPalMessageComposerStorageKey(ownerIdentity)]: {
      orderId: 'order-mutate',
      userId: 'user-1',
      scope: 'owner',
      updatedAt: '2026-04-04T10:00:00.000Z',
      content: 'owner draft',
      attachments: [],
    },
  });

  const recoveryRecords = upsertPersistedPetPalMessageRecoveryRecord({
    [buildPetPalMessageComposerStorageKey(sharedIdentity)]: {
      orderId: 'order-mutate',
      userId: 'user-1',
      scope: 'shared',
      updatedAt: '2026-04-04T08:30:00.000Z',
      stage: 'upload',
      message: 'shared recovery',
    },
  }, ownerIdentity, {
    stage: 'send',
    message: 'owner recovery',
  }, {
    updatedAt: '2026-04-04T10:30:00.000Z',
  });

  assert.deepEqual(recoveryRecords, {
    [buildPetPalMessageComposerStorageKey(ownerIdentity)]: {
      orderId: 'order-mutate',
      userId: 'user-1',
      scope: 'owner',
      updatedAt: '2026-04-04T10:30:00.000Z',
      stage: 'send',
      message: 'owner recovery',
    },
  });

  assert.deepEqual(clearPetPalMessageComposerRecordsForIdentity({
    ...draftRecords,
    [buildPetPalMessageComposerStorageKey(sharedIdentity)]: {
      orderId: 'order-mutate',
      userId: 'user-1',
      scope: 'shared',
      updatedAt: '2026-04-04T07:00:00.000Z',
      content: 'older shared draft',
      attachments: [],
    },
  }, ownerIdentity), {});
});

test('resolves petpal message composer scope and runtime identity with legacy adoption', () => {
  const sharedLegacyDrafts = {
    [buildPetPalMessageComposerStorageKey({
      orderId: 'order-runtime',
      userId: '',
      scope: 'shared',
    })]: {
      orderId: 'order-runtime',
      userId: '',
      scope: 'shared',
      updatedAt: '2026-04-04T09:00:00.000Z',
      content: 'legacy runtime draft',
      attachments: [],
    },
  };

  const scopeResolved = getPetPalMessageComposerScopeWithLegacyAdoption(
    {},
    {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-runtime-2',
        userId: '',
        scope: 'caregiver',
      })]: {
        orderId: 'order-runtime-2',
        userId: '',
        scope: 'caregiver',
        updatedAt: '2026-04-04T09:30:00.000Z',
        stage: 'send',
        message: 'legacy runtime recovery',
      },
    },
    {
      orderId: 'order-runtime-2',
      userId: 'user-2',
      scope: 'caregiver',
    },
  );
  assert.equal(scopeResolved.scope, 'caregiver');

  const runtimeResolved = resolvePetPalMessageComposerRuntimeIdentity(
    sharedLegacyDrafts,
    {},
    {
      orderId: 'order-runtime',
      userId: 'user-1',
      scope: 'owner',
    },
  );

  assert.deepEqual(runtimeResolved.resolvedIdentity, {
    orderId: 'order-runtime',
    userId: 'user-1',
    scope: 'owner',
  });
  assert.deepEqual(runtimeResolved.drafts, {
    [buildPetPalMessageComposerStorageKey({
      orderId: 'order-runtime',
      userId: 'user-1',
      scope: 'owner',
    })]: {
      orderId: 'order-runtime',
      userId: 'user-1',
      scope: 'owner',
      updatedAt: '2026-04-04T09:00:00.000Z',
      content: 'legacy runtime draft',
      attachments: [],
    },
  });
});

test('creates, compacts and exposes persisted petpal message composer snapshots', () => {
  assert.deepEqual(createEmptyPersistedPetPalMessageComposerRecords(), {
    drafts: {},
    recoveries: {},
  });

  const compacted = compactPersistedPetPalMessageComposerRecords({
    drafts: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-old',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        orderId: 'order-old',
        userId: 'user-1',
        scope: 'owner',
        updatedAt: '2026-03-20T00:00:00.000Z',
        content: 'old',
        attachments: [],
      },
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-new',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        orderId: 'order-new',
        userId: 'user-1',
        scope: 'owner',
        updatedAt: '2026-04-04T11:00:00.000Z',
        content: 'new',
        attachments: [],
      },
    },
    recoveries: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-new',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        orderId: 'order-new',
        userId: 'user-1',
        scope: 'owner',
        updatedAt: '2026-04-04T11:30:00.000Z',
        stage: 'send',
        message: 'retry',
      },
    },
  }, {
    now: Date.parse('2026-04-04T12:00:00.000Z'),
    maxPersistedThreads: 12,
    maxPersistedAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxLegacyAnonymousPersistedAgeMs: 24 * 60 * 60 * 1000,
  });

  assert.deepEqual(toPublicPersistedPetPalMessageComposerSnapshot(compacted), {
    drafts: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-new',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        content: 'new',
        attachments: [],
      },
    },
    recoveries: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-new',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        stage: 'send',
        message: 'retry',
      },
    },
  });
});

test('parses persisted petpal message composer snapshots with optional draft upload fallback', () => {
  const rawValue = JSON.stringify({
    drafts: {
      'order-legacy': {
        attachments: [
          {
            fileId: 'file-legacy',
            url: 'https://cdn.example.com/legacy.png',
            name: 'legacy.png',
            size: 1024,
            mimeType: 'image/png',
          },
        ],
      },
    },
    recoveries: {
      'order-legacy': {
        stage: 'send',
        message: 'retry later',
      },
    },
  });
  const sharedOptions = {
    now: Date.parse('2026-04-04T12:00:00.000Z'),
    maxPersistedThreads: 12,
    maxPersistedAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxLegacyAnonymousPersistedAgeMs: 24 * 60 * 60 * 1000,
  };

  assert.deepEqual(parsePersistedPetPalMessageComposerSnapshot(rawValue, sharedOptions), {
    drafts: {},
    recoveries: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-legacy',
        userId: '',
        scope: 'shared',
      })]: {
        stage: 'send',
        message: 'retry later',
      },
    },
  });

  assert.deepEqual(parsePersistedPetPalMessageComposerSnapshot(rawValue, {
    ...sharedOptions,
    fallbackDraftAttachmentUploadedAtToNow: true,
  }), {
    drafts: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-legacy',
        userId: '',
        scope: 'shared',
      })]: {
        content: '',
        attachments: [
          {
            fileId: 'file-legacy',
            url: 'https://cdn.example.com/legacy.png',
            name: 'legacy.png',
            size: 1024,
            mimeType: 'image/png',
            uploadedAt: '2026-04-04T12:00:00.000Z',
          },
        ],
      },
    },
    recoveries: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-legacy',
        userId: '',
        scope: 'shared',
      })]: {
        stage: 'send',
        message: 'retry later',
      },
    },
  });
});

test('adopts legacy persisted petpal message composer snapshots for scoped identities', () => {
  assert.deepEqual(adoptLegacyPetPalMessageComposerSnapshot({
    drafts: {
      'order-adopt': {
        content: 'legacy draft',
        attachments: [],
      },
    },
    recoveries: {
      'order-adopt': {
        stage: 'upload',
        message: 'legacy recovery',
      },
    },
  }, {
    orderId: 'order-adopt',
    userId: 'user-1',
    scope: 'owner',
  }, {
    now: Date.parse('2026-04-04T12:00:00.000Z'),
    maxPersistedThreads: 12,
    maxPersistedAgeMs: 7 * 24 * 60 * 60 * 1000,
    maxLegacyAnonymousPersistedAgeMs: 24 * 60 * 60 * 1000,
  }), {
    drafts: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-adopt',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        content: 'legacy draft',
        attachments: [],
      },
    },
    recoveries: {
      [buildPetPalMessageComposerStorageKey({
        orderId: 'order-adopt',
        userId: 'user-1',
        scope: 'owner',
      })]: {
        stage: 'upload',
        message: 'legacy recovery',
      },
    },
  });
});

test('rejects managed attachment media assets without an accessible url', () => {
  assert.throws(() => createManagedAttachmentRecordFromMediaAsset({
    id: 'file-3',
    originalName: 'missing-url.png',
    mimeType: 'image/png',
    size: 789,
    url: '   ',
    createdAt: '2026-04-04T09:30:00.000Z',
    completedAt: null,
  }), /Managed attachment requires an accessible url/);
});
