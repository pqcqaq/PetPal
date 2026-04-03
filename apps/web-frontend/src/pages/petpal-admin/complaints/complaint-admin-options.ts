import type {
  ComplaintAdminSlaStatus,
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
} from '@rbac/api-common';
import {
  getPetPalComplaintSlaStatusType,
  getPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel,
  petPalComplaintSlaStatusOptions,
  petPalComplaintStatusOptions,
  petPalComplaintTargetOptions,
  petPalComplaintTypeOptions,
} from '../../frontend/petpal/shared';

type ComplaintOption<T extends string> = {
  label: string;
  value: T;
};

export const complaintAdminStatusOptions: Array<ComplaintOption<ComplaintStatus>> =
  petPalComplaintStatusOptions.map((item) => ({
    label: item.value === 'OPEN' ? '待处理' : item.label,
    value: item.value,
  }));

export const complaintAdminTypeOptions = petPalComplaintTypeOptions;

export const complaintAdminTargetRoleOptions = petPalComplaintTargetOptions;

export const complaintAdminSlaStatusOptions: Array<ComplaintOption<ComplaintAdminSlaStatus>> =
  petPalComplaintSlaStatusOptions.map((item) => ({
    label:
      item.value === 'NORMAL'
        ? '正常'
        : item.value === 'OVERDUE'
          ? '已超时'
          : item.label,
    value: item.value,
  }));

const findComplaintAdminOptionLabel = <T extends string>(
  options: Array<ComplaintOption<T>>,
  value: T,
) => options.find((item) => item.value === value)?.label ?? value;

export const getComplaintAdminStatusLabel = (status: ComplaintStatus) =>
  findComplaintAdminOptionLabel(complaintAdminStatusOptions, status);

export const getComplaintAdminStatusType = (
  status: ComplaintStatus,
): 'warning' | 'primary' | 'success' | 'info' => {
  const types: Record<ComplaintStatus, 'warning' | 'primary' | 'success' | 'info'> = {
    OPEN: 'warning',
    PROCESSING: 'primary',
    RESOLVED: 'success',
    REJECTED: 'info',
  };
  return types[status] ?? 'info';
};

export const getComplaintAdminTypeLabel = (type: ComplaintType) =>
  getPetPalComplaintTypeLabel(type);

export const getComplaintAdminTargetRoleLabel = (role: ComplaintTargetRole) =>
  getPetPalComplaintTargetRoleLabel(role);

export const getComplaintAdminSlaStatusLabel = (status: ComplaintAdminSlaStatus) =>
  findComplaintAdminOptionLabel(complaintAdminSlaStatusOptions, status);

export const getComplaintAdminSlaTagType = (
  status: ComplaintAdminSlaStatus,
): 'success' | 'warning' | 'danger' => getPetPalComplaintSlaStatusType(status);
