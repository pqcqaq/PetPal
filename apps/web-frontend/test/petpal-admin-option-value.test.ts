import assert from 'node:assert/strict';
import test from 'node:test';
import { callbackAlertOutboxStatusOptions } from '../src/pages/petpal-admin/callback-alert-outbox/callback-alert-outbox-options.ts';
import {
  callbackAuditSourceModeOptions,
  callbackAuditStatusOptions,
  callbackAuditTypeOptions,
} from '../src/pages/petpal-admin/callback-audits/callback-audit-display.ts';
import { caregiverAuditAdminStatusOptions } from '../src/pages/petpal-admin/caregiver-audits/caregiver-audit-admin-options.ts';
import {
  complaintAdminSlaStatusOptions,
  complaintAdminStatusOptions,
  complaintAdminTargetRoleOptions,
  complaintAdminTypeOptions,
} from '../src/pages/petpal-admin/complaints/complaint-admin-options.ts';
import { hasSelectOptionValue } from '../src/pages/petpal-admin/shared/option-value.ts';

test('accepts valid admin option values across PetPal governance pages', () => {
  assert.equal(hasSelectOptionValue(callbackAlertOutboxStatusOptions, 'DEAD'), true);
  assert.equal(hasSelectOptionValue(callbackAuditTypeOptions, 'PAYMENT_CALLBACK'), true);
  assert.equal(hasSelectOptionValue(callbackAuditStatusOptions, 'SUCCESS'), true);
  assert.equal(hasSelectOptionValue(callbackAuditSourceModeOptions, 'WECHATPAY_SDK'), true);
  assert.equal(hasSelectOptionValue(caregiverAuditAdminStatusOptions, 'REJECTED'), true);
  assert.equal(hasSelectOptionValue(complaintAdminStatusOptions, 'PROCESSING'), true);
  assert.equal(hasSelectOptionValue(complaintAdminTypeOptions, 'FRAUD'), true);
  assert.equal(hasSelectOptionValue(complaintAdminTargetRoleOptions, 'PLATFORM'), true);
  assert.equal(hasSelectOptionValue(complaintAdminSlaStatusOptions, 'DUE_SOON'), true);
});

test('rejects invalid admin option values without falling back to casts', () => {
  assert.equal(hasSelectOptionValue(callbackAlertOutboxStatusOptions, 'ERROR'), false);
  assert.equal(hasSelectOptionValue(callbackAuditTypeOptions, 'CHARGEBACK'), false);
  assert.equal(hasSelectOptionValue(callbackAuditSourceModeOptions, 'SIGNATURE'), false);
  assert.equal(hasSelectOptionValue(caregiverAuditAdminStatusOptions, 'CLOSED'), false);
  assert.equal(hasSelectOptionValue(complaintAdminStatusOptions, 'PENDING'), false);
  assert.equal(hasSelectOptionValue(complaintAdminTargetRoleOptions, 'OWNER'), false);
  assert.equal(hasSelectOptionValue(complaintAdminSlaStatusOptions, 'LATE'), false);
});
