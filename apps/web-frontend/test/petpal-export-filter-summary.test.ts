import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCaregiverEarningsExportSummaryItems,
  buildOwnerRefundExportSummaryItems,
  buildOwnerTransactionExportSummaryItems,
  clearCaregiverEarningsExportSummaryItem,
  clearOwnerRefundExportSummaryItem,
  clearOwnerTransactionExportSummaryItem,
} from '../src/pages/frontend/petpal/export-filter-summary.ts';
import { createEmptyCaregiverEarningsExportFilterSnapshot } from '../src/pages/frontend/petpal/caregiver-earnings-export-state.ts';
import { createEmptyOwnerRefundExportFilterSnapshot } from '../src/pages/frontend/petpal/owner-refund-export-state.ts';
import { createEmptyOwnerTransactionExportFilterSnapshot } from '../src/pages/frontend/petpal/owner-transaction-export-state.ts';

test('builds and clears owner transaction export summary items', () => {
  const snapshot = createEmptyOwnerTransactionExportFilterSnapshot();
  snapshot.startDate = '2026-04-01';
  snapshot.endDate = '2026-04-03';
  snapshot.serviceType = 'BOARDING';
  snapshot.orderStatus = 'COMPLETED';
  snapshot.orderNoKeyword = ' ORDER-1001 ';

  assert.deepEqual(buildOwnerTransactionExportSummaryItems(snapshot), [
    { key: 'dateRange', label: '时间', value: '2026-04-01 至 2026-04-03' },
    { key: 'serviceType', label: '服务', value: '寄养' },
    { key: 'orderStatus', label: '订单状态', value: '已完成' },
    { key: 'orderNoKeyword', label: '订单号', value: 'ORDER-1001' },
  ]);

  clearOwnerTransactionExportSummaryItem(snapshot, 'dateRange');
  clearOwnerTransactionExportSummaryItem(snapshot, 'orderNoKeyword');

  assert.equal(snapshot.startDate, '');
  assert.equal(snapshot.endDate, '');
  assert.equal(snapshot.orderNoKeyword, '');
  assert.equal(snapshot.serviceType, 'BOARDING');
});

test('builds and clears owner refund export summary items', () => {
  const snapshot = createEmptyOwnerRefundExportFilterSnapshot();
  snapshot.startDate = '2026-03-01';
  snapshot.endDate = '2026-03-31';
  snapshot.serviceType = 'FEEDING';
  snapshot.orderNoKeyword = ' RF-9 ';
  snapshot.refundType = 'PARTIAL';
  snapshot.refundStatus = 'FAILED';
  snapshot.complaintStatus = 'PROCESSING';
  snapshot.complaintType = 'SERVICE';
  snapshot.complaintTargetRole = 'PLATFORM';

  assert.deepEqual(buildOwnerRefundExportSummaryItems(snapshot), [
    { key: 'dateRange', label: '时间', value: '2026-03-01 至 2026-03-31' },
    { key: 'serviceType', label: '服务', value: '喂养' },
    { key: 'orderNoKeyword', label: '订单号', value: 'RF-9' },
    { key: 'refundType', label: '退款类型', value: '部分退款' },
    { key: 'refundStatus', label: '退款状态', value: '退款失败' },
    { key: 'complaintStatus', label: '投诉状态', value: '处理中' },
    { key: 'complaintType', label: '投诉类型', value: '服务质量' },
    { key: 'complaintTargetRole', label: '责任角色', value: '平台' },
  ]);

  clearOwnerRefundExportSummaryItem(snapshot, 'refundType');
  clearOwnerRefundExportSummaryItem(snapshot, 'complaintTargetRole');

  assert.equal(snapshot.refundType, '');
  assert.equal(snapshot.complaintTargetRole, '');
  assert.equal(snapshot.refundStatus, 'FAILED');
});

test('builds and clears caregiver earnings export summary items', () => {
  const snapshot = createEmptyCaregiverEarningsExportFilterSnapshot();
  snapshot.startDate = '2026-03-28';
  snapshot.endDate = '2026-04-03';
  snapshot.datePreset = 'last7days';
  snapshot.serviceType = 'WALKING';
  snapshot.orderNoKeyword = ' CW-7 ';
  snapshot.refundType = 'FULL';
  snapshot.refundStatus = 'SUCCESS';
  snapshot.refundReasonKeyword = ' 提前结束 ';
  snapshot.complaintStatus = 'OPEN';
  snapshot.complaintType = 'FRAUD';
  snapshot.complaintKeyword = ' 迟到 ';
  snapshot.complaintTargetRole = 'CAREGIVER';
  snapshot.riskOnly = true;

  assert.deepEqual(buildCaregiverEarningsExportSummaryItems(snapshot), [
    { key: 'dateRange', label: '时间', value: '最近 7 天 · 2026-03-28 至 2026-04-03' },
    { key: 'serviceType', label: '服务', value: '遛宠' },
    { key: 'orderNoKeyword', label: '订单号', value: 'CW-7' },
    { key: 'refundType', label: '退款类型', value: '全额退款' },
    { key: 'refundStatus', label: '退款状态', value: '退款成功' },
    { key: 'refundReasonKeyword', label: '退款原因', value: '提前结束' },
    { key: 'complaintStatus', label: '投诉状态', value: '待受理' },
    { key: 'complaintType', label: '投诉类型', value: '欺诈风险' },
    { key: 'complaintKeyword', label: '投诉摘要', value: '迟到' },
    { key: 'complaintTargetRole', label: '责任角色', value: '照料者' },
    { key: 'riskOnly', label: '风险视角', value: '仅退款风险单' },
  ]);

  clearCaregiverEarningsExportSummaryItem(snapshot, 'dateRange');
  clearCaregiverEarningsExportSummaryItem(snapshot, 'riskOnly');
  clearCaregiverEarningsExportSummaryItem(snapshot, 'refundReasonKeyword');

  assert.equal(snapshot.startDate, '');
  assert.equal(snapshot.endDate, '');
  assert.equal(snapshot.datePreset, '');
  assert.equal(snapshot.riskOnly, false);
  assert.equal(snapshot.refundReasonKeyword, '');
  assert.equal(snapshot.complaintType, 'FRAUD');
});
