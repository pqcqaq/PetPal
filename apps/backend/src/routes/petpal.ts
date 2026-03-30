import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/require-permission';
import { asyncHandler, ok, parsePagination } from '../utils/http';
import { createExcelExportHandler, createTimestampedExcelFileName } from '../utils/excel-export';
import { petpalService } from '../services/petpal-service';
import { verifyPetpalCallbackAuth } from '../services/petpal-callback-auth';
import { getRequestId } from '../utils/request-context';

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
  requirePermission('petpal.callback-audit.read'),
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

export { petpalRouter };
