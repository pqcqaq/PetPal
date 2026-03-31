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

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const requestRecord = await prisma.serviceRequest.create({
    data: {
      id: `req-complaint-stats-${suffix}`,
      ownerId: ownerSession.user.id,
      petId: pet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-03T09:00:00.000Z'),
      endTime: new Date('2026-04-03T10:00:00.000Z'),
      locationText: '杭州市滨江区',
      locationLat: 30.206,
      locationLng: 120.211,
      budgetAmount: 88,
      demandTags: ['dog', 'walk'],
      status: 'MATCHED',
      matchedCaregiverId: caregiverProfile.id,
    },
  });

  const order = await prisma.orderMain.create({
    data: {
      id: `order-complaint-stats-${suffix}`,
      orderNo: `PP-COMPLAINT-STATS-${Date.now()}`,
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

describe('PetPal complaint admin stats integration', () => {
  it('returns workbench stats across the current scope without being locked by status filters', async () => {
    const firstScenario = await createFulfillmentScenario();
    const secondScenario = await createFulfillmentScenario();
    const adminSession = await loginAs(firstScenario.app, 'admin', 'Admin123!');
    const keyword = '投诉统计值班看板验证';

    for (const scenario of [firstScenario, secondScenario]) {
      await request(scenario.app)
        .post(`/api/petpal/caregiver/orders/${scenario.order.id}/accept`)
        .set('Authorization', `Bearer ${scenario.caregiverSession.tokens.accessToken}`)
        .expect(200);

      await request(scenario.app)
        .post(`/api/petpal/caregiver/orders/${scenario.order.id}/check-in`)
        .set('Authorization', `Bearer ${scenario.caregiverSession.tokens.accessToken}`)
        .send({})
        .expect(200);
    }

    const firstComplaintResponse = await request(firstScenario.app)
      .post(`/api/petpal/orders/${firstScenario.order.id}/complaints`)
      .set('Authorization', `Bearer ${firstScenario.ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: `${keyword}-待处理`,
      })
      .expect(200);

    const secondComplaintResponse = await request(secondScenario.app)
      .post(`/api/petpal/orders/${secondScenario.order.id}/complaints`)
      .set('Authorization', `Bearer ${secondScenario.ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: `${keyword}-处理中`,
      })
      .expect(200);

    await request(firstScenario.app)
      .post(`/api/petpal/admin/complaints/${secondComplaintResponse.body.data.id}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'ASSIGN',
        assigneeId: adminSession.user.id,
        note: '值班负责人接手处理。',
      })
      .expect(200);

    await firstScenario.prisma.complaint.update({
      where: { id: firstComplaintResponse.body.data.id },
      data: {
        createdAt: new Date(Date.now() - (21 * 60 * 60 * 1000)),
      },
    });

    await firstScenario.prisma.complaint.update({
      where: { id: secondComplaintResponse.body.data.id },
      data: {
        createdAt: new Date(Date.now() - (26 * 60 * 60 * 1000)),
      },
    });

    const statsResponse = await request(firstScenario.app)
      .get('/api/petpal/admin/complaints/stats')
      .query({
        status: 'OPEN',
        keyword,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(statsResponse.body.data.total, 2);
    assert.deepEqual(statsResponse.body.data.byStatus, {
      OPEN: 1,
      PROCESSING: 1,
      RESOLVED: 0,
      REJECTED: 0,
    });
    assert.equal(statsResponse.body.data.dueSoonCount, 1);
    assert.equal(statsResponse.body.data.overdueCount, 1);
    assert.equal(statsResponse.body.data.unassignedCount, 1);
    assert.equal(statsResponse.body.data.assignedToMeCount, 1);
    assert.equal(statsResponse.body.data.processingAssignedToMeCount, 1);
    assert.equal(statsResponse.body.data.slaLimitHours, 24);
    assert.equal(statsResponse.body.data.slaWarningHours, 6);
  });

  it('forbids non-admin users from accessing complaint admin stats', async () => {
    const { app } = context;
    const ownerSession = await loginAs(app, 'user', 'User123!');

    await request(app)
      .get('/api/petpal/admin/complaints/stats')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(403);
  });
});
