import { prisma } from '../lib/prisma';
import type {
  CaregiverService,
  OrderMain,
  PetProfile,
  ServiceRequest,
  Prisma,
} from '../lib/prisma-generated';
import { badRequest, notFound } from '../utils/errors';
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

export const petpalService = {
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

  async getOwnerOrderDetail(ownerId: string, orderId: string): Promise<OrderMain & {
    payments: Array<{
      id: string;
      payNo: string;
      bizType: string;
      payStatus: string;
      payAmount: Prisma.Decimal;
      paidAt: Date | null;
    }>;
    refunds: Array<{
      id: string;
      refundNo: string;
      refundType: string;
      refundStatus: string;
      refundAmount: Prisma.Decimal;
      reviewedAt: Date | null;
    }>;
  }> {
    const order = await prisma.orderMain.findFirst({
      where: {
        id: orderId,
        ownerId,
      },
      include: {
        payments: {
          where: {
            deleteAt: null,
          },
          select: {
            id: true,
            payNo: true,
            bizType: true,
            payStatus: true,
            payAmount: true,
            paidAt: true,
          },
        },
        refunds: {
          where: {
            deleteAt: null,
          },
          select: {
            id: true,
            refundNo: true,
            refundType: true,
            refundStatus: true,
            refundAmount: true,
            reviewedAt: true,
          },
        },
      },
    });

    if (!order) {
      throw notFound('Order not found');
    }

    assertOrderAmountInvariant(order);
    return order;
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
};
