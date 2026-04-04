import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cloneManagedAttachmentRecords,
  createManagedAttachmentRecord,
  createManagedAttachmentRecordFromMediaAsset,
  parseManagedAttachmentRecord,
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
  PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT,
  PETPAL_CAREGIVER_QUALIFICATION_UPLOAD_MAX_COUNT,
  PETPAL_COMPLAINT_ATTACHMENT_MAX_COUNT,
  PETPAL_COMPLAINT_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
  PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
  PETPAL_PENALTY_RECTIFY_ATTACHMENT_MAX_COUNT,
  PETPAL_PENALTY_RECTIFY_ATTACHMENT_SCOPE,
  PETPAL_PENALTY_RECTIFY_ATTACHMENT_TAG,
  PETPAL_SERVICE_LOG_ATTACHMENT_TAG,
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
