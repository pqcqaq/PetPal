import type { OrderStatus, OwnerTransactionExportQuery, PetServiceType } from '@rbac/api-common';
import {
  parsePetPalExportDateRange,
  withPetPalExportDateRange,
} from './export-date-range';

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
): OwnerTransactionExportFilterSnapshot => ({
  startDate: snapshot.startDate,
  endDate: snapshot.endDate,
  serviceType: snapshot.serviceType,
  orderStatus: snapshot.orderStatus,
  orderNoKeyword: snapshot.orderNoKeyword,
});

export const applyOwnerTransactionExportFilterSnapshot = (
  target: OwnerTransactionExportFilterSnapshot,
  snapshot: OwnerTransactionExportFilterSnapshot,
) => {
  target.startDate = snapshot.startDate;
  target.endDate = snapshot.endDate;
  target.serviceType = snapshot.serviceType;
  target.orderStatus = snapshot.orderStatus;
  target.orderNoKeyword = snapshot.orderNoKeyword;
  return target;
};

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
  startDate: snapshot.startDate || undefined,
  endDate: snapshot.endDate || undefined,
  serviceType: snapshot.serviceType || undefined,
  orderStatus: snapshot.orderStatus || undefined,
  orderNoKeyword: snapshot.orderNoKeyword.trim() || undefined,
});
