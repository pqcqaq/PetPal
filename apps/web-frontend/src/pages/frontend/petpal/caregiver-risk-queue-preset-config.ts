import type {
  CaregiverAftersalesRiskOrderRecord,
  ComplaintStatus,
  ComplaintTargetRole,
  RefundStatus,
} from '@rbac/api-common';

export const CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT = 100;
export const CAREGIVER_REPEAT_COMPLAINT_COUNT = 2;

type CaregiverRiskQueueExportPresetPatch = {
  complaintStatus?: ComplaintStatus;
  complaintTargetRole?: ComplaintTargetRole;
  refundStatus?: RefundStatus;
  minRefundAmount?: number;
  minComplaintCount?: number;
};

type CaregiverRiskQueueExportPresetDefinition<P extends string = string> = {
  preset: P;
  label: string;
  patch: CaregiverRiskQueueExportPresetPatch;
  matchesOrder: (order: CaregiverAftersalesRiskOrderRecord) => boolean;
};

const toAmount = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const caregiverRiskQueueExportPresetDefinitions = [
  {
    preset: 'openComplaint',
    label: '待受理投诉',
    patch: {
      complaintStatus: 'OPEN',
    },
    matchesOrder: (order) => order.primaryComplaintStatus === 'OPEN',
  },
  {
    preset: 'openRepeatedComplaint',
    label: '待受理重复投诉',
    patch: {
      complaintStatus: 'OPEN',
      minComplaintCount: CAREGIVER_REPEAT_COMPLAINT_COUNT,
    },
    matchesOrder: (order) =>
      order.primaryComplaintStatus === 'OPEN'
      && order.complaintCount >= CAREGIVER_REPEAT_COMPLAINT_COUNT,
  },
  {
    preset: 'processingComplaint',
    label: '处理中投诉',
    patch: {
      complaintStatus: 'PROCESSING',
    },
    matchesOrder: (order) => order.primaryComplaintStatus === 'PROCESSING',
  },
  {
    preset: 'caregiverResponsibility',
    label: '照料者责任',
    patch: {
      complaintTargetRole: 'CAREGIVER',
    },
    matchesOrder: (order) => order.primaryComplaintTargetRole === 'CAREGIVER',
  },
  {
    preset: 'platformResponsibility',
    label: '平台责任',
    patch: {
      complaintTargetRole: 'PLATFORM',
    },
    matchesOrder: (order) => order.primaryComplaintTargetRole === 'PLATFORM',
  },
  {
    preset: 'refundAwaitingSettlement',
    label: '待退款',
    patch: {
      refundStatus: 'APPROVED',
    },
    matchesOrder: (order) => order.latestRefundStatus === 'APPROVED',
  },
  {
    preset: 'highRefundExposure',
    label: '高退款暴露',
    patch: {
      minRefundAmount: CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
    },
    matchesOrder: (order) =>
      toAmount(order.amountRefunded) >= CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  },
  {
    preset: 'repeatedComplaint',
    label: '重复投诉',
    patch: {
      minComplaintCount: CAREGIVER_REPEAT_COMPLAINT_COUNT,
    },
    matchesOrder: (order) => order.complaintCount >= CAREGIVER_REPEAT_COMPLAINT_COUNT,
  },
  {
    preset: 'repeatCaregiverComplaint',
    label: '照料者重复投诉',
    patch: {
      minComplaintCount: CAREGIVER_REPEAT_COMPLAINT_COUNT,
      complaintTargetRole: 'CAREGIVER',
    },
    matchesOrder: (order) =>
      order.complaintCount >= CAREGIVER_REPEAT_COMPLAINT_COUNT
      && order.primaryComplaintTargetRole === 'CAREGIVER',
  },
] as const satisfies readonly CaregiverRiskQueueExportPresetDefinition[];

export type CaregiverRiskQueueExportPreset =
  (typeof caregiverRiskQueueExportPresetDefinitions)[number]['preset'];

export type CaregiverRiskQueueExportPresetCountMap =
  Record<CaregiverRiskQueueExportPreset, number>;

export const caregiverRiskQueueExportPresets = caregiverRiskQueueExportPresetDefinitions.map(
  (definition) => definition.preset,
) as CaregiverRiskQueueExportPreset[];

export const createCaregiverRiskQueueExportPresetCountMap =
(): CaregiverRiskQueueExportPresetCountMap => Object.fromEntries(
  caregiverRiskQueueExportPresetDefinitions.map(({ preset }) => [preset, 0] as const),
) as CaregiverRiskQueueExportPresetCountMap;

export const countCaregiverRiskQueueExportPresets = (
  orders: CaregiverAftersalesRiskOrderRecord[],
): CaregiverRiskQueueExportPresetCountMap => {
  const countMap = createCaregiverRiskQueueExportPresetCountMap();

  for (const order of orders) {
    for (const definition of caregiverRiskQueueExportPresetDefinitions) {
      if (definition.matchesOrder(order)) {
        countMap[definition.preset] += 1;
      }
    }
  }

  return countMap;
};

export const getCaregiverRiskQueueExportPresetLabel = (
  preset: CaregiverRiskQueueExportPreset,
) =>
  caregiverRiskQueueExportPresetDefinitions.find((definition) => definition.preset === preset)?.label
  ?? '待退款';

export const getCaregiverRiskQueueExportPresetPatch = (
  preset: CaregiverRiskQueueExportPreset,
) =>
  caregiverRiskQueueExportPresetDefinitions.find((definition) => definition.preset === preset)?.patch
  ?? {};
