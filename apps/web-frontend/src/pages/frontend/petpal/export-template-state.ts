export const PETPAL_EXPORT_TEMPLATE_LIMIT = 5;
export const PETPAL_EXPORT_TEMPLATE_NAME_MAX_LENGTH = 20;

export type PetPalNamedExportTemplate = {
  name: string;
};

export const validatePetPalExportTemplateName = (
  inputValue: string,
  maxLength = PETPAL_EXPORT_TEMPLATE_NAME_MAX_LENGTH,
) => {
  const name = inputValue.trim();
  if (!name) {
    return '模板名称不能为空';
  }
  if (name.length > maxLength) {
    return `模板名称请控制在 ${maxLength} 个字符以内`;
  }
  return true;
};

export const findPetPalNamedExportTemplate = <T extends PetPalNamedExportTemplate>(
  templates: readonly T[],
  name: string,
) => templates.find((item) => item.name === name) ?? null;

export const upsertPetPalNamedExportTemplate = <T extends PetPalNamedExportTemplate>(
  templates: readonly T[],
  nextTemplate: T,
  limit = PETPAL_EXPORT_TEMPLATE_LIMIT,
) => {
  const existingIndex = templates.findIndex((item) => item.name === nextTemplate.name);

  if (existingIndex === -1 && templates.length >= limit) {
    return {
      templates: [...templates],
      status: 'limit_exceeded' as const,
    };
  }

  const nextTemplates = [...templates];
  if (existingIndex >= 0) {
    nextTemplates.splice(existingIndex, 1);
  }
  nextTemplates.unshift(nextTemplate);

  return {
    templates: nextTemplates,
    status: existingIndex >= 0 ? ('updated' as const) : ('created' as const),
  };
};

export const removePetPalNamedExportTemplate = <T extends PetPalNamedExportTemplate>(
  templates: readonly T[],
  name: string,
) => templates.filter((item) => item.name !== name);
