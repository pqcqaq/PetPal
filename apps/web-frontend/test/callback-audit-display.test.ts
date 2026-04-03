import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callbackAuditSourceModeOptions,
  callbackAuditStatusOptions,
  callbackAuditTypeOptions,
  compareCallbackAuditRecency,
  formatAuditDuration,
  getActiveAuditFilterTokens,
  resolveCallbackStatusLabel,
  resolveCallbackStatusTagType,
  resolveCallbackStatusTone,
  resolveCallbackTypeLabel,
  resolveSourceModeLabel,
} from '../src/pages/petpal-admin/callback-audits/callback-audit-display.ts';

test('builds callback audit filter options in a stable order', () => {
  assert.deepEqual(callbackAuditTypeOptions, [
    { label: '支付回调', value: 'PAYMENT_CALLBACK' },
    { label: '退款回调', value: 'REFUND_CALLBACK' },
  ]);

  assert.deepEqual(callbackAuditStatusOptions, [
    { label: '待处理', value: 'PENDING' },
    { label: '成功', value: 'SUCCESS' },
    { label: '失败', value: 'FAILURE' },
    { label: '错误', value: 'ERROR' },
  ]);

  assert.deepEqual(callbackAuditSourceModeOptions, [
    { label: '令牌验证', value: 'TOKEN' },
    { label: '微信支付 HMAC', value: 'WECHATPAY_HMAC' },
    { label: '微信支付 SDK', value: 'WECHATPAY_SDK' },
  ]);
});

test('keeps callback audit labels, tones, and tag types aligned', () => {
  assert.equal(resolveCallbackTypeLabel('PAYMENT_CALLBACK'), '支付回调');
  assert.equal(resolveCallbackStatusLabel('SUCCESS'), '成功');
  assert.equal(resolveCallbackStatusTone('SUCCESS'), 'accent');
  assert.equal(resolveCallbackStatusTone('ERROR'), 'danger');
  assert.equal(resolveCallbackStatusTagType('SUCCESS'), 'success');
  assert.equal(resolveCallbackStatusTagType('PENDING'), 'warning');
  assert.equal(resolveSourceModeLabel('WECHATPAY_HMAC'), '微信支付 HMAC');
});

test('builds active callback audit filter tokens with admin-facing labels', () => {
  assert.deepEqual(getActiveAuditFilterTokens({
    callbackType: 'REFUND_CALLBACK',
    callbackStatus: 'FAILURE',
    sourceMode: 'WECHATPAY_SDK',
    requestId: '1234567890abcdef',
    q: '签名失败',
  }), [
    { label: '类型', value: '退款回调' },
    { label: '状态', value: '失败' },
    { label: '来源', value: '微信支付 SDK' },
    { label: 'RequestId', value: '1234567890ab...' },
    { label: '关键词', value: '签名失败' },
  ]);
});

test('keeps callback audit duration and recency helpers stable', () => {
  assert.equal(formatAuditDuration(250), '250ms');
  assert.equal(formatAuditDuration(2500), '2.50s');
  assert.ok(compareCallbackAuditRecency(
    { createdAt: '2026-04-03T10:00:00.000Z' },
    { createdAt: '2026-04-03T09:00:00.000Z' },
  ) < 0);
});
