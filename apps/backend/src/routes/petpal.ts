import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requireAnyPermission, requirePermission } from '../middlewares/require-permission';
import { asyncHandler, ok, parsePagination } from '../utils/http';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';
import { petpalService } from '../services/petpal-service';
import { verifyPetpalCallbackAuth } from '../services/petpal-callback-auth';
import { getRequestId } from '../utils/request-context';
import { forbidden } from '../utils/errors';

const orderStatusEnum = z.enum([
  'PENDING_ACCEPT',
  'ACCEPTED',
  'SERVING',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'PARTIAL_REFUNDED',
  'REFUNDED',
]);

const petEmergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(50),
  phone: z.string().trim().min(5).max(30),
  relation: z.string().trim().max(30).optional(),
});

const petSchema = z.object({
  name: z.string().trim().min(1).max(50),
  species: z.enum(['DOG', 'CAT', 'OTHER']),
  breed: z.string().trim().max(50).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional(),
  birthday: z.coerce.date().optional(),
  weightKg: z.number().positive().max(500).optional(),
  neutered: z.boolean().optional(),
  temperamentTags: z.array(z.string().trim().min(1).max(20)).max(10).optional(),
  feedingNote: z.string().trim().max(500).optional(),
  allergyNote: z.string().trim().max(500).optional(),
  medicalNote: z.string().trim().max(500).optional(),
  emergencyContact: petEmergencyContactSchema.optional(),
});

const requestSchema = z.object({
  petId: z.string().min(1),
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  locationText: z.string().trim().min(1).max(255),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
  budgetAmount: z.number().positive().optional(),
  demandTags: z.array(z.string()).optional(),
});

const createOrderSchema = z.object({
  requestId: z.string().trim().min(1).max(64),
  caregiverServiceId: z.string().trim().min(1).max(64),
});

const payOrderSchema = z.object({
  payChannel: z.enum(['WECHAT_PAY', 'ALIPAY', 'BALANCE']),
});

const matchQuerySchema = z.object({
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']),
  petSpecies: z.enum(['DOG', 'CAT', 'OTHER']),
  city: z.string().trim().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const optionalBooleanQuerySchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === '') {
      return undefined;
    }
    if (normalizedValue === 'true') {
      return true;
    }
    if (normalizedValue === 'false') {
      return false;
    }
  }

  return value;
}, z.boolean().optional());

const qualificationMaterialSchema = z.object({
  fileId: z.string().trim().min(1).max(64),
  url: z.string().trim().url().max(1000),
  name: z.string().trim().min(1).max(120),
  mimeType: z.string().trim().min(1).max(120),
  size: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024),
  uploadedAt: z.coerce.date(),
});

const caregiverProfileSchema = z.object({
  intro: z.string().trim().max(1000).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  serviceRadiusKm: z.coerce.number().int().min(1).max(100).optional(),
  serviceCity: z.string().trim().max(50).optional(),
  specialtyTags: z.array(z.string().trim().min(1).max(20)).max(12).optional(),
  serviceCommitment: z.string().trim().max(500).optional(),
  qualificationMaterials: z.array(qualificationMaterialSchema).max(12).optional(),
});

const caregiverServiceSchema = z.object({
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']),
  petSpecies: z.enum(['DOG', 'CAT', 'OTHER']),
  pricePerUnit: z.coerce.number().positive().max(10000),
  unitType: z.string().trim().min(1).max(30),
  minNoticeHours: z.coerce.number().int().min(0).max(168).optional(),
  availableSlots: z.unknown().optional(),
  serviceCity: z.string().trim().max(50).optional(),
  serviceLat: z.coerce.number().min(-90).max(90).optional(),
  serviceLng: z.coerce.number().min(-180).max(180).optional(),
  isActive: z.boolean().optional(),
});

const caregiverAuditSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
});

const caregiverAuditListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  auditStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  city: z.string().trim().max(50).optional(),
  keyword: z.string().trim().max(50).optional(),
});

const caregiverOrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: orderStatusEnum.optional(),
});

const caregiverOrderActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
  geo: z.record(z.string(), z.unknown()).optional(),
});

const caregiverServiceLogSchema = z.object({
  logType: z.enum(['CHECK_IN', 'FEED', 'WALK', 'PLAY', 'HEALTH', 'CHECK_OUT', 'NOTE']),
  textNote: z.string().trim().max(1000).optional(),
  mediaUrls: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  geo: z.record(z.string(), z.unknown()).optional(),
  happenedAt: z.coerce.date().optional(),
});

const orderReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  tags: z.array(z.string().trim().min(1).max(20)).max(8).optional(),
  content: z.string().trim().max(1000).optional(),
  isAnonymous: z.boolean().optional(),
});

const orderComplaintSchema = z.object({
  targetRole: z.enum(['CAREGIVER', 'PLATFORM']),
  complaintType: z.enum(['SAFETY', 'FEE', 'SERVICE', 'FRAUD', 'OTHER']),
  description: z.string().trim().min(5).max(2000),
  evidenceUrls: z.array(z.string().trim().url().max(500)).max(10).optional(),
});

const orderMessageSchema = z.object({
  content: z.string().trim().max(1000).optional(),
  mediaUrls: z.array(z.string().trim().url().max(500)).max(10).optional(),
});

const ownerTransactionExportQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']).optional(),
  orderStatus: z.enum([
    'PENDING_ACCEPT',
    'ACCEPTED',
    'SERVING',
    'COMPLETED',
    'CANCELLED',
    'DISPUTED',
    'PARTIAL_REFUNDED',
    'REFUNDED',
  ]).optional(),
  orderNoKeyword: z.string().trim().min(1).max(64).optional(),
});

const ownerRefundExportQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  refundType: z.enum(['FULL', 'PARTIAL']).optional(),
  refundStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUCCESS', 'FAILED']).optional(),
  complaintStatus: z.enum(['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED']).optional(),
  complaintType: z.enum(['SAFETY', 'FEE', 'SERVICE', 'FRAUD', 'OTHER']).optional(),
  complaintTargetRole: z.enum(['CAREGIVER', 'PLATFORM']).optional(),
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']).optional(),
  orderNoKeyword: z.string().trim().min(1).max(64).optional(),
});

const ownerOrderRefundExportQuerySchema = z.object({});
const caregiverEarningsExportQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']).optional(),
  orderNoKeyword: z.string().trim().min(1).max(64).optional(),
  minRefundAmount: z.coerce.number().positive().max(100000).optional(),
  minComplaintCount: z.coerce.number().int().positive().max(20).optional(),
  refundType: z.enum(['FULL', 'PARTIAL']).optional(),
  refundStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUCCESS', 'FAILED']).optional(),
  refundReasonKeyword: z.string().trim().min(1).max(100).optional(),
  riskOnly: optionalBooleanQuerySchema,
  complaintStatus: z.enum(['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED']).optional(),
  complaintSlaStatus: z.enum(['NORMAL', 'DUE_SOON', 'OVERDUE']).optional(),
  complaintType: z.enum(['SAFETY', 'FEE', 'SERVICE', 'FRAUD', 'OTHER']).optional(),
  complaintKeyword: z.string().trim().min(1).max(100).optional(),
  complaintTargetRole: z.enum(['CAREGIVER', 'PLATFORM']).optional(),
});

const adminComplaintQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED']).optional(),
  complaintType: z.enum(['SAFETY', 'FEE', 'SERVICE', 'FRAUD', 'OTHER']).optional(),
  targetRole: z.enum(['CAREGIVER', 'PLATFORM']).optional(),
  slaStatus: z.enum(['NORMAL', 'DUE_SOON', 'OVERDUE']).optional(),
  assignedAdminId: z.string().trim().min(1).max(64).optional(),
  unassignedOnly: optionalBooleanQuerySchema,
  keyword: z.string().trim().max(100).optional(),
});

const adminComplaintStatsQuerySchema = adminComplaintQuerySchema.omit({
  page: true,
  pageSize: true,
});

const adminComplaintActionSchema = z.object({
  actionType: z.enum(['ASSIGN', 'INVESTIGATE', 'CALL_USER', 'PENALTY', 'CLOSE']),
  assigneeId: z.string().trim().min(1).max(64).optional(),
  note: z.string().trim().max(1000).optional(),
  resultStatus: z.enum(['RESOLVED', 'REJECTED']).optional(),
  resultSummary: z.string().trim().max(1000).optional(),
  penaltyTemplateId: z.string().trim().min(1).max(64).optional(),
  penaltyType: z.enum(['WARNING', 'SERVICE_RESTRICTION', 'ACCOUNT_SUSPENSION', 'OTHER']).optional(),
  penaltySeverity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  penaltyReason: z.string().trim().max(1000).optional(),
  penaltyActionSummary: z.string().trim().max(1000).optional(),
  rectifyDueAt: z.coerce.date().optional(),
});

const adminComplaintBatchAssignSchema = z.object({
  complaintIds: z.array(z.string().trim().min(1).max(64)).min(1).max(50),
  assigneeId: z.string().trim().min(1).max(64),
  note: z.string().trim().max(1000).optional(),
});

const adminComplaintBatchCloseSchema = z.object({
  complaintIds: z.array(z.string().trim().min(1).max(64)).min(1).max(50),
  resultStatus: z.enum(['RESOLVED', 'REJECTED']),
  resultSummary: z.string().trim().min(1).max(1000),
});

const penaltyTypeEnum = z.enum(['WARNING', 'SERVICE_RESTRICTION', 'ACCOUNT_SUSPENSION', 'OTHER']);
const penaltySeverityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const penaltyRectifyStatusEnum = z.enum(['PENDING', 'COMPLETED', 'WAIVED']);
const penaltyRectifyReviewStatusEnum = z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED']);
const penaltyAppealStatusEnum = z.enum(['NONE', 'PENDING', 'APPROVED', 'REJECTED']);

const adminPenaltyQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  targetRole: z.enum(['CAREGIVER', 'PLATFORM']).optional(),
  penaltyType: penaltyTypeEnum.optional(),
  severity: penaltySeverityEnum.optional(),
  rectifyStatus: penaltyRectifyStatusEnum.optional(),
  rectifyReviewStatus: penaltyRectifyReviewStatusEnum.optional(),
  appealStatus: penaltyAppealStatusEnum.optional(),
  overdueOnly: optionalBooleanQuerySchema,
  keyword: z.string().trim().max(100).optional(),
});

const adminPenaltyStatsQuerySchema = adminPenaltyQuerySchema.omit({
  page: true,
  pageSize: true,
});

const adminPenaltyRectifySchema = z.object({
  rectifyStatus: z.enum(['COMPLETED', 'WAIVED']),
  rectifyNote: z.string().trim().min(1).max(1000),
  rectifyEvidenceUrls: z.array(z.string().trim().url().max(500)).max(10).optional(),
});

const adminPenaltyAppealSchema = z.object({
  appealReason: z.string().trim().min(1).max(1000),
});

const adminPenaltyAppealReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().min(1).max(1000),
});

const adminPenaltyRectifyReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewNote: z.string().trim().min(1).max(1000),
});

const penaltyTemplateQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  targetRole: z.enum(['CAREGIVER', 'PLATFORM']).optional(),
  penaltyType: penaltyTypeEnum.optional(),
  severity: penaltySeverityEnum.optional(),
  isActive: optionalBooleanQuerySchema,
  keyword: z.string().trim().max(100).optional(),
});

const penaltyTemplateStatsQuerySchema = penaltyTemplateQuerySchema.omit({
  page: true,
  pageSize: true,
});

const penaltyTemplatePayloadSchema = z.object({
  templateCode: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/),
  templateName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  targetRole: z.enum(['CAREGIVER', 'PLATFORM']).optional(),
  penaltyType: penaltyTypeEnum,
  severity: penaltySeverityEnum,
  defaultReason: z.string().trim().min(1).max(1000),
  actionSummary: z.string().trim().min(1).max(1000),
  defaultRectifyDays: z.coerce.number().int().min(1).max(365).optional(),
});

const penaltyTemplateStatusSchema = z.object({
  isActive: z.boolean(),
});

const platformRuleStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

const platformRuleQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  status: platformRuleStatusEnum.optional(),
  keyword: z.string().trim().max(100).optional(),
});

const platformRuleStatsQuerySchema = platformRuleQuerySchema.omit({
  page: true,
  pageSize: true,
});

const platformRulePayloadSchema = z.object({
  ruleCode: z.string().trim().min(2).max(50).regex(/^[A-Za-z0-9_-]+$/),
  ruleName: z.string().trim().min(1).max(100),
  ruleVersion: z.string().trim().min(1).max(20),
  contentMd: z.string().trim().min(1).max(20000),
  effectiveAt: z.coerce.date(),
});

const paymentCallbackSchema = z.object({
  payNo: z.string().trim().min(1),
  channelTxnId: z.string().trim().min(1),
  success: z.boolean(),
  paidAmount: z.number().positive().optional(),
  channelPayload: z.unknown().optional(),
});

const refundCallbackSchema = z.object({
  refundNo: z.string().trim().min(1),
  channelRefundId: z.string().trim().min(1),
  success: z.boolean(),
  channelPayload: z.unknown().optional(),
});

const callbackAlertOutboxRetryDeadSchema = z.object({
  limit: z.number().int().positive().max(200).optional(),
});

const callbackAlertOutboxReplayLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  actionType: z.enum(['REQUEUE', 'REQUEUE_DEAD_BATCH']).optional(),
  actorId: z.string().trim().min(1).max(64).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const callbackAlertOutboxReplayLogExportQuerySchema =
  callbackAlertOutboxReplayLogQuerySchema.extend({
    outboxId: z.string().trim().min(1),
  });

const callbackAlertOutboxReplayLogStatsQuerySchema = callbackAlertOutboxReplayLogQuerySchema.extend(
  {
    dominanceThreshold: z.coerce.number().min(0.1).max(1).optional(),
    dominanceMinSamples: z.coerce.number().int().min(1).max(100).optional(),
    staleThresholdMinutes: z.coerce.number().int().min(1).max(10080).optional(),
  },
);

const orderStatusLabels: Record<string, string> = {
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
};

const serviceTypeLabels: Record<string, string> = {
  BOARDING: '寄养',
  WALKING: '遛宠',
  FEEDING: '喂养',
  DOOR_VISIT: '上门',
};

const refundStatusLabels: Record<string, string> = {
  PENDING: '待处理',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
  SUCCESS: '已退款',
  FAILED: '退款失败',
};

const refundTypeLabels: Record<string, string> = {
  FULL: '全额退款',
  PARTIAL: '部分退款',
};

const petpalRouter = Router();

const parseCallbackAuditQuery = (query: Record<string, unknown>) => ({
  callbackType: query.callbackType as 'PAYMENT_CALLBACK' | 'REFUND_CALLBACK' | undefined,
  callbackStatus: query.callbackStatus as 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR' | undefined,
  sourceMode: query.sourceMode as string | undefined,
  requestId: query.requestId as string | undefined,
  paymentId: query.paymentId as string | undefined,
  refundId: query.refundId as string | undefined,
  startDate: query.startDate ? new Date(String(query.startDate)) : undefined,
  endDate: query.endDate ? new Date(String(query.endDate)) : undefined,
});

const parseCallbackAlertOutboxQuery = (query: Record<string, unknown>) => ({
  status: query.status as 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEAD' | undefined,
  processingTimeoutMinutes: query.processingTimeoutMinutes
    ? Number(query.processingTimeoutMinutes)
    : undefined,
});

petpalRouter.post(
  '/payments/callback',
  asyncHandler(async (req, res) => {
    const authMeta = verifyPetpalCallbackAuth(
      req.headers,
      req.rawBody ?? JSON.stringify(req.body ?? {}),
    );
    const payload = paymentCallbackSchema.parse(req.body);
    const requestId = getRequestId() || 'unknown';
    const result = await petpalService.handlePaymentCallback({
      ...payload,
      auditInfo: {
        requestId,
        sourceMode: authMeta.sourceMode,
        signatureDigest: authMeta.signatureDigest,
        callbackTimestamp: authMeta.callbackTimestamp,
        rawPayload: req.rawBody ?? JSON.stringify(req.body ?? {}),
      },
    });
    return ok(
      res,
      {
        ...result,
        callbackAuth: {
          ...authMeta,
          requestId,
        },
      },
      'Payment callback handled',
    );
  }),
);

petpalRouter.post(
  '/refunds/callback',
  asyncHandler(async (req, res) => {
    const authMeta = verifyPetpalCallbackAuth(
      req.headers,
      req.rawBody ?? JSON.stringify(req.body ?? {}),
    );
    const payload = refundCallbackSchema.parse(req.body);
    const requestId = getRequestId() || 'unknown';
    const result = await petpalService.handleRefundCallback({
      ...payload,
      auditInfo: {
        requestId,
        sourceMode: authMeta.sourceMode,
        signatureDigest: authMeta.signatureDigest,
        callbackTimestamp: authMeta.callbackTimestamp,
        rawPayload: req.rawBody ?? JSON.stringify(req.body ?? {}),
      },
    });
    return ok(
      res,
      {
        ...result,
        callbackAuth: {
          ...authMeta,
          requestId,
        },
      },
      'Refund callback handled',
    );
  }),
);

petpalRouter.use(authMiddleware);

petpalRouter.get(
  '/pets',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const pets = await petpalService.listPets(auth.id);
    return ok(res, pets, 'Pet list');
  }),
);

petpalRouter.post(
  '/pets',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = petSchema.parse(req.body);
    const pet = await petpalService.createPet(auth.id, payload);
    return ok(res, pet, 'Pet created');
  }),
);

petpalRouter.put(
  '/pets/:id',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = petSchema.parse(req.body);
    const pet = await petpalService.updatePet(auth.id, String(req.params.id), payload);
    return ok(res, pet, 'Pet updated');
  }),
);

petpalRouter.get(
  '/requests',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const requests = await petpalService.listOwnerRequests(auth.id);
    return ok(res, requests, 'Request list');
  }),
);

petpalRouter.post(
  '/requests',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = requestSchema.parse(req.body);
    const requestRecord = await petpalService.createRequest(auth.id, payload);
    return ok(res, requestRecord, 'Request created');
  }),
);

petpalRouter.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const orders = await petpalService.listOwnerOrders(auth.id);
    return ok(res, orders, 'Order list');
  }),
);

petpalRouter.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = createOrderSchema.parse(req.body);
    const order = await petpalService.createOwnerOrder(auth.id, payload);
    return ok(res, order, 'Order created');
  }),
);

petpalRouter.get(
  '/orders/transactions/export',
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-owner-transactions'),
    sheetName: 'PetPal Owner Transactions',
    parseQuery: (query) => ownerTransactionExportQuerySchema.parse(query ?? {}),
    queryRows: (query) => petpalService.listOwnerTransactionExportRows(query),
    columns: [
      { header: '订单号', width: 24, value: (row) => row.orderNo },
      {
        header: '订单状态',
        width: 14,
        value: (row) => orderStatusLabels[row.orderStatus] ?? row.orderStatus,
      },
      {
        header: '服务类型',
        width: 14,
        value: (row) => serviceTypeLabels[row.serviceType] ?? row.serviceType,
      },
      { header: '预约开始', width: 22, value: (row) => row.appointmentStart },
      { header: '预约结束', width: 22, value: (row) => row.appointmentEnd },
      { header: '订单总额', width: 14, value: (row) => row.amountTotal },
      { header: '已付金额', width: 14, value: (row) => row.amountPaid },
      { header: '已退金额', width: 14, value: (row) => row.amountRefunded },
      { header: '净实收', width: 14, value: (row) => row.netPaid },
      { header: '支付单数', width: 12, value: (row) => row.paymentCount },
      { header: '支付单号', width: 36, value: (row) => row.paymentNos },
      { header: '退款单数', width: 12, value: (row) => row.refundCount },
      { header: '退款单号', width: 36, value: (row) => row.refundNos },
      {
        header: '最近退款状态',
        width: 16,
        value: (row) =>
          row.latestRefundStatus
            ? (refundStatusLabels[row.latestRefundStatus] ?? row.latestRefundStatus)
            : '',
      },
      { header: '最近退款审核时间', width: 22, value: (row) => row.latestRefundReviewedAt },
      { header: '投诉数', width: 10, value: (row) => row.complaintCount },
      { header: '评价星级', width: 10, value: (row) => row.reviewRating ?? '' },
      { header: '下单时间', width: 22, value: (row) => row.createdAt },
      { header: '关闭时间', width: 22, value: (row) => row.closedAt },
    ],
  }),
);

petpalRouter.get(
  '/orders/refunds/export',
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-owner-refunds'),
    sheetName: 'PetPal Owner Refunds',
    parseQuery: (query) => ownerRefundExportQuerySchema.parse(query ?? {}),
    queryRows: (query) => petpalService.listOwnerRefundExportRows(query),
    columns: [
      { header: '订单号', width: 24, value: (row) => row.orderNo },
      {
        header: '订单状态',
        width: 14,
        value: (row) => orderStatusLabels[row.orderStatus] ?? row.orderStatus,
      },
      {
        header: '服务类型',
        width: 14,
        value: (row) => serviceTypeLabels[row.serviceType] ?? row.serviceType,
      },
      { header: '预约开始', width: 22, value: (row) => row.appointmentStart },
      { header: '预约结束', width: 22, value: (row) => row.appointmentEnd },
      { header: '退款单号', width: 24, value: (row) => row.refundNo },
      {
        header: '退款类型',
        width: 14,
        value: (row) => refundTypeLabels[row.refundType] ?? row.refundType,
      },
      {
        header: '退款状态',
        width: 14,
        value: (row) => refundStatusLabels[row.refundStatus] ?? row.refundStatus,
      },
      { header: '退款金额', width: 14, value: (row) => row.refundAmount },
      { header: '退款原因', width: 36, value: (row) => row.refundReason },
      { header: '申请人', width: 24, value: (row) => row.applyUserId },
      { header: '审核人', width: 24, value: (row) => row.reviewedBy ?? '' },
      { header: '申请时间', width: 22, value: (row) => row.createdAt },
      { header: '审核时间', width: 22, value: (row) => row.reviewedAt },
      { header: '最后更新时间', width: 22, value: (row) => row.updatedAt },
    ],
  }),
);

petpalRouter.get(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const order = await petpalService.getOwnerOrderDetail(auth.id, String(req.params.id));
    return ok(res, order, 'Order detail');
  }),
);

petpalRouter.post(
  '/orders/:id/pay',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = payOrderSchema.parse(req.body);
    const order = await petpalService.payOwnerOrder(auth.id, String(req.params.id), payload);
    return ok(res, order, 'Order paid');
  }),
);

petpalRouter.get(
  '/orders/:id/messages',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const conversation = await petpalService.listOrderMessages(auth.id, String(req.params.id));
    return ok(res, conversation, 'Order messages');
  }),
);

petpalRouter.post(
  '/orders/:id/messages',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = orderMessageSchema.parse(req.body ?? {});
    const conversation = await petpalService.createOrderMessage(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, conversation, 'Order message created');
  }),
);

petpalRouter.post(
  '/orders/:id/messages/read',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const conversation = await petpalService.markOrderMessagesRead(auth.id, String(req.params.id));
    return ok(res, conversation, 'Order messages marked as read');
  }),
);

petpalRouter.get('/orders/:id/refunds/export', (req, res, next) => {
  const auth = req.auth!;
  const handler = createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-order-refunds'),
    sheetName: 'PetPal Order Refunds',
    parseQuery: (query) => ownerOrderRefundExportQuerySchema.parse(query ?? {}),
    queryRows: () => petpalService.listOwnerOrderRefundExportRows(auth.id, String(req.params.id)),
    columns: [
      { header: '订单号', width: 24, value: (row) => row.orderNo },
      { header: '退款单号', width: 24, value: (row) => row.refundNo },
      {
        header: '退款类型',
        width: 14,
        value: (row) => refundTypeLabels[row.refundType] ?? row.refundType,
      },
      {
        header: '退款状态',
        width: 14,
        value: (row) => refundStatusLabels[row.refundStatus] ?? row.refundStatus,
      },
      { header: '退款金额', width: 14, value: (row) => row.refundAmount },
      { header: '退款原因', width: 36, value: (row) => row.refundReason },
      { header: '申请人', width: 24, value: (row) => row.applyUserId },
      { header: '审核人', width: 24, value: (row) => row.reviewedBy ?? '' },
      { header: '申请时间', width: 22, value: (row) => row.createdAt },
      { header: '审核时间', width: 22, value: (row) => row.reviewedAt },
      { header: '最后更新时间', width: 22, value: (row) => row.updatedAt },
    ],
  });

  return handler(req, res, next);
});

petpalRouter.get(
  '/orders/:id/refund-progress',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const progress = await petpalService.getOwnerOrderRefundProgress(
      auth.id,
      String(req.params.id),
    );
    return ok(res, progress, 'Refund progress');
  }),
);

petpalRouter.post(
  '/orders/:id/confirm-complete',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const order = await petpalService.confirmOwnerOrderComplete(auth.id, String(req.params.id));
    return ok(res, order, 'Order completed');
  }),
);

petpalRouter.post(
  '/orders/:id/review',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = orderReviewSchema.parse(req.body ?? {});
    const order = await petpalService.createOwnerOrderReview(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, order, 'Order reviewed');
  }),
);

petpalRouter.get(
  '/orders/:id/complaints',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const complaints = await petpalService.listOwnerOrderComplaints(auth.id, String(req.params.id));
    return ok(res, complaints, 'Complaint list');
  }),
);

petpalRouter.post(
  '/orders/:id/complaints',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = orderComplaintSchema.parse(req.body ?? {});
    const complaint = await petpalService.createOwnerOrderComplaint(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, complaint, 'Complaint created');
  }),
);

petpalRouter.get(
  '/match/caregivers',
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = matchQuerySchema.parse(req.query);
    const result = await petpalService.listMatchedCaregivers({
      ...query,
      page,
      pageSize,
    });
    return ok(res, result, 'Matched caregivers');
  }),
);

petpalRouter.get(
  '/caregiver/profile',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const profile = await petpalService.getOrCreateCaregiverProfile(auth.id);
    return ok(res, profile, 'Caregiver profile');
  }),
);

petpalRouter.get(
  '/caregiver/earnings-summary',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const summary = await petpalService.getCaregiverEarningsSummary(auth.id);
    return ok(res, summary, 'Caregiver earnings summary');
  }),
);

petpalRouter.get(
  '/caregiver/earnings/export',
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-caregiver-earnings'),
    sheetName: 'PetPal Caregiver Earnings',
    parseQuery: (query) => caregiverEarningsExportQuerySchema.parse(query ?? {}),
    queryRows: (query) => petpalService.listCaregiverEarningsExportRows(query),
    columns: [
      { header: '订单号', width: 24, value: (row) => row.orderNo },
      {
        header: '服务类型',
        width: 14,
        value: (row) => serviceTypeLabels[row.serviceType] ?? row.serviceType,
      },
      { header: '主人昵称', width: 18, value: (row) => row.ownerNickname },
      { header: '宠物名', width: 16, value: (row) => row.petName ?? '' },
      { header: '服务地点', width: 28, value: (row) => row.locationText ?? '' },
      { header: '预约开始', width: 22, value: (row) => row.appointmentStart },
      { header: '预约结束', width: 22, value: (row) => row.appointmentEnd },
      {
        header: '订单状态',
        width: 14,
        value: (row) => orderStatusLabels[row.orderStatus] ?? row.orderStatus,
      },
      { header: '已付金额', width: 14, value: (row) => row.amountPaid },
      { header: '已退金额', width: 14, value: (row) => row.amountRefunded },
      { header: '净收入', width: 14, value: (row) => row.netIncome },
      { header: '关闭时间', width: 22, value: (row) => row.closedAt },
    ],
  }),
);

petpalRouter.get(
  '/caregiver/orders',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const { page, pageSize } = parsePagination(req.query);
    const query = caregiverOrderQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });

    const result = await petpalService.listCaregiverOrders({
      userId: auth.id,
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
      status: query.status,
    });

    return ok(res, result, 'Caregiver order list');
  }),
);

petpalRouter.put(
  '/caregiver/profile',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = caregiverProfileSchema.parse(req.body ?? {});
    const profile = await petpalService.upsertCaregiverProfile(auth.id, payload);
    return ok(res, profile, 'Caregiver profile updated');
  }),
);

petpalRouter.get(
  '/caregiver/services',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const services = await petpalService.listCaregiverServices(auth.id);
    return ok(res, services, 'Caregiver services');
  }),
);

petpalRouter.post(
  '/caregiver/services',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = caregiverServiceSchema.parse(req.body ?? {});
    const service = await petpalService.createCaregiverService(auth.id, payload);
    return ok(res, service, 'Caregiver service created');
  }),
);

petpalRouter.put(
  '/caregiver/services/:id',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = caregiverServiceSchema.parse(req.body ?? {});
    const service = await petpalService.updateCaregiverService(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, service, 'Caregiver service updated');
  }),
);

petpalRouter.post(
  '/caregiver/orders/:id/accept',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const order = await petpalService.acceptCaregiverOrder(auth.id, String(req.params.id));
    return ok(res, order, 'Order accepted');
  }),
);

petpalRouter.post(
  '/caregiver/orders/:id/check-in',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = caregiverOrderActionSchema.parse(req.body ?? {});
    const order = await petpalService.checkInCaregiverOrder(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, order, 'Order checked in');
  }),
);

petpalRouter.post(
  '/caregiver/orders/:id/service-logs',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = caregiverServiceLogSchema.parse(req.body ?? {});
    const order = await petpalService.addCaregiverServiceLog(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, order, 'Service log created');
  }),
);

petpalRouter.post(
  '/caregiver/orders/:id/check-out',
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = caregiverOrderActionSchema.parse(req.body ?? {});
    const order = await petpalService.checkOutCaregiverOrder(
      auth.id,
      String(req.params.id),
      payload,
    );
    return ok(res, order, 'Order checked out');
  }),
);

petpalRouter.get(
  '/admin/overview',
  requireAnyPermission(
    'petpal.complaint.read',
    'petpal.complaint.manage',
    'petpal.penalty.read',
    'petpal.penalty.manage',
    'petpal.caregiver.audit',
    'petpal.callback-audit.read',
    'petpal.callback-alert.read',
    'petpal.callback-alert.retry',
    'petpal.rule.read',
    'petpal.rule.publish',
  ),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const result = await petpalService.queryAdminOverview(auth.id, auth.permissions);
    return ok(res, result, 'PetPal admin overview');
  }),
);

petpalRouter.get(
  '/admin/rules',
  requirePermission('petpal.rule.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = platformRuleQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });

    const result = await petpalService.queryAdminPlatformRules({
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
      status: query.status,
      keyword: query.keyword,
    });

    return ok(res, result, 'Platform rule list');
  }),
);

petpalRouter.get(
  '/admin/rules/stats',
  requirePermission('petpal.rule.read'),
  asyncHandler(async (req, res) => {
    const query = platformRuleStatsQuerySchema.parse(req.query ?? {});
    const result = await petpalService.queryAdminPlatformRuleStats({
      status: query.status,
      keyword: query.keyword,
    });
    return ok(res, result, 'Platform rule stats');
  }),
);

petpalRouter.post(
  '/admin/rules',
  requirePermission('petpal.rule.publish'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = platformRulePayloadSchema.parse(req.body ?? {});
    const result = await petpalService.createAdminPlatformRule(auth.id, payload);
    return ok(res, result, 'Platform rule created');
  }),
);

petpalRouter.put(
  '/admin/rules/:id',
  requirePermission('petpal.rule.publish'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = platformRulePayloadSchema.parse(req.body ?? {});
    const result = await petpalService.updateAdminPlatformRule(String(req.params.id), auth.id, payload);
    return ok(res, result, 'Platform rule updated');
  }),
);

petpalRouter.post(
  '/admin/rules/:id/publish',
  requirePermission('petpal.rule.publish'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const result = await petpalService.publishAdminPlatformRule(String(req.params.id), auth.id);
    return ok(res, result, 'Platform rule published');
  }),
);

petpalRouter.post(
  '/admin/rules/:id/archive',
  requirePermission('petpal.rule.publish'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const result = await petpalService.archiveAdminPlatformRule(String(req.params.id), auth.id);
    return ok(res, result, 'Platform rule archived');
  }),
);

petpalRouter.post(
  '/admin/caregivers/:id/audit',
  requirePermission('petpal.caregiver.audit'),
  asyncHandler(async (req, res) => {
    const payload = caregiverAuditSchema.parse(req.body ?? {});
    const profile = await petpalService.auditCaregiverProfile(
      String(req.params.id),
      payload.status,
    );
    return ok(res, profile, 'Caregiver audited');
  }),
);

petpalRouter.get(
  '/admin/caregivers',
  requirePermission('petpal.caregiver.audit'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = caregiverAuditListQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });

    const result = await petpalService.queryCaregiverAuditList({
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
      auditStatus: query.auditStatus,
      city: query.city,
      keyword: query.keyword,
    });

    return ok(res, result, 'Caregiver audit list');
  }),
);

petpalRouter.get(
  '/admin/complaints',
  requirePermission('petpal.complaint.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = adminComplaintQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });

    const result = await petpalService.queryAdminComplaints({
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
      status: query.status,
      complaintType: query.complaintType,
      targetRole: query.targetRole,
      slaStatus: query.slaStatus,
      assignedAdminId: query.assignedAdminId,
      unassignedOnly: query.unassignedOnly,
      keyword: query.keyword,
    });

    return ok(res, result, 'Complaint admin list');
  }),
);

petpalRouter.get(
  '/admin/complaints/stats',
  requirePermission('petpal.complaint.read'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const query = adminComplaintStatsQuerySchema.parse(req.query ?? {});
    const result = await petpalService.queryAdminComplaintStats(query, auth.id);
    return ok(res, result, 'Complaint admin stats');
  }),
);

petpalRouter.post(
  '/admin/complaints/:id/actions',
  requirePermission('petpal.complaint.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminComplaintActionSchema.parse(req.body ?? {});
    if (payload.actionType === 'PENALTY' && !auth.permissions.includes('petpal.penalty.manage')) {
      throw forbidden('Missing permission: petpal.penalty.manage');
    }
    const complaint = await petpalService.handleAdminComplaint(
      String(req.params.id),
      auth.id,
      payload,
    );
    return ok(res, complaint, 'Complaint updated');
  }),
);

petpalRouter.post(
  '/admin/complaints/batch-assign',
  requirePermission('petpal.complaint.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminComplaintBatchAssignSchema.parse(req.body ?? {});
    const result = await petpalService.batchAssignAdminComplaints(auth.id, payload);
    return ok(res, result, 'Complaints batch assigned');
  }),
);

petpalRouter.post(
  '/admin/complaints/batch-close',
  requirePermission('petpal.complaint.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminComplaintBatchCloseSchema.parse(req.body ?? {});
    const result = await petpalService.batchCloseAdminComplaints(auth.id, payload);
    return ok(res, result, 'Complaints batch closed');
  }),
);

petpalRouter.get(
  '/admin/penalty-templates',
  requireAnyPermission('petpal.penalty.read', 'petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = penaltyTemplateQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });

    const result = await petpalService.queryAdminPenaltyTemplates({
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
      targetRole: query.targetRole,
      penaltyType: query.penaltyType,
      severity: query.severity,
      isActive: query.isActive,
      keyword: query.keyword,
    });
    return ok(res, result, 'Penalty template list');
  }),
);

petpalRouter.get(
  '/admin/penalty-templates/stats',
  requireAnyPermission('petpal.penalty.read', 'petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const query = penaltyTemplateStatsQuerySchema.parse(req.query ?? {});
    const result = await petpalService.queryAdminPenaltyTemplateStats({
      targetRole: query.targetRole,
      penaltyType: query.penaltyType,
      severity: query.severity,
      isActive: query.isActive,
      keyword: query.keyword,
    });
    return ok(res, result, 'Penalty template stats');
  }),
);

petpalRouter.post(
  '/admin/penalty-templates',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = penaltyTemplatePayloadSchema.parse(req.body ?? {});
    const template = await petpalService.createAdminPenaltyTemplate(auth.id, payload);
    return ok(res, template, 'Penalty template created');
  }),
);

petpalRouter.put(
  '/admin/penalty-templates/:id',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = penaltyTemplatePayloadSchema.parse(req.body ?? {});
    const template = await petpalService.updateAdminPenaltyTemplate(
      String(req.params.id),
      auth.id,
      payload,
    );
    return ok(res, template, 'Penalty template updated');
  }),
);

petpalRouter.post(
  '/admin/penalty-templates/:id/status',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = penaltyTemplateStatusSchema.parse(req.body ?? {});
    const template = await petpalService.setAdminPenaltyTemplateStatus(
      String(req.params.id),
      auth.id,
      payload.isActive,
    );
    return ok(res, template, 'Penalty template status updated');
  }),
);

petpalRouter.get(
  '/admin/penalties',
  requireAnyPermission('petpal.penalty.read', 'petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = adminPenaltyQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });

    const result = await petpalService.queryAdminPenalties({
      page: query.page ?? page,
      pageSize: query.pageSize ?? pageSize,
      targetRole: query.targetRole,
      penaltyType: query.penaltyType,
      severity: query.severity,
      rectifyStatus: query.rectifyStatus,
      rectifyReviewStatus: query.rectifyReviewStatus,
      appealStatus: query.appealStatus,
      overdueOnly: query.overdueOnly,
      keyword: query.keyword,
    });
    return ok(res, result, 'Penalty admin list');
  }),
);

petpalRouter.get(
  '/admin/penalties/stats',
  requireAnyPermission('petpal.penalty.read', 'petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const query = adminPenaltyStatsQuerySchema.parse(req.query ?? {});
    const result = await petpalService.queryAdminPenaltyStats({
      targetRole: query.targetRole,
      penaltyType: query.penaltyType,
      severity: query.severity,
      rectifyStatus: query.rectifyStatus,
      rectifyReviewStatus: query.rectifyReviewStatus,
      appealStatus: query.appealStatus,
      overdueOnly: query.overdueOnly,
      keyword: query.keyword,
    });
    return ok(res, result, 'Penalty admin stats');
  }),
);

petpalRouter.post(
  '/admin/penalties/:id/rectify',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminPenaltyRectifySchema.parse(req.body ?? {});
    const penalty = await petpalService.rectifyAdminPenalty(String(req.params.id), auth.id, payload);
    return ok(res, penalty, 'Penalty updated');
  }),
);

petpalRouter.post(
  '/admin/penalties/:id/appeal',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminPenaltyAppealSchema.parse(req.body ?? {});
    const penalty = await petpalService.submitAdminPenaltyAppeal(
      String(req.params.id),
      auth.id,
      payload,
    );
    return ok(res, penalty, 'Penalty appeal submitted');
  }),
);

petpalRouter.post(
  '/admin/penalties/:id/appeal/review',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminPenaltyAppealReviewSchema.parse(req.body ?? {});
    const penalty = await petpalService.reviewAdminPenaltyAppeal(
      String(req.params.id),
      auth.id,
      payload,
    );
    return ok(res, penalty, 'Penalty appeal reviewed');
  }),
);

petpalRouter.post(
  '/admin/penalties/:id/rectify/review',
  requirePermission('petpal.penalty.manage'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const payload = adminPenaltyRectifyReviewSchema.parse(req.body ?? {});
    const penalty = await petpalService.reviewAdminPenaltyRectify(
      String(req.params.id),
      auth.id,
      payload,
    );
    return ok(res, penalty, 'Penalty rectification reviewed');
  }),
);

// Admin endpoints (require authentication)
petpalRouter.get(
  '/admin/callback-audits',
  requirePermission('petpal.callback-audit.read'),
  asyncHandler(async (req, res) => {
    // Note: In production, add role/permission check here
    const { page, pageSize } = parsePagination(req.query);
    const filterQuery = parseCallbackAuditQuery(req.query as Record<string, unknown>);

    const result = await petpalService.queryCallbackAuditLogs({
      page,
      pageSize,
      ...filterQuery,
    });
    return ok(res, result, 'Callback audit logs');
  }),
);

petpalRouter.get(
  '/admin/callback-audits/stats',
  requirePermission('petpal.callback-audit.read'),
  asyncHandler(async (req, res) => {
    const filters = parseCallbackAuditQuery(req.query as Record<string, unknown>);
    const result = await petpalService.queryCallbackAuditStats(filters);
    return ok(res, result, 'Callback audit stats');
  }),
);

petpalRouter.get(
  '/admin/callback-audits/export',
  requirePermission('petpal.callback-audit.export'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-callback-audits'),
    sheetName: 'PetPal Callback Audits',
    parseQuery: (query) => parseCallbackAuditQuery(query as Record<string, unknown>),
    queryRows: (query) => petpalService.listCallbackAuditExportRows(query),
    columns: [
      { header: '回调类型', width: 16, value: (row) => row.callbackType },
      { header: '回调状态', width: 14, value: (row) => row.callbackStatus },
      { header: '验证来源', width: 18, value: (row) => row.sourceMode },
      { header: 'RequestId', width: 28, value: (row) => row.requestId },
      { header: '支付单号', width: 22, value: (row) => row.payment?.payNo ?? '' },
      { header: '退款单号', width: 22, value: (row) => row.refund?.refundNo ?? '' },
      { header: '签名摘要', width: 28, value: (row) => row.signatureDigest },
      { header: '回调时间', width: 24, value: (row) => row.callbackTimestamp },
      { header: '创建时间', width: 24, value: (row) => row.createdAt },
      { header: '原始载荷', width: 60, value: (row) => row.rawPayload },
    ],
  }),
);

petpalRouter.get(
  '/admin/callback-alert-outbox',
  requirePermission('petpal.callback-alert.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const filters = parseCallbackAlertOutboxQuery(req.query as Record<string, unknown>);
    const result = await petpalService.queryCallbackAlertOutboxes({
      page,
      pageSize,
      ...filters,
    });
    return ok(res, result, 'Callback alert outbox list');
  }),
);

petpalRouter.get(
  '/admin/callback-alert-outbox/stats',
  requirePermission('petpal.callback-alert.read'),
  asyncHandler(async (req, res) => {
    const filters = parseCallbackAlertOutboxQuery(req.query as Record<string, unknown>);
    const result = await petpalService.queryCallbackAlertOutboxStats(filters);
    return ok(res, result, 'Callback alert outbox stats');
  }),
);

petpalRouter.get(
  '/admin/callback-alert-outbox/:id/replay-logs',
  requirePermission('petpal.callback-alert.read'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = parsePagination(req.query);
    const query = callbackAlertOutboxReplayLogQuerySchema.parse({
      ...req.query,
      page,
      pageSize,
    });
    const result = await petpalService.listCallbackAlertReplayLogs(
      String(req.params.id),
      query.page,
      query.pageSize,
      {
        actionType: query.actionType,
        actorId: query.actorId,
        startDate: query.startDate,
        endDate: query.endDate,
      },
    );
    return ok(res, result, 'Callback alert outbox replay logs');
  }),
);

petpalRouter.get(
  '/admin/callback-alert-outbox/:id/replay-logs/stats',
  requirePermission('petpal.callback-alert.read'),
  asyncHandler(async (req, res) => {
    const query = callbackAlertOutboxReplayLogStatsQuerySchema.parse(req.query ?? {});
    const result = await petpalService.queryCallbackAlertReplayLogStats(String(req.params.id), {
      actionType: query.actionType,
      actorId: query.actorId,
      startDate: query.startDate,
      endDate: query.endDate,
      dominanceThreshold: query.dominanceThreshold,
      dominanceMinSamples: query.dominanceMinSamples,
      staleThresholdMinutes: query.staleThresholdMinutes,
    });
    return ok(res, result, 'Callback alert outbox replay log stats');
  }),
);

petpalRouter.get(
  '/admin/callback-alert-outbox/replay-logs/export',
  requirePermission('petpal.callback-alert.export'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-callback-alert-replay-logs'),
    sheetName: 'PetPal Callback Alert Replay Logs',
    parseQuery: (query) => callbackAlertOutboxReplayLogExportQuerySchema.parse(query ?? {}),
    queryRows: (query) =>
      petpalService.listCallbackAlertReplayLogExportRows(String(query.outboxId), {
        actionType: query.actionType,
        actorId: query.actorId,
        startDate: query.startDate,
        endDate: query.endDate,
      }),
    columns: [
      { header: 'Outbox ID', width: 26, value: (row) => row.callbackOutboxId },
      { header: '动作', width: 20, value: (row) => row.actionType },
      { header: '操作人', width: 30, value: (row) => row.actorId ?? '' },
      { header: '说明', width: 40, value: (row) => row.note ?? '' },
      { header: '创建时间', width: 24, value: (row) => row.createdAt },
    ],
  }),
);

petpalRouter.post(
  '/admin/callback-alert-outbox/:id/retry',
  requirePermission('petpal.callback-alert.retry'),
  asyncHandler(async (req, res) => {
    const result = await petpalService.retryCallbackAlertOutbox(String(req.params.id), {
      actorId: req.auth?.id ?? null,
    });
    return ok(res, result, 'Callback alert outbox requeued');
  }),
);

petpalRouter.post(
  '/admin/callback-alert-outbox/retry-dead',
  requirePermission('petpal.callback-alert.retry'),
  asyncHandler(async (req, res) => {
    const payload = callbackAlertOutboxRetryDeadSchema.parse(req.body ?? {});
    const result = await petpalService.retryDeadCallbackAlertOutboxes(payload.limit ?? 50, {
      actorId: req.auth?.id ?? null,
    });
    return ok(res, result, 'Callback alert outbox dead records requeued');
  }),
);

export { petpalRouter };
