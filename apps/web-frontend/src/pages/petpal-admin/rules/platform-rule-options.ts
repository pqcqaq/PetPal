import type { PlatformRuleStatus } from '@rbac/api-common';

type PlatformRuleOption<T extends string> = {
  label: string;
  value: T;
};

export const platformRuleStatusOptions: Array<PlatformRuleOption<PlatformRuleStatus>> = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已归档', value: 'ARCHIVED' },
];

const findPlatformRuleOptionLabel = (
  options: ReadonlyArray<PlatformRuleOption<PlatformRuleStatus>>,
  status: PlatformRuleStatus,
) => options.find((item) => item.value === status)?.label || status;

export const getPlatformRuleStatusLabel = (status: PlatformRuleStatus) => (
  findPlatformRuleOptionLabel(platformRuleStatusOptions, status)
);

export const getPlatformRuleStatusTagType = (
  status: PlatformRuleStatus,
): 'warning' | 'success' | 'info' => {
  if (status === 'DRAFT') {
    return 'warning';
  }

  if (status === 'PUBLISHED') {
    return 'success';
  }

  return 'info';
};
