/**
 * PetPal callback audit display helpers and types.
 */

import type {
  CallbackSourceMode,
  CallbackStatus,
  CallbackType,
} from '@rbac/api-common';

export type CallbackAuditFilters = {
  callbackType?: CallbackType;
  callbackStatus?: CallbackStatus;
  sourceMode?: CallbackSourceMode;
  requestId?: string;
  startDate?: string;
  endDate?: string;
  q?: string;
};

export type AuditSignalItem = {
  label: string;
  value: string | number;
  tone?: 'danger' | 'warning' | 'accent' | 'neutral';
};

type CallbackAuditOption<T extends string> = {
  label: string;
  value: T;
};

type CallbackAuditStatusTone = 'warning' | 'accent' | 'danger' | 'neutral';
type CallbackAuditStatusTagType = 'warning' | 'success' | 'danger' | 'info';

export const callbackAuditTypeOptions: Array<CallbackAuditOption<CallbackType>> = [
  { label: '支付回调', value: 'PAYMENT_CALLBACK' },
  { label: '退款回调', value: 'REFUND_CALLBACK' },
];

export const callbackAuditStatusOptions: Array<CallbackAuditOption<CallbackStatus>> = [
  { label: '待处理', value: 'PENDING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILURE' },
  { label: '错误', value: 'ERROR' },
];

export const callbackAuditSourceModeOptions: Array<CallbackAuditOption<CallbackSourceMode>> = [
  { label: '令牌验证', value: 'TOKEN' },
  { label: '微信支付 HMAC', value: 'WECHATPAY_HMAC' },
  { label: '微信支付 SDK', value: 'WECHATPAY_SDK' },
];

const findCallbackAuditOptionLabel = <T extends string>(
  options: Array<CallbackAuditOption<T>>,
  value: T,
) => options.find((item) => item.value === value)?.label ?? value;

export const resolveCallbackTypeLabel = (type: CallbackType): string =>
  findCallbackAuditOptionLabel(callbackAuditTypeOptions, type);

export const resolveCallbackStatusLabel = (status: CallbackStatus): string =>
  findCallbackAuditOptionLabel(callbackAuditStatusOptions, status);

const callbackAuditStatusTones: Record<CallbackStatus, CallbackAuditStatusTone> = {
  PENDING: 'warning',
  SUCCESS: 'accent',
  FAILURE: 'danger',
  ERROR: 'danger',
};

const callbackAuditStatusTagTypes: Record<CallbackStatus, CallbackAuditStatusTagType> = {
  PENDING: 'warning',
  SUCCESS: 'success',
  FAILURE: 'danger',
  ERROR: 'danger',
};

export const resolveCallbackStatusTone = (status: CallbackStatus): CallbackAuditStatusTone =>
  callbackAuditStatusTones[status] || 'neutral';

export const resolveCallbackStatusTagType = (status: CallbackStatus): CallbackAuditStatusTagType =>
  callbackAuditStatusTagTypes[status] || 'info';

export const resolveSourceModeLabel = (mode: CallbackSourceMode): string =>
  findCallbackAuditOptionLabel(callbackAuditSourceModeOptions, mode);

export const formatAuditTimestamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('zh-CN');
  } catch {
    return iso;
  }
};

export const formatAuditDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
};

export const getActiveAuditFilterTokens = (filters: CallbackAuditFilters) => {
  const tokens: Array<{ label: string; value: string }> = [];

  if (filters.callbackType) {
    tokens.push({
      label: '类型',
      value: resolveCallbackTypeLabel(filters.callbackType),
    });
  }

  if (filters.callbackStatus) {
    tokens.push({
      label: '状态',
      value: resolveCallbackStatusLabel(filters.callbackStatus),
    });
  }

  if (filters.sourceMode) {
    tokens.push({
      label: '来源',
      value: resolveSourceModeLabel(filters.sourceMode),
    });
  }

  if (filters.requestId) {
    tokens.push({
      label: 'RequestId',
      value: `${filters.requestId.substring(0, 12)}...`,
    });
  }

  if (filters.q) {
    tokens.push({
      label: '关键词',
      value: filters.q,
    });
  }

  return tokens;
};

export const compareCallbackAuditRecency = (
  a: { createdAt: string },
  b: { createdAt: string },
): number => {
  const aTime = new Date(a.createdAt).getTime();
  const bTime = new Date(b.createdAt).getTime();
  return bTime - aTime;
};
