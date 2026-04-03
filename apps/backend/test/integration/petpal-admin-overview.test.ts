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

const createFulfillmentScenario = async () => {
  const { app, prisma } = context;
  const ownerSession = await loginAs(app, 'user', 'User123!');
  const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
  const pet = await prisma.petProfile.findFirst({
    where: {
      ownerId: ownerSession.user.id,
    },
    select: {
      id: true,
    },
  });
  const caregiverProfile = await prisma.caregiverProfile.findFirst({
    where: {
      userId: caregiverSession.user.id,
    },
    select: {
      id: true,
    },
  });

  assert.ok(pet);
  assert.ok(caregiverProfile);

  const suffix = Date.now().toString(36);
  const requestRecord = await prisma.serviceRequest.create({
    data: {
      id: `req-admin-overview-${suffix}`,
      ownerId: ownerSession.user.id,
      petId: pet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-03T09:00:00.000Z'),
      endTime: new Date('2026-04-03T10:00:00.000Z'),
      locationText: '杭州市滨江区概览测试',
      locationLat: 30.206,
      locationLng: 120.211,
      budgetAmount: 88,
      demandTags: ['overview', 'audit'],
      status: 'MATCHED',
      matchedCaregiverId: caregiverProfile.id,
    },
  });

  const order = await prisma.orderMain.create({
    data: {
      id: `order-admin-overview-${suffix}`,
      orderNo: `PP-ADMIN-OVERVIEW-${Date.now()}`,
      ownerId: ownerSession.user.id,
      caregiverId: caregiverProfile.id,
      serviceRequestId: requestRecord.id,
      serviceType: 'WALKING',
      appointmentStart: new Date('2026-04-03T09:00:00.000Z'),
      appointmentEnd: new Date('2026-04-03T10:00:00.000Z'),
      amountTotal: 88,
      amountAdjusted: 0,
      amountPaid: 88,
      amountRefunded: 0,
      orderStatus: 'PENDING_ACCEPT',
    },
  });

  return {
    app,
    prisma,
    ownerSession,
    caregiverSession,
    order,
  };
};

describe('PetPal admin overview integration', () => {
  it('admin can query aggregated overview summary', async () => {
    const { app, prisma, ownerSession, caregiverSession, order } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/check-in`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({})
      .expect(200);

    const complaintResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/complaints`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '管理员概览接口需要聚合超时投诉、待审审核与回调告警。',
      })
      .expect(200);

    await prisma.complaint.update({
      where: {
        id: complaintResponse.body.data.id as string,
      },
      data: {
        createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      },
    });

    const existingPendingCaregiver = await prisma.caregiverProfile.findFirst({
      where: {
        userId: ownerSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existingPendingCaregiver) {
      await prisma.caregiverProfile.update({
        where: {
          id: existingPendingCaregiver.id,
        },
        data: {
          auditStatus: 'PENDING',
        },
      });
    } else {
      await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-admin-overview-${suffix}`,
          userId: ownerSession.user.id,
          experienceYears: 1,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'PENDING',
        },
      });
    }

    const baseOrder = await prisma.orderMain.findUnique({
      where: {
        orderNo: 'PP202603300001',
      },
      select: {
        id: true,
      },
    });

    assert.ok(baseOrder);

    const failedPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-admin-overview-${suffix}`,
        orderId: baseOrder.id,
        payNo: `PAY-ADMIN-OVERVIEW-${Date.now()}`,
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
        channelTxnId: `WXTXN-ADMIN-OVERVIEW-${Date.now()}`,
        success: false,
      })
      .expect(200);

    const latestOutbox = await prisma.callbackAlertOutbox.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    assert.ok(latestOutbox);

    await prisma.callbackAlertOutbox.update({
      where: {
        id: latestOutbox.id,
      },
      data: {
        status: 'DEAD',
        retryCount: 5,
      },
    });

    const response = await request(app)
      .get('/api/petpal/admin/overview')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(response.body.data.complaintStats);
    assert.ok(response.body.data.callbackAuditStats);
    assert.ok(response.body.data.callbackAlertStats);
    assert.equal(response.body.data.unavailableScopes.length, 0);
    assert.ok(response.body.data.complaintStats.overdueCount >= 1);
    assert.ok(response.body.data.complaintStats.unassignedCount >= 1);
    assert.ok(response.body.data.pendingCaregiverCount >= 1);
    assert.ok(response.body.data.callbackAuditStats.total >= 1);
    assert.ok(response.body.data.callbackAlertStats.byStatus.DEAD >= 1);
  });

  it('forbids ordinary member from querying admin overview summary', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    await request(app)
      .get('/api/petpal/admin/overview')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);
  });
});
