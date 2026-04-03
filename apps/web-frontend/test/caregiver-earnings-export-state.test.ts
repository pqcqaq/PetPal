import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
  CAREGIVER_REPEAT_COMPLAINT_COUNT,
  applyCaregiverEarningsExportFilterSnapshot,
  buildCaregiverAllRiskExportSnapshot,
  buildCaregiverRiskOrderExportSnapshot,
  buildCaregiverRiskQueueExportSnapshot,
  buildCaregiverEarningsExportQuery,
  cloneCaregiverEarningsExportFilterSnapshot,
  createEmptyCaregiverEarningsExportFilterSnapshot,
  hasCaregiverEarningsExportFilters,
  isCaregiverAllRiskExportSnapshot,
  parseCaregiverEarningsExportDateRange,
  resolveCaregiverRiskQueueExportPreset,
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
    minRefundAmount: 88,
    minComplaintCount: 2,
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
    minRefundAmount: 88,
    minComplaintCount: 2,
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

test('builds caregiver risk queue export snapshots for common queue views', () => {
  const currentSnapshot = {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days' as const,
    serviceType: 'BOARDING' as const,
    orderNoKeyword: ' old-order ',
    minRefundAmount: 66,
    minComplaintCount: 3,
    refundReasonKeyword: ' old-reason ',
    complaintKeyword: ' old-complaint ',
    complaintType: 'SERVICE' as const,
    complaintTargetRole: 'CAREGIVER' as const,
  };

  assert.deepEqual(buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'openComplaint'), {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    complaintStatus: 'OPEN',
    riskOnly: true,
  });

  assert.deepEqual(buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'processingComplaint'), {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    complaintStatus: 'PROCESSING',
    riskOnly: true,
  });

  assert.deepEqual(
    buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'caregiverResponsibility'),
    {
      ...createEmptyCaregiverEarningsExportFilterSnapshot(),
      startDate: '2026-04-01T00:00:00.000Z',
      endDate: '2026-04-07T23:59:59.999Z',
      datePreset: 'last7days',
      complaintTargetRole: 'CAREGIVER',
      riskOnly: true,
    },
  );

  assert.deepEqual(buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'platformResponsibility'), {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    complaintTargetRole: 'PLATFORM',
    riskOnly: true,
  });

  assert.deepEqual(buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'refundAwaitingSettlement'), {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    refundStatus: 'APPROVED',
    riskOnly: true,
  });

  assert.deepEqual(buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'highRefundExposure'), {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    minRefundAmount: CAREGIVER_HIGH_REFUND_EXPOSURE_AMOUNT,
    riskOnly: true,
  });

  assert.deepEqual(buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'repeatedComplaint'), {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    minComplaintCount: CAREGIVER_REPEAT_COMPLAINT_COUNT,
    riskOnly: true,
  });
});

test('detects current caregiver risk queue export views without confusing other filters', () => {
  const currentSnapshot = {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days' as const,
    serviceType: 'BOARDING' as const,
  };

  const allRiskSnapshot = buildCaregiverAllRiskExportSnapshot(currentSnapshot);
  assert.deepEqual(allRiskSnapshot, {
    ...createEmptyCaregiverEarningsExportFilterSnapshot(),
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-07T23:59:59.999Z',
    datePreset: 'last7days',
    riskOnly: true,
  });
  assert.equal(isCaregiverAllRiskExportSnapshot(allRiskSnapshot), true);
  assert.equal(resolveCaregiverRiskQueueExportPreset(allRiskSnapshot), '');

  const openComplaintSnapshot = buildCaregiverRiskQueueExportSnapshot(currentSnapshot, 'openComplaint');
  assert.equal(resolveCaregiverRiskQueueExportPreset(openComplaintSnapshot), 'openComplaint');
  assert.equal(isCaregiverAllRiskExportSnapshot(openComplaintSnapshot), false);

  const processingComplaintSnapshot = buildCaregiverRiskQueueExportSnapshot(
    currentSnapshot,
    'processingComplaint',
  );
  assert.equal(
    resolveCaregiverRiskQueueExportPreset(processingComplaintSnapshot),
    'processingComplaint',
  );

  const caregiverResponsibilitySnapshot = buildCaregiverRiskQueueExportSnapshot(
    currentSnapshot,
    'caregiverResponsibility',
  );
  assert.equal(
    resolveCaregiverRiskQueueExportPreset(caregiverResponsibilitySnapshot),
    'caregiverResponsibility',
  );

  const platformResponsibilitySnapshot = buildCaregiverRiskQueueExportSnapshot(
    currentSnapshot,
    'platformResponsibility',
  );
  assert.equal(
    resolveCaregiverRiskQueueExportPreset(platformResponsibilitySnapshot),
    'platformResponsibility',
  );

  const refundAwaitingSettlementSnapshot = buildCaregiverRiskQueueExportSnapshot(
    currentSnapshot,
    'refundAwaitingSettlement',
  );
  assert.equal(
    resolveCaregiverRiskQueueExportPreset(refundAwaitingSettlementSnapshot),
    'refundAwaitingSettlement',
  );

  const highRefundExposureSnapshot = buildCaregiverRiskQueueExportSnapshot(
    currentSnapshot,
    'highRefundExposure',
  );
  assert.equal(
    resolveCaregiverRiskQueueExportPreset(highRefundExposureSnapshot),
    'highRefundExposure',
  );

  const repeatedComplaintSnapshot = buildCaregiverRiskQueueExportSnapshot(
    currentSnapshot,
    'repeatedComplaint',
  );
  assert.equal(
    resolveCaregiverRiskQueueExportPreset(repeatedComplaintSnapshot),
    'repeatedComplaint',
  );

  assert.equal(
    resolveCaregiverRiskQueueExportPreset({
      ...openComplaintSnapshot,
      complaintKeyword: 'follow-up',
    }),
    '',
  );
  assert.equal(
    isCaregiverAllRiskExportSnapshot({
      ...allRiskSnapshot,
      serviceType: 'BOARDING',
    }),
    false,
  );
});
