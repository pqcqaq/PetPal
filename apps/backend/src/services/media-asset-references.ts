import type { MediaAssetReferenceKind, MediaAssetReferenceRecord } from '@rbac/api-common';
import { prismaRaw } from '../lib/prisma';
import { Prisma } from '../lib/prisma-generated';

type MediaAssetReferenceRow = {
  assetId: string;
  entityId: string;
  title: string;
  note: string;
};

const normalizeAssetIds = (assetIds: string[]) =>
  [...new Set(assetIds.map((assetId) => assetId.trim()).filter(Boolean))];

const appendReference = (
  referenceMap: Map<string, MediaAssetReferenceRecord[]>,
  assetId: string,
  reference: MediaAssetReferenceRecord,
) => {
  const existing = referenceMap.get(assetId);
  if (existing) {
    existing.push(reference);
    return;
  }

  referenceMap.set(assetId, [reference]);
};

const sortReferences = (references: MediaAssetReferenceRecord[]) =>
  references.sort((left, right) =>
    left.kind.localeCompare(right.kind)
    || left.title.localeCompare(right.title)
    || left.entityId.localeCompare(right.entityId),
  );

const queryCaregiverQualificationReferences = async (assetIds: string[]) =>
  prismaRaw.$queryRaw<MediaAssetReferenceRow[]>(Prisma.sql`
    SELECT DISTINCT
      material ->> 'fileId' AS "assetId",
      cp.id AS "entityId",
      COALESCE(NULLIF(u.nickname, ''), u.username) AS "title",
      CONCAT('照料者资质材料 · ', COALESCE(NULLIF(u.nickname, ''), u.username), ' (', u.username, ')') AS "note"
    FROM "CaregiverProfile" cp
    INNER JOIN "User" u
      ON u.id = cp."userId"
     AND u."deleteAt" IS NULL
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cp."qualificationMaterials", '[]'::jsonb)) AS material
    WHERE cp."deleteAt" IS NULL
      AND material ->> 'fileId' IN (${Prisma.join(assetIds)})
  `);

const queryPenaltyRectifyReferences = async (assetIds: string[]) =>
  prismaRaw.$queryRaw<MediaAssetReferenceRow[]>(Prisma.sql`
    SELECT DISTINCT
      material ->> 'fileId' AS "assetId",
      pr.id AS "entityId",
      om."orderNo" AS "title",
      CONCAT('处罚整改凭证 · ', om."orderNo") AS "note"
    FROM "PenaltyRecord" pr
    INNER JOIN "OrderMain" om
      ON om.id = pr."orderId"
     AND om."deleteAt" IS NULL
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pr."rectifyEvidenceMaterials", '[]'::jsonb)) AS material
    WHERE pr."deleteAt" IS NULL
      AND material ->> 'fileId' IN (${Prisma.join(assetIds)})
  `);

const toReferenceRecord = (
  kind: MediaAssetReferenceKind,
  row: MediaAssetReferenceRow,
): MediaAssetReferenceRecord => ({
  kind,
  entityId: row.entityId,
  title: row.title,
  note: row.note,
});

export const resolveMediaAssetReferenceMap = async (assetIds: string[]) => {
  const normalizedAssetIds = normalizeAssetIds(assetIds);
  const referenceMap = new Map<string, MediaAssetReferenceRecord[]>();

  if (!normalizedAssetIds.length) {
    return referenceMap;
  }

  const [caregiverRows, penaltyRows] = await Promise.all([
    queryCaregiverQualificationReferences(normalizedAssetIds),
    queryPenaltyRectifyReferences(normalizedAssetIds),
  ]);

  caregiverRows.forEach((row) => {
    appendReference(
      referenceMap,
      row.assetId,
      toReferenceRecord('PETPAL_CAREGIVER_QUALIFICATION', row),
    );
  });

  penaltyRows.forEach((row) => {
    appendReference(
      referenceMap,
      row.assetId,
      toReferenceRecord('PETPAL_PENALTY_RECTIFY', row),
    );
  });

  referenceMap.forEach((references) => {
    sortReferences(references);
  });

  return referenceMap;
};

export const listMediaAssetReferences = async (assetId: string) =>
  (await resolveMediaAssetReferenceMap([assetId])).get(assetId) ?? [];

export const formatMediaAssetReferenceBlockMessage = (
  references: MediaAssetReferenceRecord[],
) => {
  const summary = references
    .slice(0, 3)
    .map((reference) => `${reference.note} [${reference.title}]`)
    .join('; ');

  return references.length > 3
    ? `Attachment is still referenced by business records: ${summary}; and ${references.length - 3} more`
    : `Attachment is still referenced by business records: ${summary}`;
};
