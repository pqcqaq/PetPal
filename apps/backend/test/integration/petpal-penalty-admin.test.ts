import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  uploadManagedFileForTest,
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

const createPenaltyScenario = async () => {
  const complaintScenario = await createComplaintScenario();
  const adminSession = await loginAs(complaintScenario.app, 'admin', 'Admin123!');

  const penaltyActionResponse = await request(complaintScenario.app)
    .post(`/api/petpal/admin/complaints/${complaintScenario.complaintId}/actions`)
    .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
    .send({
      actionType: 'PENALTY',
      penaltyType: 'SERVICE_RESTRICTION',
      penaltySeverity: 'HIGH',
      penaltyReason: `未按平台要求上传服务影像 ${complaintScenario.suffix}`,
      penaltyActionSummary: '限制接单 7 天并要求补交完整服务记录',
      rectifyDueAt: '2026-04-06T08:00:00.000Z',
    })
    .expect(200);

  const complaintRecord = penaltyActionResponse.body.data as {
    penalties: Array<{
      id: string;
    }>;
  };

  return {
    ...complaintScenario,
    adminSession,
    penaltyId: complaintRecord.penalties[0]!.id,
  };
};

const uploadRectifyEvidenceFiles = async (
  app: BackendTestContext['app'],
  accessToken: string,
  files: Array<{
    fileName: string;
    contentType: string;
    content: string;
  }>,
) => {
  const uploads: Array<{
    fileId: string;
    url: string;
  }> = [];

  for (const file of files) {
    uploads.push(
      await uploadManagedFileForTest(app, {
        accessToken,
        fileName: file.fileName,
        contentType: file.contentType,
        content: file.content,
        kind: 'attachment',
        tag1: 'petpal-penalty',
        tag2: 'rectify',
      }),
    );
  }

  return uploads;
};

describe('PetPal penalty admin integration', () => {
  it('admin can submit and approve penalty rectification attachments', async () => {
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
    const [rectifyVideo, rectifyReport] = await uploadRectifyEvidenceFiles(
      app,
      adminSession.tokens.accessToken,
      [
        {
          fileName: `rectify-video-${suffix}.mp4`,
          contentType: 'video/mp4',
          content: 'rectify-video-content',
        },
        {
          fileName: `rectify-report-${suffix}.pdf`,
          contentType: 'application/pdf',
          content: 'rectify-report-content',
        },
      ],
    );

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
      byRectifyReviewStatus: {
        NOT_REQUIRED: 1,
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
      },
      byAppealStatus: {
        NONE: 1,
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
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
    assert.equal(listResponse.body.data.items[0].appealStatus, 'NONE');

    const rectifyResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '已补交服务影像并完成内部复盘。',
        rectifyEvidenceFileIds: [rectifyVideo.fileId, rectifyReport.fileId],
      })
      .expect(200);

    assert.equal(rectifyResponse.body.data.rectifyStatus, 'COMPLETED');
    assert.equal(rectifyResponse.body.data.rectifyReviewStatus, 'PENDING');
    assert.equal(rectifyResponse.body.data.rectifyNote, '已补交服务影像并完成内部复盘。');
    assert.deepEqual(
      rectifyResponse.body.data.rectifyEvidenceMaterials.map((item: { fileId: string }) => item.fileId),
      [rectifyVideo.fileId, rectifyReport.fileId],
    );
    assert.deepEqual(rectifyResponse.body.data.rectifyEvidenceUrls, [
      rectifyVideo.url,
      rectifyReport.url,
    ]);
    assert.equal(rectifyResponse.body.data.rectifyReviewNote, null);
    assert.equal(rectifyResponse.body.data.rectifyReviewedAt, null);

    const pendingReviewListResponse = await request(app)
      .get('/api/petpal/admin/penalties')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        rectifyReviewStatus: 'PENDING',
        keyword: suffix,
      })
      .expect(200);

    assert.equal(pendingReviewListResponse.body.data.pagination.total, 1);
    assert.equal(pendingReviewListResponse.body.data.items[0].id, penaltyId);
    assert.equal(pendingReviewListResponse.body.data.items[0].rectifyReviewStatus, 'PENDING');

    const reviewResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'APPROVED',
        reviewNote: '整改材料齐全，复核通过。',
      })
      .expect(200);

    assert.equal(reviewResponse.body.data.rectifyStatus, 'COMPLETED');
    assert.equal(reviewResponse.body.data.rectifyReviewStatus, 'APPROVED');
    assert.equal(reviewResponse.body.data.rectifyReviewedById, adminSession.user.id);
    assert.equal(reviewResponse.body.data.rectifyReviewNote, '整改材料齐全，复核通过。');

    const reviewedStatsResponse = await request(app)
      .get('/api/petpal/admin/penalties/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        keyword: suffix,
      })
      .expect(200);

    assert.deepEqual(reviewedStatsResponse.body.data.byRectifyReviewStatus, {
      NOT_REQUIRED: 0,
      PENDING: 0,
      APPROVED: 1,
      REJECTED: 0,
    });

    const penaltyRecord = await prisma.penaltyRecord.findFirst({
      where: {
        id: penaltyId,
      },
      select: {
        rectifyStatus: true,
        rectifyNote: true,
        rectifyEvidenceMaterials: true,
        rectifyEvidenceUrls: true,
        rectifyReviewStatus: true,
        rectifyReviewNote: true,
        rectifyReviewedAt: true,
        rectifyReviewedById: true,
        rectifiedAt: true,
        updateId: true,
      },
    });

    assert.ok(penaltyRecord);
    assert.equal(penaltyRecord.rectifyStatus, 'COMPLETED');
    assert.equal(penaltyRecord.rectifyReviewStatus, 'APPROVED');
    assert.equal(penaltyRecord.rectifyNote, '已补交服务影像并完成内部复盘。');
    assert.equal(penaltyRecord.rectifyReviewNote, '整改材料齐全，复核通过。');
    assert.equal(penaltyRecord.rectifyReviewedById, adminSession.user.id);
    assert.deepEqual(
      (penaltyRecord.rectifyEvidenceMaterials as Array<{ fileId: string }>).map((item) => item.fileId),
      [rectifyVideo.fileId, rectifyReport.fileId],
    );
    assert.deepEqual(penaltyRecord.rectifyEvidenceUrls, [
      rectifyVideo.url,
      rectifyReport.url,
    ]);
    assert.ok(penaltyRecord.rectifiedAt);
    assert.ok(penaltyRecord.rectifyReviewedAt);
    assert.equal(penaltyRecord.updateId, adminSession.user.id);
  });

  it('requires evidence attachments for completed rectification but allows waived without evidence', async () => {
    const { app, prisma, adminSession, penaltyId } = await createPenaltyScenario();

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '仅填写说明但未补交材料',
      })
      .expect(400);

    const invalidAttachmentResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '尝试提交不存在的整改附件',
        rectifyEvidenceFileIds: ['missing-rectify-attachment'],
      })
      .expect(400);

    assert.equal(
      invalidAttachmentResponse.body.message,
      'Penalty rectification evidence attachments are invalid',
    );

    const waiveResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'WAIVED',
        rectifyNote: '平台复核后确认无需继续整改，予以豁免。',
      })
      .expect(200);

    assert.equal(waiveResponse.body.data.rectifyStatus, 'WAIVED');
    assert.equal(waiveResponse.body.data.rectifyReviewStatus, 'NOT_REQUIRED');
    assert.deepEqual(waiveResponse.body.data.rectifyEvidenceUrls, []);

    const penaltyRecord = await prisma.penaltyRecord.findFirst({
      where: {
        id: penaltyId,
      },
      select: {
        rectifyStatus: true,
        rectifyEvidenceMaterials: true,
        rectifyEvidenceUrls: true,
      },
    });

    assert.ok(penaltyRecord);
    assert.equal(penaltyRecord.rectifyStatus, 'WAIVED');
    assert.equal(penaltyRecord.rectifyEvidenceMaterials, null);
    assert.equal(penaltyRecord.rectifyEvidenceUrls, null);
  });

  it('can reject rectification review and allow resubmission', async () => {
    const { app, prisma, adminSession, penaltyId } = await createPenaltyScenario();

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'REJECTED',
        reviewNote: '尚未提交整改材料',
      })
      .expect(400);

    const [firstPassAttachment] = await uploadRectifyEvidenceFiles(
      app,
      adminSession.tokens.accessToken,
      [
        {
          fileName: 'rectify-first-pass.mp4',
          contentType: 'video/mp4',
          content: 'rectify-first-pass',
        },
      ],
    );

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '已先补交第一版整改材料。',
        rectifyEvidenceFileIds: [firstPassAttachment.fileId],
      })
      .expect(200);

    const rejectReviewResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'REJECTED',
        reviewNote: '缺少完整服务轨迹，请重新补件。',
      })
      .expect(200);

    assert.equal(rejectReviewResponse.body.data.rectifyStatus, 'PENDING');
    assert.equal(rejectReviewResponse.body.data.rectifyReviewStatus, 'REJECTED');
    assert.equal(rejectReviewResponse.body.data.rectifyReviewNote, '缺少完整服务轨迹，请重新补件。');
    assert.deepEqual(
      rejectReviewResponse.body.data.rectifyEvidenceMaterials.map((item: { fileId: string }) => item.fileId),
      [firstPassAttachment.fileId],
    );
    assert.deepEqual(rejectReviewResponse.body.data.rectifyEvidenceUrls, [
      firstPassAttachment.url,
    ]);

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'APPROVED',
        reviewNote: '重复审核',
      })
      .expect(400);

    const [secondPassAttachment, trackLogAttachment] = await uploadRectifyEvidenceFiles(
      app,
      adminSession.tokens.accessToken,
      [
        {
          fileName: 'rectify-second-pass.mp4',
          contentType: 'video/mp4',
          content: 'rectify-second-pass',
        },
        {
          fileName: 'rectify-track-log.pdf',
          contentType: 'application/pdf',
          content: 'rectify-track-log',
        },
      ],
    );

    const resubmitResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '已补交第二版整改材料并附上完整服务轨迹。',
        rectifyEvidenceFileIds: [secondPassAttachment.fileId, trackLogAttachment.fileId],
      })
      .expect(200);

    assert.equal(resubmitResponse.body.data.rectifyStatus, 'COMPLETED');
    assert.equal(resubmitResponse.body.data.rectifyReviewStatus, 'PENDING');
    assert.equal(resubmitResponse.body.data.rectifyReviewNote, null);
    assert.equal(resubmitResponse.body.data.rectifyReviewedAt, null);
    assert.deepEqual(
      resubmitResponse.body.data.rectifyEvidenceMaterials.map((item: { fileId: string }) => item.fileId),
      [secondPassAttachment.fileId, trackLogAttachment.fileId],
    );
    assert.deepEqual(resubmitResponse.body.data.rectifyEvidenceUrls, [
      secondPassAttachment.url,
      trackLogAttachment.url,
    ]);

    const penaltyRecord = await prisma.penaltyRecord.findFirst({
      where: {
        id: penaltyId,
      },
      select: {
        rectifyStatus: true,
        rectifyReviewStatus: true,
        rectifyReviewNote: true,
        rectifyReviewedAt: true,
        rectifyEvidenceMaterials: true,
        rectifyEvidenceUrls: true,
      },
    });

    assert.ok(penaltyRecord);
    assert.equal(penaltyRecord.rectifyStatus, 'COMPLETED');
    assert.equal(penaltyRecord.rectifyReviewStatus, 'PENDING');
    assert.equal(penaltyRecord.rectifyReviewNote, null);
    assert.equal(penaltyRecord.rectifyReviewedAt, null);
    assert.deepEqual(
      (penaltyRecord.rectifyEvidenceMaterials as Array<{ fileId: string }>).map((item) => item.fileId),
      [secondPassAttachment.fileId, trackLogAttachment.fileId],
    );
    assert.deepEqual(penaltyRecord.rectifyEvidenceUrls, [
      secondPassAttachment.url,
      trackLogAttachment.url,
    ]);
  });

  it('admin can submit and approve penalty appeals', async () => {
    const { app, prisma, adminSession, penaltyId, suffix } = await createPenaltyScenario();

    const submitAppealResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        appealReason: `平台处罚依据不完整，需要补充复核 ${suffix}`,
      })
      .expect(200);

    assert.equal(submitAppealResponse.body.data.appealStatus, 'PENDING');
    assert.equal(submitAppealResponse.body.data.appealReason, `平台处罚依据不完整，需要补充复核 ${suffix}`);
    assert.equal(submitAppealResponse.body.data.appealSubmittedById, adminSession.user.id);

    const pendingListResponse = await request(app)
      .get('/api/petpal/admin/penalties')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        appealStatus: 'PENDING',
        keyword: suffix,
      })
      .expect(200);

    assert.equal(pendingListResponse.body.data.pagination.total, 1);
    assert.equal(pendingListResponse.body.data.items[0].id, penaltyId);
    assert.equal(pendingListResponse.body.data.items[0].appealStatus, 'PENDING');

    const pendingStatsResponse = await request(app)
      .get('/api/petpal/admin/penalties/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .query({
        keyword: suffix,
      })
      .expect(200);

    assert.deepEqual(pendingStatsResponse.body.data.byAppealStatus, {
      NONE: 0,
      PENDING: 1,
      APPROVED: 0,
      REJECTED: 0,
    });

    const reviewResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'APPROVED',
        reviewNote: '补充证据不足以支撑原处罚，改为豁免。',
      })
      .expect(200);

    assert.equal(reviewResponse.body.data.appealStatus, 'APPROVED');
    assert.equal(reviewResponse.body.data.rectifyStatus, 'WAIVED');
    assert.equal(reviewResponse.body.data.rectifyReviewStatus, 'NOT_REQUIRED');
    assert.equal(reviewResponse.body.data.appealReviewedById, adminSession.user.id);
    assert.equal(reviewResponse.body.data.appealReviewNote, '补充证据不足以支撑原处罚，改为豁免。');

    const penaltyRecord = await prisma.penaltyRecord.findFirst({
      where: {
        id: penaltyId,
      },
      select: {
        appealStatus: true,
        rectifyStatus: true,
        rectifyReviewStatus: true,
        rectifyNote: true,
        appealReviewedAt: true,
      },
    });

    assert.ok(penaltyRecord);
    assert.equal(penaltyRecord.appealStatus, 'APPROVED');
    assert.equal(penaltyRecord.rectifyStatus, 'WAIVED');
    assert.equal(penaltyRecord.rectifyReviewStatus, 'NOT_REQUIRED');
    assert.equal(penaltyRecord.rectifyNote, '申诉通过：补充证据不足以支撑原处罚，改为豁免。');
    assert.ok(penaltyRecord.appealReviewedAt);
  });

  it('rejects invalid penalty appeal state transitions', async () => {
    const { app, adminSession, penaltyId } = await createPenaltyScenario();

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'REJECTED',
        reviewNote: '未提交申诉材料',
      })
      .expect(400);

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        appealReason: '对处罚事实存在异议，申请复核。',
      })
      .expect(200);

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '申诉待审期间不应允许整改完成',
      })
      .expect(400);

    const rejectResponse = await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'REJECTED',
        reviewNote: '现有补充材料不足，维持原处罚。',
      })
      .expect(200);

    assert.equal(rejectResponse.body.data.appealStatus, 'REJECTED');
    assert.equal(rejectResponse.body.data.rectifyStatus, 'PENDING');

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        appealReason: '再次补交材料',
      })
      .expect(400);

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/appeal/review`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        decision: 'APPROVED',
        reviewNote: '重复审核',
      })
      .expect(400);

    const [reviewedRectifyAttachment] = await uploadRectifyEvidenceFiles(
      app,
      adminSession.tokens.accessToken,
      [
        {
          fileName: 'reviewed-rectify.pdf',
          contentType: 'application/pdf',
          content: 'reviewed-rectify',
        },
      ],
    );

    await request(app)
      .post(`/api/petpal/admin/penalties/${penaltyId}/rectify`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        rectifyStatus: 'COMPLETED',
        rectifyNote: '申诉已驳回，完成整改。',
        rectifyEvidenceFileIds: [reviewedRectifyAttachment.fileId],
      })
      .expect(200);
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
