import type { CaregiverAftersalesRiskOrderRecord } from '@rbac/api-common';
import {
  countCaregiverRiskQueueExportPresets,
  caregiverRiskQueueExportPresetDefinitions,
  getCaregiverRiskQueueExportPresetDescription,
  getCaregiverRiskQueueExportPresetLabel,
  type CaregiverRiskQueueExportPreset,
} from './caregiver-risk-queue-preset-config';

export type CaregiverRiskQueueExportAction = {
  preset: CaregiverRiskQueueExportPreset;
  label: string;
  count: number;
};

export { getCaregiverRiskQueueExportPresetLabel };
export { getCaregiverRiskQueueExportPresetDescription };

export const buildCaregiverRiskQueueExportActions = (
  orders: CaregiverAftersalesRiskOrderRecord[],
): CaregiverRiskQueueExportAction[] => {
  const countMap = countCaregiverRiskQueueExportPresets(orders);

  return caregiverRiskQueueExportPresetDefinitions
    .map((definition) => ({
      preset: definition.preset,
      label: definition.label,
      count: countMap[definition.preset],
    }))
    .filter((item) => item.count > 0);
};
