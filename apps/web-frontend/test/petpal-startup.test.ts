import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePetPalStartup, resetPetPalStartupForTest } from '../src/petpal/startup.ts';

test('ensures petpal startup warmup only runs once until reset', () => {
  let warmupCount = 0;
  const warmup = () => {
    warmupCount += 1;
  };

  resetPetPalStartupForTest();

  assert.equal(ensurePetPalStartup({ warmup }), true);
  assert.equal(ensurePetPalStartup({ warmup }), false);
  assert.equal(warmupCount, 1);

  resetPetPalStartupForTest();

  assert.equal(ensurePetPalStartup({ warmup }), true);
  assert.equal(warmupCount, 2);
});
