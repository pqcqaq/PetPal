import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPetPalComplaintSlaStatusLabel,
  petPalComplaintSlaStatusOptions,
} from '../src/pages/frontend/petpal/shared.ts';

test('exposes complaint SLA options in a stable order for export forms', () => {
  assert.deepEqual(petPalComplaintSlaStatusOptions, [
    { label: 'SLA正常', value: 'NORMAL' },
    { label: '即将超时', value: 'DUE_SOON' },
    { label: '投诉已超时', value: 'OVERDUE' },
  ]);

  for (const option of petPalComplaintSlaStatusOptions) {
    assert.equal(getPetPalComplaintSlaStatusLabel(option.value), option.label);
  }
});
