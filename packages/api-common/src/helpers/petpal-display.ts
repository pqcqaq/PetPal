import type {
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  OrderConversationRecord,
  OrderStatus,
  RefundProgressStage,
  ServiceRequestStatus,
} from '../types/petpal';

export type PetPalConversationRole = 'owner' | 'caregiver';

const toValidDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getPetPalConversationUnreadCount = (
  conversation: OrderConversationRecord | null | undefined,
  role: PetPalConversationRole,
) => {
  if (!conversation) {
    return 0;
  }

  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

export const formatPetPalConversationPreview = (
  conversation: OrderConversationRecord | null | undefined,
  options: {
    recentMessageFallbackText: string;
    emptyText: string;
  },
) => {
  const preview = conversation?.lastMessagePreview?.trim();
  if (preview) {
    return preview;
  }

  if (conversation?.lastMessageAt) {
    return options.recentMessageFallbackText;
  }

  return options.emptyText;
};

export const formatPetPalConversationMeta = (
  conversation: OrderConversationRecord | null | undefined,
  options: {
    role: PetPalConversationRole;
    formatTime: (value: string) => string;
    emptyText: string;
    readText?: string;
  },
) => {
  const unreadCount = getPetPalConversationUnreadCount(conversation, options.role);
  const unreadText = unreadCount > 0 ? `${unreadCount} 条未读` : options.readText ?? '已读完';
  if (conversation?.lastMessageAt) {
    return `${options.formatTime(conversation.lastMessageAt)} · ${unreadText}`;
  }

  return unreadCount > 0 ? unreadText : options.emptyText;
};

export const formatPetPalAmount = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

export const formatPetPalMoney = (value: number | string | null | undefined) =>
  `¥${formatPetPalAmount(value)}`;

export const formatPetPalDate = (value: string | null | undefined) => {
  const date = toValidDate(value);
  if (!date) {
    return '--';
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const formatPetPalTime = (value: string | null | undefined) => {
  const date = toValidDate(value);
  if (!date) {
    return '--';
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const formatPetPalRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => `${formatPetPalTime(start)} - ${formatPetPalTime(end)}`;

const petPalOrderStatusLabels: Record<OrderStatus, string> = {
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
};

const petPalServiceRequestStatusLabels: Record<ServiceRequestStatus, string> = {
  OPEN: '待匹配',
  MATCHED: '已匹配',
  CLOSED: '已关闭',
  MATCHING: '匹配中',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
};

const petPalRefundProgressStageLabels: Record<RefundProgressStage, string> = {
  NONE: '暂无退款',
  PENDING_REVIEW: '待审核',
  APPROVED_WAITING: '待退款',
  PARTIAL_SUCCESS: '部分退款成功',
  FULL_SUCCESS: '退款完成',
  REJECTED: '已驳回',
  FAILED: '退款失败',
};

const petPalRefundProgressStageHints: Record<RefundProgressStage, string> = {
  NONE: '当前暂无退款申请，后续售后进度会在这里同步展示。',
  PENDING_REVIEW: '退款申请已提交，等待平台审核处理。',
  APPROVED_WAITING: '退款申请已审核通过，等待退款渠道回调。',
  PARTIAL_SUCCESS: '订单已完成部分退款，可继续查看剩余可退余额。',
  FULL_SUCCESS: '退款已完成，订单售后金额已经结清。',
  REJECTED: '最近一笔退款申请已被驳回，可根据原因补充说明后再次联系平台。',
  FAILED: '退款处理失败，建议尽快联系平台核查渠道回执。',
};

const petPalComplaintTargetRoleLabels: Record<ComplaintTargetRole, string> = {
  CAREGIVER: '照料者',
  PLATFORM: '平台',
};

const petPalComplaintTypeLabels: Record<ComplaintType, string> = {
  SAFETY: '安全问题',
  FEE: '费用争议',
  SERVICE: '服务质量',
  FRAUD: '欺诈风险',
  OTHER: '其他问题',
};

const petPalComplaintStatusLabels: Record<ComplaintStatus, string> = {
  OPEN: '待受理',
  PROCESSING: '处理中',
  RESOLVED: '已解决',
  REJECTED: '已驳回',
};

export const getPetPalOrderStatusLabel = (status: OrderStatus) =>
  petPalOrderStatusLabels[status] ?? status;

export const getPetPalServiceRequestStatusLabel = (status: ServiceRequestStatus) =>
  petPalServiceRequestStatusLabels[status] ?? status;

export const getPetPalRefundProgressStageLabel = (stage: RefundProgressStage) =>
  petPalRefundProgressStageLabels[stage] ?? stage;

export const getPetPalRefundProgressStageHint = (stage: RefundProgressStage) =>
  petPalRefundProgressStageHints[stage] ?? stage;

export const getPetPalComplaintTargetRoleLabel = (role: ComplaintTargetRole) =>
  petPalComplaintTargetRoleLabels[role] ?? role;

export const getPetPalComplaintTypeLabel = (type: ComplaintType) =>
  petPalComplaintTypeLabels[type] ?? type;

export const getPetPalComplaintStatusLabel = (status: ComplaintStatus) =>
  petPalComplaintStatusLabels[status] ?? status;

export const isPetPalOutstandingOrder = (order: {
  amountTotal: number | string | null | undefined;
  amountAdjusted: number | string | null | undefined;
  amountPaid: number | string | null | undefined;
}) => {
  const total = Number(order.amountTotal) + Number(order.amountAdjusted);
  const paid = Number(order.amountPaid);
  return total - paid > 0.01;
};

export const isPetPalAftersalesStatus = (status: OrderStatus) =>
  status === 'DISPUTED' || status === 'PARTIAL_REFUNDED' || status === 'REFUNDED';

export const isPetPalOrderAftersalesTracked = (order: {
  orderStatus: OrderStatus;
  refunds?: Array<unknown> | null | undefined;
  amountRefunded?: number | string | null | undefined;
}) =>
  isPetPalAftersalesStatus(order.orderStatus)
  || (order.refunds?.length ?? 0) > 0
  || Number(order.amountRefunded ?? 0) > 0;

export const getPetPalOwnerOrderFilter = (order: {
  orderStatus: OrderStatus;
  refunds?: Array<unknown> | null | undefined;
  amountRefunded?: number | string | null | undefined;
}): 'ACTIVE' | 'COMPLETED' | 'AFTERSALES' => {
  if (isPetPalOrderAftersalesTracked(order)) {
    return 'AFTERSALES';
  }

  if (order.orderStatus === 'COMPLETED') {
    return 'COMPLETED';
  }

  return 'ACTIVE';
};
