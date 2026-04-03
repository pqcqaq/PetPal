import type { CaregiverAftersalesRiskOrderRecord } from '@rbac/api-common';
import {
  CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  CAREGIVER_REPEAT_COMPLAINT_COUNT,
  type CaregiverRiskQueueExportPreset,
} from './caregiver-earnings-export-state';

export type CaregiverRiskQueueExportAction = {
  preset: CaregiverRiskQueueExportPreset;
  label: string;
  count: number;
};

const caregiverRiskQueueExportPresetOrder: CaregiverRiskQueueExportPreset[] = [
  'openComplaint',
  'openRepeatedComplaint',
  'processingComplaint',
  'caregiverResponsibility',
  'platformResponsibility',
  'refundAwaitingSettlement',
  'highRefundExposure',
  'repeatedComplaint',
  'repeatCaregiverComplaint',
];

const toAmount = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getCaregiverRiskQueueExportPresetLabel = (
  preset: CaregiverRiskQueueExportPreset,
) => {
  if (preset === 'openComplaint') {
    return '待受理投诉';
  }
  if (preset === 'openRepeatedComplaint') {
    return '待受理重复投诉';
  }
  if (preset === 'processingComplaint') {
    return '处理中投诉';
  }
  if (preset === 'caregiverResponsibility') {
    return '照料者责任';
  }
  if (preset === 'platformResponsibility') {
    return '平台责任';
  }
  if (preset === 'highRefundExposure') {
    return '高退款暴露';
  }
  if (preset === 'repeatedComplaint') {
    return '重复投诉';
  }
  if (preset === 'repeatCaregiverComplaint') {
    return '照料者重复投诉';
  }
  return '待退款';
};

export const buildCaregiverRiskQueueExportActions = (
  orders: CaregiverAftersalesRiskOrderRecord[],
): CaregiverRiskQueueExportAction[] => {
  const counts: Record<CaregiverRiskQueueExportPreset, number> = {
    openComplaint: 0,
    openRepeatedComplaint: 0,
    processingComplaint: 0,
    caregiverResponsibility: 0,
    platformResponsibility: 0,
    refundAwaitingSettlement: 0,
    highRefundExposure: 0,
    repeatedComplaint: 0,
    repeatCaregiverComplaint: 0,
  };

  for (const order of orders) {
    if (order.primaryComplaintStatus === 'OPEN') {
      counts.openComplaint += 1;
      if (order.complaintCount >= CAREGIVER_REPEAT_COMPLAINT_COUNT) {
        counts.openRepeatedComplaint += 1;
      }
    }

    if (order.primaryComplaintStatus === 'PROCESSING') {
      counts.processingComplaint += 1;
    }

    if (order.primaryComplaintTargetRole === 'CAREGIVER') {
      counts.caregiverResponsibility += 1;
    }

    if (order.primaryComplaintTargetRole === 'PLATFORM') {
      counts.platformResponsibility += 1;
    }

    if (order.latestRefundStatus === 'APPROVED') {
      counts.refundAwaitingSettlement += 1;
    }

    if (toAmount(order.amountRefunded) >= CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT) {
      counts.highRefundExposure += 1;
    }

    if (order.complaintCount >= CAREGIVER_REPEAT_COMPLAINT_COUNT) {
      counts.repeatedComplaint += 1;
      if (order.primaryComplaintTargetRole === 'CAREGIVER') {
        counts.repeatCaregiverComplaint += 1;
      }
    }
  }

  return caregiverRiskQueueExportPresetOrder
    .map((preset) => ({
      preset,
      label: getCaregiverRiskQueueExportPresetLabel(preset),
      count: counts[preset],
    }))
    .filter((item) => item.count > 0);
};
