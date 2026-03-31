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
        tag1: 'petpal-service-log',
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
        tag1: 'petpal-service-log',
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
    assert.equal(asset.tag1, 'petpal-service-log');
    assert.equal(asset.tag2, order.id);
    assert.equal(asset.uploadStatus, 'COMPLETED');
    assert.equal(asset.url, uploaded.url);
  });
});
