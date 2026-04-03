import assert from 'node:assert/strict';
import test from 'node:test';
import {
  complaintAdminSlaStatusOptions,
  complaintAdminStatusOptions,
  complaintAdminTargetRoleOptions,
  complaintAdminTypeOptions,
  getComplaintAdminSlaStatusLabel,
  getComplaintAdminSlaTagType,
  getComplaintAdminStatusLabel,
  getComplaintAdminStatusType,
  getComplaintAdminTargetRoleLabel,
  getComplaintAdminTypeLabel,
} from '../src/pages/petpal-admin/complaints/complaint-admin-options.ts';

test('builds complaint admin filter options from shared PetPal definitions', () => {
  assert.deepEqual(complaintAdminStatusOptions, [
    { label: '待处理', value: 'OPEN' },
    { label: '处理中', value: 'PROCESSING' },
    { label: '已解决', value: 'RESOLVED' },
    { label: '已驳回', value: 'REJECTED' },
  ]);

  assert.deepEqual(complaintAdminTypeOptions, [
    { label: '安全问题', value: 'SAFETY' },
    { label: '费用争议', value: 'FEE' },
    { label: '服务质量', value: 'SERVICE' },
    { label: '欺诈风险', value: 'FRAUD' },
    { label: '其他问题', value: 'OTHER' },
  ]);

  assert.deepEqual(complaintAdminTargetRoleOptions, [
    { label: '照料者', value: 'CAREGIVER' },
    { label: '平台', value: 'PLATFORM' },
  ]);

  assert.deepEqual(complaintAdminSlaStatusOptions, [
    { label: '正常', value: 'NORMAL' },
    { label: '即将超时', value: 'DUE_SOON' },
    { label: '已超时', value: 'OVERDUE' },
  ]);
});

test('keeps complaint admin labels and tag types aligned with admin wording', () => {
  assert.equal(getComplaintAdminStatusLabel('OPEN'), '待处理');
  assert.equal(getComplaintAdminStatusType('OPEN'), 'warning');
  assert.equal(getComplaintAdminTypeLabel('SERVICE'), '服务质量');
  assert.equal(getComplaintAdminTargetRoleLabel('CAREGIVER'), '照料者');
  assert.equal(getComplaintAdminSlaStatusLabel('OVERDUE'), '已超时');
  assert.equal(getComplaintAdminSlaTagType('OVERDUE'), 'danger');
});
