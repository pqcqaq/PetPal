import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCaregiverEarningsExportFilterSnapshot,
  buildCaregiverRiskOrderExportSnapshot,
  buildCaregiverEarningsExportQuery,
  cloneCaregiverEarningsExportFilterSnapshot,
  createEmptyCaregiverEarningsExportFilterSnapshot,
  hasCaregiverEarningsExportFilters,
  parseCaregiverEarningsExportDateRange,
  withCaregiverEarningsExportDateRange,
} from '../src/pages/frontend/petpal/caregiver-earnings-export-state.ts';

test('creates, clones, and applies caregiver earnings export snapshots', () => {
  const emptySnapshot = createEmptyCaregiverEarningsExportFilterSnapshot();
  const nextSnapshot = {
    ...emptySnapshot,
    serviceType: 'BOARDING' as const,
    refundType: 'PARTIAL' as const,
    complaintType: 'SERVICE' as const,
    complaintTargetRole: 'PLATFORM' as const,
    datePreset: 'last30days' as const,
    riskOnly: true,
  };

  const clonedSnapshot = cloneCaregiverEarningsExportFilterSnapshot(nextSnapshot);
  assert.deepEqual(clonedSnapshot, nextSnapshot);
  assert.notEqual(clonedSnapshot, nextSnapshot);

  const targetSnapshot = createEmptyCaregiverEarningsExportFilterSnapshot();
  applyCaregiverEarningsExportFilterSnapshot(targetSnapshot, nextSnapshot);
  assert.deepEqual(targetSnapshot, nextSnapshot);
});

test('parses caregiver earnings date ranges and detects active filters', () => {
  const emptySnapshot = createEmptyCaregiverEarningsExportFilterSnapshot();
  assert.equal(parseCaregiverEarningsExportDateRange(emptySnapshot), null);
  assert.equal(hasCaregiverEarningsExportFilters(emptySnapshot), false);

  const nextSnapshot = withCaregiverEarningsExportDateRange(emptySnapshot, [
    new Date('2026-04-01T00:00:00.000Z'),
    new Date('2026-04-03T23:59:59.999Z'),
  ]);

  const parsedRange = parseCaregiverEarningsExportDateRange(nextSnapshot);
  assert.equal(parsedRange?.[0]?.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(parsedRange?.[1]?.toISOString(), '2026-04-03T23:59:59.999Z');
  assert.equal(hasCaregiverEarningsExportFilters(nextSnapshot), true);

  const clearedSnapshot = withCaregiverEarningsExportDateRange(nextSnapshot, null);
  assert.equal(clearedSnapshot.startDate, '');
  assert.equal(clearedSnapshot.endDate, '');
});

test('builds caregiver earnings export query payloads without leaking empty values', () => {
  const snapshot = {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    serviceType: 'WALKING' as const,
    orderNoKeyword: '  earning-order-9  ',
    refundStatus: 'SUCCESS' as const,
    refundReasonKeyword: '  late arrival  ',
    complaintStatus: 'PROCESSING' as const,
    complaintKeyword: '  follow up  ',
    complaintTargetRole: 'CAREGIVER' as const,
    riskOnly: true,
  };

  assert.deepEqual(buildCaregiverEarningsExportQuery(snapshot), {
    startDate: undefined,
    endDate: undefined,
    serviceType: 'WALKING',
    orderNoKeyword: 'earning-order-9',
    refundType: undefined,
    refundStatus: 'SUCCESS',
    refundReasonKeyword: 'late arrival',
    complaintStatus: 'PROCESSING',
    complaintType: undefined,
    complaintKeyword: 'follow up',
    complaintTargetRole: 'CAREGIVER',
    riskOnly: true,
  });
});

test('builds caregiver risk order export snapshots while preserving the current date window', () => {
  const currentSnapshot = {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days' as const,
    orderNoKeyword: ' old-order ',
    refundReasonKeyword: ' old-reason ',
    complaintKeyword: ' old-complaint ',
    riskOnly: false,
  };

  const nextSnapshot = buildCaregiverRiskOrderExportSnapshot(currentSnapshot, {
    serviceType: 'BOARDING',
    latestRefundStatus: 'APPROVED',
    primaryComplaintStatus: 'OPEN',
    primaryComplaintType: 'SERVICE',
    primaryComplaintTargetRole: 'CAREGIVER',
  });

  assert.deepEqual(nextSnapshot, {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    serviceType: 'BOARDING',
    refundStatus: 'APPROVED',
    complaintStatus: 'OPEN',
    complaintType: 'SERVICE',
    complaintTargetRole: 'CAREGIVER',
    riskOnly: true,
  });
});
