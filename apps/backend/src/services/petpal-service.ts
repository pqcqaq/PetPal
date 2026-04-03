import { prisma } from '../lib/prisma';
import { Prisma, PrismaClient } from '../lib/prisma-generated';
import type { CaregiverProfile, PetProfile, ServiceRequest } from '../lib/prisma-generated';
import { env } from '../config/env';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { withSnowflakeId } from '../utils/persistence';
import { getRequestActorId } from '../utils/request-context';

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
};

const calcDistanceKm = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const radius = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((radius * c).toFixed(3));
};

const SERIALIZABLE_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

const isSerializationConflictError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: string }).code === 'P2034';
};

const runSerializableTransaction = async <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 2,
) => {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(callback, SERIALIZABLE_TX_OPTIONS);
    } catch (error) {
      if (attempt < maxRetries && isSerializationConflictError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Serializable transaction retry exhausted');
};

const assertOrderAmountInvariant = (order: {
  amountTotal: Prisma.Decimal | number;
  amountAdjusted: Prisma.Decimal | number;
  amountPaid: Prisma.Decimal | number;
  amountRefunded: Prisma.Decimal | number;
  orderStatus?:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED';
}) => {
  const amountTotal = toNumber(order.amountTotal);
  const amountAdjusted = toNumber(order.amountAdjusted);
  const amountPaid = toNumber(order.amountPaid);
  const amountRefunded = toNumber(order.amountRefunded);
  const required = amountTotal + amountAdjusted - amountRefunded;
  const isPendingAccept = order.orderStatus === 'PENDING_ACCEPT';
  if (amountPaid - amountRefunded < 0) {
    throw badRequest('Invalid order amount invariant: paid must be greater than refunded');
  }
  if (!isPendingAccept && amountPaid < required) {
    throw badRequest('Invalid order amount invariant: paid amount is not enough');
  }
};

const calcNetIncome = (
  amountPaid: Prisma.Decimal | number | null | undefined,
  amountRefunded: Prisma.Decimal | number | null | undefined,
) => Math.max(toNumber(amountPaid) - toNumber(amountRefunded), 0);

type CallbackAuditQueryFilters = {
  callbackType?: 'PAYMENT_CALLBACK' | 'REFUND_CALLBACK';
  callbackStatus?: 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR';
  sourceMode?: string;
  startDate?: Date;
  endDate?: Date;
  requestId?: string;
  paymentId?: string;
  refundId?: string;
};

type CallbackAlertOutboxStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEAD';

type CallbackAlertOutboxQueryFilters = {
  status?: CallbackAlertOutboxStatus;
  processingTimeoutMinutes?: number;
};

type OwnerTransactionExportFilters = {
  startDate?: Date;
  endDate?: Date;
  serviceType?: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  orderStatus?:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED';
  orderNoKeyword?: string;
};

type OwnerRefundExportFilters = {
  startDate?: Date;
  endDate?: Date;
  refundType?: 'FULL' | 'PARTIAL';
  refundStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';
  complaintStatus?: 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
  complaintType?: 'SAFETY' | 'FEE' | 'SERVICE' | 'FRAUD' | 'OTHER';
  complaintTargetRole?: 'CAREGIVER' | 'PLATFORM';
  serviceType?: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  orderNoKeyword?: string;
};

type OwnerTransactionExportRow = {
  orderNo: string;
  orderStatus:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED';
  serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  appointmentStart: Date;
  appointmentEnd: Date;
  amountTotal: number;
  amountPaid: number;
  amountRefunded: number;
  netPaid: number;
  paymentCount: number;
  paymentNos: string[];
  refundCount: number;
  refundNos: string[];
  latestRefundStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED' | null;
  latestRefundReviewedAt: Date | null;
  complaintCount: number;
  reviewRating: number | null;
  createdAt: Date;
  closedAt: Date | null;
};

type OwnerRefundExportRow = {
  orderNo: string;
  orderStatus:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED';
  serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  appointmentStart: Date;
  appointmentEnd: Date;
  refundNo: string;
  refundType: 'FULL' | 'PARTIAL';
  refundStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';
  refundAmount: number;
  refundReason: string;
  applyUserId: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type OwnerOrderRefundExportRow = {
  orderNo: string;
  refundNo: string;
  refundType: 'FULL' | 'PARTIAL';
  refundStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';
  refundAmount: number;
  refundReason: string;
  applyUserId: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type OwnerRefundProgressStage =
  | 'NONE'
  | 'PENDING_REVIEW'
  | 'APPROVED_WAITING'
  | 'PARTIAL_SUCCESS'
  | 'FULL_SUCCESS'
  | 'REJECTED'
  | 'FAILED';

type OwnerRefundProgressRecord = {
  stage: OwnerRefundProgressStage;
  latestRefundNo: string | null;
  latestRefundStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED' | null;
  latestRefundAmount: number | null;
  latestRefundReason: string | null;
  latestAppliedAt: Date | null;
  latestReviewedAt: Date | null;
  totalRefundCount: number;
  pendingCount: number;
  approvedCount: number;
  successCount: number;
  rejectedCount: number;
  failedCount: number;
  requestedRefundAmount: number;
  settledRefundAmount: number;
  refundableBalance: number;
};

type CaregiverEarningsExportRow = {
  orderNo: string;
  serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  appointmentStart: Date;
  appointmentEnd: Date;
  amountPaid: number;
  amountRefunded: number;
  netIncome: number;
  orderStatus:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED';
  ownerNickname: string;
  petName: string | null;
  locationText: string | null;
  closedAt: Date | null;
};

type CaregiverEarningsExportFilters = {
  startDate?: Date;
  endDate?: Date;
  serviceType?: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  orderNoKeyword?: string;
  minRefundAmount?: number;
  minComplaintCount?: number;
  refundType?: 'FULL' | 'PARTIAL';
  refundStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';
  refundReasonKeyword?: string;
  riskOnly?: boolean;
  complaintStatus?: 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
  complaintType?: 'SAFETY' | 'FEE' | 'SERVICE' | 'FRAUD' | 'OTHER';
  complaintKeyword?: string;
  complaintTargetRole?: 'CAREGIVER' | 'PLATFORM';
};

type ComplaintAdminScopeFilters = {
  status?: 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
  complaintType?: 'SAFETY' | 'FEE' | 'SERVICE' | 'FRAUD' | 'OTHER';
  targetRole?: 'CAREGIVER' | 'PLATFORM';
  slaStatus?: 'NORMAL' | 'DUE_SOON' | 'OVERDUE';
  assignedAdminId?: string;
  unassignedOnly?: boolean;
  keyword?: string;
};

type ComplaintAdminFilters = ComplaintAdminScopeFilters & {
  page: number;
  pageSize: number;
};

type ComplaintStatusCounter = Record<'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED', number>;

const OWNER_TRANSACTION_EXPORT_DEFAULT_DAYS = 365;
const OWNER_TRANSACTION_EXPORT_MAX_DAYS = 366;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;
const CAREGIVER_EARNINGS_DAILY_BUCKET_COUNT = 7;
const CAREGIVER_EARNINGS_WEEKLY_BUCKET_COUNT = 8;
const CAREGIVER_EARNINGS_MONTHLY_BUCKET_COUNT = 6;
const COMPLAINT_SLA_LIMIT_MS = env.PETPAL_COMPLAINT_SLA_LIMIT_HOURS * HOUR_IN_MS;
const COMPLAINT_SLA_WARNING_MS = env.PETPAL_COMPLAINT_SLA_WARNING_HOURS * HOUR_IN_MS;
const COMPLAINT_SLA_DUE_SOON_AGE_MS = COMPLAINT_SLA_LIMIT_MS - COMPLAINT_SLA_WARNING_MS;
const ACTIVE_COMPLAINT_STATUSES = ['OPEN', 'PROCESSING'] as const;

type CaregiverEarningsTrendBucketSeed = {
  label: string;
  rangeStart: Date;
  rangeEnd: Date;
  revenue: number;
  completedOrderCount: number;
};

const startOfUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addUtcDays = (value: Date, days: number) => new Date(value.getTime() + days * DAY_IN_MS);

const startOfUtcWeek = (value: Date) => {
  const dayStart = startOfUtcDay(value);
  const weekday = dayStart.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addUtcDays(dayStart, offset);
};

const startOfUtcMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const addUtcMonths = (value: Date, months: number) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));

const formatUtcMonthDay = (value: Date) =>
  `${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;

const formatUtcYearMonth = (value: Date) =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;

const buildCaregiverEarningsTrendBuckets = (now = new Date()) => {
  const currentDayStart = startOfUtcDay(now);
  const currentWeekStart = startOfUtcWeek(now);
  const currentMonthStart = startOfUtcMonth(now);

  const daily = Array.from({ length: CAREGIVER_EARNINGS_DAILY_BUCKET_COUNT }, (_, index) => {
    const rangeStart = addUtcDays(
      currentDayStart,
      index - (CAREGIVER_EARNINGS_DAILY_BUCKET_COUNT - 1),
    );
    return {
      label: formatUtcMonthDay(rangeStart),
      rangeStart,
      rangeEnd: addUtcDays(rangeStart, 1),
      revenue: 0,
      completedOrderCount: 0,
    };
  });

  const weekly = Array.from({ length: CAREGIVER_EARNINGS_WEEKLY_BUCKET_COUNT }, (_, index) => {
    const rangeStart = addUtcDays(
      currentWeekStart,
      (index - (CAREGIVER_EARNINGS_WEEKLY_BUCKET_COUNT - 1)) * 7,
    );
    const rangeEnd = addUtcDays(rangeStart, 7);
    return {
      label: `${formatUtcMonthDay(rangeStart)} ~ ${formatUtcMonthDay(addUtcDays(rangeEnd, -1))}`,
      rangeStart,
      rangeEnd,
      revenue: 0,
      completedOrderCount: 0,
    };
  });

  const monthly = Array.from({ length: CAREGIVER_EARNINGS_MONTHLY_BUCKET_COUNT }, (_, index) => {
    const rangeStart = addUtcMonths(
      currentMonthStart,
      index - (CAREGIVER_EARNINGS_MONTHLY_BUCKET_COUNT - 1),
    );
    return {
      label: formatUtcYearMonth(rangeStart),
      rangeStart,
      rangeEnd: addUtcMonths(rangeStart, 1),
      revenue: 0,
      completedOrderCount: 0,
    };
  });

  return {
    daily,
    weekly,
    monthly,
  };
};

const appendCaregiverEarningsTrendValue = (
  buckets: CaregiverEarningsTrendBucketSeed[],
  appointmentEnd: Date,
  revenue: number,
) => {
  for (const bucket of buckets) {
    if (appointmentEnd >= bucket.rangeStart && appointmentEnd < bucket.rangeEnd) {
      bucket.revenue += revenue;
      bucket.completedOrderCount += 1;
      break;
    }
  }
};

const toCaregiverEarningsTrendRecords = (buckets: CaregiverEarningsTrendBucketSeed[]) =>
  buckets.map((bucket) => ({
    label: bucket.label,
    rangeStart: bucket.rangeStart,
    rangeEnd: bucket.rangeEnd,
    revenue: Number(bucket.revenue.toFixed(2)),
    completedOrderCount: bucket.completedOrderCount,
  }));

const normalizeOwnerTransactionExportRange = (
  filters: OwnerTransactionExportFilters,
  now = new Date(),
) => {
  const endDate = filters.endDate ?? now;
  const startDate =
    filters.startDate ??
    new Date(endDate.getTime() - OWNER_TRANSACTION_EXPORT_DEFAULT_DAYS * DAY_IN_MS);

  if (startDate.getTime() > endDate.getTime()) {
    throw badRequest('startDate must be earlier than endDate');
  }

  const rangeDays = (endDate.getTime() - startDate.getTime()) / DAY_IN_MS;
  if (rangeDays > OWNER_TRANSACTION_EXPORT_MAX_DAYS) {
    throw badRequest(`Export date range cannot exceed ${OWNER_TRANSACTION_EXPORT_MAX_DAYS} days`);
  }

  return {
    startDate,
    endDate,
  };
};

const normalizeOwnerTransactionExportFilters = (
  filters: OwnerTransactionExportFilters,
  now = new Date(),
): OwnerTransactionExportFilters & { startDate: Date; endDate: Date } => {
  const { startDate, endDate } = normalizeOwnerTransactionExportRange(filters, now);

  return {
    ...filters,
    startDate,
    endDate,
    orderNoKeyword: filters.orderNoKeyword?.trim() || undefined,
  };
};

const normalizeCaregiverEarningsExportFilters = (
  filters: CaregiverEarningsExportFilters,
): CaregiverEarningsExportFilters => {
  if (filters.startDate && filters.endDate) {
    if (filters.startDate.getTime() > filters.endDate.getTime()) {
      throw badRequest('startDate must be earlier than endDate');
    }

    const rangeDays = (filters.endDate.getTime() - filters.startDate.getTime()) / DAY_IN_MS;
    if (rangeDays > OWNER_TRANSACTION_EXPORT_MAX_DAYS) {
      throw badRequest(`Export date range cannot exceed ${OWNER_TRANSACTION_EXPORT_MAX_DAYS} days`);
    }
  }

  return {
    ...filters,
    orderNoKeyword: filters.orderNoKeyword?.trim() || undefined,
    minRefundAmount:
      typeof filters.minRefundAmount === 'number' && Number.isFinite(filters.minRefundAmount)
        ? Number(filters.minRefundAmount.toFixed(2))
        : undefined,
    minComplaintCount:
      typeof filters.minComplaintCount === 'number' && Number.isFinite(filters.minComplaintCount)
        ? Math.trunc(filters.minComplaintCount)
        : undefined,
    refundReasonKeyword: filters.refundReasonKeyword?.trim() || undefined,
    complaintKeyword: filters.complaintKeyword?.trim() || undefined,
    riskOnly: Boolean(filters.riskOnly),
  };
};

type CallbackFailureAlertPayload = {
  callbackAuditId: string;
  callbackStatus: string;
  callbackType: string;
  reason: string;
  requestId: string;
};

const buildCallbackAuditWhere = (
  filters: CallbackAuditQueryFilters,
): Prisma.CallbackAuditWhereInput => {
  const where: Prisma.CallbackAuditWhereInput = {};

  if (filters.callbackType) {
    where.callbackType = filters.callbackType;
  }
  if (filters.callbackStatus) {
    where.callbackStatus = filters.callbackStatus;
  }
  if (filters.sourceMode) {
    where.sourceMode = filters.sourceMode;
  }
  if (filters.requestId) {
    where.requestId = filters.requestId;
  }
  if (filters.paymentId) {
    where.paymentId = filters.paymentId;
  }
  if (filters.refundId) {
    where.refundId = filters.refundId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Prisma.DateTimeFilter).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.createdAt as Prisma.DateTimeFilter).lte = filters.endDate;
    }
  }

  return where;
};

const enqueueCallbackFailureAlert = async (
  tx: Prisma.TransactionClient,
  payload: CallbackFailureAlertPayload,
) =>
  tx.callbackAlertOutbox.create({
    data: withSnowflakeId({
      callbackAuditId: payload.callbackAuditId,
      payload: payload as unknown as Prisma.InputJsonValue,
      eventType: 'CALLBACK_FAILURE_ALERT',
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 5,
      nextRetryAt: new Date(),
    }),
  });

const buildCallbackAlertOutboxWhere = (
  filters: CallbackAlertOutboxQueryFilters,
): Prisma.CallbackAlertOutboxWhereInput => {
  const where: Prisma.CallbackAlertOutboxWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
};

const orderConversationSummarySelect = {
  id: true,
  orderId: true,
  ownerUnreadCount: true,
  caregiverUnreadCount: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderConversationSelect;

const orderMessageSelect = {
  id: true,
  conversationId: true,
  senderRole: true,
  senderUserId: true,
  content: true,
  mediaUrls: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderMessageSelect;

const orderConversationDetailInclude = {
  messages: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: orderMessageSelect,
  },
} satisfies Prisma.OrderConversationInclude;

const orderDetailInclude = {
  payments: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  refunds: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  timelines: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  serviceLogs: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      happenedAt: 'asc',
    },
  },
  review: {
    select: {
      id: true,
      orderId: true,
      ownerId: true,
      caregiverId: true,
      rating: true,
      tags: true,
      content: true,
      isAnonymous: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  conversation: {
    select: orderConversationSummarySelect,
  },
} satisfies Prisma.OrderMainInclude;

type OrderDetailEntity = Prisma.OrderMainGetPayload<{
  include: typeof orderDetailInclude;
}>;

type OrderDetailRecord = Omit<OrderDetailEntity, 'timelines'> & {
  timeline: OrderDetailEntity['timelines'];
};

type OrderConversationSummaryShape = {
  id: string;
  orderId: string;
  ownerUnreadCount: number;
  caregiverUnreadCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderMessageEntity = Prisma.OrderMessageGetPayload<{
  select: typeof orderMessageSelect;
}>;

type OrderConversationDetailEntity = Prisma.OrderConversationGetPayload<{
  include: typeof orderConversationDetailInclude;
}>;

const toOrderConversationRecord = (conversation: OrderConversationSummaryShape | null) => {
  if (!conversation) {
    return null;
  }

  return {
    id: conversation.id,
    orderId: conversation.orderId,
    ownerUnreadCount: conversation.ownerUnreadCount,
    caregiverUnreadCount: conversation.caregiverUnreadCount,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
};

const toOrderMessageRecord = (message: OrderMessageEntity) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderRole: message.senderRole,
  senderUserId: message.senderUserId,
  content: message.content,
  mediaUrls: toStringArray(message.mediaUrls),
  createdAt: message.createdAt,
  updatedAt: message.updatedAt,
});

const toOrderConversationDetailRecord = (conversation: OrderConversationDetailEntity) => ({
  ...toOrderConversationRecord(conversation)!,
  messages: conversation.messages.map(toOrderMessageRecord),
});

const toOrderDetailRecord = (order: OrderDetailEntity): OrderDetailRecord => {
  const { timelines, ...rest } = order;
  return {
    ...rest,
    conversation: toOrderConversationRecord(order.conversation),
    timeline: timelines,
  };
};

const loadOrderDetailById = async (
  client: Prisma.TransactionClient | PrismaClient,
  orderId: string,
) => {
  const order = await client.orderMain.findUnique({
    where: {
      id: orderId,
    },
    include: orderDetailInclude,
  });

  if (!order) {
    throw notFound('Order not found');
  }

  assertOrderAmountInvariant(order);
  return toOrderDetailRecord(order);
};

const orderListInclude = {
  payments: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  refunds: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  conversation: {
    select: orderConversationSummarySelect,
  },
} satisfies Prisma.OrderMainInclude;

type OrderListEntity = Prisma.OrderMainGetPayload<{
  include: typeof orderListInclude;
}>;

const toOrderRecord = (order: OrderListEntity) => ({
  ...order,
  conversation: toOrderConversationRecord(order.conversation),
});

const caregiverEarningsOrderSelect = {
  id: true,
  orderNo: true,
  serviceType: true,
  appointmentStart: true,
  appointmentEnd: true,
  amountPaid: true,
  amountRefunded: true,
  orderStatus: true,
  owner: {
    select: {
      nickname: true,
    },
  },
  serviceRequest: {
    select: {
      locationText: true,
      pet: {
        select: {
          name: true,
        },
      },
    },
  },
} satisfies Prisma.OrderMainSelect;

type CaregiverEarningsOrderEntity = Prisma.OrderMainGetPayload<{
  select: typeof caregiverEarningsOrderSelect;
}>;

const caregiverAftersalesRiskRefundSelect = {
  refundStatus: true,
  refundAmount: true,
  createdAt: true,
} satisfies Prisma.RefundRecordSelect;

type CaregiverAftersalesRiskRefundEntity = Prisma.RefundRecordGetPayload<{
  select: typeof caregiverAftersalesRiskRefundSelect;
}>;

const caregiverAftersalesRiskComplaintSelect = {
  status: true,
  targetRole: true,
  complaintType: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ComplaintSelect;

type CaregiverAftersalesRiskComplaintEntity = Prisma.ComplaintGetPayload<{
  select: typeof caregiverAftersalesRiskComplaintSelect;
}>;

const caregiverAftersalesRiskOrderSelect = {
  ...caregiverEarningsOrderSelect,
  updatedAt: true,
  refunds: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: caregiverAftersalesRiskRefundSelect,
  },
  complaints: {
    where: {
      deleteAt: null,
    },
    orderBy: [
      {
        updatedAt: 'desc',
      },
      {
        createdAt: 'desc',
      },
    ],
    select: caregiverAftersalesRiskComplaintSelect,
  },
} satisfies Prisma.OrderMainSelect;

type CaregiverAftersalesRiskOrderEntity = Prisma.OrderMainGetPayload<{
  select: typeof caregiverAftersalesRiskOrderSelect;
}>;

const caregiverEarningsExportSelect = {
  ...caregiverEarningsOrderSelect,
  closedAt: true,
  complaints: {
    where: {
      deleteAt: null,
    },
    select: {
      id: true,
    },
  },
} satisfies Prisma.OrderMainSelect;

type CaregiverEarningsExportEntity = Prisma.OrderMainGetPayload<{
  select: typeof caregiverEarningsExportSelect;
}>;

const toCaregiverEarningsOrderRecord = (order: CaregiverEarningsOrderEntity) => ({
  id: order.id,
  orderNo: order.orderNo,
  serviceType: order.serviceType,
  appointmentStart: order.appointmentStart,
  appointmentEnd: order.appointmentEnd,
  amountPaid: toNumber(order.amountPaid),
  amountRefunded: toNumber(order.amountRefunded),
  orderStatus: order.orderStatus,
  ownerNickname: order.owner.nickname,
  petName: order.serviceRequest?.pet?.name ?? null,
  locationText: order.serviceRequest?.locationText ?? null,
});

const getCaregiverAftersalesOrderStatusPriority = (
  status:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED',
) => {
  if (status === 'DISPUTED') {
    return 3;
  }
  if (status === 'PARTIAL_REFUNDED') {
    return 2;
  }
  if (status === 'REFUNDED') {
    return 1;
  }
  return 0;
};

const caregiverAftersalesComplaintPriority: Record<
  'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED',
  number
> = {
  OPEN: 4,
  PROCESSING: 3,
  RESOLVED: 2,
  REJECTED: 1,
};

const caregiverAftersalesRefundPriority: Record<
  'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED',
  number
> = {
  APPROVED: 5,
  PENDING: 4,
  FAILED: 3,
  SUCCESS: 2,
  REJECTED: 1,
};

const compareDateDesc = (left: Date | null | undefined, right: Date | null | undefined) =>
  (right?.getTime() ?? 0) - (left?.getTime() ?? 0);

const compareNumberDesc = (left: number | null | undefined, right: number | null | undefined) =>
  (right ?? 0) - (left ?? 0);

const getPrimaryCaregiverAftersalesComplaint = (
  complaints: CaregiverAftersalesRiskComplaintEntity[],
) =>
  [...complaints].sort((left, right) => {
    const priorityDiff =
      caregiverAftersalesComplaintPriority[right.status] -
      caregiverAftersalesComplaintPriority[left.status];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return compareDateDesc(left.updatedAt, right.updatedAt);
  })[0] ?? null;

const compareCaregiverAftersalesRiskOrder = (
  left: CaregiverAftersalesRiskOrderEntity,
  right: CaregiverAftersalesRiskOrderEntity,
) => {
  const orderStatusDiff =
    getCaregiverAftersalesOrderStatusPriority(right.orderStatus) -
    getCaregiverAftersalesOrderStatusPriority(left.orderStatus);
  if (orderStatusDiff !== 0) {
    return orderStatusDiff;
  }

  const leftPrimaryComplaint = getPrimaryCaregiverAftersalesComplaint(left.complaints);
  const rightPrimaryComplaint = getPrimaryCaregiverAftersalesComplaint(right.complaints);
  const complaintDiff =
    (rightPrimaryComplaint
      ? caregiverAftersalesComplaintPriority[rightPrimaryComplaint.status]
      : 0) -
    (leftPrimaryComplaint ? caregiverAftersalesComplaintPriority[leftPrimaryComplaint.status] : 0);
  if (complaintDiff !== 0) {
    return complaintDiff;
  }

  const leftLatestRefund = left.refunds[0] ?? null;
  const rightLatestRefund = right.refunds[0] ?? null;
  const refundDiff =
    (rightLatestRefund ? caregiverAftersalesRefundPriority[rightLatestRefund.refundStatus] : 0) -
    (leftLatestRefund ? caregiverAftersalesRefundPriority[leftLatestRefund.refundStatus] : 0);
  if (refundDiff !== 0) {
    return refundDiff;
  }

  const refundAmountDiff = compareNumberDesc(
    leftLatestRefund ? toNumber(leftLatestRefund.refundAmount) : toNumber(left.amountRefunded),
    rightLatestRefund ? toNumber(rightLatestRefund.refundAmount) : toNumber(right.amountRefunded),
  );
  if (refundAmountDiff !== 0) {
    return refundAmountDiff;
  }

  return compareDateDesc(left.updatedAt, right.updatedAt);
};

const toCaregiverAftersalesRiskOrderRecord = (order: CaregiverAftersalesRiskOrderEntity) => {
  const primaryComplaint = getPrimaryCaregiverAftersalesComplaint(order.complaints);
  const latestRefund = order.refunds[0] ?? null;

  return {
    ...toCaregiverEarningsOrderRecord(order),
    latestRefundStatus: latestRefund?.refundStatus ?? null,
    latestRefundAmount: latestRefund ? toNumber(latestRefund.refundAmount) : null,
    complaintCount: order.complaints.length,
    primaryComplaintStatus: primaryComplaint?.status ?? null,
    primaryComplaintTargetRole: primaryComplaint?.targetRole ?? null,
    primaryComplaintType: primaryComplaint?.complaintType ?? null,
  };
};

const toCaregiverEarningsExportRow = (
  order: CaregiverEarningsExportEntity,
): CaregiverEarningsExportRow => ({
  ...toCaregiverEarningsOrderRecord(order),
  netIncome: Number(calcNetIncome(order.amountPaid, order.amountRefunded).toFixed(2)),
  closedAt: order.closedAt,
});

const getApprovedCaregiverProfile = async (
  client: Prisma.TransactionClient | PrismaClient,
  userId: string,
) => {
  const profile = await client.caregiverProfile.findFirst({
    where: {
      userId,
      deleteAt: null,
    },
    select: {
      id: true,
      auditStatus: true,
    },
  });

  if (!profile) {
    throw notFound('Caregiver profile not found');
  }

  if (profile.auditStatus !== 'APPROVED') {
    throw forbidden('Caregiver profile is not approved');
  }

  return profile;
};

const normalizeMessageContent = (content?: string | null) => {
  const normalized = content?.trim() ?? '';
  return normalized ? normalized.slice(0, 1000) : null;
};

const normalizeMessageMediaUrls = (mediaUrls?: string[]) =>
  [...new Set((mediaUrls ?? []).map((url) => url.trim()).filter(Boolean))].slice(0, 10);

const buildMessagePreview = (content: string | null, mediaUrls: string[]) => {
  if (content) {
    return content.length > 80 ? `${content.slice(0, 77)}...` : content;
  }

  if (mediaUrls.length > 0) {
    return mediaUrls.length === 1 ? '[附件消息]' : `[附件消息 ${mediaUrls.length}]`;
  }

  return null;
};

type OrderConversationParticipant = {
  orderId: string;
  ownerId: string;
  caregiverId: string;
  caregiverUserId: string;
  actorRole: 'OWNER' | 'CAREGIVER';
};

const loadOrderConversationParticipant = async (
  client: Prisma.TransactionClient | PrismaClient,
  userId: string,
  orderId: string,
): Promise<OrderConversationParticipant> => {
  const order = await client.orderMain.findFirst({
    where: {
      id: orderId,
      deleteAt: null,
      OR: [
        {
          ownerId: userId,
        },
        {
          caregiver: {
            userId,
            deleteAt: null,
          },
        },
      ],
    },
    select: {
      id: true,
      ownerId: true,
      caregiverId: true,
      caregiver: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!order) {
    throw notFound('Order not found');
  }

  return {
    orderId: order.id,
    ownerId: order.ownerId,
    caregiverId: order.caregiverId,
    caregiverUserId: order.caregiver.userId,
    actorRole: order.ownerId === userId ? 'OWNER' : 'CAREGIVER',
  };
};

const ensureOrderConversation = async (
  client: Prisma.TransactionClient | PrismaClient,
  orderId: string,
) =>
  client.orderConversation.upsert({
    where: {
      orderId,
    },
    create: withSnowflakeId({
      orderId,
      ownerUnreadCount: 0,
      caregiverUnreadCount: 0,
    }),
    update: {},
  });

const loadOrderConversationDetail = async (
  client: Prisma.TransactionClient | PrismaClient,
  orderId: string,
) => {
  const conversation = await client.orderConversation.findUnique({
    where: {
      orderId,
    },
    include: orderConversationDetailInclude,
  });

  if (!conversation) {
    throw notFound('Order conversation not found');
  }

  return toOrderConversationDetailRecord(conversation);
};

const appendOrderTimeline = async (
  client: Prisma.TransactionClient,
  payload: {
    orderId: string;
    eventType:
      | 'CREATED'
      | 'ACCEPTED'
      | 'CHECKED_IN'
      | 'SERVICE_LOGGED'
      | 'CHECKED_OUT'
      | 'COMPLETED'
      | 'DISPUTED'
      | 'CANCELLED'
      | 'REFUND_APPLIED'
      | 'REFUND_DONE';
    operatorRole: 'OWNER' | 'CAREGIVER' | 'ADMIN' | 'SYSTEM';
    operatorId?: string | null;
    eventPayload?: Prisma.InputJsonValue;
  },
) =>
  client.orderTimeline.create({
    data: withSnowflakeId({
      orderId: payload.orderId,
      eventType: payload.eventType,
      operatorRole: payload.operatorRole,
      operatorId: payload.operatorId ?? null,
      eventPayload: payload.eventPayload ?? Prisma.JsonNull,
    }),
  });

const appendServiceLog = async (
  client: Prisma.TransactionClient,
  payload: {
    orderId: string;
    caregiverId: string;
    logType: 'CHECK_IN' | 'FEED' | 'WALK' | 'PLAY' | 'HEALTH' | 'CHECK_OUT' | 'NOTE';
    textNote?: string | null;
    mediaUrls?: string[];
    geo?: Record<string, unknown> | null;
    happenedAt?: Date;
  },
) =>
  client.serviceLog.create({
    data: withSnowflakeId({
      orderId: payload.orderId,
      caregiverId: payload.caregiverId,
      logType: payload.logType,
      textNote: payload.textNote?.trim() || null,
      mediaUrls: (payload.mediaUrls ?? []) as Prisma.InputJsonValue,
      geo: payload.geo ? (payload.geo as Prisma.InputJsonValue) : Prisma.JsonNull,
      happenedAt: payload.happenedAt ?? new Date(),
    }),
  });

const appendComplaintProcessLog = async (
  client: Prisma.TransactionClient,
  payload: {
    complaintId: string;
    actionType: 'OPEN' | 'ASSIGN' | 'INVESTIGATE' | 'CALL_USER' | 'PENALTY' | 'CLOSE';
    operatorId?: string | null;
    note?: string | null;
  },
) =>
  client.complaintProcessLog.create({
    data: withSnowflakeId({
      complaintId: payload.complaintId,
      actionType: payload.actionType,
      operatorId: payload.operatorId ?? null,
      note: payload.note?.trim() || null,
    }),
  });

const normalizeReviewTags = (tags?: string[]) =>
  [...new Set((tags ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 8);

const normalizeEvidenceUrls = (urls?: string[]) =>
  [...new Set((urls ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, 10);

const toStringArray = (value: Prisma.JsonValue | null | undefined) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const toRecord = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeTagList = (tags?: string[], limit = 12) =>
  [...new Set((tags ?? []).map((item) => item.trim()).filter(Boolean))].slice(0, limit);

const normalizePetEmergencyContact = (
  contact?: {
    name: string;
    phone: string;
    relation?: string;
  } | null,
) => {
  if (!contact) {
    return null;
  }

  const name = contact.name.trim();
  const phone = contact.phone.trim();
  if (!name || !phone) {
    return null;
  }

  return {
    name,
    phone,
    relation: contact.relation?.trim() || null,
  };
};

const toPetEmergencyContact = (value: Prisma.JsonValue | null | undefined) => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const phone = typeof record.phone === 'string' ? record.phone.trim() : '';
  if (!name || !phone) {
    return null;
  }

  return {
    name,
    phone,
    relation:
      typeof record.relation === 'string' && record.relation.trim() ? record.relation.trim() : null,
  };
};

const normalizeQualificationMaterials = (
  materials?: Array<{
    fileId: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
    uploadedAt: Date;
  }>,
) =>
  (materials ?? [])
    .map((item) => ({
      fileId: item.fileId.trim(),
      url: item.url.trim(),
      name: item.name.trim(),
      mimeType: item.mimeType.trim(),
      size: Math.max(1, Math.trunc(item.size)),
      uploadedAt: item.uploadedAt.toISOString(),
    }))
    .filter((item) => item.fileId && item.url && item.name && item.mimeType);

const toQualificationMaterials = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const fileId = typeof item.fileId === 'string' ? item.fileId.trim() : '';
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const mimeType = typeof item.mimeType === 'string' ? item.mimeType.trim() : '';
    const uploadedAt = typeof item.uploadedAt === 'string' ? item.uploadedAt : '';
    const size = typeof item.size === 'number' ? Math.trunc(item.size) : Number(item.size ?? 0);

    if (
      !fileId ||
      !url ||
      !name ||
      !mimeType ||
      !uploadedAt ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      return [];
    }

    return [
      {
        fileId,
        url,
        name,
        mimeType,
        size,
        uploadedAt,
      },
    ];
  });
};

const createPetPalBizNo = (prefix: string, now = new Date()) => {
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
    String(now.getMilliseconds()).padStart(3, '0'),
    String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
  ];
  return `${prefix}${parts.join('')}`;
};

const toRoundedAmount = (value: number) => Number(value.toFixed(2));

const estimateServiceUnits = (payload: {
  serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
  unitType: string;
  startTime: Date;
  endTime: Date;
}) => {
  const durationHours = Math.max(
    1,
    (payload.endTime.getTime() - payload.startTime.getTime()) / (60 * 60 * 1000),
  );
  const normalizedUnitType = payload.unitType.trim().toUpperCase();

  if (normalizedUnitType.includes('DAY')) {
    return Math.max(1, Math.ceil(durationHours / 24));
  }
  if (normalizedUnitType.includes('HOUR')) {
    return Math.max(1, Math.ceil(durationHours));
  }
  if (normalizedUnitType.includes('HALF')) {
    return Math.max(1, Math.ceil(durationHours / 12));
  }
  if (
    normalizedUnitType.includes('VISIT') ||
    normalizedUnitType.includes('TIME') ||
    normalizedUnitType.includes('TRIP')
  ) {
    return 1;
  }
  if (payload.serviceType === 'BOARDING') {
    return Math.max(1, Math.ceil(durationHours / 24));
  }
  return 1;
};

const toPetProfileRecord = (pet: PetProfile) => ({
  ...pet,
  temperamentTags: toStringArray(pet.temperamentTags),
  emergencyContact: toPetEmergencyContact(pet.emergencyContact),
});

const toCaregiverProfileRecord = (profile: CaregiverProfile) => ({
  ...profile,
  specialtyTags: toStringArray(profile.specialtyTags),
  qualificationMaterials: toQualificationMaterials(profile.qualificationMaterials),
});

const complaintInclude = {
  assignedAdmin: {
    select: {
      id: true,
      nickname: true,
    },
  },
  processLogs: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
    include: {
      operator: {
        select: {
          id: true,
          nickname: true,
        },
      },
    },
  },
} satisfies Prisma.ComplaintInclude;

type ComplaintEntity = Prisma.ComplaintGetPayload<{
  include: typeof complaintInclude;
}>;

const complaintAdminInclude = {
  ...complaintInclude,
  order: {
    select: {
      id: true,
      orderNo: true,
      orderStatus: true,
      ownerId: true,
      caregiverId: true,
      owner: {
        select: {
          nickname: true,
        },
      },
      caregiver: {
        select: {
          user: {
            select: {
              nickname: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ComplaintInclude;

type ComplaintAdminEntity = Prisma.ComplaintGetPayload<{
  include: typeof complaintAdminInclude;
}>;

const toComplaintRecord = (complaint: ComplaintEntity) => ({
  id: complaint.id,
  orderId: complaint.orderId,
  complainantId: complaint.complainantId,
  targetRole: complaint.targetRole,
  complaintType: complaint.complaintType,
  description: complaint.description,
  evidenceUrls: toStringArray(complaint.evidenceUrls),
  status: complaint.status,
  resultSummary: complaint.resultSummary,
  assignedAdminId: complaint.assignedAdminId,
  assignedAdminNickname: complaint.assignedAdmin?.nickname ?? null,
  closedAt: complaint.closedAt,
  createdAt: complaint.createdAt,
  updatedAt: complaint.updatedAt,
  processLogs: complaint.processLogs.map((log) => ({
    id: log.id,
    complaintId: log.complaintId,
    actionType: log.actionType,
    operatorId: log.operatorId,
    operatorNickname: log.operator?.nickname ?? null,
    note: log.note,
    createdAt: log.createdAt,
  })),
});

const toComplaintAdminRecord = (complaint: ComplaintAdminEntity) => ({
  ...toComplaintRecord(complaint),
  orderNo: complaint.order.orderNo,
  orderStatus: complaint.order.orderStatus,
  ownerId: complaint.order.ownerId,
  ownerNickname: complaint.order.owner.nickname,
  caregiverId: complaint.order.caregiverId,
  caregiverNickname: complaint.order.caregiver.user.nickname,
  ...getComplaintAdminSlaMeta(complaint),
});

const loadOrderComplaintsByOrderId = async (
  client: Prisma.TransactionClient | PrismaClient,
  orderId: string,
) =>
  client.complaint.findMany({
    where: {
      orderId,
      deleteAt: null,
    },
    include: complaintInclude,
    orderBy: {
      createdAt: 'desc',
    },
  });

const getComplaintAdminSlaMeta = (complaint: Pick<ComplaintEntity, 'status' | 'createdAt'>) => {
  if (
    !ACTIVE_COMPLAINT_STATUSES.includes(
      complaint.status as (typeof ACTIVE_COMPLAINT_STATUSES)[number],
    )
  ) {
    return {
      slaStatus: null,
      slaDeadlineAt: null,
    };
  }

  const deadline = new Date(complaint.createdAt.getTime() + COMPLAINT_SLA_LIMIT_MS);
  const remainingMs = deadline.getTime() - Date.now();

  return {
    slaStatus:
      remainingMs < 0 ? 'OVERDUE' : remainingMs <= COMPLAINT_SLA_WARNING_MS ? 'DUE_SOON' : 'NORMAL',
    slaDeadlineAt: deadline,
  };
};

const buildComplaintAdminSlaWhere = (
  slaStatus?: ComplaintAdminFilters['slaStatus'],
): Prisma.ComplaintWhereInput | undefined => {
  if (!slaStatus) {
    return undefined;
  }

  const now = Date.now();
  const overdueBoundary = new Date(now - COMPLAINT_SLA_LIMIT_MS);
  const warningBoundary = new Date(now - COMPLAINT_SLA_DUE_SOON_AGE_MS);

  if (slaStatus === 'OVERDUE') {
    return {
      status: {
        in: [...ACTIVE_COMPLAINT_STATUSES],
      },
      createdAt: {
        lt: overdueBoundary,
      },
    };
  }

  if (slaStatus === 'DUE_SOON') {
    return {
      status: {
        in: [...ACTIVE_COMPLAINT_STATUSES],
      },
      createdAt: {
        gte: overdueBoundary,
        lte: warningBoundary,
      },
    };
  }

  return {
    status: {
      in: [...ACTIVE_COMPLAINT_STATUSES],
    },
    createdAt: {
      gt: warningBoundary,
    },
  };
};

const buildComplaintAdminWhere = (
  filters: ComplaintAdminScopeFilters,
): Prisma.ComplaintWhereInput => {
  const keyword = filters.keyword?.trim();
  const slaWhere = buildComplaintAdminSlaWhere(filters.slaStatus);

  return {
    deleteAt: null,
    status: filters.status,
    complaintType: filters.complaintType,
    targetRole: filters.targetRole,
    assignedAdminId: filters.unassignedOnly ? null : filters.assignedAdminId,
    AND: slaWhere ? [slaWhere] : undefined,
    OR: keyword
      ? [
          {
            description: {
              contains: keyword,
            },
          },
          {
            resultSummary: {
              contains: keyword,
            },
          },
          {
            order: {
              orderNo: {
                contains: keyword,
              },
            },
          },
          {
            order: {
              owner: {
                nickname: {
                  contains: keyword,
                },
              },
            },
          },
          {
            order: {
              caregiver: {
                user: {
                  nickname: {
                    contains: keyword,
                  },
                },
              },
            },
          },
          {
            assignedAdmin: {
              nickname: {
                contains: keyword,
              },
            },
          },
        ]
      : undefined,
  };
};

const toComplaintAdminStatsBaseFilters = (
  filters: ComplaintAdminScopeFilters,
): ComplaintAdminScopeFilters => ({
  complaintType: filters.complaintType,
  targetRole: filters.targetRole,
  assignedAdminId: filters.assignedAdminId,
  unassignedOnly: filters.unassignedOnly,
  keyword: filters.keyword,
});

const loadAdminComplaintById = async (
  client: Prisma.TransactionClient | PrismaClient,
  complaintId: string,
) =>
  client.complaint.findFirst({
    where: {
      id: complaintId,
      deleteAt: null,
    },
    include: complaintAdminInclude,
  });

const loadComplaintAdminAssignee = async (
  client: Prisma.TransactionClient | PrismaClient,
  assigneeId: string,
) =>
  client.user.findFirst({
    where: {
      id: assigneeId.trim(),
      deleteAt: null,
      status: 'ACTIVE',
      roles: {
        some: {
          role: {
            code: {
              in: ['super-admin', 'ops-manager'],
            },
          },
        },
      },
    },
    select: {
      id: true,
      nickname: true,
    },
  });

function assertComplaintUpdatable(
  complaint: {
    id: string;
    status: 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
  } | null,
): asserts complaint is {
  id: string;
  status: 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
} {
  if (!complaint) {
    throw notFound('Complaint not found');
  }

  if (complaint.status === 'RESOLVED' || complaint.status === 'REJECTED') {
    throw badRequest('Closed complaints cannot be updated');
  }
}

const assignComplaintInTransaction = async (
  tx: Prisma.TransactionClient,
  payload: {
    complaintId: string;
    actorId: string;
    currentStatus: 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
    assignee: {
      id: string;
      nickname: string;
    };
    note?: string;
  },
) => {
  await tx.complaint.update({
    where: {
      id: payload.complaintId,
    },
    data: {
      assignedAdminId: payload.assignee.id,
      status: payload.currentStatus === 'OPEN' ? 'PROCESSING' : payload.currentStatus,
    },
  });

  await appendComplaintProcessLog(tx, {
    complaintId: payload.complaintId,
    actionType: 'ASSIGN',
    operatorId: payload.actorId,
    note: payload.note?.trim() || `已指派给 ${payload.assignee.nickname}`,
  });
};

const closeComplaintInTransaction = async (
  tx: Prisma.TransactionClient,
  payload: {
    complaintId: string;
    actorId: string;
    assignedAdminId?: string | null;
    resultStatus: 'RESOLVED' | 'REJECTED';
    resultSummary: string;
  },
) => {
  const resultSummary = payload.resultSummary.trim();

  await tx.complaint.update({
    where: {
      id: payload.complaintId,
    },
    data: {
      status: payload.resultStatus,
      resultSummary,
      closedAt: new Date(),
      assignedAdminId: payload.assignedAdminId ?? payload.actorId,
    },
  });

  await appendComplaintProcessLog(tx, {
    complaintId: payload.complaintId,
    actionType: 'CLOSE',
    operatorId: payload.actorId,
    note: resultSummary,
  });
};

const buildOwnerRefundProgress = (order: {
  amountPaid: Prisma.Decimal | number;
  amountRefunded: Prisma.Decimal | number;
  orderStatus:
    | 'PENDING_ACCEPT'
    | 'ACCEPTED'
    | 'SERVING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'DISPUTED'
    | 'PARTIAL_REFUNDED'
    | 'REFUNDED';
  refunds: Array<{
    refundNo: string;
    refundAmount: Prisma.Decimal | number;
    refundStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';
    refundReason: string;
    createdAt: Date;
    reviewedAt: Date | null;
  }>;
}): OwnerRefundProgressRecord => {
  const refunds = order.refunds;
  const latestRefund = refunds[refunds.length - 1] ?? null;
  const pendingCount = refunds.filter((item) => item.refundStatus === 'PENDING').length;
  const approvedCount = refunds.filter((item) => item.refundStatus === 'APPROVED').length;
  const successCount = refunds.filter((item) => item.refundStatus === 'SUCCESS').length;
  const rejectedCount = refunds.filter((item) => item.refundStatus === 'REJECTED').length;
  const failedCount = refunds.filter((item) => item.refundStatus === 'FAILED').length;
  const requestedRefundAmount = refunds.reduce((sum, item) => sum + toNumber(item.refundAmount), 0);
  const settledRefundAmount = toNumber(order.amountRefunded);
  const refundableBalance = Number(
    Math.max(0, toNumber(order.amountPaid) - settledRefundAmount).toFixed(2),
  );

  let stage: OwnerRefundProgressStage = 'NONE';
  if (approvedCount > 0) {
    stage = 'APPROVED_WAITING';
  } else if (pendingCount > 0) {
    stage = 'PENDING_REVIEW';
  } else if (successCount > 0) {
    stage =
      order.orderStatus === 'REFUNDED' || refundableBalance <= 0
        ? 'FULL_SUCCESS'
        : 'PARTIAL_SUCCESS';
  } else if (latestRefund?.refundStatus === 'REJECTED') {
    stage = 'REJECTED';
  } else if (latestRefund?.refundStatus === 'FAILED') {
    stage = 'FAILED';
  }

  return {
    stage,
    latestRefundNo: latestRefund?.refundNo ?? null,
    latestRefundStatus: latestRefund?.refundStatus ?? null,
    latestRefundAmount: latestRefund ? toNumber(latestRefund.refundAmount) : null,
    latestRefundReason: latestRefund?.refundReason ?? null,
    latestAppliedAt: latestRefund?.createdAt ?? null,
    latestReviewedAt: latestRefund?.reviewedAt ?? null,
    totalRefundCount: refunds.length,
    pendingCount,
    approvedCount,
    successCount,
    rejectedCount,
    failedCount,
    requestedRefundAmount: Number(requestedRefundAmount.toFixed(2)),
    settledRefundAmount: Number(settledRefundAmount.toFixed(2)),
    refundableBalance,
  };
};

const writeCallbackAlertReplayLog = async (input: {
  outboxIds: string[];
  actorId?: string | null;
  actionType: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
  note?: string;
}) => {
  const outboxIds = [...new Set(input.outboxIds.filter(Boolean))];
  if (!outboxIds.length) {
    return;
  }

  await prisma.callbackAlertReplayLog.createMany({
    data: outboxIds.map((outboxId) =>
      withSnowflakeId({
        callbackOutboxId: outboxId,
        actionType: input.actionType,
        actorId: input.actorId ?? null,
        note: input.note ?? null,
      }),
    ),
  });
};

export const petpalService = {
  async getOrCreateCaregiverProfile(userId: string) {
    const existing = await prisma.caregiverProfile.findUnique({
      where: {
        userId,
      },
    });

    if (existing) {
      return toCaregiverProfileRecord(existing);
    }

    const created = await prisma.caregiverProfile.create({
      data: withSnowflakeId({
        userId,
        auditStatus: 'PENDING',
        specialtyTags: [],
        qualificationMaterials: [],
      }),
    });
    return toCaregiverProfileRecord(created);
  },

  async upsertCaregiverProfile(
    userId: string,
    payload: {
      intro?: string;
      experienceYears?: number;
      serviceRadiusKm?: number;
      serviceCity?: string;
      specialtyTags?: string[];
      serviceCommitment?: string;
      qualificationMaterials?: Array<{
        fileId: string;
        url: string;
        name: string;
        mimeType: string;
        size: number;
        uploadedAt: Date;
      }>;
    },
  ) {
    const current = await petpalService.getOrCreateCaregiverProfile(userId);
    const nextAuditStatus = current.auditStatus === 'REJECTED' ? 'PENDING' : current.auditStatus;

    const updated = await prisma.caregiverProfile.update({
      where: {
        id: current.id,
      },
      data: {
        intro: payload.intro?.trim() || null,
        experienceYears: payload.experienceYears ?? current.experienceYears,
        serviceRadiusKm: payload.serviceRadiusKm ?? current.serviceRadiusKm,
        serviceCity: payload.serviceCity?.trim() || null,
        specialtyTags: payload.specialtyTags ? normalizeTagList(payload.specialtyTags) : undefined,
        serviceCommitment: payload.serviceCommitment?.trim() || null,
        qualificationMaterials: payload.qualificationMaterials
          ? normalizeQualificationMaterials(payload.qualificationMaterials)
          : undefined,
        auditStatus: nextAuditStatus,
      },
    });
    return toCaregiverProfileRecord(updated);
  },

  async getCaregiverEarningsSummary(userId: string) {
    const caregiverProfile = await petpalService.getOrCreateCaregiverProfile(userId);
    const serviceWhere: Prisma.CaregiverServiceWhereInput = {
      caregiverId: caregiverProfile.id,
      deleteAt: null,
    };
    const trendBuckets = buildCaregiverEarningsTrendBuckets();

    const [totalServiceCount, activeServiceCount] = await Promise.all([
      prisma.caregiverService.count({ where: serviceWhere }),
      prisma.caregiverService.count({
        where: {
          ...serviceWhere,
          isActive: true,
        },
      }),
    ]);

    const profile = {
      auditStatus: caregiverProfile.auditStatus,
      ratingAvg: toNumber(caregiverProfile.ratingAvg),
      ratingCount: caregiverProfile.ratingCount,
      serviceCity: caregiverProfile.serviceCity,
      experienceYears: caregiverProfile.experienceYears,
      serviceRadiusKm: caregiverProfile.serviceRadiusKm,
    };

    if (caregiverProfile.auditStatus !== 'APPROVED') {
      return {
        profile,
        totals: {
          totalIncome: 0,
          recentThirtyDayIncome: 0,
          averageTicket: 0,
          refundExposure: 0,
          completedOrderCount: 0,
          activeOrderCount: 0,
          aftersalesOrderCount: 0,
          aftersalesRiskRate: 0,
          activeServiceCount,
          totalServiceCount,
        },
        latestActiveOrder: null,
        recentAftersalesOrders: [],
        recentCompletedOrders: [],
        serviceRevenueMix: [],
        trends: {
          daily: toCaregiverEarningsTrendRecords(trendBuckets.daily),
          weekly: toCaregiverEarningsTrendRecords(trendBuckets.weekly),
          monthly: toCaregiverEarningsTrendRecords(trendBuckets.monthly),
        },
      };
    }

    const completedWhere: Prisma.OrderMainWhereInput = {
      deleteAt: null,
      caregiverId: caregiverProfile.id,
      orderStatus: 'COMPLETED',
    };
    const recentThirtyDayThreshold = new Date(Date.now() - 30 * DAY_IN_MS);
    const activeWhere: Prisma.OrderMainWhereInput = {
      deleteAt: null,
      caregiverId: caregiverProfile.id,
      orderStatus: {
        in: ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'],
      },
    };
    const aftersalesWhere: Prisma.OrderMainWhereInput = {
      deleteAt: null,
      caregiverId: caregiverProfile.id,
      orderStatus: {
        in: ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'],
      },
    };

    const [
      completedOrderCount,
      completedAggregate,
      recentThirtyDayAggregate,
      activeOrderCount,
      aftersalesRiskOrders,
      serviceRevenueRows,
      latestActiveOrder,
      recentCompletedOrders,
      completedTrendRows,
    ] = await Promise.all([
      prisma.orderMain.count({ where: completedWhere }),
      prisma.orderMain.aggregate({
        where: completedWhere,
        _sum: {
          amountPaid: true,
          amountRefunded: true,
        },
      }),
      prisma.orderMain.aggregate({
        where: {
          ...completedWhere,
          appointmentEnd: {
            gte: recentThirtyDayThreshold,
          },
        },
        _sum: {
          amountPaid: true,
          amountRefunded: true,
        },
      }),
      prisma.orderMain.count({ where: activeWhere }),
      prisma.orderMain.findMany({
        where: aftersalesWhere,
        select: caregiverAftersalesRiskOrderSelect,
      }),
      prisma.orderMain.groupBy({
        by: ['serviceType'],
        where: completedWhere,
        _count: {
          _all: true,
        },
        _sum: {
          amountPaid: true,
          amountRefunded: true,
        },
      }),
      prisma.orderMain.findFirst({
        where: activeWhere,
        select: caregiverEarningsOrderSelect,
        orderBy: [
          {
            appointmentStart: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
      }),
      prisma.orderMain.findMany({
        where: completedWhere,
        select: caregiverEarningsOrderSelect,
        orderBy: [
          {
            appointmentEnd: 'desc',
          },
          {
            createdAt: 'desc',
          },
        ],
        take: 6,
      }),
      prisma.orderMain.findMany({
        where: {
          ...completedWhere,
          appointmentEnd: {
            gte: trendBuckets.monthly[0]?.rangeStart,
          },
        },
        select: {
          appointmentEnd: true,
          amountPaid: true,
          amountRefunded: true,
        },
      }),
    ]);

    const totalIncome = calcNetIncome(
      completedAggregate._sum.amountPaid,
      completedAggregate._sum.amountRefunded,
    );
    const recentThirtyDayIncome = calcNetIncome(
      recentThirtyDayAggregate._sum.amountPaid,
      recentThirtyDayAggregate._sum.amountRefunded,
    );
    const refundExposure = aftersalesRiskOrders.reduce(
      (sum, row) => sum + calcNetIncome(row.amountPaid, row.amountRefunded),
      0,
    );
    const aftersalesOrderCount = aftersalesRiskOrders.length;
    const averageTicket =
      completedOrderCount > 0 ? Number((totalIncome / completedOrderCount).toFixed(2)) : 0;
    const aftersalesRiskRate =
      completedOrderCount + aftersalesOrderCount > 0
        ? Number((aftersalesOrderCount / (completedOrderCount + aftersalesOrderCount)).toFixed(4))
        : 0;
    const recentAftersalesOrders = [...aftersalesRiskOrders]
      .sort(compareCaregiverAftersalesRiskOrder)
      .slice(0, 6);

    for (const row of completedTrendRows) {
      const revenue = calcNetIncome(row.amountPaid, row.amountRefunded);
      appendCaregiverEarningsTrendValue(trendBuckets.daily, row.appointmentEnd, revenue);
      appendCaregiverEarningsTrendValue(trendBuckets.weekly, row.appointmentEnd, revenue);
      appendCaregiverEarningsTrendValue(trendBuckets.monthly, row.appointmentEnd, revenue);
    }

    return {
      profile,
      totals: {
        totalIncome: Number(totalIncome.toFixed(2)),
        recentThirtyDayIncome: Number(recentThirtyDayIncome.toFixed(2)),
        averageTicket,
        refundExposure: Number(refundExposure.toFixed(2)),
        completedOrderCount,
        activeOrderCount,
        aftersalesOrderCount,
        aftersalesRiskRate,
        activeServiceCount,
        totalServiceCount,
      },
      latestActiveOrder: latestActiveOrder
        ? toCaregiverEarningsOrderRecord(latestActiveOrder)
        : null,
      recentAftersalesOrders: recentAftersalesOrders.map(toCaregiverAftersalesRiskOrderRecord),
      recentCompletedOrders: recentCompletedOrders.map(toCaregiverEarningsOrderRecord),
      serviceRevenueMix: serviceRevenueRows
        .map((row) => {
          const revenue = calcNetIncome(row._sum.amountPaid, row._sum.amountRefunded);
          return {
            serviceType: row.serviceType,
            revenue: Number(revenue.toFixed(2)),
            orderCount: row._count._all,
            averageTicket: row._count._all > 0 ? Number((revenue / row._count._all).toFixed(2)) : 0,
            shareRatio: totalIncome > 0 ? Number((revenue / totalIncome).toFixed(4)) : 0,
          };
        })
        .sort((left, right) => Number(right.revenue) - Number(left.revenue)),
      trends: {
        daily: toCaregiverEarningsTrendRecords(trendBuckets.daily),
        weekly: toCaregiverEarningsTrendRecords(trendBuckets.weekly),
        monthly: toCaregiverEarningsTrendRecords(trendBuckets.monthly),
      },
    };
  },

  async listCaregiverServices(userId: string) {
    const profile = await petpalService.getOrCreateCaregiverProfile(userId);

    return prisma.caregiverService.findMany({
      where: {
        caregiverId: profile.id,
        deleteAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async listCaregiverEarningsExportRows(
    filters: CaregiverEarningsExportFilters = {},
  ): Promise<CaregiverEarningsExportRow[]> {
    const actorId = getRequestActorId();
    if (!actorId) {
      throw forbidden('Authentication required');
    }

    const normalizedFilters = normalizeCaregiverEarningsExportFilters(filters);
    const caregiverProfile = await petpalService.getOrCreateCaregiverProfile(actorId);
    if (caregiverProfile.auditStatus !== 'APPROVED') {
      return [];
    }

    const orders = await prisma.orderMain.findMany({
      where: {
        caregiverId: caregiverProfile.id,
        deleteAt: null,
        orderStatus: 'COMPLETED',
        ...(normalizedFilters.serviceType
          ? {
              serviceType: normalizedFilters.serviceType,
            }
          : {}),
        ...(normalizedFilters.orderNoKeyword
          ? {
              orderNo: {
                contains: normalizedFilters.orderNoKeyword,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(normalizedFilters.riskOnly || normalizedFilters.minRefundAmount != null
          ? {
              amountRefunded: {
                ...(normalizedFilters.minRefundAmount != null
                  ? {
                      gte: normalizedFilters.minRefundAmount,
                    }
                  : {
                      gt: 0,
                    }),
              },
            }
          : {}),
        ...(normalizedFilters.refundType
          || normalizedFilters.refundStatus
          || normalizedFilters.refundReasonKeyword
          ? {
              refunds: {
                some: {
                  deleteAt: null,
                  ...(normalizedFilters.refundType
                    ? {
                        refundType: normalizedFilters.refundType,
                      }
                    : {}),
                  ...(normalizedFilters.refundStatus
                    ? {
                        refundStatus: normalizedFilters.refundStatus,
                      }
                    : {}),
                  ...(normalizedFilters.refundReasonKeyword
                    ? {
                        refundReason: {
                          contains: normalizedFilters.refundReasonKeyword,
                          mode: 'insensitive' as const,
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
        ...(normalizedFilters.complaintStatus
          || normalizedFilters.complaintType
          || normalizedFilters.complaintKeyword
          || normalizedFilters.complaintTargetRole
          ? {
              complaints: {
                some: {
                  deleteAt: null,
                  ...(normalizedFilters.complaintStatus
                    ? {
                        status: normalizedFilters.complaintStatus,
                      }
                    : {}),
                  ...(normalizedFilters.complaintType
                    ? {
                        complaintType: normalizedFilters.complaintType,
                      }
                    : {}),
                  ...(normalizedFilters.complaintKeyword
                    ? {
                        OR: [
                          {
                            description: {
                              contains: normalizedFilters.complaintKeyword,
                              mode: 'insensitive' as const,
                            },
                          },
                          {
                            resultSummary: {
                              contains: normalizedFilters.complaintKeyword,
                              mode: 'insensitive' as const,
                            },
                          },
                        ],
                      }
                    : {}),
                  ...(normalizedFilters.complaintTargetRole
                    ? {
                        targetRole: normalizedFilters.complaintTargetRole,
                      }
                    : {}),
                },
              },
            }
          : {}),
        ...(normalizedFilters.startDate || normalizedFilters.endDate
          ? {
              appointmentEnd: {
                ...(normalizedFilters.startDate
                  ? {
                      gte: normalizedFilters.startDate,
                    }
                  : {}),
                ...(normalizedFilters.endDate
                  ? {
                      lte: normalizedFilters.endDate,
                    }
                  : {}),
              },
            }
          : {}),
      },
      orderBy: [
        {
          appointmentEnd: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      select: caregiverEarningsExportSelect,
      take: 5000,
    });

    const filteredOrders =
      normalizedFilters.minComplaintCount != null
        ? orders.filter((order) => order.complaints.length >= normalizedFilters.minComplaintCount!)
        : orders;

    return filteredOrders.map(toCaregiverEarningsExportRow);
  },

  async createCaregiverService(
    userId: string,
    payload: {
      serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
      petSpecies: 'DOG' | 'CAT' | 'OTHER';
      pricePerUnit: number;
      unitType: string;
      minNoticeHours?: number;
      availableSlots?: unknown;
      serviceCity?: string;
      serviceLat?: number;
      serviceLng?: number;
      isActive?: boolean;
    },
  ) {
    const profile = await petpalService.getOrCreateCaregiverProfile(userId);

    return prisma.caregiverService.create({
      data: withSnowflakeId({
        caregiverId: profile.id,
        serviceType: payload.serviceType,
        petSpecies: payload.petSpecies,
        pricePerUnit: payload.pricePerUnit,
        unitType: payload.unitType.trim(),
        minNoticeHours: payload.minNoticeHours ?? 2,
        availableSlots: (payload.availableSlots ?? []) as Prisma.InputJsonValue,
        serviceCity: payload.serviceCity?.trim() || null,
        serviceLat: payload.serviceLat,
        serviceLng: payload.serviceLng,
        isActive: payload.isActive ?? true,
      }),
    });
  },

  async updateCaregiverService(
    userId: string,
    serviceId: string,
    payload: {
      serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
      petSpecies: 'DOG' | 'CAT' | 'OTHER';
      pricePerUnit: number;
      unitType: string;
      minNoticeHours?: number;
      availableSlots?: unknown;
      serviceCity?: string;
      serviceLat?: number;
      serviceLng?: number;
      isActive?: boolean;
    },
  ) {
    const profile = await petpalService.getOrCreateCaregiverProfile(userId);

    const existing = await prisma.caregiverService.findFirst({
      where: {
        id: serviceId,
        caregiverId: profile.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw notFound('Caregiver service not found');
    }

    return prisma.caregiverService.update({
      where: {
        id: serviceId,
      },
      data: {
        serviceType: payload.serviceType,
        petSpecies: payload.petSpecies,
        pricePerUnit: payload.pricePerUnit,
        unitType: payload.unitType.trim(),
        minNoticeHours: payload.minNoticeHours ?? 2,
        availableSlots: (payload.availableSlots ?? []) as Prisma.InputJsonValue,
        serviceCity: payload.serviceCity?.trim() || null,
        serviceLat: payload.serviceLat,
        serviceLng: payload.serviceLng,
        isActive: payload.isActive ?? true,
      },
    });
  },

  async auditCaregiverProfile(caregiverId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const existing = await prisma.caregiverProfile.findFirst({
      where: {
        id: caregiverId,
        deleteAt: null,
      },
      select: {
        id: true,
        qualificationMaterials: true,
      },
    });

    if (!existing) {
      throw notFound('Caregiver profile not found');
    }

    if (
      status === 'APPROVED' &&
      toQualificationMaterials(existing.qualificationMaterials).length === 0
    ) {
      throw badRequest('Caregiver qualification materials are required before approval');
    }

    const updated = await prisma.caregiverProfile.update({
      where: {
        id: caregiverId,
      },
      data: {
        auditStatus: status,
      },
    });
    return toCaregiverProfileRecord(updated);
  },

  async queryCaregiverAuditList(payload: {
    page: number;
    pageSize: number;
    auditStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    city?: string;
    keyword?: string;
  }) {
    const where: Prisma.CaregiverProfileWhereInput = {
      deleteAt: null,
      auditStatus: payload.auditStatus,
      serviceCity: payload.city?.trim() || undefined,
      OR: payload.keyword?.trim()
        ? [
            {
              user: {
                nickname: {
                  contains: payload.keyword.trim(),
                },
              },
            },
            {
              intro: {
                contains: payload.keyword.trim(),
              },
            },
            {
              serviceCommitment: {
                contains: payload.keyword.trim(),
              },
            },
          ]
        : undefined,
    };

    const [total, rows] = await Promise.all([
      prisma.caregiverProfile.count({ where }),
      prisma.caregiverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
            },
          },
          services: {
            where: {
              deleteAt: null,
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (payload.page - 1) * payload.pageSize,
        take: payload.pageSize,
      }),
    ]);

    return {
      items: rows.map((item) => ({
        id: item.id,
        userId: item.userId,
        nickname: item.user.nickname,
        intro: item.intro,
        experienceYears: item.experienceYears,
        serviceRadiusKm: item.serviceRadiusKm,
        serviceCity: item.serviceCity,
        specialtyTags: toStringArray(item.specialtyTags),
        serviceCommitment: item.serviceCommitment,
        auditStatus: item.auditStatus,
        serviceCount: item.services.length,
        qualificationMaterialCount: toQualificationMaterials(item.qualificationMaterials).length,
        qualificationMaterials: toQualificationMaterials(item.qualificationMaterials),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: {
        page: payload.page,
        pageSize: payload.pageSize,
        total,
        totalPages: Math.ceil(total / payload.pageSize),
      },
    };
  },

  async listCaregiverOrders(payload: {
    userId: string;
    page: number;
    pageSize: number;
    status?:
      | 'PENDING_ACCEPT'
      | 'ACCEPTED'
      | 'SERVING'
      | 'COMPLETED'
      | 'CANCELLED'
      | 'DISPUTED'
      | 'PARTIAL_REFUNDED'
      | 'REFUNDED';
  }) {
    const caregiverProfile = await getApprovedCaregiverProfile(prisma, payload.userId);
    const where: Prisma.OrderMainWhereInput = {
      deleteAt: null,
      caregiverId: caregiverProfile.id,
      orderStatus: payload.status,
    };

    const [total, rows] = await Promise.all([
      prisma.orderMain.count({ where }),
      prisma.orderMain.findMany({
        where,
        include: {
          owner: {
            select: {
              nickname: true,
            },
          },
          serviceRequest: {
            select: {
              locationText: true,
              pet: {
                select: {
                  name: true,
                },
              },
            },
          },
          payments: {
            where: {
              deleteAt: null,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          refunds: {
            where: {
              deleteAt: null,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          conversation: {
            select: orderConversationSummarySelect,
          },
        },
        orderBy: [
          {
            appointmentStart: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip: (payload.page - 1) * payload.pageSize,
        take: payload.pageSize,
      }),
    ]);

    rows.forEach((order) => {
      assertOrderAmountInvariant(order);
    });

    return {
      items: rows.map((order) => ({
        ...toOrderRecord(order),
        ownerNickname: order.owner.nickname,
        petName: order.serviceRequest?.pet?.name ?? null,
        locationText: order.serviceRequest?.locationText ?? null,
      })),
      pagination: {
        page: payload.page,
        pageSize: payload.pageSize,
        total,
        totalPages: Math.ceil(total / payload.pageSize),
      },
    };
  },

  async listPets(ownerId: string) {
    const rows = await prisma.petProfile.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return rows.map(toPetProfileRecord);
  },

  async createPet(
    ownerId: string,
    payload: {
      name: string;
      species: 'DOG' | 'CAT' | 'OTHER';
      breed?: string;
      gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
      birthday?: Date;
      weightKg?: number;
      neutered?: boolean;
      temperamentTags?: string[];
      feedingNote?: string;
      allergyNote?: string;
      medicalNote?: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relation?: string;
      };
    },
  ) {
    const pet = await prisma.petProfile.create({
      data: withSnowflakeId({
        ownerId,
        name: payload.name.trim(),
        species: payload.species,
        breed: payload.breed?.trim() || null,
        gender: payload.gender ?? 'UNKNOWN',
        birthday: payload.birthday ?? null,
        weightKg: payload.weightKg,
        neutered: payload.neutered ?? false,
        temperamentTags: normalizeTagList(payload.temperamentTags, 10),
        feedingNote: payload.feedingNote?.trim() || null,
        allergyNote: payload.allergyNote?.trim() || null,
        medicalNote: payload.medicalNote?.trim() || null,
        emergencyContact: normalizePetEmergencyContact(payload.emergencyContact) ?? Prisma.JsonNull,
      }),
    });
    return toPetProfileRecord(pet);
  },

  async updatePet(
    ownerId: string,
    petId: string,
    payload: {
      name: string;
      species: 'DOG' | 'CAT' | 'OTHER';
      breed?: string;
      gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
      birthday?: Date;
      weightKg?: number;
      neutered?: boolean;
      temperamentTags?: string[];
      feedingNote?: string;
      allergyNote?: string;
      medicalNote?: string;
      emergencyContact?: {
        name: string;
        phone: string;
        relation?: string;
      };
    },
  ) {
    const pet = await prisma.petProfile.findFirst({
      where: {
        id: petId,
        ownerId,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!pet) {
      throw notFound('Pet not found');
    }

    const updated = await prisma.petProfile.update({
      where: {
        id: pet.id,
      },
      data: {
        name: payload.name.trim(),
        species: payload.species,
        breed: payload.breed?.trim() || null,
        gender: payload.gender ?? 'UNKNOWN',
        birthday: payload.birthday ?? null,
        weightKg: payload.weightKg,
        neutered: payload.neutered ?? false,
        temperamentTags: normalizeTagList(payload.temperamentTags, 10),
        feedingNote: payload.feedingNote?.trim() || null,
        allergyNote: payload.allergyNote?.trim() || null,
        medicalNote: payload.medicalNote?.trim() || null,
        emergencyContact: normalizePetEmergencyContact(payload.emergencyContact) ?? Prisma.JsonNull,
      },
    });
    return toPetProfileRecord(updated);
  },

  async listOwnerRequests(ownerId: string) {
    return prisma.serviceRequest.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
          },
        },
        matchedCaregiver: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });
  },

  async createRequest(
    ownerId: string,
    payload: {
      petId: string;
      serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
      startTime: Date;
      endTime: Date;
      locationText: string;
      locationLat?: number;
      locationLng?: number;
      budgetAmount?: number;
      demandTags?: unknown;
    },
  ): Promise<ServiceRequest> {
    const pet = await prisma.petProfile.findFirst({
      where: {
        id: payload.petId,
        ownerId,
      },
      select: { id: true },
    });

    if (!pet) {
      throw notFound('Pet profile not found');
    }

    return prisma.serviceRequest.create({
      data: withSnowflakeId({
        ownerId,
        petId: payload.petId,
        serviceType: payload.serviceType,
        startTime: payload.startTime,
        endTime: payload.endTime,
        locationText: payload.locationText,
        locationLat: payload.locationLat,
        locationLng: payload.locationLng,
        budgetAmount: payload.budgetAmount,
        demandTags: (payload.demandTags ?? []) as Prisma.InputJsonValue,
        status: 'OPEN',
      }),
    });
  },

  async createOwnerOrder(
    ownerId: string,
    payload: {
      requestId: string;
      caregiverServiceId: string;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const requestRecord = await tx.serviceRequest.findFirst({
        where: {
          id: payload.requestId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          petId: true,
          serviceType: true,
          startTime: true,
          endTime: true,
          status: true,
          pet: {
            select: {
              species: true,
            },
          },
        },
      });

      if (!requestRecord) {
        throw notFound('Service request not found');
      }

      if (requestRecord.status === 'CLOSED') {
        throw badRequest('Closed request cannot create order');
      }

      const caregiverService = await tx.caregiverService.findFirst({
        where: {
          id: payload.caregiverServiceId,
          deleteAt: null,
          isActive: true,
        },
        select: {
          id: true,
          caregiverId: true,
          serviceType: true,
          petSpecies: true,
          pricePerUnit: true,
          unitType: true,
          caregiver: {
            select: {
              auditStatus: true,
            },
          },
        },
      });

      if (!caregiverService) {
        throw notFound('Caregiver service not found');
      }

      if (caregiverService.caregiver.auditStatus !== 'APPROVED') {
        throw forbidden('Caregiver profile is not approved');
      }

      if (caregiverService.serviceType !== requestRecord.serviceType) {
        throw badRequest('Caregiver service type does not match request');
      }

      if (caregiverService.petSpecies !== requestRecord.pet.species) {
        throw badRequest('Caregiver service species does not match request pet');
      }

      const existingOrder = await tx.orderMain.findFirst({
        where: {
          serviceRequestId: requestRecord.id,
          deleteAt: null,
          orderStatus: {
            not: 'CANCELLED',
          },
        },
        select: {
          id: true,
          caregiverId: true,
        },
      });

      if (existingOrder) {
        if (existingOrder.caregiverId === caregiverService.caregiverId) {
          return loadOrderDetailById(tx, existingOrder.id);
        }
        throw badRequest('Current request already has an active order');
      }

      const estimatedUnits = estimateServiceUnits({
        serviceType: requestRecord.serviceType,
        unitType: caregiverService.unitType,
        startTime: requestRecord.startTime,
        endTime: requestRecord.endTime,
      });
      const amountTotal = toRoundedAmount(toNumber(caregiverService.pricePerUnit) * estimatedUnits);

      const order = await tx.orderMain.create({
        data: withSnowflakeId({
          orderNo: createPetPalBizNo('PP'),
          ownerId,
          caregiverId: caregiverService.caregiverId,
          serviceRequestId: requestRecord.id,
          serviceType: requestRecord.serviceType,
          appointmentStart: requestRecord.startTime,
          appointmentEnd: requestRecord.endTime,
          amountTotal,
          amountAdjusted: 0,
          amountPaid: 0,
          amountRefunded: 0,
          orderStatus: 'PENDING_ACCEPT',
        }),
        select: {
          id: true,
        },
      });

      await tx.paymentRecord.create({
        data: withSnowflakeId({
          orderId: order.id,
          payNo: createPetPalBizNo('PAY'),
          bizType: 'BALANCE',
          payChannel: 'UNPAID',
          payStatus: 'PENDING',
          payAmount: amountTotal,
        }),
      });

      await tx.serviceRequest.update({
        where: {
          id: requestRecord.id,
        },
        data: {
          status: 'MATCHED',
          matchedCaregiverId: caregiverService.caregiverId,
        },
      });

      await ensureOrderConversation(tx, order.id);
      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'CREATED',
        operatorRole: 'OWNER',
        operatorId: ownerId,
        eventPayload: {
          requestId: requestRecord.id,
          caregiverServiceId: caregiverService.id,
          estimatedUnits,
          unitType: caregiverService.unitType,
          pricePerUnit: toNumber(caregiverService.pricePerUnit),
          amountTotal,
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async listOwnerOrders(ownerId: string) {
    const orders = await prisma.orderMain.findMany({
      where: {
        ownerId,
        deleteAt: null,
      },
      include: orderListInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    orders.forEach((order) => {
      assertOrderAmountInvariant(order);
    });

    return orders.map(toOrderRecord);
  },

  async listOwnerTransactionExportRows(
    filters: OwnerTransactionExportFilters = {},
  ): Promise<OwnerTransactionExportRow[]> {
    const actorId = getRequestActorId();
    if (!actorId) {
      throw forbidden('Authentication required');
    }

    const normalizedFilters = normalizeOwnerTransactionExportFilters(filters);
    const orders = await prisma.orderMain.findMany({
      where: {
        ownerId: actorId,
        deleteAt: null,
        createdAt: {
          gte: normalizedFilters.startDate,
          lte: normalizedFilters.endDate,
        },
        ...(normalizedFilters.serviceType
          ? {
              serviceType: normalizedFilters.serviceType,
            }
          : {}),
        ...(normalizedFilters.orderStatus
          ? {
              orderStatus: normalizedFilters.orderStatus,
            }
          : {}),
        ...(normalizedFilters.orderNoKeyword
          ? {
              orderNo: {
                contains: normalizedFilters.orderNoKeyword,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payments: {
          where: {
            deleteAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            payNo: true,
            payAmount: true,
            payStatus: true,
            paidAt: true,
          },
        },
        refunds: {
          where: {
            deleteAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            refundNo: true,
            refundAmount: true,
            refundStatus: true,
            reviewedAt: true,
          },
        },
        complaints: {
          where: {
            deleteAt: null,
          },
          select: {
            id: true,
          },
        },
        review: {
          select: {
            rating: true,
          },
        },
      },
      take: 5000,
    });

    return orders.map((order) => {
      assertOrderAmountInvariant(order);
      const latestRefund = order.refunds[order.refunds.length - 1] ?? null;
      const amountPaid = toNumber(order.amountPaid);
      const amountRefunded = toNumber(order.amountRefunded);

      return {
        orderNo: order.orderNo,
        orderStatus: order.orderStatus,
        serviceType: order.serviceType,
        appointmentStart: order.appointmentStart,
        appointmentEnd: order.appointmentEnd,
        amountTotal: toNumber(order.amountTotal),
        amountPaid,
        amountRefunded,
        netPaid: Number((amountPaid - amountRefunded).toFixed(2)),
        paymentCount: order.payments.length,
        paymentNos: order.payments.map((item) => item.payNo),
        refundCount: order.refunds.length,
        refundNos: order.refunds.map((item) => item.refundNo),
        latestRefundStatus: latestRefund?.refundStatus ?? null,
        latestRefundReviewedAt: latestRefund?.reviewedAt ?? null,
        complaintCount: order.complaints.length,
        reviewRating: order.review?.rating ?? null,
        createdAt: order.createdAt,
        closedAt: order.closedAt,
      };
    });
  },

  async listOwnerRefundExportRows(
    filters: OwnerRefundExportFilters = {},
  ): Promise<OwnerRefundExportRow[]> {
    const actorId = getRequestActorId();
    if (!actorId) {
      throw forbidden('Authentication required');
    }

    const { startDate, endDate } = normalizeOwnerTransactionExportRange(filters);
    const refunds = await prisma.refundRecord.findMany({
      where: {
        deleteAt: null,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(filters.refundType
          ? {
              refundType: filters.refundType,
            }
          : {}),
        ...(filters.refundStatus
          ? {
              refundStatus: filters.refundStatus,
            }
          : {}),
        order: {
          ownerId: actorId,
          deleteAt: null,
          ...(filters.complaintStatus || filters.complaintType || filters.complaintTargetRole
            ? {
                complaints: {
                  some: {
                    deleteAt: null,
                    ...(filters.complaintStatus
                      ? {
                          status: filters.complaintStatus,
                        }
                      : {}),
                    ...(filters.complaintType
                      ? {
                          complaintType: filters.complaintType,
                        }
                      : {}),
                    ...(filters.complaintTargetRole
                      ? {
                          targetRole: filters.complaintTargetRole,
                        }
                      : {}),
                  },
                },
              }
            : {}),
          ...(filters.serviceType
            ? {
                serviceType: filters.serviceType,
              }
            : {}),
          ...(filters.orderNoKeyword
            ? {
                orderNo: {
                  contains: filters.orderNoKeyword,
                  mode: 'insensitive' as const,
                },
              }
            : {}),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        refundNo: true,
        refundType: true,
        refundStatus: true,
        refundAmount: true,
        refundReason: true,
        applyUserId: true,
        reviewedBy: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            orderNo: true,
            orderStatus: true,
            serviceType: true,
            appointmentStart: true,
            appointmentEnd: true,
            amountTotal: true,
            amountAdjusted: true,
            amountPaid: true,
            amountRefunded: true,
          },
        },
      },
      take: 5000,
    });

    refunds.forEach((refund) => {
      assertOrderAmountInvariant({
        amountTotal: refund.order.amountTotal,
        amountAdjusted: refund.order.amountAdjusted,
        amountPaid: refund.order.amountPaid,
        amountRefunded: refund.order.amountRefunded,
      });
    });

    return refunds.map((refund) => ({
      orderNo: refund.order.orderNo,
      orderStatus: refund.order.orderStatus,
      serviceType: refund.order.serviceType,
      appointmentStart: refund.order.appointmentStart,
      appointmentEnd: refund.order.appointmentEnd,
      refundNo: refund.refundNo,
      refundType: refund.refundType,
      refundStatus: refund.refundStatus,
      refundAmount: Number(refund.refundAmount),
      refundReason: refund.refundReason,
      applyUserId: refund.applyUserId,
      reviewedBy: refund.reviewedBy,
      reviewedAt: refund.reviewedAt,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    }));
  },

  async listOwnerOrderRefundExportRows(
    ownerId: string,
    orderId: string,
  ): Promise<OwnerOrderRefundExportRow[]> {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        ownerId,
        deleteAt: null,
      },
      select: {
        orderNo: true,
        refunds: {
          where: {
            deleteAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            refundNo: true,
            refundType: true,
            refundStatus: true,
            refundAmount: true,
            refundReason: true,
            applyUserId: true,
            reviewedBy: true,
            reviewedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!order) {
      throw notFound('Order not found');
    }

    return order.refunds.map((refund) => ({
      orderNo: order.orderNo,
      refundNo: refund.refundNo,
      refundType: refund.refundType,
      refundStatus: refund.refundStatus,
      refundAmount: Number(refund.refundAmount),
      refundReason: refund.refundReason,
      applyUserId: refund.applyUserId,
      reviewedBy: refund.reviewedBy,
      reviewedAt: refund.reviewedAt,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    }));
  },

  async getOwnerOrderDetail(ownerId: string, orderId: string): Promise<OrderDetailRecord> {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        deleteAt: null,
        OR: [
          {
            ownerId,
          },
          {
            caregiver: {
              userId: ownerId,
              deleteAt: null,
            },
          },
        ],
      },
      include: orderDetailInclude,
    });

    if (!order) {
      throw notFound('Order not found');
    }

    assertOrderAmountInvariant(order);
    return toOrderDetailRecord(order);
  },

  async payOwnerOrder(
    ownerId: string,
    orderId: string,
    payload: {
      payChannel: 'WECHAT_PAY' | 'ALIPAY' | 'BALANCE';
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        include: {
          payments: {
            where: {
              deleteAt: null,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'PENDING_ACCEPT') {
        throw badRequest('Only pending orders can be paid');
      }

      const grossAmount = toRoundedAmount(
        toNumber(order.amountTotal) + toNumber(order.amountAdjusted),
      );
      const outstandingAmount = toRoundedAmount(
        Math.max(0, grossAmount - toNumber(order.amountPaid)),
      );

      if (outstandingAmount <= 0) {
        return loadOrderDetailById(tx, order.id);
      }

      const reusablePayment =
        order.payments.find((item) => item.payStatus === 'PENDING') ??
        order.payments.find((item) => item.payStatus === 'FAILED' || item.payStatus === 'CLOSED');

      const paymentId = reusablePayment
        ? reusablePayment.id
        : (
            await tx.paymentRecord.create({
              data: withSnowflakeId({
                orderId: order.id,
                payNo: createPetPalBizNo('PAY'),
                bizType: 'BALANCE',
                payChannel: payload.payChannel,
                payStatus: 'PENDING',
                payAmount: outstandingAmount,
              }),
              select: {
                id: true,
              },
            })
          ).id;

      await tx.paymentRecord.update({
        where: {
          id: paymentId,
        },
        data: {
          payChannel: payload.payChannel,
          payStatus: 'PAID',
          payAmount: outstandingAmount,
          channelTxnId: createPetPalBizNo('TXN'),
          paidAt: new Date(),
          channelPayload: {
            source: 'OWNER_CHECKOUT',
            payChannel: payload.payChannel,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          amountPaid: toRoundedAmount(toNumber(order.amountPaid) + outstandingAmount),
        },
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async listOrderMessages(userId: string, orderId: string) {
    await loadOrderConversationParticipant(prisma, userId, orderId);
    await ensureOrderConversation(prisma, orderId);
    return loadOrderConversationDetail(prisma, orderId);
  },

  async createOrderMessage(
    userId: string,
    orderId: string,
    payload: {
      content?: string;
      mediaUrls?: string[];
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const participant = await loadOrderConversationParticipant(tx, userId, orderId);
      const content = normalizeMessageContent(payload.content);
      const mediaUrls = normalizeMessageMediaUrls(payload.mediaUrls);

      if (!content && mediaUrls.length === 0) {
        throw badRequest('Message content or media is required');
      }

      const conversation = await ensureOrderConversation(tx, orderId);
      const now = new Date();

      await tx.orderMessage.create({
        data: withSnowflakeId({
          conversationId: conversation.id,
          senderRole: participant.actorRole,
          senderUserId: userId,
          content,
          mediaUrls: mediaUrls as Prisma.InputJsonValue,
        }),
      });

      await tx.orderConversation.update({
        where: {
          id: conversation.id,
        },
        data:
          participant.actorRole === 'OWNER'
            ? {
                updateId: userId,
                ownerUnreadCount: 0,
                caregiverUnreadCount: {
                  increment: 1,
                },
                lastMessageAt: now,
                lastMessagePreview: buildMessagePreview(content, mediaUrls),
              }
            : {
                updateId: userId,
                ownerUnreadCount: {
                  increment: 1,
                },
                caregiverUnreadCount: 0,
                lastMessageAt: now,
                lastMessagePreview: buildMessagePreview(content, mediaUrls),
              },
      });

      return loadOrderConversationDetail(tx, orderId);
    });
  },

  async markOrderMessagesRead(userId: string, orderId: string) {
    return runSerializableTransaction(async (tx) => {
      const participant = await loadOrderConversationParticipant(tx, userId, orderId);
      const conversation = await ensureOrderConversation(tx, orderId);

      await tx.orderConversation.update({
        where: {
          id: conversation.id,
        },
        data:
          participant.actorRole === 'OWNER'
            ? {
                updateId: userId,
                ownerUnreadCount: 0,
              }
            : {
                updateId: userId,
                caregiverUnreadCount: 0,
              },
      });

      const updated = await tx.orderConversation.findUnique({
        where: {
          id: conversation.id,
        },
        select: orderConversationSummarySelect,
      });

      if (!updated) {
        throw notFound('Order conversation not found');
      }

      return toOrderConversationRecord(updated)!;
    });
  },

  async getOwnerOrderRefundProgress(
    ownerId: string,
    orderId: string,
  ): Promise<OwnerRefundProgressRecord> {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        ownerId,
        deleteAt: null,
      },
      select: {
        id: true,
        amountPaid: true,
        amountRefunded: true,
        orderStatus: true,
        refunds: {
          where: {
            deleteAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            refundNo: true,
            refundAmount: true,
            refundStatus: true,
            refundReason: true,
            createdAt: true,
            reviewedAt: true,
          },
        },
      },
    });

    if (!order) {
      throw notFound('Order not found');
    }

    return buildOwnerRefundProgress(order);
  },

  async acceptCaregiverOrder(userId: string, orderId: string) {
    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'PENDING_ACCEPT') {
        throw badRequest('Only pending orders can be accepted');
      }

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: 'ACCEPTED',
        },
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'ACCEPTED',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'ACCEPTED',
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async checkInCaregiverOrder(
    userId: string,
    orderId: string,
    payload?: {
      note?: string;
      geo?: Record<string, unknown>;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'ACCEPTED') {
        throw badRequest('Only accepted orders can be checked in');
      }

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: 'SERVING',
        },
      });

      const happenedAt = new Date();
      await appendServiceLog(tx, {
        orderId: order.id,
        caregiverId: order.caregiverId,
        logType: 'CHECK_IN',
        textNote: payload?.note,
        geo: payload?.geo ?? null,
        happenedAt,
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'CHECKED_IN',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'SERVING',
          note: payload?.note ?? null,
          geo: payload?.geo ?? null,
          happenedAt: happenedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async addCaregiverServiceLog(
    userId: string,
    orderId: string,
    payload: {
      logType: 'CHECK_IN' | 'FEED' | 'WALK' | 'PLAY' | 'HEALTH' | 'CHECK_OUT' | 'NOTE';
      textNote?: string;
      mediaUrls?: string[];
      geo?: Record<string, unknown>;
      happenedAt?: Date;
    },
  ) {
    if (!payload.textNote?.trim() && !payload.mediaUrls?.length) {
      throw badRequest('Service log requires text note or media');
    }

    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'SERVING') {
        throw badRequest('Only serving orders can add service logs');
      }

      const happenedAt = payload.happenedAt ?? new Date();
      await appendServiceLog(tx, {
        orderId: order.id,
        caregiverId: order.caregiverId,
        logType: payload.logType,
        textNote: payload.textNote,
        mediaUrls: payload.mediaUrls,
        geo: payload.geo ?? null,
        happenedAt,
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'SERVICE_LOGGED',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          logType: payload.logType,
          note: payload.textNote?.trim() || null,
          mediaCount: payload.mediaUrls?.length ?? 0,
          geo: payload.geo ?? null,
          happenedAt: happenedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async checkOutCaregiverOrder(
    userId: string,
    orderId: string,
    payload?: {
      note?: string;
      geo?: Record<string, unknown>;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'SERVING') {
        throw badRequest('Only serving orders can be checked out');
      }

      const happenedAt = new Date();
      await appendServiceLog(tx, {
        orderId: order.id,
        caregiverId: order.caregiverId,
        logType: 'CHECK_OUT',
        textNote: payload?.note,
        geo: payload?.geo ?? null,
        happenedAt,
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'CHECKED_OUT',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          note: payload?.note ?? null,
          geo: payload?.geo ?? null,
          happenedAt: happenedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async confirmOwnerOrderComplete(ownerId: string, orderId: string) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          serviceRequestId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'SERVING') {
        throw badRequest('Only serving orders can be completed by owner');
      }

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: 'COMPLETED',
          closedAt: new Date(),
        },
      });

      if (order.serviceRequestId) {
        await tx.serviceRequest.update({
          where: {
            id: order.serviceRequestId,
          },
          data: {
            status: 'CLOSED',
          },
        });
      }

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'COMPLETED',
        operatorRole: 'OWNER',
        operatorId: ownerId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'COMPLETED',
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async createOwnerOrderReview(
    ownerId: string,
    orderId: string,
    payload: {
      rating: number;
      tags?: string[];
      content?: string;
      isAnonymous?: boolean;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
          review: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'COMPLETED') {
        throw badRequest('Only completed orders can be reviewed');
      }

      if (order.review) {
        throw badRequest('Order review already exists');
      }

      const caregiverProfile = await tx.caregiverProfile.findFirst({
        where: {
          id: order.caregiverId,
          deleteAt: null,
        },
        select: {
          id: true,
          ratingAvg: true,
          ratingCount: true,
        },
      });

      if (!caregiverProfile) {
        throw notFound('Caregiver profile not found');
      }

      const tags = normalizeReviewTags(payload.tags);
      await tx.review.create({
        data: withSnowflakeId({
          orderId: order.id,
          ownerId,
          caregiverId: caregiverProfile.id,
          rating: payload.rating,
          tags: tags as Prisma.InputJsonValue,
          content: payload.content?.trim() || null,
          isAnonymous: payload.isAnonymous ?? false,
        }),
      });

      const currentRatingAvg = toNumber(caregiverProfile.ratingAvg);
      const nextRatingCount = caregiverProfile.ratingCount + 1;
      const nextRatingAvg =
        (currentRatingAvg * caregiverProfile.ratingCount + payload.rating) / nextRatingCount;

      await tx.caregiverProfile.update({
        where: {
          id: caregiverProfile.id,
        },
        data: {
          ratingAvg: new Prisma.Decimal(nextRatingAvg.toFixed(2)),
          ratingCount: nextRatingCount,
        },
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async listOwnerOrderComplaints(ownerId: string, orderId: string) {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        ownerId,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!order) {
      throw notFound('Order not found');
    }

    const complaints = await loadOrderComplaintsByOrderId(prisma, order.id);
    return complaints.map(toComplaintRecord);
  },

  async createOwnerOrderComplaint(
    ownerId: string,
    orderId: string,
    payload: {
      targetRole: 'CAREGIVER' | 'PLATFORM';
      complaintType: 'SAFETY' | 'FEE' | 'SERVICE' | 'FRAUD' | 'OTHER';
      description: string;
      evidenceUrls?: string[];
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (
        !['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(
          order.orderStatus,
        )
      ) {
        throw badRequest('Only serving or settled orders can create complaints');
      }

      const activeComplaint = await tx.complaint.findFirst({
        where: {
          orderId: order.id,
          deleteAt: null,
          status: {
            in: ['OPEN', 'PROCESSING'],
          },
        },
        select: {
          id: true,
        },
      });

      if (activeComplaint) {
        throw badRequest('Active complaint already exists for order');
      }

      const complaint = await tx.complaint.create({
        data: withSnowflakeId({
          orderId: order.id,
          complainantId: ownerId,
          targetRole: payload.targetRole,
          complaintType: payload.complaintType,
          description: payload.description.trim(),
          evidenceUrls: normalizeEvidenceUrls(payload.evidenceUrls) as Prisma.InputJsonValue,
          status: 'OPEN',
        }),
      });

      await appendComplaintProcessLog(tx, {
        complaintId: complaint.id,
        actionType: 'OPEN',
        operatorId: ownerId,
        note: '投诉已提交，等待平台处理',
      });

      if (order.orderStatus !== 'DISPUTED') {
        await tx.orderMain.update({
          where: {
            id: order.id,
          },
          data: {
            orderStatus: 'DISPUTED',
          },
        });
      }

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'DISPUTED',
        operatorRole: 'OWNER',
        operatorId: ownerId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'DISPUTED',
          complaintId: complaint.id,
          complaintType: payload.complaintType,
          targetRole: payload.targetRole,
        } as Prisma.InputJsonValue,
      });

      const created = await tx.complaint.findUnique({
        where: {
          id: complaint.id,
        },
        include: complaintInclude,
      });

      if (!created) {
        throw notFound('Complaint not found');
      }

      return toComplaintRecord(created);
    });
  },

  async queryAdminComplaints(filters: ComplaintAdminFilters) {
    const where = buildComplaintAdminWhere(filters);
    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where }),
      prisma.complaint.findMany({
        where,
        include: complaintAdminInclude,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
    ]);

    return {
      items: complaints.map(toComplaintAdminRecord),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  },

  async queryAdminComplaintStats(filters: ComplaintAdminScopeFilters, actorId: string) {
    const baseFilters = toComplaintAdminStatsBaseFilters(filters);
    const baseWhere = buildComplaintAdminWhere(baseFilters);
    const [
      total,
      statusRows,
      dueSoonCount,
      overdueCount,
      unassignedCount,
      assignedToMeCount,
      processingAssignedToMeCount,
    ] = await Promise.all([
      prisma.complaint.count({ where: baseWhere }),
      prisma.complaint.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: {
          _all: true,
        },
      }),
      prisma.complaint.count({
        where: buildComplaintAdminWhere({
          ...baseFilters,
          slaStatus: 'DUE_SOON',
        }),
      }),
      prisma.complaint.count({
        where: buildComplaintAdminWhere({
          ...baseFilters,
          slaStatus: 'OVERDUE',
        }),
      }),
      prisma.complaint.count({
        where: {
          AND: [
            baseWhere,
            {
              assignedAdminId: null,
            },
          ],
        },
      }),
      prisma.complaint.count({
        where: {
          AND: [
            baseWhere,
            {
              assignedAdminId: actorId,
            },
          ],
        },
      }),
      prisma.complaint.count({
        where: {
          AND: [
            baseWhere,
            {
              assignedAdminId: actorId,
              status: 'PROCESSING',
            },
          ],
        },
      }),
    ]);

    const byStatus = statusRows.reduce<ComplaintStatusCounter>(
      (accumulator, row) => {
        accumulator[row.status] = row._count._all;
        return accumulator;
      },
      {
        OPEN: 0,
        PROCESSING: 0,
        RESOLVED: 0,
        REJECTED: 0,
      },
    );

    return {
      total,
      byStatus,
      dueSoonCount,
      overdueCount,
      unassignedCount,
      assignedToMeCount,
      processingAssignedToMeCount,
      slaLimitHours: env.PETPAL_COMPLAINT_SLA_LIMIT_HOURS,
      slaWarningHours: env.PETPAL_COMPLAINT_SLA_WARNING_HOURS,
    };
  },

  async batchAssignAdminComplaints(
    actorId: string,
    payload: {
      complaintIds: string[];
      assigneeId: string;
      note?: string;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const complaintIds = [
        ...new Set(payload.complaintIds.map((item) => item.trim()).filter(Boolean)),
      ];

      if (complaintIds.length === 0) {
        throw badRequest('Complaint ids are required');
      }

      const assignee = await loadComplaintAdminAssignee(tx, payload.assigneeId);
      if (!assignee) {
        throw badRequest('Complaint assignee must be an active admin user');
      }

      const complaints = await tx.complaint.findMany({
        where: {
          id: {
            in: complaintIds,
          },
          deleteAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (complaints.length !== complaintIds.length) {
        throw notFound('Complaint not found');
      }

      complaints.forEach(assertComplaintUpdatable);

      for (const complaintId of complaintIds) {
        const complaint = complaints.find((item) => item.id === complaintId)!;
        await assignComplaintInTransaction(tx, {
          complaintId,
          actorId,
          currentStatus: complaint.status,
          assignee,
          note: payload.note,
        });
      }

      const updatedComplaints = await tx.complaint.findMany({
        where: {
          id: {
            in: complaintIds,
          },
          deleteAt: null,
        },
        include: complaintAdminInclude,
      });

      const complaintMap = new Map(updatedComplaints.map((item) => [item.id, item]));

      return {
        requestedCount: complaintIds.length,
        updatedCount: updatedComplaints.length,
        items: complaintIds
          .map((id) => complaintMap.get(id))
          .filter((item): item is ComplaintAdminEntity => Boolean(item))
          .map(toComplaintAdminRecord),
      };
    });
  },

  async batchCloseAdminComplaints(
    actorId: string,
    payload: {
      complaintIds: string[];
      resultStatus: 'RESOLVED' | 'REJECTED';
      resultSummary: string;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const complaintIds = [
        ...new Set(payload.complaintIds.map((item) => item.trim()).filter(Boolean)),
      ];

      if (complaintIds.length === 0) {
        throw badRequest('Complaint ids are required');
      }

      const resultSummary = payload.resultSummary.trim();
      if (!resultSummary) {
        throw badRequest('Complaint result summary is required');
      }

      const complaints = await tx.complaint.findMany({
        where: {
          id: {
            in: complaintIds,
          },
          deleteAt: null,
        },
        select: {
          id: true,
          status: true,
          assignedAdminId: true,
        },
      });

      if (complaints.length !== complaintIds.length) {
        throw notFound('Complaint not found');
      }

      complaints.forEach(assertComplaintUpdatable);

      for (const complaintId of complaintIds) {
        const complaint = complaints.find((item) => item.id === complaintId)!;
        await closeComplaintInTransaction(tx, {
          complaintId,
          actorId,
          assignedAdminId: complaint.assignedAdminId,
          resultStatus: payload.resultStatus,
          resultSummary,
        });
      }

      const updatedComplaints = await tx.complaint.findMany({
        where: {
          id: {
            in: complaintIds,
          },
          deleteAt: null,
        },
        include: complaintAdminInclude,
      });

      const complaintMap = new Map(updatedComplaints.map((item) => [item.id, item]));

      return {
        requestedCount: complaintIds.length,
        updatedCount: updatedComplaints.length,
        items: complaintIds
          .map((id) => complaintMap.get(id))
          .filter((item): item is ComplaintAdminEntity => Boolean(item))
          .map(toComplaintAdminRecord),
      };
    });
  },

  async handleAdminComplaint(
    complaintId: string,
    actorId: string,
    payload: {
      actionType: 'ASSIGN' | 'INVESTIGATE' | 'CALL_USER' | 'PENALTY' | 'CLOSE';
      assigneeId?: string;
      note?: string;
      resultStatus?: 'RESOLVED' | 'REJECTED';
      resultSummary?: string;
    },
  ) {
    return runSerializableTransaction(async (tx) => {
      const complaint = await tx.complaint.findFirst({
        where: {
          id: complaintId,
          deleteAt: null,
        },
        select: {
          id: true,
          status: true,
          assignedAdminId: true,
        },
      });

      assertComplaintUpdatable(complaint);

      if (payload.actionType === 'ASSIGN') {
        if (!payload.assigneeId?.trim()) {
          throw badRequest('Complaint assignee is required');
        }

        const assignee = await loadComplaintAdminAssignee(tx, payload.assigneeId);
        if (!assignee) {
          throw badRequest('Complaint assignee must be an active admin user');
        }

        await assignComplaintInTransaction(tx, {
          complaintId: complaint.id,
          actorId,
          currentStatus: complaint.status,
          assignee,
          note: payload.note,
        });
      } else if (payload.actionType === 'CLOSE') {
        const resultStatus = payload.resultStatus;
        const resultSummary = payload.resultSummary?.trim();

        if (!resultStatus) {
          throw badRequest('Complaint close result is required');
        }

        if (!resultSummary) {
          throw badRequest('Complaint result summary is required');
        }

        await closeComplaintInTransaction(tx, {
          complaintId: complaint.id,
          actorId,
          assignedAdminId: complaint.assignedAdminId,
          resultStatus,
          resultSummary,
        });
      } else {
        const note = payload.note?.trim();
        if (!note) {
          throw badRequest('Complaint handling note is required');
        }

        await tx.complaint.update({
          where: {
            id: complaint.id,
          },
          data: {
            status: 'PROCESSING',
            assignedAdminId: complaint.assignedAdminId ?? actorId,
          },
        });

        await appendComplaintProcessLog(tx, {
          complaintId: complaint.id,
          actionType: payload.actionType,
          operatorId: actorId,
          note,
        });
      }

      const updated = await loadAdminComplaintById(tx, complaint.id);
      if (!updated) {
        throw notFound('Complaint not found');
      }

      return toComplaintAdminRecord(updated);
    });
  },

  async listMatchedCaregivers(payload: {
    serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
    petSpecies: 'DOG' | 'CAT' | 'OTHER';
    city?: string;
    lat?: number;
    lng?: number;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.CaregiverServiceWhereInput = {
      isActive: true,
      serviceType: payload.serviceType,
      petSpecies: payload.petSpecies,
      caregiver: {
        auditStatus: 'APPROVED',
        deleteAt: null,
      },
    };

    if (payload.city) {
      where.serviceCity = payload.city;
    }

    const services = await prisma.caregiverService.findMany({
      where,
      include: {
        caregiver: {
          select: {
            id: true,
            intro: true,
            experienceYears: true,
            serviceRadiusKm: true,
            specialtyTags: true,
            serviceCommitment: true,
            ratingAvg: true,
            ratingCount: true,
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    const rows = services.map((service) => {
      const serviceLat = service.serviceLat == null ? null : Number(service.serviceLat);
      const serviceLng = service.serviceLng == null ? null : Number(service.serviceLng);
      const distanceKm =
        payload.lat != null && payload.lng != null && serviceLat != null && serviceLng != null
          ? calcDistanceKm(payload.lat, payload.lng, serviceLat, serviceLng)
          : null;

      return {
        serviceId: service.id,
        caregiverId: service.caregiver.id,
        caregiverName: service.caregiver.user.nickname,
        serviceType: service.serviceType,
        petSpecies: service.petSpecies,
        pricePerUnit: service.pricePerUnit,
        unitType: service.unitType,
        city: service.serviceCity,
        distanceKm,
        ratingAvg: service.caregiver.ratingAvg,
        ratingCount: service.caregiver.ratingCount,
        intro: service.caregiver.intro,
        experienceYears: service.caregiver.experienceYears ?? 0,
        serviceRadiusKm: service.caregiver.serviceRadiusKm ?? 0,
        specialtyTags: toStringArray(service.caregiver.specialtyTags),
        serviceCommitment: service.caregiver.serviceCommitment,
        minNoticeHours: service.minNoticeHours ?? 0,
      };
    });

    rows.sort((left, right) => {
      const lDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
      const rDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
      if (lDistance !== rDistance) {
        return lDistance - rDistance;
      }
      return Number(right.ratingAvg) - Number(left.ratingAvg);
    });

    const total = rows.length;
    const skip = (payload.page - 1) * payload.pageSize;
    const items = rows.slice(skip, skip + payload.pageSize);

    return {
      items,
      meta: {
        page: payload.page,
        pageSize: payload.pageSize,
        total,
      },
    };
  },

  async handlePaymentCallback(payload: {
    payNo: string;
    channelTxnId: string;
    success: boolean;
    paidAmount?: number;
    channelPayload?: unknown;
    // Audit info (optional)
    auditInfo?: {
      requestId: string;
      sourceMode: string;
      signatureDigest: string | null;
      callbackTimestamp: string | null;
      rawPayload?: string;
    };
  }) {
    return runSerializableTransaction(async (tx) => {
      const payment = await tx.paymentRecord.findUnique({
        where: {
          payNo: payload.payNo,
        },
        select: {
          id: true,
          orderId: true,
          payStatus: true,
          channelTxnId: true,
          payAmount: true,
        },
      });

      if (!payment) {
        throw notFound('Payment not found');
      }

      if (payment.payStatus === 'PAID') {
        const idempotent = payment.channelTxnId === payload.channelTxnId;

        // Create audit record for retry/idempotent callback if auditInfo is provided
        if (payload.auditInfo) {
          const callbackAudit = await tx.callbackAudit.create({
            data: withSnowflakeId({
              callbackType: 'PAYMENT_CALLBACK',
              paymentId: payment.id,
              requestId: payload.auditInfo.requestId,
              sourceMode: payload.auditInfo.sourceMode,
              signatureDigest: payload.auditInfo.signatureDigest,
              callbackTimestamp: payload.auditInfo.callbackTimestamp,
              callbackStatus: idempotent ? 'SUCCESS' : 'FAILURE',
              rawPayload: payload.auditInfo.rawPayload,
              verificationResult: JSON.stringify({
                idempotent,
                alreadyProcessed: true,
                channelTxnId: payload.channelTxnId,
              }),
              processedAt: new Date(),
            }),
          });

          if (!idempotent) {
            await enqueueCallbackFailureAlert(tx, {
              callbackAuditId: callbackAudit.id,
              callbackStatus: 'FAILURE',
              callbackType: 'PAYMENT_CALLBACK',
              requestId: payload.auditInfo.requestId,
              reason: 'Duplicate payment callback with mismatched channel transaction id',
            });
          }
        }

        return {
          idempotent,
          paymentId: payment.id,
          orderId: payment.orderId,
          payStatus: payment.payStatus,
        };
      }

      const nextStatus = payload.success ? 'PAID' : 'FAILED';
      const nextPaidAmount =
        payload.success && payload.paidAmount != null
          ? payload.paidAmount
          : toNumber(payment.payAmount);

      await tx.paymentRecord.update({
        where: {
          id: payment.id,
        },
        data: {
          payStatus: nextStatus,
          payAmount: nextPaidAmount,
          channelTxnId: payload.channelTxnId,
          paidAt: payload.success ? new Date() : null,
          channelPayload: (payload.channelPayload ?? null) as Prisma.InputJsonValue,
        },
      });

      // Create audit record if auditInfo is provided
      if (payload.auditInfo) {
        const callbackAudit = await tx.callbackAudit.create({
          data: withSnowflakeId({
            callbackType: 'PAYMENT_CALLBACK',
            paymentId: payment.id,
            requestId: payload.auditInfo.requestId,
            sourceMode: payload.auditInfo.sourceMode,
            signatureDigest: payload.auditInfo.signatureDigest,
            callbackTimestamp: payload.auditInfo.callbackTimestamp,
            callbackStatus: nextStatus === 'PAID' ? 'SUCCESS' : 'FAILURE',
            rawPayload: payload.auditInfo.rawPayload,
            verificationResult: JSON.stringify({
              success: payload.success,
              channelTxnId: payload.channelTxnId,
            }),
            processedAt: new Date(),
          }),
        });

        if (nextStatus === 'FAILED') {
          await enqueueCallbackFailureAlert(tx, {
            callbackAuditId: callbackAudit.id,
            callbackStatus: 'FAILURE',
            callbackType: 'PAYMENT_CALLBACK',
            requestId: payload.auditInfo.requestId,
            reason: 'Payment callback marked as FAILED',
          });
        }
      }

      const [paidRows, refundedRows, order] = await Promise.all([
        tx.paymentRecord.findMany({
          where: {
            orderId: payment.orderId,
            payStatus: 'PAID',
            deleteAt: null,
          },
          select: {
            payAmount: true,
          },
        }),
        tx.refundRecord.findMany({
          where: {
            orderId: payment.orderId,
            refundStatus: 'SUCCESS',
            deleteAt: null,
          },
          select: {
            refundAmount: true,
          },
        }),
        tx.orderMain.findUnique({
          where: {
            id: payment.orderId,
          },
          select: {
            id: true,
            amountTotal: true,
            amountAdjusted: true,
            amountRefunded: true,
            orderStatus: true,
          },
        }),
      ]);

      if (!order) {
        throw notFound('Order not found');
      }

      const amountPaid = paidRows.reduce((sum, row) => sum + toNumber(row.payAmount), 0);
      const amountRefunded = refundedRows.reduce((sum, row) => sum + toNumber(row.refundAmount), 0);
      const required =
        toNumber(order.amountTotal) + toNumber(order.amountAdjusted) - amountRefunded;

      const nextOrderStatus =
        amountRefunded > 0
          ? amountRefunded >= toNumber(order.amountTotal) + toNumber(order.amountAdjusted)
            ? 'REFUNDED'
            : 'PARTIAL_REFUNDED'
          : amountPaid >= required
            ? 'ACCEPTED'
            : order.orderStatus;

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          amountPaid,
          amountRefunded,
          orderStatus: nextOrderStatus,
        },
      });

      return {
        idempotent: false,
        paymentId: payment.id,
        orderId: payment.orderId,
        payStatus: nextStatus,
        orderStatus: nextOrderStatus,
      };
    });
  },

  async handleRefundCallback(payload: {
    refundNo: string;
    channelRefundId: string;
    success: boolean;
    channelPayload?: unknown;
    // Audit info (optional)
    auditInfo?: {
      requestId: string;
      sourceMode: string;
      signatureDigest: string | null;
      callbackTimestamp: string | null;
      rawPayload?: string;
    };
  }) {
    return runSerializableTransaction(async (tx) => {
      const refund = await tx.refundRecord.findUnique({
        where: {
          refundNo: payload.refundNo,
        },
        select: {
          id: true,
          orderId: true,
          refundStatus: true,
          channelRefundId: true,
        },
      });

      if (!refund) {
        throw notFound('Refund not found');
      }

      if (refund.refundStatus === 'SUCCESS') {
        const idempotent = refund.channelRefundId === payload.channelRefundId;

        // Create audit record for retry/idempotent callback if auditInfo is provided
        if (payload.auditInfo) {
          const callbackAudit = await tx.callbackAudit.create({
            data: withSnowflakeId({
              callbackType: 'REFUND_CALLBACK',
              refundId: refund.id,
              requestId: payload.auditInfo.requestId,
              sourceMode: payload.auditInfo.sourceMode,
              signatureDigest: payload.auditInfo.signatureDigest,
              callbackTimestamp: payload.auditInfo.callbackTimestamp,
              callbackStatus: idempotent ? 'SUCCESS' : 'FAILURE',
              rawPayload: payload.auditInfo.rawPayload,
              verificationResult: JSON.stringify({
                idempotent,
                alreadyProcessed: true,
                channelRefundId: payload.channelRefundId,
              }),
              processedAt: new Date(),
            }),
          });

          if (!idempotent) {
            await enqueueCallbackFailureAlert(tx, {
              callbackAuditId: callbackAudit.id,
              callbackStatus: 'FAILURE',
              callbackType: 'REFUND_CALLBACK',
              requestId: payload.auditInfo.requestId,
              reason: 'Duplicate refund callback with mismatched channel refund id',
            });
          }
        }

        return {
          idempotent,
          refundId: refund.id,
          orderId: refund.orderId,
          refundStatus: refund.refundStatus,
        };
      }

      const nextStatus = payload.success ? 'SUCCESS' : 'FAILED';
      await tx.refundRecord.update({
        where: {
          id: refund.id,
        },
        data: {
          refundStatus: nextStatus,
          channelRefundId: payload.channelRefundId,
          reviewedAt: payload.success ? new Date() : null,
        },
      });

      // Create audit record if auditInfo is provided
      if (payload.auditInfo) {
        const callbackAudit = await tx.callbackAudit.create({
          data: withSnowflakeId({
            callbackType: 'REFUND_CALLBACK',
            refundId: refund.id,
            requestId: payload.auditInfo.requestId,
            sourceMode: payload.auditInfo.sourceMode,
            signatureDigest: payload.auditInfo.signatureDigest,
            callbackTimestamp: payload.auditInfo.callbackTimestamp,
            callbackStatus: nextStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
            rawPayload: payload.auditInfo.rawPayload,
            verificationResult: JSON.stringify({
              success: payload.success,
              channelRefundId: payload.channelRefundId,
            }),
            processedAt: new Date(),
          }),
        });

        if (nextStatus === 'FAILED') {
          await enqueueCallbackFailureAlert(tx, {
            callbackAuditId: callbackAudit.id,
            callbackStatus: 'FAILURE',
            callbackType: 'REFUND_CALLBACK',
            requestId: payload.auditInfo.requestId,
            reason: 'Refund callback marked as FAILED',
          });
        }
      }

      const [paidRows, refundedRows, order] = await Promise.all([
        tx.paymentRecord.findMany({
          where: {
            orderId: refund.orderId,
            payStatus: 'PAID',
            deleteAt: null,
          },
          select: {
            payAmount: true,
          },
        }),
        tx.refundRecord.findMany({
          where: {
            orderId: refund.orderId,
            refundStatus: 'SUCCESS',
            deleteAt: null,
          },
          select: {
            refundAmount: true,
          },
        }),
        tx.orderMain.findUnique({
          where: {
            id: refund.orderId,
          },
          select: {
            id: true,
            amountTotal: true,
            amountAdjusted: true,
            orderStatus: true,
          },
        }),
      ]);

      if (!order) {
        throw notFound('Order not found');
      }

      const amountPaid = paidRows.reduce((sum, row) => sum + toNumber(row.payAmount), 0);
      const amountRefunded = refundedRows.reduce((sum, row) => sum + toNumber(row.refundAmount), 0);
      const gross = toNumber(order.amountTotal) + toNumber(order.amountAdjusted);

      const nextOrderStatus =
        amountRefunded > 0
          ? amountRefunded >= gross
            ? 'REFUNDED'
            : 'PARTIAL_REFUNDED'
          : order.orderStatus;

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          amountPaid,
          amountRefunded,
          orderStatus: nextOrderStatus,
        },
      });

      return {
        idempotent: false,
        refundId: refund.id,
        orderId: refund.orderId,
        refundStatus: nextStatus,
        orderStatus: nextOrderStatus,
      };
    });
  },

  async queryCallbackAuditLogs(filters: {
    page?: number;
    pageSize?: number;
    callbackType?: 'PAYMENT_CALLBACK' | 'REFUND_CALLBACK';
    callbackStatus?: 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR';
    sourceMode?: string;
    startDate?: Date;
    endDate?: Date;
    requestId?: string;
    paymentId?: string;
    refundId?: string;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const where = buildCallbackAuditWhere(filters);

    // Query with pagination
    const [total, records] = await Promise.all([
      prisma.callbackAudit.count({ where }),
      prisma.callbackAudit.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
        include: {
          payment: {
            select: {
              payNo: true,
              orderId: true,
              payAmount: true,
              payStatus: true,
            },
          },
          refund: {
            select: {
              refundNo: true,
              orderId: true,
              refundAmount: true,
              refundStatus: true,
            },
          },
        },
      }),
    ]);

    return {
      items: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async queryCallbackAuditStats(filters: CallbackAuditQueryFilters) {
    const where = buildCallbackAuditWhere(filters);

    const [total, byStatusRows, byTypeRows, bySourceModeRows] = await Promise.all([
      prisma.callbackAudit.count({ where }),
      prisma.callbackAudit.groupBy({
        by: ['callbackStatus'],
        where,
        _count: { _all: true },
      }),
      prisma.callbackAudit.groupBy({
        by: ['callbackType'],
        where,
        _count: { _all: true },
      }),
      prisma.callbackAudit.groupBy({
        by: ['sourceMode'],
        where,
        _count: { _all: true },
      }),
    ]);

    const byStatus = {
      PENDING: 0,
      SUCCESS: 0,
      FAILURE: 0,
      ERROR: 0,
    };
    const byType = {
      PAYMENT_CALLBACK: 0,
      REFUND_CALLBACK: 0,
    };
    const bySourceMode = {
      TOKEN: 0,
      WECHATPAY_HMAC: 0,
      WECHATPAY_SDK: 0,
    };

    byStatusRows.forEach((item) => {
      byStatus[item.callbackStatus] = item._count._all;
    });
    byTypeRows.forEach((item) => {
      byType[item.callbackType] = item._count._all;
    });
    bySourceModeRows.forEach((item) => {
      bySourceMode[item.sourceMode as keyof typeof bySourceMode] = item._count._all;
    });

    return {
      total,
      successRate: total > 0 ? Number(((byStatus.SUCCESS / total) * 100).toFixed(2)) : 0,
      byStatus,
      byType,
      bySourceMode,
    };
  },

  async listCallbackAuditExportRows(filters: CallbackAuditQueryFilters) {
    const where = buildCallbackAuditWhere(filters);

    return prisma.callbackAudit.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payment: {
          select: {
            payNo: true,
            orderId: true,
            payAmount: true,
            payStatus: true,
          },
        },
        refund: {
          select: {
            refundNo: true,
            orderId: true,
            refundAmount: true,
            refundStatus: true,
          },
        },
      },
      take: 5000,
    });
  },

  async queryCallbackAlertOutboxes(filters: {
    page?: number;
    pageSize?: number;
    status?: CallbackAlertOutboxStatus;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const where = buildCallbackAlertOutboxWhere(filters);

    const [total, records] = await Promise.all([
      prisma.callbackAlertOutbox.count({ where }),
      prisma.callbackAlertOutbox.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
        include: {
          callbackAudit: {
            select: {
              callbackType: true,
              callbackStatus: true,
              requestId: true,
              sourceMode: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      items: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async queryCallbackAlertOutboxStats(filters: CallbackAlertOutboxQueryFilters) {
    const where = buildCallbackAlertOutboxWhere(filters);
    const processingTimeoutMinutes = Math.min(
      240,
      Math.max(1, filters.processingTimeoutMinutes ?? 10),
    );
    const processingTimeoutAt = new Date(Date.now() - processingTimeoutMinutes * 60_000);
    const [total, statusRows, oldestPending, oldestDead, stuckProcessingCount] = await Promise.all([
      prisma.callbackAlertOutbox.count({ where }),
      prisma.callbackAlertOutbox.groupBy({
        by: ['status'],
        where,
        _count: {
          _all: true,
        },
      }),
      prisma.callbackAlertOutbox.findFirst({
        where: {
          ...where,
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.callbackAlertOutbox.findFirst({
        where: {
          ...where,
          status: 'DEAD',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.callbackAlertOutbox.count({
        where: {
          ...where,
          status: 'PROCESSING',
          createdAt: {
            lte: processingTimeoutAt,
          },
        },
      }),
    ]);

    const byStatus: Record<CallbackAlertOutboxStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SENT: 0,
      FAILED: 0,
      DEAD: 0,
    };

    statusRows.forEach((row) => {
      byStatus[row.status as CallbackAlertOutboxStatus] = row._count._all;
    });

    const now = Date.now();
    const oldestPendingAgeMinutes = oldestPending
      ? Math.floor((now - oldestPending.createdAt.getTime()) / 60000)
      : 0;
    const oldestDeadAgeMinutes = oldestDead
      ? Math.floor((now - oldestDead.createdAt.getTime()) / 60000)
      : 0;

    return {
      total,
      byStatus,
      oldestPendingAgeMinutes,
      oldestDeadAgeMinutes,
      stuckProcessingCount,
      processingTimeoutMinutes,
    };
  },

  async retryCallbackAlertOutbox(id: string, options?: { actorId?: string | null }) {
    const existing = await prisma.callbackAlertOutbox.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        retryCount: true,
        maxRetries: true,
      },
    });

    if (!existing) {
      throw notFound('Callback alert outbox record not found');
    }

    const updated = await prisma.callbackAlertOutbox.update({
      where: {
        id,
      },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(),
        lastError: null,
        maxRetries: Math.max(existing.maxRetries, existing.retryCount + 1),
      },
    });

    await writeCallbackAlertReplayLog({
      outboxIds: [id],
      actorId: options?.actorId,
      actionType: 'REQUEUE',
      note: 'manual single requeue',
    });

    return updated;
  },

  async retryDeadCallbackAlertOutboxes(limit = 50, options?: { actorId?: string | null }) {
    const take = Math.min(200, Math.max(1, limit));

    const deadRows = await prisma.callbackAlertOutbox.findMany({
      where: {
        status: 'DEAD',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take,
      select: {
        id: true,
      },
    });

    const ids = deadRows.map((item) => item.id);
    if (!ids.length) {
      return {
        requested: take,
        requeued: 0,
      };
    }

    const result = await prisma.callbackAlertOutbox.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(),
        lastError: null,
      },
    });

    await writeCallbackAlertReplayLog({
      outboxIds: ids,
      actorId: options?.actorId,
      actionType: 'REQUEUE_DEAD_BATCH',
      note: `batch dead requeue limit=${take}`,
    });

    return {
      requested: take,
      requeued: result.count,
    };
  },

  async listCallbackAlertReplayLogs(
    callbackOutboxId: string,
    page = 1,
    pageSize = 10,
    filters?: {
      actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.min(100, Math.max(1, pageSize));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.CallbackAlertReplayLogWhereInput = {
      callbackOutboxId,
      actionType: filters?.actionType,
      actorId: filters?.actorId,
      createdAt: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    };

    const [total, items] = await Promise.all([
      prisma.callbackAlertReplayLog.count({ where }),
      prisma.callbackAlertReplayLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: normalizedPageSize,
        select: {
          id: true,
          actionType: true,
          actorId: true,
          note: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize),
      },
    };
  },

  async listCallbackAlertReplayLogExportRows(
    callbackOutboxId: string,
    filters?: {
      actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: Prisma.CallbackAlertReplayLogWhereInput = {
      callbackOutboxId,
      actionType: filters?.actionType,
      actorId: filters?.actorId,
      createdAt: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    };

    return prisma.callbackAlertReplayLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 5000,
      select: {
        callbackOutboxId: true,
        actionType: true,
        actorId: true,
        note: true,
        createdAt: true,
      },
    });
  },

  async queryCallbackAlertReplayLogStats(
    callbackOutboxId: string,
    filters?: {
      actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
      dominanceThreshold?: number;
      dominanceMinSamples?: number;
      staleThresholdMinutes?: number;
    },
  ) {
    const where: Prisma.CallbackAlertReplayLogWhereInput = {
      callbackOutboxId,
      actionType: filters?.actionType,
      actorId: filters?.actorId,
      createdAt: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    };

    const [total, byActionRows, uniqueActorRows, latestReplay] = await Promise.all([
      prisma.callbackAlertReplayLog.count({ where }),
      prisma.callbackAlertReplayLog.groupBy({
        by: ['actionType'],
        where,
        _count: {
          _all: true,
        },
      }),
      prisma.callbackAlertReplayLog.groupBy({
        by: ['actorId'],
        where: {
          ...where,
          actorId: {
            not: null,
          },
        },
      }),
      prisma.callbackAlertReplayLog.findFirst({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const byAction = {
      REQUEUE: 0,
      REQUEUE_DEAD_BATCH: 0,
    };

    byActionRows.forEach((row) => {
      byAction[row.actionType as 'REQUEUE' | 'REQUEUE_DEAD_BATCH'] = row._count._all;
    });

    const batchReplayRatio =
      total > 0 ? Number((byAction.REQUEUE_DEAD_BATCH / total).toFixed(4)) : 0;
    const dominanceThreshold = Number((filters?.dominanceThreshold ?? 0.7).toFixed(4));
    const dominanceMinSamples = filters?.dominanceMinSamples ?? 5;
    const isBatchReplayDominant =
      total >= dominanceMinSamples && batchReplayRatio >= dominanceThreshold;
    const staleThresholdMinutes = filters?.staleThresholdMinutes ?? 30;
    const latestReplayAt = latestReplay?.createdAt.toISOString() ?? null;
    const minutesSinceLastReplay = latestReplay
      ? Math.floor((Date.now() - latestReplay.createdAt.getTime()) / 60000)
      : null;
    const isReplayStale =
      minutesSinceLastReplay !== null && minutesSinceLastReplay >= staleThresholdMinutes;

    return {
      total,
      byAction,
      uniqueActorCount: uniqueActorRows.length,
      batchReplayRatio,
      isBatchReplayDominant,
      latestReplayAt,
      minutesSinceLastReplay,
      dominanceThreshold,
      dominanceMinSamples,
      staleThresholdMinutes,
      isReplayStale,
    };
  },
};

export const purgeExpiredCallbackAudits = async (olderThanDays = 90) => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.callbackAudit.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  });

  return {
    cutoff,
    deleted: result.count,
  };
};
