import type {
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
import {
  toPetPalOptionalQueryValue,
  toPetPalOptionalTrimmedQueryText,
  toPetPalOptionalTrueFlag,
} from './export-query-values';
import { hasPetPalActiveFilters } from './export-filter-presence';

export type EarningsExportDatePreset = '' | 'last7days' | 'last30days' | 'thisMonth' | 'lastMonth';

export type CaregiverEarningsExportFilterSnapshot = {
  startDate: string;
  endDate: string;
  serviceType: PetServiceType | '';
  orderNoKeyword: string;
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

const caregiverEarningsExportSnapshotKeys = [
  'startDate',
  'endDate',
  'serviceType',
  'orderNoKeyword',
  'refundType',
  'refundStatus',
  'refundReasonKeyword',
  'complaintStatus',
  'complaintType',
  'complaintKeyword',
  'complaintTargetRole',
  'datePreset',
  'riskOnly',
] as const satisfies ReadonlyArray<keyof CaregiverEarningsExportFilterSnapshot>;

export const createEmptyCaregiverEarningsExportFilterSnapshot =
(): CaregiverEarningsExportFilterSnapshot => ({
  startDate: '',
  endDate: '',
  serviceType: '',
  orderNoKeyword: '',
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
  refundType: toPetPalOptionalQueryValue(snapshot.refundType),
  refundStatus: toPetPalOptionalQueryValue(snapshot.refundStatus),
  refundReasonKeyword: toPetPalOptionalTrimmedQueryText(snapshot.refundReasonKeyword),
  complaintStatus: toPetPalOptionalQueryValue(snapshot.complaintStatus),
  complaintType: toPetPalOptionalQueryValue(snapshot.complaintType),
  complaintKeyword: toPetPalOptionalTrimmedQueryText(snapshot.complaintKeyword),
  complaintTargetRole: toPetPalOptionalQueryValue(snapshot.complaintTargetRole),
  riskOnly: toPetPalOptionalTrueFlag(snapshot.riskOnly),
});
