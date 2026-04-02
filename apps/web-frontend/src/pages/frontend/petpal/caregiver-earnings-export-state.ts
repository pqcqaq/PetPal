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
) => Boolean(
  snapshot.startDate
  || snapshot.endDate
  || snapshot.serviceType
  || snapshot.orderNoKeyword.trim()
  || snapshot.refundType
  || snapshot.refundStatus
  || snapshot.refundReasonKeyword.trim()
  || snapshot.complaintStatus
  || snapshot.complaintType
  || snapshot.complaintKeyword.trim()
  || snapshot.complaintTargetRole
  || snapshot.riskOnly,
);

export const buildCaregiverEarningsExportQuery = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
): CaregiverEarningsExportQuery => ({
  startDate: snapshot.startDate || undefined,
  endDate: snapshot.endDate || undefined,
  serviceType: snapshot.serviceType || undefined,
  orderNoKeyword: snapshot.orderNoKeyword.trim() || undefined,
  refundType: snapshot.refundType || undefined,
  refundStatus: snapshot.refundStatus || undefined,
  refundReasonKeyword: snapshot.refundReasonKeyword.trim() || undefined,
  complaintStatus: snapshot.complaintStatus || undefined,
  complaintType: snapshot.complaintType || undefined,
  complaintKeyword: snapshot.complaintKeyword.trim() || undefined,
  complaintTargetRole: snapshot.complaintTargetRole || undefined,
  riskOnly: snapshot.riskOnly || undefined,
});
