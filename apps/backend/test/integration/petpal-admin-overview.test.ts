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
    petId: pet.id,
    caregiverId: caregiverProfile.id,
    order,
  };
};

describe('PetPal admin overview integration', () => {
  it('admin can query aggregated overview summary', async () => {
    const { app, prisma, ownerSession, caregiverSession, petId, caregiverId, order } = await createFulfillmentScenario();
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

    const completedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-admin-ops-${suffix}`,
        ownerId: ownerSession.user.id,
        petId,
        serviceType: 'FEEDING',
        startTime: new Date('2026-04-02T09:00:00.000Z'),
        endTime: new Date('2026-04-02T09:30:00.000Z'),
        locationText: '杭州市滨江区经营指标测试',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 66,
        demandTags: ['ops-metrics'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverId,
      },
    });

    const completedOrder = await prisma.orderMain.create({
      data: {
        id: `order-admin-ops-${suffix}`,
        orderNo: `PP-ADMIN-OPS-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId,
        serviceRequestId: completedRequest.id,
        serviceType: 'FEEDING',
        appointmentStart: new Date('2026-04-02T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-02T09:30:00.000Z'),
        amountTotal: 66,
        amountAdjusted: 0,
        amountPaid: 66,
        amountRefunded: 16,
        orderStatus: 'PARTIAL_REFUNDED',
        closedAt: new Date('2026-04-02T10:10:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-admin-ops-${suffix}`,
        orderId: completedOrder.id,
        refundNo: `REF-ADMIN-OPS-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '经营指标退款率测试',
        refundAmount: 16,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-02T10:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-admin-ops-${suffix}`,
        orderId: completedOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'FEE',
        description: '经营指标投诉率测试',
        status: 'OPEN',
      },
    });

    const response = await request(app)
      .get('/api/petpal/admin/overview')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(response.body.data.complaintStats);
    assert.ok(response.body.data.callbackAuditStats);
    assert.ok(response.body.data.callbackAlertStats);
    assert.ok(response.body.data.operationsMetrics);
    assert.equal(response.body.data.unavailableScopes.length, 0);
    assert.ok(response.body.data.complaintStats.overdueCount >= 1);
    assert.ok(response.body.data.complaintStats.unassignedCount >= 1);
    assert.ok(response.body.data.pendingCaregiverCount >= 1);
    assert.ok(response.body.data.callbackAuditStats.total >= 1);
    assert.ok(response.body.data.callbackAlertStats.byStatus.DEAD >= 1);

    const metrics = response.body.data.operationsMetrics as {
      windowDays: number;
      demandCount: number;
      activeApprovedCaregiverCount: number;
      supplyDemandRatio: number | null;
      orderCount: number;
      completedOrderCount: number;
      completionRate: number;
      paidOrderCount: number;
      refundedOrderCount: number;
      refundRate: number;
      complainedOrderCount: number;
      complaintRate: number;
    };
    const windowStartAt = new Date(Date.now() - metrics.windowDays * 24 * 60 * 60 * 1000);
    const [activeApprovedCaregiverCount, demandCount, windowOrders, refundedOrders, complainedOrders] = await Promise.all([
      prisma.caregiverProfile.count({
        where: {
          deleteAt: null,
          auditStatus: 'APPROVED',
          services: {
            some: {
              deleteAt: null,
              isActive: true,
            },
          },
        },
      }),
      prisma.serviceRequest.count({
        where: {
          deleteAt: null,
          createdAt: {
            gte: windowStartAt,
          },
        },
      }),
      prisma.orderMain.findMany({
        where: {
          deleteAt: null,
          createdAt: {
            gte: windowStartAt,
          },
        },
        select: {
          id: true,
          amountPaid: true,
          orderStatus: true,
        },
      }),
      prisma.refundRecord.findMany({
        where: {
          deleteAt: null,
          createdAt: {
            gte: windowStartAt,
          },
          refundStatus: {
            in: ['APPROVED', 'SUCCESS'],
          },
        },
        distinct: ['orderId'],
        select: {
          orderId: true,
        },
      }),
      prisma.complaint.findMany({
        where: {
          deleteAt: null,
          createdAt: {
            gte: windowStartAt,
          },
        },
        distinct: ['orderId'],
        select: {
          orderId: true,
        },
      }),
    ]);

    const orderCount = windowOrders.length;
    const completedOrderCount = windowOrders.filter((item) => (
      item.orderStatus === 'COMPLETED' || item.orderStatus === 'PARTIAL_REFUNDED'
    )).length;
    const paidOrderCount = windowOrders.filter((item) => Number(item.amountPaid) > 0).length;
    const refundedOrderCount = refundedOrders.length;
    const complainedOrderCount = complainedOrders.length;

    assert.deepEqual(metrics, {
      windowDays: metrics.windowDays,
      demandCount,
      activeApprovedCaregiverCount,
      supplyDemandRatio: demandCount > 0 ? Number((activeApprovedCaregiverCount / demandCount).toFixed(2)) : null,
      orderCount,
      completedOrderCount,
      completionRate: orderCount > 0 ? Number(((completedOrderCount / orderCount) * 100).toFixed(2)) : 0,
      paidOrderCount,
      refundedOrderCount,
      refundRate: paidOrderCount > 0 ? Number(((refundedOrderCount / paidOrderCount) * 100).toFixed(2)) : 0,
      complainedOrderCount,
      complaintRate: orderCount > 0 ? Number(((complainedOrderCount / orderCount) * 100).toFixed(2)) : 0,
    });
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
