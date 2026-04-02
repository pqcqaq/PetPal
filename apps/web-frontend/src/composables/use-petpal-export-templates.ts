import { computed, ref, type Ref } from 'vue';
import type { PetPalNamedExportTemplate } from '../pages/frontend/petpal/export-template-state';
import {
  findPetPalNamedExportTemplate,
  removePetPalNamedExportTemplate,
  upsertPetPalNamedExportTemplate,
} from '../pages/frontend/petpal/export-template-state';

export const usePetPalExportTemplates = <T extends PetPalNamedExportTemplate>(
  templates: Ref<T[]>,
) => {
  const selectedTemplateName = ref('');

  const selectedTemplate = computed(
    () => findPetPalNamedExportTemplate(templates.value, selectedTemplateName.value),
  );

  const applySelectedTemplate = (applyTemplate: (template: T) => void) => {
    if (!selectedTemplate.value) {
      return null;
    }

    applyTemplate(selectedTemplate.value);
    return selectedTemplate.value;
  };

  const saveTemplate = (nextTemplate: T) => {
    const result = upsertPetPalNamedExportTemplate(templates.value, nextTemplate);
    if (result.status === 'limit_exceeded') {
      return result;
    }

    templates.value = result.templates;
    selectedTemplateName.value = nextTemplate.name;
    return result;
  };

  const removeSelectedTemplate = () => {
    if (!selectedTemplate.value) {
      return null;
    }

    const templateName = selectedTemplate.value.name;
    templates.value = removePetPalNamedExportTemplate(templates.value, templateName);
    selectedTemplateName.value = '';
    return templateName;
  };

  return {
    selectedTemplateName,
    selectedTemplate,
    applySelectedTemplate,
    saveTemplate,
    removeSelectedTemplate,
  };
};
