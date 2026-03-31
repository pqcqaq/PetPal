import { emitPetPalCallbackAlert } from '../lib/socket';
import { prisma } from '../lib/prisma';

const RETRYABLE_STATUSES = ['PENDING', 'FAILED'] as const;

const computeBackoffMinutes = (retryCount: number) => {
  const step = Math.max(1, retryCount);
  return Math.min(60, 2 ** step);
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const dispatchPetPalCallbackAlertOutbox = async (options?: {
  batchSize?: number;
  now?: Date;
}) => {
  const batchSize = Math.min(200, Math.max(1, options?.batchSize ?? 20));
  const now = options?.now ?? new Date();

  const dueRows = await prisma.callbackAlertOutbox.findMany({
    where: {
      status: {
        in: [...RETRYABLE_STATUSES],
      },
      nextRetryAt: {
        lte: now,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: batchSize,
  });

  const result = {
    checked: dueRows.length,
    sent: 0,
    failed: 0,
    dead: 0,
  };

  for (const row of dueRows) {
    const locked = await prisma.callbackAlertOutbox.updateMany({
      where: {
        id: row.id,
        status: {
          in: [...RETRYABLE_STATUSES],
        },
      },
      data: {
        status: 'PROCESSING',
      },
    });

    if (locked.count === 0) {
      continue;
    }

    try {
      const payload = row.payload as {
        callbackAuditId: string;
        callbackStatus: string;
        callbackType: string;
        reason: string;
        requestId: string;
      };

      emitPetPalCallbackAlert({
        callbackAuditId: payload.callbackAuditId,
        callbackStatus: payload.callbackStatus,
        callbackType: payload.callbackType,
        reason: payload.reason,
        requestId: payload.requestId,
        outboxId: row.id,
        retryCount: row.retryCount,
      });

      await prisma.callbackAlertOutbox.update({
        where: {
          id: row.id,
        },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          lastError: null,
        },
      });

      result.sent += 1;
    } catch (error) {
      const nextRetryCount = row.retryCount + 1;
      const exceeded = nextRetryCount >= row.maxRetries;
      const nextRetryAt = new Date(now.getTime() + computeBackoffMinutes(nextRetryCount) * 60 * 1000);

      await prisma.callbackAlertOutbox.update({
        where: {
          id: row.id,
        },
        data: {
          status: exceeded ? 'DEAD' : 'FAILED',
          retryCount: nextRetryCount,
          nextRetryAt,
          lastError: toErrorMessage(error),
        },
      });

      if (exceeded) {
        result.dead += 1;
      } else {
        result.failed += 1;
      }
    }
  }

  return result;
};
