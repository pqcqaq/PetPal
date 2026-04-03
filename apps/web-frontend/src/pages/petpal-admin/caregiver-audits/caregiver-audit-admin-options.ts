import type {
  CaregiverAuditListItem,
  CaregiverAuditStatus,
} from '@rbac/api-common';
import { petPalCaregiverAuditOptions } from '../../frontend/petpal/shared';

type CaregiverAuditOption<T extends string> = {
  label: string;
  value: T;
};

export const caregiverAuditAdminStatusOptions: Array<CaregiverAuditOption<CaregiverAuditStatus>> =
  petPalCaregiverAuditOptions.map((item) => ({
    label: item.value === 'REJECTED' ? '已拒绝' : item.label,
    value: item.value,
  }));

export const caregiverAuditAdminActionOptions: Array<CaregiverAuditOption<CaregiverAuditStatus>> = [
  { label: '通过', value: 'APPROVED' },
  { label: '拒绝', value: 'REJECTED' },
  { label: '重置', value: 'PENDING' },
];

const findCaregiverAuditAdminOptionLabel = <T extends string>(
  options: Array<CaregiverAuditOption<T>>,
  value: T,
) => options.find((item) => item.value === value)?.label ?? value;

export const getCaregiverAuditAdminStatusLabel = (status: CaregiverAuditStatus) =>
  findCaregiverAuditAdminOptionLabel(caregiverAuditAdminStatusOptions, status);

export const getCaregiverAuditAdminStatusTagType = (
  status: CaregiverAuditStatus,
): 'success' | 'danger' | 'warning' => {
  if (status === 'APPROVED') {
    return 'success';
  }
  if (status === 'REJECTED') {
    return 'danger';
  }
  return 'warning';
};

export const getCaregiverAuditAdminActionLabel = (
  status: CaregiverAuditListItem['auditStatus'],
) => findCaregiverAuditAdminOptionLabel(caregiverAuditAdminActionOptions, status);
