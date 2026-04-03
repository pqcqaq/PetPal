import { ref } from 'vue';

export type PetPalMessageDraftAttachment = {
  fileId: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

export type PetPalMessageDraftState = {
  content: string;
  attachments: PetPalMessageDraftAttachment[];
};

export type PetPalMessageRecoveryStage = 'upload' | 'send';

export type PetPalMessageRecoveryState = {
  stage: PetPalMessageRecoveryStage;
  message: string;
};

const messageDrafts = ref<Record<string, PetPalMessageDraftState>>({});
const messageRecoveries = ref<Record<string, PetPalMessageRecoveryState>>({});

const cloneMessageDraftAttachments = (attachments: PetPalMessageDraftAttachment[]) =>
  attachments.map((item) => ({
    fileId: item.fileId,
    url: item.url,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType,
  }));

export function hasPetPalMessageDraft(orderId: string) {
  return Boolean(messageDrafts.value[orderId]);
}

export function restorePetPalMessageDraft(orderId: string) {
  const draft = messageDrafts.value[orderId];
  if (!draft) {
    return null;
  }
  return {
    content: draft.content,
    attachments: cloneMessageDraftAttachments(draft.attachments),
  } satisfies PetPalMessageDraftState;
}

export function clearPetPalMessageDraft(orderId: string) {
  if (!messageDrafts.value[orderId]) {
    return;
  }

  const nextDrafts = { ...messageDrafts.value };
  delete nextDrafts[orderId];
  messageDrafts.value = nextDrafts;
}

export function persistPetPalMessageDraft(
  orderId: string,
  content: string,
  attachments: PetPalMessageDraftAttachment[],
) {
  if (!orderId) {
    return;
  }

  const nextAttachments = cloneMessageDraftAttachments(attachments);
  const hasDraft = content.trim().length > 0 || nextAttachments.length > 0;
  if (!hasDraft) {
    clearPetPalMessageDraft(orderId);
    return;
  }

  messageDrafts.value = {
    ...messageDrafts.value,
    [orderId]: {
      content,
      attachments: nextAttachments,
    },
  };
}

export function hasPetPalMessageRecovery(orderId: string) {
  return Boolean(messageRecoveries.value[orderId]);
}

export function getPetPalMessageRecovery(orderId: string) {
  return messageRecoveries.value[orderId] ?? null;
}

export function clearPetPalMessageRecovery(orderId: string) {
  if (!messageRecoveries.value[orderId]) {
    return;
  }

  const nextRecoveries = { ...messageRecoveries.value };
  delete nextRecoveries[orderId];
  messageRecoveries.value = nextRecoveries;
}

export function setPetPalMessageRecovery(
  orderId: string,
  stage: PetPalMessageRecoveryStage,
  message: string,
) {
  if (!orderId) {
    return;
  }

  messageRecoveries.value = {
    ...messageRecoveries.value,
    [orderId]: {
      stage,
      message,
    },
  };
}
