/**
 * PetPal callback audit display helpers and types.
 */

export type CallbackAuditFilters = {
  callbackType?: string;
  callbackStatus?: string;
  sourceMode?: string;
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

export const resolveCallbackTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    PAYMENT_CALLBACK: '支付回调',
    REFUND_CALLBACK: '退款回调',
  };
  return labels[type] || type;
};

export const resolveCallbackStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: '待处理',
    SUCCESS: '成功',
    FAILURE: '失败',
    ERROR: '错误',
  };
  return labels[status] || status;
};

export const resolveCallbackStatusTone = (status: string): string => {
  const tones: Record<string, string> = {
    PENDING: 'warning',
    SUCCESS: 'accent',
    FAILURE: 'danger',
    ERROR: 'danger',
  };
  return tones[status] || 'neutral';
};

export const resolveSourceModeLabel = (mode: string): string => {
  const labels: Record<string, string> = {
    TOKEN: '令牌验证',
    WECHATPAY_HMAC: '微信支付 HMAC',
    WECHATPAY_SDK: '微信支付 SDK',
  };
  return labels[mode] || mode;
};

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
