import assert from 'node:assert/strict';
import test from 'node:test';
import type { CaregiverAftersalesRiskOrderRecord } from '@rbac/api-common';
import {
  countCaregiverRiskQueueExportPresets,
  createCaregiverRiskQueueExportPresetCountMap,
} from '../src/pages/frontend/petpal/caregiver-risk-queue-preset-config.ts';
import {
  buildCaregiverRiskQueueExportActions,
  getCaregiverRiskQueueExportPresetDescription,
  getCaregiverRiskQueueExportPresetLabel,
} from '../src/pages/frontend/petpal/caregiver-risk-queue-export.ts';

const createRiskOrder = (
  overrides: Partial<CaregiverAftersalesRiskOrderRecord> = {},
): CaregiverAftersalesRiskOrderRecord => ({
  id: 'risk-order-1',
  orderNo: 'PP-20260403-001',
  serviceType: 'BOARDING',
  appointmentStart: '2026-04-03T08:00:00.000Z',
  appointmentEnd: '2026-04-03T12:00:00.000Z',
  amountPaid: 280,
  amountRefunded: 0,
  orderStatus: 'DISPUTED',
  ownerNickname: '主人A',
  petName: '可乐',
  locationText: '上海市静安区',
  latestRefundStatus: null,
  latestRefundAmount: null,
  complaintCount: 0,
  primaryComplaintStatus: null,
  primaryComplaintSlaStatus: null,
  primaryComplaintSlaDeadlineAt: null,
  primaryComplaintTargetRole: null,
  primaryComplaintType: null,
  ...overrides,
});

const riskQueueOrders = [
  createRiskOrder({
    id: 'risk-order-open-repeat-caregiver',
    complaintCount: 3,
    primaryComplaintStatus: 'OPEN',
    primaryComplaintSlaStatus: 'OVERDUE',
    primaryComplaintTargetRole: 'CAREGIVER',
    amountRefunded: 120,
    latestRefundStatus: 'APPROVED',
    latestRefundAmount: 120,
  }),
  createRiskOrder({
    id: 'risk-order-processing-platform',
    complaintCount: 1,
    primaryComplaintStatus: 'PROCESSING',
    primaryComplaintTargetRole: 'PLATFORM',
  }),
  createRiskOrder({
    id: 'risk-order-due-soon',
    complaintCount: 1,
    primaryComplaintStatus: 'OPEN',
    primaryComplaintSlaStatus: 'DUE_SOON',
  }),
  createRiskOrder({
    id: 'risk-order-repeat-only',
    complaintCount: 2,
    primaryComplaintStatus: 'RESOLVED',
    primaryComplaintTargetRole: 'CAREGIVER',
  }),
];

test('counts caregiver risk queue presets with a shared preset map', () => {
  assert.deepEqual(createCaregiverRiskQueueExportPresetCountMap(), {
    openComplaint: 0,
    openRepeatedComplaint: 0,
    overdueComplaint: 0,
    dueSoonComplaint: 0,
    processingComplaint: 0,
    caregiverResponsibility: 0,
    platformResponsibility: 0,
    refundAwaitingSettlement: 0,
    highRefundExposure: 0,
    repeatedComplaint: 0,
    repeatCaregiverComplaint: 0,
  });

  assert.deepEqual(countCaregiverRiskQueueExportPresets(riskQueueOrders), {
    openComplaint: 2,
    openRepeatedComplaint: 1,
    overdueComplaint: 1,
    dueSoonComplaint: 1,
    processingComplaint: 1,
    caregiverResponsibility: 2,
    platformResponsibility: 1,
    refundAwaitingSettlement: 1,
    highRefundExposure: 1,
    repeatedComplaint: 2,
    repeatCaregiverComplaint: 2,
  });
});

test('builds caregiver risk queue export actions in stable preset order', () => {
  const actions = buildCaregiverRiskQueueExportActions(riskQueueOrders);

  assert.deepEqual(actions, [
    { preset: 'openComplaint', label: '待受理投诉', count: 2 },
    { preset: 'openRepeatedComplaint', label: '待受理重复投诉', count: 1 },
    { preset: 'overdueComplaint', label: '已超时投诉', count: 1 },
    { preset: 'dueSoonComplaint', label: '即将超时投诉', count: 1 },
    { preset: 'processingComplaint', label: '处理中投诉', count: 1 },
    { preset: 'caregiverResponsibility', label: '照料者责任', count: 2 },
    { preset: 'platformResponsibility', label: '平台责任', count: 1 },
    { preset: 'refundAwaitingSettlement', label: '待退款', count: 1 },
    { preset: 'highRefundExposure', label: '高退款暴露', count: 1 },
    { preset: 'repeatedComplaint', label: '重复投诉', count: 2 },
    { preset: 'repeatCaregiverComplaint', label: '照料者重复投诉', count: 2 },
  ]);
});

test('returns caregiver risk queue preset labels for composite views', () => {
  assert.equal(getCaregiverRiskQueueExportPresetLabel('openComplaint'), '待受理投诉');
  assert.equal(getCaregiverRiskQueueExportPresetLabel('openRepeatedComplaint'), '待受理重复投诉');
  assert.equal(getCaregiverRiskQueueExportPresetLabel('overdueComplaint'), '已超时投诉');
  assert.equal(getCaregiverRiskQueueExportPresetLabel('dueSoonComplaint'), '即将超时投诉');
  assert.equal(
    getCaregiverRiskQueueExportPresetLabel('repeatCaregiverComplaint'),
    '照料者重复投诉',
  );
  assert.equal(getCaregiverRiskQueueExportPresetLabel('refundAwaitingSettlement'), '待退款');
});

test('returns caregiver risk queue preset descriptions for active queue views', () => {
  assert.equal(
    getCaregiverRiskQueueExportPresetDescription('openRepeatedComplaint'),
    '当前经营导出已聚焦待受理且已重复出现的投诉，可优先处理高复发风险订单。',
  );
  assert.equal(
    getCaregiverRiskQueueExportPresetDescription('overdueComplaint'),
    '当前经营导出已聚焦投诉 SLA 已超时的风险单，可优先补救长期未结案争议。',
  );
  assert.equal(
    getCaregiverRiskQueueExportPresetDescription('dueSoonComplaint'),
    '当前经营导出已聚焦投诉 SLA 即将超时的风险单，可优先提前介入避免争议超时。',
  );
  assert.equal(
    getCaregiverRiskQueueExportPresetDescription('repeatCaregiverComplaint'),
    '当前经营导出已聚焦照料者重复投诉，可优先复盘同类服务质量风险。',
  );
  assert.equal(
    getCaregiverRiskQueueExportPresetDescription('refundAwaitingSettlement'),
    '当前经营导出已聚焦待退款订单，可直接核对已批准但尚未完成退款的风险单。',
  );
});
