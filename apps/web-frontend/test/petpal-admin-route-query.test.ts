import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRouteQuerySnapshot,
  getSingleRouteQueryValue,
  normalizeStringRouteQuery,
} from '../src/pages/petpal-admin/shared/route-query.ts';

test('trims a single route query value and ignores non-string input', () => {
  assert.equal(getSingleRouteQueryValue('  pending  '), 'pending');
  assert.equal(getSingleRouteQueryValue(['pending']), '');
  assert.equal(getSingleRouteQueryValue(undefined), '');
});

test('normalizes route query objects to trimmed string-only maps', () => {
  assert.deepEqual(normalizeStringRouteQuery({
    status: '  PENDING  ',
    page: ' 2 ',
    empty: '   ',
    numeric: 1,
    array: ['OPEN'],
  }), {
    status: 'PENDING',
    page: '2',
  });
});

test('builds a stable route query snapshot regardless of key order', () => {
  const left = buildRouteQuerySnapshot({
    status: 'OPEN',
    page: '2',
    keyword: 'cat',
  });
  const right = buildRouteQuerySnapshot({
    keyword: 'cat',
    page: '2',
    status: 'OPEN',
  });

  assert.equal(left, right);
});
