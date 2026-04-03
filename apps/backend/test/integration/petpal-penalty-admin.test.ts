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
import { invalidatePermissionCache } from '../../src/utils/rbac';

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
  const caregiverUser = await prisma.user.findUnique({
    where: {
      id: caregiverSession.user.id,
    },
    select: {
      nickname: true,
    },
  });

  assert.ok(pet);
  assert.ok(caregiverProfile);
  assert.ok(caregiverUser);

  const suffix = Date.now().toString(36);
  const requestRecord = await prisma.serviceRequest.create({
    data: {
      id: `req-penalty-${suffix}`,
      ownerId: ownerSession.user.id,
      petId: pet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-03T09:00:00.000Z'),
      endTime: new Date('2026-04-03T10:00:00.000Z'),
      locationText: `杭州市滨江区处罚测试-${suffix}`,
      locationLat: 30.206,
      locationLng: 120.211,
      budgetAmount: 88,
      demandTags: ['penalty', suffix],
      status: 'MATCHED',
      matchedCaregiverId: caregiverProfile.id,
    },
  });

  const order = await prisma.orderMain.create({
    data: {
      id: `order-penalty-${suffix}`,
      orderNo: `PP-PENALTY-${Date.now()}`,
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
      id: `complaint-penalty-${suffix}`,
      createId: ownerSession.user.id,
      updateId: ownerSession.user.id,
      orderId: order.id,
      complainantId: ownerSession.user.id,
      targetRole: 'CAREGIVER',
      complaintType: 'SERVICE',
      description: `照料者未按规则回传服务影像，需要处罚跟踪 ${suffix}`,
      evidenceUrls: ['https://example.com/evidence/penalty'],
      status: 'OPEN',
    },
  });

  await prisma.complaintProcessLog.create({
    data: {
      id: `complaint-log-penalty-${suffix}`,
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
    caregiverUserId: caregiverSession.user.id,
    caregiverNickname: caregiverUser.nickname,
  };
};

describe('PetPal penalty admin integration', () => {
  it('admin can create and rectify penalty records from complaint handling', async () => {
    const { app, prisma, suffix, complaintId, caregiverUserId, caregiverNickname } =
      await createComplaintScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const penaltyActionResponse = await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'PENALTY',
        penaltyType: 'SERVICE_RESTRICTION',
        penaltySeverity: 'HIGH',
        penaltyReason: `未按平台要求上传服务影像 ${suffix}`,
        penaltyActionSummary: '限制接单 7 天并要求补交完整服务记录',
        rectifyDueAt: '2026-04-06T08:00:00.000Z',
      })
      .expect(200);

    const complaintRecord = penaltyActionResponse.body.data as {
      status: string;
      penalties: Array<{
        id: string;
        targetUserId: string | null;
        targetNickname: string | null;
        penaltyType: string;
        severity: string;
        rectifyStatus: string;
      }>;
      processLogs: Array<{
        actionType: string;
      }>;
    };

    assert.equal(complaintRecord.status, 'PROCESSING');
    assert.equal(complaintRecord.penalties.length, 1);
    assert.equal(complaintRecord.penalties[0]?.targetUserId, caregiverUserId);
    assert.equal(complaintRecord.penalties[0]?.targetNickname, caregiverNickname);
    assert.equal(complaintRecord.penalties[0]?.penaltyType, 'SERVICE_RESTRICTION');
    assert.equal(complaintRecord.penalties[0]?.severity, 'HIGH');
    assert.equal(complaintRecord.penalties[0]?.rectifyStatus, 'PENDING');
    assert.equal(
      complaintRecord.processLogs.some((item) => item.actionType === 'PENALTY'),
      true,
    );

    const penaltyId = complaintRecord.penalties[0]!.id;

    const statsResponse = await request(app)
      .get('/api/petpal/admin/penalties/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        keyword: suffix,
      })
      .expect(200);

    assert.deepEqual(statsResponse.body.data, {
      total: 1,
      byRectifyStatus: {
        PENDING: 1,
        COMPLETED: 0,
        WAIVED: 0,
      },
      bySeverity: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 1,
      },
      dueSoonCount: 0,
      overdueCount: 0,
    });

    const listResponse = await request(app)
      .get('/api/petpal/admin/penalties')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        keyword: suffix,
      })
      .expect(200);

    assert.equal(listResponse.body.data.pagination.total, 1);
    assert.equal(listResponse.body.data.items[0].id, penaltyId);
    assert.equal(listResponse.body.data.items[0].targetNickname, caregiverNickname);

    const rectifyResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '已补交服务影像并完成内部复盘。',
      })
      .expect(200);

    assert.equal(rectifyResponse.body.data.rectifyStatus, 'COMPLETED');
    assert.equal(rectifyResponse.body.data.rectifyNote, '已补交服务影像并完成内部复盘。');

    const penaltyRecord = await prisma.penaltyRecord.findFirst({
      where: {
        id: penaltyId,
      },
      select: {
        rectifyStatus: true,
        rectifyNote: true,
        rectifiedAt: true,
        updateId: true,
      },
    });

    assert.ok(penaltyRecord);
    assert.equal(penaltyRecord.rectifyStatus, 'COMPLETED');
    assert.equal(penaltyRecord.rectifyNote, '已补交服务影像并完成内部复盘。');
    assert.ok(penaltyRecord.rectifiedAt);
    assert.equal(penaltyRecord.updateId, adminSession.user.id);
  });

  it('requires penalty permission for complaint penalty action', async () => {
    const { app, prisma, complaintId } = await createComplaintScenario();
    const managerUser = await prisma.user.findFirst({
      where: {
        username: 'manager',
      },
      select: {
        id: true,
      },
    });
    const managerRole = await prisma.role.findFirst({
      where: {
        code: 'ops-manager',
      },
      select: {
        id: true,
      },
    });
    const penaltyPermission = await prisma.permission.findFirst({
      where: {
        code: 'petpal.penalty.manage',
      },
      select: {
        id: true,
      },
    });

    assert.ok(managerUser);
    assert.ok(managerRole);
    assert.ok(penaltyPermission);

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: managerRole.id,
        permissionId: penaltyPermission.id,
      },
    });
    await invalidatePermissionCache([managerUser.id]);

    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    assert.equal(managerSession.user.permissions.includes('petpal.complaint.manage'), true);
    assert.equal(managerSession.user.permissions.includes('petpal.penalty.manage'), false);

    await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .send({
        actionType: 'PENALTY',
        penaltyType: 'WARNING',
        penaltySeverity: 'LOW',
        penaltyReason: '仅测试权限分离',
        penaltyActionSummary: '发出书面警告',
      })
      .expect(403);
  });

  it('forbids ordinary member from querying penalty admin endpoints', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    await request(app)
      .get('/api/petpal/admin/penalties')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(403);
  });

  it('allows manage-only admin to query penalty list and stats', async () => {
    const { app, prisma } = context;
    const managerUser = await prisma.user.findFirst({
      where: {
        username: 'manager',
      },
      select: {
        id: true,
      },
    });
    const managerRole = await prisma.role.findFirst({
      where: {
        code: 'ops-manager',
      },
      select: {
        id: true,
      },
    });
    const penaltyReadPermission = await prisma.permission.findFirst({
      where: {
        code: 'petpal.penalty.read',
      },
      select: {
        id: true,
      },
    });

    assert.ok(managerUser);
    assert.ok(managerRole);
    assert.ok(penaltyReadPermission);

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: managerRole.id,
        permissionId: penaltyReadPermission.id,
      },
    });
    await invalidatePermissionCache([managerUser.id]);

    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    assert.equal(managerSession.user.permissions.includes('petpal.penalty.read'), false);
    assert.equal(managerSession.user.permissions.includes('petpal.penalty.manage'), true);

    await request(app)
      .get('/api/petpal/admin/penalties')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .query({
        page: 1,
        pageSize: 10,
      })
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/penalties/stats')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .expect(200);
  });
});
