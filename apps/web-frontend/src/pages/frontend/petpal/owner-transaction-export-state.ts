import type { OrderStatus, OwnerTransactionExportQuery, PetServiceType } from '@rbac/api-common';
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

export type OwnerTransactionExportFilterSnapshot = {
  startDate: string;
  endDate: string;
  serviceType: PetServiceType | '';
  orderStatus: OrderStatus | '';
  orderNoKeyword: string;
};

export type OwnerTransactionExportTemplate = OwnerTransactionExportFilterSnapshot & {
  name: string;
};

const ownerTransactionExportSnapshotKeys = [
  'startDate',
  'endDate',
  'serviceType',
  'orderStatus',
  'orderNoKeyword',
] as const satisfies ReadonlyArray<keyof OwnerTransactionExportFilterSnapshot>;

export const createEmptyOwnerTransactionExportFilterSnapshot =
(): OwnerTransactionExportFilterSnapshot => ({
  startDate: '',
  endDate: '',
  serviceType: '',
  orderStatus: '',
  orderNoKeyword: '',
});

export const cloneOwnerTransactionExportFilterSnapshot = (
  snapshot: OwnerTransactionExportFilterSnapshot,
): OwnerTransactionExportFilterSnapshot => clonePetPalExportSnapshot(
  snapshot,
  ownerTransactionExportSnapshotKeys,
);

export const applyOwnerTransactionExportFilterSnapshot = (
  target: OwnerTransactionExportFilterSnapshot,
  snapshot: OwnerTransactionExportFilterSnapshot,
) => applyPetPalExportSnapshot(target, snapshot, ownerTransactionExportSnapshotKeys);

export const parseOwnerTransactionExportDateRange = (
  snapshot: OwnerTransactionExportFilterSnapshot,
): [Date, Date] | null => parsePetPalExportDateRange(snapshot);

export const withOwnerTransactionExportDateRange = (
  snapshot: OwnerTransactionExportFilterSnapshot,
  value: [Date, Date] | null,
): OwnerTransactionExportFilterSnapshot => withPetPalExportDateRange(
  cloneOwnerTransactionExportFilterSnapshot(snapshot),
  value,
);

export const hasOwnerTransactionExportFilters = (
  snapshot: OwnerTransactionExportFilterSnapshot,
) => Boolean(
  snapshot.startDate
  || snapshot.endDate
  || snapshot.serviceType
  || snapshot.orderStatus
  || snapshot.orderNoKeyword.trim(),
);

export const buildOwnerTransactionExportQuery = (
  snapshot: OwnerTransactionExportFilterSnapshot,
): OwnerTransactionExportQuery => ({
  startDate: toPetPalOptionalQueryValue(snapshot.startDate),
  endDate: toPetPalOptionalQueryValue(snapshot.endDate),
  serviceType: toPetPalOptionalQueryValue(snapshot.serviceType),
  orderStatus: toPetPalOptionalQueryValue(snapshot.orderStatus),
  orderNoKeyword: toPetPalOptionalTrimmedQueryText(snapshot.orderNoKeyword),
});
