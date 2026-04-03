import type {
  CallbackAlertOutboxStatus,
  CallbackAlertReplayLogRecord,
} from '@rbac/api-common';

type CallbackAlertOption<T extends string> = {
  label: string;
  value: T;
};

export const callbackAlertOutboxStatusOptions: Array<CallbackAlertOption<CallbackAlertOutboxStatus>> = [
  { label: '待处理', value: 'PENDING' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已发送', value: 'SENT' },
  { label: '失败', value: 'FAILED' },
  { label: '死信', value: 'DEAD' },
];

export const callbackAlertReplayActionOptions: Array<
  CallbackAlertOption<CallbackAlertReplayLogRecord['actionType']>
> = [
  { label: '单条重放', value: 'REQUEUE' },
  { label: '批量死信重放', value: 'REQUEUE_DEAD_BATCH' },
];

const findCallbackAlertOptionLabel = <T extends string>(
  options: Array<CallbackAlertOption<T>>,
  value: T,
) => options.find((item) => item.value === value)?.label ?? value;

export const getCallbackAlertOutboxStatusLabel = (status: CallbackAlertOutboxStatus) =>
  findCallbackAlertOptionLabel(callbackAlertOutboxStatusOptions, status);

export const getCallbackAlertOutboxStatusTagType = (
  status: CallbackAlertOutboxStatus,
): 'success' | 'danger' | 'warning' | 'info' => {
  if (status === 'SENT') {
    return 'success';
  }
  if (status === 'FAILED' || status === 'DEAD') {
    return 'danger';
  }
  if (status === 'PROCESSING') {
    return 'warning';
  }
  return 'info';
};

export const getCallbackAlertReplayActionLabel = (
  actionType: CallbackAlertReplayLogRecord['actionType'],
) => findCallbackAlertOptionLabel(callbackAlertReplayActionOptions, actionType);
