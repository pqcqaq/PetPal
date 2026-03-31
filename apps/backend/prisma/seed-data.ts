import 'dotenv/config';
import type { Prisma, PrismaClient } from '../src/lib/prisma-generated';
import { defaultAuthClientSeeds } from '../src/config/auth-clients';
import { bootstrapSystemRbac } from '../src/services/system-rbac';
import { hashPassword, hashSecret } from '../src/utils/password';
import { encryptOAuthSecret } from '../src/utils/oauth-security';
import { withSnowflakeId, withSnowflakeIds } from '../src/utils/persistence';
import { syncUserRoles } from '../src/services/rbac-write';

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "CallbackAlertReplayLog",
      "CallbackAlertOutbox",
      "RefundRecord",
      "PaymentRecord",
      "ServiceLog",
      "OrderTimeline",
      "OrderMain",
      "ServiceRequest",
      "CaregiverService",
      "CaregiverProfile",
      "PetProfile",
      "VerificationCode",
      "UserAuthentication",
      "AuthStrategy",
      "OAuthToken",
      "OAuthUser",
      "OAuthState",
      "OAuthApplicationPermission",
      "OAuthApplication",
      "OAuthProvider",
      "MenuNode",
      "RolePermission",
      "UserRole",
      "RefreshToken",
      "AuthClient",
      "Operation",
      "RequestRecord",
      "ChatMessage",
      "MediaAsset",
      "RealtimeTopic",
      "Permission",
      "Role",
      "User"
    RESTART IDENTITY CASCADE
  `);

  const { roleByCode } = await bootstrapSystemRbac(prisma);
  const adminRole = roleByCode.get('super-admin');
  const managerRole = roleByCode.get('ops-manager');
  const userRole = roleByCode.get('member');

  if (!adminRole || !managerRole || !userRole) {
    throw new Error('System roles bootstrap failed');
  }

  const authClients = await Promise.all(
    defaultAuthClientSeeds.map(async (client) => {
      const secret = await hashSecret(client.clientSecret);

      return {
        code: client.code,
        name: client.name,
        type: client.type,
        description: client.description ?? null,
        config: client.config as unknown as Prisma.InputJsonValue,
        secretHash: secret.hash,
        salt: secret.salt,
        enabled: client.enabled ?? true,
      };
    }),
  );

  await prisma.authClient.createMany({
    data: withSnowflakeIds(authClients),
  });

  const [usernamePasswordStrategy, emailCodeStrategy, phoneCodeStrategy] = await Promise.all([
    prisma.authStrategy.create({
      data: withSnowflakeId({
        code: 'username-password',
        name: '用户名密码',
        description: '使用用户名与密码完成登录或注册。',
        identifierType: 'USERNAME',
        credentialType: 'PASSWORD',
        enabled: true,
        loginEnabled: true,
        registerEnabled: true,
        verificationEnabled: false,
        mockEnabled: true,
        sortOrder: 10,
      }),
    }),
    prisma.authStrategy.create({
      data: withSnowflakeId({
        code: 'email-code',
        name: '邮箱验证码',
        description: '使用邮箱验证码完成登录或注册。',
        identifierType: 'EMAIL',
        credentialType: 'VERIFICATION_CODE',
        enabled: true,
        loginEnabled: true,
        registerEnabled: true,
        verificationEnabled: true,
        mockEnabled: true,
        mockValue: '123456',
        sortOrder: 20,
      }),
    }),
    prisma.authStrategy.create({
      data: withSnowflakeId({
        code: 'phone-code',
        name: '手机号验证码',
        description: '使用手机号验证码完成登录或注册。',
        identifierType: 'PHONE',
        credentialType: 'VERIFICATION_CODE',
        enabled: true,
        loginEnabled: true,
        registerEnabled: true,
        verificationEnabled: true,
        mockEnabled: true,
        mockValue: '654321',
        sortOrder: 30,
      }),
    }),
  ]);

  const admin = await prisma.user.create({
    data: withSnowflakeId({
      username: 'admin',
      email: 'admin@example.com',
      nickname: '系统管理员',
    }),
  });
  await syncUserRoles(admin.id, [adminRole.id]);

  const manager = await prisma.user.create({
    data: withSnowflakeId({
      username: 'manager',
      email: 'manager@example.com',
      nickname: '运营经理',
    }),
  });
  await syncUserRoles(manager.id, [managerRole.id]);

  const member = await prisma.user.create({
    data: withSnowflakeId({
      username: 'user',
      email: 'user@example.com',
      nickname: '普通用户',
    }),
  });
  await syncUserRoles(member.id, [userRole.id]);

  const managerCaregiverProfile = await prisma.caregiverProfile.create({
    data: withSnowflakeId({
      userId: manager.id,
      intro: '5 年宠物照料经验，擅长犬猫日常照料。',
      experienceYears: 5,
      serviceRadiusKm: 8,
      serviceCity: '杭州',
      ratingAvg: 4.8,
      ratingCount: 126,
      auditStatus: 'APPROVED',
    }),
  });

  await prisma.caregiverService.createMany({
    data: withSnowflakeIds([
      {
        caregiverId: managerCaregiverProfile.id,
        serviceType: 'WALKING',
        petSpecies: 'DOG',
        pricePerUnit: 39.9,
        unitType: 'times',
        minNoticeHours: 2,
        availableSlots: {
          weekdays: ['09:00-11:00', '18:00-21:00'],
          weekends: ['10:00-20:00'],
        },
        serviceCity: '杭州',
        serviceLat: 30.2741,
        serviceLng: 120.1551,
        isActive: true,
      },
      {
        caregiverId: managerCaregiverProfile.id,
        serviceType: 'FEEDING',
        petSpecies: 'CAT',
        pricePerUnit: 29.9,
        unitType: 'times',
        minNoticeHours: 1,
        availableSlots: {
          weekdays: ['07:00-09:00', '19:00-22:00'],
        },
        serviceCity: '杭州',
        serviceLat: 30.2735,
        serviceLng: 120.152,
        isActive: true,
      },
    ]),
  });

  const memberPet = await prisma.petProfile.create({
    data: withSnowflakeId({
      ownerId: member.id,
      name: '豆包',
      species: 'DOG',
      breed: '柯基',
      gender: 'MALE',
      weightKg: 12.3,
      neutered: true,
      temperamentTags: ['friendly', 'active'],
      feedingNote: '早晚各一次，避免乳制品。',
      emergencyContact: {
        name: '张三',
        phone: '13800009999',
      },
    }),
  });

  const request = await prisma.serviceRequest.create({
    data: withSnowflakeId({
      ownerId: member.id,
      petId: memberPet.id,
      serviceType: 'WALKING',
      startTime: new Date('2026-04-01T09:00:00.000Z'),
      endTime: new Date('2026-04-01T10:00:00.000Z'),
      locationText: '杭州市上城区',
      locationLat: 30.255,
      locationLng: 120.182,
      budgetAmount: 80,
      demandTags: ['dog', 'morning'],
      status: 'MATCHED',
      matchedCaregiverId: managerCaregiverProfile.id,
    }),
  });

  const order = await prisma.orderMain.create({
    data: withSnowflakeId({
      orderNo: 'PP202603300001',
      ownerId: member.id,
      caregiverId: managerCaregiverProfile.id,
      serviceRequestId: request.id,
      serviceType: 'WALKING',
      appointmentStart: new Date('2026-04-01T09:00:00.000Z'),
      appointmentEnd: new Date('2026-04-01T10:00:00.000Z'),
      amountTotal: 80,
      amountAdjusted: 10,
      amountPaid: 90,
      amountRefunded: 20,
      orderStatus: 'PARTIAL_REFUNDED',
    }),
  });

  const firstPayment = await prisma.paymentRecord.create({
    data: withSnowflakeId({
      orderId: order.id,
      payNo: 'PAY202603300001',
      bizType: 'DEPOSIT',
      payChannel: 'WECHAT',
      payStatus: 'PAID',
      payAmount: 80,
      channelTxnId: 'WXTXN202603300001',
      paidAt: new Date('2026-03-30T10:01:00.000Z'),
      channelPayload: {
        tradeState: 'SUCCESS',
      },
    }),
  });

  await prisma.paymentRecord.create({
    data: withSnowflakeId({
      orderId: order.id,
      payNo: 'PAY202603300002',
      bizType: 'ADJUSTMENT',
      payChannel: 'WECHAT',
      payStatus: 'PAID',
      payAmount: 10,
      channelTxnId: 'WXTXN202603300002',
      paidAt: new Date('2026-03-30T10:02:00.000Z'),
      channelPayload: {
        tradeState: 'SUCCESS',
      },
    }),
  });

  await prisma.refundRecord.create({
    data: withSnowflakeId({
      orderId: order.id,
      paymentId: firstPayment.id,
      refundNo: 'REF202603300001',
      applyUserId: member.id,
      refundType: 'PARTIAL',
      refundReason: '服务提前结束，申请部分退款。',
      refundAmount: 20,
      refundStatus: 'SUCCESS',
      channelRefundId: 'WXREF202603300001',
      reviewedBy: admin.id,
      reviewedAt: new Date('2026-03-30T10:10:00.000Z'),
    }),
  });

  const passwordSecrets = await Promise.all([
    hashPassword('Admin123!'),
    hashPassword('Manager123!'),
    hashPassword('User123!'),
  ]);

  await prisma.userAuthentication.createMany({
    data: withSnowflakeIds([
      {
        userId: admin.id,
        strategyId: usernamePasswordStrategy.id,
        identifier: 'admin',
        credentialHash: passwordSecrets[0].hash,
        salt: passwordSecrets[0].salt,
        verifiedAt: new Date(),
      },
      {
        userId: manager.id,
        strategyId: usernamePasswordStrategy.id,
        identifier: 'manager',
        credentialHash: passwordSecrets[1].hash,
        salt: passwordSecrets[1].salt,
        verifiedAt: new Date(),
      },
      {
        userId: member.id,
        strategyId: usernamePasswordStrategy.id,
        identifier: 'user',
        credentialHash: passwordSecrets[2].hash,
        salt: passwordSecrets[2].salt,
        verifiedAt: new Date(),
      },
      {
        userId: admin.id,
        strategyId: emailCodeStrategy.id,
        identifier: 'admin@example.com',
        verifiedAt: new Date(),
      },
      {
        userId: manager.id,
        strategyId: emailCodeStrategy.id,
        identifier: 'manager@example.com',
        verifiedAt: new Date(),
      },
      {
        userId: member.id,
        strategyId: emailCodeStrategy.id,
        identifier: 'user@example.com',
        verifiedAt: new Date(),
      },
      {
        userId: admin.id,
        strategyId: phoneCodeStrategy.id,
        identifier: '13800000000',
        verifiedAt: new Date(),
      },
      {
        userId: manager.id,
        strategyId: phoneCodeStrategy.id,
        identifier: '13800000001',
        verifiedAt: new Date(),
      },
      {
        userId: member.id,
        strategyId: phoneCodeStrategy.id,
        identifier: '13800000002',
        verifiedAt: new Date(),
      },
    ]),
  });

  const dashboardPermission = await prisma.permission.findUnique({
    where: { code: 'dashboard.view' },
    select: { id: true },
  });

  if (!dashboardPermission) {
    throw new Error('dashboard.view permission not found');
  }

  await prisma.oAuthProvider.create({
    data: withSnowflakeId({
      code: 'demo-provider',
      name: 'Demo Provider',
      description: '本地 OAuth/OIDC 测试供应商',
      protocol: 'OIDC',
      issuer: 'http://localhost:3310',
      discoveryUrl: 'http://localhost:3310/.well-known/openid-configuration',
      authorizationEndpoint: 'http://localhost:3310/oauth2/authorize',
      tokenEndpoint: 'http://localhost:3310/oauth2/token',
      userinfoEndpoint: 'http://localhost:3310/oauth2/userinfo',
      clientId: 'demo-provider-client',
      clientSecretEncrypted: encryptOAuthSecret('demo-provider-secret'),
      defaultScopes: ['openid', 'profile', 'email', 'offline_access'],
      enabled: true,
      allowLogin: true,
      autoRegister: true,
      autoLinkByEmail: true,
      usePkce: true,
      clientAuthMethod: 'CLIENT_SECRET_BASIC',
      claimMapping: {
        subject: 'sub',
        email: 'email',
        username: 'preferred_username',
        nickname: 'name',
        avatarUrl: 'picture',
      } as unknown as Prisma.InputJsonValue,
    }),
  });

  const demoApplicationSecret = await hashSecret('demo-oauth-app-secret');
  await prisma.oAuthApplication.create({
    data: withSnowflakeId({
      code: 'demo-oauth-app',
      name: 'OAuth 测试应用',
      description: '用于验证本系统 OAuth/OIDC Provider 能力',
      homepageUrl: 'http://localhost:3320',
      clientId: 'demo-oauth-app-client',
      clientType: 'CONFIDENTIAL',
      clientSecretHash: demoApplicationSecret.hash,
      salt: demoApplicationSecret.salt,
      redirectUris: ['http://localhost:3320/callback'],
      postLogoutRedirectUris: ['http://localhost:3320/logout/callback'],
      defaultScopes: ['openid', 'profile', 'email', 'offline_access', 'dashboard.view'],
      enabled: true,
      skipConsent: false,
      requirePkce: true,
      allowAuthorizationCode: true,
      allowRefreshToken: true,
      permissions: {
        create: [
          withSnowflakeId({
            permission: {
              connect: {
                id: dashboardPermission.id,
              },
            },
          }),
        ],
      },
    }),
  });

  await prisma.chatMessage.createMany({
    data: withSnowflakeIds([
      { senderId: admin.id, content: '欢迎来到 RBAC 协同频道。' },
      { senderId: manager.id, content: '角色调整后，前端会实时收到权限更新提醒。' },
      { senderId: member.id, content: '移动端也可以复用共享的 API 封装。' },
    ]),
  });
}
