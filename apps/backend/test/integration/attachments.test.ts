import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import {
  binaryParser,
  bootstrapBackendTestContext,
  type BackendTestContext,
  loadWorksheet,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  uploadManagedFileForTest,
  withClientAuth,
} from '../support/backend-testkit';
import { cleanupOrphanManagedAttachments } from '../../src/timers/upload-reconcile/cleanup-orphan-managed-attachments';

let context: BackendTestContext;

const resolveUploadPath = (objectKey: string) => path.resolve(process.cwd(), 'uploads', objectKey);

const resolveManagedUploadPath = async (fileId: string) => {
  const asset = await context.prismaRaw.mediaAsset.findUnique({
    where: { id: fileId },
    select: {
      objectKey: true,
    },
  });

  assert.ok(asset);
  return resolveUploadPath(asset.objectKey);
};

const loadManagedAttachmentMaterial = async (fileId: string) => {
  const asset = await context.prismaRaw.mediaAsset.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      url: true,
      createdAt: true,
    },
  });

  assert.ok(asset);
  assert.ok(asset.url);

  return {
    fileId: asset.id,
    url: asset.url,
    name: asset.originalName,
    mimeType: asset.mimeType,
    size: Number(asset.size),
    uploadedAt: asset.createdAt.toISOString(),
  };
};

const createPenaltyReferenceScenario = async (input: {
  targetUserId: string;
  rectifyMaterial: {
    fileId: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
    uploadedAt: string;
  };
}) => {
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
      id: `req-attachment-reference-${suffix}`,
      ownerId: ownerSession.user.id,
      petId: pet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-03T09:00:00.000Z'),
      endTime: new Date('2026-04-03T10:00:00.000Z'),
      locationText: `杭州市滨江区附件治理测试-${suffix}`,
      budgetAmount: 88,
      demandTags: ['attachment-governance', suffix],
      status: 'MATCHED',
      matchedCaregiverId: caregiverProfile.id,
    },
  });

  const order = await prisma.orderMain.create({
    data: {
      id: `order-attachment-reference-${suffix}`,
      orderNo: `PP-ATTACH-${Date.now()}`,
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
      id: `complaint-attachment-reference-${suffix}`,
      orderId: order.id,
      complainantId: ownerSession.user.id,
      targetRole: 'CAREGIVER',
      complaintType: 'SERVICE',
      description: `处罚整改附件引用治理测试 ${suffix}`,
      evidenceUrls: ['https://example.com/evidence/attachment-reference'],
      status: 'PROCESSING',
    },
  });

  const penalty = await prisma.penaltyRecord.create({
    data: {
      id: `penalty-attachment-reference-${suffix}`,
      complaintId: complaint.id,
      orderId: order.id,
      targetRole: 'CAREGIVER',
      targetUserId: input.targetUserId,
      penaltyType: 'SERVICE_RESTRICTION',
      severity: 'HIGH',
      reason: `处罚整改附件引用治理测试 ${suffix}`,
      actionSummary: '限制接单并要求补交整改材料',
      rectifyStatus: 'COMPLETED',
      rectifyNote: '已补交整改材料',
      rectifiedAt: new Date('2026-04-04T08:30:00.000Z'),
      rectifyEvidenceUrls: [input.rectifyMaterial.url],
      rectifyEvidenceMaterials: [input.rectifyMaterial],
      rectifyReviewStatus: 'PENDING',
    },
    select: {
      id: true,
      order: {
        select: {
          orderNo: true,
        },
      },
    },
  });

  return {
    penaltyId: penalty.id,
    orderNo: penalty.order.orderNo,
  };
};

const createComplaintOrderScenario = async () => {
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
      id: `req-complaint-attachment-reference-${suffix}`,
      ownerId: ownerSession.user.id,
      petId: pet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-03T11:00:00.000Z'),
      endTime: new Date('2026-04-03T12:00:00.000Z'),
      locationText: `杭州市滨江区投诉附件治理测试-${suffix}`,
      budgetAmount: 76,
      demandTags: ['complaint-attachment-governance', suffix],
      status: 'MATCHED',
      matchedCaregiverId: caregiverProfile.id,
    },
  });

  const order = await prisma.orderMain.create({
    data: {
      id: `order-complaint-attachment-reference-${suffix}`,
      orderNo: `PP-COMPLAINT-ATTACH-${Date.now()}`,
      ownerId: ownerSession.user.id,
      caregiverId: caregiverProfile.id,
      serviceRequestId: requestRecord.id,
      serviceType: 'WALKING',
      appointmentStart: new Date('2026-04-03T11:00:00.000Z'),
      appointmentEnd: new Date('2026-04-03T12:00:00.000Z'),
      amountTotal: 76,
      amountAdjusted: 0,
      amountPaid: 76,
      amountRefunded: 0,
      orderStatus: 'DISPUTED',
    },
    select: {
      id: true,
      orderNo: true,
      ownerId: true,
    },
  });

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    complainantId: order.ownerId,
  };
};

const createComplaintReferenceScenario = async (input: {
  evidenceUrl: string;
  order?: {
    orderId: string;
    orderNo: string;
    complainantId: string;
  };
}) => {
  const { prisma } = context;
  const order = input.order ?? await createComplaintOrderScenario();

  const complaint = await prisma.complaint.create({
    data: {
      id: `complaint-url-attachment-reference-${Date.now().toString(36)}`,
      orderId: order.orderId,
      complainantId: order.complainantId,
      targetRole: 'CAREGIVER',
      complaintType: 'SERVICE',
      description: `投诉附件引用治理测试 ${Date.now().toString(36)}`,
      evidenceUrls: [input.evidenceUrl],
      status: 'PROCESSING',
    },
    select: {
      id: true,
    },
  });

  return {
    complaintId: complaint.id,
    orderNo: order.orderNo,
  };
};

const createOrderMessageReferenceScenario = async (input: {
  mediaUrl: string;
  order?: {
    orderId: string;
    orderNo: string;
    complainantId: string;
  };
}) => {
  const { prisma } = context;
  const order = input.order ?? await createComplaintOrderScenario();
  const suffix = Date.now().toString(36);

  const conversation = await prisma.orderConversation.create({
    data: {
      id: `conversation-message-attachment-reference-${suffix}`,
      orderId: order.orderId,
      ownerUnreadCount: 0,
      caregiverUnreadCount: 1,
      lastMessageAt: new Date('2026-04-04T09:00:00.000Z'),
      lastMessagePreview: '[附件消息]',
    },
    select: {
      id: true,
    },
  });

  const message = await prisma.orderMessage.create({
    data: {
      id: `message-attachment-reference-${suffix}`,
      conversationId: conversation.id,
      senderRole: 'OWNER',
      senderUserId: order.complainantId,
      content: null,
      mediaUrls: [input.mediaUrl],
    },
    select: {
      id: true,
    },
  });

  return {
    messageId: message.id,
    orderNo: order.orderNo,
  };
};

const waitForFileRemoval = async (filePath: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await fs.access(filePath);
      await delay(25);
    } catch {
      return;
    }
  }

  await assert.rejects(fs.access(filePath));
};

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('Attachment integration', () => {
  it('supports attachment management CRUD, tag filters and xlsx export', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const primaryUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'invoice-q1.pdf',
      contentType: 'application/pdf',
      content: 'invoice-q1-content',
      kind: 'attachment',
      tag1: 'finance',
      tag2: 'invoice',
    });

    const secondaryUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'contract.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: 'contract-content',
      kind: 'attachment',
      tag1: 'hr',
      tag2: 'contract',
    });

    assert.match(primaryUpload.url, /attachments\//);
    assert.match(secondaryUpload.url, /attachments\//);

    const primaryAsset = await context.prismaRaw.mediaAsset.findUnique({
      where: { id: primaryUpload.fileId },
      select: {
        id: true,
        objectKey: true,
      },
    });

    assert.ok(primaryAsset);
    const primaryUploadPath = resolveUploadPath(primaryAsset.objectKey);

    const filteredList = await request(app)
      .get('/api/attachments')
      .query({
        page: 1,
        pageSize: 10,
        kind: 'attachment',
        uploadStatus: 'COMPLETED',
        tag1: 'finance',
        tag2: 'invoice',
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(filteredList.body.data.meta.total, 1);
    assert.equal(filteredList.body.data.items[0].id, primaryUpload.fileId);
    assert.equal(filteredList.body.data.items[0].tag1, 'finance');
    assert.equal(filteredList.body.data.items[0].tag2, 'invoice');
    assert.equal(filteredList.body.data.items[0].owner.username, 'admin');

    const detailResponse = await request(app)
      .get(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(detailResponse.body.data.originalName, 'invoice-q1.pdf');
    assert.equal(detailResponse.body.data.kind, 'attachment');

    const updatedAttachment = await request(app)
      .put(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        originalName: 'invoice-q1-reviewed.pdf',
        tag1: 'finance-review',
        tag2: 'archived',
      })
      .expect(200);

    assert.equal(updatedAttachment.body.data.originalName, 'invoice-q1-reviewed.pdf');
    assert.equal(updatedAttachment.body.data.tag1, 'finance-review');
    assert.equal(updatedAttachment.body.data.tag2, 'archived');

    const exportResponse = await request(app)
      .get('/api/attachments/export')
      .query({ tag1: 'finance-review', tag2: 'archived' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const attachmentSheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(attachmentSheet.name, 'Attachments');
    assert.equal(attachmentSheet.getRow(1).getCell(1).value, '文件名');
    assert.equal(attachmentSheet.rowCount, 2);
    assert.equal(attachmentSheet.getRow(2).getCell(1).value, 'invoice-q1-reviewed.pdf');
    assert.equal(attachmentSheet.getRow(2).getCell(2).value, 'attachment');
    assert.equal(attachmentSheet.getRow(2).getCell(3).value, 'finance-review');
    assert.equal(attachmentSheet.getRow(2).getCell(4).value, 'archived');

    await request(app)
      .delete(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const deletedPrimaryAsset = await context.prismaRaw.mediaAsset.findUnique({
      where: { id: primaryUpload.fileId },
      select: {
        id: true,
        deleteAt: true,
      },
    });

    assert.ok(deletedPrimaryAsset);
    assert.notEqual(deletedPrimaryAsset.deleteAt, null);
    await waitForFileRemoval(primaryUploadPath);

    await request(app)
      .get(`/api/attachments/${primaryUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(404);

    const remainingAttachment = await request(app)
      .get('/api/attachments')
      .query({ page: 1, pageSize: 10, tag1: 'hr', tag2: 'contract' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(remainingAttachment.body.data.meta.total, 1);
    assert.equal(remainingAttachment.body.data.items[0].id, secondaryUpload.fileId);
  });

  it('supports image option search and resolve for image selectors', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const smallImageContent = 'small-image';
    const largeAvatarContent = 'large-avatar-image-content';

    const imageUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'brand-cover.png',
      contentType: 'image/png',
      content: smallImageContent,
      kind: 'attachment',
      tag1: 'brand',
      tag2: 'cover',
    });

    const avatarUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'brand-avatar.png',
      contentType: 'image/png',
      content: largeAvatarContent,
      kind: 'avatar',
      tag1: 'brand',
      tag2: 'avatar',
    });

    await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'readme.pdf',
      contentType: 'application/pdf',
      content: 'pdf-content',
      kind: 'attachment',
      tag1: 'brand',
      tag2: 'document',
    });

    const imageOptions = await request(app)
      .post('/api/attachments/options/images')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        page: 1,
        pageSize: 10,
        q: 'brand',
      })
      .expect(200);

    assert.equal(imageOptions.body.data.meta.total, 2);
    assert.deepEqual(
      imageOptions.body.data.items.map((item: { id: string }) => item.id).sort(),
      [avatarUpload.fileId, imageUpload.fileId].sort(),
    );
    assert.ok(
      imageOptions.body.data.items.every((item: { mimeType: string }) => item.mimeType === 'image/png'),
    );

    const maxSizeFilteredOptions = await request(app)
      .post('/api/attachments/options/images')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        page: 1,
        pageSize: 10,
        q: 'brand',
        maxSize: Buffer.byteLength(smallImageContent),
      })
      .expect(200);

    assert.equal(maxSizeFilteredOptions.body.data.meta.total, 1);
    assert.equal(maxSizeFilteredOptions.body.data.items[0].id, imageUpload.fileId);
    assert.ok(
      maxSizeFilteredOptions.body.data.items.every(
        (item: { size: number }) => item.size <= Buffer.byteLength(smallImageContent),
      ),
    );

    const resolved = await request(app)
      .post('/api/attachments/options/images/resolve')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        ids: [avatarUpload.fileId, imageUpload.fileId],
      })
      .expect(200);

    assert.equal(resolved.body.data.length, 2);
    assert.deepEqual(
      resolved.body.data.map((item: { id: string }) => item.id),
      [avatarUpload.fileId, imageUpload.fileId],
    );
  });

  it('surfaces PetPal business references and blocks deleting referenced attachments', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    const managerUser = await context.prismaRaw.user.findUnique({
      where: { id: managerSession.user.id },
      select: {
        nickname: true,
        username: true,
      },
    });

    assert.ok(managerUser);

    const tag1 = `slice-222-${Date.now().toString(36)}`;
    const qualificationUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'caregiver-qualification.jpg',
      contentType: 'image/jpeg',
      content: 'caregiver-qualification-content',
      kind: 'attachment',
      tag1,
      tag2: 'caregiver-qualification',
    });
    const penaltyUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'penalty-rectify.jpg',
      contentType: 'image/jpeg',
      content: 'penalty-rectify-content',
      kind: 'attachment',
      tag1,
      tag2: 'penalty-rectify',
    });
    const complaintUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'complaint-evidence.jpg',
      contentType: 'image/jpeg',
      content: 'complaint-evidence-content',
      kind: 'attachment',
      tag1,
      tag2: 'complaint-evidence',
    });
    const messageUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'message-evidence.jpg',
      contentType: 'image/jpeg',
      content: 'message-evidence-content',
      kind: 'attachment',
      tag1,
      tag2: 'order-message',
    });
    const freeUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'free-attachment.txt',
      contentType: 'text/plain',
      content: 'free-attachment-content',
      kind: 'attachment',
      tag1,
      tag2: 'free',
    });

    const qualificationMaterial = await loadManagedAttachmentMaterial(qualificationUpload.fileId);
    const complaintMaterial = await loadManagedAttachmentMaterial(complaintUpload.fileId);
    const messageMaterial = await loadManagedAttachmentMaterial(messageUpload.fileId);
    const rectifyMaterial = await loadManagedAttachmentMaterial(penaltyUpload.fileId);

    const caregiverProfile = await context.prismaRaw.caregiverProfile.update({
      where: {
        userId: managerSession.user.id,
      },
      data: {
        qualificationMaterials: [qualificationMaterial],
      },
      select: {
        id: true,
      },
    });

    const penaltyReference = await createPenaltyReferenceScenario({
      targetUserId: managerSession.user.id,
      rectifyMaterial,
    });
    const complaintReference = await createComplaintReferenceScenario({
      evidenceUrl: complaintMaterial.url,
    });
    const messageReference = await createOrderMessageReferenceScenario({
      mediaUrl: messageMaterial.url,
    });

    const listResponse = await request(app)
      .get('/api/attachments')
      .query({
        page: 1,
        pageSize: 10,
        tag1,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(listResponse.body.data.meta.total, 5);

    const qualificationItem = listResponse.body.data.items.find(
      (item: { id: string }) => item.id === qualificationUpload.fileId,
    );
    const penaltyItem = listResponse.body.data.items.find(
      (item: { id: string }) => item.id === penaltyUpload.fileId,
    );
    const complaintItem = listResponse.body.data.items.find(
      (item: { id: string }) => item.id === complaintUpload.fileId,
    );
    const messageItem = listResponse.body.data.items.find(
      (item: { id: string }) => item.id === messageUpload.fileId,
    );
    const freeItem = listResponse.body.data.items.find(
      (item: { id: string }) => item.id === freeUpload.fileId,
    );

    assert.ok(qualificationItem);
    assert.ok(penaltyItem);
    assert.ok(complaintItem);
    assert.ok(messageItem);
    assert.ok(freeItem);
    assert.equal(qualificationItem.referenceCount, 1);
    assert.equal(qualificationItem.references[0].kind, 'PETPAL_CAREGIVER_QUALIFICATION');
    assert.equal(qualificationItem.references[0].entityId, caregiverProfile.id);
    assert.match(qualificationItem.references[0].note, /照料者资质材料/);
    assert.match(qualificationItem.references[0].note, new RegExp(managerUser.username));
    assert.equal(penaltyItem.referenceCount, 1);
    assert.equal(penaltyItem.references[0].kind, 'PETPAL_PENALTY_RECTIFY');
    assert.equal(penaltyItem.references[0].entityId, penaltyReference.penaltyId);
    assert.match(penaltyItem.references[0].note, /处罚整改凭证/);
    assert.match(penaltyItem.references[0].title, new RegExp(penaltyReference.orderNo));
    assert.equal(complaintItem.referenceCount, 1);
    assert.equal(complaintItem.references[0].kind, 'PETPAL_ORDER_COMPLAINT');
    assert.equal(complaintItem.references[0].entityId, complaintReference.complaintId);
    assert.match(complaintItem.references[0].note, /订单投诉证据/);
    assert.match(complaintItem.references[0].title, new RegExp(complaintReference.orderNo));
    assert.equal(messageItem.referenceCount, 1);
    assert.equal(messageItem.references[0].kind, 'PETPAL_ORDER_MESSAGE');
    assert.equal(messageItem.references[0].entityId, messageReference.messageId);
    assert.match(messageItem.references[0].note, /订单消息附件/);
    assert.match(messageItem.references[0].title, new RegExp(messageReference.orderNo));
    assert.equal(freeItem.referenceCount, 0);
    assert.deepEqual(freeItem.references, []);

    const detailResponse = await request(app)
      .get(`/api/attachments/${qualificationUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(detailResponse.body.data.referenceCount, 1);
    assert.equal(detailResponse.body.data.references[0].kind, 'PETPAL_CAREGIVER_QUALIFICATION');
    assert.equal(detailResponse.body.data.references[0].entityId, caregiverProfile.id);
    assert.match(detailResponse.body.data.references[0].title, new RegExp(managerUser.nickname));

    const blockedQualificationDelete = await request(app)
      .delete(`/api/attachments/${qualificationUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(blockedQualificationDelete.body.message, /Attachment is still referenced by business records/);
    assert.match(blockedQualificationDelete.body.message, /照料者资质材料/);

    const blockedPenaltyDelete = await request(app)
      .delete(`/api/attachments/${penaltyUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(blockedPenaltyDelete.body.message, /Attachment is still referenced by business records/);
    assert.match(blockedPenaltyDelete.body.message, new RegExp(penaltyReference.orderNo));

    const blockedComplaintDelete = await request(app)
      .delete(`/api/attachments/${complaintUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(blockedComplaintDelete.body.message, /Attachment is still referenced by business records/);
    assert.match(blockedComplaintDelete.body.message, new RegExp(complaintReference.orderNo));

    const blockedMessageDelete = await request(app)
      .delete(`/api/attachments/${messageUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(blockedMessageDelete.body.message, /Attachment is still referenced by business records/);
    assert.match(blockedMessageDelete.body.message, new RegExp(messageReference.orderNo));
  });

  it('cleans up stale unreferenced PetPal managed attachments without touching referenced or generic files', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');
    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const caregiverProfile = await context.prismaRaw.caregiverProfile.findUnique({
      where: {
        userId: managerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(caregiverProfile);

    const orphanComplaintOrder = await createComplaintOrderScenario();
    const referencedComplaintOrder = await createComplaintOrderScenario();
    const orphanMessageOrder = await createComplaintOrderScenario();
    const referencedMessageOrder = await createComplaintOrderScenario();

    const orphanQualificationUpload = await uploadManagedFileForTest(app, {
      accessToken: managerSession.tokens.accessToken,
      fileName: 'stale-caregiver-qualification.jpg',
      contentType: 'image/jpeg',
      content: 'stale-caregiver-qualification-content',
      kind: 'attachment',
      tag1: 'petpal-caregiver-qualification',
      tag2: caregiverProfile.id,
    });
    const referencedQualificationUpload = await uploadManagedFileForTest(app, {
      accessToken: managerSession.tokens.accessToken,
      fileName: 'referenced-caregiver-qualification.jpg',
      contentType: 'image/jpeg',
      content: 'referenced-caregiver-qualification-content',
      kind: 'attachment',
      tag1: 'petpal-caregiver-qualification',
      tag2: caregiverProfile.id,
    });
    const orphanPenaltyUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'stale-penalty-rectify.jpg',
      contentType: 'image/jpeg',
      content: 'stale-penalty-rectify-content',
      kind: 'attachment',
      tag1: 'petpal-penalty',
      tag2: 'rectify',
    });
    const referencedPenaltyUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'referenced-penalty-rectify.jpg',
      contentType: 'image/jpeg',
      content: 'referenced-penalty-rectify-content',
      kind: 'attachment',
      tag1: 'petpal-penalty',
      tag2: 'rectify',
    });
    const orphanComplaintUpload = await uploadManagedFileForTest(app, {
      accessToken: ownerSession.tokens.accessToken,
      fileName: 'stale-complaint-evidence.jpg',
      contentType: 'image/jpeg',
      content: 'stale-complaint-evidence-content',
      kind: 'attachment',
      tag1: 'petpal-order-complaint',
      tag2: orphanComplaintOrder.orderId,
    });
    const referencedComplaintUpload = await uploadManagedFileForTest(app, {
      accessToken: ownerSession.tokens.accessToken,
      fileName: 'referenced-complaint-evidence.jpg',
      contentType: 'image/jpeg',
      content: 'referenced-complaint-evidence-content',
      kind: 'attachment',
      tag1: 'petpal-order-complaint',
      tag2: referencedComplaintOrder.orderId,
    });
    const orphanMessageUpload = await uploadManagedFileForTest(app, {
      accessToken: ownerSession.tokens.accessToken,
      fileName: 'stale-order-message.jpg',
      contentType: 'image/jpeg',
      content: 'stale-order-message-content',
      kind: 'attachment',
      tag1: 'petpal-order-message',
      tag2: orphanMessageOrder.orderId,
    });
    const referencedMessageUpload = await uploadManagedFileForTest(app, {
      accessToken: ownerSession.tokens.accessToken,
      fileName: 'referenced-order-message.jpg',
      contentType: 'image/jpeg',
      content: 'referenced-order-message-content',
      kind: 'attachment',
      tag1: 'petpal-order-message',
      tag2: referencedMessageOrder.orderId,
    });
    const genericAttachmentUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'generic-attachment.txt',
      contentType: 'text/plain',
      content: 'generic-attachment-content',
      kind: 'attachment',
      tag1: 'generic',
      tag2: 'archive',
    });

    const staleAt = new Date('2026-04-01T08:00:00.000Z');
    await context.prismaRaw.mediaAsset.updateMany({
      where: {
        id: {
          in: [
            orphanQualificationUpload.fileId,
            referencedQualificationUpload.fileId,
            orphanPenaltyUpload.fileId,
            referencedPenaltyUpload.fileId,
            orphanComplaintUpload.fileId,
            referencedComplaintUpload.fileId,
            orphanMessageUpload.fileId,
            referencedMessageUpload.fileId,
            genericAttachmentUpload.fileId,
          ],
        },
      },
      data: {
        completedAt: staleAt,
      },
    });

    const referencedQualificationMaterial = await loadManagedAttachmentMaterial(referencedQualificationUpload.fileId);
    const referencedComplaintMaterial = await loadManagedAttachmentMaterial(referencedComplaintUpload.fileId);
    const referencedMessageMaterial = await loadManagedAttachmentMaterial(referencedMessageUpload.fileId);
    const referencedPenaltyMaterial = await loadManagedAttachmentMaterial(referencedPenaltyUpload.fileId);
    await context.prismaRaw.caregiverProfile.update({
      where: {
        id: caregiverProfile.id,
      },
      data: {
        qualificationMaterials: [referencedQualificationMaterial],
      },
    });

    await createPenaltyReferenceScenario({
      targetUserId: managerSession.user.id,
      rectifyMaterial: referencedPenaltyMaterial,
    });
    await createComplaintReferenceScenario({
      evidenceUrl: referencedComplaintMaterial.url,
      order: referencedComplaintOrder,
    });
    await createOrderMessageReferenceScenario({
      mediaUrl: referencedMessageMaterial.url,
      order: referencedMessageOrder,
    });

    const orphanQualificationPath = await resolveManagedUploadPath(orphanQualificationUpload.fileId);
    const orphanComplaintPath = await resolveManagedUploadPath(orphanComplaintUpload.fileId);
    const orphanMessagePath = await resolveManagedUploadPath(orphanMessageUpload.fileId);
    const orphanPenaltyPath = await resolveManagedUploadPath(orphanPenaltyUpload.fileId);
    const genericAttachmentPath = await resolveManagedUploadPath(genericAttachmentUpload.fileId);

    const cleanupResult = await cleanupOrphanManagedAttachments({
      now: new Date('2026-04-04T12:00:00.000Z'),
      graceMinutes: 60,
      batchSize: 20,
    });

    assert.deepEqual(cleanupResult, {
      checked: 8,
      deleted: 4,
      keptReferenced: 4,
      blocked: 0,
    });

    const deletedAssets = await context.prismaRaw.mediaAsset.findMany({
      where: {
        id: {
          in: [
            orphanQualificationUpload.fileId,
            orphanPenaltyUpload.fileId,
            orphanComplaintUpload.fileId,
            orphanMessageUpload.fileId,
          ],
        },
      },
      select: {
        id: true,
        deleteAt: true,
      },
    });

    assert.equal(deletedAssets.length, 4);
    assert.ok(deletedAssets.every((item) => item.deleteAt !== null));
    await waitForFileRemoval(orphanQualificationPath);
    await waitForFileRemoval(orphanComplaintPath);
    await waitForFileRemoval(orphanMessagePath);
    await waitForFileRemoval(orphanPenaltyPath);

    const referencedQualificationDetail = await request(app)
      .get(`/api/attachments/${referencedQualificationUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(referencedQualificationDetail.body.data.referenceCount, 1);

    const referencedPenaltyDetail = await request(app)
      .get(`/api/attachments/${referencedPenaltyUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(referencedPenaltyDetail.body.data.referenceCount, 1);

    const referencedComplaintDetail = await request(app)
      .get(`/api/attachments/${referencedComplaintUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(referencedComplaintDetail.body.data.referenceCount, 1);

    const referencedMessageDetail = await request(app)
      .get(`/api/attachments/${referencedMessageUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(referencedMessageDetail.body.data.referenceCount, 1);

    const genericAttachment = await context.prismaRaw.mediaAsset.findUnique({
      where: {
        id: genericAttachmentUpload.fileId,
      },
      select: {
        deleteAt: true,
      },
    });

    assert.ok(genericAttachment);
    assert.equal(genericAttachment.deleteAt, null);
    await fs.access(genericAttachmentPath);
  });

  it('blocks deleting avatar images that are still referenced by users', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const avatarUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'guarded-avatar.png',
      contentType: 'image/png',
      content: 'guarded-avatar-content',
      kind: 'avatar',
    });

    await withClientAuth(
      request(app)
        .put('/api/auth/avatar')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
        .send({ avatarFileId: avatarUpload.fileId }),
    ).expect(200);

    const blockedDelete = await request(app)
      .delete(`/api/attachments/${avatarUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(400);

    assert.match(blockedDelete.body.message, /User\.avatarFile/);

    await request(app)
      .get(`/api/attachments/${avatarUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    await withClientAuth(
      request(app)
        .put('/api/auth/avatar')
        .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
        .send({ avatarFileId: null }),
    ).expect(200);

    await request(app)
      .delete(`/api/attachments/${avatarUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);
  });

  it('auto-deletes related avatar assets when deleting a user', async () => {
    const { app } = context;
    const adminSession = await loginAs(app, 'admin@example.com', 'Admin123!');

    const memberRole = await context.prismaRaw.role.findFirst({
      where: { code: 'member' },
      select: { id: true },
    });

    assert.ok(memberRole);

    const avatarUpload = await uploadManagedFileForTest(app, {
      accessToken: adminSession.tokens.accessToken,
      fileName: 'user-delete-avatar.png',
      contentType: 'image/png',
      content: 'user-delete-avatar-content',
      kind: 'avatar',
    });

    const avatarAsset = await context.prismaRaw.mediaAsset.findUnique({
      where: { id: avatarUpload.fileId },
      select: {
        id: true,
        objectKey: true,
      },
    });

    assert.ok(avatarAsset);
    const avatarUploadPath = resolveUploadPath(avatarAsset.objectKey);

    const createdUser = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        username: 'trigger-cleanup-user',
        email: 'trigger-cleanup-user@example.com',
        nickname: 'Trigger Cleanup User',
        password: 'Trigger123!',
        avatarFileId: avatarUpload.fileId,
        status: 'ACTIVE',
        roleIds: [memberRole.id],
      })
      .expect(200);

    await request(app)
      .delete(`/api/users/${createdUser.body.data.id}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    const deletedAvatar = await context.prismaRaw.mediaAsset.findUnique({
      where: { id: avatarUpload.fileId },
      select: {
        id: true,
        deleteAt: true,
      },
    });

    assert.ok(deletedAvatar);
    assert.notEqual(deletedAvatar.deleteAt, null);
    await waitForFileRemoval(avatarUploadPath);

    await request(app)
      .get(`/api/attachments/${avatarUpload.fileId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(404);
  });
});
