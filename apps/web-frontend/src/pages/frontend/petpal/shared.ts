import type {
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  OrderConversationRecord,
  OrderRefundProgressRecord,
  OrderStatus,
  RefundType,
} from '@rbac/api-common';

export const getPetPalOrderStatusLabel = (status: OrderStatus) => ({
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
}[status] ?? status);

export const getPetPalConversationUnreadCount = (
  conversation: OrderConversationRecord | null | undefined,
  role: 'owner' | 'caregiver',
) => {
  if (!conversation) {
    return 0;
  }
  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

export const formatPetPalConversationPreview = (conversation: OrderConversationRecord | null | undefined) => {
  const preview = conversation?.lastMessagePreview?.trim();
  if (preview) {
    return preview;
  }
  if (conversation?.lastMessageAt) {
    return '最近更新了一条附件或简短消息';
  }
  return '暂未开始订单沟通，可进入订单详情发送消息。';
};

export const formatPetPalConversationMeta = (
  conversation: OrderConversationRecord | null | undefined,
  role: 'owner' | 'caregiver',
  formatTime: (value: string) => string,
) => {
  const unreadCount = getPetPalConversationUnreadCount(conversation, role);
  const unreadText = unreadCount > 0 ? `${unreadCount} 条未读` : '已读完';
  if (conversation?.lastMessageAt) {
    return `${formatTime(conversation.lastMessageAt)} · ${unreadText}`;
  }
  return unreadCount > 0 ? unreadText : '暂无沟通记录';
};

export const getPetPalRefundTypeLabel = (type: RefundType) => ({
  FULL: '全额退款',
  PARTIAL: '部分退款',
}[type] ?? type);

export const getPetPalRefundProgressStageLabel = (stage: OrderRefundProgressRecord['stage']) => ({
  NONE: '暂无退款',
  PENDING_REVIEW: '待审核',
  APPROVED_WAITING: '待退款',
  PARTIAL_SUCCESS: '部分退款成功',
  FULL_SUCCESS: '退款完成',
  REJECTED: '已驳回',
  FAILED: '退款失败',
}[stage] ?? stage);

export const getPetPalRefundProgressStageHint = (stage: OrderRefundProgressRecord['stage']) => ({
  NONE: '当前暂无退款申请，后续售后进度会在这里同步展示。',
  PENDING_REVIEW: '退款申请已提交，等待平台审核处理。',
  APPROVED_WAITING: '退款申请已审核通过，等待退款渠道回调。',
  PARTIAL_SUCCESS: '订单已完成部分退款，可继续查看剩余可退余额。',
  FULL_SUCCESS: '退款已完成，订单售后金额已经结清。',
  REJECTED: '最近一笔退款申请已被驳回，可根据原因补充说明后再次联系平台。',
  FAILED: '退款处理失败，建议尽快联系平台核查渠道回执。',
}[stage] ?? stage);

export const getPetPalRefundProgressStageType = (
  stage: OrderRefundProgressRecord['stage'],
): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const map: Record<OrderRefundProgressRecord['stage'], 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    NONE: 'info',
    PENDING_REVIEW: 'warning',
    APPROVED_WAITING: 'primary',
    PARTIAL_SUCCESS: 'warning',
    FULL_SUCCESS: 'success',
    REJECTED: 'info',
    FAILED: 'danger',
  };
  return map[stage];
};

export const getPetPalComplaintTargetRoleLabel = (role: ComplaintTargetRole) => ({
  CAREGIVER: '照料者',
  PLATFORM: '平台',
}[role] ?? role);

export const getPetPalComplaintTypeLabel = (type: ComplaintType) => ({
  SAFETY: '安全问题',
  FEE: '费用争议',
  SERVICE: '服务质量',
  FRAUD: '欺诈风险',
  OTHER: '其他问题',
}[type] ?? type);

export const getPetPalComplaintStatusLabel = (status: ComplaintStatus) => ({
  OPEN: '待受理',
  PROCESSING: '处理中',
  RESOLVED: '已解决',
  REJECTED: '已驳回',
}[status] ?? status);

export const getPetPalComplaintStatusType = (
  status: ComplaintStatus,
): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const map: Record<ComplaintStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    OPEN: 'warning',
    PROCESSING: 'primary',
    RESOLVED: 'success',
    REJECTED: 'info',
  };
  return map[status];
};
