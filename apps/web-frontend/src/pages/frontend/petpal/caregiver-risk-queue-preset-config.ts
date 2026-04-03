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
  description: string;
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
    description: '当前经营导出已聚焦待受理投诉，可优先复盘还未被接手的争议单。',
    patch: {
      complaintStatus: 'OPEN',
    },
    matchesOrder: (order) => order.primaryComplaintStatus === 'OPEN',
  },
  {
    preset: 'openRepeatedComplaint',
    label: '待受理重复投诉',
    description: '当前经营导出已聚焦待受理且已重复出现的投诉，可优先处理高复发风险订单。',
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
    description: '当前经营导出已聚焦处理中投诉，可继续跟进仍在协商或核实中的争议单。',
    patch: {
      complaintStatus: 'PROCESSING',
    },
    matchesOrder: (order) => order.primaryComplaintStatus === 'PROCESSING',
  },
  {
    preset: 'caregiverResponsibility',
    label: '照料者责任',
    description: '当前经营导出已聚焦照料者责任投诉，可优先复盘需要自查整改的风险单。',
    patch: {
      complaintTargetRole: 'CAREGIVER',
    },
    matchesOrder: (order) => order.primaryComplaintTargetRole === 'CAREGIVER',
  },
  {
    preset: 'platformResponsibility',
    label: '平台责任',
    description: '当前经营导出已聚焦平台责任投诉，可查看仍需平台继续跟进的争议单。',
    patch: {
      complaintTargetRole: 'PLATFORM',
    },
    matchesOrder: (order) => order.primaryComplaintTargetRole === 'PLATFORM',
  },
  {
    preset: 'refundAwaitingSettlement',
    label: '待退款',
    description: '当前经营导出已聚焦待退款订单，可直接核对已批准但尚未完成退款的风险单。',
    patch: {
      refundStatus: 'APPROVED',
    },
    matchesOrder: (order) => order.latestRefundStatus === 'APPROVED',
  },
  {
    preset: 'highRefundExposure',
    label: '高退款暴露',
    description: '当前经营导出已聚焦高退款暴露订单，可优先复盘退款金额较高的售后风险。',
    patch: {
      minRefundAmount: CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
    },
    matchesOrder: (order) =>
      toAmount(order.amountRefunded) >= CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  },
  {
    preset: 'repeatedComplaint',
    label: '重复投诉',
    description: '当前经营导出已聚焦重复投诉订单，可优先识别反复出现的争议模式。',
    patch: {
      minComplaintCount: CAREGIVER_REPEAT_COMPLAINT_COUNT,
    },
    matchesOrder: (order) => order.complaintCount >= CAREGIVER_REPEAT_COMPLAINT_COUNT,
  },
  {
    preset: 'repeatCaregiverComplaint',
    label: '照料者重复投诉',
    description: '当前经营导出已聚焦照料者重复投诉，可优先复盘同类服务质量风险。',
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

const caregiverRiskQueueExportPresetDefinitionMap = Object.fromEntries(
  caregiverRiskQueueExportPresetDefinitions.map((definition) => [definition.preset, definition] as const),
) as Record<CaregiverRiskQueueExportPreset, (typeof caregiverRiskQueueExportPresetDefinitions)[number]>;

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

export const getCaregiverRiskQueueExportPresetDefinition = (
  preset: CaregiverRiskQueueExportPreset,
) => caregiverRiskQueueExportPresetDefinitionMap[preset];

export const getCaregiverRiskQueueExportPresetLabel = (
  preset: CaregiverRiskQueueExportPreset,
) => getCaregiverRiskQueueExportPresetDefinition(preset)?.label ?? '待退款';

export const getCaregiverRiskQueueExportPresetDescription = (
  preset: CaregiverRiskQueueExportPreset,
) => getCaregiverRiskQueueExportPresetDefinition(preset)?.description
  ?? '当前经营导出已对齐到风险队列，可直接导出这一批同类风险明细。';

export const getCaregiverRiskQueueExportPresetPatch = (
  preset: CaregiverRiskQueueExportPreset,
) => getCaregiverRiskQueueExportPresetDefinition(preset)?.patch ?? {};
