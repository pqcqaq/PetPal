import type {
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  OwnerRefundExportQuery,
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
} from './export-query-values';

export type OwnerRefundExportFilterSnapshot = {
  startDate: string;
  endDate: string;
  refundType: RefundType | '';
  refundStatus: RefundStatus | '';
  complaintStatus: ComplaintStatus | '';
  complaintType: ComplaintType | '';
  complaintTargetRole: ComplaintTargetRole | '';
  serviceType: PetServiceType | '';
  orderNoKeyword: string;
};

export type OwnerRefundExportTemplate = OwnerRefundExportFilterSnapshot & {
  name: string;
};

const ownerRefundExportSnapshotKeys = [
  'startDate',
  'endDate',
  'refundType',
  'refundStatus',
  'complaintStatus',
  'complaintType',
  'complaintTargetRole',
  'serviceType',
  'orderNoKeyword',
] as const satisfies ReadonlyArray<keyof OwnerRefundExportFilterSnapshot>;

export const createEmptyOwnerRefundExportFilterSnapshot = (): OwnerRefundExportFilterSnapshot => ({
  startDate: '',
  endDate: '',
  refundType: '',
  refundStatus: '',
  complaintStatus: '',
  complaintType: '',
  complaintTargetRole: '',
  serviceType: '',
  orderNoKeyword: '',
});

export const cloneOwnerRefundExportFilterSnapshot = (
  snapshot: OwnerRefundExportFilterSnapshot,
): OwnerRefundExportFilterSnapshot => clonePetPalExportSnapshot(
  snapshot,
  ownerRefundExportSnapshotKeys,
);

export const applyOwnerRefundExportFilterSnapshot = (
  target: OwnerRefundExportFilterSnapshot,
  snapshot: OwnerRefundExportFilterSnapshot,
) => applyPetPalExportSnapshot(target, snapshot, ownerRefundExportSnapshotKeys);

export const parseOwnerRefundExportDateRange = (
  snapshot: OwnerRefundExportFilterSnapshot,
): [Date, Date] | null => parsePetPalExportDateRange(snapshot);

export const withOwnerRefundExportDateRange = (
  snapshot: OwnerRefundExportFilterSnapshot,
  value: [Date, Date] | null,
): OwnerRefundExportFilterSnapshot => withPetPalExportDateRange(
  cloneOwnerRefundExportFilterSnapshot(snapshot),
  value,
);

export const hasOwnerRefundExportFilters = (snapshot: OwnerRefundExportFilterSnapshot) => Boolean(
  snapshot.startDate
  || snapshot.endDate
  || snapshot.refundType
  || snapshot.refundStatus
  || snapshot.complaintStatus
  || snapshot.complaintType
  || snapshot.complaintTargetRole
  || snapshot.serviceType
  || snapshot.orderNoKeyword.trim(),
);

export const buildOwnerRefundExportQuery = (
  snapshot: OwnerRefundExportFilterSnapshot,
): OwnerRefundExportQuery => ({
  startDate: toPetPalOptionalQueryValue(snapshot.startDate),
  endDate: toPetPalOptionalQueryValue(snapshot.endDate),
  refundType: toPetPalOptionalQueryValue(snapshot.refundType),
  refundStatus: toPetPalOptionalQueryValue(snapshot.refundStatus),
  complaintStatus: toPetPalOptionalQueryValue(snapshot.complaintStatus),
  complaintType: toPetPalOptionalQueryValue(snapshot.complaintType),
  complaintTargetRole: toPetPalOptionalQueryValue(snapshot.complaintTargetRole),
  serviceType: toPetPalOptionalQueryValue(snapshot.serviceType),
  orderNoKeyword: toPetPalOptionalTrimmedQueryText(snapshot.orderNoKeyword),
});
