import type {
  CaregiverAftersalesRiskOrderRecord,
  CaregiverEarningsExportQuery,
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  PetServiceType,
  RefundStatus,
  RefundType,
} from '@rbac/api-common';
import {
  parsePetPalExportDateRange,
  withPetPalExportDateRange,
} from './export-date-range';
import {
  applyPetPalExportSnapshot,
  clonePetPalExportSnapshot,
} from './export-snapshot-helpers';
import { definePetPalExportSnapshot } from './export-snapshot-definition';
import {
  toPetPalOptionalQueryValue,
  toPetPalOptionalTrimmedQueryText,
  toPetPalOptionalTrueFlag,
} from './export-query-values';
import { hasPetPalActiveFilters } from './export-filter-presence';
import {
  caregiverRiskQueueExportPresets,
  getCaregiverRiskQueueExportPresetPatch,
  CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  CAREGIVER_REPEAT_COMPLAINT_COUNT,
  type CaregiverRiskQueueExportPreset,
} from './caregiver-risk-queue-preset-config';

export type EarningsExportDatePreset = '' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth';
export {
  CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  CAREGIVER_REPEAT_COMPLAINT_COUNT,
};
export type { CaregiverRiskQueueExportPreset };

export type CaregiverEarningsExportFilterSnapshot = {
  startDate: string;
  endDate: string;
  serviceType: PetServiceType | '';
  orderNoKeyword: string;
  minRefundAmount: number | null;
  minComplaintCount: number | null;
  refundType: RefundType | '';
  refundStatus: RefundStatus | '';
  refundReasonKeyword: string;
  complaintStatus: ComplaintStatus | '';
  complaintType: ComplaintType | '';
  complaintKeyword: string;
  complaintTargetRole: ComplaintTargetRole | '';
  datePreset: EarningsExportDatePreset;
  riskOnly: boolean;
};

export type CaregiverEarningsExportTemplate = CaregiverEarningsExportFilterSnapshot & {
  name: string;
};

const caregiverEarningsExportSnapshot = definePetPalExportSnapshot<CaregiverEarningsExportFilterSnapshot>({
  startDate: '',
  endDate: '',
  serviceType: '',
  orderNoKeyword: '',
  minRefundAmount: null,
  minComplaintCount: null,
  refundType: '',
  refundStatus: '',
  refundReasonKeyword: '',
  complaintStatus: '',
  complaintType: '',
  complaintKeyword: '',
  complaintTargetRole: '',
  datePreset: '',
  riskOnly: false,
});

const caregiverEarningsExportSnapshotKeys = caregiverEarningsExportSnapshot.keys;

export const createEmptyCaregiverEarningsExportFilterSnapshot =
(): CaregiverEarningsExportFilterSnapshot => caregiverEarningsExportSnapshot.createEmpty();

export const cloneCaregiverEarningsExportFilterSnapshot = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
): CaregiverEarningsExportFilterSnapshot => clonePetPalExportSnapshot(
  snapshot,
  caregiverEarningsExportSnapshotKeys,
);

export const applyCaregiverEarningsExportFilterSnapshot = (
  target: CaregiverEarningsExportFilterSnapshot,
  snapshot: CaregiverEarningsExportFilterSnapshot,
) => applyPetPalExportSnapshot(target, snapshot, caregiverEarningsExportSnapshotKeys);

export const parseCaregiverEarningsExportDateRange = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
): [Date, Date] | null => parsePetPalExportDateRange(snapshot);

export const withCaregiverEarningsExportDateRange = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
  value: [Date, Date] | null,
): CaregiverEarningsExportFilterSnapshot => withPetPalExportDateRange(
  cloneCaregiverEarningsExportFilterSnapshot(snapshot),
  value,
);

export const hasCaregiverEarningsExportFilters = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
) => hasPetPalActiveFilters(
  snapshot.startDate,
  snapshot.endDate,
  snapshot.serviceType,
  snapshot.orderNoKeyword,
  snapshot.minRefundAmount,
  snapshot.minComplaintCount,
  snapshot.refundType,
  snapshot.refundStatus,
  snapshot.refundReasonKeyword,
  snapshot.complaintStatus,
  snapshot.complaintType,
  snapshot.complaintKeyword,
  snapshot.complaintTargetRole,
  snapshot.riskOnly,
);

export const buildCaregiverEarningsExportQuery = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
): CaregiverEarningsExportQuery => ({
  startDate: toPetPalOptionalQueryValue(snapshot.startDate),
  endDate: toPetPalOptionalQueryValue(snapshot.endDate),
  serviceType: toPetPalOptionalQueryValue(snapshot.serviceType),
  orderNoKeyword: toPetPalOptionalTrimmedQueryText(snapshot.orderNoKeyword),
  minRefundAmount: toPetPalOptionalQueryValue(snapshot.minRefundAmount),
  minComplaintCount: toPetPalOptionalQueryValue(snapshot.minComplaintCount),
  refundType: toPetPalOptionalQueryValue(snapshot.refundType),
  refundStatus: toPetPalOptionalQueryValue(snapshot.refundStatus),
  refundReasonKeyword: toPetPalOptionalTrimmedQueryText(snapshot.refundReasonKeyword),
  complaintStatus: toPetPalOptionalQueryValue(snapshot.complaintStatus),
  complaintType: toPetPalOptionalQueryValue(snapshot.complaintType),
  complaintKeyword: toPetPalOptionalTrimmedQueryText(snapshot.complaintKeyword),
  complaintTargetRole: toPetPalOptionalQueryValue(snapshot.complaintTargetRole),
  riskOnly: toPetPalOptionalTrueFlag(snapshot.riskOnly),
});

export const buildCaregiverRiskOrderExportSnapshot = (
  currentSnapshot: CaregiverEarningsExportFilterSnapshot,
  order: Pick<
    CaregiverAftersalesRiskOrderRecord,
    | 'serviceType'
    | 'latestRefundStatus'
    | 'primaryComplaintStatus'
    | 'primaryComplaintType'
    | 'primaryComplaintTargetRole'
  >,
): CaregiverEarningsExportFilterSnapshot => ({
  ...createEmptyCaregiverEarningsExportFilterSnapshot(),
  startDate: currentSnapshot.startDate,
  endDate: currentSnapshot.endDate,
  datePreset: currentSnapshot.datePreset,
  serviceType: order.serviceType,
  refundStatus: order.latestRefundStatus ?? '',
  complaintStatus: order.primaryComplaintStatus ?? '',
  complaintType: order.primaryComplaintType ?? '',
  complaintTargetRole: order.primaryComplaintTargetRole ?? '',
  riskOnly: true,
});

export const buildCaregiverAllRiskExportSnapshot = (
  currentSnapshot: CaregiverEarningsExportFilterSnapshot,
): CaregiverEarningsExportFilterSnapshot => ({
  ...createEmptyCaregiverEarningsExportFilterSnapshot(),
  startDate: currentSnapshot.startDate,
  endDate: currentSnapshot.endDate,
  datePreset: currentSnapshot.datePreset,
  riskOnly: true,
});

const matchesCaregiverEarningsExportSnapshot = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
  candidate: CaregiverEarningsExportFilterSnapshot,
) => caregiverEarningsExportSnapshotKeys.every((key) => snapshot[key] === candidate[key]);

export const isCaregiverAllRiskExportSnapshot = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
) => matchesCaregiverEarningsExportSnapshot(
  snapshot,
  buildCaregiverAllRiskExportSnapshot(snapshot),
);

export const buildCaregiverRiskQueueExportSnapshot = (
  currentSnapshot: CaregiverEarningsExportFilterSnapshot,
  preset: CaregiverRiskQueueExportPreset,
): CaregiverEarningsExportFilterSnapshot => {
  const baseSnapshot = buildCaregiverAllRiskExportSnapshot(currentSnapshot);
  return {
    ...baseSnapshot,
    ...getCaregiverRiskQueueExportPresetPatch(preset),
  };
};

export const resolveCaregiverRiskQueueExportPreset = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
): CaregiverRiskQueueExportPreset | '' => {
  for (const preset of caregiverRiskQueueExportPresets) {
    if (
      matchesCaregiverEarningsExportSnapshot(
        snapshot,
        buildCaregiverRiskQueueExportSnapshot(snapshot, preset),
      )
    ) {
      return preset;
    }
  }

  return '';
};
