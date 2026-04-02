import type {
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  OwnerRefundExportQuery,
  PetServiceType,
  RefundStatus,
  RefundType,
} from '@rbac/api-common';

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
): OwnerRefundExportFilterSnapshot => ({
  startDate: snapshot.startDate,
  endDate: snapshot.endDate,
  refundType: snapshot.refundType,
  refundStatus: snapshot.refundStatus,
  complaintStatus: snapshot.complaintStatus,
  complaintType: snapshot.complaintType,
  complaintTargetRole: snapshot.complaintTargetRole,
  serviceType: snapshot.serviceType,
  orderNoKeyword: snapshot.orderNoKeyword,
});

export const applyOwnerRefundExportFilterSnapshot = (
  target: OwnerRefundExportFilterSnapshot,
  snapshot: OwnerRefundExportFilterSnapshot,
) => {
  target.startDate = snapshot.startDate;
  target.endDate = snapshot.endDate;
  target.refundType = snapshot.refundType;
  target.refundStatus = snapshot.refundStatus;
  target.complaintStatus = snapshot.complaintStatus;
  target.complaintType = snapshot.complaintType;
  target.complaintTargetRole = snapshot.complaintTargetRole;
  target.serviceType = snapshot.serviceType;
  target.orderNoKeyword = snapshot.orderNoKeyword;
  return target;
};

const parseOwnerRefundExportDate = (value: string) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseOwnerRefundExportDateRange = (
  snapshot: OwnerRefundExportFilterSnapshot,
): [Date, Date] | null => {
  const startDate = parseOwnerRefundExportDate(snapshot.startDate);
  const endDate = parseOwnerRefundExportDate(snapshot.endDate);
  return startDate && endDate ? [startDate, endDate] : null;
};

export const withOwnerRefundExportDateRange = (
  snapshot: OwnerRefundExportFilterSnapshot,
  value: [Date, Date] | null,
): OwnerRefundExportFilterSnapshot => ({
  ...cloneOwnerRefundExportFilterSnapshot(snapshot),
  startDate: value?.[0]?.toISOString() ?? '',
  endDate: value?.[1]?.toISOString() ?? '',
});

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
  startDate: snapshot.startDate || undefined,
  endDate: snapshot.endDate || undefined,
  refundType: snapshot.refundType || undefined,
  refundStatus: snapshot.refundStatus || undefined,
  complaintStatus: snapshot.complaintStatus || undefined,
  complaintType: snapshot.complaintType || undefined,
  complaintTargetRole: snapshot.complaintTargetRole || undefined,
  serviceType: snapshot.serviceType || undefined,
  orderNoKeyword: snapshot.orderNoKeyword.trim() || undefined,
});
