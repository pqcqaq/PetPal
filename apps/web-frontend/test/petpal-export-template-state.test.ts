import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findPetPalNamedExportTemplate,
  PETPAL_EXPORT_TEMPLATE_LIMIT,
  removePetPalNamedExportTemplate,
  upsertPetPalNamedExportTemplate,
  validatePetPalExportTemplateName,
} from '../src/pages/frontend/petpal/export-template-state.ts';

test('validates export template names', () => {
  assert.equal(validatePetPalExportTemplateName('   '), '模板名称不能为空');
  assert.equal(
    validatePetPalExportTemplateName('123456789012345678901'),
    '模板名称请控制在 20 个字符以内',
  );
  assert.equal(validatePetPalExportTemplateName('  常用经营模板  '), true);
});

test('upserts export templates without mutating the source array', () => {
  const source = [
    { name: '最近 7 天', riskOnly: false },
    { name: '退款复盘', riskOnly: true },
  ];

  const created = upsertPetPalNamedExportTemplate(source, { name: '投诉复盘', riskOnly: true });
  assert.equal(created.status, 'created');
  assert.deepEqual(created.templates.map((item) => item.name), ['投诉复盘', '最近 7 天', '退款复盘']);
  assert.deepEqual(source.map((item) => item.name), ['最近 7 天', '退款复盘']);

  const updated = upsertPetPalNamedExportTemplate(created.templates, { name: '最近 7 天', riskOnly: true });
  assert.equal(updated.status, 'updated');
  assert.deepEqual(updated.templates.map((item) => item.name), ['最近 7 天', '投诉复盘', '退款复盘']);
  assert.equal(updated.templates[0]?.riskOnly, true);
});

test('enforces template limit and supports lookup/removal', () => {
  const templates = Array.from({ length: PETPAL_EXPORT_TEMPLATE_LIMIT }, (_, index) => ({
    name: `模板-${index + 1}`,
    orderNoKeyword: `${index + 1}`,
  }));

  const exceeded = upsertPetPalNamedExportTemplate(templates, {
    name: '超限模板',
    orderNoKeyword: 'overflow',
  });
  assert.equal(exceeded.status, 'limit_exceeded');
  assert.deepEqual(exceeded.templates, templates);

  assert.deepEqual(findPetPalNamedExportTemplate(templates, '模板-3'), templates[2]);
  assert.equal(findPetPalNamedExportTemplate(templates, '不存在'), null);
  assert.deepEqual(
    removePetPalNamedExportTemplate(templates, '模板-2').map((item) => item.name),
    ['模板-1', '模板-3', '模板-4', '模板-5'],
  );
});
