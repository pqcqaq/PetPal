import type { CaregiverAftersalesRiskOrderRecord } from '@rbac/api-common';
import {
  caregiverRiskQueueExportPresetDefinitions,
  getCaregiverRiskQueueExportPresetLabel,
  type CaregiverRiskQueueExportPreset,
} from './caregiver-risk-queue-preset-config';

export type CaregiverRiskQueueExportAction = {
  preset: CaregiverRiskQueueExportPreset;
  label: string;
  count: number;
};

export { getCaregiverRiskQueueExportPresetLabel };

export const buildCaregiverRiskQueueExportActions = (
  orders: CaregiverAftersalesRiskOrderRecord[],
): CaregiverRiskQueueExportAction[] => {
  return caregiverRiskQueueExportPresetDefinitions
    .map((definition) => ({
      preset: definition.preset,
      label: definition.label,
      count: orders.filter((order) => definition.matchesOrder(order)).length,
    }))
    .filter((item) => item.count > 0);
};
