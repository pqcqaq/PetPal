import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyPetPalExportSnapshot,
  clonePetPalExportSnapshot,
} from '../src/pages/frontend/petpal/export-snapshot-helpers.ts';

test('clones petpal export snapshots by the provided key list', () => {
  const source = {
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-03T23:59:59.999Z',
    orderNoKeyword: 'order-9',
  };

  const clone = clonePetPalExportSnapshot(source, [
    'startDate',
    'endDate',
    'orderNoKeyword',
  ] as const);

  assert.deepEqual(clone, source);
  assert.notEqual(clone, source);
});

test('applies petpal export snapshot fields to an existing target object', () => {
  const target = {
    startDate: '',
    endDate: '',
    riskOnly: false,
  };
  const source = {
    startDate: '2026-04-02T00:00:00.000Z',
    endDate: '2026-04-05T23:59:59.999Z',
    riskOnly: true,
  };

  const result = applyPetPalExportSnapshot(target, source, [
    'startDate',
    'endDate',
    'riskOnly',
  ] as const);

  assert.equal(result, target);
  assert.deepEqual(target, source);
});
