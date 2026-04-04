import type {
  PetPalMessageDraftAttachment,
  PetPalMessageDraftState,
  PetPalMessageRecoveryState,
} from '../types/petpal';
import {
  cloneManagedAttachmentRecords,
  parseManagedAttachmentRecord,
  type ParseManagedAttachmentRecordOptions,
} from './managed-attachments';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const clonePetPalMessageDraftState = (
  draft: PetPalMessageDraftState,
): PetPalMessageDraftState => ({
  content: draft.content,
  attachments: cloneManagedAttachmentRecords(draft.attachments),
});

export const parsePetPalMessageDraftState = (
  rawValue: unknown,
  options: ParseManagedAttachmentRecordOptions = {},
): PetPalMessageDraftState | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const content = typeof rawValue.content === 'string' ? rawValue.content : '';
  const attachments = Array.isArray(rawValue.attachments)
    ? rawValue.attachments
      .map((item) => parseManagedAttachmentRecord(item, options))
      .filter((item): item is PetPalMessageDraftAttachment => Boolean(item))
    : [];

  if (!content.trim() && !attachments.length) {
    return null;
  }

  return {
    content,
    attachments,
  };
};

export const parsePetPalMessageRecoveryState = (
  rawValue: unknown,
): PetPalMessageRecoveryState | null => {
  if (!isRecord(rawValue)) {
    return null;
  }

  const { stage, message } = rawValue;
  if ((stage !== 'upload' && stage !== 'send') || typeof message !== 'string' || !message.trim()) {
    return null;
  }

  return {
    stage,
    message,
  };
};
