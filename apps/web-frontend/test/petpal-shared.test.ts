import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
