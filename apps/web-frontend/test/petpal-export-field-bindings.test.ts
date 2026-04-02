import assert from 'node:assert/strict';
import test from 'node:test';
import { reactive } from 'vue';
import {
  createPetPalClearableFieldBinding,
  createPetPalFieldBinding,
  createPetPalTrimmedTextFieldBinding,
} from '../src/pages/frontend/petpal/export-field-bindings.ts';

test('creates a pass-through field binding', () => {
  const state = reactive({ riskOnly: false });
  const binding = createPetPalFieldBinding<boolean>({
    get: () => state.riskOnly,
    set: (value) => {
      state.riskOnly = value;
    },
  });

  assert.equal(binding.value, false);
  binding.value = true;
  assert.equal(state.riskOnly, true);
});

test('creates a clearable field binding that falls back to an empty string', () => {
  const state = reactive<{ serviceType: 'BOARDING' | '' }>({ serviceType: 'BOARDING' });
  const binding = createPetPalClearableFieldBinding<'BOARDING' | ''>({
    get: () => state.serviceType,
    set: (value) => {
      state.serviceType = value;
    },
  });

  assert.equal(binding.value, 'BOARDING');
  binding.value = '' as 'BOARDING' | '';
  assert.equal(state.serviceType, '');
});

test('creates a trimmed text field binding that only trims leading whitespace', () => {
  const state = reactive({ keyword: '' });
  const binding = createPetPalTrimmedTextFieldBinding<string>({
    get: () => state.keyword,
    set: (value) => {
      state.keyword = value;
    },
  });

  binding.value = '   refund follow-up  ';
  assert.equal(state.keyword, 'refund follow-up  ');
  assert.equal(binding.value, 'refund follow-up  ');
});
