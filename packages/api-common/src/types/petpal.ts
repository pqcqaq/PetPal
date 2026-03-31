import type { PaginatedResult } from './common';

export type PetSpecies = 'DOG' | 'CAT' | 'OTHER';
export type PetGender = 'MALE' | 'FEMALE' | 'UNKNOWN';
export type PetServiceType = 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
export type ServiceRequestStatus = 'OPEN' | 'MATCHING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type OrderStatus =
  | 'PENDING_ACCEPT'
  | 'ACCEPTED'
  | 'SERVING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PARTIAL_REFUNDED'
  | 'REFUNDED';
export type PaymentBizType = 'DEPOSIT' | 'TAIL' | 'ADJUSTMENT';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CLOSED';
export type RefundType = 'OWNER_CANCEL' | 'SERVICE_EXCEPTION' | 'DISPUTE';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUCCESS' | 'FAILED';

type AmountValue = number | string;

export interface PetProfileRecord {
  id: string;
  ownerId: string;
  name: string;
  species: PetSpecies;
  breed: string | null;
  gender: PetGender;
  weightKg: AmountValue | null;
  neutered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePetPayload {
  name: string;
  species: PetSpecies;
  breed?: string;
  gender?: PetGender;
  weightKg?: number;
  neutered?: boolean;
}

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
  payments: PaymentRecordBrief[];
  refunds: RefundRecordBrief[];
}

export type OrderDetailRecord = OrderRecord;

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
}

export type MatchedCaregiverPage = PaginatedResult<MatchedCaregiverRecord>;

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
}
