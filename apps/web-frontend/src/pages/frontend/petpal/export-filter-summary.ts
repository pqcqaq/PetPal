import type {
  CaregiverEarningsExportFilterSnapshot,
  EarningsExportDatePreset,
} from './caregiver-earnings-export-state';
import type { OwnerRefundExportFilterSnapshot } from './owner-refund-export-state';
import type { OwnerTransactionExportFilterSnapshot } from './owner-transaction-export-state';
import {
  applyCaregiverEarningsExportFilterSnapshot,
  cloneCaregiverEarningsExportFilterSnapshot,
} from './caregiver-earnings-export-state';
import {
  applyOwnerRefundExportFilterSnapshot,
  cloneOwnerRefundExportFilterSnapshot,
} from './owner-refund-export-state';
import {
  applyOwnerTransactionExportFilterSnapshot,
  cloneOwnerTransactionExportFilterSnapshot,
} from './owner-transaction-export-state';
import {
  formatPetPalDate,
  formatPetPalMoney,
  getPetPalComplaintSlaStatusLabel,
  getPetPalComplaintStatusLabel,
  getPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  petPalRefundStatusOptions,
  petPalRefundTypeOptions,
} from './shared';

export type PetPalExportSummaryItem<Key extends string = string> = {
  key: Key;
  label: string;
  value: string;
};

export type OwnerTransactionExportSummaryItemKey =
  | 'dateRange'
  | 'serviceType'
  | 'orderStatus'
  | 'orderNoKeyword';

export type OwnerRefundExportSummaryItemKey =
  | 'dateRange'
  | 'serviceType'
  | 'orderNoKeyword'
  | 'refundType'
  | 'refundStatus'
  | 'complaintStatus'
  | 'complaintType'
  | 'complaintTargetRole';

export type CaregiverEarningsExportSummaryItemKey =
  | 'dateRange'
  | 'serviceType'
  | 'orderNoKeyword'
  | 'minRefundAmount'
  | 'minComplaintCount'
  | 'refundType'
  | 'refundStatus'
  | 'refundReasonKeyword'
  | 'complaintStatus'
  | 'complaintSlaStatus'
  | 'complaintType'
  | 'complaintKeyword'
  | 'complaintTargetRole'
  | 'riskOnly';

const earningsDatePresetLabels: Record<Exclude<EarningsExportDatePreset, ''>, string> = {
  last7days: '最近 7 天',
  last30days: '最近 30 天',
  thisMonth: '本月',
  lastMonth: '上月',
};

const trimExportText = (value: string) => value.trim();

const findExportOptionLabel = <T extends string>(
  options: Array<{ label: string; value: T }>,
  value: T | '',
) => options.find((item) => item.value === value)?.label ?? value;

const formatExportDateRange = (startDate: string, endDate: string) => {
  const hasStartDate = Boolean(startDate);
  const hasEndDate = Boolean(endDate);

  if (!hasStartDate && !hasEndDate) {
    return '';
  }

  const startLabel = formatPetPalDate(startDate);
  const endLabel = formatPetPalDate(endDate);

  if (hasStartDate && hasEndDate) {
    return `${startLabel} 至 ${endLabel}`;
  }
  if (hasStartDate) {
    return `${startLabel} 起`;
  }
  return `截至 ${endLabel}`;
};

const formatCaregiverEarningsDateRange = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
) => {
  const rangeLabel = formatExportDateRange(snapshot.startDate, snapshot.endDate);
  const presetLabel = snapshot.datePreset ? earningsDatePresetLabels[snapshot.datePreset] : '';

  if (presetLabel && rangeLabel) {
    return `${presetLabel} · ${rangeLabel}`;
  }
  return presetLabel || rangeLabel;
};

export const buildOwnerTransactionExportSummaryItems = (
  snapshot: OwnerTransactionExportFilterSnapshot,
): Array<PetPalExportSummaryItem<OwnerTransactionExportSummaryItemKey>> => {
  const items: Array<PetPalExportSummaryItem<OwnerTransactionExportSummaryItemKey>> = [];
  const dateRange = formatExportDateRange(snapshot.startDate, snapshot.endDate);
  const orderNoKeyword = trimExportText(snapshot.orderNoKeyword);

  if (dateRange) {
    items.push({ key: 'dateRange', label: '时间', value: dateRange });
  }
  if (snapshot.serviceType) {
    items.push({
      key: 'serviceType',
      label: '服务',
      value: getPetPalServiceTypeLabel(snapshot.serviceType),
    });
  }
  if (snapshot.orderStatus) {
    items.push({
      key: 'orderStatus',
      label: '订单状态',
      value: getPetPalOrderStatusLabel(snapshot.orderStatus),
    });
  }
  if (orderNoKeyword) {
    items.push({ key: 'orderNoKeyword', label: '订单号', value: orderNoKeyword });
  }

  return items;
};

export const clearOwnerTransactionExportSummaryItem = (
  target: OwnerTransactionExportFilterSnapshot,
  key: OwnerTransactionExportSummaryItemKey,
) => {
  const nextSnapshot = cloneOwnerTransactionExportFilterSnapshot(target);

  switch (key) {
    case 'dateRange':
      nextSnapshot.startDate = '';
      nextSnapshot.endDate = '';
      break;
    case 'serviceType':
      nextSnapshot.serviceType = '';
      break;
    case 'orderStatus':
      nextSnapshot.orderStatus = '';
      break;
    case 'orderNoKeyword':
      nextSnapshot.orderNoKeyword = '';
      break;
  }

  applyOwnerTransactionExportFilterSnapshot(target, nextSnapshot);
};

export const buildOwnerRefundExportSummaryItems = (
  snapshot: OwnerRefundExportFilterSnapshot,
): Array<PetPalExportSummaryItem<OwnerRefundExportSummaryItemKey>> => {
  const items: Array<PetPalExportSummaryItem<OwnerRefundExportSummaryItemKey>> = [];
  const dateRange = formatExportDateRange(snapshot.startDate, snapshot.endDate);
  const orderNoKeyword = trimExportText(snapshot.orderNoKeyword);

  if (dateRange) {
    items.push({ key: 'dateRange', label: '时间', value: dateRange });
  }
  if (snapshot.serviceType) {
    items.push({
      key: 'serviceType',
      label: '服务',
      value: getPetPalServiceTypeLabel(snapshot.serviceType),
    });
  }
  if (orderNoKeyword) {
    items.push({ key: 'orderNoKeyword', label: '订单号', value: orderNoKeyword });
  }
  if (snapshot.refundType) {
    items.push({
      key: 'refundType',
      label: '退款类型',
      value: findExportOptionLabel(petPalRefundTypeOptions, snapshot.refundType),
    });
  }
  if (snapshot.refundStatus) {
    items.push({
      key: 'refundStatus',
      label: '退款状态',
      value: findExportOptionLabel(petPalRefundStatusOptions, snapshot.refundStatus),
    });
  }
  if (snapshot.complaintStatus) {
    items.push({
      key: 'complaintStatus',
      label: '投诉状态',
      value: getPetPalComplaintStatusLabel(snapshot.complaintStatus),
    });
  }
  if (snapshot.complaintType) {
    items.push({
      key: 'complaintType',
      label: '投诉类型',
      value: getPetPalComplaintTypeLabel(snapshot.complaintType),
    });
  }
  if (snapshot.complaintTargetRole) {
    items.push({
      key: 'complaintTargetRole',
      label: '责任角色',
      value: getPetPalComplaintTargetRoleLabel(snapshot.complaintTargetRole),
    });
  }

  return items;
};

export const clearOwnerRefundExportSummaryItem = (
  target: OwnerRefundExportFilterSnapshot,
  key: OwnerRefundExportSummaryItemKey,
) => {
  const nextSnapshot = cloneOwnerRefundExportFilterSnapshot(target);

  switch (key) {
    case 'dateRange':
      nextSnapshot.startDate = '';
      nextSnapshot.endDate = '';
      break;
    case 'serviceType':
      nextSnapshot.serviceType = '';
      break;
    case 'orderNoKeyword':
      nextSnapshot.orderNoKeyword = '';
      break;
    case 'refundType':
      nextSnapshot.refundType = '';
      break;
    case 'refundStatus':
      nextSnapshot.refundStatus = '';
      break;
    case 'complaintStatus':
      nextSnapshot.complaintStatus = '';
      break;
    case 'complaintType':
      nextSnapshot.complaintType = '';
      break;
    case 'complaintTargetRole':
      nextSnapshot.complaintTargetRole = '';
      break;
  }

  applyOwnerRefundExportFilterSnapshot(target, nextSnapshot);
};

export const buildCaregiverEarningsExportSummaryItems = (
  snapshot: CaregiverEarningsExportFilterSnapshot,
): Array<PetPalExportSummaryItem<CaregiverEarningsExportSummaryItemKey>> => {
  const items: Array<PetPalExportSummaryItem<CaregiverEarningsExportSummaryItemKey>> = [];
  const dateRange = formatCaregiverEarningsDateRange(snapshot);
  const orderNoKeyword = trimExportText(snapshot.orderNoKeyword);
  const refundReasonKeyword = trimExportText(snapshot.refundReasonKeyword);
  const complaintKeyword = trimExportText(snapshot.complaintKeyword);

  if (dateRange) {
    items.push({ key: 'dateRange', label: '时间', value: dateRange });
  }
  if (snapshot.serviceType) {
    items.push({
      key: 'serviceType',
      label: '服务',
      value: getPetPalServiceTypeLabel(snapshot.serviceType),
    });
  }
  if (orderNoKeyword) {
    items.push({ key: 'orderNoKeyword', label: '订单号', value: orderNoKeyword });
  }
  if (snapshot.minRefundAmount != null) {
    items.push({
      key: 'minRefundAmount',
      label: '退款门槛',
      value: `${formatPetPalMoney(snapshot.minRefundAmount)} 起`,
    });
  }
  if (snapshot.minComplaintCount != null) {
    items.push({
      key: 'minComplaintCount',
      label: '投诉门槛',
      value: `${snapshot.minComplaintCount} 条起`,
    });
  }
  if (snapshot.refundType) {
    items.push({
      key: 'refundType',
      label: '退款类型',
      value: findExportOptionLabel(petPalRefundTypeOptions, snapshot.refundType),
    });
  }
  if (snapshot.refundStatus) {
    items.push({
      key: 'refundStatus',
      label: '退款状态',
      value: findExportOptionLabel(petPalRefundStatusOptions, snapshot.refundStatus),
    });
  }
  if (refundReasonKeyword) {
    items.push({
      key: 'refundReasonKeyword',
      label: '退款原因',
      value: refundReasonKeyword,
    });
  }
  if (snapshot.complaintStatus) {
    items.push({
      key: 'complaintStatus',
      label: '投诉状态',
      value: getPetPalComplaintStatusLabel(snapshot.complaintStatus),
    });
  }
  if (snapshot.complaintSlaStatus) {
    items.push({
      key: 'complaintSlaStatus',
      label: '投诉SLA',
      value: getPetPalComplaintSlaStatusLabel(snapshot.complaintSlaStatus),
    });
  }
  if (snapshot.complaintType) {
    items.push({
      key: 'complaintType',
      label: '投诉类型',
      value: getPetPalComplaintTypeLabel(snapshot.complaintType),
    });
  }
  if (complaintKeyword) {
    items.push({
      key: 'complaintKeyword',
      label: '投诉摘要',
      value: complaintKeyword,
    });
  }
  if (snapshot.complaintTargetRole) {
    items.push({
      key: 'complaintTargetRole',
      label: '责任角色',
      value: getPetPalComplaintTargetRoleLabel(snapshot.complaintTargetRole),
    });
  }
  if (snapshot.riskOnly) {
    items.push({
      key: 'riskOnly',
      label: '风险视角',
      value: '仅退款风险单',
    });
  }

  return items;
};

export const clearCaregiverEarningsExportSummaryItem = (
  target: CaregiverEarningsExportFilterSnapshot,
  key: CaregiverEarningsExportSummaryItemKey,
) => {
  const nextSnapshot = cloneCaregiverEarningsExportFilterSnapshot(target);

  switch (key) {
    case 'dateRange':
      nextSnapshot.startDate = '';
      nextSnapshot.endDate = '';
      nextSnapshot.datePreset = '';
      break;
    case 'serviceType':
      nextSnapshot.serviceType = '';
      break;
    case 'orderNoKeyword':
      nextSnapshot.orderNoKeyword = '';
      break;
    case 'minRefundAmount':
      nextSnapshot.minRefundAmount = null;
      break;
    case 'minComplaintCount':
      nextSnapshot.minComplaintCount = null;
      break;
    case 'refundType':
      nextSnapshot.refundType = '';
      break;
    case 'refundStatus':
      nextSnapshot.refundStatus = '';
      break;
    case 'refundReasonKeyword':
      nextSnapshot.refundReasonKeyword = '';
      break;
    case 'complaintStatus':
      nextSnapshot.complaintStatus = '';
      break;
    case 'complaintSlaStatus':
      nextSnapshot.complaintSlaStatus = '';
      break;
    case 'complaintType':
      nextSnapshot.complaintType = '';
      break;
    case 'complaintKeyword':
      nextSnapshot.complaintKeyword = '';
      break;
    case 'complaintTargetRole':
      nextSnapshot.complaintTargetRole = '';
      break;
    case 'riskOnly':
      nextSnapshot.riskOnly = false;
      break;
  }

  applyCaregiverEarningsExportFilterSnapshot(target, nextSnapshot);
};
