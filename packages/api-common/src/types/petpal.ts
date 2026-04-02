import type { PaginatedResult } from './common';

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';
export type PetGender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type PetServiceType = 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
export type ServiceRequestStatus =
  | 'OPEN'
  | 'MATCHED'
  | 'CLOSED'
  | 'MATCHING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED';
export type OrderStatus =
  | 'PENDING_ACCEPT'
  | 'ACCEPTED'
  | 'SERVING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'PARTIAL_REFUNDED'
  | 'REFUNDED';
export type PaymentBizType = 'DEPOSIT' | 'BALANCE' | 'ADJUSTMENT';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CLOSED';
export type RefundType = 'FULL' | 'PARTIAL';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';
export type OwnerPayChannel = 'WECHAT_PAY' | 'ALIPAY' | 'BALANCE';
export type RefundProgressStage =
  | 'NONE'
  | 'PENDING_REVIEW'
  | 'APPROVED_WAITING'
  | 'PARTIAL_SUCCESS'
  | 'FULL_SUCCESS'
  | 'REJECTED'
  | 'FAILED';
export type CaregiverAuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrderTimelineEventType =
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
export type OrderOperatorRole = 'OWNER' | 'CAREGIVER' | 'ADMIN' | 'SYSTEM';
export type OrderMessageSenderRole = Extract<OrderOperatorRole, 'OWNER' | 'CAREGIVER'>;
export type ServiceLogType =
  | 'CHECK_IN'
  | 'FEED'
  | 'WALK'
  | 'PLAY'
  | 'HEALTH'
  | 'CHECK_OUT'
  | 'NOTE';
export type ComplaintTargetRole = 'CAREGIVER' | 'PLATFORM';
export type ComplaintType = 'SAFETY' | 'FEE' | 'SERVICE' | 'FRAUD' | 'OTHER';
export type ComplaintStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'REJECTED';
export type ComplaintActionType =
  | 'OPEN'
  | 'ASSIGN'
  | 'INVESTIGATE'
  | 'CALL_USER'
  | 'PENALTY'
  | 'CLOSE';

type AmountValue = number | string;

export interface PetEmergencyContactRecord {
  name: string;
  phone: string;
  relation: string | null;
}

export interface PetProfileRecord {
  id: string;
  ownerId: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  gender: PetGender;
  birthday: string | null;
  weightKg: AmountValue | null;
  neutered: boolean;
  temperamentTags: string[];
  feedingNote: string | null;
  allergyNote: string | null;
  medicalNote: string | null;
  emergencyContact: PetEmergencyContactRecord | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePetPayload {
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;
  birthday?: string;
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
}

export interface UpdatePetPayload extends CreatePetPayload {}

export interface ServiceRequestRecord {
  id: string;
  ownerId: string;
  petId: string;
  serviceType: PetServiceType;
  startTime: string;
  endTime: string;
  locationText: string;
  locationLat: AmountValue | null;
  locationLng: AmountValue | null;
  budgetAmount: AmountValue | null;
  demandTags: unknown;
  status: ServiceRequestStatus;
  matchedCaregiverId: string | null;
  createdAt: string;
  updatedAt: string;
  pet?: {
    id: string;
    name: string;
    species: PetSpecies;
  };
  matchedCaregiver?: {
    id: string;
    user: {
      id: string;
      nickname: string;
    };
  } | null;
}

export interface CreateServiceRequestPayload {
  petId: string;
  serviceType: PetServiceType;
  startTime: string;
  endTime: string;
  locationText: string;
  locationLat?: number;
  locationLng?: number;
  budgetAmount?: number;
  demandTags?: string[];
}

export interface CreateOwnerOrderPayload {
  requestId: string;
  caregiverServiceId: string;
}

export interface PayOwnerOrderPayload {
  payChannel: OwnerPayChannel;
}

export interface PaymentRecordBrief {
  id: string;
  payNo: string;
  bizType: PaymentBizType;
  payStatus: PaymentStatus;
  payAmount: AmountValue;
  paidAt: string | null;
}

export interface RefundRecordBrief {
  id: string;
  refundNo: string;
  refundType: RefundType;
  refundStatus: RefundStatus;
  refundAmount: AmountValue;
  reviewedAt: string | null;
}

export interface PaymentRecordDetail extends PaymentRecordBrief {
  createdAt: string;
  updatedAt: string;
}

export interface RefundRecordDetail extends RefundRecordBrief {
  applyUserId: string;
  reviewedBy: string | null;
  refundReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRefundProgressRecord {
  stage: RefundProgressStage;
  latestRefundNo: string | null;
  latestRefundStatus: RefundStatus | null;
  latestRefundAmount: AmountValue | null;
  latestRefundReason: string | null;
  latestAppliedAt: string | null;
  latestReviewedAt: string | null;
  totalRefundCount: number;
  pendingCount: number;
  approvedCount: number;
  successCount: number;
  rejectedCount: number;
  failedCount: number;
  requestedRefundAmount: AmountValue;
  settledRefundAmount: AmountValue;
  refundableBalance: AmountValue;
}

export interface OrderTimelineRecord {
  id: string;
  orderId: string;
  eventType: OrderTimelineEventType;
  operatorRole: OrderOperatorRole;
  operatorId: string | null;
  eventPayload: Record<string, unknown> | null;
  createdAt: string;
}

export interface ServiceLogRecord {
  id: string;
  orderId: string;
  caregiverId: string;
  logType: ServiceLogType;
  textNote: string | null;
  mediaUrls: string[];
  geo: Record<string, unknown> | null;
  happenedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderReviewRecord {
  id: string;
  orderId: string;
  ownerId: string;
  caregiverId: string;
  rating: number;
  tags: string[];
  content: string | null;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintProcessLogRecord {
  id: string;
  complaintId: string;
  actionType: ComplaintActionType;
  operatorId: string | null;
  operatorNickname: string | null;
  note: string | null;
  createdAt: string;
}

export interface ComplaintRecord {
  id: string;
  orderId: string;
  complainantId: string;
  targetRole: ComplaintTargetRole;
  complaintType: ComplaintType;
  description: string;
  evidenceUrls: string[];
  status: ComplaintStatus;
  resultSummary: string | null;
  assignedAdminId: string | null;
  assignedAdminNickname: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  processLogs: ComplaintProcessLogRecord[];
}

export interface OrderConversationRecord {
  id: string;
  orderId: string;
  ownerUnreadCount: number;
  caregiverUnreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderMessageRecord {
  id: string;
  conversationId: string;
  senderRole: OrderMessageSenderRole;
  senderUserId: string;
  content: string | null;
  mediaUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderConversationDetailRecord extends OrderConversationRecord {
  messages: OrderMessageRecord[];
}

export type ComplaintAdminSlaStatus = 'NORMAL' | 'DUE_SOON' | 'OVERDUE';

export interface ComplaintAdminRecord extends ComplaintRecord {
  orderNo: string;
  orderStatus: OrderStatus;
  ownerId: string;
  ownerNickname: string;
  caregiverId: string;
  caregiverNickname: string;
  slaStatus: ComplaintAdminSlaStatus | null;
  slaDeadlineAt: string | null;
}

export interface OrderRecord {
  id: string;
  orderNo: string;
  ownerId: string;
  caregiverId: string;
  serviceRequestId: string | null;
  serviceType: PetServiceType;
  appointmentStart: string;
  appointmentEnd: string;
  amountTotal: AmountValue;
  amountAdjusted: AmountValue;
  amountPaid: AmountValue;
  amountRefunded: AmountValue;
  orderStatus: OrderStatus;
  createdAt: string;
  updatedAt: string;
  conversation: OrderConversationRecord | null;
  payments: PaymentRecordBrief[];
  refunds: RefundRecordBrief[];
}

export interface OrderDetailRecord extends Omit<OrderRecord, 'payments' | 'refunds'> {
  payments: PaymentRecordDetail[];
  refunds: RefundRecordDetail[];
  timeline: OrderTimelineRecord[];
  serviceLogs: ServiceLogRecord[];
  review: OrderReviewRecord | null;
}

export interface CaregiverOrderRecord extends OrderRecord {
  ownerNickname: string;
  petName: string | null;
  locationText: string | null;
}

export interface CaregiverOrderQuery {
  status?: OrderStatus;
  page?: number;
  pageSize?: number;
}

export interface CaregiverOrderPage {
  items: CaregiverOrderRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CaregiverEarningsOrderRecord {
  id: string;
  orderNo: string;
  serviceType: PetServiceType;
  appointmentStart: string;
  appointmentEnd: string;
  amountPaid: AmountValue;
  amountRefunded: AmountValue;
  orderStatus: OrderStatus;
  ownerNickname: string;
  petName: string | null;
  locationText: string | null;
}

export interface CaregiverEarningsExportRow extends CaregiverEarningsOrderRecord {
  netIncome: AmountValue;
  closedAt: string | null;
}

export interface CaregiverServiceRevenueMixRecord {
  serviceType: PetServiceType;
  revenue: AmountValue;
  orderCount: number;
  averageTicket: AmountValue;
  shareRatio: number;
}

export interface CaregiverEarningsTrendBucketRecord {
  label: string;
  rangeStart: string;
  rangeEnd: string;
  revenue: AmountValue;
  completedOrderCount: number;
}

export interface CaregiverEarningsSummaryRecord {
  profile: {
    auditStatus: CaregiverAuditStatus;
    ratingAvg: AmountValue;
    ratingCount: number;
    serviceCity: string | null;
    experienceYears: number;
    serviceRadiusKm: number;
  };
  totals: {
    totalIncome: AmountValue;
    recentThirtyDayIncome: AmountValue;
    averageTicket: AmountValue;
    refundExposure: AmountValue;
    completedOrderCount: number;
    activeOrderCount: number;
    aftersalesOrderCount: number;
    aftersalesRiskRate: number;
    activeServiceCount: number;
    totalServiceCount: number;
  };
  latestActiveOrder: CaregiverEarningsOrderRecord | null;
  recentCompletedOrders: CaregiverEarningsOrderRecord[];
  serviceRevenueMix: CaregiverServiceRevenueMixRecord[];
  trends: {
    daily: CaregiverEarningsTrendBucketRecord[];
    weekly: CaregiverEarningsTrendBucketRecord[];
    monthly: CaregiverEarningsTrendBucketRecord[];
  };
}

export interface CreateServiceLogPayload {
  logType: ServiceLogType;
  textNote?: string;
  mediaUrls?: string[];
  geo?: Record<string, unknown>;
  happenedAt?: string;
}

export interface CreateOrderReviewPayload {
  rating: number;
  tags?: string[];
  content?: string;
  isAnonymous?: boolean;
}

export interface CreateComplaintPayload {
  targetRole: ComplaintTargetRole;
  complaintType: ComplaintType;
  description: string;
  evidenceUrls?: string[];
}

export interface CreateOrderMessagePayload {
  content?: string;
  mediaUrls?: string[];
}

export interface ComplaintAdminQuery {
  page?: number;
  pageSize?: number;
  status?: ComplaintStatus;
  complaintType?: ComplaintType;
  targetRole?: ComplaintTargetRole;
  slaStatus?: ComplaintAdminSlaStatus;
  assignedAdminId?: string;
  unassignedOnly?: boolean;
  keyword?: string;
}

export interface ManageComplaintPayload {
  actionType: Exclude<ComplaintActionType, 'OPEN'>;
  assigneeId?: string;
  note?: string;
  resultStatus?: Extract<ComplaintStatus, 'RESOLVED' | 'REJECTED'>;
  resultSummary?: string;
}

export interface BatchAssignComplaintsPayload {
  complaintIds: string[];
  assigneeId: string;
  note?: string;
}

export interface BatchAssignComplaintsResult {
  requestedCount: number;
  updatedCount: number;
  items: ComplaintAdminRecord[];
}

export interface BatchCloseComplaintsPayload {
  complaintIds: string[];
  resultStatus: Extract<ComplaintStatus, 'RESOLVED' | 'REJECTED'>;
  resultSummary: string;
}

export interface BatchCloseComplaintsResult {
  requestedCount: number;
  updatedCount: number;
  items: ComplaintAdminRecord[];
}

export interface ComplaintAdminStats {
  total: number;
  byStatus: Record<ComplaintStatus, number>;
  dueSoonCount: number;
  overdueCount: number;
  unassignedCount: number;
  assignedToMeCount: number;
  processingAssignedToMeCount: number;
  slaLimitHours: number;
  slaWarningHours: number;
}

export interface ComplaintAdminPage {
  items: ComplaintAdminRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface OwnerTransactionExportQuery {
  [key: string]: string | number | boolean | undefined;
  startDate?: string;
  endDate?: string;
}

export interface OwnerRefundExportQuery {
  [key: string]: string | number | boolean | undefined;
  startDate?: string;
  endDate?: string;
  refundType?: RefundType;
  refundStatus?: RefundStatus;
  complaintStatus?: ComplaintStatus;
  complaintType?: ComplaintType;
  complaintTargetRole?: ComplaintTargetRole;
  serviceType?: PetServiceType;
  orderNoKeyword?: string;
}

export interface OwnerOrderRefundExportQuery {
  [key: string]: string | number | boolean | undefined;
}

export interface CaregiverEarningsExportQuery {
  [key: string]: string | number | boolean | undefined;
  startDate?: string;
  endDate?: string;
  serviceType?: PetServiceType;
  refundType?: RefundType;
  riskOnly?: boolean;
  complaintStatus?: ComplaintStatus;
  complaintType?: ComplaintType;
  complaintTargetRole?: ComplaintTargetRole;
}

export interface MatchCaregiverQuery {
  serviceType: PetServiceType;
  petSpecies: PetSpecies;
  city?: string;
  lat?: number;
  lng?: number;
  page?: number;
  pageSize?: number;
}

export interface MatchedCaregiverRecord {
  serviceId: string;
  caregiverId: string;
  caregiverName: string;
  serviceType: PetServiceType;
  petSpecies: PetSpecies;
  pricePerUnit: AmountValue;
  unitType: string;
  city: string | null;
  distanceKm: number | null;
  ratingAvg: AmountValue;
  ratingCount: number;
  intro: string | null;
  experienceYears: number;
  serviceRadiusKm: number;
  specialtyTags: string[];
  serviceCommitment: string | null;
  minNoticeHours: number;
}

export type MatchedCaregiverPage = PaginatedResult<MatchedCaregiverRecord>;

export interface CaregiverQualificationMaterialRecord {
  fileId: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface CaregiverProfileRecord {
  id: string;
  userId: string;
  intro: string | null;
  experienceYears: number;
  serviceRadiusKm: number;
  serviceCity: string | null;
  specialtyTags: string[];
  serviceCommitment: string | null;
  qualificationMaterials: CaregiverQualificationMaterialRecord[];
  ratingAvg: AmountValue;
  ratingCount: number;
  auditStatus: CaregiverAuditStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCaregiverProfilePayload {
  intro?: string;
  experienceYears?: number;
  serviceRadiusKm?: number;
  serviceCity?: string;
  specialtyTags?: string[];
  serviceCommitment?: string;
  qualificationMaterials?: CaregiverQualificationMaterialRecord[];
}

export interface CaregiverServiceRecord {
  id: string;
  caregiverId: string;
  serviceType: PetServiceType;
  petSpecies: PetSpecies;
  pricePerUnit: AmountValue;
  unitType: string;
  minNoticeHours: number;
  availableSlots: unknown;
  serviceCity: string | null;
  serviceLat: AmountValue | null;
  serviceLng: AmountValue | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCaregiverServicePayload {
  serviceType: PetServiceType;
  petSpecies: PetSpecies;
  pricePerUnit: number;
  unitType: string;
  minNoticeHours?: number;
  availableSlots?: unknown;
  serviceCity?: string;
  serviceLat?: number;
  serviceLng?: number;
  isActive?: boolean;
}

export interface CaregiverAuditPayload {
  status: CaregiverAuditStatus;
}

export interface CaregiverAuditQuery {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  pageSize?: number;
  auditStatus?: CaregiverAuditStatus;
  city?: string;
  keyword?: string;
}

export interface CaregiverAuditListItem {
  id: string;
  userId: string;
  nickname: string;
  intro: string | null;
  experienceYears: number;
  serviceRadiusKm: number;
  serviceCity: string | null;
  specialtyTags: string[];
  serviceCommitment: string | null;
  auditStatus: CaregiverAuditStatus;
  serviceCount: number;
  qualificationMaterialCount: number;
  qualificationMaterials: CaregiverQualificationMaterialRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverAuditPage {
  items: CaregiverAuditListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type CallbackType = 'PAYMENT_CALLBACK' | 'REFUND_CALLBACK';
export type CallbackStatus = 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR';
export type CallbackSourceMode = 'TOKEN' | 'WECHATPAY_HMAC' | 'WECHATPAY_SDK';
export type CallbackAlertOutboxStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEAD';

export interface CallbackAuditRecord {
  id: string;
  callbackType: CallbackType;
  paymentId?: string;
  refundId?: string;
  requestId: string;
  callbackTimestamp: string;
  callbackStatus: CallbackStatus;
  sourceMode: CallbackSourceMode;
  signatureDigest: string;
  verificationResult: Record<string, unknown>;
  rawPayload: string;
  createdAt: string;
  updatedAt: string;
  payment?: {
    payNo: string;
    orderId: string;
    amount: AmountValue;
    status: PaymentStatus;
  };
  refund?: {
    refundNo: string;
    orderId: string;
    amount: AmountValue;
    status: RefundStatus;
  };
}

export interface CallbackAuditQuery {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  pageSize?: number;
  callbackType?: CallbackType;
  callbackStatus?: CallbackStatus;
  sourceMode?: CallbackSourceMode;
  requestId?: string;
  paymentId?: string;
  refundId?: string;
  startDate?: string;
  endDate?: string;
}

export interface CallbackAuditPage {
  items: CallbackAuditRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CallbackAuditStats {
  total: number;
  successRate: number;
  byStatus: Record<CallbackStatus, number>;
  byType: Record<CallbackType, number>;
  bySourceMode: Record<CallbackSourceMode, number>;
}

export interface CallbackAlertOutboxRecord {
  id: string;
  callbackAuditId: string;
  eventType: string;
  status: CallbackAlertOutboxStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string;
  lastError: string | null;
  payload: Record<string, unknown>;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  callbackAudit: {
    callbackType: CallbackType;
    callbackStatus: CallbackStatus;
    requestId: string;
    sourceMode: CallbackSourceMode;
    createdAt: string;
  };
}

export interface CallbackAlertOutboxQuery {
  [key: string]: string | number | boolean | undefined;
  page?: number;
  pageSize?: number;
  status?: CallbackAlertOutboxStatus;
  processingTimeoutMinutes?: number;
}

export interface CallbackAlertOutboxPage {
  items: CallbackAlertOutboxRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CallbackAlertOutboxStats {
  total: number;
  byStatus: Record<CallbackAlertOutboxStatus, number>;
  oldestPendingAgeMinutes: number;
  oldestDeadAgeMinutes: number;
  stuckProcessingCount: number;
  processingTimeoutMinutes: number;
}

export interface CallbackAlertReplayLogRecord {
  id: string;
  actionType: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
  actorId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CallbackAlertReplayLogQuery {
  [key: string]: string | number | boolean | undefined;
  outboxId?: string;
  page?: number;
  pageSize?: number;
  actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
  actorId?: string;
  startDate?: string;
  endDate?: string;
  dominanceThreshold?: number;
  dominanceMinSamples?: number;
  staleThresholdMinutes?: number;
}

export interface CallbackAlertReplayLogPage {
  items: CallbackAlertReplayLogRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CallbackAlertReplayLogStats {
  total: number;
  byAction: {
    REQUEUE: number;
    REQUEUE_DEAD_BATCH: number;
  };
  uniqueActorCount: number;
  batchReplayRatio: number;
  isBatchReplayDominant: boolean;
  latestReplayAt: string | null;
  minutesSinceLastReplay: number | null;
  dominanceThreshold: number;
  dominanceMinSamples: number;
  staleThresholdMinutes: number;
  isReplayStale: boolean;
}
