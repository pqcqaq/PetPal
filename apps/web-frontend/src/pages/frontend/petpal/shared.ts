import {
  formatPetPalAmount,
  formatPetPalDate,
  formatPetPalMoney,
  formatPetPalRange,
  formatPetPalTime,
  getPetPalConversationUnreadCount,
  type CaregiverAuditStatus,
  type ComplaintAdminSlaStatus,
  type ComplaintStatus,
  type ComplaintTargetRole,
  type ComplaintType,
  type OwnerPayChannel,
  type OrderConversationRecord,
  type OrderRefundProgressRecord,
  type OrderStatus,
  type PetSpecies,
  type PetServiceType,
  type RefundStatus,
  type ServiceLogType,
  type RefundType,
  type ServiceRequestStatus,
} from '@rbac/api-common';

export const petPalOwnerWorkspaceNav = [
  { label: '总览', name: 'frontend-petpal' },
  { label: '宠物档案', name: 'frontend-petpal-pets' },
  { label: '需求队列', name: 'frontend-petpal-requests' },
  { label: '订单队列', name: 'frontend-petpal-orders' },
  { label: '提醒', name: 'frontend-petpal-reminders' },
  { label: '消息', name: 'frontend-petpal-messages' },
  { label: '售后', name: 'frontend-petpal-aftersales' },
] as const;

export const petPalCaregiverWorkspaceNav = [
  { label: '总览', name: 'frontend-petpal-caregiver' },
  { label: '入驻资料', name: 'frontend-petpal-caregiver-profile' },
  { label: '服务管理', name: 'frontend-petpal-caregiver-services' },
  { label: '履约订单', name: 'frontend-petpal-caregiver-orders' },
  { label: '收益表现', name: 'frontend-petpal-caregiver-earnings' },
  { label: '提醒', name: 'frontend-petpal-reminders' },
  { label: '消息', name: 'frontend-petpal-messages' },
] as const;

export const petPalServiceTypeOptions: Array<{ label: string; value: PetServiceType }> = [
  { label: '寄养', value: 'BOARDING' },
  { label: '遛宠', value: 'WALKING' },
  { label: '喂养', value: 'FEEDING' },
  { label: '上门陪伴', value: 'DOOR_VISIT' },
];

export const petPalSpeciesOptions: Array<{ label: string; value: PetSpecies }> = [
  { label: '犬', value: 'DOG' },
  { label: '猫', value: 'CAT' },
  { label: '其他', value: 'OTHER' },
];

export const petPalPayChannelOptions: Array<{ label: string; value: OwnerPayChannel; note: string }> = [
  { label: '微信支付', value: 'WECHAT_PAY', note: '适合快速完成下单' },
  { label: '支付宝', value: 'ALIPAY', note: '适合常用移动支付' },
  { label: '余额支付', value: 'BALANCE', note: '适合账户内已有余额' },
];

export const petPalReviewTagOptions = [
  '准时到达',
  '沟通清晰',
  '对宠温柔',
  '照片反馈及时',
  '环境整洁',
  '可再次预约',
];

export const petPalComplaintTargetOptions: Array<{ label: string; value: ComplaintTargetRole }> = [
  { label: '照料者', value: 'CAREGIVER' },
  { label: '平台', value: 'PLATFORM' },
];

export const petPalComplaintTypeOptions: Array<{ label: string; value: ComplaintType }> = [
  { label: '安全问题', value: 'SAFETY' },
  { label: '费用争议', value: 'FEE' },
  { label: '服务质量', value: 'SERVICE' },
  { label: '欺诈风险', value: 'FRAUD' },
  { label: '其他问题', value: 'OTHER' },
];

export const petPalComplaintStatusOptions: Array<{ label: string; value: ComplaintStatus }> = [
  { label: '待受理', value: 'OPEN' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已解决', value: 'RESOLVED' },
  { label: '已驳回', value: 'REJECTED' },
];

export const petPalComplaintSlaStatusOptions: Array<{
  label: string;
  value: ComplaintAdminSlaStatus;
}> = [
  { label: 'SLA正常', value: 'NORMAL' },
  { label: '即将超时', value: 'DUE_SOON' },
  { label: '投诉已超时', value: 'OVERDUE' },
];

export const petPalCaregiverAuditOptions: Array<{ label: string; value: CaregiverAuditStatus }> = [
  { label: '待审核', value: 'PENDING' },
  { label: '已通过', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
];

export const petPalRefundTypeOptions: Array<{ label: string; value: RefundType }> = [
  { label: '全额退款', value: 'FULL' },
  { label: '部分退款', value: 'PARTIAL' },
];

export const petPalRefundStatusOptions: Array<{ label: string; value: RefundStatus }> = [
  { label: '待审核', value: 'PENDING' },
  { label: '待退款', value: 'APPROVED' },
  { label: '已驳回', value: 'REJECTED' },
  { label: '退款成功', value: 'SUCCESS' },
  { label: '退款失败', value: 'FAILED' },
];

export const petPalOrderStatusOptions: Array<{ label: string; value: OrderStatus }> = [
  { label: '待接单', value: 'PENDING_ACCEPT' },
  { label: '已接单', value: 'ACCEPTED' },
  { label: '服务中', value: 'SERVING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '纠纷中', value: 'DISPUTED' },
  { label: '部分退款', value: 'PARTIAL_REFUNDED' },
  { label: '已退款', value: 'REFUNDED' },
];

export const petPalServiceLogOptions: Array<{ label: string; value: ServiceLogType; note: string }> = [
  { label: '签到', value: 'CHECK_IN', note: '到达后快速留痕' },
  { label: '喂养', value: 'FEED', note: '记录进食和饮水' },
  { label: '遛宠', value: 'WALK', note: '记录外出和活动' },
  { label: '陪伴', value: 'PLAY', note: '记录互动和安抚' },
  { label: '健康', value: 'HEALTH', note: '记录观察结果' },
  { label: '签退', value: 'CHECK_OUT', note: '记录服务结束' },
  { label: '备注', value: 'NOTE', note: '补充其他说明' },
];

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

export const getPetPalServiceTypeLabel = (serviceType: PetServiceType) => ({
  BOARDING: '寄养',
  WALKING: '遛宠',
  FEEDING: '喂养',
  DOOR_VISIT: '上门陪伴',
}[serviceType] ?? serviceType);

export const getPetPalServiceRequestStatusLabel = (status: ServiceRequestStatus) => ({
  OPEN: '待匹配',
  MATCHED: '已匹配',
  CLOSED: '已关闭',
  MATCHING: '匹配中',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}[status] ?? status);

export const getPetPalCaregiverAuditLabel = (status: CaregiverAuditStatus) => ({
  PENDING: '审核中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}[status] ?? petPalCaregiverAuditOptions.find((item) => item.value === status)?.label ?? status);

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

export {
  formatPetPalAmount,
  formatPetPalDate,
  formatPetPalMoney,
  formatPetPalRange,
  formatPetPalTime,
  getPetPalConversationUnreadCount,
};

export const getPetPalRefundTypeLabel = (type: RefundType) => ({
  FULL: '全额退款',
  PARTIAL: '部分退款',
}[type] ?? type);

export const getPetPalRefundStatusLabel = (status: RefundStatus) => ({
  PENDING: '待审核',
  APPROVED: '待退款',
  REJECTED: '已驳回',
  SUCCESS: '退款成功',
  FAILED: '退款失败',
}[status] ?? status);

export const getPetPalRefundStatusType = (
  status: RefundStatus,
): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const map: Record<RefundStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    REJECTED: 'info',
    SUCCESS: 'success',
    FAILED: 'danger',
  };
  return map[status];
};

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

export const getPetPalComplaintSlaStatusLabel = (status: ComplaintAdminSlaStatus) => ({
  NORMAL: 'SLA正常',
  DUE_SOON: '即将超时',
  OVERDUE: '投诉已超时',
}[status] ?? status);

export const getPetPalComplaintSlaStatusType = (
  status: ComplaintAdminSlaStatus,
): 'success' | 'warning' | 'danger' => {
  const map: Record<ComplaintAdminSlaStatus, 'success' | 'warning' | 'danger'> = {
    NORMAL: 'success',
    DUE_SOON: 'warning',
    OVERDUE: 'danger',
  };
  return map[status];
};

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

export const normalizePetPalTagText = (value: string | null | undefined) =>
  (value ?? '')
    .split(/[\n,，、/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

export const isPetPalOutstandingOrder = (
  order: Pick<OrderRefundProgressRecord, never> & Pick<{ amountTotal: number | string; amountAdjusted: number | string; amountPaid: number | string }, 'amountTotal' | 'amountAdjusted' | 'amountPaid'>,
) => {
  const total = Number(order.amountTotal) + Number(order.amountAdjusted);
  const paid = Number(order.amountPaid);
  return total - paid > 0.01;
};

export const isPetPalAftersalesStatus = (status: OrderStatus) => (
  status === 'DISPUTED' || status === 'PARTIAL_REFUNDED' || status === 'REFUNDED'
);
