import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyOwnerRefundExportFilterSnapshot,
  buildOwnerRefundExportQuery,
  cloneOwnerRefundExportFilterSnapshot,
  createEmptyOwnerRefundExportFilterSnapshot,
  hasOwnerRefundExportFilters,
  parseOwnerRefundExportDateRange,
  withOwnerRefundExportDateRange,
} from '../src/pages/frontend/petpal/owner-refund-export-state.ts';

test('creates, clones, and applies owner refund export snapshots', () => {
  const emptySnapshot = createEmptyOwnerRefundExportFilterSnapshot();
  const nextSnapshot = {
    ...emptySnapshot,
    refundType: 'PARTIAL' as const,
    complaintStatus: 'PROCESSING' as const,
    complaintTargetRole: 'PLATFORM' as const,
    serviceType: 'DOOR_VISIT' as const,
    orderNoKeyword: 'order-focus',
  };

  const clonedSnapshot = cloneOwnerRefundExportFilterSnapshot(nextSnapshot);
  assert.deepEqual(clonedSnapshot, nextSnapshot);
  assert.notEqual(clonedSnapshot, nextSnapshot);

  const targetSnapshot = createEmptyOwnerRefundExportFilterSnapshot();
  applyOwnerRefundExportFilterSnapshot(targetSnapshot, nextSnapshot);
  assert.deepEqual(targetSnapshot, nextSnapshot);
});

test('parses date ranges and detects whether refund export filters are active', () => {
  const emptySnapshot = createEmptyOwnerRefundExportFilterSnapshot();
  assert.equal(parseOwnerRefundExportDateRange(emptySnapshot), null);
  assert.equal(hasOwnerRefundExportFilters(emptySnapshot), false);

  const nextSnapshot = withOwnerRefundExportDateRange(emptySnapshot, [
    new Date('2026-04-01T00:00:00.000Z'),
    new Date('2026-04-03T23:59:59.999Z'),
  ]);

  const parsedRange = parseOwnerRefundExportDateRange(nextSnapshot);
  assert.equal(parsedRange?.[0]?.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(parsedRange?.[1]?.toISOString(), '2026-04-03T23:59:59.999Z');
  assert.equal(hasOwnerRefundExportFilters(nextSnapshot), true);

  const clearedSnapshot = withOwnerRefundExportDateRange(nextSnapshot, null);
  assert.equal(clearedSnapshot.startDate, '');
  assert.equal(clearedSnapshot.endDate, '');
});

test('builds refund export query payloads without leaking empty values', () => {
  const snapshot = {
    ...createEmptyOwnerRefundExportFilterSnapshot(),
    refundType: 'FULL' as const,
    refundStatus: 'SUCCESS' as const,
    complaintType: 'SERVICE' as const,
    orderNoKeyword: '  refund-order-7  ',
  };

  assert.deepEqual(buildOwnerRefundExportQuery(snapshot), {
    startDate: undefined,
    endDate: undefined,
    refundType: 'FULL',
    refundStatus: 'SUCCESS',
    complaintStatus: undefined,
    complaintType: 'SERVICE',
    complaintTargetRole: undefined,
    serviceType: undefined,
    orderNoKeyword: 'refund-order-7',
  });
});
