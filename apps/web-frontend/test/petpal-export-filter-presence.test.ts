import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasPetPalActiveFilters,
  hasPetPalFilterValue,
} from '../src/pages/frontend/petpal/export-filter-presence.ts';

test('detects whether a single export filter value is active', () => {
  assert.equal(hasPetPalFilterValue('  order-9  '), true);
  assert.equal(hasPetPalFilterValue('   '), false);
  assert.equal(hasPetPalFilterValue(true), true);
  assert.equal(hasPetPalFilterValue(false), false);
  assert.equal(hasPetPalFilterValue(0), true);
  assert.equal(hasPetPalFilterValue(undefined), false);
});

test('detects whether any export filters are active in a value set', () => {
  assert.equal(hasPetPalActiveFilters('', '   ', false, undefined), false);
  assert.equal(hasPetPalActiveFilters('', '  refund-order-7  ', false), true);
  assert.equal(hasPetPalActiveFilters('', '', true), true);
});
