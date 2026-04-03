import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePersistedPetPalMessageComposerSnapshot } from '../src/pages/frontend/petpal/message-composer-state.ts';

test('parses persisted petpal message composer snapshots from JSON strings', () => {
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
      'order-valid': {
        stage: 'upload',
        message: 'Need to reselect the image',
      },
    },
  });
});

test('drops stale persisted petpal message composer entries', () => {
  const snapshot = parsePersistedPetPalMessageComposerSnapshot({
    drafts: {
      'order-stale': {
        content: 'old draft',
        attachments: [],
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
      'order-fresh': {
        content: 'fresh draft',
        attachments: [],
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
    },
    recoveries: {
      'order-fresh': {
        stage: 'send',
        message: 'retry me',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
    },
  }, {
    now: Date.parse('2026-04-08T12:00:00.000Z'),
  });

  assert.deepEqual(snapshot, {
    drafts: {
      'order-fresh': {
        content: 'fresh draft',
        attachments: [],
      },
    },
    recoveries: {
      'order-fresh': {
        stage: 'send',
        message: 'retry me',
      },
    },
  });
});

test('keeps only the newest persisted petpal message composer threads', () => {
  const drafts = Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [
      `order-${index + 1}`,
      {
        content: `draft-${index + 1}`,
        attachments: [],
        updatedAt: `2026-04-08T${String(index).padStart(2, '0')}:00:00.000Z`,
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
    'order-3',
    'order-4',
    'order-5',
    'order-6',
    'order-7',
    'order-8',
    'order-9',
    'order-10',
    'order-11',
    'order-12',
    'order-13',
    'order-14',
  ]);
});

test('keeps persisted petpal message composer threads independently per scope', () => {
  const drafts = Object.fromEntries([
    ...Array.from({ length: 14 }, (_, index) => [
      `owner-order-${index + 1}`,
      {
        content: `owner-draft-${index + 1}`,
        attachments: [],
        updatedAt: `2026-04-08T${String(index).padStart(2, '0')}:00:00.000Z`,
        scope: 'owner',
      },
    ]),
    ...Array.from({ length: 14 }, (_, index) => [
      `caregiver-order-${index + 1}`,
      {
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
  assert.equal(snapshot.drafts['owner-order-1'], undefined);
  assert.equal(snapshot.drafts['owner-order-2'], undefined);
  assert.equal(snapshot.drafts['caregiver-order-1'], undefined);
  assert.equal(snapshot.drafts['caregiver-order-2'], undefined);
  assert.equal(snapshot.drafts['owner-order-3']?.content, 'owner-draft-3');
  assert.equal(snapshot.drafts['owner-order-14']?.content, 'owner-draft-14');
  assert.equal(snapshot.drafts['caregiver-order-3']?.content, 'caregiver-draft-3');
  assert.equal(snapshot.drafts['caregiver-order-14']?.content, 'caregiver-draft-14');
});
