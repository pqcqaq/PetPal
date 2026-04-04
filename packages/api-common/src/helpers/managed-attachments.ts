import type { ManagedAttachmentRecord, MediaAssetRecord } from '../types/files';

type ManagedAttachmentTimestamp = string | Date;

const isManagedAttachmentRecordObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export type ManagedAttachmentRecordInput = {
  fileId: string;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: ManagedAttachmentTimestamp;
};

export type ManagedAttachmentMediaAssetSource = Pick<
  MediaAssetRecord,
  'id' | 'originalName' | 'mimeType' | 'size' | 'url' | 'createdAt' | 'completedAt'
> & {
  createdAt: ManagedAttachmentTimestamp;
  completedAt?: ManagedAttachmentTimestamp | null;
};

const normalizeManagedAttachmentTimestamp = (value: ManagedAttachmentTimestamp) => (
  value instanceof Date ? value.toISOString() : value
);

const resolveManagedAttachmentTimestamp = (value: unknown): ManagedAttachmentTimestamp | null => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  return null;
};

export type ParseManagedAttachmentRecordOptions = {
  fallbackUploadedAt?: ManagedAttachmentTimestamp;
};

export const createManagedAttachmentRecord = (
  input: ManagedAttachmentRecordInput,
): ManagedAttachmentRecord => ({
  fileId: input.fileId,
  url: input.url,
  name: input.name,
  mimeType: input.mimeType,
  size: input.size,
  uploadedAt: normalizeManagedAttachmentTimestamp(input.uploadedAt),
});

export const cloneManagedAttachmentRecord = (
  attachment: ManagedAttachmentRecord,
): ManagedAttachmentRecord => createManagedAttachmentRecord({
  fileId: attachment.fileId,
  url: attachment.url,
  name: attachment.name,
  mimeType: attachment.mimeType,
  size: attachment.size,
  uploadedAt: attachment.uploadedAt,
});

export const cloneManagedAttachmentRecords = (
  attachments: ManagedAttachmentRecord[],
): ManagedAttachmentRecord[] => attachments.map((item) => cloneManagedAttachmentRecord(item));

export const parseManagedAttachmentRecord = (
  rawValue: unknown,
  options: ParseManagedAttachmentRecordOptions = {},
): ManagedAttachmentRecord | null => {
  if (!isManagedAttachmentRecordObject(rawValue)) {
    return null;
  }

  const { fileId, url, name, mimeType, size } = rawValue;
  if (
    typeof fileId !== 'string'
    || typeof url !== 'string'
    || typeof name !== 'string'
    || typeof mimeType !== 'string'
    || typeof size !== 'number'
    || !Number.isFinite(size)
    || size < 0
  ) {
    return null;
  }

  if (!fileId.trim() || !url.trim() || !name.trim() || !mimeType.trim()) {
    return null;
  }

  const uploadedAt = resolveManagedAttachmentTimestamp(rawValue.uploadedAt)
    ?? resolveManagedAttachmentTimestamp(options.fallbackUploadedAt);
  if (!uploadedAt) {
    return null;
  }

  return createManagedAttachmentRecord({
    fileId,
    url,
    name,
    mimeType,
    size,
    uploadedAt,
  });
};

export const createManagedAttachmentRecordFromMediaAsset = (
  asset: ManagedAttachmentMediaAssetSource,
): ManagedAttachmentRecord => {
  const url = asset.url?.trim();
  if (!url) {
    throw new Error('Managed attachment requires an accessible url');
  }

  return createManagedAttachmentRecord({
    fileId: asset.id,
    url,
    name: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    uploadedAt: asset.completedAt ?? asset.createdAt,
  });
};
