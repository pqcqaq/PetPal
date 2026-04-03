import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import type { PenaltyTemplateRecord } from '@rbac/api-common';
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

const createComplaintScenario = async () => {
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
      id: `req-penalty-template-${suffix}`,
      ownerId: ownerSession.user.id,
      petId: pet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-03T09:00:00.000Z'),
      endTime: new Date('2026-04-03T10:00:00.000Z'),
      locationText: `杭州市滨江区模板测试-${suffix}`,
      locationLat: 30.206,
      locationLng: 120.211,
      budgetAmount: 88,
      demandTags: ['penalty-template', suffix],
      status: 'MATCHED',
      matchedCaregiverId: caregiverProfile.id,
    },
  });

  const order = await prisma.orderMain.create({
    data: {
      id: `order-penalty-template-${suffix}`,
      orderNo: `PP-PENALTY-TPL-${Date.now()}`,
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
      orderStatus: 'SERVING',
    },
  });

  const complaint = await prisma.complaint.create({
    data: {
      id: `complaint-penalty-template-${suffix}`,
      createId: ownerSession.user.id,
      updateId: ownerSession.user.id,
      orderId: order.id,
      complainantId: ownerSession.user.id,
      targetRole: 'CAREGIVER',
      complaintType: 'SERVICE',
      description: `照料者未按模板要求回传履约记录 ${suffix}`,
      evidenceUrls: ['https://example.com/evidence/penalty-template'],
      status: 'OPEN',
    },
  });

  await prisma.complaintProcessLog.create({
    data: {
      id: `complaint-log-penalty-template-${suffix}`,
      createId: ownerSession.user.id,
      updateId: ownerSession.user.id,
      complaintId: complaint.id,
      actionType: 'OPEN',
      operatorId: ownerSession.user.id,
      note: '用户已发起投诉',
    },
  });

  return {
    app,
    prisma,
    suffix,
    complaintId: complaint.id,
  };
};

describe('PetPal penalty template admin integration', () => {
  it('admin can manage penalty templates and apply them to complaint penalties', async () => {
    const { app, prisma, suffix, complaintId } = await createComplaintScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const createResponse = await request(app)
      .post('/api/petpal/admin/penalty-templates')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        templateCode: `SERVICE_LOG_MISSING_${suffix}`,
        templateName: '缺少服务影像回传',
        description: '用于照料者未按要求上传履约留痕的处罚模板',
        targetRole: 'CAREGIVER',
        penaltyType: 'SERVICE_RESTRICTION',
        severity: 'HIGH',
        defaultReason: `未按要求回传服务影像与关键服务记录 ${suffix}`,
        actionSummary: '限制接单 7 天并补交完整服务记录',
        defaultRectifyDays: 2,
      })
      .expect(200);

    const createdTemplate = createResponse.body.data as PenaltyTemplateRecord;
    assert.equal(createdTemplate.templateCode, `SERVICE_LOG_MISSING_${suffix}`.toUpperCase());
    assert.equal(createdTemplate.isActive, true);
    assert.equal(createdTemplate.usageCount, 0);

    const listResponse = await request(app)
      .get('/api/petpal/admin/penalty-templates')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        keyword: suffix,
      })
      .expect(200);

    assert.equal(listResponse.body.data.pagination.total, 1);
    assert.equal(listResponse.body.data.items[0].id, createdTemplate.id);

    const statsBeforeApply = await request(app)
      .get('/api/petpal/admin/penalty-templates/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        keyword: suffix,
      })
      .expect(200);

    assert.deepEqual(statsBeforeApply.body.data, {
      total: 1,
      activeCount: 1,
      inactiveCount: 0,
      sharedCount: 0,
      caregiverCount: 1,
      platformCount: 0,
      totalUsageCount: 0,
      recentUsedCount: 0,
    });

    const penaltyResponse = await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'PENALTY',
        penaltyTemplateId: createdTemplate.id,
      })
      .expect(200);

    const complaintRecord = penaltyResponse.body.data as {
      status: string;
      penalties: Array<{
        penaltyType: string;
        severity: string;
        reason: string;
        actionSummary: string;
        rectifyDueAt: string | null;
      }>;
    };

    assert.equal(complaintRecord.status, 'PROCESSING');
    assert.equal(complaintRecord.penalties.length, 1);
    assert.equal(complaintRecord.penalties[0]?.penaltyType, 'SERVICE_RESTRICTION');
    assert.equal(complaintRecord.penalties[0]?.severity, 'HIGH');
    assert.equal(
      complaintRecord.penalties[0]?.reason,
      `未按要求回传服务影像与关键服务记录 ${suffix}`,
    );
    assert.equal(
      complaintRecord.penalties[0]?.actionSummary,
      '限制接单 7 天并补交完整服务记录',
    );
    assert.ok(complaintRecord.penalties[0]?.rectifyDueAt);

    const templateAfterApply = await prisma.penaltyTemplate.findFirst({
      where: {
        id: createdTemplate.id,
      },
      select: {
        usageCount: true,
        lastUsedAt: true,
      },
    });

    assert.ok(templateAfterApply);
    assert.equal(templateAfterApply.usageCount, 1);
    assert.ok(templateAfterApply.lastUsedAt);

    const processLog = await prisma.complaintProcessLog.findFirst({
      where: {
        complaintId,
        actionType: 'PENALTY',
      },
      select: {
        note: true,
      },
    });

    assert.ok(processLog?.note);
    assert.equal(processLog.note?.includes(createdTemplate.templateCode), true);

    const statsAfterApply = await request(app)
      .get('/api/petpal/admin/penalty-templates/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        keyword: suffix,
      })
      .expect(200);

    assert.equal(statsAfterApply.body.data.totalUsageCount, 1);
    assert.equal(statsAfterApply.body.data.recentUsedCount, 1);
  });

  it('rejects mismatched or inactive penalty templates during complaint handling', async () => {
    const { app, suffix, complaintId } = await createComplaintScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const platformTemplateResponse = await request(app)
      .post('/api/petpal/admin/penalty-templates')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        templateCode: `PLATFORM_ONLY_${suffix}`,
        templateName: '仅平台责任适用',
        targetRole: 'PLATFORM',
        penaltyType: 'WARNING',
        severity: 'LOW',
        defaultReason: '仅平台责任工单允许套用',
        actionSummary: '发送站内警告',
      })
      .expect(200);

    const platformTemplate = platformTemplateResponse.body.data as PenaltyTemplateRecord;

    await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'PENALTY',
        penaltyTemplateId: platformTemplate.id,
      })
      .expect(400);

    const inactiveTemplateResponse = await request(app)
      .post('/api/petpal/admin/penalty-templates')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        templateCode: `INACTIVE_${suffix}`,
        templateName: '已停用模板',
        targetRole: 'CAREGIVER',
        penaltyType: 'WARNING',
        severity: 'MEDIUM',
        defaultReason: '模板停用后不允许继续套用',
        actionSummary: '暂停接单并补充说明',
        defaultRectifyDays: 3,
      })
      .expect(200);

    const inactiveTemplate = inactiveTemplateResponse.body.data as PenaltyTemplateRecord;

    await request(app)
      .post(`/api/petpal/admin/penalty-templates/${inactiveTemplate.id}/status`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        isActive: false,
      })
      .expect(200);

    await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'PENALTY',
        penaltyTemplateId: inactiveTemplate.id,
      })
      .expect(400);
  });
});
