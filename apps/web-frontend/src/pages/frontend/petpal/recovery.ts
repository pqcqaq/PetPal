import { ElMessage } from 'element-plus';
import type { Ref } from 'vue';

export type PetPalSectionLoadState = 'idle' | 'ready' | 'error';
export type PetPalRoleAwareSectionLoadState = PetPalSectionLoadState | 'role_unavailable';

export const mergePetPalPageNotice = (items: string[]) => {
  const normalized = items
    .map(item => item.trim().replace(/[。.]$/, ''))
    .filter(Boolean);
  return normalized.length ? `${normalized.join('；')}。` : '';
};

export const isPetPalReadySectionState = (
  state: PetPalSectionLoadState | PetPalRoleAwareSectionLoadState,
) => state === 'ready';

export const runPetPalSectionRetry = async <Key extends string>(options: {
  key: Key;
  sectionReloadingKey: Ref<Key | ''>;
  reload: () => Promise<unknown>;
  getState: () => PetPalSectionLoadState | PetPalRoleAwareSectionLoadState;
  successMessage: string;
  swallowError?: boolean;
}) => {
  options.sectionReloadingKey.value = options.key;
  try {
    await options.reload();
    if (isPetPalReadySectionState(options.getState())) {
      ElMessage.success(options.successMessage);
    }
  } catch (error) {
    if (!options.swallowError) {
      throw error;
    }
  } finally {
    options.sectionReloadingKey.value = '';
  }
};
