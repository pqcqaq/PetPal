import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import {
  binaryParser,
  bootstrapBackendTestContext,
  type BackendTestContext,
  loadWorksheet,
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
      auditStatus: true,
      ratingAvg: true,
      ratingCount: true,
    },
  });

  assert.ok(pet);
  assert.ok(caregiverProfile);

  const suffix = Date.now().toString(36);
  const requestRecord = await prisma.serviceRequest.create({
    data: {
      id: `req-fulfill-${suffix}`,
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
      id: `order-fulfill-${suffix}`,
      orderNo: `PP-FULFILL-${Date.now()}`,
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
    caregiverProfile,
    requestRecord,
    order,
  };
};

describe('PetPal API integration', () => {
  it('supports owner pet and request workflow', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const listPetsResponse = await request(app)
      .get('/api/petpal/pets')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(listPetsResponse.body.data.length >= 1);

    const newPetResponse = await request(app)
      .post('/api/petpal/pets')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        name: '雪球',
        species: 'CAT',
        breed: '英短',
        gender: 'FEMALE',
        weightKg: 4.2,
      })
      .expect(200);

    assert.equal(newPetResponse.body.data.name, '雪球');
    assert.equal(newPetResponse.body.data.species, 'CAT');

    const createdPetId = newPetResponse.body.data.id as string;

    const createRequestResponse = await request(app)
      .post('/api/petpal/requests')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        petId: createdPetId,
        serviceType: 'FEEDING',
        startTime: '2026-04-02T08:00:00.000Z',
        endTime: '2026-04-02T09:00:00.000Z',
        locationText: '杭州市西湖区',
        locationLat: 30.25,
        locationLng: 120.12,
        budgetAmount: 60,
        demandTags: ['cat', 'morning'],
      })
      .expect(200);

    assert.equal(createRequestResponse.body.data.status, 'OPEN');

    const requestRecord = await prisma.serviceRequest.findUnique({
      where: {
        id: createRequestResponse.body.data.id,
      },
      select: {
        ownerId: true,
        petId: true,
      },
    });

    assert.ok(requestRecord);
    assert.equal(requestRecord.petId, createdPetId);

    const listRequestsResponse = await request(app)
      .get('/api/petpal/requests')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(
      listRequestsResponse.body.data.some(
        (item: { id: string }) => item.id === createRequestResponse.body.data.id,
      ),
    );
  });

  it('supports owner checkout from matched caregiver to paid order', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const createPetResponse = await request(app)
      .post('/api/petpal/pets')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        name: '闪电',
        species: 'DOG',
        breed: '边牧',
        gender: 'MALE',
        weightKg: 18.5,
      })
      .expect(200);

    const createRequestResponse = await request(app)
      .post('/api/petpal/requests')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        petId: createPetResponse.body.data.id,
        serviceType: 'WALKING',
        startTime: '2026-04-03T08:00:00.000Z',
        endTime: '2026-04-03T09:30:00.000Z',
        locationText: '杭州市滨江区',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 120,
        demandTags: ['dog', 'walk'],
      })
      .expect(200);

    const matchResponse = await request(app)
      .get('/api/petpal/match/caregivers')
      .query({
        page: 1,
        pageSize: 10,
        serviceType: 'WALKING',
        petSpecies: 'DOG',
        city: '杭州',
        lat: 30.206,
        lng: 120.211,
      })
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(matchResponse.body.data.items.length >= 1);

    const createOrderResponse = await request(app)
      .post('/api/petpal/orders')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        requestId: createRequestResponse.body.data.id,
        caregiverServiceId: matchResponse.body.data.items[0].serviceId,
      })
      .expect(200);

    assert.equal(createOrderResponse.body.data.orderStatus, 'PENDING_ACCEPT');
    assert.equal(Number(createOrderResponse.body.data.amountPaid), 0);
    assert.equal(createOrderResponse.body.data.payments.length, 1);
    assert.equal(createOrderResponse.body.data.payments[0].payStatus, 'PENDING');

    const persistedRequest = await prisma.serviceRequest.findUnique({
      where: {
        id: createRequestResponse.body.data.id as string,
      },
      select: {
        status: true,
        matchedCaregiverId: true,
      },
    });

    assert.ok(persistedRequest);
    assert.equal(persistedRequest.status, 'MATCHED');
    assert.ok(persistedRequest.matchedCaregiverId);

    const payResponse = await request(app)
      .post(`/api/petpal/orders/${createOrderResponse.body.data.id}/pay`)
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        payChannel: 'WECHAT_PAY',
      })
      .expect(200);

    assert.equal(payResponse.body.data.orderStatus, 'PENDING_ACCEPT');
    assert.equal(
      Number(payResponse.body.data.amountPaid),
      Number(payResponse.body.data.amountTotal) + Number(payResponse.body.data.amountAdjusted),
    );
    assert.ok(
      payResponse.body.data.payments.some(
        (item: { payStatus: string }) => item.payStatus === 'PAID',
      ),
    );

    const persistedPayment = await prisma.paymentRecord.findFirst({
      where: {
        orderId: createOrderResponse.body.data.id as string,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        payStatus: true,
        payChannel: true,
        channelTxnId: true,
      },
    });

    assert.ok(persistedPayment);
    assert.equal(persistedPayment.payStatus, 'PAID');
    assert.equal(persistedPayment.payChannel, 'WECHAT_PAY');
    assert.ok(persistedPayment.channelTxnId);
  });

  it('supports owner pet health profile creation and update', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const createPetResponse = await request(app)
      .post('/api/petpal/pets')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        name: '团子',
        species: 'DOG',
        breed: '柯基',
        gender: 'MALE',
        birthday: '2022-08-01',
        weightKg: 12.5,
        neutered: true,
        temperamentTags: ['亲人', '胆小'],
        feedingNote: '每日两次定量喂食',
        allergyNote: '鸡肉冻干过敏',
        medicalNote: '去年做过髌骨检查',
        emergencyContact: {
          name: '王阿姨',
          phone: '13800001234',
          relation: '邻居',
        },
      })
      .expect(200);

    assert.equal(createPetResponse.body.data.name, '团子');
    assert.equal(createPetResponse.body.data.species, 'DOG');
    assert.equal(createPetResponse.body.data.breed, '柯基');
    assert.equal(Number(createPetResponse.body.data.weightKg), 12.5);
    assert.deepEqual(createPetResponse.body.data.temperamentTags, ['亲人', '胆小']);
    assert.equal(createPetResponse.body.data.allergyNote, '鸡肉冻干过敏');
    assert.equal(createPetResponse.body.data.medicalNote, '去年做过髌骨检查');
    assert.deepEqual(createPetResponse.body.data.emergencyContact, {
      name: '王阿姨',
      phone: '13800001234',
      relation: '邻居',
    });

    const petId = createPetResponse.body.data.id as string;

    const updatePetResponse = await request(app)
      .put(`/api/petpal/pets/${petId}`)
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        name: '团子',
        species: 'DOG',
        breed: '彭布罗克',
        gender: 'MALE',
        birthday: '2022-08-15',
        weightKg: 13.2,
        neutered: true,
        temperamentTags: ['稳定', '会握手'],
        feedingNote: '早晚各 90g 狗粮',
        allergyNote: '牛肉过敏',
        medicalNote: '每月驱虫，近期无异常',
        emergencyContact: {
          name: '李叔叔',
          phone: '13900004567',
        },
      })
      .expect(200);

    assert.equal(updatePetResponse.body.data.breed, '彭布罗克');
    assert.equal(Number(updatePetResponse.body.data.weightKg), 13.2);
    assert.deepEqual(updatePetResponse.body.data.temperamentTags, ['稳定', '会握手']);
    assert.equal(updatePetResponse.body.data.feedingNote, '早晚各 90g 狗粮');
    assert.equal(updatePetResponse.body.data.allergyNote, '牛肉过敏');
    assert.equal(updatePetResponse.body.data.medicalNote, '每月驱虫，近期无异常');
    assert.deepEqual(updatePetResponse.body.data.emergencyContact, {
      name: '李叔叔',
      phone: '13900004567',
      relation: null,
    });

    const persistedPet = await prisma.petProfile.findUnique({
      where: {
        id: petId,
      },
      select: {
        breed: true,
        birthday: true,
        weightKg: true,
        neutered: true,
        temperamentTags: true,
        feedingNote: true,
        allergyNote: true,
        medicalNote: true,
        emergencyContact: true,
      },
    });

    assert.ok(persistedPet);
    assert.equal(persistedPet.breed, '彭布罗克');
    assert.equal(persistedPet.birthday?.toISOString().slice(0, 10), '2022-08-15');
    assert.equal(Number(persistedPet.weightKg), 13.2);
    assert.equal(persistedPet.neutered, true);
    assert.deepEqual(persistedPet.temperamentTags, ['稳定', '会握手']);
    assert.equal(persistedPet.feedingNote, '早晚各 90g 狗粮');
    assert.equal(persistedPet.allergyNote, '牛肉过敏');
    assert.equal(persistedPet.medicalNote, '每月驱虫，近期无异常');
    assert.deepEqual(persistedPet.emergencyContact, {
      name: '李叔叔',
      phone: '13900004567',
      relation: null,
    });
  });

  it('supports caregiver matching and owner order detail', async () => {
    const { app, prisma } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const matchResponse = await request(app)
      .get('/api/petpal/match/caregivers')
      .query({
        page: 1,
        pageSize: 10,
        serviceType: 'WALKING',
        petSpecies: 'DOG',
        city: '杭州',
        lat: 30.25,
        lng: 120.18,
      })
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(matchResponse.body.data.meta.total >= 1);
    assert.ok(matchResponse.body.data.items[0].distanceKm !== null);
    assert.equal(matchResponse.body.data.items[0].intro, '5 年宠物照料经验，擅长犬猫日常照料。');
    assert.equal(matchResponse.body.data.items[0].experienceYears, 5);
    assert.equal(matchResponse.body.data.items[0].serviceRadiusKm, 8);
    assert.deepEqual(matchResponse.body.data.items[0].specialtyTags, [
      '犬类社交',
      '幼宠适应',
      '上门喂养',
    ]);
    assert.equal(
      matchResponse.body.data.items[0].serviceCommitment,
      '支持每日图文反馈，紧急情况 10 分钟内联系主人。',
    );
    assert.equal(matchResponse.body.data.items[0].minNoticeHours, 2);

    const ordersResponse = await request(app)
      .get('/api/petpal/orders')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(ordersResponse.body.data.length, 1);
    const orderId = ordersResponse.body.data[0].id as string;

    const orderDetailResponse = await request(app)
      .get(`/api/petpal/orders/${orderId}`)
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(orderDetailResponse.body.data.payments.length, 2);
    assert.equal(orderDetailResponse.body.data.refunds.length, 1);

    const order = await prisma.orderMain.findUnique({
      where: { id: orderId },
      select: {
        amountTotal: true,
        amountAdjusted: true,
        amountPaid: true,
        amountRefunded: true,
      },
    });

    assert.ok(order);
    const amountTotal = Number(order.amountTotal);
    const amountAdjusted = Number(order.amountAdjusted);
    const amountPaid = Number(order.amountPaid);
    const amountRefunded = Number(order.amountRefunded);

    assert.ok(amountPaid - amountRefunded >= 0);
    assert.ok(amountPaid >= amountTotal + amountAdjusted - amountRefunded);
  });

  it('supports caregiver onboarding profile, service setup and admin audit', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const profileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof profileResponse.body.data.id === 'string');
    assert.equal(profileResponse.body.data.userId, memberSession.user.id);

    const updatedProfileResponse = await request(app)
      .put('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        intro: '有 5 年犬猫照护经验',
        experienceYears: 5,
        serviceRadiusKm: 8,
        serviceCity: '杭州',
      })
      .expect(200);

    assert.equal(updatedProfileResponse.body.data.experienceYears, 5);
    assert.equal(updatedProfileResponse.body.data.serviceCity, '杭州');

    const createServiceResponse = await request(app)
      .post('/api/petpal/caregiver/services')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        serviceType: 'WALKING',
        petSpecies: 'DOG',
        pricePerUnit: 49,
        unitType: 'HOUR',
        minNoticeHours: 4,
        availableSlots: [{ day: 'SAT', windows: ['09:00-12:00'] }],
        serviceCity: '杭州',
        serviceLat: 30.25,
        serviceLng: 120.18,
        isActive: true,
      })
      .expect(200);

    assert.equal(createServiceResponse.body.data.serviceType, 'WALKING');
    assert.equal(createServiceResponse.body.data.petSpecies, 'DOG');

    const listServicesResponse = await request(app)
      .get('/api/petpal/caregiver/services')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(listServicesResponse.body.data));
    assert.ok(listServicesResponse.body.data.length >= 1);

    await request(app)
      .post(`/api/petpal/admin/caregivers/${profileResponse.body.data.id}/audit`)
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({ status: 'APPROVED' })
      .expect(403);

    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const blockedAuditResponse = await request(app)
      .post(`/api/petpal/admin/caregivers/${profileResponse.body.data.id}/audit`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ status: 'APPROVED' })
      .expect(400);

    assert.equal(
      blockedAuditResponse.body.message,
      'Caregiver qualification materials are required before approval',
    );

    const qualificationUploadedAt = '2026-03-31T10:00:00.000Z';
    const enrichedProfileResponse = await request(app)
      .put('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .send({
        intro: '有 5 年犬猫照护经验',
        experienceYears: 5,
        serviceRadiusKm: 8,
        serviceCity: '杭州',
        specialtyTags: ['幼宠', '猫咪', '上门照护'],
        serviceCommitment: '2 小时内响应，异常情况 10 分钟内同步给主人',
        qualificationMaterials: [
          {
            fileId: 'file-qualification-1',
            url: 'https://static.example.test/petpal/caregiver-qualification-1.jpg',
            name: '宠物急救培训证书.jpg',
            mimeType: 'image/jpeg',
            size: 204800,
            uploadedAt: qualificationUploadedAt,
          },
        ],
      })
      .expect(200);

    assert.deepEqual(enrichedProfileResponse.body.data.specialtyTags, ['幼宠', '猫咪', '上门照护']);
    assert.equal(
      enrichedProfileResponse.body.data.serviceCommitment,
      '2 小时内响应，异常情况 10 分钟内同步给主人',
    );
    assert.equal(enrichedProfileResponse.body.data.qualificationMaterials.length, 1);
    assert.equal(
      enrichedProfileResponse.body.data.qualificationMaterials[0].fileId,
      'file-qualification-1',
    );
    assert.equal(
      enrichedProfileResponse.body.data.qualificationMaterials[0].uploadedAt,
      qualificationUploadedAt,
    );

    const adminAuditResponse = await request(app)
      .post(`/api/petpal/admin/caregivers/${profileResponse.body.data.id}/audit`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ status: 'APPROVED' })
      .expect(200);

    assert.equal(adminAuditResponse.body.data.auditStatus, 'APPROVED');
    assert.deepEqual(adminAuditResponse.body.data.specialtyTags, ['幼宠', '猫咪', '上门照护']);
    assert.equal(adminAuditResponse.body.data.qualificationMaterials.length, 1);

    const adminListResponse = await request(app)
      .get('/api/petpal/admin/caregivers')
      .query({ auditStatus: 'APPROVED' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(adminListResponse.body.data.items));
    assert.ok(typeof adminListResponse.body.data.pagination.total === 'number');
    const approvedCaregiver = adminListResponse.body.data.items.find(
      (item: { id: string }) => item.id === profileResponse.body.data.id,
    );

    assert.ok(approvedCaregiver);
    assert.deepEqual(approvedCaregiver.specialtyTags, ['幼宠', '猫咪', '上门照护']);
    assert.equal(approvedCaregiver.serviceCommitment, '2 小时内响应，异常情况 10 分钟内同步给主人');
    assert.equal(approvedCaregiver.qualificationMaterialCount, 1);
    assert.equal(approvedCaregiver.qualificationMaterials[0].fileId, 'file-qualification-1');
  });

  it('returns empty caregiver earnings summary before approval', async () => {
    const { app } = context;
    const memberSession = await loginAs(app, 'user', 'User123!');

    const summaryResponse = await request(app)
      .get('/api/petpal/caregiver/earnings-summary')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(summaryResponse.body.data.profile.auditStatus, 'PENDING');
    assert.equal(summaryResponse.body.data.totals.totalIncome, 0);
    assert.equal(summaryResponse.body.data.totals.recentThirtyDayIncome, 0);
    assert.equal(summaryResponse.body.data.totals.averageTicket, 0);
    assert.equal(summaryResponse.body.data.totals.refundExposure, 0);
    assert.equal(summaryResponse.body.data.totals.completedOrderCount, 0);
    assert.equal(summaryResponse.body.data.totals.activeOrderCount, 0);
    assert.equal(summaryResponse.body.data.totals.aftersalesOrderCount, 0);
    assert.equal(summaryResponse.body.data.totals.aftersalesRiskRate, 0);
    assert.equal(summaryResponse.body.data.totals.activeServiceCount, 0);
    assert.equal(summaryResponse.body.data.totals.totalServiceCount, 0);
    assert.equal(summaryResponse.body.data.latestActiveOrder, null);
    assert.deepEqual(summaryResponse.body.data.recentCompletedOrders, []);
    assert.deepEqual(summaryResponse.body.data.serviceRevenueMix, []);
    assert.equal(summaryResponse.body.data.trends.daily.length, 7);
    assert.equal(summaryResponse.body.data.trends.weekly.length, 8);
    assert.equal(summaryResponse.body.data.trends.monthly.length, 6);
    assert.ok(
      summaryResponse.body.data.trends.daily.every(
        (item: { revenue: number; completedOrderCount: number }) =>
          Number(item.revenue) === 0 && item.completedOrderCount === 0,
      ),
    );

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .set('Authorization', `Bearer ${memberSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(worksheet.name, 'PetPal Caregiver Earnings');
    assert.equal(worksheet.getRow(1).getCell(1).value, '订单号');
    assert.equal(worksheet.rowCount, 1);
  });

  it('supports caregiver earnings summary aggregation', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
        serviceCity: '杭州',
        experienceYears: 6,
        serviceRadiusKm: 10,
      },
    });

    const baselineResponse = await request(app)
      .get('/api/petpal/caregiver/earnings-summary')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    assert.ok(ownerPet);

    const ownerRecord = await prisma.user.findUnique({
      where: {
        id: ownerSession.user.id,
      },
      select: {
        nickname: true,
      },
    });

    assert.ok(ownerRecord);

    await request(app)
      .post('/api/petpal/caregiver/services')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        serviceType: 'WALKING',
        petSpecies: 'DOG',
        pricePerUnit: 68,
        unitType: 'HOUR',
        minNoticeHours: 4,
        availableSlots: [{ day: 'SAT', windows: ['08:00-12:00'] }],
        serviceCity: '杭州',
        serviceLat: 30.206,
        serviceLng: 120.211,
        isActive: true,
      })
      .expect(200);

    await request(app)
      .post('/api/petpal/caregiver/services')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        serviceType: 'FEEDING',
        petSpecies: 'CAT',
        pricePerUnit: 45,
        unitType: 'TIME',
        minNoticeHours: 2,
        availableSlots: [{ day: 'SUN', windows: ['18:00-21:00'] }],
        serviceCity: '杭州',
        serviceLat: 30.208,
        serviceLng: 120.215,
        isActive: false,
      })
      .expect(200);

    const suffix = Date.now().toString(36);
    const createRequest = async (
      key: string,
      serviceType: 'WALKING' | 'FEEDING' | 'DOOR_VISIT' | 'BOARDING',
      startTime: Date,
      endTime: Date,
    ) =>
      prisma.serviceRequest.create({
        data: {
          id: `req-earnings-${key}-${suffix}`,
          ownerId: ownerSession.user.id,
          petId: ownerPet.id,
          serviceType,
          startTime,
          endTime,
          locationText: `杭州市滨江区-${key}`,
          locationLat: 30.206,
          locationLng: 120.211,
          budgetAmount: 88,
          demandTags: [key],
          status: 'MATCHED',
          matchedCaregiverId: caregiverProfileResponse.body.data.id,
        },
      });

    const recentCompletedRequest = await createRequest(
      'recent',
      'WALKING',
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    );
    const olderCompletedRequest = await createRequest(
      'older',
      'FEEDING',
      new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 45 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
    );
    const activeRequest = await createRequest(
      'active',
      'DOOR_VISIT',
      new Date('2000-01-01T08:00:00.000Z'),
      new Date('2000-01-01T09:00:00.000Z'),
    );
    const aftersalesRequest = await createRequest(
      'aftersales',
      'BOARDING',
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    );

    const recentCompletedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earnings-recent-${suffix}`,
        orderNo: `PP-EARN-R-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: recentCompletedRequest.id,
        serviceType: 'WALKING',
        appointmentStart: recentCompletedRequest.startTime,
        appointmentEnd: recentCompletedRequest.endTime,
        amountTotal: 120,
        amountAdjusted: 0,
        amountPaid: 120,
        amountRefunded: 20,
        orderStatus: 'COMPLETED',
        closedAt: new Date(),
      },
    });

    await prisma.orderMain.create({
      data: {
        id: `order-earnings-older-${suffix}`,
        orderNo: `PP-EARN-O-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: olderCompletedRequest.id,
        serviceType: 'FEEDING',
        appointmentStart: olderCompletedRequest.startTime,
        appointmentEnd: olderCompletedRequest.endTime,
        amountTotal: 80,
        amountAdjusted: 0,
        amountPaid: 80,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date(),
      },
    });

    const activeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earnings-active-${suffix}`,
        orderNo: `PP-EARN-A-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: activeRequest.id,
        serviceType: 'DOOR_VISIT',
        appointmentStart: activeRequest.startTime,
        appointmentEnd: activeRequest.endTime,
        amountTotal: 90,
        amountAdjusted: 0,
        amountPaid: 90,
        amountRefunded: 0,
        orderStatus: 'SERVING',
      },
    });

    await prisma.orderMain.create({
      data: {
        id: `order-earnings-aftersales-${suffix}`,
        orderNo: `PP-EARN-S-${Date.now() + 3}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: aftersalesRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: aftersalesRequest.startTime,
        appointmentEnd: aftersalesRequest.endTime,
        amountTotal: 150,
        amountAdjusted: 0,
        amountPaid: 150,
        amountRefunded: 40,
        orderStatus: 'PARTIAL_REFUNDED',
        closedAt: new Date(),
      },
    });

    const summaryResponse = await request(app)
      .get('/api/petpal/caregiver/earnings-summary')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    const baselineTotals = baselineResponse.body.data.totals;
    const totals = summaryResponse.body.data.totals;
    const sumTrendRevenue = (items: Array<{ revenue: number }>) =>
      items.reduce((sum, item) => sum + Number(item.revenue), 0);
    const sumTrendOrders = (items: Array<{ completedOrderCount: number }>) =>
      items.reduce((sum, item) => sum + item.completedOrderCount, 0);
    const baselineMix = new Map<string, { revenue: number; orderCount: number }>(
      baselineResponse.body.data.serviceRevenueMix.map(
        (item: { serviceType: string; revenue: number; orderCount: number }) => [
          item.serviceType,
          { revenue: Number(item.revenue), orderCount: item.orderCount },
        ],
      ),
    );
    const currentMix = new Map<string, { revenue: number; orderCount: number }>(
      summaryResponse.body.data.serviceRevenueMix.map(
        (item: { serviceType: string; revenue: number; orderCount: number }) => [
          item.serviceType,
          { revenue: Number(item.revenue), orderCount: item.orderCount },
        ],
      ),
    );

    assert.equal(Number(totals.totalIncome) - Number(baselineTotals.totalIncome), 180);
    assert.equal(
      Number(totals.recentThirtyDayIncome) - Number(baselineTotals.recentThirtyDayIncome),
      100,
    );
    assert.equal(totals.completedOrderCount - baselineTotals.completedOrderCount, 2);
    assert.equal(totals.activeOrderCount - baselineTotals.activeOrderCount, 1);
    assert.equal(totals.aftersalesOrderCount - baselineTotals.aftersalesOrderCount, 1);
    assert.equal(Number(totals.refundExposure) - Number(baselineTotals.refundExposure), 110);
    assert.equal(totals.totalServiceCount - baselineTotals.totalServiceCount, 2);
    assert.equal(totals.activeServiceCount - baselineTotals.activeServiceCount, 1);
    assert.equal(
      Number(totals.aftersalesRiskRate),
      Number(
        (
          totals.aftersalesOrderCount /
          (totals.completedOrderCount + totals.aftersalesOrderCount)
        ).toFixed(4),
      ),
    );
    assert.equal(summaryResponse.body.data.latestActiveOrder.id, activeOrder.id);
    assert.ok(
      summaryResponse.body.data.recentCompletedOrders.some(
        (item: { id: string; orderNo: string }) =>
          item.id === recentCompletedOrder.id && item.orderNo === recentCompletedOrder.orderNo,
      ),
    );
    assert.equal(
      (currentMix.get('WALKING')?.revenue ?? 0) - (baselineMix.get('WALKING')?.revenue ?? 0),
      100,
    );
    assert.equal(
      (currentMix.get('WALKING')?.orderCount ?? 0) - (baselineMix.get('WALKING')?.orderCount ?? 0),
      1,
    );
    assert.equal(
      (currentMix.get('FEEDING')?.revenue ?? 0) - (baselineMix.get('FEEDING')?.revenue ?? 0),
      80,
    );
    assert.equal(
      (currentMix.get('FEEDING')?.orderCount ?? 0) - (baselineMix.get('FEEDING')?.orderCount ?? 0),
      1,
    );
    assert.equal(summaryResponse.body.data.trends.daily.length, 7);
    assert.equal(summaryResponse.body.data.trends.weekly.length, 8);
    assert.equal(summaryResponse.body.data.trends.monthly.length, 6);
    assert.equal(
      sumTrendRevenue(summaryResponse.body.data.trends.daily) -
        sumTrendRevenue(baselineResponse.body.data.trends.daily),
      100,
    );
    assert.equal(
      sumTrendOrders(summaryResponse.body.data.trends.daily) -
        sumTrendOrders(baselineResponse.body.data.trends.daily),
      1,
    );
    assert.equal(
      sumTrendRevenue(summaryResponse.body.data.trends.weekly) -
        sumTrendRevenue(baselineResponse.body.data.trends.weekly),
      180,
    );
    assert.equal(
      sumTrendOrders(summaryResponse.body.data.trends.weekly) -
        sumTrendOrders(baselineResponse.body.data.trends.weekly),
      2,
    );
    assert.equal(
      sumTrendRevenue(summaryResponse.body.data.trends.monthly) -
        sumTrendRevenue(baselineResponse.body.data.trends.monthly),
      180,
    );
    assert.equal(
      sumTrendOrders(summaryResponse.body.data.trends.monthly) -
        sumTrendOrders(baselineResponse.body.data.trends.monthly),
      2,
    );
  });

  it('filters caregiver earnings export by appointment end range and service type', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    assert.ok(ownerPet);

    const ownerRecord = await prisma.user.findUnique({
      where: {
        id: ownerSession.user.id,
      },
      select: {
        nickname: true,
      },
    });

    assert.ok(ownerRecord);

    const suffix = Date.now().toString(36);
    const matchedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-matched-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'WALKING',
        startTime: new Date('2026-04-01T09:00:00.000Z'),
        endTime: new Date('2026-04-01T10:00:00.000Z'),
        locationText: '杭州市滨江区导出-完成单',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 88,
        demandTags: ['export-completed'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const outOfRangeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-out-of-range-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'WALKING',
        startTime: new Date('2026-03-15T09:00:00.000Z'),
        endTime: new Date('2026-03-15T10:00:00.000Z'),
        locationText: '杭州市滨江区导出-超范围',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 98,
        demandTags: ['export-out-of-range'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const mismatchedServiceRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-mismatched-service-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'FEEDING',
        startTime: new Date('2026-04-01T18:00:00.000Z'),
        endTime: new Date('2026-04-01T18:30:00.000Z'),
        locationText: '杭州市滨江区导出-服务不匹配',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 58,
        demandTags: ['export-mismatched-service'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const activeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-active-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'DOOR_VISIT',
        startTime: new Date('2026-04-02T09:00:00.000Z'),
        endTime: new Date('2026-04-02T10:00:00.000Z'),
        locationText: '杭州市滨江区导出-进行中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 66,
        demandTags: ['export-active'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 3,
          serviceRadiusKm: 6,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    assert.ok(foreignCaregiverProfile);

    const foreignRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'FEEDING',
        startTime: new Date('2026-04-03T09:00:00.000Z'),
        endTime: new Date('2026-04-03T09:30:00.000Z'),
        locationText: '杭州市滨江区导出-外部',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 52,
        demandTags: ['export-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const matchedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-matched-${suffix}`,
        orderNo: `PP-EARN-EXPORT-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: matchedRequest.id,
        serviceType: 'WALKING',
        appointmentStart: matchedRequest.startTime,
        appointmentEnd: matchedRequest.endTime,
        amountTotal: 120,
        amountAdjusted: 0,
        amountPaid: 120,
        amountRefunded: 20,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-01T10:15:00.000Z'),
      },
    });

    const outOfRangeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-out-of-range-${suffix}`,
        orderNo: `PP-EARN-OUT-RANGE-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: outOfRangeRequest.id,
        serviceType: 'WALKING',
        appointmentStart: outOfRangeRequest.startTime,
        appointmentEnd: outOfRangeRequest.endTime,
        amountTotal: 98,
        amountAdjusted: 0,
        amountPaid: 98,
        amountRefunded: 8,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-03-15T10:15:00.000Z'),
      },
    });

    const mismatchedServiceOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-mismatched-service-${suffix}`,
        orderNo: `PP-EARN-MISMATCH-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: mismatchedServiceRequest.id,
        serviceType: 'FEEDING',
        appointmentStart: mismatchedServiceRequest.startTime,
        appointmentEnd: mismatchedServiceRequest.endTime,
        amountTotal: 58,
        amountAdjusted: 0,
        amountPaid: 58,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-01T18:40:00.000Z'),
      },
    });

    const activeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-active-${suffix}`,
        orderNo: `PP-EARN-ACTIVE-${Date.now() + 3}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: activeRequest.id,
        serviceType: 'DOOR_VISIT',
        appointmentStart: activeRequest.startTime,
        appointmentEnd: activeRequest.endTime,
        amountTotal: 66,
        amountAdjusted: 0,
        amountPaid: 66,
        amountRefunded: 0,
        orderStatus: 'SERVING',
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-foreign-${suffix}`,
        orderNo: `PP-EARN-FOREIGN-${Date.now() + 4}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignRequest.id,
        serviceType: 'FEEDING',
        appointmentStart: foreignRequest.startTime,
        appointmentEnd: foreignRequest.endTime,
        amountTotal: 52,
        amountAdjusted: 0,
        amountPaid: 52,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-03T10:00:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-02T00:00:00.000Z',
        serviceType: 'WALKING',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    assert.match(
      String(exportResponse.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    );
    assert.match(String(exportResponse.headers['content-disposition']), /attachment;\s*filename=/i);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(worksheet.name, 'PetPal Caregiver Earnings');
    assert.equal(worksheet.getRow(1).getCell(1).value, '订单号');

    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [matchedOrder.orderNo]);
    assert.ok(!exportedOrderNos.includes(outOfRangeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(mismatchedServiceOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(activeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignOrder.orderNo));

    const completedRowIndex = exportedOrderNos.indexOf(matchedOrder.orderNo);
    assert.ok(completedRowIndex >= 0);

    const completedRow = worksheet.getRow(completedRowIndex + 2);
    assert.equal(completedRow.getCell(2).value, '遛宠');
    assert.equal(completedRow.getCell(3).value, ownerRecord.nickname);
    assert.equal(completedRow.getCell(4).value, ownerPet.name);
    assert.equal(completedRow.getCell(5).value, '杭州市滨江区导出-完成单');
    assert.equal(completedRow.getCell(9).value, '120');
    assert.equal(completedRow.getCell(10).value, '20');
    assert.equal(completedRow.getCell(11).value, '100');
  });

  it('filters caregiver earnings export by refunded risk only', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const refundedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-risk-hit-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-05T09:00:00.000Z'),
        endTime: new Date('2026-04-05T18:00:00.000Z'),
        locationText: '杭州市滨江区导出-风险命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-risk-hit'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-risk-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-05T19:00:00.000Z'),
        endTime: new Date('2026-04-05T22:00:00.000Z'),
        locationText: '杭州市滨江区导出-无退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 166,
        demandTags: ['export-risk-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-risk-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignRiskRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-risk-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-05T10:00:00.000Z'),
        endTime: new Date('2026-04-05T17:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部风险单',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 199,
        demandTags: ['export-risk-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const refundedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-risk-hit-${suffix}`,
        orderNo: `PP-EARN-RISK-HIT-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: refundedRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: refundedRequest.startTime,
        appointmentEnd: refundedRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 38,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-05T18:15:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-risk-safe-${suffix}`,
        orderNo: `PP-EARN-RISK-SAFE-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 166,
        amountAdjusted: 0,
        amountPaid: 166,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-05T22:10:00.000Z'),
      },
    });

    const foreignRiskOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-risk-foreign-${suffix}`,
        orderNo: `PP-EARN-RISK-FOREIGN-${Date.now() + 2}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignRiskRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignRiskRequest.startTime,
        appointmentEnd: foreignRiskRequest.endTime,
        amountTotal: 199,
        amountAdjusted: 0,
        amountPaid: 199,
        amountRefunded: 49,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-05T17:15:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-05T00:00:00.000Z',
        endDate: '2026-04-06T00:00:00.000Z',
        serviceType: 'BOARDING',
        riskOnly: true,
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [refundedOrder.orderNo]);
    assert.ok(!exportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignRiskOrder.orderNo));

    const refundedRow = worksheet.getRow(2);
    assert.equal(refundedRow.getCell(10).value, '38');
    assert.equal(refundedRow.getCell(11).value, '150');

    const fullExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-05T00:00:00.000Z',
        endDate: '2026-04-06T00:00:00.000Z',
        serviceType: 'BOARDING',
        riskOnly: 'false',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const fullWorksheet = await loadWorksheet(fullExportResponse.body as Buffer);
    const fullExportedOrderNos = Array.from(
      { length: Math.max(0, fullWorksheet.rowCount - 1) },
      (_, index) => String(fullWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(fullExportedOrderNos, [safeOrder.orderNo, refundedOrder.orderNo]);
    assert.ok(!fullExportedOrderNos.includes(foreignRiskOrder.orderNo));
  });

  it('filters caregiver earnings export by refund type', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const fullRefundRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-type-full-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T09:00:00.000Z'),
        endTime: new Date('2026-04-06T18:00:00.000Z'),
        locationText: '杭州市滨江区导出-全额退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 198,
        demandTags: ['export-refund-type-full'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const partialRefundRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-type-partial-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T19:00:00.000Z'),
        endTime: new Date('2026-04-06T21:00:00.000Z'),
        locationText: '杭州市滨江区导出-部分退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 168,
        demandTags: ['export-refund-type-partial'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-type-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T21:30:00.000Z'),
        endTime: new Date('2026-04-06T23:00:00.000Z'),
        locationText: '杭州市滨江区导出-无退款类型',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 158,
        demandTags: ['export-refund-type-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-refund-type-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignFullRefundRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-type-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T10:00:00.000Z'),
        endTime: new Date('2026-04-06T17:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部全额退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-refund-type-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const fullRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-type-full-${suffix}`,
        orderNo: `PP-EARN-REFUND-TYPE-FULL-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: fullRefundRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: fullRefundRequest.startTime,
        appointmentEnd: fullRefundRequest.endTime,
        amountTotal: 198,
        amountAdjusted: 0,
        amountPaid: 198,
        amountRefunded: 198,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T18:15:00.000Z'),
      },
    });

    const partialRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-type-partial-${suffix}`,
        orderNo: `PP-EARN-REFUND-TYPE-PARTIAL-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: partialRefundRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: partialRefundRequest.startTime,
        appointmentEnd: partialRefundRequest.endTime,
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 28,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T21:10:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-type-safe-${suffix}`,
        orderNo: `PP-EARN-REFUND-TYPE-SAFE-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 158,
        amountAdjusted: 0,
        amountPaid: 158,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T23:10:00.000Z'),
      },
    });

    const foreignFullRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-type-foreign-${suffix}`,
        orderNo: `PP-EARN-REFUND-TYPE-FOREIGN-${Date.now() + 3}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignFullRefundRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignFullRefundRequest.startTime,
        appointmentEnd: foreignFullRefundRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 188,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T17:10:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-type-full-${suffix}`,
        orderId: fullRefundOrder.id,
        refundNo: `REF-EARN-TYPE-FULL-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '行程取消，整单退回',
        refundAmount: 198,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-06T18:20:00.000Z'),
        createdAt: new Date('2026-04-06T18:18:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-type-partial-${suffix}`,
        orderId: partialRefundOrder.id,
        refundNo: `REF-EARN-TYPE-PARTIAL-${Date.now() + 1}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '缩短服务时段，仅退部分费用',
        refundAmount: 28,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-06T21:15:00.000Z'),
        createdAt: new Date('2026-04-06T21:12:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-type-foreign-${suffix}`,
        orderId: foreignFullRefundOrder.id,
        refundNo: `REF-EARN-TYPE-FOREIGN-${Date.now() + 2}`,
        applyUserId: adminSession.user.id,
        refundType: 'FULL',
        refundReason: 'foreign full refund',
        refundAmount: 188,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-04-06T17:12:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-06T00:00:00.000Z',
        endDate: '2026-04-07T00:00:00.000Z',
        serviceType: 'BOARDING',
        refundType: 'FULL',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [fullRefundOrder.orderNo]);
    assert.ok(!exportedOrderNos.includes(partialRefundOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignFullRefundOrder.orderNo));

    const refundTypeFilteredRow = worksheet.getRow(2);
    assert.equal(refundTypeFilteredRow.getCell(1).value, fullRefundOrder.orderNo);
    assert.equal(refundTypeFilteredRow.getCell(5).value, '杭州市滨江区导出-全额退款');
  });

  it('filters caregiver earnings export by refund status', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const approvedRefundRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-status-approved-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T09:00:00.000Z'),
        endTime: new Date('2026-04-07T20:00:00.000Z'),
        locationText: '杭州市滨江区导出-待退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 198,
        demandTags: ['export-refund-status-approved'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const mixedRefundRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-status-mixed-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T10:00:00.000Z'),
        endTime: new Date('2026-04-07T18:00:00.000Z'),
        locationText: '杭州市滨江区导出-混合退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-refund-status-mixed'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const successRefundRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-status-success-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T11:00:00.000Z'),
        endTime: new Date('2026-04-07T16:00:00.000Z'),
        locationText: '杭州市滨江区导出-退款成功',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 168,
        demandTags: ['export-refund-status-success'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-status-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T20:30:00.000Z'),
        endTime: new Date('2026-04-07T22:00:00.000Z'),
        locationText: '杭州市滨江区导出-无退款状态',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 158,
        demandTags: ['export-refund-status-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-refund-status-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignApprovedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-status-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T08:00:00.000Z'),
        endTime: new Date('2026-04-07T19:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部待退款',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 208,
        demandTags: ['export-refund-status-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const approvedRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-status-approved-${suffix}`,
        orderNo: `PP-EARN-REFUND-STATUS-APPROVED-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: approvedRefundRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: approvedRefundRequest.startTime,
        appointmentEnd: approvedRefundRequest.endTime,
        amountTotal: 198,
        amountAdjusted: 0,
        amountPaid: 198,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T20:10:00.000Z'),
      },
    });

    const mixedRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-status-mixed-${suffix}`,
        orderNo: `PP-EARN-REFUND-STATUS-MIXED-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: mixedRefundRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: mixedRefundRequest.startTime,
        appointmentEnd: mixedRefundRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 38,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T18:10:00.000Z'),
      },
    });

    const successRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-status-success-${suffix}`,
        orderNo: `PP-EARN-REFUND-STATUS-SUCCESS-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: successRefundRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: successRefundRequest.startTime,
        appointmentEnd: successRefundRequest.endTime,
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 28,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T16:10:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-status-safe-${suffix}`,
        orderNo: `PP-EARN-REFUND-STATUS-SAFE-${Date.now() + 3}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 158,
        amountAdjusted: 0,
        amountPaid: 158,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T22:10:00.000Z'),
      },
    });

    const foreignApprovedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-status-foreign-${suffix}`,
        orderNo: `PP-EARN-REFUND-STATUS-FOREIGN-${Date.now() + 4}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignApprovedRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignApprovedRequest.startTime,
        appointmentEnd: foreignApprovedRequest.endTime,
        amountTotal: 208,
        amountAdjusted: 0,
        amountPaid: 208,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T19:10:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-status-approved-${suffix}`,
        orderId: approvedRefundOrder.id,
        refundNo: `REF-EARN-STATUS-APPROVED-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '待渠道退款',
        refundAmount: 198,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-07T20:15:00.000Z'),
        createdAt: new Date('2026-04-07T20:12:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-status-mixed-success-${suffix}`,
        orderId: mixedRefundOrder.id,
        refundNo: `REF-EARN-STATUS-MIXED-SUCCESS-${Date.now() + 1}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '第一笔已退款',
        refundAmount: 18,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-07T18:15:00.000Z'),
        createdAt: new Date('2026-04-07T18:12:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-status-mixed-approved-${suffix}`,
        orderId: mixedRefundOrder.id,
        refundNo: `REF-EARN-STATUS-MIXED-APPROVED-${Date.now() + 2}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '第二笔待退款',
        refundAmount: 20,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-07T18:20:00.000Z'),
        createdAt: new Date('2026-04-07T18:18:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-status-success-${suffix}`,
        orderId: successRefundOrder.id,
        refundNo: `REF-EARN-STATUS-SUCCESS-${Date.now() + 3}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '已完成退款',
        refundAmount: 28,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-07T16:15:00.000Z'),
        createdAt: new Date('2026-04-07T16:12:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-status-foreign-${suffix}`,
        orderId: foreignApprovedOrder.id,
        refundNo: `REF-EARN-STATUS-FOREIGN-${Date.now() + 4}`,
        applyUserId: adminSession.user.id,
        refundType: 'FULL',
        refundReason: 'foreign approved refund',
        refundAmount: 208,
        refundStatus: 'APPROVED',
        createdAt: new Date('2026-04-07T19:12:00.000Z'),
      },
    });

    const approvedExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-07T00:00:00.000Z',
        endDate: '2026-04-08T00:00:00.000Z',
        serviceType: 'BOARDING',
        refundStatus: 'APPROVED',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const approvedWorksheet = await loadWorksheet(approvedExportResponse.body as Buffer);
    const approvedExportedOrderNos = Array.from(
      { length: Math.max(0, approvedWorksheet.rowCount - 1) },
      (_, index) => String(approvedWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(approvedExportedOrderNos, [
      approvedRefundOrder.orderNo,
      mixedRefundOrder.orderNo,
    ]);
    assert.ok(!approvedExportedOrderNos.includes(successRefundOrder.orderNo));
    assert.ok(!approvedExportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!approvedExportedOrderNos.includes(foreignApprovedOrder.orderNo));

    const comboExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-07T00:00:00.000Z',
        endDate: '2026-04-08T00:00:00.000Z',
        serviceType: 'BOARDING',
        refundType: 'FULL',
        refundStatus: 'APPROVED',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const comboWorksheet = await loadWorksheet(comboExportResponse.body as Buffer);
    const comboExportedOrderNos = Array.from(
      { length: Math.max(0, comboWorksheet.rowCount - 1) },
      (_, index) => String(comboWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(comboExportedOrderNos, [approvedRefundOrder.orderNo]);
    assert.ok(!comboExportedOrderNos.includes(mixedRefundOrder.orderNo));

    const refundStatusFilteredRow = comboWorksheet.getRow(2);
    assert.equal(refundStatusFilteredRow.getCell(1).value, approvedRefundOrder.orderNo);
    assert.equal(refundStatusFilteredRow.getCell(5).value, '杭州市滨江区导出-待退款');
  });

  it('filters caregiver earnings export by refund reason keyword', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const matchedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-reason-hit-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T09:00:00.000Z'),
        endTime: new Date('2026-04-08T18:00:00.000Z'),
        locationText: '杭州市滨江区导出-退款原因命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 198,
        demandTags: ['export-refund-reason-hit'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const mixedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-reason-mixed-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T12:00:00.000Z'),
        endTime: new Date('2026-04-08T21:00:00.000Z'),
        locationText: '杭州市滨江区导出-退款原因混合',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-refund-reason-mixed'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const mismatchRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-reason-miss-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T22:00:00.000Z'),
        endTime: new Date('2026-04-08T23:30:00.000Z'),
        locationText: '杭州市滨江区导出-退款原因未命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 168,
        demandTags: ['export-refund-reason-miss'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-reason-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-09T00:00:00.000Z'),
        endTime: new Date('2026-04-09T01:00:00.000Z'),
        locationText: '杭州市滨江区导出-无退款原因',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 158,
        demandTags: ['export-refund-reason-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-refund-reason-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-refund-reason-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T08:00:00.000Z'),
        endTime: new Date('2026-04-08T19:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部退款原因命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 208,
        demandTags: ['export-refund-reason-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const matchedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-reason-hit-${suffix}`,
        orderNo: `PP-EARN-REFUND-REASON-HIT-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: matchedRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: matchedRequest.startTime,
        appointmentEnd: matchedRequest.endTime,
        amountTotal: 198,
        amountAdjusted: 0,
        amountPaid: 198,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T18:10:00.000Z'),
      },
    });

    const mixedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-reason-mixed-${suffix}`,
        orderNo: `PP-EARN-REFUND-REASON-MIXED-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: mixedRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: mixedRequest.startTime,
        appointmentEnd: mixedRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 18,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T21:10:00.000Z'),
      },
    });

    const mismatchOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-reason-miss-${suffix}`,
        orderNo: `PP-EARN-REFUND-REASON-MISS-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: mismatchRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: mismatchRequest.startTime,
        appointmentEnd: mismatchRequest.endTime,
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T23:35:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-reason-safe-${suffix}`,
        orderNo: `PP-EARN-REFUND-REASON-SAFE-${Date.now() + 3}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 158,
        amountAdjusted: 0,
        amountPaid: 158,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-09T01:10:00.000Z'),
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-refund-reason-foreign-${suffix}`,
        orderNo: `PP-EARN-REFUND-REASON-FOREIGN-${Date.now() + 4}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignRequest.startTime,
        appointmentEnd: foreignRequest.endTime,
        amountTotal: 208,
        amountAdjusted: 0,
        amountPaid: 208,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T19:10:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-reason-hit-${suffix}`,
        orderId: matchedOrder.id,
        refundNo: `REF-EARN-REASON-HIT-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '渠道延迟待退款，已通知继续跟进',
        refundAmount: 198,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-08T18:15:00.000Z'),
        createdAt: new Date('2026-04-08T18:12:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-reason-mixed-success-${suffix}`,
        orderId: mixedOrder.id,
        refundNo: `REF-EARN-REASON-MIXED-SUCCESS-${Date.now() + 1}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '渠道延迟已退款，等待回执归档',
        refundAmount: 18,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-08T21:15:00.000Z'),
        createdAt: new Date('2026-04-08T21:12:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-reason-mixed-approved-${suffix}`,
        orderId: mixedOrder.id,
        refundNo: `REF-EARN-REASON-MIXED-APPROVED-${Date.now() + 2}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '人工复核中，等待二次审核',
        refundAmount: 20,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-08T21:20:00.000Z'),
        createdAt: new Date('2026-04-08T21:18:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-reason-miss-${suffix}`,
        orderId: mismatchOrder.id,
        refundNo: `REF-EARN-REASON-MISS-${Date.now() + 3}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '人工复核中，尚未进入渠道处理',
        refundAmount: 168,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-08T23:40:00.000Z'),
        createdAt: new Date('2026-04-08T23:37:00.000Z'),
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-earn-export-reason-foreign-${suffix}`,
        orderId: foreignOrder.id,
        refundNo: `REF-EARN-REASON-FOREIGN-${Date.now() + 4}`,
        applyUserId: adminSession.user.id,
        refundType: 'FULL',
        refundReason: '渠道延迟待退款，foreign order',
        refundAmount: 208,
        refundStatus: 'APPROVED',
        createdAt: new Date('2026-04-08T19:12:00.000Z'),
      },
    });

    const keywordExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-08T00:00:00.000Z',
        endDate: '2026-04-09T23:59:59.999Z',
        serviceType: 'BOARDING',
        refundReasonKeyword: '渠道延迟',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const keywordWorksheet = await loadWorksheet(keywordExportResponse.body as Buffer);
    const keywordExportedOrderNos = Array.from(
      { length: Math.max(0, keywordWorksheet.rowCount - 1) },
      (_, index) => String(keywordWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(keywordExportedOrderNos, [
      mixedOrder.orderNo,
      matchedOrder.orderNo,
    ]);
    assert.ok(!keywordExportedOrderNos.includes(mismatchOrder.orderNo));
    assert.ok(!keywordExportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!keywordExportedOrderNos.includes(foreignOrder.orderNo));

    const comboExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-08T00:00:00.000Z',
        endDate: '2026-04-09T23:59:59.999Z',
        serviceType: 'BOARDING',
        refundStatus: 'APPROVED',
        refundReasonKeyword: '渠道延迟',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const comboWorksheet = await loadWorksheet(comboExportResponse.body as Buffer);
    const comboExportedOrderNos = Array.from(
      { length: Math.max(0, comboWorksheet.rowCount - 1) },
      (_, index) => String(comboWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(comboExportedOrderNos, [matchedOrder.orderNo]);
    assert.ok(!comboExportedOrderNos.includes(mixedOrder.orderNo));

    const refundReasonFilteredRow = comboWorksheet.getRow(2);
    assert.equal(refundReasonFilteredRow.getCell(1).value, matchedOrder.orderNo);
    assert.equal(refundReasonFilteredRow.getCell(5).value, '杭州市滨江区导出-退款原因命中');
  });

  it('filters caregiver earnings export by complaint status', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const openComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-open-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T09:00:00.000Z'),
        endTime: new Date('2026-04-06T11:00:00.000Z'),
        locationText: '杭州市滨江区导出-投诉待处理',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 198,
        demandTags: ['export-complaint-open'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const resolvedComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-resolved-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T12:00:00.000Z'),
        endTime: new Date('2026-04-06T14:00:00.000Z'),
        locationText: '杭州市滨江区导出-投诉已解决',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 176,
        demandTags: ['export-complaint-resolved'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T15:00:00.000Z'),
        endTime: new Date('2026-04-06T17:00:00.000Z'),
        locationText: '杭州市滨江区导出-无投诉',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 166,
        demandTags: ['export-complaint-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-complaint-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-06T10:00:00.000Z'),
        endTime: new Date('2026-04-06T13:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部投诉单',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-complaint-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const openComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-open-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-OPEN-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: openComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: openComplaintRequest.startTime,
        appointmentEnd: openComplaintRequest.endTime,
        amountTotal: 198,
        amountAdjusted: 0,
        amountPaid: 198,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T11:15:00.000Z'),
      },
    });

    const resolvedComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-resolved-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-RESOLVED-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: resolvedComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: resolvedComplaintRequest.startTime,
        appointmentEnd: resolvedComplaintRequest.endTime,
        amountTotal: 176,
        amountAdjusted: 0,
        amountPaid: 176,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T14:20:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-safe-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-SAFE-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 166,
        amountAdjusted: 0,
        amountPaid: 166,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T17:15:00.000Z'),
      },
    });

    const foreignComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-foreign-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-FOREIGN-${Date.now() + 3}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignComplaintRequest.startTime,
        appointmentEnd: foreignComplaintRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-06T13:15:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-open-${suffix}`,
        orderId: openComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '导出筛选需要命中待处理投诉订单',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-resolved-${suffix}`,
        orderId: resolvedComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '导出筛选需要排除已解决投诉订单',
        status: 'RESOLVED',
        closedAt: new Date('2026-04-06T15:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-foreign-${suffix}`,
        orderId: foreignComplaintOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '导出筛选需要排除外部照料者投诉订单',
        status: 'OPEN',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-06T00:00:00.000Z',
        endDate: '2026-04-07T00:00:00.000Z',
        serviceType: 'BOARDING',
        complaintStatus: 'OPEN',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [openComplaintOrder.orderNo]);
    assert.ok(!exportedOrderNos.includes(resolvedComplaintOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignComplaintOrder.orderNo));

    const complaintFilteredRow = worksheet.getRow(2);
    assert.equal(complaintFilteredRow.getCell(1).value, openComplaintOrder.orderNo);
    assert.equal(complaintFilteredRow.getCell(5).value, '杭州市滨江区导出-投诉待处理');
  });

  it('filters caregiver earnings export by complaint type', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const feeComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-fee-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T09:00:00.000Z'),
        endTime: new Date('2026-04-07T11:00:00.000Z'),
        locationText: '杭州市滨江区导出-费用争议',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-complaint-fee'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const serviceComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-service-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T12:00:00.000Z'),
        endTime: new Date('2026-04-07T14:00:00.000Z'),
        locationText: '杭州市滨江区导出-服务质量',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 176,
        demandTags: ['export-complaint-service'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-type-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T15:00:00.000Z'),
        endTime: new Date('2026-04-07T17:00:00.000Z'),
        locationText: '杭州市滨江区导出-无投诉类型',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 166,
        demandTags: ['export-complaint-type-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-complaint-type-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-type-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-07T10:00:00.000Z'),
        endTime: new Date('2026-04-07T13:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部费用争议',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 199,
        demandTags: ['export-complaint-type-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const feeComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-fee-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-FEE-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: feeComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: feeComplaintRequest.startTime,
        appointmentEnd: feeComplaintRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T11:15:00.000Z'),
      },
    });

    const serviceComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-service-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-SERVICE-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: serviceComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: serviceComplaintRequest.startTime,
        appointmentEnd: serviceComplaintRequest.endTime,
        amountTotal: 176,
        amountAdjusted: 0,
        amountPaid: 176,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T14:20:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-type-safe-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-TYPE-SAFE-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 166,
        amountAdjusted: 0,
        amountPaid: 166,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T17:10:00.000Z'),
      },
    });

    const foreignComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-type-foreign-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-TYPE-FOREIGN-${Date.now() + 3}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignComplaintRequest.startTime,
        appointmentEnd: foreignComplaintRequest.endTime,
        amountTotal: 199,
        amountAdjusted: 0,
        amountPaid: 199,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-07T13:15:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-fee-${suffix}`,
        orderId: feeComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'FEE',
        description: '导出筛选需要命中费用争议订单',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-service-${suffix}`,
        orderId: serviceComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '导出筛选需要排除服务质量投诉订单',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-fee-foreign-${suffix}`,
        orderId: foreignComplaintOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'FEE',
        description: '导出筛选需要排除外部照料者费用争议订单',
        status: 'OPEN',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-07T00:00:00.000Z',
        endDate: '2026-04-08T00:00:00.000Z',
        serviceType: 'BOARDING',
        complaintType: 'FEE',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [feeComplaintOrder.orderNo]);
    assert.ok(!exportedOrderNos.includes(serviceComplaintOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignComplaintOrder.orderNo));

    const complaintTypeFilteredRow = worksheet.getRow(2);
    assert.equal(complaintTypeFilteredRow.getCell(1).value, feeComplaintOrder.orderNo);
    assert.equal(complaintTypeFilteredRow.getCell(5).value, '杭州市滨江区导出-费用争议');
  });

  it('filters caregiver earnings export by complaint target role', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const platformComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-role-platform-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T09:00:00.000Z'),
        endTime: new Date('2026-04-08T11:00:00.000Z'),
        locationText: '杭州市滨江区导出-平台责任',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 198,
        demandTags: ['export-complaint-role-platform'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const caregiverComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-role-caregiver-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T12:00:00.000Z'),
        endTime: new Date('2026-04-08T14:00:00.000Z'),
        locationText: '杭州市滨江区导出-照料者责任',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 176,
        demandTags: ['export-complaint-role-caregiver'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-role-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T15:00:00.000Z'),
        endTime: new Date('2026-04-08T17:00:00.000Z'),
        locationText: '杭州市滨江区导出-无投诉责任',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 166,
        demandTags: ['export-complaint-role-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-complaint-role-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignComplaintRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-role-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-08T10:00:00.000Z'),
        endTime: new Date('2026-04-08T13:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部平台责任',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-complaint-role-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const platformComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-role-platform-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-ROLE-PLATFORM-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: platformComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: platformComplaintRequest.startTime,
        appointmentEnd: platformComplaintRequest.endTime,
        amountTotal: 198,
        amountAdjusted: 0,
        amountPaid: 198,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T11:15:00.000Z'),
      },
    });

    const caregiverComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-role-caregiver-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-ROLE-CAREGIVER-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: caregiverComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: caregiverComplaintRequest.startTime,
        appointmentEnd: caregiverComplaintRequest.endTime,
        amountTotal: 176,
        amountAdjusted: 0,
        amountPaid: 176,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T14:20:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-role-safe-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-ROLE-SAFE-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 166,
        amountAdjusted: 0,
        amountPaid: 166,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T17:10:00.000Z'),
      },
    });

    const foreignComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-role-foreign-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-ROLE-FOREIGN-${Date.now() + 3}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignComplaintRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignComplaintRequest.startTime,
        appointmentEnd: foreignComplaintRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-08T13:15:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-role-platform-${suffix}`,
        orderId: platformComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '导出筛选需要命中平台责任订单',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-role-caregiver-${suffix}`,
        orderId: caregiverComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '导出筛选需要排除照料者责任订单',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-role-foreign-${suffix}`,
        orderId: foreignComplaintOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '导出筛选需要排除外部照料者平台责任订单',
        status: 'OPEN',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-08T00:00:00.000Z',
        endDate: '2026-04-09T00:00:00.000Z',
        serviceType: 'BOARDING',
        complaintTargetRole: 'PLATFORM',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [platformComplaintOrder.orderNo]);
    assert.ok(!exportedOrderNos.includes(caregiverComplaintOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignComplaintOrder.orderNo));

    const complaintRoleFilteredRow = worksheet.getRow(2);
    assert.equal(complaintRoleFilteredRow.getCell(1).value, platformComplaintOrder.orderNo);
    assert.equal(complaintRoleFilteredRow.getCell(5).value, '杭州市滨江区导出-平台责任');
  });

  it('filters caregiver earnings export by complaint keyword', async () => {
    const { app, prisma } = context;
    const caregiverSession = await loginAs(app, 'manager', 'Manager123!');
    const ownerSession = await loginAs(app, 'user', 'User123!');
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const caregiverProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfileResponse.body.data.id,
      },
      data: {
        auditStatus: 'APPROVED',
      },
    });

    const ownerPet = await prisma.petProfile.findFirst({
      where: {
        ownerId: ownerSession.user.id,
      },
      select: {
        id: true,
      },
    });

    assert.ok(ownerPet);

    const suffix = Date.now().toString(36);
    const matchedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-keyword-hit-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-09T09:00:00.000Z'),
        endTime: new Date('2026-04-09T18:00:00.000Z'),
        locationText: '杭州市滨江区导出-投诉摘要命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 208,
        demandTags: ['export-complaint-keyword-hit'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const mixedRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-keyword-mixed-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-09T12:00:00.000Z'),
        endTime: new Date('2026-04-09T21:00:00.000Z'),
        locationText: '杭州市滨江区导出-投诉摘要混合',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 188,
        demandTags: ['export-complaint-keyword-mixed'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const mismatchRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-keyword-miss-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-09T22:00:00.000Z'),
        endTime: new Date('2026-04-09T23:00:00.000Z'),
        locationText: '杭州市滨江区导出-投诉摘要未命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 168,
        demandTags: ['export-complaint-keyword-miss'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const safeRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-keyword-safe-${suffix}`,
        ownerId: ownerSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-10T00:00:00.000Z'),
        endTime: new Date('2026-04-10T01:00:00.000Z'),
        locationText: '杭州市滨江区导出-无投诉摘要',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 158,
        demandTags: ['export-complaint-keyword-safe'],
        status: 'MATCHED',
        matchedCaregiverId: caregiverProfileResponse.body.data.id,
      },
    });

    const existingForeignCaregiverProfile = await prisma.caregiverProfile.findFirst({
      where: {
        userId: adminSession.user.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    const foreignCaregiverProfile =
      existingForeignCaregiverProfile ??
      (await prisma.caregiverProfile.create({
        data: {
          id: `caregiver-export-complaint-keyword-foreign-${suffix}`,
          userId: adminSession.user.id,
          experienceYears: 2,
          serviceRadiusKm: 5,
          serviceCity: '杭州',
          auditStatus: 'APPROVED',
        },
        select: {
          id: true,
        },
      }));

    const foreignRequest = await prisma.serviceRequest.create({
      data: {
        id: `req-earn-export-complaint-keyword-foreign-${suffix}`,
        ownerId: adminSession.user.id,
        petId: ownerPet.id,
        serviceType: 'BOARDING',
        startTime: new Date('2026-04-09T08:00:00.000Z'),
        endTime: new Date('2026-04-09T19:00:00.000Z'),
        locationText: '杭州市滨江区导出-外部投诉摘要命中',
        locationLat: 30.206,
        locationLng: 120.211,
        budgetAmount: 218,
        demandTags: ['export-complaint-keyword-foreign'],
        status: 'MATCHED',
        matchedCaregiverId: foreignCaregiverProfile.id,
      },
    });

    const matchedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-keyword-hit-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-KEYWORD-HIT-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: matchedRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: matchedRequest.startTime,
        appointmentEnd: matchedRequest.endTime,
        amountTotal: 208,
        amountAdjusted: 0,
        amountPaid: 208,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-09T18:10:00.000Z'),
      },
    });

    const mixedOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-keyword-mixed-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-KEYWORD-MIXED-${Date.now() + 1}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: mixedRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: mixedRequest.startTime,
        appointmentEnd: mixedRequest.endTime,
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-09T21:10:00.000Z'),
      },
    });

    const mismatchOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-keyword-miss-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-KEYWORD-MISS-${Date.now() + 2}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: mismatchRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: mismatchRequest.startTime,
        appointmentEnd: mismatchRequest.endTime,
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-09T23:10:00.000Z'),
      },
    });

    const safeOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-keyword-safe-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-KEYWORD-SAFE-${Date.now() + 3}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfileResponse.body.data.id,
        serviceRequestId: safeRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: safeRequest.startTime,
        appointmentEnd: safeRequest.endTime,
        amountTotal: 158,
        amountAdjusted: 0,
        amountPaid: 158,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-10T01:10:00.000Z'),
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-earn-export-complaint-keyword-foreign-${suffix}`,
        orderNo: `PP-EARN-COMPLAINT-KEYWORD-FOREIGN-${Date.now() + 4}`,
        ownerId: adminSession.user.id,
        caregiverId: foreignCaregiverProfile.id,
        serviceRequestId: foreignRequest.id,
        serviceType: 'BOARDING',
        appointmentStart: foreignRequest.startTime,
        appointmentEnd: foreignRequest.endTime,
        amountTotal: 218,
        amountAdjusted: 0,
        amountPaid: 218,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-09T19:10:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-keyword-hit-${suffix}`,
        orderId: matchedOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '需要平台继续复盘处理经过',
        status: 'RESOLVED',
        resultSummary: '平台流程异常已核实，并完成补偿处理',
        closedAt: new Date('2026-04-09T18:30:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-keyword-mixed-caregiver-${suffix}`,
        orderId: mixedOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '照料流程异常，需要继续核查服务执行细节',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-keyword-mixed-platform-${suffix}`,
        orderId: mixedOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '平台侧等待人工复核排队处理',
        status: 'OPEN',
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-keyword-miss-${suffix}`,
        orderId: mismatchOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '平台侧等待人工复核',
        status: 'RESOLVED',
        resultSummary: '已按常规流程处理完毕',
        closedAt: new Date('2026-04-09T23:20:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-export-keyword-foreign-${suffix}`,
        orderId: foreignOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '平台流程异常，foreign order',
        status: 'OPEN',
      },
    });

    const keywordExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-09T00:00:00.000Z',
        endDate: '2026-04-10T23:59:59.999Z',
        serviceType: 'BOARDING',
        complaintKeyword: '流程异常',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const keywordWorksheet = await loadWorksheet(keywordExportResponse.body as Buffer);
    const keywordExportedOrderNos = Array.from(
      { length: Math.max(0, keywordWorksheet.rowCount - 1) },
      (_, index) => String(keywordWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(keywordExportedOrderNos, [
      mixedOrder.orderNo,
      matchedOrder.orderNo,
    ]);
    assert.ok(!keywordExportedOrderNos.includes(mismatchOrder.orderNo));
    assert.ok(!keywordExportedOrderNos.includes(safeOrder.orderNo));
    assert.ok(!keywordExportedOrderNos.includes(foreignOrder.orderNo));

    const comboExportResponse = await request(app)
      .get('/api/petpal/caregiver/earnings/export')
      .query({
        startDate: '2026-04-09T00:00:00.000Z',
        endDate: '2026-04-10T23:59:59.999Z',
        serviceType: 'BOARDING',
        complaintTargetRole: 'PLATFORM',
        complaintKeyword: '流程异常',
      })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const comboWorksheet = await loadWorksheet(comboExportResponse.body as Buffer);
    const comboExportedOrderNos = Array.from(
      { length: Math.max(0, comboWorksheet.rowCount - 1) },
      (_, index) => String(comboWorksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(comboExportedOrderNos, [matchedOrder.orderNo]);
    assert.ok(!comboExportedOrderNos.includes(mixedOrder.orderNo));

    const complaintKeywordFilteredRow = comboWorksheet.getRow(2);
    assert.equal(complaintKeywordFilteredRow.getCell(1).value, matchedOrder.orderNo);
    assert.equal(complaintKeywordFilteredRow.getCell(5).value, '杭州市滨江区导出-投诉摘要命中');
  });

  it('supports caregiver fulfillment actions and owner completion workflow', async () => {
    const { app, prisma, ownerSession, caregiverSession, caregiverProfile, order } =
      await createFulfillmentScenario();

    const caregiverOrdersResponse = await request(app)
      .get('/api/petpal/caregiver/orders')
      .query({ status: 'PENDING_ACCEPT' })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(
      caregiverOrdersResponse.body.data.items.some((item: { id: string }) => item.id === order.id),
    );

    const acceptResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(acceptResponse.body.data.orderStatus, 'ACCEPTED');
    assert.ok(
      acceptResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'ACCEPTED',
      ),
    );

    const checkInResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/check-in`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        note: '已到达约定地点',
        geo: { lat: 30.206, lng: 120.211 },
      })
      .expect(200);

    assert.equal(checkInResponse.body.data.orderStatus, 'SERVING');
    assert.ok(
      checkInResponse.body.data.serviceLogs.some(
        (item: { logType: string }) => item.logType === 'CHECK_IN',
      ),
    );

    await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/check-in`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(400);

    const addLogResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/service-logs`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        logType: 'NOTE',
        textNote: '已完成 30 分钟遛狗，精神状态良好',
        mediaUrls: [
          'https://static.example.test/petpal/service-log-1.jpg',
          'https://static.example.test/petpal/service-log-2.mp4',
        ],
      })
      .expect(200);

    assert.ok(
      addLogResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'SERVICE_LOGGED',
      ),
    );
    assert.ok(
      addLogResponse.body.data.serviceLogs.some(
        (item: { logType: string; textNote: string; mediaUrls: string[] }) =>
          item.logType === 'NOTE' && item.textNote.includes('30 分钟遛狗'),
      ),
    );
    assert.ok(
      addLogResponse.body.data.serviceLogs.some(
        (item: { logType: string; mediaUrls: string[] }) =>
          item.logType === 'NOTE' &&
          item.mediaUrls.includes('https://static.example.test/petpal/service-log-1.jpg') &&
          item.mediaUrls.includes('https://static.example.test/petpal/service-log-2.mp4'),
      ),
    );

    const caregiverDetailResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(caregiverDetailResponse.body.data.id, order.id);

    const checkOutResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/check-out`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        note: '服务结束，宠物状态稳定',
      })
      .expect(200);

    assert.ok(
      checkOutResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'CHECKED_OUT',
      ),
    );

    const confirmResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/confirm-complete`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(confirmResponse.body.data.orderStatus, 'COMPLETED');
    assert.ok(
      confirmResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'COMPLETED',
      ),
    );

    const ownerDetailResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(ownerDetailResponse.body.data.id, order.id);
    assert.ok(
      ownerDetailResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'CHECKED_IN',
      ),
    );
    assert.ok(
      ownerDetailResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'CHECKED_OUT',
      ),
    );
    assert.ok(
      ownerDetailResponse.body.data.serviceLogs.some(
        (item: { logType: string; textNote: string | null; mediaUrls: string[] }) =>
          item.logType === 'NOTE' && item.textNote?.includes('30 分钟遛狗'),
      ),
    );
    assert.ok(
      ownerDetailResponse.body.data.serviceLogs.some(
        (item: { logType: string; mediaUrls: string[] }) =>
          item.logType === 'NOTE' &&
          item.mediaUrls.includes('https://static.example.test/petpal/service-log-1.jpg') &&
          item.mediaUrls.includes('https://static.example.test/petpal/service-log-2.mp4'),
      ),
    );
    assert.ok(
      ownerDetailResponse.body.data.serviceLogs.some(
        (item: { logType: string }) => item.logType === 'CHECK_OUT',
      ),
    );

    const reviewResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/review`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        rating: 5,
        tags: ['准时签到', '沟通顺畅'],
        content: '照料过程透明，宠物状态很好',
        isAnonymous: false,
      })
      .expect(200);

    assert.equal(reviewResponse.body.data.review.rating, 5);
    assert.deepEqual(reviewResponse.body.data.review.tags, ['准时签到', '沟通顺畅']);
    assert.equal(reviewResponse.body.data.review.content, '照料过程透明，宠物状态很好');
    assert.equal(reviewResponse.body.data.review.isAnonymous, false);

    const duplicateReviewResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/review`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        rating: 4,
      })
      .expect(400);

    assert.equal(duplicateReviewResponse.body.message, 'Order review already exists');

    const reviewedDetailResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(reviewedDetailResponse.body.data.review.rating, 5);
    assert.equal(reviewedDetailResponse.body.data.review.content, '照料过程透明，宠物状态很好');
    assert.deepEqual(reviewedDetailResponse.body.data.review.tags, ['准时签到', '沟通顺畅']);

    const complaintResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/complaints`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '服务完成后发现沟通与交付细节存在争议，希望平台介入核查',
        evidenceUrls: ['https://static.example.test/petpal/complaint-1.jpg'],
      })
      .expect(200);

    assert.equal(complaintResponse.body.data.status, 'OPEN');
    assert.equal(complaintResponse.body.data.targetRole, 'CAREGIVER');
    assert.equal(complaintResponse.body.data.complaintType, 'SERVICE');
    assert.ok(Array.isArray(complaintResponse.body.data.processLogs));
    assert.equal(complaintResponse.body.data.processLogs[0].actionType, 'OPEN');

    const duplicateComplaintResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/complaints`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'PLATFORM',
        complaintType: 'OTHER',
        description: '重复发起投诉',
      })
      .expect(400);

    assert.equal(
      duplicateComplaintResponse.body.message,
      'Active complaint already exists for order',
    );

    const complaintListResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}/complaints`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(complaintListResponse.body.data.length, 1);
    assert.equal(complaintListResponse.body.data[0].status, 'OPEN');
    assert.equal(complaintListResponse.body.data[0].processLogs[0].actionType, 'OPEN');

    const disputedDetailResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(disputedDetailResponse.body.data.orderStatus, 'DISPUTED');
    assert.ok(
      disputedDetailResponse.body.data.timeline.some(
        (item: { eventType: string }) => item.eventType === 'DISPUTED',
      ),
    );

    const persistedCaregiverProfile = await prisma.caregiverProfile.findUnique({
      where: {
        id: caregiverProfile.id,
      },
      select: {
        ratingAvg: true,
        ratingCount: true,
      },
    });

    assert.ok(persistedCaregiverProfile);
    assert.equal(persistedCaregiverProfile.ratingCount, caregiverProfile.ratingCount + 1);
    assert.equal(
      Number(persistedCaregiverProfile.ratingAvg),
      Number(
        (
          (Number(caregiverProfile.ratingAvg) * caregiverProfile.ratingCount + 5) /
          (caregiverProfile.ratingCount + 1)
        ).toFixed(2),
      ),
    );

    const persistedOrder = await prisma.orderMain.findUnique({
      where: {
        id: order.id,
      },
      select: {
        orderStatus: true,
        closedAt: true,
        serviceRequest: {
          select: {
            status: true,
          },
        },
      },
    });

    assert.ok(persistedOrder);
    assert.equal(persistedOrder.orderStatus, 'DISPUTED');
    assert.ok(persistedOrder.closedAt);
    assert.equal(persistedOrder.serviceRequest?.status, 'CLOSED');
  });

  it('supports order messaging loop for owner and caregiver participants', async () => {
    const { app, ownerSession, caregiverSession, order } = await createFulfillmentScenario();

    const ownerSendResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/messages`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        content: '今天需要在 9 点前确认上门，狗粮放在玄关柜第二层。',
        mediaUrls: ['https://static.example.test/petpal/order-message-1.jpg'],
      })
      .expect(200);

    assert.equal(ownerSendResponse.body.data.messages.length, 1);
    assert.equal(ownerSendResponse.body.data.ownerUnreadCount, 0);
    assert.equal(ownerSendResponse.body.data.caregiverUnreadCount, 1);
    assert.equal(
      ownerSendResponse.body.data.lastMessagePreview,
      '今天需要在 9 点前确认上门，狗粮放在玄关柜第二层。',
    );

    const caregiverOrdersResponse = await request(app)
      .get('/api/petpal/caregiver/orders')
      .query({ status: 'PENDING_ACCEPT' })
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    const caregiverOrder = caregiverOrdersResponse.body.data.items.find(
      (item: { id: string }) => item.id === order.id,
    );

    assert.ok(caregiverOrder);
    assert.equal(caregiverOrder.conversation.caregiverUnreadCount, 1);

    const caregiverMessagesResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}/messages`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(caregiverMessagesResponse.body.data.messages.length, 1);
    assert.equal(caregiverMessagesResponse.body.data.messages[0].senderRole, 'OWNER');
    assert.deepEqual(caregiverMessagesResponse.body.data.messages[0].mediaUrls, [
      'https://static.example.test/petpal/order-message-1.jpg',
    ]);
    assert.equal(caregiverMessagesResponse.body.data.caregiverUnreadCount, 1);

    const caregiverReadResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/messages/read`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(caregiverReadResponse.body.data.caregiverUnreadCount, 0);

    const caregiverReplyResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/messages`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        content: '收到，我会提前 10 分钟到达并先给主人同步签到照片。',
      })
      .expect(200);

    assert.equal(caregiverReplyResponse.body.data.messages.length, 2);
    assert.equal(caregiverReplyResponse.body.data.ownerUnreadCount, 1);
    assert.equal(caregiverReplyResponse.body.data.caregiverUnreadCount, 0);
    assert.equal(
      caregiverReplyResponse.body.data.lastMessagePreview,
      '收到，我会提前 10 分钟到达并先给主人同步签到照片。',
    );

    const ownerOrdersResponse = await request(app)
      .get('/api/petpal/orders')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    const ownerOrder = ownerOrdersResponse.body.data.find(
      (item: { id: string }) => item.id === order.id,
    );

    assert.ok(ownerOrder);
    assert.equal(ownerOrder.conversation.ownerUnreadCount, 1);
    assert.equal(
      ownerOrder.conversation.lastMessagePreview,
      '收到，我会提前 10 分钟到达并先给主人同步签到照片。',
    );

    const ownerDetailResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(ownerDetailResponse.body.data.conversation);
    assert.equal(ownerDetailResponse.body.data.conversation.ownerUnreadCount, 1);

    const ownerReadResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/messages/read`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(ownerReadResponse.body.data.ownerUnreadCount, 0);

    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    await request(app)
      .get(`/api/petpal/orders/${order.id}/messages`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(404);
  });

  it('rejects unapproved caregivers and unrelated caregivers from fulfillment access', async () => {
    const { app, prisma, caregiverSession, caregiverProfile, order } =
      await createFulfillmentScenario();

    await prisma.caregiverProfile.update({
      where: {
        id: caregiverProfile.id,
      },
      data: {
        auditStatus: 'REJECTED',
      },
    });

    const unapprovedListResponse = await request(app)
      .get('/api/petpal/caregiver/orders')
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(403);

    assert.equal(unapprovedListResponse.body.message, 'Caregiver profile is not approved');

    const unapprovedAcceptResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(403);

    assert.equal(unapprovedAcceptResponse.body.message, 'Caregiver profile is not approved');

    const outsiderSession = await loginAs(app, 'admin', 'Admin123!');
    const outsiderProfileResponse = await request(app)
      .get('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${outsiderSession.tokens.accessToken}`)
      .expect(200);

    await request(app)
      .put('/api/petpal/caregiver/profile')
      .set('Authorization', `Bearer ${outsiderSession.tokens.accessToken}`)
      .send({
        intro: '后台管理员自测照料档案',
        specialtyTags: ['夜间值守'],
        qualificationMaterials: [
          {
            fileId: 'file-outsider-qualification-1',
            url: 'https://static.example.test/petpal/outsider-qualification-1.jpg',
            name: '管理员照护资质.jpg',
            mimeType: 'image/jpeg',
            size: 102400,
            uploadedAt: '2026-03-31T12:00:00.000Z',
          },
        ],
      })
      .expect(200);

    await request(app)
      .post(`/api/petpal/admin/caregivers/${outsiderProfileResponse.body.data.id}/audit`)
      .set('Authorization', `Bearer ${outsiderSession.tokens.accessToken}`)
      .send({
        status: 'APPROVED',
      })
      .expect(200);

    const outsiderDetailResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}`)
      .set('Authorization', `Bearer ${outsiderSession.tokens.accessToken}`)
      .expect(404);

    assert.equal(outsiderDetailResponse.body.message, 'Order not found');
  });

  it('rejects invalid fulfillment transitions and malformed service logs', async () => {
    const { app, ownerSession, caregiverSession, order } = await createFulfillmentScenario();

    const earlyConfirmResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/confirm-complete`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(400);

    assert.equal(
      earlyConfirmResponse.body.message,
      'Only serving orders can be completed by owner',
    );

    const earlyCheckoutResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/check-out`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        note: '试图提前签退',
      })
      .expect(400);

    assert.equal(earlyCheckoutResponse.body.message, 'Only serving orders can be checked out');

    const invalidStateLogResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/service-logs`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        logType: 'NOTE',
        textNote: '服务尚未开始，不能先记日志',
      })
      .expect(400);

    assert.equal(invalidStateLogResponse.body.message, 'Only serving orders can add service logs');

    const earlyReviewResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/review`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        rating: 4,
        content: '订单尚未完成',
      })
      .expect(400);

    assert.equal(earlyReviewResponse.body.message, 'Only completed orders can be reviewed');

    const earlyComplaintResponse = await request(app)
      .post(`/api/petpal/orders/${order.id}/complaints`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '服务尚未开始，暂不应进入投诉流程',
      })
      .expect(400);

    assert.equal(
      earlyComplaintResponse.body.message,
      'Only serving or settled orders can create complaints',
    );

    await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(200);

    const duplicateAcceptResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/accept`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(400);

    assert.equal(duplicateAcceptResponse.body.message, 'Only pending orders can be accepted');

    const emptyServiceLogResponse = await request(app)
      .post(`/api/petpal/caregiver/orders/${order.id}/service-logs`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .send({
        logType: 'NOTE',
      })
      .expect(400);

    assert.equal(emptyServiceLogResponse.body.message, 'Service log requires text note or media');
  });

  it('allows owner to export transaction records within the recent year window', async () => {
    const { app, prisma, ownerSession, caregiverProfile } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-export-foreign-${Date.now().toString(36)}`,
        orderNo: `PP-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-04-10T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-11T09:00:00.000Z'),
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 0,
        orderStatus: 'COMPLETED',
        closedAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/transactions/export')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    assert.match(
      String(exportResponse.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    );
    assert.match(String(exportResponse.headers['content-disposition']), /attachment;\s*filename=/i);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(worksheet.name, 'PetPal Owner Transactions');
    assert.equal(worksheet.getRow(1).getCell(1).value, '订单号');

    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.ok(exportedOrderNos.length >= 1);
    assert.ok(!exportedOrderNos.includes(foreignOrder.orderNo));

    const exportedOrders = await prisma.orderMain.findMany({
      where: {
        orderNo: {
          in: exportedOrderNos,
        },
      },
      select: {
        orderNo: true,
        ownerId: true,
      },
    });

    assert.equal(exportedOrders.length, exportedOrderNos.length);
    assert.ok(exportedOrders.every((item) => item.ownerId === ownerSession.user.id));

    const oversizeRangeResponse = await request(app)
      .get('/api/petpal/orders/transactions/export')
      .query({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2026-04-01T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(400);

    assert.equal(oversizeRangeResponse.body.message, 'Export date range cannot exceed 366 days');
  });

  it('allows owner to export refund detail rows for the current order only', async () => {
    const { app, prisma, ownerSession, caregiverProfile, order } =
      await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    const firstRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-export-a-${suffix}`,
        orderId: order.id,
        refundNo: `REF-EXPORT-A-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '服务提前结束，退还部分费用',
        refundAmount: 18,
        refundStatus: 'PENDING',
      },
    });

    const secondRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-export-b-${suffix}`,
        orderId: order.id,
        refundNo: `REF-EXPORT-B-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '照料者未按约上门，整单退款',
        refundAmount: 88,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-06T11:00:00.000Z'),
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-export-foreign-${suffix}`,
        orderNo: `PP-REFUND-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-04-10T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-11T09:00:00.000Z'),
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 40,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    await prisma.refundRecord.create({
      data: {
        id: `refund-export-foreign-${suffix}`,
        orderId: foreignOrder.id,
        refundNo: `REF-EXPORT-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign refund',
        refundAmount: 40,
        refundStatus: 'SUCCESS',
      },
    });

    const exportResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}/refunds/export`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    assert.match(
      String(exportResponse.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    );
    assert.match(String(exportResponse.headers['content-disposition']), /attachment;\s*filename=/i);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(worksheet.name, 'PetPal Order Refunds');
    assert.equal(worksheet.getRow(1).getCell(1).value, '订单号');
    assert.equal(worksheet.getRow(1).getCell(2).value, '退款单号');

    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(2).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedRefundNos, [firstRefund.refundNo, secondRefund.refundNo]);

    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.ok(exportedOrderNos.every((item) => item === order.orderNo));

    const foreignResponse = await request(app)
      .get(`/api/petpal/orders/${foreignOrder.id}/refunds/export`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(404);

    assert.equal(foreignResponse.body.message, 'Order not found');
  });

  it('allows owner to export refund detail rows within the recent year window', async () => {
    const { app, prisma, ownerSession, caregiverProfile, order } =
      await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    const firstRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-ledger-a-${suffix}`,
        orderId: order.id,
        refundNo: `REF-LEDGER-A-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '行程缩短，退部分费用',
        refundAmount: 12,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-06T09:00:00.000Z'),
      },
    });

    const secondOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-ledger-${suffix}`,
        orderNo: `PP-REFUND-LEDGER-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'FEEDING',
        appointmentStart: new Date('2026-04-12T08:00:00.000Z'),
        appointmentEnd: new Date('2026-04-12T09:00:00.000Z'),
        amountTotal: 66,
        amountAdjusted: 0,
        amountPaid: 66,
        amountRefunded: 20,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const secondRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-ledger-b-${suffix}`,
        orderId: secondOrder.id,
        refundNo: `REF-LEDGER-B-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '服务取消一半时段',
        refundAmount: 20,
        refundStatus: 'SUCCESS',
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-ledger-foreign-${suffix}`,
        orderNo: `PP-REFUND-LEDGER-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-04-15T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-16T09:00:00.000Z'),
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 50,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const foreignRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-ledger-foreign-${suffix}`,
        orderId: foreignOrder.id,
        refundNo: `REF-LEDGER-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign refund',
        refundAmount: 50,
        refundStatus: 'SUCCESS',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    assert.match(
      String(exportResponse.headers['content-type']),
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    );
    assert.match(String(exportResponse.headers['content-disposition']), /attachment;\s*filename=/i);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    assert.equal(worksheet.name, 'PetPal Owner Refunds');
    assert.equal(worksheet.getRow(1).getCell(1).value, '订单号');
    assert.equal(worksheet.getRow(1).getCell(6).value, '退款单号');

    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.ok(exportedRefundNos.length >= 2);
    assert.ok(exportedRefundNos.includes(firstRefund.refundNo));
    assert.ok(exportedRefundNos.includes(secondRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignRefund.refundNo));

    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.ok(exportedOrderNos.includes(order.orderNo));
    assert.ok(exportedOrderNos.includes(secondOrder.orderNo));
    assert.ok(!exportedOrderNos.includes(foreignOrder.orderNo));

    const exportedOrders = await prisma.orderMain.findMany({
      where: {
        orderNo: {
          in: exportedOrderNos,
        },
      },
      select: {
        orderNo: true,
        ownerId: true,
      },
    });

    assert.equal(exportedOrders.length, exportedOrderNos.length);
    assert.ok(exportedOrders.every((item) => item.ownerId === ownerSession.user.id));

    const oversizeRangeResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2026-04-01T00:00:00.000Z',
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(400);

    assert.equal(oversizeRangeResponse.body.message, 'Export date range cannot exceed 366 days');
  });

  it('filters owner refund export by date range and refund status', async () => {
    const { app, prisma, ownerSession, caregiverProfile, order } =
      await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    const outOfRangeRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-filter-range-${suffix}`,
        orderId: order.id,
        refundNo: `REF-FILTER-RANGE-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '超出筛选日期范围',
        refundAmount: 16,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-04-18T09:00:00.000Z'),
      },
    });

    const secondOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-filter-${suffix}`,
        orderNo: `PP-REFUND-FILTER-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-20T08:00:00.000Z'),
        appointmentEnd: new Date('2026-04-20T09:00:00.000Z'),
        amountTotal: 88,
        amountAdjusted: 0,
        amountPaid: 88,
        amountRefunded: 24,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const matchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-filter-hit-${suffix}`,
        orderId: secondOrder.id,
        refundNo: `REF-FILTER-HIT-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '命中时间与状态筛选',
        refundAmount: 24,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-20T15:00:00.000Z'),
        createdAt: new Date('2026-04-20T10:00:00.000Z'),
      },
    });

    const mismatchedStatusRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-filter-status-${suffix}`,
        orderId: order.id,
        refundNo: `REF-FILTER-STATUS-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '日期命中但状态不符',
        refundAmount: 10,
        refundStatus: 'APPROVED',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-04-20T12:00:00.000Z'),
        createdAt: new Date('2026-04-20T11:00:00.000Z'),
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-filter-foreign-${suffix}`,
        orderNo: `PP-REFUND-FILTER-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-04-20T09:00:00.000Z'),
        appointmentEnd: new Date('2026-04-21T09:00:00.000Z'),
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 32,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const foreignRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-filter-foreign-${suffix}`,
        orderId: foreignOrder.id,
        refundNo: `REF-FILTER-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign refund',
        refundAmount: 32,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-04-20T13:00:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        startDate: '2026-04-20T00:00:00.000Z',
        endDate: '2026-04-20T23:59:59.999Z',
        refundStatus: 'SUCCESS',
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedRefundNos, [matchedRefund.refundNo]);
    assert.ok(!exportedRefundNos.includes(outOfRangeRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(mismatchedStatusRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignRefund.refundNo));

    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [secondOrder.orderNo]);
  });

  it('filters owner refund export by service type and order keyword', async () => {
    const { app, prisma, ownerSession, caregiverProfile } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    const matchedOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-focus-hit-${suffix}`,
        orderNo: `PP-REFUND-FOCUS-WALK-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-21T08:00:00.000Z'),
        appointmentEnd: new Date('2026-04-21T09:00:00.000Z'),
        amountTotal: 78,
        amountAdjusted: 0,
        amountPaid: 78,
        amountRefunded: 18,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const matchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-focus-hit-${suffix}`,
        orderId: matchedOrder.id,
        refundNo: `REF-FOCUS-HIT-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '命中服务类型和订单号关键词',
        refundAmount: 18,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    });

    const mismatchedServiceOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-focus-board-${suffix}`,
        orderNo: `PP-REFUND-FOCUS-BOARD-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-04-21T10:00:00.000Z'),
        appointmentEnd: new Date('2026-04-22T10:00:00.000Z'),
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 28,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const mismatchedServiceRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-focus-board-${suffix}`,
        orderId: mismatchedServiceOrder.id,
        refundNo: `REF-FOCUS-BOARD-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '订单号命中但服务类型不符',
        refundAmount: 28,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T11:00:00.000Z'),
      },
    });

    const mismatchedKeywordOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-other-walk-${suffix}`,
        orderNo: `PP-OTHER-WALK-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-21T12:00:00.000Z'),
        appointmentEnd: new Date('2026-04-21T13:00:00.000Z'),
        amountTotal: 66,
        amountAdjusted: 0,
        amountPaid: 66,
        amountRefunded: 12,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const mismatchedKeywordRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-other-walk-${suffix}`,
        orderId: mismatchedKeywordOrder.id,
        refundNo: `REF-OTHER-WALK-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '服务类型命中但订单号关键词不符',
        refundAmount: 12,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T12:30:00.000Z'),
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-focus-foreign-${suffix}`,
        orderNo: `PP-REFUND-FOCUS-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-04-21T14:00:00.000Z'),
        appointmentEnd: new Date('2026-04-21T15:00:00.000Z'),
        amountTotal: 80,
        amountAdjusted: 0,
        amountPaid: 80,
        amountRefunded: 20,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const foreignRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-focus-foreign-${suffix}`,
        orderId: foreignOrder.id,
        refundNo: `REF-FOCUS-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign refund',
        refundAmount: 20,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T14:30:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        serviceType: 'WALKING',
        orderNoKeyword: 'REFUND-FOCUS',
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedRefundNos, [matchedRefund.refundNo]);
    assert.ok(!exportedRefundNos.includes(mismatchedServiceRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(mismatchedKeywordRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignRefund.refundNo));

    const exportedOrderNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(1).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedOrderNos, [matchedOrder.orderNo]);
  });

  it('filters owner refund export by refund type', async () => {
    const { app, prisma, ownerSession, caregiverProfile } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);

    const fullRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-type-full-${suffix}`,
        orderNo: `PP-REFUND-TYPE-FULL-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T08:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T08:00:00.000Z'),
        amountTotal: 128,
        amountAdjusted: 0,
        amountPaid: 128,
        amountRefunded: 128,
        orderStatus: 'REFUNDED',
      },
    });

    const matchedFullRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-type-full-${suffix}`,
        orderId: fullRefundOrder.id,
        refundNo: `REF-TYPE-FULL-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'FULL',
        refundReason: '整单取消，全额退款',
        refundAmount: 128,
        refundStatus: 'SUCCESS',
        reviewedBy: adminSession.user.id,
        reviewedAt: new Date('2026-03-30T12:00:00.000Z'),
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    });

    const partialRefundOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-type-partial-${suffix}`,
        orderNo: `PP-REFUND-TYPE-PARTIAL-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-03-30T09:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T10:00:00.000Z'),
        amountTotal: 68,
        amountAdjusted: 0,
        amountPaid: 68,
        amountRefunded: 18,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const mismatchedPartialRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-type-partial-${suffix}`,
        orderId: partialRefundOrder.id,
        refundNo: `REF-TYPE-PARTIAL-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '仅退部分服务费用',
        refundAmount: 18,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T11:00:00.000Z'),
      },
    });

    const foreignOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-type-foreign-${suffix}`,
        orderNo: `PP-REFUND-TYPE-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T11:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T11:00:00.000Z'),
        amountTotal: 168,
        amountAdjusted: 0,
        amountPaid: 168,
        amountRefunded: 168,
        orderStatus: 'REFUNDED',
      },
    });

    const foreignFullRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-type-foreign-${suffix}`,
        orderId: foreignOrder.id,
        refundNo: `REF-TYPE-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'FULL',
        refundReason: 'foreign refund',
        refundAmount: 168,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T13:00:00.000Z'),
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        refundType: 'FULL',
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.ok(exportedRefundNos.includes(matchedFullRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(mismatchedPartialRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignFullRefund.refundNo));

    const exportedRefunds = await prisma.refundRecord.findMany({
      where: {
        refundNo: {
          in: exportedRefundNos,
        },
      },
      select: {
        refundNo: true,
        refundType: true,
        order: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    assert.equal(exportedRefunds.length, exportedRefundNos.length);
    assert.ok(exportedRefunds.every((item) => item.refundType === 'FULL'));
    assert.ok(exportedRefunds.every((item) => item.order.ownerId === ownerSession.user.id));
  });

  it('filters owner refund export by complaint status', async () => {
    const { app, prisma, ownerSession, caregiverProfile } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);
    const keyword = `REFUND-COMPLAINT-${suffix}`.toUpperCase();

    const openComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-open-${suffix}`,
        orderNo: `PP-${keyword}-OPEN-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T08:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T08:00:00.000Z'),
        amountTotal: 158,
        amountAdjusted: 0,
        amountPaid: 158,
        amountRefunded: 48,
        orderStatus: 'DISPUTED',
      },
    });

    const matchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-open-${suffix}`,
        orderId: openComplaintOrder.id,
        refundNo: `REF-COMPLAINT-OPEN-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '投诉处理中，先退部分费用',
        refundAmount: 48,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-open-${suffix}`,
        orderId: openComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '服务与约定不符',
        status: 'OPEN',
      },
    });

    const resolvedComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-resolved-${suffix}`,
        orderNo: `PP-${keyword}-RESOLVED-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-03-30T09:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T10:00:00.000Z'),
        amountTotal: 88,
        amountAdjusted: 0,
        amountPaid: 88,
        amountRefunded: 28,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const mismatchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-resolved-${suffix}`,
        orderId: resolvedComplaintOrder.id,
        refundNo: `REF-COMPLAINT-RESOLVED-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '投诉已结案后的退款',
        refundAmount: 28,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T11:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-resolved-${suffix}`,
        orderId: resolvedComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '已处理完成',
        status: 'RESOLVED',
        closedAt: new Date('2026-03-30T12:00:00.000Z'),
      },
    });

    const noComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-none-${suffix}`,
        orderNo: `PP-${keyword}-NONE-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'FEEDING',
        appointmentStart: new Date('2026-03-30T12:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T13:00:00.000Z'),
        amountTotal: 66,
        amountAdjusted: 0,
        amountPaid: 66,
        amountRefunded: 18,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const noComplaintRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-none-${suffix}`,
        orderId: noComplaintOrder.id,
        refundNo: `REF-COMPLAINT-NONE-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '普通退款，无投诉',
        refundAmount: 18,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T12:30:00.000Z'),
      },
    });

    const foreignOpenComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-foreign-${suffix}`,
        orderNo: `PP-${keyword}-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T13:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T13:00:00.000Z'),
        amountTotal: 188,
        amountAdjusted: 0,
        amountPaid: 188,
        amountRefunded: 58,
        orderStatus: 'DISPUTED',
      },
    });

    const foreignRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-foreign-${suffix}`,
        orderId: foreignOpenComplaintOrder.id,
        refundNo: `REF-COMPLAINT-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign complaint refund',
        refundAmount: 58,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T13:30:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-foreign-${suffix}`,
        orderId: foreignOpenComplaintOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: 'foreign complaint',
        status: 'OPEN',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        complaintStatus: 'OPEN',
        orderNoKeyword: keyword,
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedRefundNos, [matchedRefund.refundNo]);
    assert.ok(!exportedRefundNos.includes(mismatchedRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(noComplaintRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignRefund.refundNo));

    const exportedRefunds = await prisma.refundRecord.findMany({
      where: {
        refundNo: {
          in: exportedRefundNos,
        },
      },
      select: {
        refundNo: true,
        order: {
          select: {
            ownerId: true,
            complaints: {
              where: {
                deleteAt: null,
              },
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    assert.equal(exportedRefunds.length, exportedRefundNos.length);
    assert.ok(exportedRefunds.every((item) => item.order.ownerId === ownerSession.user.id));
    assert.ok(
      exportedRefunds.every((item) =>
        item.order.complaints.some((complaint) => complaint.status === 'OPEN'),
      ),
    );
  });

  it('filters owner refund export by complaint type', async () => {
    const { app, prisma, ownerSession, caregiverProfile } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);
    const keyword = `REFUND-COMPLAINT-TYPE-${suffix}`.toUpperCase();

    const serviceComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-type-service-${suffix}`,
        orderNo: `PP-${keyword}-SERVICE-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T08:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T08:00:00.000Z'),
        amountTotal: 198,
        amountAdjusted: 0,
        amountPaid: 198,
        amountRefunded: 58,
        orderStatus: 'DISPUTED',
      },
    });

    const matchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-type-service-${suffix}`,
        orderId: serviceComplaintOrder.id,
        refundNo: `REF-COMPLAINT-TYPE-SERVICE-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '服务质量投诉退款',
        refundAmount: 58,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-type-service-${suffix}`,
        orderId: serviceComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '照料过程与约定不符',
        status: 'OPEN',
      },
    });

    const feeComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-type-fee-${suffix}`,
        orderNo: `PP-${keyword}-FEE-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-03-30T09:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T10:00:00.000Z'),
        amountTotal: 78,
        amountAdjusted: 0,
        amountPaid: 78,
        amountRefunded: 18,
        orderStatus: 'DISPUTED',
      },
    });

    const mismatchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-type-fee-${suffix}`,
        orderId: feeComplaintOrder.id,
        refundNo: `REF-COMPLAINT-TYPE-FEE-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '费用争议退款',
        refundAmount: 18,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T11:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-type-fee-${suffix}`,
        orderId: feeComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'FEE',
        description: '额外费用争议',
        status: 'OPEN',
      },
    });

    const noComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-type-none-${suffix}`,
        orderNo: `PP-${keyword}-NONE-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'FEEDING',
        appointmentStart: new Date('2026-03-30T12:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T13:00:00.000Z'),
        amountTotal: 56,
        amountAdjusted: 0,
        amountPaid: 56,
        amountRefunded: 16,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const noComplaintRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-type-none-${suffix}`,
        orderId: noComplaintOrder.id,
        refundNo: `REF-COMPLAINT-TYPE-NONE-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '普通退款，无投诉',
        refundAmount: 16,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T12:30:00.000Z'),
      },
    });

    const foreignServiceComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-type-foreign-${suffix}`,
        orderNo: `PP-${keyword}-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T13:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T13:00:00.000Z'),
        amountTotal: 208,
        amountAdjusted: 0,
        amountPaid: 208,
        amountRefunded: 68,
        orderStatus: 'DISPUTED',
      },
    });

    const foreignRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-type-foreign-${suffix}`,
        orderId: foreignServiceComplaintOrder.id,
        refundNo: `REF-COMPLAINT-TYPE-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign complaint refund',
        refundAmount: 68,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T13:30:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-type-foreign-${suffix}`,
        orderId: foreignServiceComplaintOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: 'foreign service complaint',
        status: 'OPEN',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        complaintType: 'SERVICE',
        orderNoKeyword: keyword,
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedRefundNos, [matchedRefund.refundNo]);
    assert.ok(!exportedRefundNos.includes(mismatchedRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(noComplaintRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignRefund.refundNo));

    const exportedRefunds = await prisma.refundRecord.findMany({
      where: {
        refundNo: {
          in: exportedRefundNos,
        },
      },
      select: {
        refundNo: true,
        order: {
          select: {
            ownerId: true,
            complaints: {
              where: {
                deleteAt: null,
              },
              select: {
                complaintType: true,
              },
            },
          },
        },
      },
    });

    assert.equal(exportedRefunds.length, exportedRefundNos.length);
    assert.ok(exportedRefunds.every((item) => item.order.ownerId === ownerSession.user.id));
    assert.ok(
      exportedRefunds.every((item) =>
        item.order.complaints.some((complaint) => complaint.complaintType === 'SERVICE'),
      ),
    );
  });

  it('filters owner refund export by complaint target role', async () => {
    const { app, prisma, ownerSession, caregiverProfile } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');
    const suffix = Date.now().toString(36);
    const keyword = `REFUND-COMPLAINT-ROLE-${suffix}`.toUpperCase();

    const platformComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-role-platform-${suffix}`,
        orderNo: `PP-${keyword}-PLATFORM-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T08:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T08:00:00.000Z'),
        amountTotal: 218,
        amountAdjusted: 0,
        amountPaid: 218,
        amountRefunded: 66,
        orderStatus: 'DISPUTED',
      },
    });

    const matchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-role-platform-${suffix}`,
        orderId: platformComplaintOrder.id,
        refundNo: `REF-COMPLAINT-ROLE-PLATFORM-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '平台责任投诉退款',
        refundAmount: 66,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-role-platform-${suffix}`,
        orderId: platformComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: '平台处理流程异常',
        status: 'OPEN',
      },
    });

    const caregiverComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-role-caregiver-${suffix}`,
        orderNo: `PP-${keyword}-CAREGIVER-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'WALKING',
        appointmentStart: new Date('2026-03-30T09:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T10:00:00.000Z'),
        amountTotal: 92,
        amountAdjusted: 0,
        amountPaid: 92,
        amountRefunded: 22,
        orderStatus: 'DISPUTED',
      },
    });

    const mismatchedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-role-caregiver-${suffix}`,
        orderId: caregiverComplaintOrder.id,
        refundNo: `REF-COMPLAINT-ROLE-CAREGIVER-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '照料者责任投诉退款',
        refundAmount: 22,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T11:00:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-role-caregiver-${suffix}`,
        orderId: caregiverComplaintOrder.id,
        complainantId: ownerSession.user.id,
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '照料者服务问题',
        status: 'OPEN',
      },
    });

    const noComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-role-none-${suffix}`,
        orderNo: `PP-${keyword}-NONE-${Date.now()}`,
        ownerId: ownerSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'FEEDING',
        appointmentStart: new Date('2026-03-30T12:00:00.000Z'),
        appointmentEnd: new Date('2026-03-30T13:00:00.000Z'),
        amountTotal: 62,
        amountAdjusted: 0,
        amountPaid: 62,
        amountRefunded: 14,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const noComplaintRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-role-none-${suffix}`,
        orderId: noComplaintOrder.id,
        refundNo: `REF-COMPLAINT-ROLE-NONE-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '普通退款，无投诉',
        refundAmount: 14,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T12:30:00.000Z'),
      },
    });

    const foreignPlatformComplaintOrder = await prisma.orderMain.create({
      data: {
        id: `order-refund-complaint-role-foreign-${suffix}`,
        orderNo: `PP-${keyword}-FOREIGN-${Date.now()}`,
        ownerId: adminSession.user.id,
        caregiverId: caregiverProfile.id,
        serviceType: 'BOARDING',
        appointmentStart: new Date('2026-03-30T13:00:00.000Z'),
        appointmentEnd: new Date('2026-03-31T13:00:00.000Z'),
        amountTotal: 228,
        amountAdjusted: 0,
        amountPaid: 228,
        amountRefunded: 72,
        orderStatus: 'DISPUTED',
      },
    });

    const foreignRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-complaint-role-foreign-${suffix}`,
        orderId: foreignPlatformComplaintOrder.id,
        refundNo: `REF-COMPLAINT-ROLE-FOREIGN-${Date.now()}`,
        applyUserId: adminSession.user.id,
        refundType: 'PARTIAL',
        refundReason: 'foreign platform complaint refund',
        refundAmount: 72,
        refundStatus: 'SUCCESS',
        createdAt: new Date('2026-03-30T13:30:00.000Z'),
      },
    });

    await prisma.complaint.create({
      data: {
        id: `complaint-role-foreign-${suffix}`,
        orderId: foreignPlatformComplaintOrder.id,
        complainantId: adminSession.user.id,
        targetRole: 'PLATFORM',
        complaintType: 'SERVICE',
        description: 'foreign platform complaint',
        status: 'OPEN',
      },
    });

    const exportResponse = await request(app)
      .get('/api/petpal/orders/refunds/export')
      .query({
        complaintTargetRole: 'PLATFORM',
        orderNoKeyword: keyword,
      })
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    const worksheet = await loadWorksheet(exportResponse.body as Buffer);
    const exportedRefundNos = Array.from(
      { length: Math.max(0, worksheet.rowCount - 1) },
      (_, index) => String(worksheet.getRow(index + 2).getCell(6).value ?? ''),
    ).filter(Boolean);

    assert.deepEqual(exportedRefundNos, [matchedRefund.refundNo]);
    assert.ok(!exportedRefundNos.includes(mismatchedRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(noComplaintRefund.refundNo));
    assert.ok(!exportedRefundNos.includes(foreignRefund.refundNo));

    const exportedRefunds = await prisma.refundRecord.findMany({
      where: {
        refundNo: {
          in: exportedRefundNos,
        },
      },
      select: {
        refundNo: true,
        order: {
          select: {
            ownerId: true,
            complaints: {
              where: {
                deleteAt: null,
              },
              select: {
                targetRole: true,
              },
            },
          },
        },
      },
    });

    assert.equal(exportedRefunds.length, exportedRefundNos.length);
    assert.ok(exportedRefunds.every((item) => item.order.ownerId === ownerSession.user.id));
    assert.ok(
      exportedRefunds.every((item) =>
        item.order.complaints.some((complaint) => complaint.targetRole === 'PLATFORM'),
      ),
    );
  });

  it('returns owner refund progress snapshots for pending, approved and successful refunds', async () => {
    const { app, prisma, ownerSession, caregiverSession, order } =
      await createFulfillmentScenario();

    const refund = await prisma.refundRecord.create({
      data: {
        id: `refund-progress-${Date.now().toString(36)}`,
        orderId: order.id,
        refundNo: `REF-PROGRESS-${Date.now()}`,
        applyUserId: ownerSession.user.id,
        refundType: 'PARTIAL',
        refundReason: '服务时段缩短，需要退回部分费用',
        refundAmount: 20,
        refundStatus: 'PENDING',
      },
    });

    const pendingResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}/refund-progress`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(pendingResponse.body.data.stage, 'PENDING_REVIEW');
    assert.equal(pendingResponse.body.data.totalRefundCount, 1);
    assert.equal(pendingResponse.body.data.pendingCount, 1);
    assert.equal(pendingResponse.body.data.latestRefundNo, refund.refundNo);
    assert.equal(pendingResponse.body.data.latestRefundReason, '服务时段缩短，需要退回部分费用');

    await prisma.refundRecord.update({
      where: {
        id: refund.id,
      },
      data: {
        refundStatus: 'APPROVED',
        reviewedAt: new Date('2026-04-05T10:00:00.000Z'),
      },
    });

    const approvedResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}/refund-progress`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(approvedResponse.body.data.stage, 'APPROVED_WAITING');
    assert.equal(approvedResponse.body.data.approvedCount, 1);
    assert.equal(approvedResponse.body.data.latestRefundStatus, 'APPROVED');

    await prisma.refundRecord.update({
      where: {
        id: refund.id,
      },
      data: {
        refundStatus: 'SUCCESS',
      },
    });

    await prisma.orderMain.update({
      where: {
        id: order.id,
      },
      data: {
        amountRefunded: 20,
        orderStatus: 'PARTIAL_REFUNDED',
      },
    });

    const successResponse = await request(app)
      .get(`/api/petpal/orders/${order.id}/refund-progress`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(successResponse.body.data.stage, 'PARTIAL_SUCCESS');
    assert.equal(successResponse.body.data.successCount, 1);
    assert.equal(Number(successResponse.body.data.settledRefundAmount), 20);
    assert.equal(Number(successResponse.body.data.refundableBalance), 68);

    await request(app)
      .get(`/api/petpal/orders/${order.id}/refund-progress`)
      .set('Authorization', `Bearer ${caregiverSession.tokens.accessToken}`)
      .expect(404);
  });

  it('allows admin to assign, investigate and close complaints', async () => {
    const { app, ownerSession, caregiverSession, order } = await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

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
        description: '上门签到时间明显晚于约定，希望平台介入核实并处理。',
        evidenceUrls: ['https://example.com/evidence/late-arrival.png'],
      })
      .expect(200);

    const complaintId = complaintResponse.body.data.id as string;

    const listResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        status: 'OPEN',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(listResponse.body.data.items.length, 1);
    assert.equal(listResponse.body.data.items[0].id, complaintId);
    assert.equal(listResponse.body.data.items[0].orderNo, order.orderNo);
    assert.equal(listResponse.body.data.items[0].ownerId, ownerSession.user.id);

    const assignResponse = await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'ASSIGN',
        assigneeId: adminSession.user.id,
      })
      .expect(200);

    assert.equal(assignResponse.body.data.status, 'PROCESSING');
    assert.equal(assignResponse.body.data.assignedAdminId, adminSession.user.id);
    assert.ok(assignResponse.body.data.assignedAdminNickname);
    assert.equal(assignResponse.body.data.processLogs.at(-1)?.actionType, 'ASSIGN');

    const investigateResponse = await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'INVESTIGATE',
        note: '已调取签到记录并联系照料者补充说明。',
      })
      .expect(200);

    assert.equal(investigateResponse.body.data.status, 'PROCESSING');
    assert.equal(investigateResponse.body.data.processLogs.at(-1)?.actionType, 'INVESTIGATE');
    assert.ok(investigateResponse.body.data.processLogs.at(-1)?.operatorNickname);

    const closeResponse = await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'CLOSE',
        resultStatus: 'RESOLVED',
        resultSummary: '已核实签到超时，平台已协调退款并完成结案。',
      })
      .expect(200);

    assert.equal(closeResponse.body.data.status, 'RESOLVED');
    assert.equal(
      closeResponse.body.data.resultSummary,
      '已核实签到超时，平台已协调退款并完成结案。',
    );
    assert.ok(closeResponse.body.data.closedAt);
    assert.equal(closeResponse.body.data.processLogs.at(-1)?.actionType, 'CLOSE');

    const ownerComplaintList = await request(app)
      .get(`/api/petpal/orders/${order.id}/complaints`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(ownerComplaintList.body.data[0].status, 'RESOLVED');
    assert.ok(ownerComplaintList.body.data[0].assignedAdminNickname);
    assert.ok(ownerComplaintList.body.data[0].processLogs.at(-1)?.operatorNickname);

    const closedUpdateResponse = await request(app)
      .post(`/api/petpal/admin/complaints/${complaintId}/actions`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        actionType: 'CALL_USER',
        note: '结案后再次补充回访。',
      })
      .expect(400);

    assert.equal(closedUpdateResponse.body.message, 'Closed complaints cannot be updated');
  });

  it('supports SLA filters for complaint admin list', async () => {
    const { app, prisma, ownerSession, caregiverSession, order } =
      await createFulfillmentScenario();
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

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
        description: '需要验证投诉工单的 SLA 预警筛选与截止时间回传。',
      })
      .expect(200);

    const complaintId = complaintResponse.body.data.id as string;
    const dueSoonCreatedAt = new Date(Date.now() - 21 * 60 * 60 * 1000);
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
        new Date(dueSoonResponse.body.data.items[0].slaDeadlineAt).getTime() -
          (dueSoonCreatedAt.getTime() + 24 * 60 * 60 * 1000),
      ) < 1_000,
    );

    const overdueCreatedAt = new Date(Date.now() - 26 * 60 * 60 * 1000);
    await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        createdAt: overdueCreatedAt,
      },
    });

    const overdueResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        slaStatus: 'OVERDUE',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(overdueResponse.body.data.items.length, 1);
    assert.equal(overdueResponse.body.data.items[0].slaStatus, 'OVERDUE');

    const normalResponse = await request(app)
      .get('/api/petpal/admin/complaints')
      .query({
        slaStatus: 'NORMAL',
        keyword: order.orderNo,
      })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(normalResponse.body.data.items.length, 0);
  });

  it('supports batch assigning complaints for admin workbench', async () => {
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
        description: '第一条投诉工单用于验证后端批量分配。',
      })
      .expect(200);

    const secondComplaint = await request(secondScenario.app)
      .post(`/api/petpal/orders/${secondScenario.order.id}/complaints`)
      .set('Authorization', `Bearer ${secondScenario.ownerSession.tokens.accessToken}`)
      .send({
        targetRole: 'CAREGIVER',
        complaintType: 'SERVICE',
        description: '第二条投诉工单用于验证后端批量分配。',
      })
      .expect(200);

    const batchAssignResponse = await request(firstScenario.app)
      .post('/api/petpal/admin/complaints/batch-assign')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        complaintIds: [firstComplaint.body.data.id, secondComplaint.body.data.id],
        assigneeId: adminSession.user.id,
        note: '夜班值守统一接手处理。',
      })
      .expect(200);

    assert.equal(batchAssignResponse.body.data.requestedCount, 2);
    assert.equal(batchAssignResponse.body.data.updatedCount, 2);
    assert.equal(batchAssignResponse.body.data.items.length, 2);
    assert.ok(
      batchAssignResponse.body.data.items.every(
        (item: {
          assignedAdminId: string;
          status: string;
          processLogs: Array<{ actionType: string; note?: string | null }>;
        }) =>
          item.assignedAdminId === adminSession.user.id &&
          item.status === 'PROCESSING' &&
          item.processLogs.at(-1)?.actionType === 'ASSIGN' &&
          item.processLogs.at(-1)?.note === '夜班值守统一接手处理。',
      ),
    );
  });

  it('forbids non-admin users from accessing complaint admin endpoints', async () => {
    const { app, ownerSession, caregiverSession, order } = await createFulfillmentScenario();

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
        description: '普通成员不应访问投诉管理端接口。',
      })
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/complaints')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .expect(403);

    await request(app)
      .post(`/api/petpal/admin/complaints/${complaintResponse.body.data.id}/actions`)
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        actionType: 'INVESTIGATE',
        note: '越权尝试',
      })
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/complaints/batch-assign')
      .set('Authorization', `Bearer ${ownerSession.tokens.accessToken}`)
      .send({
        complaintIds: [complaintResponse.body.data.id],
        assigneeId: ownerSession.user.id,
      })
      .expect(403);
  });

  it('handles payment and refund callbacks with idempotency', async () => {
    const { app, prisma } = context;

    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: {
        id: true,
        ownerId: true,
      },
    });
    assert.ok(baseOrder);

    const callbackPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-callback-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-CB-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 5,
      },
    });

    const paymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: callbackPayment.payNo,
        channelTxnId: `WXTXN-CB-${Date.now()}`,
        success: true,
        paidAmount: 5,
      })
      .expect(200);

    assert.equal(paymentCallback.body.data.idempotent, false);
    assert.equal(paymentCallback.body.data.callbackAuth.sourceMode, 'TOKEN');
    assert.ok(typeof paymentCallback.body.data.callbackAuth.signatureDigest === 'string');
    assert.ok(typeof paymentCallback.body.data.callbackAuth.requestId === 'string');

    const persistedPayment = await prisma.paymentRecord.findUnique({
      where: {
        payNo: callbackPayment.payNo,
      },
      select: {
        channelTxnId: true,
      },
    });

    assert.ok(persistedPayment?.channelTxnId);

    const idempotentPaymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: callbackPayment.payNo,
        channelTxnId: persistedPayment.channelTxnId,
        success: true,
        paidAmount: 5,
      })
      .expect(200);

    assert.equal(idempotentPaymentCallback.body.data.idempotent, true);

    const retryPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-retry-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-RETRY-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 8,
      },
    });

    const failedPaymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: retryPayment.payNo,
        channelTxnId: `WXTXN-FAIL-${Date.now()}`,
        success: false,
      })
      .expect(200);

    assert.equal(failedPaymentCallback.body.data.idempotent, false);
    assert.equal(failedPaymentCallback.body.data.payStatus, 'FAILED');

    const failedPaymentAudit = await prisma.callbackAudit.findFirst({
      where: {
        paymentId: retryPayment.id,
        callbackType: 'PAYMENT_CALLBACK',
        callbackStatus: 'FAILURE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });
    assert.ok(failedPaymentAudit);

    const paymentOutbox = await prisma.callbackAlertOutbox.findFirst({
      where: {
        callbackAuditId: failedPaymentAudit.id,
      },
      select: {
        status: true,
      },
    });
    assert.ok(paymentOutbox);
    assert.equal(paymentOutbox.status, 'PENDING');

    const recoveredPaymentCallback = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: retryPayment.payNo,
        channelTxnId: `WXTXN-RECOVER-${Date.now()}`,
        success: true,
        paidAmount: 8,
      })
      .expect(200);

    assert.equal(recoveredPaymentCallback.body.data.idempotent, false);
    assert.equal(recoveredPaymentCallback.body.data.payStatus, 'PAID');

    const refund = await prisma.refundRecord.findUnique({
      where: {
        refundNo: 'REF202603300001',
      },
      select: {
        refundNo: true,
      },
    });

    assert.ok(refund);

    const refundCallback = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: refund.refundNo,
        channelRefundId: `WXREF-CB-${Date.now()}`,
        success: true,
      })
      .expect(200);

    assert.equal(typeof refundCallback.body.data.idempotent, 'boolean');
    assert.equal(refundCallback.body.data.callbackAuth.sourceMode, 'TOKEN');
    assert.ok(typeof refundCallback.body.data.callbackAuth.signatureDigest === 'string');

    const retryRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-retry-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        paymentId: retryPayment.id,
        refundNo: `REF-RETRY-${Date.now()}`,
        applyUserId: baseOrder.ownerId,
        refundType: 'PARTIAL',
        refundReason: 'retry case',
        refundAmount: 2,
        refundStatus: 'PENDING',
      },
    });

    const failedRefundCallback = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: retryRefund.refundNo,
        channelRefundId: `WXREF-FAIL-${Date.now()}`,
        success: false,
      })
      .expect(200);

    assert.equal(failedRefundCallback.body.data.idempotent, false);
    assert.equal(failedRefundCallback.body.data.refundStatus, 'FAILED');

    const failedRefundAudit = await prisma.callbackAudit.findFirst({
      where: {
        refundId: retryRefund.id,
        callbackType: 'REFUND_CALLBACK',
        callbackStatus: 'FAILURE',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });
    assert.ok(failedRefundAudit);

    const refundOutbox = await prisma.callbackAlertOutbox.findFirst({
      where: {
        callbackAuditId: failedRefundAudit.id,
      },
      select: {
        status: true,
      },
    });
    assert.ok(refundOutbox);
    assert.equal(refundOutbox.status, 'PENDING');

    const recoveredRefundCallback = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: retryRefund.refundNo,
        channelRefundId: `WXREF-RECOVER-${Date.now()}`,
        success: true,
      })
      .expect(200);

    assert.equal(recoveredRefundCallback.body.data.idempotent, false);
    assert.equal(recoveredRefundCallback.body.data.refundStatus, 'SUCCESS');

    const order = await prisma.orderMain.findUnique({
      where: {
        id: baseOrder.id,
      },
      select: {
        amountTotal: true,
        amountAdjusted: true,
        amountPaid: true,
        amountRefunded: true,
      },
    });

    assert.ok(order);
    const amountTotal = Number(order.amountTotal);
    const amountAdjusted = Number(order.amountAdjusted);
    const amountPaid = Number(order.amountPaid);
    const amountRefunded = Number(order.amountRefunded);
    assert.ok(amountPaid - amountRefunded >= 0);
    assert.ok(amountPaid >= amountTotal + amountAdjusted - amountRefunded);
  });

  it('persists callback audit records for payment and refund callbacks', async () => {
    const { app, prisma } = context;

    // Setup: Get existing order from seed data
    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: {
        id: true,
        ownerId: true,
        caregiverId: true,
      },
    });
    assert.ok(baseOrder, 'Base order should exist from seed data');

    const auditPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-audit-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-AUDIT-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 100,
      },
    });

    // Execute: Send payment callback
    const channelTxnId = `WXTXN-AUDIT-${Date.now()}`;
    const paymentCallbackResponse = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: auditPayment.payNo,
        channelTxnId,
        success: true,
        paidAmount: 100,
      })
      .expect(200);

    // Verify: Payment callback audit record exists
    const paymentAudit = await prisma.callbackAudit.findFirst({
      where: {
        paymentId: auditPayment.id,
        callbackType: 'PAYMENT_CALLBACK',
      },
    });

    assert.ok(paymentAudit, 'Payment audit record should exist');
    assert.equal(paymentAudit.callbackStatus, 'SUCCESS', 'Payment audit status should be SUCCESS');
    assert.equal(paymentAudit.sourceMode, 'TOKEN', 'Payment audit should use TOKEN source mode');
    assert.ok(paymentAudit.signatureDigest, 'Payment audit should have signature digest');
    assert.ok(paymentAudit.requestId, 'Payment audit should have requestId');
    assert.ok(paymentAudit.rawPayload, 'Payment audit should have raw payload');
    assert.ok(paymentAudit.verificationResult, 'Payment audit should have verification result');

    // Verify: Idempotent callback also creates audit record
    const idempotentAuditResponse = await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: auditPayment.payNo,
        channelTxnId,
        success: true,
        paidAmount: 100,
      })
      .expect(200);

    assert.equal(idempotentAuditResponse.body.data.idempotent, true);

    const idempotentAudits = await prisma.callbackAudit.findMany({
      where: {
        paymentId: auditPayment.id,
        callbackType: 'PAYMENT_CALLBACK',
      },
    });

    assert.equal(idempotentAudits.length, 2, 'Should have 2 audit records (initial + idempotent)');
    assert.ok(idempotentAudits.every((a) => a.callbackStatus === 'SUCCESS'));

    // Setup: Create refund for audit testing
    const refund = await prisma.refundRecord.create({
      data: {
        id: `refund-audit-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        paymentId: auditPayment.id,
        refundNo: `REF-AUDIT-${Date.now()}`,
        applyUserId: baseOrder.ownerId,
        refundType: 'PARTIAL',
        refundReason: 'audit test',
        refundAmount: 50,
        refundStatus: 'PENDING',
      },
    });

    // Execute: Send refund callback
    const refundChannelTxnId = `WXREF-AUDIT-${Date.now()}`;
    const refundCallbackResponse = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: refund.refundNo,
        channelRefundId: refundChannelTxnId,
        success: true,
      })
      .expect(200);

    // Verify: Refund callback audit record exists
    const refundAudit = await prisma.callbackAudit.findFirst({
      where: {
        refundId: refund.id,
        callbackType: 'REFUND_CALLBACK',
      },
    });

    assert.ok(refundAudit, 'Refund audit record should exist');
    assert.equal(refundAudit.callbackStatus, 'SUCCESS', 'Refund audit status should be SUCCESS');
    assert.equal(refundAudit.sourceMode, 'TOKEN', 'Refund audit should use TOKEN source mode');
    assert.ok(refundAudit.signatureDigest, 'Refund audit should have signature digest');
    assert.ok(refundAudit.verificationResult, 'Refund audit should have verification result');

    // Verify: Failed callbacks also create audit records
    const failedRefund = await prisma.refundRecord.create({
      data: {
        id: `refund-fail-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        paymentId: auditPayment.id,
        refundNo: `REF-FAIL-${Date.now()}`,
        applyUserId: baseOrder.ownerId,
        refundType: 'PARTIAL',
        refundReason: 'failed audit test',
        refundAmount: 25,
        refundStatus: 'PENDING',
      },
    });

    const failedCallbackResponse = await request(app)
      .post('/api/petpal/refunds/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        refundNo: failedRefund.refundNo,
        channelRefundId: `WXREF-FAIL-${Date.now()}`,
        success: false,
      })
      .expect(200);

    const failedRefundAudit = await prisma.callbackAudit.findFirst({
      where: {
        refundId: failedRefund.id,
        callbackType: 'REFUND_CALLBACK',
      },
    });

    assert.ok(failedRefundAudit, 'Failed refund audit record should exist');
    assert.equal(
      failedRefundAudit.callbackStatus,
      'FAILURE',
      'Failed audit status should be FAILURE',
    );
  });

  it('admin can query callback audit logs with filters', async () => {
    const { app, prisma } = context;

    // Login as admin user
    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    // Setup: Get existing order
    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: { id: true },
    });
    assert.ok(baseOrder);

    // Create a test payment and callback for audit query
    const testPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-query-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-QUERY-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 50,
      },
    });

    // Send callback
    const channelTxnId = `WXTXN-QUERY-${Date.now()}`;
    await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: testPayment.payNo,
        channelTxnId,
        success: true,
        paidAmount: 50,
      })
      .expect(200);

    // Test: Query all audit logs (no filter)
    const allAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(allAuditsResponse.body.data.items));
    assert.ok(allAuditsResponse.body.data.pagination.total > 0);
    assert.ok(allAuditsResponse.body.data.pagination.page === 1);
    assert.ok(allAuditsResponse.body.data.pagination.pageSize > 0);

    // Test: Query with callback type filter
    const paymentAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits?callbackType=PAYMENT_CALLBACK')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(paymentAuditsResponse.body.data.items));
    assert.ok(
      paymentAuditsResponse.body.data.items.every(
        (a: any) => a.callbackType === 'PAYMENT_CALLBACK',
      ),
    );

    // Test: Query with status filter
    const successAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits?callbackStatus=SUCCESS')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(successAuditsResponse.body.data.items));
    assert.ok(successAuditsResponse.body.data.items.length > 0);
    assert.ok(
      successAuditsResponse.body.data.items.every((a: any) => a.callbackStatus === 'SUCCESS'),
    );

    // Test: Query with source mode filter
    const tokenAuditsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits?sourceMode=TOKEN')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(tokenAuditsResponse.body.data.items));
    assert.ok(tokenAuditsResponse.body.data.items.every((a: any) => a.sourceMode === 'TOKEN'));

    // Test: Query with requestId
    const createdAudit = await prisma.callbackAudit.findFirst({
      where: {
        paymentId: testPayment.id,
      },
      select: {
        requestId: true,
      },
    });

    assert.ok(createdAudit);

    const requestIdQueryResponse = await request(app)
      .get(`/api/petpal/admin/callback-audits?requestId=${createdAudit.requestId}`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(requestIdQueryResponse.body.data.items.length === 1);
    assert.equal(requestIdQueryResponse.body.data.items[0].requestId, createdAudit.requestId);

    // Test: Query with pagination
    const page2Response = await request(app)
      .get('/api/petpal/admin/callback-audits?page=2&pageSize=5')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(page2Response.body.data.pagination.page, 2);
    assert.equal(page2Response.body.data.pagination.pageSize, 5);
  });

  it('admin can query callback audit stats and export audit logs', async () => {
    const { app, prisma } = context;

    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: { id: true },
    });
    assert.ok(baseOrder);

    const paymentForStats = await prisma.paymentRecord.create({
      data: {
        id: `pay-stats-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-STATS-${Date.now()}`,
        bizType: 'BALANCE',
        payChannel: 'WECHAT',
        payStatus: 'PENDING',
        payAmount: 33,
      },
    });

    await request(app)
      .post('/api/petpal/payments/callback')
      .set('x-petpal-callback-token', 'petpal-dev-callback-token')
      .send({
        payNo: paymentForStats.payNo,
        channelTxnId: `WXTXN-STATS-${Date.now()}`,
        success: true,
        paidAmount: 33,
      })
      .expect(200);

    const statsResponse = await request(app)
      .get('/api/petpal/admin/callback-audits/stats?sourceMode=TOKEN')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof statsResponse.body.data.total === 'number');
    assert.ok(typeof statsResponse.body.data.successRate === 'number');
    assert.ok(typeof statsResponse.body.data.byStatus.SUCCESS === 'number');
    assert.ok(typeof statsResponse.body.data.byType.PAYMENT_CALLBACK === 'number');
    assert.ok(typeof statsResponse.body.data.bySourceMode.TOKEN === 'number');
    assert.ok(statsResponse.body.data.total >= 1);

    const exportResponse = await request(app)
      .get('/api/petpal/admin/callback-audits/export?sourceMode=TOKEN')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    const contentType = String(exportResponse.headers['content-type'] ?? '');
    const contentDisposition = String(exportResponse.headers['content-disposition'] ?? '');

    assert.match(
      contentType,
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
    );
    assert.match(contentDisposition, /attachment;\s*filename=/i);
    assert.ok(Buffer.isBuffer(exportResponse.body));
    assert.ok(exportResponse.body.length > 0);
  });

  it('admin can query callback alert outbox and requeue dead messages', async () => {
    const { app, prisma } = context;

    const adminSession = await loginAs(app, 'admin', 'Admin123!');

    const baseOrder = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: { id: true },
    });
    assert.ok(baseOrder);

    const failedPayment = await prisma.paymentRecord.create({
      data: {
        id: `pay-outbox-${Date.now().toString(36)}`,
        orderId: baseOrder.id,
        payNo: `PAY-OUTBOX-${Date.now()}`,
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
        channelTxnId: `WXTXN-OUTBOX-${Date.now()}`,
        success: false,
      })
      .expect(200);

    const outboxListResponse = await request(app)
      .get('/api/petpal/admin/callback-alert-outbox?status=PENDING')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(outboxListResponse.body.data.items));
    assert.ok(outboxListResponse.body.data.items.length >= 1);

    const outboxId = outboxListResponse.body.data.items[0].id as string;

    await prisma.callbackAlertOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'DEAD',
        retryCount: 5,
      },
    });

    const outboxStatsResponse = await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/stats')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof outboxStatsResponse.body.data.total === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.byStatus.DEAD === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.oldestPendingAgeMinutes === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.oldestDeadAgeMinutes === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.stuckProcessingCount === 'number');
    assert.ok(typeof outboxStatsResponse.body.data.processingTimeoutMinutes === 'number');

    const retryResponse = await request(app)
      .post(`/api/petpal/admin/callback-alert-outbox/${outboxId}/retry`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.equal(retryResponse.body.data.id, outboxId);
    assert.equal(retryResponse.body.data.status, 'PENDING');

    const replayLogsAfterSingleRetry = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(replayLogsAfterSingleRetry.body.data.items));
    assert.ok(typeof replayLogsAfterSingleRetry.body.data.pagination.total === 'number');
    assert.equal(replayLogsAfterSingleRetry.body.data.items[0].actionType, 'REQUEUE');
    assert.ok(typeof replayLogsAfterSingleRetry.body.data.items[0].actorId === 'string');

    await prisma.callbackAlertOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'DEAD',
      },
    });

    const retryDeadResponse = await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/retry-dead')
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ limit: 20 })
      .expect(200);

    assert.ok(retryDeadResponse.body.data.requeued >= 1);
    assert.equal(retryDeadResponse.body.data.requested, 20);

    const replayLogsAfterBatchRetry = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(
      replayLogsAfterBatchRetry.body.data.items.some(
        (item: any) => item.actionType === 'REQUEUE_DEAD_BATCH',
      ),
    );

    const filteredReplayLogs = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .query({ actionType: 'REQUEUE_DEAD_BATCH', actorId: adminSession.user.id })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(filteredReplayLogs.body.data.items));
    assert.ok(filteredReplayLogs.body.data.items.length >= 1);
    assert.ok(
      filteredReplayLogs.body.data.items.every(
        (item: any) => item.actionType === 'REQUEUE_DEAD_BATCH',
      ),
    );
    assert.ok(
      filteredReplayLogs.body.data.items.every(
        (item: any) => item.actorId === adminSession.user.id,
      ),
    );

    const replayLogStatsResponse = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs/stats`)
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(typeof replayLogStatsResponse.body.data.total === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.byAction.REQUEUE === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.byAction.REQUEUE_DEAD_BATCH === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.uniqueActorCount === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.batchReplayRatio === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.isBatchReplayDominant === 'boolean');
    assert.ok(
      replayLogStatsResponse.body.data.latestReplayAt === null ||
        typeof replayLogStatsResponse.body.data.latestReplayAt === 'string',
    );
    assert.ok(
      replayLogStatsResponse.body.data.minutesSinceLastReplay === null ||
        typeof replayLogStatsResponse.body.data.minutesSinceLastReplay === 'number',
    );
    assert.ok(typeof replayLogStatsResponse.body.data.dominanceThreshold === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.dominanceMinSamples === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.staleThresholdMinutes === 'number');
    assert.ok(typeof replayLogStatsResponse.body.data.isReplayStale === 'boolean');

    const futureReplayLogs = await request(app)
      .get(`/api/petpal/admin/callback-alert-outbox/${outboxId}/replay-logs`)
      .query({ startDate: '2099-01-01T00:00:00.000Z', endDate: '2099-12-31T23:59:59.999Z' })
      .set('Authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .expect(200);

    assert.ok(Array.isArray(futureReplayLogs.body.data.items));
    assert.equal(futureReplayLogs.body.data.items.length, 0);
  });

  it('rejects tampered active role context and allows valid scoped role context', async () => {
    const { app, prisma } = context;

    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    const [superAdminRole, managerRole] = await Promise.all([
      prisma.role.findUnique({ where: { code: 'super-admin' }, select: { id: true } }),
      prisma.role.findUnique({ where: { code: 'ops-manager' }, select: { id: true } }),
    ]);

    assert.ok(superAdminRole);
    assert.ok(managerRole);

    await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', superAdminRole.id)
      .expect(401);

    await request(app)
      .get('/api/petpal/admin/callback-audits')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-audits/export')
      .set('Authorization', `Bearer ${managerSession.tokens.accessToken}`)
      .set('x-active-role-id', managerRole.id)
      .expect(403);
  });

  it('forbids non-admin users from accessing callback audit admin endpoints', async () => {
    const { app } = context;

    const memberSession = await loginAs(app, 'user', 'User123!');
    const authHeader = { Authorization: `Bearer ${memberSession.tokens.accessToken}` };

    await request(app).get('/api/petpal/admin/callback-audits').set(authHeader).expect(403);

    await request(app).get('/api/petpal/admin/callback-audits/stats').set(authHeader).expect(403);

    await request(app).get('/api/petpal/admin/callback-audits/export').set(authHeader).expect(403);

    await request(app).get('/api/petpal/admin/callback-alert-outbox').set(authHeader).expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/stats')
      .set(authHeader)
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/unknown/retry')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs/stats')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/replay-logs/export?outboxId=unknown')
      .set(authHeader)
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/retry-dead')
      .set(authHeader)
      .send({ limit: 20 })
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/caregivers/unknown/audit')
      .set(authHeader)
      .send({ status: 'APPROVED' })
      .expect(403);

    await request(app).get('/api/petpal/admin/caregivers').set(authHeader).expect(403);
  });

  it('allows manager to read callback audits but forbids export', async () => {
    const { app } = context;

    const managerSession = await loginAs(app, 'manager', 'Manager123!');
    const authHeader = { Authorization: `Bearer ${managerSession.tokens.accessToken}` };

    await request(app).get('/api/petpal/admin/callback-audits').set(authHeader).expect(200);

    await request(app).get('/api/petpal/admin/callback-audits/stats').set(authHeader).expect(200);

    await request(app).get('/api/petpal/admin/callback-audits/export').set(authHeader).expect(403);

    await request(app).get('/api/petpal/admin/callback-alert-outbox').set(authHeader).expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/stats')
      .set(authHeader)
      .expect(200);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/unknown/retry')
      .set(authHeader)
      .expect(403);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/unknown/replay-logs/stats')
      .set(authHeader)
      .expect(200);

    await request(app)
      .get('/api/petpal/admin/callback-alert-outbox/replay-logs/export?outboxId=unknown')
      .set(authHeader)
      .expect(403);

    await request(app)
      .post('/api/petpal/admin/callback-alert-outbox/retry-dead')
      .set(authHeader)
      .send({ limit: 20 })
      .expect(403);
  });
});
