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
      id: `req-complaint-batch-close-${suffix}`,
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
      id: `order-complaint-batch-close-${suffix}`,
      orderNo: `PP-BATCH-CLOSE-${suffix}`,
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
    ownerSession,
    caregiverSession,
    order,
  };
};

describe('PetPal complaint batch close integration', () => {
  it('supports batch closing complaints for admin workbench', async () => {
    const firstScenario = await createFulfillmentScenario();
    const secondScenario = await createFulfillmentScenario();
    const adminSession = await loginAs(firstScenario.app, 'admin', 'Admin123!');

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

    const firstComplaint = await request(firstScenario.app)
      .post(`/api/petpal/orders/${firstScenario.order.id}/complaints`)
      .set('Authorization', `Bearer ${firstScenario.ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '第一条投诉工单用于验证后端批量关闭。',
      })
      .expect(200);

    const secondComplaint = await request(secondScenario.app)
      .post(`/api/petpal/orders/${secondScenario.order.id}/complaints`)
      .set('Authorization', `Bearer ${secondScenario.ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '第二条投诉工单用于验证后端批量关闭。',
      })
      .expect(200);

    const batchCloseResponse = await request(firstScenario.app)
      .post('/api/petpal/admin/complaints/batch-close')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        complaintIds: [
          firstComplaint.body.data.id,
          secondComplaint.body.data.id,
        ],
        resultStatus: 'RESOLVED',
        resultSummary: '平台已核实争议事实并完成统一结案处理。',
      })
      .expect(200);

    assert.equal(batchCloseResponse.body.data.requestedCount, 2);
    assert.equal(batchCloseResponse.body.data.updatedCount, 2);
    assert.equal(batchCloseResponse.body.data.items.length, 2);
    assert.ok(batchCloseResponse.body.data.items.every((item: {
      status: string;
      resultSummary: string;
      assignedAdminId: string;
      closedAt: string | null;
      processLogs: Array<{ actionType: string; note?: string | null }>;
    }) => (
      item.status === 'RESOLVED'
      && item.resultSummary === '平台已核实争议事实并完成统一结案处理。'
      && item.assignedAdminId === adminSession.user.id
      && Boolean(item.closedAt)
      && item.processLogs.at(-1)?.actionType === 'CLOSE'
      && item.processLogs.at(-1)?.note === '平台已核实争议事实并完成统一结案处理。'
    )));
  });

  it('forbids non-admin users from batch closing complaints', async () => {
    const {
      app,
      ownerSession,
      caregiverSession,
      order,
    } = await createFulfillmentScenario();

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
        description: '普通成员不应访问投诉批量关闭接口。',
      })
      .expect(200);

    await request(app)
      .post('/api/petpal/admin/complaints/batch-close')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        complaintIds: [complaintResponse.body.data.id],
        resultStatus: 'REJECTED',
        resultSummary: '越权尝试批量关闭。',
      })
      .expect(403);
  });
});
