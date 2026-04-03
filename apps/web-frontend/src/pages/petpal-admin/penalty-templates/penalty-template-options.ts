import type { ComplaintTargetRole } from '@rbac/api-common';
import {
  getPenaltySeverityLabel,
  getPenaltySeverityTagType,
  getPenaltyTargetRoleLabel,
  getPenaltyTypeLabel,
  penaltyAdminTargetRoleOptions,
  penaltySeverityOptions,
  penaltyTypeOptions,
} from '../penalties/penalty-admin-options';

type TemplateFilterOption<T extends string> = {
  label: string;
  value: T;
};

export type PenaltyTemplateStatusFilter = 'ACTIVE' | 'INACTIVE';

export const penaltyTemplateStatusOptions: Array<TemplateFilterOption<PenaltyTemplateStatusFilter>> = [
  { label: '启用中', value: 'ACTIVE' },
  { label: '已停用', value: 'INACTIVE' },
];

export const penaltyTemplateTargetRoleOptions = penaltyAdminTargetRoleOptions;
export const penaltyTemplateTypeOptions = penaltyTypeOptions;
export const penaltyTemplateSeverityOptions = penaltySeverityOptions;

export const getPenaltyTemplateStatusLabel = (isActive: boolean) => (
  isActive ? '启用中' : '已停用'
);

export const getPenaltyTemplateStatusTagType = (isActive: boolean): 'success' | 'info' => (
  isActive ? 'success' : 'info'
);

export const getPenaltyTemplateTargetRoleLabel = (
  targetRole: ComplaintTargetRole | null | undefined,
) => (
  targetRole ? getPenaltyTargetRoleLabel(targetRole) : '通用模板'
);

export const getPenaltyTemplateTypeLabel = getPenaltyTypeLabel;
export const getPenaltyTemplateSeverityLabel = getPenaltySeverityLabel;
export const getPenaltyTemplateSeverityTagType = getPenaltySeverityTagType;
