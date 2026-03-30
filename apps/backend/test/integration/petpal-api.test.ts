import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
} from '../support/backend-testkit';

let context: BackendTestContext;

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('PetPal API integration', () => {
  it('supports owner pet and request workflow', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const listPetsResponse = await request(app)
      .get('/api/petpal/pets')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(listPetsResponse.body.data.length >= 1);

    const newPetResponse = await request(app)
      .post('/api/petpal/pets')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        name: '雪球',
        species: 'CAT',
        breed: '英短',
        gender: 'FEMALE',
        weightKg: 4.2,
      })
      .expect(200);

    assert.equal(newPetResponse.body.data.name, '雪球');
    assert.equal(newPetResponse.body.data.species, 'CAT');

    const createdPetId = newPetResponse.body.data.id as string;

    const createRequestResponse = await request(app)
      .post('/api/petpal/requests')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        petId: createdPetId,
        serviceType: 'FEEDING',
        startTime: '2026-04-02T08:00:00.000Z',
        endTime: '2026-04-02T09:00:00.000Z',
        locationText: '杭州市西湖区',
        locationLat: 30.25,
        locationLng: 120.12,
        budgetAmount: 60,
        demandTags: ['cat', 'morning'],
      })
      .expect(200);

    assert.equal(createRequestResponse.body.data.status, 'OPEN');

    const requestRecord = await prisma.serviceRequest.findUnique({
      where: {
        id: createRequestResponse.body.data.id,
      },
      select: {
        ownerId: true,
        petId: true,
      },
    });

    assert.ok(requestRecord);
    assert.equal(requestRecord.petId, createdPetId);

    const listRequestsResponse = await request(app)
      .get('/api/petpal/requests')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(
      listRequestsResponse.body.data.some((item: { id: string }) => item.id === createRequestResponse.body.data.id),
    );
  });

  it('supports caregiver matching and owner order detail', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const matchResponse = await request(app)
      .get('/api/petpal/match/caregivers')
      .query({
        page: 1,
        pageSize: 10,
        serviceType: 'WALKING',
        petSpecies: 'DOG',
        city: '杭州',
        lat: 30.25,
        lng: 120.18,
      })
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(matchResponse.body.data.meta.total >= 1);
    assert.ok(matchResponse.body.data.items[0].distanceKm !== null);

    const ordersResponse = await request(app)
      .get('/api/petpal/orders')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(ordersResponse.body.data.length, 1);
    const orderId = ordersResponse.body.data[0].id as string;

    const orderDetailResponse = await request(app)
      .get(`/api/petpal/orders/${orderId}`)
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(orderDetailResponse.body.data.payments.length, 2);
    assert.equal(orderDetailResponse.body.data.refunds.length, 1);

    const order = await prisma.orderMain.findUnique({
      where: { id: orderId },
      select: {
        amountTotal: true,
        amountAdjusted: true,
        amountPaid: true,
        amountRefunded: true,
      },
    });

    assert.ok(order);
    const amountTotal = Number(order.amountTotal);
    const amountAdjusted = Number(order.amountAdjusted);
    const amountPaid = Number(order.amountPaid);
    const amountRefunded = Number(order.amountRefunded);

    assert.ok(amountPaid - amountRefunded >= 0);
    assert.ok(amountPaid >= amountTotal + amountAdjusted - amountRefunded);
  });

  it('handles payment and refund callbacks with idempotency', async () => {
    const { app, prisma } = context;

    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: {
        id: true,
        ownerId: true,
      },
    });
    assert.ok(baseOrder);

    const callbackPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-callback-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-CB-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 5,
      },
    });

    const paymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: callbackPayment.payNo,
        channelTxnId: `WXTXN-CB-${Date.now()}`,
        success: true,
        paidAmount: 5,
      })
      .expect(200);

    assert.equal(paymentCallback.body.data.idempotent, false);
    assert.equal(paymentCallback.body.data.callbackAuth.sourceMode, 'TOKEN');
    assert.ok(typeof paymentCallback.body.data.callbackAuth.signatureDigest === 'string');
    assert.ok(typeof paymentCallback.body.data.callbackAuth.requestId === 'string');

    const persistedPayment = await prisma.paymentRecord.findUnique({
      where: {
        payNo: callbackPayment.payNo,
      },
      select: {
        channelTxnId: true,
      },
    });

    assert.ok(persistedPayment?.channelTxnId);

    const idempotentPaymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: callbackPayment.payNo,
        channelTxnId: persistedPayment.channelTxnId,
        success: true,
        paidAmount: 5,
      })
      .expect(200);

    assert.equal(idempotentPaymentCallback.body.data.idempotent, true);

    const retryPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-retry-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-RETRY-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 8,
      },
    });

    const failedPaymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: retryPayment.payNo,
        channelTxnId: `WXTXN-FAIL-${Date.now()}`,
        success: false,
      })
      .expect(200);

    assert.equal(failedPaymentCallback.body.data.idempotent, false);
    assert.equal(failedPaymentCallback.body.data.payStatus, 'FAILED');

    const recoveredPaymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: retryPayment.payNo,
        channelTxnId: `WXTXN-RECOVER-${Date.now()}`,
        success: true,
        paidAmount: 8,
      })
      .expect(200);

    assert.equal(recoveredPaymentCallback.body.data.idempotent, false);
    assert.equal(recoveredPaymentCallback.body.data.payStatus, 'PAID');

    const refund = await prisma.refundRecord.findUnique({
      where: {
        refundNo: 'REF202603300001',
      },
      select: {
        refundNo: true,
      },
    });

    assert.ok(refund);

    const refundCallback = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: refund.refundNo,
        channelRefundId: `WXREF-CB-${Date.now()}`,
        success: true,
      })
      .expect(200);

    assert.equal(typeof refundCallback.body.data.idempotent, 'boolean');
    assert.equal(refundCallback.body.data.callbackAuth.sourceMode, 'TOKEN');
    assert.ok(typeof refundCallback.body.data.callbackAuth.signatureDigest === 'string');

    const retryRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-retry-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        paymentId: retryPayment.id,
        refundNo: `REF-RETRY-${Date.now()}`,
        applyUserId: baseOrder.ownerId,
        refundType: 'PARTIAL',
        refundReason: 'retry case',
        refundAmount: 2,
        refundStatus: 'PENDING',
      },
    });

    const failedRefundCallback = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: retryRefund.refundNo,
        channelRefundId: `WXREF-FAIL-${Date.now()}`,
        success: false,
      })
      .expect(200);

    assert.equal(failedRefundCallback.body.data.idempotent, false);
    assert.equal(failedRefundCallback.body.data.refundStatus, 'FAILED');

    const recoveredRefundCallback = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: retryRefund.refundNo,
        channelRefundId: `WXREF-RECOVER-${Date.now()}`,
        success: true,
      })
      .expect(200);

    assert.equal(recoveredRefundCallback.body.data.idempotent, false);
    assert.equal(recoveredRefundCallback.body.data.refundStatus, 'SUCCESS');

    const order = await prisma.orderMain.findUnique({
      where: {
        id: baseOrder.id,
      },
      select: {
        amountTotal: true,
        amountAdjusted: true,
        amountPaid: true,
        amountRefunded: true,
      },
    });

    assert.ok(order);
    const amountTotal = Number(order.amountTotal);
    const amountAdjusted = Number(order.amountAdjusted);
    const amountPaid = Number(order.amountPaid);
    const amountRefunded = Number(order.amountRefunded);
    assert.ok(amountPaid - amountRefunded >= 0);
    assert.ok(amountPaid >= amountTotal + amountAdjusted - amountRefunded);
  });
});
