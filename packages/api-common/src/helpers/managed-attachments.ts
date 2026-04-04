import type { ManagedAttachmentRecord, MediaAssetRecord } from '../types/files';

type ManagedAttachmentTimestamp = string | Date;

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
