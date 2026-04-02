import assert from 'node:assert/strict';
import test from 'node:test';
import {
  toPetPalOptionalQueryValue,
  toPetPalOptionalTrimmedQueryText,
  toPetPalOptionalTrueFlag,
} from '../src/pages/frontend/petpal/export-query-values.ts';

test('normalizes empty export query values to undefined', () => {
  assert.equal(toPetPalOptionalQueryValue(''), undefined);
  assert.equal(toPetPalOptionalQueryValue(undefined), undefined);
  assert.equal(toPetPalOptionalQueryValue(null), undefined);
  assert.equal(toPetPalOptionalQueryValue('BOARDING'), 'BOARDING');
});

test('trims export query text values before normalization', () => {
  assert.equal(toPetPalOptionalTrimmedQueryText('  refund-order-7  '), 'refund-order-7');
  assert.equal(toPetPalOptionalTrimmedQueryText('   '), undefined);
});

test('only keeps true boolean export flags', () => {
  assert.equal(toPetPalOptionalTrueFlag(true), true);
  assert.equal(toPetPalOptionalTrueFlag(false), undefined);
});
