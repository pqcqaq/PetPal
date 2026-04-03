import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRouteQuerySnapshot,
  getSingleRouteQueryValue,
  hasAnyStringRouteQuery,
  normalizeStringRouteQuery,
  parseAllowedIntegerRouteQuery,
  parsePositiveIntegerRouteQuery,
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

test('detects known string route query keys only when present', () => {
  assert.equal(hasAnyStringRouteQuery(['page', 'status'], {
    page: 2,
    status: ['OPEN'],
  }), false);

  assert.equal(hasAnyStringRouteQuery(['page', 'status'], {
    page: ' 3 ',
  }), true);
});

test('parses positive and allowed integer route query values with fallbacks', () => {
  assert.equal(parsePositiveIntegerRouteQuery(' 5 '), 5);
  assert.equal(parsePositiveIntegerRouteQuery('0'), 1);
  assert.equal(parsePositiveIntegerRouteQuery('abc', 2), 2);

  assert.equal(parseAllowedIntegerRouteQuery(' 20 ', [10, 20, 50], 10), 20);
  assert.equal(parseAllowedIntegerRouteQuery('30', [10, 20, 50], 10), 10);
  assert.equal(parseAllowedIntegerRouteQuery(undefined, [10, 20, 50], 10), 10);
});
