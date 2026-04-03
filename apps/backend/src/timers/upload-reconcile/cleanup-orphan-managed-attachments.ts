import {
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
  PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
} from '@rbac/api-common';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { resolveMediaAssetReferenceMap } from '../../services/media-asset-references';
import { HttpError } from '../../utils/errors';

type CleanupTargetAsset = {
  id: string;
};

export type OrphanManagedAttachmentCleanupOptions = {
  now?: Date;
  batchSize?: number;
  graceMinutes?: number;
};

export type OrphanManagedAttachmentCleanupResult = {
  checked: number;
  deleted: number;
  keptReferenced: number;
  blocked: number;
};

const isDeleteBlockedByNewReference = (error: unknown) =>
  error instanceof HttpError
  && error.statusCode === 400
  && /Attachment is still referenced by business records/.test(error.message);

const resolveCutoff = (now: Date, graceMinutes: number) =>
  new Date(now.getTime() - graceMinutes * 60 * 1000);

const listCleanupTargets = async (cutoff: Date, batchSize: number) =>
  prisma.mediaAsset.findMany({
    where: {
      kind: 'attachment',
      uploadStatus: 'COMPLETED',
      AND: [
        {
          OR: [
            {
              tag1: PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
            },
            {
              tag1: PETPAL_ORDER_COMPLAINT_ATTACHMENT_TAG,
            },
            {
              tag1: PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
            },
            {
              tag1: 'petpal-penalty',
              tag2: 'rectify',
            },
          ],
        },
        {
          OR: [
            {
              completedAt: {
                lte: cutoff,
              },
            },
            {
              completedAt: null,
              createdAt: {
                lte: cutoff,
              },
            },
          ],
        },
      ],
    },
    orderBy: [
      {
        completedAt: 'asc',
      },
      {
        createdAt: 'asc',
      },
    ],
    take: batchSize,
    select: {
      id: true,
    },
  }) as Promise<CleanupTargetAsset[]>;

export const cleanupOrphanManagedAttachments = async (
  options?: OrphanManagedAttachmentCleanupOptions,
): Promise<OrphanManagedAttachmentCleanupResult> => {
  const now = options?.now ?? new Date();
  const graceMinutes = options?.graceMinutes ?? env.UPLOAD_ORPHAN_GRACE_PERIOD_MINUTES;
  const batchSize = options?.batchSize ?? env.UPLOAD_RECONCILE_BATCH_SIZE;
  const targets = await listCleanupTargets(resolveCutoff(now, graceMinutes), batchSize);

  if (!targets.length) {
    return {
      checked: 0,
      deleted: 0,
      keptReferenced: 0,
      blocked: 0,
    };
  }

  const referenceMap = await resolveMediaAssetReferenceMap(targets.map((target) => target.id));
  let deleted = 0;
  let keptReferenced = 0;
  let blocked = 0;

  for (const target of targets) {
    if ((referenceMap.get(target.id) ?? []).length > 0) {
      keptReferenced += 1;
      continue;
    }

    try {
      await prisma.mediaAsset.delete({
        where: { id: target.id },
      });
      deleted += 1;
    } catch (error) {
      if (isDeleteBlockedByNewReference(error)) {
        blocked += 1;
        continue;
      }

      throw error;
    }
  }

  return {
    checked: targets.length,
    deleted,
    keptReferenced,
    blocked,
  };
};
