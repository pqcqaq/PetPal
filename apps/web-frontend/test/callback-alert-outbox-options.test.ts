import assert from 'node:assert/strict';
import test from 'node:test';
import {
  callbackAlertOutboxStatusOptions,
  callbackAlertReplayActionOptions,
  getCallbackAlertOutboxStatusLabel,
  getCallbackAlertOutboxStatusTagType,
  getCallbackAlertReplayActionLabel,
} from '../src/pages/petpal-admin/callback-alert-outbox/callback-alert-outbox-options.ts';

test('builds callback alert outbox status options in a stable order', () => {
  assert.deepEqual(callbackAlertOutboxStatusOptions, [
    { label: '待处理', value: 'PENDING' },
    { label: '处理中', value: 'PROCESSING' },
    { label: '已发送', value: 'SENT' },
    { label: '失败', value: 'FAILED' },
    { label: '死信', value: 'DEAD' },
  ]);

  assert.deepEqual(callbackAlertReplayActionOptions, [
    { label: '单条重放', value: 'REQUEUE' },
    { label: '批量死信重放', value: 'REQUEUE_DEAD_BATCH' },
  ]);
});

test('keeps callback alert outbox labels and tag types aligned', () => {
  assert.equal(getCallbackAlertOutboxStatusLabel('SENT'), '已发送');
  assert.equal(getCallbackAlertOutboxStatusTagType('SENT'), 'success');
  assert.equal(getCallbackAlertOutboxStatusTagType('PROCESSING'), 'warning');
  assert.equal(getCallbackAlertOutboxStatusTagType('DEAD'), 'danger');
  assert.equal(getCallbackAlertReplayActionLabel('REQUEUE'), '单条重放');
  assert.equal(getCallbackAlertReplayActionLabel('REQUEUE_DEAD_BATCH'), '批量死信重放');
});
