import {
  formatPetPalAmount,
  getPetPalComplaintStatusLabel as getSharedPetPalComplaintStatusLabel,
  getPetPalComplaintTargetRoleLabel as getSharedPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel as getSharedPetPalComplaintTypeLabel,
  formatPetPalConversationMeta as formatSharedPetPalConversationMeta,
  formatPetPalConversationPreview as formatSharedPetPalConversationPreview,
  formatPetPalDate,
  formatPetPalMoney,
  getPetPalOrderStatusLabel as getSharedPetPalOrderStatusLabel,
  getPetPalRefundProgressStageHint as getSharedPetPalRefundProgressStageHint,
  getPetPalRefundProgressStageLabel as getSharedPetPalRefundProgressStageLabel,
  formatPetPalRange,
  getPetPalServiceLogTypeLabel as getSharedPetPalServiceLogTypeLabel,
  formatPetPalTime,
  getPetPalConversationUnreadCount,
  splitPetPalTagText as splitSharedPetPalTagText,
  isPetPalAftersalesStatus as isSharedPetPalAftersalesStatus,
  isPetPalOutstandingOrder as isSharedPetPalOutstandingOrder,
  getPetPalServiceRequestStatusLabel as getSharedPetPalServiceRequestStatusLabel,
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
  { label: getSharedPetPalServiceLogTypeLabel('CHECK_IN'), value: 'CHECK_IN', note: '到达后快速留痕' },
  { label: getSharedPetPalServiceLogTypeLabel('FEED'), value: 'FEED', note: '记录进食和饮水' },
  { label: getSharedPetPalServiceLogTypeLabel('WALK'), value: 'WALK', note: '记录外出和活动' },
  { label: getSharedPetPalServiceLogTypeLabel('PLAY'), value: 'PLAY', note: '记录互动和安抚' },
  { label: getSharedPetPalServiceLogTypeLabel('HEALTH'), value: 'HEALTH', note: '记录观察结果' },
  { label: getSharedPetPalServiceLogTypeLabel('CHECK_OUT'), value: 'CHECK_OUT', note: '记录服务结束' },
  { label: getSharedPetPalServiceLogTypeLabel('NOTE'), value: 'NOTE', note: '补充其他说明' },
];

export const getPetPalOrderStatusLabel = getSharedPetPalOrderStatusLabel;

export const getPetPalServiceTypeLabel = (serviceType: PetServiceType) => ({
  BOARDING: '寄养',
  WALKING: '遛宠',
  FEEDING: '喂养',
  DOOR_VISIT: '上门陪伴',
}[serviceType] ?? serviceType);

export const getPetPalServiceRequestStatusLabel = getSharedPetPalServiceRequestStatusLabel;

export const getPetPalCaregiverAuditLabel = (status: CaregiverAuditStatus) => ({
  PENDING: '审核中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
}[status] ?? petPalCaregiverAuditOptions.find((item) => item.value === status)?.label ?? status);

export const formatPetPalConversationPreview = (conversation: OrderConversationRecord | null | undefined) => {
  return formatSharedPetPalConversationPreview(conversation, {
    recentMessageFallbackText: '最近更新了一条附件或简短消息',
    emptyText: '暂未开始订单沟通，可进入订单详情发送消息。',
  });
};

export const formatPetPalConversationMeta = (
  conversation: OrderConversationRecord | null | undefined,
  role: 'owner' | 'caregiver',
  formatTime: (value: string) => string,
) =>
  formatSharedPetPalConversationMeta(conversation, {
    role,
    formatTime,
    emptyText: '暂无沟通记录',
  });

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

export const getPetPalRefundProgressStageLabel = getSharedPetPalRefundProgressStageLabel;

export const getPetPalRefundProgressStageHint = getSharedPetPalRefundProgressStageHint;

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

export const getPetPalComplaintTargetRoleLabel = getSharedPetPalComplaintTargetRoleLabel;

export const getPetPalComplaintTypeLabel = getSharedPetPalComplaintTypeLabel;

export const getPetPalComplaintStatusLabel = getSharedPetPalComplaintStatusLabel;

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
  splitSharedPetPalTagText(value, {
    slashAsSeparator: true,
  });

export const isPetPalOutstandingOrder = isSharedPetPalOutstandingOrder;

export const isPetPalAftersalesStatus = isSharedPetPalAftersalesStatus;
