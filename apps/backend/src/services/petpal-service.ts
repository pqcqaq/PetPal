import { prisma } from '../lib/prisma';
import type {
  CallbackAudit,
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
    return prisma.$transaction(async (tx) => {
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
          await tx.callbackAudit.create({
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
        await tx.callbackAudit.create({
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
    return prisma.$transaction(async (tx) => {
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
          await tx.callbackAudit.create({
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
        await tx.callbackAudit.create({
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
};
