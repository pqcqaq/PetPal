import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middlewares/auth';
import { asyncHandler, ok, parsePagination } from '../utils/http';
import { petpalService } from '../services/petpal-service';
import { verifyPetpalCallbackAuth } from '../services/petpal-callback-auth';

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

petpalRouter.post('/payments/callback', asyncHandler(async (req, res) => {
  verifyPetpalCallbackAuth(req.headers, JSON.stringify(req.body ?? {}));
  const payload = paymentCallbackSchema.parse(req.body);
  const result = await petpalService.handlePaymentCallback(payload);
  return ok(res, result, 'Payment callback handled');
}));

petpalRouter.post('/refunds/callback', asyncHandler(async (req, res) => {
  verifyPetpalCallbackAuth(req.headers, JSON.stringify(req.body ?? {}));
  const payload = refundCallbackSchema.parse(req.body);
  const result = await petpalService.handleRefundCallback(payload);
  return ok(res, result, 'Refund callback handled');
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

export { petpalRouter };
