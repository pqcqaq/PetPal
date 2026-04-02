import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parsePetPalExportDate,
  parsePetPalExportDateRange,
  serializePetPalExportDateRange,
  withPetPalExportDateRange,
} from '../src/pages/frontend/petpal/export-date-range.ts';

test('parses individual export dates and ignores invalid values', () => {
  assert.equal(parsePetPalExportDate('2026-04-03T00:00:00.000Z')?.toISOString(), '2026-04-03T00:00:00.000Z');
  assert.equal(parsePetPalExportDate(''), null);
  assert.equal(parsePetPalExportDate('invalid-date'), null);
});

test('parses and serializes export date ranges', () => {
  const range = parsePetPalExportDateRange({
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-03T23:59:59.999Z',
  });

  assert.equal(range?.[0]?.toISOString(), '2026-04-01T00:00:00.000Z');
  assert.equal(range?.[1]?.toISOString(), '2026-04-03T23:59:59.999Z');

  assert.deepEqual(serializePetPalExportDateRange(range), {
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-04-03T23:59:59.999Z',
  });
});

test('writes export date ranges back into snapshot objects', () => {
  const snapshot = withPetPalExportDateRange({
    startDate: '2026-03-01T00:00:00.000Z',
    endDate: '2026-03-02T00:00:00.000Z',
    serviceType: 'BOARDING' as const,
  }, [
    new Date('2026-04-05T08:00:00.000Z'),
    new Date('2026-04-08T18:30:00.000Z'),
  ]);

  assert.deepEqual(snapshot, {
    startDate: '2026-04-05T08:00:00.000Z',
    endDate: '2026-04-08T18:30:00.000Z',
    serviceType: 'BOARDING',
  });

  assert.deepEqual(withPetPalExportDateRange(snapshot, null), {
    startDate: '',
    endDate: '',
    serviceType: 'BOARDING',
  });
});
