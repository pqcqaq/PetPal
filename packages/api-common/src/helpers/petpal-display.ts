import type { OrderConversationRecord } from '../types/petpal';

export type PetPalConversationRole = 'owner' | 'caregiver';

const toValidDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getPetPalConversationUnreadCount = (
  conversation: OrderConversationRecord | null | undefined,
  role: PetPalConversationRole,
) => {
  if (!conversation) {
    return 0;
  }

  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount;
};

export const formatPetPalAmount = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

export const formatPetPalMoney = (value: number | string | null | undefined) =>
  `¥${formatPetPalAmount(value)}`;

export const formatPetPalDate = (value: string | null | undefined) => {
  const date = toValidDate(value);
  if (!date) {
    return '--';
  }

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const formatPetPalTime = (value: string | null | undefined) => {
  const date = toValidDate(value);
  if (!date) {
    return '--';
  }

  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const formatPetPalRange = (
  start: string | null | undefined,
  end: string | null | undefined,
) => `${formatPetPalTime(start)} - ${formatPetPalTime(end)}`;
