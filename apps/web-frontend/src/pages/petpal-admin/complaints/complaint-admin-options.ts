import type {
  ComplaintAdminRecord,
  ComplaintAdminSlaStatus,
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  ManageComplaintPayload,
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

export const complaintAdminActionOptions: Array<ComplaintOption<ManageComplaintPayload['actionType']>> = [
  { label: '指派负责人', value: 'ASSIGN' },
  { label: '补充调查', value: 'INVESTIGATE' },
  { label: '联系用户', value: 'CALL_USER' },
  { label: '处罚记录', value: 'PENALTY' },
  { label: '结案', value: 'CLOSE' },
];

export const complaintAdminCloseResultOptions: Array<
  ComplaintOption<Extract<ComplaintStatus, 'RESOLVED' | 'REJECTED'>>
> = complaintAdminStatusOptions.filter(
  (item): item is ComplaintOption<Extract<ComplaintStatus, 'RESOLVED' | 'REJECTED'>> =>
    item.value === 'RESOLVED' || item.value === 'REJECTED',
);

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

export const getComplaintAdminActionLabel = (
  actionType: ComplaintAdminRecord['processLogs'][number]['actionType'],
) => {
  const labels: Record<ComplaintAdminRecord['processLogs'][number]['actionType'], string> = {
    OPEN: '发起投诉',
    ASSIGN: '指派负责人',
    INVESTIGATE: '补充调查',
    CALL_USER: '联系用户',
    PENALTY: '处罚记录',
    CLOSE: '结案',
  };
  return labels[actionType] ?? actionType;
};

export const getComplaintAdminQuickAssignLabel = (
  complaint: Pick<ComplaintAdminRecord, 'assignedAdminId'>,
) => complaint.assignedAdminId ? '转给我' : '指派给我';
