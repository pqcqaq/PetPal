import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { usePetPalExportTemplates } from '../src/composables/use-petpal-export-templates.ts';

test('tracks selected export template and applies the selected template', () => {
  const templates = ref([
    { name: '最近 7 天', riskOnly: false },
    { name: '退款复盘', riskOnly: true },
  ]);

  const exportTemplates = usePetPalExportTemplates(templates);
  exportTemplates.selectedTemplateName.value = '退款复盘';

  assert.equal(exportTemplates.selectedTemplate.value?.name, '退款复盘');

  let appliedName = '';
  const applied = exportTemplates.applySelectedTemplate((template) => {
    appliedName = template.name;
  });

  assert.equal(applied?.name, '退款复盘');
  assert.equal(appliedName, '退款复盘');
});

test('saves export templates through the shared manager', () => {
  const templates = ref([
    { name: '最近 7 天', orderNoKeyword: '7d' },
    { name: '退款复盘', orderNoKeyword: 'refund' },
  ]);

  const exportTemplates = usePetPalExportTemplates(templates);
  const created = exportTemplates.saveTemplate({ name: '投诉复盘', orderNoKeyword: 'complaint' });

  assert.equal(created.status, 'created');
  assert.deepEqual(templates.value.map((item) => item.name), ['投诉复盘', '最近 7 天', '退款复盘']);
  assert.equal(exportTemplates.selectedTemplateName.value, '投诉复盘');

  const updated = exportTemplates.saveTemplate({ name: '最近 7 天', orderNoKeyword: 'latest-7d' });
  assert.equal(updated.status, 'updated');
  assert.deepEqual(templates.value.map((item) => item.name), ['最近 7 天', '投诉复盘', '退款复盘']);
  assert.equal(templates.value[0]?.orderNoKeyword, 'latest-7d');
});

test('removes the selected export template and clears the selection', () => {
  const templates = ref([
    { name: '最近 7 天', serviceType: 'BOARDING' },
    { name: '投诉复盘', serviceType: 'FEEDING' },
  ]);

  const exportTemplates = usePetPalExportTemplates(templates);
  exportTemplates.selectedTemplateName.value = '投诉复盘';

  const removedName = exportTemplates.removeSelectedTemplate();
  assert.equal(removedName, '投诉复盘');
  assert.deepEqual(templates.value.map((item) => item.name), ['最近 7 天']);
  assert.equal(exportTemplates.selectedTemplateName.value, '');
  assert.equal(exportTemplates.selectedTemplate.value, null);
});

test('keeps the current state when a new template exceeds the limit', () => {
  const templates = ref([
    { name: '模板 1', riskOnly: false },
    { name: '模板 2', riskOnly: true },
    { name: '模板 3', riskOnly: false },
    { name: '模板 4', riskOnly: true },
    { name: '模板 5', riskOnly: false },
  ]);

  const exportTemplates = usePetPalExportTemplates(templates);
  exportTemplates.selectedTemplateName.value = '模板 3';

  const result = exportTemplates.saveTemplate({ name: '模板 6', riskOnly: true });

  assert.equal(result.status, 'limit_exceeded');
  assert.deepEqual(templates.value.map((item) => item.name), [
    '模板 1',
    '模板 2',
    '模板 3',
    '模板 4',
    '模板 5',
  ]);
  assert.equal(exportTemplates.selectedTemplateName.value, '模板 3');
  assert.equal(exportTemplates.selectedTemplate.value?.name, '模板 3');
});
