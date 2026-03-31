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

const originalComplaintSlaLimitHours = process.env.PETPAL_COMPLAINT_SLA_LIMIT_HOURS;
const originalComplaintSlaWarningHours = process.env.PETPAL_COMPLAINT_SLA_WARNING_HOURS;

let context: BackendTestContext;

before(async () => {
  process.env.PETPAL_COMPLAINT_SLA_LIMIT_HOURS = '30';
  process.env.PETPAL_COMPLAINT_SLA_WARNING_HOURS = '10';
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);

  if (originalComplaintSlaLimitHours == null) {
    delete process.env.PETPAL_COMPLAINT_SLA_LIMIT_HOURS;
  } else {
    process.env.PETPAL_COMPLAINT_SLA_LIMIT_HOURS = originalComplaintSlaLimitHours;
  }

  if (originalComplaintSlaWarningHours == null) {
    delete process.env.PETPAL_COMPLAINT_SLA_WARNING_HOURS;
  } else {
    process.env.PETPAL_COMPLAINT_SLA_WARNING_HOURS = originalComplaintSlaWarningHours;
  }
});

const createComplaintScenario = async () => {
  const { app, prisma } = context;
  const ownerSession = await loginAs(app, 'user', 'User123!');
  const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
  const adminSession = await loginAs(app, 'admin', 'Admin123!');
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
      id: `req-sla-config-${suffix}`,
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
      id: `order-sla-config-${suffix}`,
      orderNo: `PP-SLA-CFG-${Date.now()}`,
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
      description: '需要验证投诉工单自定义 SLA 阈值在后台筛选中生效。',
    })
    .expect(200);

  return {
    app,
    prisma,
    adminSession,
    order,
    complaintId: complaintResponse.body.data.id as string,
  };
};

describe('PetPal complaint SLA config integration', () => {
  it('respects configured complaint SLA thresholds in admin filters', async () => {
    const {
      app,
      prisma,
      adminSession,
      order,
      complaintId,
    } = await createComplaintScenario();

    const normalCreatedAt = new Date(Date.now() - (19 * 60 * 60 * 1000));
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        createdAt: normalCreatedAt,
      },
    });

    const normalResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        slaStatus: 'NORMAL',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(normalResponse.body.data.items.length, 1);
    assert.equal(normalResponse.body.data.items[0].slaStatus, 'NORMAL');
    assert.ok(normalResponse.body.data.items[0].slaDeadlineAt);
    assert.ok(
      Math.abs(
        new Date(normalResponse.body.data.items[0].slaDeadlineAt).getTime()
          - (normalCreatedAt.getTime() + (30 * 60 * 60 * 1000)),
      ) < 1_000,
    );

    const earlyDueSoonResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        slaStatus: 'DUE_SOON',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(earlyDueSoonResponse.body.data.items.length, 0);

    const dueSoonCreatedAt = new Date(Date.now() - (27 * 60 * 60 * 1000));
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        createdAt: dueSoonCreatedAt,
      },
    });

    const dueSoonResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        slaStatus: 'DUE_SOON',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(dueSoonResponse.body.data.items.length, 1);
    assert.equal(dueSoonResponse.body.data.items[0].slaStatus, 'DUE_SOON');
    assert.ok(dueSoonResponse.body.data.items[0].slaDeadlineAt);
    assert.ok(
      Math.abs(
        new Date(dueSoonResponse.body.data.items[0].slaDeadlineAt).getTime()
          - (dueSoonCreatedAt.getTime() + (30 * 60 * 60 * 1000)),
      ) < 1_000,
    );

    const overdueResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        slaStatus: 'OVERDUE',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(overdueResponse.body.data.items.length, 0);
  });
});
