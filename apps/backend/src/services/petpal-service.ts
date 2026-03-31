import { prisma } from '../lib/prisma';
import { Prisma, PrismaClient } from '../lib/prisma-generated';
import type {
  PetProfile,
  ServiceRequest,
} from '../lib/prisma-generated';
import { badRequest, forbidden, notFound } from '../utils/errors';
import { withSnowflakeId } from '../utils/persistence';

const toNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  return Number(value);
};

const calcDistanceKm = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) => {
  const radius = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((radius * c).toFixed(3));
};

const SERIALIZABLE_TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

const isSerializationConflictError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: string }).code === 'P2034';
};

const runSerializableTransaction = async <T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 2,
) => {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(callback, SERIALIZABLE_TX_OPTIONS);
    } catch (error) {
      if (attempt < maxRetries && isSerializationConflictError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Serializable transaction retry exhausted');
};

const assertOrderAmountInvariant = (order: {
  amountTotal: Prisma.Decimal | number;
  amountAdjusted: Prisma.Decimal | number;
  amountPaid: Prisma.Decimal | number;
  amountRefunded: Prisma.Decimal | number;
}) => {
  const amountTotal = toNumber(order.amountTotal);
  const amountAdjusted = toNumber(order.amountAdjusted);
  const amountPaid = toNumber(order.amountPaid);
  const amountRefunded = toNumber(order.amountRefunded);
  if (amountPaid - amountRefunded < 0) {
    throw badRequest('Invalid order amount invariant: paid must be greater than refunded');
  }
  if (amountPaid < amountTotal + amountAdjusted - amountRefunded) {
    throw badRequest('Invalid order amount invariant: paid amount is not enough');
  }
};

type CallbackAuditQueryFilters = {
  callbackType?: 'PAYMENT_CALLBACK' | 'REFUND_CALLBACK';
  callbackStatus?: 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR';
  sourceMode?: string;
  startDate?: Date;
  endDate?: Date;
  requestId?: string;
  paymentId?: string;
  refundId?: string;
};

type CallbackAlertOutboxStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DEAD';

type CallbackAlertOutboxQueryFilters = {
  status?: CallbackAlertOutboxStatus;
  processingTimeoutMinutes?: number;
};

type CallbackFailureAlertPayload = {
  callbackAuditId: string;
  callbackStatus: string;
  callbackType: string;
  reason: string;
  requestId: string;
};

const buildCallbackAuditWhere = (filters: CallbackAuditQueryFilters): Prisma.CallbackAuditWhereInput => {
  const where: Prisma.CallbackAuditWhereInput = {};

  if (filters.callbackType) {
    where.callbackType = filters.callbackType;
  }
  if (filters.callbackStatus) {
    where.callbackStatus = filters.callbackStatus;
  }
  if (filters.sourceMode) {
    where.sourceMode = filters.sourceMode;
  }
  if (filters.requestId) {
    where.requestId = filters.requestId;
  }
  if (filters.paymentId) {
    where.paymentId = filters.paymentId;
  }
  if (filters.refundId) {
    where.refundId = filters.refundId;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Prisma.DateTimeFilter).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.createdAt as Prisma.DateTimeFilter).lte = filters.endDate;
    }
  }

  return where;
};

const enqueueCallbackFailureAlert = async (
  tx: Prisma.TransactionClient,
  payload: CallbackFailureAlertPayload,
) => tx.callbackAlertOutbox.create({
  data: withSnowflakeId({
    callbackAuditId: payload.callbackAuditId,
    payload: payload as unknown as Prisma.InputJsonValue,
    eventType: 'CALLBACK_FAILURE_ALERT',
    status: 'PENDING',
    retryCount: 0,
    maxRetries: 5,
    nextRetryAt: new Date(),
  }),
});

const buildCallbackAlertOutboxWhere = (
  filters: CallbackAlertOutboxQueryFilters,
): Prisma.CallbackAlertOutboxWhereInput => {
  const where: Prisma.CallbackAlertOutboxWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  return where;
};

const orderDetailInclude = {
  payments: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  refunds: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  timelines: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
  serviceLogs: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      happenedAt: 'asc',
    },
  },
  review: {
    select: {
      id: true,
      orderId: true,
      ownerId: true,
      caregiverId: true,
      rating: true,
      tags: true,
      content: true,
      isAnonymous: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OrderMainInclude;

type OrderDetailEntity = Prisma.OrderMainGetPayload<{
  include: typeof orderDetailInclude;
}>;

type OrderDetailRecord = Omit<OrderDetailEntity, 'timelines'> & {
  timeline: OrderDetailEntity['timelines'];
};

const toOrderDetailRecord = (order: OrderDetailEntity): OrderDetailRecord => {
  const { timelines, ...rest } = order;
  return {
    ...rest,
    timeline: timelines,
  };
};

const loadOrderDetailById = async (
  client: Prisma.TransactionClient | PrismaClient,
  orderId: string,
) => {
  const order = await client.orderMain.findUnique({
    where: {
      id: orderId,
    },
    include: orderDetailInclude,
  });

  if (!order) {
    throw notFound('Order not found');
  }

  assertOrderAmountInvariant(order);
  return toOrderDetailRecord(order);
};

const getApprovedCaregiverProfile = async (
  client: Prisma.TransactionClient | PrismaClient,
  userId: string,
) => {
  const profile = await client.caregiverProfile.findFirst({
    where: {
      userId,
      deleteAt: null,
    },
    select: {
      id: true,
      auditStatus: true,
    },
  });

  if (!profile) {
    throw notFound('Caregiver profile not found');
  }

  if (profile.auditStatus !== 'APPROVED') {
    throw forbidden('Caregiver profile is not approved');
  }

  return profile;
};

const appendOrderTimeline = async (
  client: Prisma.TransactionClient,
  payload: {
    orderId: string;
    eventType: 'CREATED' | 'ACCEPTED' | 'CHECKED_IN' | 'SERVICE_LOGGED' | 'CHECKED_OUT' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED' | 'REFUND_APPLIED' | 'REFUND_DONE';
    operatorRole: 'OWNER' | 'CAREGIVER' | 'ADMIN' | 'SYSTEM';
    operatorId?: string | null;
    eventPayload?: Prisma.InputJsonValue;
  },
) => client.orderTimeline.create({
  data: withSnowflakeId({
    orderId: payload.orderId,
    eventType: payload.eventType,
    operatorRole: payload.operatorRole,
    operatorId: payload.operatorId ?? null,
    eventPayload: payload.eventPayload ?? Prisma.JsonNull,
  }),
});

const appendServiceLog = async (
  client: Prisma.TransactionClient,
  payload: {
    orderId: string;
    caregiverId: string;
    logType: 'CHECK_IN' | 'FEED' | 'WALK' | 'PLAY' | 'HEALTH' | 'CHECK_OUT' | 'NOTE';
    textNote?: string | null;
    mediaUrls?: string[];
    geo?: Record<string, unknown> | null;
    happenedAt?: Date;
  },
) => client.serviceLog.create({
  data: withSnowflakeId({
    orderId: payload.orderId,
    caregiverId: payload.caregiverId,
    logType: payload.logType,
    textNote: payload.textNote?.trim() || null,
    mediaUrls: (payload.mediaUrls ?? []) as Prisma.InputJsonValue,
    geo: payload.geo ? payload.geo as Prisma.InputJsonValue : Prisma.JsonNull,
    happenedAt: payload.happenedAt ?? new Date(),
  }),
});

const appendComplaintProcessLog = async (
  client: Prisma.TransactionClient,
  payload: {
    complaintId: string;
    actionType: 'OPEN' | 'ASSIGN' | 'INVESTIGATE' | 'CALL_USER' | 'PENALTY' | 'CLOSE';
    operatorId?: string | null;
    note?: string | null;
  },
) => client.complaintProcessLog.create({
  data: withSnowflakeId({
    complaintId: payload.complaintId,
    actionType: payload.actionType,
    operatorId: payload.operatorId ?? null,
    note: payload.note?.trim() || null,
  }),
});

const normalizeReviewTags = (tags?: string[]) => [...new Set(
  (tags ?? [])
    .map((item) => item.trim())
    .filter(Boolean),
)].slice(0, 8);

const normalizeEvidenceUrls = (urls?: string[]) => [...new Set(
  (urls ?? [])
    .map((item) => item.trim())
    .filter(Boolean),
)].slice(0, 10);

const complaintInclude = {
  processLogs: {
    where: {
      deleteAt: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.ComplaintInclude;

const loadOrderComplaintsByOrderId = async (
  client: Prisma.TransactionClient | PrismaClient,
  orderId: string,
) => client.complaint.findMany({
  where: {
    orderId,
    deleteAt: null,
  },
  include: complaintInclude,
  orderBy: {
    createdAt: 'desc',
  },
});

const writeCallbackAlertReplayLog = async (input: {
  outboxIds: string[];
  actorId?: string | null;
  actionType: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
  note?: string;
}) => {
  const outboxIds = [...new Set(input.outboxIds.filter(Boolean))];
  if (!outboxIds.length) {
    return;
  }

  await prisma.callbackAlertReplayLog.createMany({
    data: outboxIds.map((outboxId) => withSnowflakeId({
      callbackOutboxId: outboxId,
      actionType: input.actionType,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
    })),
  });
};

export const petpalService = {
  async getOrCreateCaregiverProfile(userId: string) {
    const existing = await prisma.caregiverProfile.findUnique({
      where: {
        userId,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.caregiverProfile.create({
      data: withSnowflakeId({
        userId,
        auditStatus: 'PENDING',
      }),
    });
  },

  async upsertCaregiverProfile(userId: string, payload: {
    intro?: string;
    experienceYears?: number;
    serviceRadiusKm?: number;
    serviceCity?: string;
  }) {
    const current = await petpalService.getOrCreateCaregiverProfile(userId);

    return prisma.caregiverProfile.update({
      where: {
        id: current.id,
      },
      data: {
        intro: payload.intro?.trim() || null,
        experienceYears: payload.experienceYears ?? current.experienceYears,
        serviceRadiusKm: payload.serviceRadiusKm ?? current.serviceRadiusKm,
        serviceCity: payload.serviceCity?.trim() || null,
      },
    });
  },

  async listCaregiverServices(userId: string) {
    const profile = await petpalService.getOrCreateCaregiverProfile(userId);

    return prisma.caregiverService.findMany({
      where: {
        caregiverId: profile.id,
        deleteAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async createCaregiverService(userId: string, payload: {
    serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
    petSpecies: 'DOG' | 'CAT' | 'OTHER';
    pricePerUnit: number;
    unitType: string;
    minNoticeHours?: number;
    availableSlots?: unknown;
    serviceCity?: string;
    serviceLat?: number;
    serviceLng?: number;
    isActive?: boolean;
  }) {
    const profile = await petpalService.getOrCreateCaregiverProfile(userId);

    return prisma.caregiverService.create({
      data: withSnowflakeId({
        caregiverId: profile.id,
        serviceType: payload.serviceType,
        petSpecies: payload.petSpecies,
        pricePerUnit: payload.pricePerUnit,
        unitType: payload.unitType.trim(),
        minNoticeHours: payload.minNoticeHours ?? 2,
        availableSlots: (payload.availableSlots ?? []) as Prisma.InputJsonValue,
        serviceCity: payload.serviceCity?.trim() || null,
        serviceLat: payload.serviceLat,
        serviceLng: payload.serviceLng,
        isActive: payload.isActive ?? true,
      }),
    });
  },

  async updateCaregiverService(userId: string, serviceId: string, payload: {
    serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
    petSpecies: 'DOG' | 'CAT' | 'OTHER';
    pricePerUnit: number;
    unitType: string;
    minNoticeHours?: number;
    availableSlots?: unknown;
    serviceCity?: string;
    serviceLat?: number;
    serviceLng?: number;
    isActive?: boolean;
  }) {
    const profile = await petpalService.getOrCreateCaregiverProfile(userId);

    const existing = await prisma.caregiverService.findFirst({
      where: {
        id: serviceId,
        caregiverId: profile.id,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw notFound('Caregiver service not found');
    }

    return prisma.caregiverService.update({
      where: {
        id: serviceId,
      },
      data: {
        serviceType: payload.serviceType,
        petSpecies: payload.petSpecies,
        pricePerUnit: payload.pricePerUnit,
        unitType: payload.unitType.trim(),
        minNoticeHours: payload.minNoticeHours ?? 2,
        availableSlots: (payload.availableSlots ?? []) as Prisma.InputJsonValue,
        serviceCity: payload.serviceCity?.trim() || null,
        serviceLat: payload.serviceLat,
        serviceLng: payload.serviceLng,
        isActive: payload.isActive ?? true,
      },
    });
  },

  async auditCaregiverProfile(caregiverId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const existing = await prisma.caregiverProfile.findFirst({
      where: {
        id: caregiverId,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw notFound('Caregiver profile not found');
    }

    return prisma.caregiverProfile.update({
      where: {
        id: caregiverId,
      },
      data: {
        auditStatus: status,
      },
    });
  },

  async queryCaregiverAuditList(payload: {
    page: number;
    pageSize: number;
    auditStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    city?: string;
    keyword?: string;
  }) {
    const where: Prisma.CaregiverProfileWhereInput = {
      deleteAt: null,
      auditStatus: payload.auditStatus,
      serviceCity: payload.city?.trim() || undefined,
      OR: payload.keyword?.trim()
        ? [
          {
            user: {
              nickname: {
                contains: payload.keyword.trim(),
              },
            },
          },
          {
            intro: {
              contains: payload.keyword.trim(),
            },
          },
        ]
        : undefined,
    };

    const [total, rows] = await Promise.all([
      prisma.caregiverProfile.count({ where }),
      prisma.caregiverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
            },
          },
          services: {
            where: {
              deleteAt: null,
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (payload.page - 1) * payload.pageSize,
        take: payload.pageSize,
      }),
    ]);

    return {
      items: rows.map(item => ({
        id: item.id,
        userId: item.userId,
        nickname: item.user.nickname,
        intro: item.intro,
        experienceYears: item.experienceYears,
        serviceRadiusKm: item.serviceRadiusKm,
        serviceCity: item.serviceCity,
        auditStatus: item.auditStatus,
        serviceCount: item.services.length,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      pagination: {
        page: payload.page,
        pageSize: payload.pageSize,
        total,
        totalPages: Math.ceil(total / payload.pageSize),
      },
    };
  },

  async listCaregiverOrders(payload: {
    userId: string;
    page: number;
    pageSize: number;
    status?: 'PENDING_ACCEPT' | 'ACCEPTED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'PARTIAL_REFUNDED' | 'REFUNDED';
  }) {
    const caregiverProfile = await getApprovedCaregiverProfile(prisma, payload.userId);
    const where: Prisma.OrderMainWhereInput = {
      deleteAt: null,
      caregiverId: caregiverProfile.id,
      orderStatus: payload.status,
    };

    const [total, rows] = await Promise.all([
      prisma.orderMain.count({ where }),
      prisma.orderMain.findMany({
        where,
        include: {
          owner: {
            select: {
              nickname: true,
            },
          },
          serviceRequest: {
            select: {
              locationText: true,
              pet: {
                select: {
                  name: true,
                },
              },
            },
          },
          payments: {
            where: {
              deleteAt: null,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
          refunds: {
            where: {
              deleteAt: null,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: [
          {
            appointmentStart: 'asc',
          },
          {
            createdAt: 'desc',
          },
        ],
        skip: (payload.page - 1) * payload.pageSize,
        take: payload.pageSize,
      }),
    ]);

    rows.forEach((order) => {
      assertOrderAmountInvariant(order);
    });

    return {
      items: rows.map((order) => ({
        ...order,
        ownerNickname: order.owner.nickname,
        petName: order.serviceRequest?.pet?.name ?? null,
        locationText: order.serviceRequest?.locationText ?? null,
      })),
      pagination: {
        page: payload.page,
        pageSize: payload.pageSize,
        total,
        totalPages: Math.ceil(total / payload.pageSize),
      },
    };
  },

  async listPets(ownerId: string) {
    return prisma.petProfile.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  },

  async createPet(ownerId: string, payload: {
    name: string;
    species: 'DOG' | 'CAT' | 'OTHER';
    breed?: string;
    gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
    weightKg?: number;
    neutered?: boolean;
  }): Promise<PetProfile> {
    return prisma.petProfile.create({
      data: withSnowflakeId({
        ownerId,
        name: payload.name,
        species: payload.species,
        breed: payload.breed ?? null,
        gender: payload.gender ?? 'UNKNOWN',
        weightKg: payload.weightKg,
        neutered: payload.neutered ?? false,
      }),
    });
  },

  async listOwnerRequests(ownerId: string) {
    return prisma.serviceRequest.findMany({
      where: {
        ownerId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        pet: {
          select: {
            id: true,
            name: true,
            species: true,
          },
        },
        matchedCaregiver: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });
  },

  async createRequest(ownerId: string, payload: {
    petId: string;
    serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
    startTime: Date;
    endTime: Date;
    locationText: string;
    locationLat?: number;
    locationLng?: number;
    budgetAmount?: number;
    demandTags?: unknown;
  }): Promise<ServiceRequest> {
    const pet = await prisma.petProfile.findFirst({
      where: {
        id: payload.petId,
        ownerId,
      },
      select: { id: true },
    });

    if (!pet) {
      throw notFound('Pet profile not found');
    }

    return prisma.serviceRequest.create({
      data: withSnowflakeId({
        ownerId,
        petId: payload.petId,
        serviceType: payload.serviceType,
        startTime: payload.startTime,
        endTime: payload.endTime,
        locationText: payload.locationText,
        locationLat: payload.locationLat,
        locationLng: payload.locationLng,
        budgetAmount: payload.budgetAmount,
        demandTags: (payload.demandTags ?? []) as Prisma.InputJsonValue,
        status: 'OPEN',
      }),
    });
  },

  async listOwnerOrders(ownerId: string) {
    const orders = await prisma.orderMain.findMany({
      where: {
        ownerId,
      },
      include: {
        payments: {
          where: {
            deleteAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        refunds: {
          where: {
            deleteAt: null,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    orders.forEach((order) => {
      assertOrderAmountInvariant(order);
    });

    return orders;
  },

  async getOwnerOrderDetail(ownerId: string, orderId: string): Promise<OrderDetailRecord> {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        deleteAt: null,
        OR: [
          {
            ownerId,
          },
          {
            caregiver: {
              userId: ownerId,
              deleteAt: null,
            },
          },
        ],
      },
      include: orderDetailInclude,
    });

    if (!order) {
      throw notFound('Order not found');
    }

    assertOrderAmountInvariant(order);
    return toOrderDetailRecord(order);
  },

  async acceptCaregiverOrder(userId: string, orderId: string) {
    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'PENDING_ACCEPT') {
        throw badRequest('Only pending orders can be accepted');
      }

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: 'ACCEPTED',
        },
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'ACCEPTED',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'ACCEPTED',
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async checkInCaregiverOrder(userId: string, orderId: string, payload?: {
    note?: string;
    geo?: Record<string, unknown>;
  }) {
    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'ACCEPTED') {
        throw badRequest('Only accepted orders can be checked in');
      }

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: 'SERVING',
        },
      });

      const happenedAt = new Date();
      await appendServiceLog(tx, {
        orderId: order.id,
        caregiverId: order.caregiverId,
        logType: 'CHECK_IN',
        textNote: payload?.note,
        geo: payload?.geo ?? null,
        happenedAt,
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'CHECKED_IN',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'SERVING',
          note: payload?.note ?? null,
          geo: payload?.geo ?? null,
          happenedAt: happenedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async addCaregiverServiceLog(userId: string, orderId: string, payload: {
    logType: 'CHECK_IN' | 'FEED' | 'WALK' | 'PLAY' | 'HEALTH' | 'CHECK_OUT' | 'NOTE';
    textNote?: string;
    mediaUrls?: string[];
    geo?: Record<string, unknown>;
    happenedAt?: Date;
  }) {
    if (!payload.textNote?.trim() && !(payload.mediaUrls?.length)) {
      throw badRequest('Service log requires text note or media');
    }

    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'SERVING') {
        throw badRequest('Only serving orders can add service logs');
      }

      const happenedAt = payload.happenedAt ?? new Date();
      await appendServiceLog(tx, {
        orderId: order.id,
        caregiverId: order.caregiverId,
        logType: payload.logType,
        textNote: payload.textNote,
        mediaUrls: payload.mediaUrls,
        geo: payload.geo ?? null,
        happenedAt,
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'SERVICE_LOGGED',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          logType: payload.logType,
          note: payload.textNote?.trim() || null,
          mediaCount: payload.mediaUrls?.length ?? 0,
          geo: payload.geo ?? null,
          happenedAt: happenedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async checkOutCaregiverOrder(userId: string, orderId: string, payload?: {
    note?: string;
    geo?: Record<string, unknown>;
  }) {
    return runSerializableTransaction(async (tx) => {
      const caregiverProfile = await getApprovedCaregiverProfile(tx, userId);
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          deleteAt: null,
          caregiverId: caregiverProfile.id,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'SERVING') {
        throw badRequest('Only serving orders can be checked out');
      }

      const happenedAt = new Date();
      await appendServiceLog(tx, {
        orderId: order.id,
        caregiverId: order.caregiverId,
        logType: 'CHECK_OUT',
        textNote: payload?.note,
        geo: payload?.geo ?? null,
        happenedAt,
      });

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'CHECKED_OUT',
        operatorRole: 'CAREGIVER',
        operatorId: userId,
        eventPayload: {
          note: payload?.note ?? null,
          geo: payload?.geo ?? null,
          happenedAt: happenedAt.toISOString(),
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async confirmOwnerOrderComplete(ownerId: string, orderId: string) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          serviceRequestId: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'SERVING') {
        throw badRequest('Only serving orders can be completed by owner');
      }

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          orderStatus: 'COMPLETED',
          closedAt: new Date(),
        },
      });

      if (order.serviceRequestId) {
        await tx.serviceRequest.update({
          where: {
            id: order.serviceRequestId,
          },
          data: {
            status: 'CLOSED',
          },
        });
      }

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'COMPLETED',
        operatorRole: 'OWNER',
        operatorId: ownerId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'COMPLETED',
        } as Prisma.InputJsonValue,
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async createOwnerOrderReview(ownerId: string, orderId: string, payload: {
    rating: number;
    tags?: string[];
    content?: string;
    isAnonymous?: boolean;
  }) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          caregiverId: true,
          orderStatus: true,
          review: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (order.orderStatus !== 'COMPLETED') {
        throw badRequest('Only completed orders can be reviewed');
      }

      if (order.review) {
        throw badRequest('Order review already exists');
      }

      const caregiverProfile = await tx.caregiverProfile.findFirst({
        where: {
          id: order.caregiverId,
          deleteAt: null,
        },
        select: {
          id: true,
          ratingAvg: true,
          ratingCount: true,
        },
      });

      if (!caregiverProfile) {
        throw notFound('Caregiver profile not found');
      }

      const tags = normalizeReviewTags(payload.tags);
      await tx.review.create({
        data: withSnowflakeId({
          orderId: order.id,
          ownerId,
          caregiverId: caregiverProfile.id,
          rating: payload.rating,
          tags: tags as Prisma.InputJsonValue,
          content: payload.content?.trim() || null,
          isAnonymous: payload.isAnonymous ?? false,
        }),
      });

      const currentRatingAvg = toNumber(caregiverProfile.ratingAvg);
      const nextRatingCount = caregiverProfile.ratingCount + 1;
      const nextRatingAvg = ((currentRatingAvg * caregiverProfile.ratingCount) + payload.rating) / nextRatingCount;

      await tx.caregiverProfile.update({
        where: {
          id: caregiverProfile.id,
        },
        data: {
          ratingAvg: new Prisma.Decimal(nextRatingAvg.toFixed(2)),
          ratingCount: nextRatingCount,
        },
      });

      return loadOrderDetailById(tx, order.id);
    });
  },

  async listOwnerOrderComplaints(ownerId: string, orderId: string) {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        ownerId,
        deleteAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!order) {
      throw notFound('Order not found');
    }

    return loadOrderComplaintsByOrderId(prisma, order.id);
  },

  async createOwnerOrderComplaint(ownerId: string, orderId: string, payload: {
    targetRole: 'CAREGIVER' | 'PLATFORM';
    complaintType: 'SAFETY' | 'FEE' | 'SERVICE' | 'FRAUD' | 'OTHER';
    description: string;
    evidenceUrls?: string[];
  }) {
    return runSerializableTransaction(async (tx) => {
      const order = await tx.orderMain.findFirst({
        where: {
          id: orderId,
          ownerId,
          deleteAt: null,
        },
        select: {
          id: true,
          orderStatus: true,
        },
      });

      if (!order) {
        throw notFound('Order not found');
      }

      if (!['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(order.orderStatus)) {
        throw badRequest('Only serving or settled orders can create complaints');
      }

      const activeComplaint = await tx.complaint.findFirst({
        where: {
          orderId: order.id,
          deleteAt: null,
          status: {
            in: ['OPEN', 'PROCESSING'],
          },
        },
        select: {
          id: true,
        },
      });

      if (activeComplaint) {
        throw badRequest('Active complaint already exists for order');
      }

      const complaint = await tx.complaint.create({
        data: withSnowflakeId({
          orderId: order.id,
          complainantId: ownerId,
          targetRole: payload.targetRole,
          complaintType: payload.complaintType,
          description: payload.description.trim(),
          evidenceUrls: normalizeEvidenceUrls(payload.evidenceUrls) as Prisma.InputJsonValue,
          status: 'OPEN',
        }),
      });

      await appendComplaintProcessLog(tx, {
        complaintId: complaint.id,
        actionType: 'OPEN',
        operatorId: ownerId,
        note: '投诉已提交，等待平台处理',
      });

      if (order.orderStatus !== 'DISPUTED') {
        await tx.orderMain.update({
          where: {
            id: order.id,
          },
          data: {
            orderStatus: 'DISPUTED',
          },
        });
      }

      await appendOrderTimeline(tx, {
        orderId: order.id,
        eventType: 'DISPUTED',
        operatorRole: 'OWNER',
        operatorId: ownerId,
        eventPayload: {
          previousStatus: order.orderStatus,
          nextStatus: 'DISPUTED',
          complaintId: complaint.id,
          complaintType: payload.complaintType,
          targetRole: payload.targetRole,
        } as Prisma.InputJsonValue,
      });

      const created = await tx.complaint.findUnique({
        where: {
          id: complaint.id,
        },
        include: complaintInclude,
      });

      if (!created) {
        throw notFound('Complaint not found');
      }

      return created;
    });
  },

  async listMatchedCaregivers(payload: {
    serviceType: 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT';
    petSpecies: 'DOG' | 'CAT' | 'OTHER';
    city?: string;
    lat?: number;
    lng?: number;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.CaregiverServiceWhereInput = {
      isActive: true,
      serviceType: payload.serviceType,
      petSpecies: payload.petSpecies,
      caregiver: {
        auditStatus: 'APPROVED',
        deleteAt: null,
      },
    };

    if (payload.city) {
      where.serviceCity = payload.city;
    }

    const services = await prisma.caregiverService.findMany({
      where,
      include: {
        caregiver: {
          select: {
            id: true,
            ratingAvg: true,
            ratingCount: true,
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    const rows = services.map((service) => {
      const serviceLat = service.serviceLat == null ? null : Number(service.serviceLat);
      const serviceLng = service.serviceLng == null ? null : Number(service.serviceLng);
      const distanceKm = payload.lat != null
        && payload.lng != null
        && serviceLat != null
        && serviceLng != null
        ? calcDistanceKm(payload.lat, payload.lng, serviceLat, serviceLng)
        : null;

      return {
        serviceId: service.id,
        caregiverId: service.caregiver.id,
        caregiverName: service.caregiver.user.nickname,
        serviceType: service.serviceType,
        petSpecies: service.petSpecies,
        pricePerUnit: service.pricePerUnit,
        unitType: service.unitType,
        city: service.serviceCity,
        distanceKm,
        ratingAvg: service.caregiver.ratingAvg,
        ratingCount: service.caregiver.ratingCount,
      };
    });

    rows.sort((left, right) => {
      const lDistance = left.distanceKm ?? Number.POSITIVE_INFINITY;
      const rDistance = right.distanceKm ?? Number.POSITIVE_INFINITY;
      if (lDistance !== rDistance) {
        return lDistance - rDistance;
      }
      return Number(right.ratingAvg) - Number(left.ratingAvg);
    });

    const total = rows.length;
    const skip = (payload.page - 1) * payload.pageSize;
    const items = rows.slice(skip, skip + payload.pageSize);

    return {
      items,
      meta: {
        page: payload.page,
        pageSize: payload.pageSize,
        total,
      },
    };
  },

  async handlePaymentCallback(payload: {
    payNo: string;
    channelTxnId: string;
    success: boolean;
    paidAmount?: number;
    channelPayload?: unknown;
    // Audit info (optional)
    auditInfo?: {
      requestId: string;
      sourceMode: string;
      signatureDigest: string | null;
      callbackTimestamp: string | null;
      rawPayload?: string;
    };
  }) {
    return runSerializableTransaction(async (tx) => {
      const payment = await tx.paymentRecord.findUnique({
        where: {
          payNo: payload.payNo,
        },
        select: {
          id: true,
          orderId: true,
          payStatus: true,
          channelTxnId: true,
          payAmount: true,
        },
      });

      if (!payment) {
        throw notFound('Payment not found');
      }

      if (payment.payStatus === 'PAID') {
        const idempotent = payment.channelTxnId === payload.channelTxnId;
        
        // Create audit record for retry/idempotent callback if auditInfo is provided
        if (payload.auditInfo) {
          const callbackAudit = await tx.callbackAudit.create({
            data: withSnowflakeId({
              callbackType: 'PAYMENT_CALLBACK',
              paymentId: payment.id,
              requestId: payload.auditInfo.requestId,
              sourceMode: payload.auditInfo.sourceMode,
              signatureDigest: payload.auditInfo.signatureDigest,
              callbackTimestamp: payload.auditInfo.callbackTimestamp,
              callbackStatus: idempotent ? 'SUCCESS' : 'FAILURE',
              rawPayload: payload.auditInfo.rawPayload,
              verificationResult: JSON.stringify({
                idempotent,
                alreadyProcessed: true,
                channelTxnId: payload.channelTxnId,
              }),
              processedAt: new Date(),
            }),
          });

          if (!idempotent) {
            await enqueueCallbackFailureAlert(tx, {
              callbackAuditId: callbackAudit.id,
              callbackStatus: 'FAILURE',
              callbackType: 'PAYMENT_CALLBACK',
              requestId: payload.auditInfo.requestId,
              reason: 'Duplicate payment callback with mismatched channel transaction id',
            });
          }
        }
        
        return {
          idempotent,
          paymentId: payment.id,
          orderId: payment.orderId,
          payStatus: payment.payStatus,
        };
      }

      const nextStatus = payload.success ? 'PAID' : 'FAILED';
      const nextPaidAmount = payload.success && payload.paidAmount != null
        ? payload.paidAmount
        : toNumber(payment.payAmount);

      await tx.paymentRecord.update({
        where: {
          id: payment.id,
        },
        data: {
          payStatus: nextStatus,
          payAmount: nextPaidAmount,
          channelTxnId: payload.channelTxnId,
          paidAt: payload.success ? new Date() : null,
          channelPayload: (payload.channelPayload ?? null) as Prisma.InputJsonValue,
        },
      });

      // Create audit record if auditInfo is provided
      if (payload.auditInfo) {
        const callbackAudit = await tx.callbackAudit.create({
          data: withSnowflakeId({
            callbackType: 'PAYMENT_CALLBACK',
            paymentId: payment.id,
            requestId: payload.auditInfo.requestId,
            sourceMode: payload.auditInfo.sourceMode,
            signatureDigest: payload.auditInfo.signatureDigest,
            callbackTimestamp: payload.auditInfo.callbackTimestamp,
            callbackStatus: nextStatus === 'PAID' ? 'SUCCESS' : 'FAILURE',
            rawPayload: payload.auditInfo.rawPayload,
            verificationResult: JSON.stringify({
              success: payload.success,
              channelTxnId: payload.channelTxnId,
            }),
            processedAt: new Date(),
          }),
        });

        if (nextStatus === 'FAILED') {
          await enqueueCallbackFailureAlert(tx, {
            callbackAuditId: callbackAudit.id,
            callbackStatus: 'FAILURE',
            callbackType: 'PAYMENT_CALLBACK',
            requestId: payload.auditInfo.requestId,
            reason: 'Payment callback marked as FAILED',
          });
        }
      }

      const [paidRows, refundedRows, order] = await Promise.all([
        tx.paymentRecord.findMany({
          where: {
            orderId: payment.orderId,
            payStatus: 'PAID',
            deleteAt: null,
          },
          select: {
            payAmount: true,
          },
        }),
        tx.refundRecord.findMany({
          where: {
            orderId: payment.orderId,
            refundStatus: 'SUCCESS',
            deleteAt: null,
          },
          select: {
            refundAmount: true,
          },
        }),
        tx.orderMain.findUnique({
          where: {
            id: payment.orderId,
          },
          select: {
            id: true,
            amountTotal: true,
            amountAdjusted: true,
            amountRefunded: true,
            orderStatus: true,
          },
        }),
      ]);

      if (!order) {
        throw notFound('Order not found');
      }

      const amountPaid = paidRows.reduce((sum, row) => sum + toNumber(row.payAmount), 0);
      const amountRefunded = refundedRows.reduce((sum, row) => sum + toNumber(row.refundAmount), 0);
      const required = toNumber(order.amountTotal) + toNumber(order.amountAdjusted) - amountRefunded;

      const nextOrderStatus = amountRefunded > 0
        ? (amountRefunded >= toNumber(order.amountTotal) + toNumber(order.amountAdjusted)
          ? 'REFUNDED'
          : 'PARTIAL_REFUNDED')
        : (amountPaid >= required ? 'ACCEPTED' : order.orderStatus);

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          amountPaid,
          amountRefunded,
          orderStatus: nextOrderStatus,
        },
      });

      return {
        idempotent: false,
        paymentId: payment.id,
        orderId: payment.orderId,
        payStatus: nextStatus,
        orderStatus: nextOrderStatus,
      };
    });
  },

  async handleRefundCallback(payload: {
    refundNo: string;
    channelRefundId: string;
    success: boolean;
    channelPayload?: unknown;
    // Audit info (optional)
    auditInfo?: {
      requestId: string;
      sourceMode: string;
      signatureDigest: string | null;
      callbackTimestamp: string | null;
      rawPayload?: string;
    };
  }) {
    return runSerializableTransaction(async (tx) => {
      const refund = await tx.refundRecord.findUnique({
        where: {
          refundNo: payload.refundNo,
        },
        select: {
          id: true,
          orderId: true,
          refundStatus: true,
          channelRefundId: true,
        },
      });

      if (!refund) {
        throw notFound('Refund not found');
      }

      if (refund.refundStatus === 'SUCCESS') {
        const idempotent = refund.channelRefundId === payload.channelRefundId;
        
        // Create audit record for retry/idempotent callback if auditInfo is provided
        if (payload.auditInfo) {
          const callbackAudit = await tx.callbackAudit.create({
            data: withSnowflakeId({
              callbackType: 'REFUND_CALLBACK',
              refundId: refund.id,
              requestId: payload.auditInfo.requestId,
              sourceMode: payload.auditInfo.sourceMode,
              signatureDigest: payload.auditInfo.signatureDigest,
              callbackTimestamp: payload.auditInfo.callbackTimestamp,
              callbackStatus: idempotent ? 'SUCCESS' : 'FAILURE',
              rawPayload: payload.auditInfo.rawPayload,
              verificationResult: JSON.stringify({
                idempotent,
                alreadyProcessed: true,
                channelRefundId: payload.channelRefundId,
              }),
              processedAt: new Date(),
            }),
          });

          if (!idempotent) {
            await enqueueCallbackFailureAlert(tx, {
              callbackAuditId: callbackAudit.id,
              callbackStatus: 'FAILURE',
              callbackType: 'REFUND_CALLBACK',
              requestId: payload.auditInfo.requestId,
              reason: 'Duplicate refund callback with mismatched channel refund id',
            });
          }
        }
        
        return {
          idempotent,
          refundId: refund.id,
          orderId: refund.orderId,
          refundStatus: refund.refundStatus,
        };
      }

      const nextStatus = payload.success ? 'SUCCESS' : 'FAILED';
      await tx.refundRecord.update({
        where: {
          id: refund.id,
        },
        data: {
          refundStatus: nextStatus,
          channelRefundId: payload.channelRefundId,
          reviewedAt: payload.success ? new Date() : null,
        },
      });

      // Create audit record if auditInfo is provided
      if (payload.auditInfo) {
        const callbackAudit = await tx.callbackAudit.create({
          data: withSnowflakeId({
            callbackType: 'REFUND_CALLBACK',
            refundId: refund.id,
            requestId: payload.auditInfo.requestId,
            sourceMode: payload.auditInfo.sourceMode,
            signatureDigest: payload.auditInfo.signatureDigest,
            callbackTimestamp: payload.auditInfo.callbackTimestamp,
            callbackStatus: nextStatus === 'SUCCESS' ? 'SUCCESS' : 'FAILURE',
            rawPayload: payload.auditInfo.rawPayload,
            verificationResult: JSON.stringify({
              success: payload.success,
              channelRefundId: payload.channelRefundId,
            }),
            processedAt: new Date(),
          }),
        });

        if (nextStatus === 'FAILED') {
          await enqueueCallbackFailureAlert(tx, {
            callbackAuditId: callbackAudit.id,
            callbackStatus: 'FAILURE',
            callbackType: 'REFUND_CALLBACK',
            requestId: payload.auditInfo.requestId,
            reason: 'Refund callback marked as FAILED',
          });
        }
      }

      const [paidRows, refundedRows, order] = await Promise.all([
        tx.paymentRecord.findMany({
          where: {
            orderId: refund.orderId,
            payStatus: 'PAID',
            deleteAt: null,
          },
          select: {
            payAmount: true,
          },
        }),
        tx.refundRecord.findMany({
          where: {
            orderId: refund.orderId,
            refundStatus: 'SUCCESS',
            deleteAt: null,
          },
          select: {
            refundAmount: true,
          },
        }),
        tx.orderMain.findUnique({
          where: {
            id: refund.orderId,
          },
          select: {
            id: true,
            amountTotal: true,
            amountAdjusted: true,
            orderStatus: true,
          },
        }),
      ]);

      if (!order) {
        throw notFound('Order not found');
      }

      const amountPaid = paidRows.reduce((sum, row) => sum + toNumber(row.payAmount), 0);
      const amountRefunded = refundedRows.reduce((sum, row) => sum + toNumber(row.refundAmount), 0);
      const gross = toNumber(order.amountTotal) + toNumber(order.amountAdjusted);

      const nextOrderStatus = amountRefunded > 0
        ? (amountRefunded >= gross ? 'REFUNDED' : 'PARTIAL_REFUNDED')
        : order.orderStatus;

      await tx.orderMain.update({
        where: {
          id: order.id,
        },
        data: {
          amountPaid,
          amountRefunded,
          orderStatus: nextOrderStatus,
        },
      });

      return {
        idempotent: false,
        refundId: refund.id,
        orderId: refund.orderId,
        refundStatus: nextStatus,
        orderStatus: nextOrderStatus,
      };
    });
  },

  async queryCallbackAuditLogs(filters: {
    page?: number;
    pageSize?: number;
    callbackType?: 'PAYMENT_CALLBACK' | 'REFUND_CALLBACK';
    callbackStatus?: 'PENDING' | 'SUCCESS' | 'FAILURE' | 'ERROR';
    sourceMode?: string;
    startDate?: Date;
    endDate?: Date;
    requestId?: string;
    paymentId?: string;
    refundId?: string;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const where = buildCallbackAuditWhere(filters);

    // Query with pagination
    const [total, records] = await Promise.all([
      prisma.callbackAudit.count({ where }),
      prisma.callbackAudit.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
        include: {
          payment: {
            select: {
              payNo: true,
              orderId: true,
              payAmount: true,
              payStatus: true,
            },
          },
          refund: {
            select: {
              refundNo: true,
              orderId: true,
              refundAmount: true,
              refundStatus: true,
            },
          },
        },
      }),
    ]);

    return {
      items: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async queryCallbackAuditStats(filters: CallbackAuditQueryFilters) {
    const where = buildCallbackAuditWhere(filters);

    const [
      total,
      byStatusRows,
      byTypeRows,
      bySourceModeRows,
    ] = await Promise.all([
      prisma.callbackAudit.count({ where }),
      prisma.callbackAudit.groupBy({
        by: ['callbackStatus'],
        where,
        _count: { _all: true },
      }),
      prisma.callbackAudit.groupBy({
        by: ['callbackType'],
        where,
        _count: { _all: true },
      }),
      prisma.callbackAudit.groupBy({
        by: ['sourceMode'],
        where,
        _count: { _all: true },
      }),
    ]);

    const byStatus = {
      PENDING: 0,
      SUCCESS: 0,
      FAILURE: 0,
      ERROR: 0,
    };
    const byType = {
      PAYMENT_CALLBACK: 0,
      REFUND_CALLBACK: 0,
    };
    const bySourceMode = {
      TOKEN: 0,
      WECHATPAY_HMAC: 0,
      WECHATPAY_SDK: 0,
    };

    byStatusRows.forEach((item) => {
      byStatus[item.callbackStatus] = item._count._all;
    });
    byTypeRows.forEach((item) => {
      byType[item.callbackType] = item._count._all;
    });
    bySourceModeRows.forEach((item) => {
      bySourceMode[item.sourceMode as keyof typeof bySourceMode] = item._count._all;
    });

    return {
      total,
      successRate: total > 0 ? Number(((byStatus.SUCCESS / total) * 100).toFixed(2)) : 0,
      byStatus,
      byType,
      bySourceMode,
    };
  },

  async listCallbackAuditExportRows(filters: CallbackAuditQueryFilters) {
    const where = buildCallbackAuditWhere(filters);

    return prisma.callbackAudit.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payment: {
          select: {
            payNo: true,
            orderId: true,
            payAmount: true,
            payStatus: true,
          },
        },
        refund: {
          select: {
            refundNo: true,
            orderId: true,
            refundAmount: true,
            refundStatus: true,
          },
        },
      },
      take: 5000,
    });
  },

  async queryCallbackAlertOutboxes(filters: {
    page?: number;
    pageSize?: number;
    status?: CallbackAlertOutboxStatus;
  }) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const where = buildCallbackAlertOutboxWhere(filters);

    const [total, records] = await Promise.all([
      prisma.callbackAlertOutbox.count({ where }),
      prisma.callbackAlertOutbox.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
        include: {
          callbackAudit: {
            select: {
              callbackType: true,
              callbackStatus: true,
              requestId: true,
              sourceMode: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      items: records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  },

  async queryCallbackAlertOutboxStats(filters: CallbackAlertOutboxQueryFilters) {
    const where = buildCallbackAlertOutboxWhere(filters);
    const processingTimeoutMinutes = Math.min(240, Math.max(1, filters.processingTimeoutMinutes ?? 10));
    const processingTimeoutAt = new Date(Date.now() - processingTimeoutMinutes * 60_000);
    const [total, statusRows, oldestPending, oldestDead, stuckProcessingCount] = await Promise.all([
      prisma.callbackAlertOutbox.count({ where }),
      prisma.callbackAlertOutbox.groupBy({
        by: ['status'],
        where,
        _count: {
          _all: true,
        },
      }),
      prisma.callbackAlertOutbox.findFirst({
        where: {
          ...where,
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.callbackAlertOutbox.findFirst({
        where: {
          ...where,
          status: 'DEAD',
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          createdAt: true,
        },
      }),
      prisma.callbackAlertOutbox.count({
        where: {
          ...where,
          status: 'PROCESSING',
          createdAt: {
            lte: processingTimeoutAt,
          },
        },
      }),
    ]);

    const byStatus: Record<CallbackAlertOutboxStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      SENT: 0,
      FAILED: 0,
      DEAD: 0,
    };

    statusRows.forEach((row) => {
      byStatus[row.status as CallbackAlertOutboxStatus] = row._count._all;
    });

    const now = Date.now();
    const oldestPendingAgeMinutes = oldestPending
      ? Math.floor((now - oldestPending.createdAt.getTime()) / 60000)
      : 0;
    const oldestDeadAgeMinutes = oldestDead
      ? Math.floor((now - oldestDead.createdAt.getTime()) / 60000)
      : 0;

    return {
      total,
      byStatus,
      oldestPendingAgeMinutes,
      oldestDeadAgeMinutes,
      stuckProcessingCount,
      processingTimeoutMinutes,
    };
  },

  async retryCallbackAlertOutbox(id: string, options?: { actorId?: string | null }) {
    const existing = await prisma.callbackAlertOutbox.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        retryCount: true,
        maxRetries: true,
      },
    });

    if (!existing) {
      throw notFound('Callback alert outbox record not found');
    }

    const updated = await prisma.callbackAlertOutbox.update({
      where: {
        id,
      },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(),
        lastError: null,
        maxRetries: Math.max(existing.maxRetries, existing.retryCount + 1),
      },
    });

    await writeCallbackAlertReplayLog({
      outboxIds: [id],
      actorId: options?.actorId,
      actionType: 'REQUEUE',
      note: 'manual single requeue',
    });

    return updated;
  },

  async retryDeadCallbackAlertOutboxes(limit = 50, options?: { actorId?: string | null }) {
    const take = Math.min(200, Math.max(1, limit));

    const deadRows = await prisma.callbackAlertOutbox.findMany({
      where: {
        status: 'DEAD',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take,
      select: {
        id: true,
      },
    });

    const ids = deadRows.map(item => item.id);
    if (!ids.length) {
      return {
        requested: take,
        requeued: 0,
      };
    }

    const result = await prisma.callbackAlertOutbox.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(),
        lastError: null,
      },
    });

    await writeCallbackAlertReplayLog({
      outboxIds: ids,
      actorId: options?.actorId,
      actionType: 'REQUEUE_DEAD_BATCH',
      note: `batch dead requeue limit=${take}`,
    });

    return {
      requested: take,
      requeued: result.count,
    };
  },

  async listCallbackAlertReplayLogs(
    callbackOutboxId: string,
    page = 1,
    pageSize = 10,
    filters?: {
      actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const normalizedPage = Math.max(1, page);
    const normalizedPageSize = Math.min(100, Math.max(1, pageSize));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.CallbackAlertReplayLogWhereInput = {
      callbackOutboxId,
      actionType: filters?.actionType,
      actorId: filters?.actorId,
      createdAt: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    };

    const [total, items] = await Promise.all([
      prisma.callbackAlertReplayLog.count({ where }),
      prisma.callbackAlertReplayLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: normalizedPageSize,
        select: {
          id: true,
          actionType: true,
          actorId: true,
          note: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total,
        totalPages: Math.ceil(total / normalizedPageSize),
      },
    };
  },

  async listCallbackAlertReplayLogExportRows(
    callbackOutboxId: string,
    filters?: {
      actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: Prisma.CallbackAlertReplayLogWhereInput = {
      callbackOutboxId,
      actionType: filters?.actionType,
      actorId: filters?.actorId,
      createdAt: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    };

    return prisma.callbackAlertReplayLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: 5000,
      select: {
        callbackOutboxId: true,
        actionType: true,
        actorId: true,
        note: true,
        createdAt: true,
      },
    });
  },

  async queryCallbackAlertReplayLogStats(
    callbackOutboxId: string,
    filters?: {
      actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
      dominanceThreshold?: number;
      dominanceMinSamples?: number;
      staleThresholdMinutes?: number;
    },
  ) {
    const where: Prisma.CallbackAlertReplayLogWhereInput = {
      callbackOutboxId,
      actionType: filters?.actionType,
      actorId: filters?.actorId,
      createdAt: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    };

    const [total, byActionRows, uniqueActorRows, latestReplay] = await Promise.all([
      prisma.callbackAlertReplayLog.count({ where }),
      prisma.callbackAlertReplayLog.groupBy({
        by: ['actionType'],
        where,
        _count: {
          _all: true,
        },
      }),
      prisma.callbackAlertReplayLog.groupBy({
        by: ['actorId'],
        where: {
          ...where,
          actorId: {
            not: null,
          },
        },
      }),
      prisma.callbackAlertReplayLog.findFirst({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const byAction = {
      REQUEUE: 0,
      REQUEUE_DEAD_BATCH: 0,
    };

    byActionRows.forEach((row) => {
      byAction[row.actionType as 'REQUEUE' | 'REQUEUE_DEAD_BATCH'] = row._count._all;
    });

    const batchReplayRatio = total > 0
      ? Number((byAction.REQUEUE_DEAD_BATCH / total).toFixed(4))
      : 0;
    const dominanceThreshold = Number((filters?.dominanceThreshold ?? 0.7).toFixed(4));
    const dominanceMinSamples = filters?.dominanceMinSamples ?? 5;
    const isBatchReplayDominant = total >= dominanceMinSamples && batchReplayRatio >= dominanceThreshold;
    const staleThresholdMinutes = filters?.staleThresholdMinutes ?? 30;
    const latestReplayAt = latestReplay?.createdAt.toISOString() ?? null;
    const minutesSinceLastReplay = latestReplay
      ? Math.floor((Date.now() - latestReplay.createdAt.getTime()) / 60000)
      : null;
    const isReplayStale = minutesSinceLastReplay !== null && minutesSinceLastReplay >= staleThresholdMinutes;

    return {
      total,
      byAction,
      uniqueActorCount: uniqueActorRows.length,
      batchReplayRatio,
      isBatchReplayDominant,
      latestReplayAt,
      minutesSinceLastReplay,
      dominanceThreshold,
      dominanceMinSamples,
      staleThresholdMinutes,
      isReplayStale,
    };
  },
};

export const purgeExpiredCallbackAudits = async (olderThanDays = 90) => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.callbackAudit.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  });

  return {
    cutoff,
    deleted: result.count,
  };
};
