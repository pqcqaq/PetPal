import type {
  ComplaintTargetRole,
  PenaltyRectifyStatus,
  PenaltySeverity,
  PenaltyType,
} from '@rbac/api-common';
import {
  getPetPalComplaintTargetRoleLabel,
  petPalComplaintTargetOptions,
} from '../../frontend/petpal/shared';

type PenaltyOption<T extends string> = {
  label: string;
  value: T;
};

export const penaltyAdminTargetRoleOptions: Array<PenaltyOption<ComplaintTargetRole>> =
  petPalComplaintTargetOptions;

export const penaltyTypeOptions: Array<PenaltyOption<PenaltyType>> = [
  { label: '警告', value: 'WARNING' },
  { label: '服务限制', value: 'SERVICE_RESTRICTION' },
  { label: '账号停用', value: 'ACCOUNT_SUSPENSION' },
  { label: '其他', value: 'OTHER' },
];

export const penaltySeverityOptions: Array<PenaltyOption<PenaltySeverity>> = [
  { label: '低', value: 'LOW' },
  { label: '中', value: 'MEDIUM' },
  { label: '高', value: 'HIGH' },
];

export const penaltyRectifyStatusOptions: Array<PenaltyOption<PenaltyRectifyStatus>> = [
  { label: '待整改', value: 'PENDING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已豁免', value: 'WAIVED' },
];

const findPenaltyOptionLabel = <T extends string>(
  options: Array<PenaltyOption<T>>,
  value: T,
) => options.find((item) => item.value === value)?.label ?? value;

export const getPenaltyTargetRoleLabel = (value: ComplaintTargetRole) =>
  getPetPalComplaintTargetRoleLabel(value);

export const getPenaltyTypeLabel = (value: PenaltyType) =>
  findPenaltyOptionLabel(penaltyTypeOptions, value);

export const getPenaltySeverityLabel = (value: PenaltySeverity) =>
  findPenaltyOptionLabel(penaltySeverityOptions, value);

export const getPenaltyRectifyStatusLabel = (value: PenaltyRectifyStatus) =>
  findPenaltyOptionLabel(penaltyRectifyStatusOptions, value);

export const getPenaltySeverityTagType = (
  value: PenaltySeverity,
): 'info' | 'warning' | 'danger' => {
  const types: Record<PenaltySeverity, 'info' | 'warning' | 'danger'> = {
    LOW: 'info',
    MEDIUM: 'warning',
    HIGH: 'danger',
  };
  return types[value] ?? 'info';
};

export const getPenaltyRectifyStatusTagType = (
  value: PenaltyRectifyStatus,
): 'warning' | 'success' | 'info' => {
  const types: Record<PenaltyRectifyStatus, 'warning' | 'success' | 'info'> = {
    PENDING: 'warning',
    COMPLETED: 'success',
    WAIVED: 'info',
  };
  return types[value] ?? 'info';
};
