import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyOwnerTransactionExportFilterSnapshot,
  buildOwnerTransactionExportQuery,
  cloneOwnerTransactionExportFilterSnapshot,
  createEmptyOwnerTransactionExportFilterSnapshot,
  hasOwnerTransactionExportFilters,
  parseOwnerTransactionExportDateRange,
  withOwnerTransactionExportDateRange,
} from '../src/pages/frontend/petpal/owner-transaction-export-state.ts';

test('creates, clones, and applies owner transaction export snapshots', () => {
  const emptySnapshot = createEmptyOwnerTransactionExportFilterSnapshot();
  const nextSnapshot = {
    ...emptySnapshot,
    serviceType: 'BOARDING' as const,
    orderStatus: 'COMPLETED' as const,
    orderNoKeyword: 'order-focus',
  };

  const clonedSnapshot = cloneOwnerTransactionExportFilterSnapshot(nextSnapshot);
  assert.deepEqual(clonedSnapshot, nextSnapshot);
  assert.notEqual(clonedSnapshot, nextSnapshot);

  const targetSnapshot = createEmptyOwnerTransactionExportFilterSnapshot();
  applyOwnerTransactionExportFilterSnapshot(targetSnapshot, nextSnapshot);
  assert.deepEqual(targetSnapshot, nextSnapshot);
});

test('parses date ranges and detects whether transaction export filters are active', () => {
  const emptySnapshot = createEmptyOwnerTransactionExportFilterSnapshot();
  assert.equal(parseOwnerTransactionExportDateRange(emptySnapshot), null);
  assert.equal(hasOwnerTransactionExportFilters(emptySnapshot), false);

  const nextSnapshot = withOwnerTransactionExportDateRange(emptySnapshot, [
    new Date('2026-04-01T00:00:00.000Z'),
    new Date('2026-04-03T23:59:59.999Z'),
  ]);

  const parsedRange = parseOwnerTransactionExportDateRange(nextSnapshot);
  assert.equal(parsedRange?.[0]?.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(parsedRange?.[1]?.toISOString(), '2026-04-03T23:59:59.999Z');
  assert.equal(hasOwnerTransactionExportFilters(nextSnapshot), true);

  const clearedSnapshot = withOwnerTransactionExportDateRange(nextSnapshot, null);
  assert.equal(clearedSnapshot.startDate, '');
  assert.equal(clearedSnapshot.endDate, '');
});

test('builds transaction export query payloads without leaking empty values', () => {
  const snapshot = {
    ...createEmptyOwnerTransactionExportFilterSnapshot(),
    serviceType: 'WALKING' as const,
    orderStatus: 'SERVING' as const,
    orderNoKeyword: '  tx-order-9  ',
  };

  assert.deepEqual(buildOwnerTransactionExportQuery(snapshot), {
    startDate: undefined,
    endDate: undefined,
    serviceType: 'WALKING',
    orderStatus: 'SERVING',
    orderNoKeyword: 'tx-order-9',
  });
});
