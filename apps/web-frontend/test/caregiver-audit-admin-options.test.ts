import assert from 'node:assert/strict';
import test from 'node:test';
import {
  caregiverAuditAdminActionOptions,
  caregiverAuditAdminStatusOptions,
  getCaregiverAuditAdminActionLabel,
  getCaregiverAuditAdminStatusLabel,
  getCaregiverAuditAdminStatusTagType,
} from '../src/pages/petpal-admin/caregiver-audits/caregiver-audit-admin-options.ts';

test('builds caregiver audit admin options with admin wording overrides', () => {
  assert.deepEqual(caregiverAuditAdminStatusOptions, [
    { label: '待审核', value: 'PENDING' },
    { label: '已通过', value: 'APPROVED' },
    { label: '已拒绝', value: 'REJECTED' },
  ]);

  assert.deepEqual(caregiverAuditAdminActionOptions, [
    { label: '通过', value: 'APPROVED' },
    { label: '拒绝', value: 'REJECTED' },
    { label: '重置', value: 'PENDING' },
  ]);
});

test('keeps caregiver audit admin labels and tag types aligned', () => {
  assert.equal(getCaregiverAuditAdminStatusLabel('REJECTED'), '已拒绝');
  assert.equal(getCaregiverAuditAdminStatusTagType('APPROVED'), 'success');
  assert.equal(getCaregiverAuditAdminStatusTagType('REJECTED'), 'danger');
  assert.equal(getCaregiverAuditAdminActionLabel('PENDING'), '重置');
  assert.equal(getCaregiverAuditAdminActionLabel('REJECTED'), '拒绝');
});
