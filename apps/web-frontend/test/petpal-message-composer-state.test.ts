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
