import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { asyncHandler, ok, parsePagination } from '../utils/http';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';
import { petpalService } from '../services/petpal-service';
import { verifyPetpalCallbackAuth } from '../services/petpal-callback-auth';
import { getRequestId } from '../utils/request-context';

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

const petSchema = z.object({
  name: z.string().trim().min(1).max(50),
  species: z.enum(['DOG', 'CAT', 'OTHER']),
  breed: z.string().trim().max(50).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).optional(),
  weightKg: z.number().positive().max(500).optional(),
  neutered: z.boolean().optional(),
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

const matchQuerySchema = z.object({
  serviceType: z.enum(['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']),
  petSpecies: z.enum(['DOG', 'CAT', 'OTHER']),
  city: z.string().trim().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

const caregiverProfileSchema = z.object({
  intro: z.string().trim().max(1000).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).optional(),
  serviceRadiusKm: z.coerce.number().int().min(1).max(100).optional(),
  serviceCity: z.string().trim().max(50).optional(),
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

const callbackAlertOutboxReplayLogExportQuerySchema = callbackAlertOutboxReplayLogQuerySchema.extend({
  outboxId: z.string().trim().min(1),
});

const callbackAlertOutboxReplayLogStatsQuerySchema = callbackAlertOutboxReplayLogQuerySchema.extend({
  dominanceThreshold: z.coerce.number().min(0.1).max(1).optional(),
  dominanceMinSamples: z.coerce.number().int().min(1).max(100).optional(),
  staleThresholdMinutes: z.coerce.number().int().min(1).max(10080).optional(),
});

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

petpalRouter.post('/payments/callback', asyncHandler(async (req, res) => {
  const authMeta = verifyPetpalCallbackAuth(req.headers, req.rawBody ?? JSON.stringify(req.body ?? {}));
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
  return ok(res, {
    ...result,
    callbackAuth: {
      ...authMeta,
      requestId,
    },
  }, 'Payment callback handled');
}));

petpalRouter.post('/refunds/callback', asyncHandler(async (req, res) => {
  const authMeta = verifyPetpalCallbackAuth(req.headers, req.rawBody ?? JSON.stringify(req.body ?? {}));
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
  return ok(res, {
    ...result,
    callbackAuth: {
      ...authMeta,
      requestId,
    },
  }, 'Refund callback handled');
}));

petpalRouter.use(authMiddleware);

petpalRouter.get('/pets', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const pets = await petpalService.listPets(auth.id);
  return ok(res, pets, 'Pet list');
}));

petpalRouter.post('/pets', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = petSchema.parse(req.body);
  const pet = await petpalService.createPet(auth.id, payload);
  return ok(res, pet, 'Pet created');
}));

petpalRouter.get('/requests', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const requests = await petpalService.listOwnerRequests(auth.id);
  return ok(res, requests, 'Request list');
}));

petpalRouter.post('/requests', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = requestSchema.parse(req.body);
  const requestRecord = await petpalService.createRequest(auth.id, payload);
  return ok(res, requestRecord, 'Request created');
}));

petpalRouter.get('/orders', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const orders = await petpalService.listOwnerOrders(auth.id);
  return ok(res, orders, 'Order list');
}));

petpalRouter.get('/orders/:id', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const order = await petpalService.getOwnerOrderDetail(auth.id, String(req.params.id));
  return ok(res, order, 'Order detail');
}));

petpalRouter.post('/orders/:id/confirm-complete', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const order = await petpalService.confirmOwnerOrderComplete(auth.id, String(req.params.id));
  return ok(res, order, 'Order completed');
}));

petpalRouter.post('/orders/:id/review', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = orderReviewSchema.parse(req.body ?? {});
  const order = await petpalService.createOwnerOrderReview(auth.id, String(req.params.id), payload);
  return ok(res, order, 'Order reviewed');
}));

petpalRouter.get('/match/caregivers', asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const query = matchQuerySchema.parse(req.query);
  const result = await petpalService.listMatchedCaregivers({
    ...query,
    page,
    pageSize,
  });
  return ok(res, result, 'Matched caregivers');
}));

petpalRouter.get('/caregiver/profile', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const profile = await petpalService.getOrCreateCaregiverProfile(auth.id);
  return ok(res, profile, 'Caregiver profile');
}));

petpalRouter.get('/caregiver/orders', asyncHandler(async (req, res) => {
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
}));

petpalRouter.put('/caregiver/profile', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = caregiverProfileSchema.parse(req.body ?? {});
  const profile = await petpalService.upsertCaregiverProfile(auth.id, payload);
  return ok(res, profile, 'Caregiver profile updated');
}));

petpalRouter.get('/caregiver/services', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const services = await petpalService.listCaregiverServices(auth.id);
  return ok(res, services, 'Caregiver services');
}));

petpalRouter.post('/caregiver/services', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = caregiverServiceSchema.parse(req.body ?? {});
  const service = await petpalService.createCaregiverService(auth.id, payload);
  return ok(res, service, 'Caregiver service created');
}));

petpalRouter.put('/caregiver/services/:id', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = caregiverServiceSchema.parse(req.body ?? {});
  const service = await petpalService.updateCaregiverService(auth.id, String(req.params.id), payload);
  return ok(res, service, 'Caregiver service updated');
}));

petpalRouter.post('/caregiver/orders/:id/accept', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const order = await petpalService.acceptCaregiverOrder(auth.id, String(req.params.id));
  return ok(res, order, 'Order accepted');
}));

petpalRouter.post('/caregiver/orders/:id/check-in', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = caregiverOrderActionSchema.parse(req.body ?? {});
  const order = await petpalService.checkInCaregiverOrder(auth.id, String(req.params.id), payload);
  return ok(res, order, 'Order checked in');
}));

petpalRouter.post('/caregiver/orders/:id/service-logs', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = caregiverServiceLogSchema.parse(req.body ?? {});
  const order = await petpalService.addCaregiverServiceLog(auth.id, String(req.params.id), payload);
  return ok(res, order, 'Service log created');
}));

petpalRouter.post('/caregiver/orders/:id/check-out', asyncHandler(async (req, res) => {
  const auth = req.auth!;
  const payload = caregiverOrderActionSchema.parse(req.body ?? {});
  const order = await petpalService.checkOutCaregiverOrder(auth.id, String(req.params.id), payload);
  return ok(res, order, 'Order checked out');
}));

petpalRouter.post('/admin/caregivers/:id/audit', requirePermission('petpal.caregiver.audit'), asyncHandler(async (req, res) => {
  const payload = caregiverAuditSchema.parse(req.body ?? {});
  const profile = await petpalService.auditCaregiverProfile(String(req.params.id), payload.status);
  return ok(res, profile, 'Caregiver audited');
}));

petpalRouter.get('/admin/caregivers', requirePermission('petpal.caregiver.audit'), asyncHandler(async (req, res) => {
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
}));

// Admin endpoints (require authentication)
petpalRouter.get('/admin/callback-audits', requirePermission('petpal.callback-audit.read'), asyncHandler(async (req, res) => {
  // Note: In production, add role/permission check here
  const { page, pageSize } = parsePagination(req.query);
  const filterQuery = parseCallbackAuditQuery(req.query as Record<string, unknown>);

  const result = await petpalService.queryCallbackAuditLogs({
    page,
    pageSize,
    ...filterQuery,
  });
  return ok(res, result, 'Callback audit logs');
}));

petpalRouter.get('/admin/callback-audits/stats', requirePermission('petpal.callback-audit.read'), asyncHandler(async (req, res) => {
  const filters = parseCallbackAuditQuery(req.query as Record<string, unknown>);
  const result = await petpalService.queryCallbackAuditStats(filters);
  return ok(res, result, 'Callback audit stats');
}));

petpalRouter.get(
  '/admin/callback-audits/export',
  requirePermission('petpal.callback-audit.export'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-callback-audits'),
    sheetName: 'PetPal Callback Audits',
    parseQuery: (query) => parseCallbackAuditQuery(query as Record<string, unknown>),
    queryRows: (query) => petpalService.listCallbackAuditExportRows(query),
    columns: [
      { header: '回调类型', width: 16, value: row => row.callbackType },
      { header: '回调状态', width: 14, value: row => row.callbackStatus },
      { header: '验证来源', width: 18, value: row => row.sourceMode },
      { header: 'RequestId', width: 28, value: row => row.requestId },
      { header: '支付单号', width: 22, value: row => row.payment?.payNo ?? '' },
      { header: '退款单号', width: 22, value: row => row.refund?.refundNo ?? '' },
      { header: '签名摘要', width: 28, value: row => row.signatureDigest },
      { header: '回调时间', width: 24, value: row => row.callbackTimestamp },
      { header: '创建时间', width: 24, value: row => row.createdAt },
      { header: '原始载荷', width: 60, value: row => row.rawPayload },
    ],
  }),
);

petpalRouter.get('/admin/callback-alert-outbox', requirePermission('petpal.callback-alert.read'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const filters = parseCallbackAlertOutboxQuery(req.query as Record<string, unknown>);
  const result = await petpalService.queryCallbackAlertOutboxes({
    page,
    pageSize,
    ...filters,
  });
  return ok(res, result, 'Callback alert outbox list');
}));

petpalRouter.get('/admin/callback-alert-outbox/stats', requirePermission('petpal.callback-alert.read'), asyncHandler(async (req, res) => {
  const filters = parseCallbackAlertOutboxQuery(req.query as Record<string, unknown>);
  const result = await petpalService.queryCallbackAlertOutboxStats(filters);
  return ok(res, result, 'Callback alert outbox stats');
}));

petpalRouter.get('/admin/callback-alert-outbox/:id/replay-logs', requirePermission('petpal.callback-alert.read'), asyncHandler(async (req, res) => {
  const { page, pageSize } = parsePagination(req.query);
  const query = callbackAlertOutboxReplayLogQuerySchema.parse({
    ...req.query,
    page,
    pageSize,
  });
  const result = await petpalService.listCallbackAlertReplayLogs(String(req.params.id), query.page, query.pageSize, {
    actionType: query.actionType,
    actorId: query.actorId,
    startDate: query.startDate,
    endDate: query.endDate,
  });
  return ok(res, result, 'Callback alert outbox replay logs');
}));

petpalRouter.get('/admin/callback-alert-outbox/:id/replay-logs/stats', requirePermission('petpal.callback-alert.read'), asyncHandler(async (req, res) => {
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
}));

petpalRouter.get(
  '/admin/callback-alert-outbox/replay-logs/export',
  requirePermission('petpal.callback-alert.export'),
  createExcelExportHandler({
    fileName: () => createTimestampedExcelFileName('petpal-callback-alert-replay-logs'),
    sheetName: 'PetPal Callback Alert Replay Logs',
    parseQuery: (query) => callbackAlertOutboxReplayLogExportQuerySchema.parse(query ?? {}),
    queryRows: (query) => petpalService.listCallbackAlertReplayLogExportRows(String(query.outboxId), {
      actionType: query.actionType,
      actorId: query.actorId,
      startDate: query.startDate,
      endDate: query.endDate,
    }),
    columns: [
      { header: 'Outbox ID', width: 26, value: row => row.callbackOutboxId },
      { header: '动作', width: 20, value: row => row.actionType },
      { header: '操作人', width: 30, value: row => row.actorId ?? '' },
      { header: '说明', width: 40, value: row => row.note ?? '' },
      { header: '创建时间', width: 24, value: row => row.createdAt },
    ],
  }),
);

petpalRouter.post('/admin/callback-alert-outbox/:id/retry', requirePermission('petpal.callback-alert.retry'), asyncHandler(async (req, res) => {
  const result = await petpalService.retryCallbackAlertOutbox(String(req.params.id), {
    actorId: req.auth?.id ?? null,
  });
  return ok(res, result, 'Callback alert outbox requeued');
}));

petpalRouter.post('/admin/callback-alert-outbox/retry-dead', requirePermission('petpal.callback-alert.retry'), asyncHandler(async (req, res) => {
  const payload = callbackAlertOutboxRetryDeadSchema.parse(req.body ?? {});
  const result = await petpalService.retryDeadCallbackAlertOutboxes(payload.limit ?? 50, {
    actorId: req.auth?.id ?? null,
  });
  return ok(res, result, 'Callback alert outbox dead records requeued');
}));

export { petpalRouter };
