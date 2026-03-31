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

    const failedPaymentAudit = await prisma.callbackAudit.findFirst({
      where: {
        paymentId: retryPayment.id,
        callbackType: 'PAYMENT_CALLBACK',
        callbackStatus: 'FAILURE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });
    assert.ok(failedPaymentAudit);

    const paymentOutbox = await prisma.callbackAlertOutbox.findFirst({
      where: {
        callbackAuditId: failedPaymentAudit.id,
      },
      select: {
        status: true,
      },
    });
    assert.ok(paymentOutbox);
    assert.equal(paymentOutbox.status, 'PENDING');

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

    const failedRefundAudit = await prisma.callbackAudit.findFirst({
      where: {
        refundId: retryRefund.id,
        callbackType: 'REFUND_CALLBACK',
        callbackStatus: 'FAILURE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });
    assert.ok(failedRefundAudit);

    const refundOutbox = await prisma.callbackAlertOutbox.findFirst({
      where: {
        callbackAuditId: failedRefundAudit.id,
      },
      select: {
        status: true,
      },
    });
    assert.ok(refundOutbox);
    assert.equal(refundOutbox.status, 'PENDING');

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

  it('persists callback audit records for payment and refund callbacks', async () => {
    const { app, prisma } = context;

    // Setup: Get existing order from seed data
    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: {
        id: true,
        ownerId: true,
        caregiverId: true,
      },
    });
    assert.ok(baseOrder, 'Base order should exist from seed data');

    const auditPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-audit-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-AUDIT-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 100,
      },
    });

    // Execute: Send payment callback
    const channelTxnId = `WXTXN-AUDIT-${Date.now()}`;
    const paymentCallbackResponse = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: auditPayment.payNo,
        channelTxnId,
        success: true,
        paidAmount: 100,
      })
      .expect(200);

    // Verify: Payment callback audit record exists
    const paymentAudit = await prisma.callbackAudit.findFirst({
      where: {
        paymentId: auditPayment.id,
        callbackType: 'PAYMENT_CALLBACK',
      },
    });

    assert.ok(paymentAudit, 'Payment audit record should exist');
    assert.equal(paymentAudit.callbackStatus, 'SUCCESS', 'Payment audit status should be SUCCESS');
    assert.equal(paymentAudit.sourceMode, 'TOKEN', 'Payment audit should use TOKEN source mode');
    assert.ok(paymentAudit.signatureDigest, 'Payment audit should have signature digest');
    assert.ok(paymentAudit.requestId, 'Payment audit should have requestId');
    assert.ok(paymentAudit.rawPayload, 'Payment audit should have raw payload');
    assert.ok(paymentAudit.verificationResult, 'Payment audit should have verification result');

    // Verify: Idempotent callback also creates audit record
    const idempotentAuditResponse = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: auditPayment.payNo,
        channelTxnId,
        success: true,
        paidAmount: 100,
      })
      .expect(200);

    assert.equal(idempotentAuditResponse.body.data.idempotent, true);

    const idempotentAudits = await prisma.callbackAudit.findMany({
      where: {
        paymentId: auditPayment.id,
        callbackType: 'PAYMENT_CALLBACK',
      },
    });

    assert.equal(idempotentAudits.length, 2, 'Should have 2 audit records (initial + idempotent)');
    assert.ok(idempotentAudits.every(a => a.callbackStatus === 'SUCCESS'));

    // Setup: Create refund for audit testing
    const refund = await prisma.refundRecord.create({
      data: {
        id: `refund-audit-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        paymentId: auditPayment.id,
        refundNo: `REF-AUDIT-${Date.now()}`,
        applyUserId: baseOrder.ownerId,
        refundType: 'PARTIAL',
        refundReason: 'audit test',
        refundAmount: 50,
        refundStatus: 'PENDING',
      },
    });

    // Execute: Send refund callback
    const refundChannelTxnId = `WXREF-AUDIT-${Date.now()}`;
    const refundCallbackResponse = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: refund.refundNo,
        channelRefundId: refundChannelTxnId,
        success: true,
      })
      .expect(200);

    // Verify: Refund callback audit record exists
    const refundAudit = await prisma.callbackAudit.findFirst({
      where: {
        refundId: refund.id,
        callbackType: 'REFUND_CALLBACK',
      },
    });

    assert.ok(refundAudit, 'Refund audit record should exist');
    assert.equal(refundAudit.callbackStatus, 'SUCCESS', 'Refund audit status should be SUCCESS');
    assert.equal(refundAudit.sourceMode, 'TOKEN', 'Refund audit should use TOKEN source mode');
    assert.ok(refundAudit.signatureDigest, 'Refund audit should have signature digest');
    assert.ok(refundAudit.verificationResult, 'Refund audit should have verification result');

    // Verify: Failed callbacks also create audit records
    const failedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-fail-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        paymentId: auditPayment.id,
        refundNo: `REF-FAIL-${Date.now()}`,
        applyUserId: baseOrder.ownerId,
        refundType: 'PARTIAL',
        refundReason: 'failed audit test',
        refundAmount: 25,
        refundStatus: 'PENDING',
      },
    });

    const failedCallbackResponse = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: failedRefund.refundNo,
        channelRefundId: `WXREF-FAIL-${Date.now()}`,
        success: false,
      })
      .expect(200);

    const failedRefundAudit = await prisma.callbackAudit.findFirst({
      where: {
        refundId: failedRefund.id,
        callbackType: 'REFUND_CALLBACK',
      },
    });

    assert.ok(failedRefundAudit, 'Failed refund audit record should exist');
    assert.equal(failedRefundAudit.callbackStatus, 'FAILURE', 'Failed audit status should be FAILURE');
  });

  it('admin can query callback audit logs with filters', async () => {
    const { app, prisma } = context;

    // Login as admin user
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    // Setup: Get existing order
    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: { id: true },
    });
    assert.ok(baseOrder);

    // Create a test payment and callback for audit query
    const testPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-query-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-QUERY-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 50,
      },
    });

    // Send callback
    const channelTxnId = `WXTXN-QUERY-${Date.now()}`;
    await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: testPayment.payNo,
        channelTxnId,
        success: true,
        paidAmount: 50,
      })
      .expect(200);

    // Test: Query all audit logs (no filter)
    const allAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(allAuditsResponse.body.data.items));
    assert.ok(allAuditsResponse.body.data.pagination.total > 0);
    assert.ok(allAuditsResponse.body.data.pagination.page === 1);
    assert.ok(allAuditsResponse.body.data.pagination.pageSize > 0);

    // Test: Query with callback type filter
    const paymentAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits?callbackType=PAYMENT_CALLBACK')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(paymentAuditsResponse.body.data.items));
    assert.ok(paymentAuditsResponse.body.data.items.every((a: any) => a.callbackType === 'PAYMENT_CALLBACK'));

    // Test: Query with status filter
    const successAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits?callbackStatus=SUCCESS')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(successAuditsResponse.body.data.items));
    assert.ok(successAuditsResponse.body.data.items.length > 0);
    assert.ok(successAuditsResponse.body.data.items.every((a: any) => a.callbackStatus === 'SUCCESS'));

    // Test: Query with source mode filter
    const tokenAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits?sourceMode=TOKEN')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(tokenAuditsResponse.body.data.items));
    assert.ok(tokenAuditsResponse.body.data.items.every((a: any) => a.sourceMode === 'TOKEN'));

    // Test: Query with requestId
    const createdAudit = await prisma.callbackAudit.findFirst({
      where: {
        paymentId: testPayment.id,
      },
      select: {
        requestId: true,
      },
    });

    assert.ok(createdAudit);

    const requestIdQueryResponse = await request(app)
      .get(`/api/petpal/admin/callback-audits?requestId=${createdAudit.requestId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(requestIdQueryResponse.body.data.items.length === 1);
    assert.equal(requestIdQueryResponse.body.data.items[0].requestId, createdAudit.requestId);

    // Test: Query with pagination
    const page2Response = await request(app)
      .get('/api/petpal/admin/callback-audits?page=2&pageSize=5')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(page2Response.body.data.pagination.page, 2);
    assert.equal(page2Response.body.data.pagination.pageSize, 5);
  });

  it('admin can query callback audit stats and export audit logs', async () => {
    const { app, prisma } = context;

    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: { id: true },
    });
    assert.ok(baseOrder);

    const paymentForStats = await prisma.paymentRecord.create({
      data: {
        id: `pay-stats-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-STATS-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 33,
      },
    });

    await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: paymentForStats.payNo,
        channelTxnId: `WXTXN-STATS-${Date.now()}`,
        success: true,
        paidAmount: 33,
      })
      .expect(200);

    const statsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits/stats?sourceMode=TOKEN')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof statsResponse.body.data.total === 'number');
    assert.ok(typeof statsResponse.body.data.successRate === 'number');
    assert.ok(typeof statsResponse.body.data.byStatus.SUCCESS === 'number');
    assert.ok(typeof statsResponse.body.data.byType.PAYMENT_CALLBACK === 'number');
    assert.ok(typeof statsResponse.body.data.bySourceMode.TOKEN === 'number');
    assert.ok(statsResponse.body.data.total >= 1);

    const exportResponse = await request(app)
      .get('/api/petpal/admin/callback-audits/export?sourceMode=TOKEN')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const contentType = String(exportResponse.headers['content-type'] ?? '');
    const contentDisposition = String(exportResponse.headers['content-disposition'] ?? '');

    assert.match(
      contentType,
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
    assert.match(contentDisposition, /attachment;\s*filename=/i);
    assert.ok(Buffer.isBuffer(exportResponse.body));
    assert.ok(exportResponse.body.length > 0);
  });

  it('admin can query callback alert outbox and requeue dead messages', async () => {
    const { app, prisma } = context;

    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: { id: true },
    });
    assert.ok(baseOrder);

    const failedPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-outbox-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-OUTBOX-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 12,
      },
    });

    await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: failedPayment.payNo,
        channelTxnId: `WXTXN-OUTBOX-${Date.now()}`,
        success: false,
      })
      .expect(200);

    const outboxListResponse = await request(app)
      .get('/api/petpal/admin/callback-alert-outbox?status=PENDING')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(outboxListResponse.body.data.items));
    assert.ok(outboxListResponse.body.data.items.length >= 1);

    const outboxId = outboxListResponse.body.data.items[0].id as string;

    await prisma.callbackAlertOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'DEAD',
        retryCount: 5,
      },
    });

    const outboxStatsResponse = await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof outboxStatsResponse.body.data.total === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.byStatus.DEAD === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.oldestPendingAgeMinutes === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.oldestDeadAgeMinutes === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.stuckProcessingCount === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.processingTimeoutMinutes === 'number');

    const retryResponse = await request(app)
      .post(`/api/petpal/admin/callback-alert-outbox/${outboxId}/retry`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(retryResponse.body.data.id, outboxId);
    assert.equal(retryResponse.body.data.status, 'PENDING');

    const replayLogsAfterSingleRetry = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(replayLogsAfterSingleRetry.body.data.items));
    assert.ok(typeof replayLogsAfterSingleRetry.body.data.pagination.total === 'number');
    assert.equal(replayLogsAfterSingleRetry.body.data.items[0].actionType, 'REQUEUE');
    assert.ok(typeof replayLogsAfterSingleRetry.body.data.items[0].actorId === 'string');

    await prisma.callbackAlertOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'DEAD',
      },
    });

    const retryDeadResponse = await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/retry-dead')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ limit: 20 })
      .expect(200);

    assert.ok(retryDeadResponse.body.data.requeued >= 1);
    assert.equal(retryDeadResponse.body.data.requested, 20);

    const replayLogsAfterBatchRetry = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(
      replayLogsAfterBatchRetry.body.data.items.some((item: any) => item.actionType === 'REQUEUE_DEAD_BATCH'),
    );

    const filteredReplayLogs = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .query({ actionType: 'REQUEUE_DEAD_BATCH', actorId: adminSession.user.id })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(filteredReplayLogs.body.data.items));
    assert.ok(filteredReplayLogs.body.data.items.length >= 1);
    assert.ok(filteredReplayLogs.body.data.items.every((item: any) => item.actionType === 'REQUEUE_DEAD_BATCH'));
    assert.ok(filteredReplayLogs.body.data.items.every((item: any) => item.actorId === adminSession.user.id));

    const replayLogStatsResponse = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs/stats`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof replayLogStatsResponse.body.data.total === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.byAction.REQUEUE === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.byAction.REQUEUE_DEAD_BATCH === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.uniqueActorCount === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.batchReplayRatio === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.isBatchReplayDominant === 'boolean');
    assert.ok(
      replayLogStatsResponse.body.data.latestReplayAt === null
      || typeof replayLogStatsResponse.body.data.latestReplayAt === 'string',
    );
    assert.ok(
      replayLogStatsResponse.body.data.minutesSinceLastReplay === null
      || typeof replayLogStatsResponse.body.data.minutesSinceLastReplay === 'number',
    );

    const futureReplayLogs = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .query({ startDate: '2099-01-01T00:00:00.000Z', endDate: '2099-12-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(futureReplayLogs.body.data.items));
    assert.equal(futureReplayLogs.body.data.items.length, 0);
  });

  it('rejects tampered active role context and allows valid scoped role context', async () => {
    const { app, prisma } = context;

    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    const [superAdminRole, managerRole] = await Promise.all([
      prisma.role.findUnique({ where: { code: 'super-admin' }, select: { id: true } }),
      prisma.role.findUnique({ where: { code: 'ops-manager' }, select: { id: true } }),
    ]);

    assert.ok(superAdminRole);
    assert.ok(managerRole);

    await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', superAdminRole.id)
      .expect(401);

    await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-audits/export')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .expect(403);
  });

  it('forbids non-admin users from accessing callback audit admin endpoints', async () => {
    const { app } = context;

    const memberSession = await loginAs(app, 'user', 'User123!');
    const authHeader = { Authorization: `Bearer ${memberSession.tokens.accessToken}` };

    await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-audits/stats')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-audits/export')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/stats')
      .set(authHeader)
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/unknown/retry')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs/stats')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/replay-logs/export?outboxId=unknown')
      .set(authHeader)
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/retry-dead')
      .set(authHeader)
      .send({ limit: 20 })
      .expect(403);
  });

  it('allows manager to read callback audits but forbids export', async () => {
    const { app } = context;

    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    const authHeader = { Authorization: `Bearer ${managerSession.tokens.accessToken}` };

    await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-audits/stats')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-audits/export')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/stats')
      .set(authHeader)
      .expect(200);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/unknown/retry')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs/stats')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/replay-logs/export?outboxId=unknown')
      .set(authHeader)
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/retry-dead')
      .set(authHeader)
      .send({ limit: 20 })
      .expect(403);
  });
});
