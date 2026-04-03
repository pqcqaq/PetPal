import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
  PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
  PETPAL_SERVICE_LOG_ATTACHMENT_TAG,
} from '@rbac/api-common';
import request from 'supertest';
import {
  bootstrapBackendTestContext,
  type BackendTestContext,
  loginAs,
  reseedBackendTestContext,
  teardownBackendTestContext,
  uploadManagedFileForTest,
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

describe('File upload integration', () => {
  it('persists FAILED upload status when callback finalization errors', async () => {
    const { app, prismaRaw } = context;
    const session = await loginAs(app, 'admin@example.com', 'Admin123!');

    const prepareResponse = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'broken-upload.txt',
        contentType: 'text/plain',
        size: 32,
      })
      .expect(200);

    const fileId = prepareResponse.body.data.fileId as string;

    await request(app)
      .post('/api/files/callback')
      .set('Authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ fileId })
      .expect(500);

    const asset = await prismaRaw.mediaAsset.findUnique({
      where: { id: fileId },
      select: {
        uploadStatus: true,
        updateId: true,
      },
    });

    assert.ok(asset);
    assert.equal(asset.uploadStatus, 'FAILED');
    assert.equal(asset.updateId, session.user.id);
  });

  it('allows approved caregivers to upload petpal service log media without generic attachment permission', async () => {
    const { app, prisma, prismaRaw } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const deniedPrepare = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'blocked.txt',
        contentType: 'text/plain',
        size: 12,
      })
      .expect(403);

    assert.match(deniedPrepare.body.message, /file\.upload/i);

    const suffix = Date.now().toString(36);
    const pet = await prisma.petProfile.findFirst({
      where: {
        ownerId: memberSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(pet);

    const caregiverProfile = await prisma.caregiverProfile.upsert({
      where: {
        userId: memberSession.user.id,
      },
      update: {
        auditStatus: 'APPROVED',
      },
      create: {
        id: `caregiver-upload-${suffix}`,
        userId: memberSession.user.id,
        auditStatus: 'APPROVED',
      },
      select: {
        id: true,
      },
    });

    const requestRecord = await prisma.serviceRequest.create({
      data: {
        id: `req-upload-${suffix}`,
        ownerId: memberSession.user.id,
        petId: pet.id,
        serviceType: 'WALKING',
        startTime: new Date('2026-04-04T09:00:00.000Z'),
        endTime: new Date('2026-04-04T10:00:00.000Z'),
        locationText: '杭州市西湖区',
        budgetAmount: 66,
        demandTags: ['walk'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfile.id,
      },
    });

    const order = await prisma.orderMain.create({
      data: {
        id: `order-upload-${suffix}`,
        orderNo: `PP-UPLOAD-${Date.now()}`,
        ownerId: memberSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceRequestId: requestRecord.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-04T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-04T10:00:00.000Z'),
        amountTotal: 66,
        orderStatus: 'SERVING',
      },
    });

    const deniedPetpalPrepare = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'wrong-order.jpg',
        contentType: 'image/jpeg',
        size: 128,
        tag1: PETPAL_SERVICE_LOG_ATTACHMENT_TAG,
        tag2: 'order-not-owned',
      })
      .expect(403);

    assert.match(deniedPetpalPrepare.body.message, /file\.upload/i);

    const prepareResponse = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'petpal-service.jpg',
        contentType: 'image/jpeg',
        size: Buffer.byteLength('petpal-service-binary'),
        tag1: PETPAL_SERVICE_LOG_ATTACHMENT_TAG,
        tag2: order.id,
      })
      .expect(200);

    const uploadPart = prepareResponse.body.data.parts[0] as {
      url: string;
      fields: Record<string, string>;
    };
    const uploadPath = new URL(uploadPart.url).pathname;

    const uploadRequest = request(app)
      .post(uploadPath)
      .field(uploadPart.fields);

    await uploadRequest
      .attach(
        'file',
        Buffer.from('petpal-service-binary'),
        {
          filename: 'petpal-service.jpg',
          contentType: 'image/jpeg',
        },
      )
      .expect(204);

    const callbackResponse = await request(app)
      .post('/api/files/callback')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        fileId: prepareResponse.body.data.fileId,
      })
      .expect(200);

    const uploaded = callbackResponse.body.data as {
      fileId: string;
      url: string;
    };

    assert.equal(uploaded.fileId, prepareResponse.body.data.fileId);
    assert.match(uploaded.url, /attachments\//);
    assert.ok(uploaded.fileId);
    assert.match(uploaded.url, /attachments\//);

    const asset = await prismaRaw.mediaAsset.findUnique({
      where: {
        id: uploaded.fileId,
      },
      select: {
        userId: true,
        kind: true,
        tag1: true,
        tag2: true,
        uploadStatus: true,
        url: true,
      },
    });

    assert.ok(asset);
    assert.equal(asset.userId, memberSession.user.id);
    assert.equal(asset.kind, 'attachment');
    assert.equal(asset.tag1, PETPAL_SERVICE_LOG_ATTACHMENT_TAG);
    assert.equal(asset.tag2, order.id);
    assert.equal(asset.uploadStatus, 'COMPLETED');
    assert.equal(asset.url, uploaded.url);
  });

  it('allows caregivers to upload qualification materials only for their own caregiver profile', async () => {
    const { app, prismaRaw } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const profileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    const caregiverId = profileResponse.body.data.id as string;

    await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'wrong-caregiver.jpg',
        contentType: 'image/jpeg',
        size: 256,
        tag1: PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
        tag2: 'caregiver-not-owned',
      })
      .expect(403);

    const prepareResponse = await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'qualification.jpg',
        contentType: 'image/jpeg',
        size: Buffer.byteLength('petpal-qualification-binary'),
        tag1: PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
        tag2: caregiverId,
      })
      .expect(200);

    const uploadPart = prepareResponse.body.data.parts[0] as {
      url: string;
      fields: Record<string, string>;
    };
    const uploadPath = new URL(uploadPart.url).pathname;

    await request(app)
      .post(uploadPath)
      .field(uploadPart.fields)
      .attach(
        'file',
        Buffer.from('petpal-qualification-binary'),
        {
          filename: 'qualification.jpg',
          contentType: 'image/jpeg',
        },
      )
      .expect(204);

    const callbackResponse = await request(app)
      .post('/api/files/callback')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        fileId: prepareResponse.body.data.fileId,
      })
      .expect(200);

    const uploaded = callbackResponse.body.data as {
      fileId: string;
      url: string;
    };

    assert.equal(uploaded.fileId, prepareResponse.body.data.fileId);
    assert.match(uploaded.url, /attachments\//);

    const asset = await prismaRaw.mediaAsset.findUnique({
      where: {
        id: uploaded.fileId,
      },
      select: {
        userId: true,
        kind: true,
        tag1: true,
        tag2: true,
        uploadStatus: true,
        url: true,
      },
    });

    assert.ok(asset);
    assert.equal(asset.userId, memberSession.user.id);
    assert.equal(asset.kind, 'attachment');
    assert.equal(asset.tag1, PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG);
    assert.equal(asset.tag2, caregiverId);
    assert.equal(asset.uploadStatus, 'COMPLETED');
    assert.equal(asset.url, uploaded.url);
  });

  it('allows order participants to upload petpal message attachments without generic attachment permission', async () => {
    const { app, prisma, prismaRaw } = context;
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
        deleteAt: null,
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
        id: `req-message-upload-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: pet.id,
        serviceType: 'WALKING',
        startTime: new Date('2026-04-05T09:00:00.000Z'),
        endTime: new Date('2026-04-05T10:00:00.000Z'),
        locationText: '杭州市上城区',
        budgetAmount: 68,
        demandTags: ['message-upload'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfile.id,
      },
    });

    const order = await prisma.orderMain.create({
      data: {
        id: `order-message-upload-${suffix}`,
        orderNo: `PP-MSG-UPLOAD-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceRequestId: requestRecord.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-05T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-05T10:00:00.000Z'),
        amountTotal: 68,
        amountPaid: 68,
        orderStatus: 'ACCEPTED',
      },
    });

    const ownerUploaded = await uploadManagedFileForTest(app, {
      accessToken: ownerSession.tokens.accessToken,
      fileName: 'owner-message.jpg',
      contentType: 'image/jpeg',
      content: 'owner-message-binary',
      tag1: PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
      tag2: order.id,
    });

    const caregiverUploaded = await uploadManagedFileForTest(app, {
      accessToken: caregiverSession.tokens.accessToken,
      fileName: 'caregiver-message.jpg',
      contentType: 'image/jpeg',
      content: 'caregiver-message-binary',
      tag1: PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
      tag2: order.id,
    });

    const [ownerAsset, caregiverAsset] = await Promise.all([
      prismaRaw.mediaAsset.findUnique({
        where: {
          id: ownerUploaded.fileId,
        },
        select: {
          userId: true,
          tag1: true,
          tag2: true,
          uploadStatus: true,
        },
      }),
      prismaRaw.mediaAsset.findUnique({
        where: {
          id: caregiverUploaded.fileId,
        },
        select: {
          userId: true,
          tag1: true,
          tag2: true,
          uploadStatus: true,
        },
      }),
    ]);

    assert.ok(ownerAsset);
    assert.equal(ownerAsset.userId, ownerSession.user.id);
    assert.equal(ownerAsset.tag1, PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG);
    assert.equal(ownerAsset.tag2, order.id);
    assert.equal(ownerAsset.uploadStatus, 'COMPLETED');

    assert.ok(caregiverAsset);
    assert.equal(caregiverAsset.userId, caregiverSession.user.id);
    assert.equal(caregiverAsset.tag1, PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG);
    assert.equal(caregiverAsset.tag2, order.id);
    assert.equal(caregiverAsset.uploadStatus, 'COMPLETED');

    await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'blocked-message.jpg',
        contentType: 'image/jpeg',
        size: 128,
        tag1: PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
        tag2: order.id,
      })
      .expect(403);
  });

  it('allows order participants to upload petpal complaint attachments without generic attachment permission', async () => {
    const { app, prisma, prismaRaw } = context;
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
        deleteAt: null,
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
        id: `req-complaint-upload-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: pet.id,
        serviceType: 'WALKING',
        startTime: new Date('2026-04-05T11:00:00.000Z'),
        endTime: new Date('2026-04-05T12:00:00.000Z'),
        locationText: '杭州市上城区',
        budgetAmount: 72,
        demandTags: ['complaint-upload'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfile.id,
      },
    });

    const order = await prisma.orderMain.create({
      data: {
        id: `order-complaint-upload-${suffix}`,
        orderNo: `PP-COMPLAINT-UPLOAD-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceRequestId: requestRecord.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-05T11:00:00.000Z'),
        appointmentEnd: new Date('2026-04-05T12:00:00.000Z'),
        amountTotal: 72,
        amountPaid: 72,
        orderStatus: 'ACCEPTED',
      },
    });

    const ownerUploaded = await uploadManagedFileForTest(app, {
      accessToken: ownerSession.tokens.accessToken,
      fileName: 'owner-complaint.jpg',
      contentType: 'image/jpeg',
      content: 'owner-complaint-binary',
      tag1: PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
      tag2: order.id,
    });

    const caregiverUploaded = await uploadManagedFileForTest(app, {
      accessToken: caregiverSession.tokens.accessToken,
      fileName: 'caregiver-complaint.jpg',
      contentType: 'image/jpeg',
      content: 'caregiver-complaint-binary',
      tag1: PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
      tag2: order.id,
    });

    const [ownerAsset, caregiverAsset] = await Promise.all([
      prismaRaw.mediaAsset.findUnique({
        where: {
          id: ownerUploaded.fileId,
        },
        select: {
          userId: true,
          tag1: true,
          tag2: true,
          uploadStatus: true,
        },
      }),
      prismaRaw.mediaAsset.findUnique({
        where: {
          id: caregiverUploaded.fileId,
        },
        select: {
          userId: true,
          tag1: true,
          tag2: true,
          uploadStatus: true,
        },
      }),
    ]);

    assert.ok(ownerAsset);
    assert.equal(ownerAsset.userId, ownerSession.user.id);
    assert.equal(ownerAsset.tag1, PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG);
    assert.equal(ownerAsset.tag2, order.id);
    assert.equal(ownerAsset.uploadStatus, 'COMPLETED');

    assert.ok(caregiverAsset);
    assert.equal(caregiverAsset.userId, caregiverSession.user.id);
    assert.equal(caregiverAsset.tag1, PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG);
    assert.equal(caregiverAsset.tag2, order.id);
    assert.equal(caregiverAsset.uploadStatus, 'COMPLETED');

    await request(app)
      .post('/api/files/presign')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        kind: 'attachment',
        fileName: 'blocked-complaint.jpg',
        contentType: 'image/jpeg',
        size: 128,
        tag1: PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
        tag2: order.id,
      })
      .expect(403);
  });
});
