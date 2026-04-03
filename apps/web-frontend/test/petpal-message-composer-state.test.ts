import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adoptLegacyPetPalMessageComposerSnapshot,
  buildPetPalMessageComposerStorageKey,
  parsePersistedPetPalMessageComposerSnapshot,
  warmupPetPalMessageComposerPersistence,
} from '../src/pages/frontend/petpal/message-composer-state.ts';

const sharedKey = (orderId: string, userId = '') =>
  buildPetPalMessageComposerStorageKey({
    orderId,
    userId,
    scope: 'shared',
  });

const ownerKey = (orderId: string, userId: string) =>
  buildPetPalMessageComposerStorageKey({
    orderId,
    userId,
    scope: 'owner',
  });

const caregiverKey = (orderId: string, userId: string) =>
  buildPetPalMessageComposerStorageKey({
    orderId,
    userId,
    scope: 'caregiver',
  });

test('parses persisted petpal message composer snapshots from legacy JSON strings', () => {
  const snapshot = parsePersistedPetPalMessageComposerSnapshot(JSON.stringify({
    drafts: {
      'order-1': {
        content: 'Need an update before pickup',
        attachments: [
          {
            fileId: 'file-1',
            url: 'https://cdn.example.com/message-1.png',
            name: 'message-1.png',
            size: 2048,
            mimeType: 'image/png',
          },
        ],
      },
    },
    recoveries: {
      'order-1': {
        stage: 'send',
        message: 'Network failed while sending',
      },
    },
  }));

  assert.deepEqual(snapshot, {
    drafts: {
      [sharedKey('order-1')]: {
        content: 'Need an update before pickup',
        attachments: [
          {
            fileId: 'file-1',
            url: 'https://cdn.example.com/message-1.png',
            name: 'message-1.png',
            size: 2048,
            mimeType: 'image/png',
          },
        ],
      },
    },
    recoveries: {
      [sharedKey('order-1')]: {
        stage: 'send',
        message: 'Network failed while sending',
      },
    },
  });
});

test('adopts anonymous legacy shared snapshots to current user identity', () => {
  const snapshot = adoptLegacyPetPalMessageComposerSnapshot({
    drafts: {
      'order-1': {
        content: 'Legacy shared draft',
        attachments: [],
      },
    },
    recoveries: {
      'order-1': {
        stage: 'send',
        message: 'Legacy shared recovery',
      },
    },
  }, {
    orderId: 'order-1',
    userId: 'user-1',
    scope: 'owner',
  });

  assert.deepEqual(snapshot, {
    drafts: {
      [ownerKey('order-1', 'user-1')]: {
        content: 'Legacy shared draft',
        attachments: [],
      },
    },
    recoveries: {
      [ownerKey('order-1', 'user-1')]: {
        stage: 'send',
        message: 'Legacy shared recovery',
      },
    },
  });
});

test('adopts anonymous scoped snapshots without losing their original scope', () => {
  const snapshot = adoptLegacyPetPalMessageComposerSnapshot({
    drafts: {
      [caregiverKey('order-2', '')]: {
        orderId: 'order-2',
        userId: '',
        content: 'Legacy caregiver draft',
        attachments: [],
        updatedAt: '2026-04-08T10:00:00.000Z',
        scope: 'caregiver',
      },
    },
    recoveries: {
      [caregiverKey('order-2', '')]: {
        orderId: 'order-2',
        userId: '',
        stage: 'upload',
        message: 'Legacy caregiver recovery',
        updatedAt: '2026-04-08T10:30:00.000Z',
        scope: 'caregiver',
      },
    },
  }, {
    orderId: 'order-2',
    userId: 'user-2',
  }, {
    now: Date.parse('2026-04-08T12:00:00.000Z'),
  });

  assert.deepEqual(snapshot, {
    drafts: {
      [caregiverKey('order-2', 'user-2')]: {
        content: 'Legacy caregiver draft',
        attachments: [],
      },
    },
    recoveries: {
      [caregiverKey('order-2', 'user-2')]: {
        stage: 'upload',
        message: 'Legacy caregiver recovery',
      },
    },
  });
});

test('drops malformed petpal message composer drafts and recovery entries', () => {
  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts: {
      '': {
        content: 'missing-order-id',
        attachments: [],
      },
      'order-empty': {
        content: '   ',
        attachments: [],
      },
      'order-bad-attachment': {
        content: '',
        attachments: [
          {
            fileId: 'file-2',
            url: '',
            name: 'bad.png',
            size: 64,
            mimeType: 'image/png',
          },
        ],
      },
      'order-valid': {
        content: '',
        attachments: [
          {
            fileId: 'file-3',
            url: 'https://cdn.example.com/message-3.png',
            name: 'message-3.png',
            size: 64,
            mimeType: 'image/png',
          },
        ],
      },
    },
    recoveries: {
      'order-bad-recovery': {
        stage: 'retry',
        message: 'should not survive',
      },
      'order-empty-message': {
        stage: 'upload',
        message: '   ',
      },
      'order-valid': {
        stage: 'upload',
        message: 'Need to reselect the image',
      },
    },
  });

  assert.deepEqual(snapshot, {
    drafts: {
      [sharedKey('order-valid')]: {
        content: '',
        attachments: [
          {
            fileId: 'file-3',
            url: 'https://cdn.example.com/message-3.png',
            name: 'message-3.png',
            size: 64,
            mimeType: 'image/png',
          },
        ],
      },
    },
    recoveries: {
      [sharedKey('order-valid')]: {
        stage: 'upload',
        message: 'Need to reselect the image',
      },
    },
  });
});

test('drops stale persisted petpal message composer entries', () => {
  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts: {
      [ownerKey('order-stale', 'user-1')]: {
        orderId: 'order-stale',
        userId: 'user-1',
        content: 'old draft',
        attachments: [],
        updatedAt: '2026-04-01T00:00:00.000Z',
        scope: 'owner',
      },
      [ownerKey('order-fresh', 'user-1')]: {
        orderId: 'order-fresh',
        userId: 'user-1',
        content: 'fresh draft',
        attachments: [],
        updatedAt: '2026-04-08T00:00:00.000Z',
        scope: 'owner',
      },
    },
    recoveries: {
      [ownerKey('order-fresh', 'user-1')]: {
        orderId: 'order-fresh',
        userId: 'user-1',
        stage: 'send',
        message: 'retry me',
        updatedAt: '2026-04-08T00:00:00.000Z',
        scope: 'owner',
      },
    },
  }, {
    now: Date.parse('2026-04-08T12:00:00.000Z'),
  });

  assert.deepEqual(snapshot, {
    drafts: {
      [ownerKey('order-fresh', 'user-1')]: {
        content: 'fresh draft',
        attachments: [],
      },
    },
    recoveries: {
      [ownerKey('order-fresh', 'user-1')]: {
        stage: 'send',
        message: 'retry me',
      },
    },
  });
});

test('drops stale anonymous legacy snapshots earlier than user scoped entries', () => {
  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts: {
      [sharedKey('order-legacy')]: {
        orderId: 'order-legacy',
        userId: '',
        content: 'legacy anonymous draft',
        attachments: [],
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'shared',
      },
      [ownerKey('order-user', 'user-1')]: {
        orderId: 'order-user',
        userId: 'user-1',
        content: 'user scoped draft',
        attachments: [],
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'owner',
      },
    },
    recoveries: {
      [sharedKey('order-legacy')]: {
        orderId: 'order-legacy',
        userId: '',
        stage: 'upload',
        message: 'legacy anonymous recovery',
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'shared',
      },
      [ownerKey('order-user', 'user-1')]: {
        orderId: 'order-user',
        userId: 'user-1',
        stage: 'send',
        message: 'user scoped recovery',
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'owner',
      },
    },
  }, {
    now: Date.parse('2026-04-08T12:00:00.000Z'),
  });

  assert.deepEqual(snapshot, {
    drafts: {
      [ownerKey('order-user', 'user-1')]: {
        content: 'user scoped draft',
        attachments: [],
      },
    },
    recoveries: {
      [ownerKey('order-user', 'user-1')]: {
        stage: 'send',
        message: 'user scoped recovery',
      },
    },
  });
});

test('warmup proactively compacts stale anonymous legacy snapshots in storage', () => {
  let storedValue: string | null = JSON.stringify({
    drafts: {
      [sharedKey('order-legacy')]: {
        orderId: 'order-legacy',
        userId: '',
        content: 'legacy anonymous draft',
        attachments: [],
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'shared',
      },
      [ownerKey('order-user', 'user-1')]: {
        orderId: 'order-user',
        userId: 'user-1',
        content: 'user scoped draft',
        attachments: [],
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'owner',
      },
    },
    recoveries: {
      [sharedKey('order-legacy')]: {
        orderId: 'order-legacy',
        userId: '',
        stage: 'upload',
        message: 'legacy anonymous recovery',
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'shared',
      },
      [ownerKey('order-user', 'user-1')]: {
        orderId: 'order-user',
        userId: 'user-1',
        stage: 'send',
        message: 'user scoped recovery',
        updatedAt: '2026-04-07T00:00:00.000Z',
        scope: 'owner',
      },
    },
  });
  let removedCount = 0;
  const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem() {
          return storedValue;
        },
        setItem(_key: string, value: string) {
          storedValue = value;
        },
        removeItem() {
          removedCount += 1;
          storedValue = null;
        },
      },
    },
  });

  try {
    warmupPetPalMessageComposerPersistence({
      now: Date.parse('2026-04-08T12:00:00.000Z'),
    });

    assert.equal(removedCount, 0);
    assert.ok(storedValue);
    assert.deepEqual(parsePersistedPetPalMessageComposerSnapshot(storedValue), {
      drafts: {
        [ownerKey('order-user', 'user-1')]: {
          content: 'user scoped draft',
          attachments: [],
        },
      },
      recoveries: {
        [ownerKey('order-user', 'user-1')]: {
          stage: 'send',
          message: 'user scoped recovery',
        },
      },
    });

    storedValue = null;
    warmupPetPalMessageComposerPersistence({
      now: Date.parse('2026-04-08T12:00:00.000Z'),
    });
    assert.equal(removedCount, 1);
  } finally {
    if (previousWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: previousWindow,
      });
    }
  }
});

test('keeps only the newest persisted petpal message composer threads per user and scope', () => {
  const drafts = Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [
      ownerKey(`order-${index + 1}`, 'user-1'),
      {
        orderId: `order-${index + 1}`,
        userId: 'user-1',
        content: `draft-${index + 1}`,
        attachments: [],
        updatedAt: `2026-04-08T${String(index).padStart(2, '0')}:00:00.000Z`,
        scope: 'owner',
      },
    ]),
  );

  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts,
    recoveries: {},
  }, {
    now: Date.parse('2026-04-08T14:30:00.000Z'),
  });

  assert.deepEqual(Object.keys(snapshot.drafts), [
    ownerKey('order-3', 'user-1'),
    ownerKey('order-4', 'user-1'),
    ownerKey('order-5', 'user-1'),
    ownerKey('order-6', 'user-1'),
    ownerKey('order-7', 'user-1'),
    ownerKey('order-8', 'user-1'),
    ownerKey('order-9', 'user-1'),
    ownerKey('order-10', 'user-1'),
    ownerKey('order-11', 'user-1'),
    ownerKey('order-12', 'user-1'),
    ownerKey('order-13', 'user-1'),
    ownerKey('order-14', 'user-1'),
  ]);
});

test('keeps persisted petpal message composer threads independently per scope', () => {
  const drafts = Object.fromEntries([
    ...Array.from({ length: 14 }, (_, index) => [
      ownerKey(`owner-order-${index + 1}`, 'user-1'),
      {
        orderId: `owner-order-${index + 1}`,
        userId: 'user-1',
        content: `owner-draft-${index + 1}`,
        attachments: [],
        updatedAt: `2026-04-08T${String(index).padStart(2, '0')}:00:00.000Z`,
        scope: 'owner',
      },
    ]),
    ...Array.from({ length: 14 }, (_, index) => [
      caregiverKey(`caregiver-order-${index + 1}`, 'user-1'),
      {
        orderId: `caregiver-order-${index + 1}`,
        userId: 'user-1',
        content: `caregiver-draft-${index + 1}`,
        attachments: [],
        updatedAt: `2026-04-09T${String(index).padStart(2, '0')}:00:00.000Z`,
        scope: 'caregiver',
      },
    ]),
  ]);

  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts,
    recoveries: {},
  }, {
    now: Date.parse('2026-04-09T14:30:00.000Z'),
  });

  assert.equal(Object.keys(snapshot.drafts).length, 24);
  assert.equal(snapshot.drafts[ownerKey('owner-order-1', 'user-1')], undefined);
  assert.equal(snapshot.drafts[ownerKey('owner-order-2', 'user-1')], undefined);
  assert.equal(snapshot.drafts[caregiverKey('caregiver-order-1', 'user-1')], undefined);
  assert.equal(snapshot.drafts[caregiverKey('caregiver-order-2', 'user-1')], undefined);
  assert.equal(snapshot.drafts[ownerKey('owner-order-3', 'user-1')]?.content, 'owner-draft-3');
  assert.equal(snapshot.drafts[ownerKey('owner-order-14', 'user-1')]?.content, 'owner-draft-14');
  assert.equal(snapshot.drafts[caregiverKey('caregiver-order-3', 'user-1')]?.content, 'caregiver-draft-3');
  assert.equal(snapshot.drafts[caregiverKey('caregiver-order-14', 'user-1')]?.content, 'caregiver-draft-14');
});

test('keeps same-order drafts independently per user identity', () => {
  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts: {
      [ownerKey('order-1', 'user-1')]: {
        orderId: 'order-1',
        userId: 'user-1',
        content: 'owner one draft',
        attachments: [],
        updatedAt: '2026-04-08T10:00:00.000Z',
        scope: 'owner',
      },
      [ownerKey('order-1', 'user-2')]: {
        orderId: 'order-1',
        userId: 'user-2',
        content: 'owner two draft',
        attachments: [],
        updatedAt: '2026-04-08T11:00:00.000Z',
        scope: 'owner',
      },
    },
    recoveries: {
      [ownerKey('order-1', 'user-1')]: {
        orderId: 'order-1',
        userId: 'user-1',
        stage: 'send',
        message: 'user one retry',
        updatedAt: '2026-04-08T10:30:00.000Z',
        scope: 'owner',
      },
      [ownerKey('order-1', 'user-2')]: {
        orderId: 'order-1',
        userId: 'user-2',
        stage: 'upload',
        message: 'user two retry',
        updatedAt: '2026-04-08T11:30:00.000Z',
        scope: 'owner',
      },
    },
  }, {
    now: Date.parse('2026-04-08T12:00:00.000Z'),
  });

  assert.deepEqual(snapshot, {
    drafts: {
      [ownerKey('order-1', 'user-1')]: {
        content: 'owner one draft',
        attachments: [],
      },
      [ownerKey('order-1', 'user-2')]: {
        content: 'owner two draft',
        attachments: [],
      },
    },
    recoveries: {
      [ownerKey('order-1', 'user-1')]: {
        stage: 'send',
        message: 'user one retry',
      },
      [ownerKey('order-1', 'user-2')]: {
        stage: 'upload',
        message: 'user two retry',
      },
    },
  });
});
