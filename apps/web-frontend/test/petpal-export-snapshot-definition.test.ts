import assert from 'node:assert/strict';
import test from 'node:test';
import { definePetPalExportSnapshot } from '../src/pages/frontend/petpal/export-snapshot-definition.ts';

test('derives export snapshot keys and clones empty defaults', () => {
  const definition = definePetPalExportSnapshot({
    startDate: '',
    endDate: '',
    orderNoKeyword: '',
    riskOnly: false,
  });

  assert.deepEqual(definition.keys, ['startDate', 'endDate', 'orderNoKeyword', 'riskOnly']);
  assert.deepEqual(definition.defaults, {
    startDate: '',
    endDate: '',
    orderNoKeyword: '',
    riskOnly: false,
  });

  const snapshot = definition.createEmpty();
  assert.deepEqual(snapshot, definition.defaults);
  assert.notEqual(snapshot, definition.defaults);
});
