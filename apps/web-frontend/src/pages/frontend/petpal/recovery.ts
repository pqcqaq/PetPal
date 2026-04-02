import { ElMessage } from 'element-plus';
import type { Ref } from 'vue';
import type { LocationQuery, LocationQueryRaw } from 'vue-router';

export type PetPalSectionLoadState = 'idle' | 'ready' | 'error';
export type PetPalRoleAwareSectionLoadState = PetPalSectionLoadState | 'role_unavailable';
export type PetPalDeskFocusRole = 'owner' | 'caregiver';
export type PetPalDeskOrderFilter = 'all' | 'needs_payment' | 'active' | 'aftersales' | 'done';
export type PetPalDeskSectionTab = 'summary' | 'messages' | 'service' | 'aftersales';

export const mergePetPalPageNotice = (items: string[]) => {
  const normalized = items
    .map(item => item.trim().replace(/[。.]$/, ''))
    .filter(Boolean);
  return normalized.length ? `${normalized.join('；')}。` : '';
};

export const buildPetPalPageNotice = (options: {
  baseNotice?: string;
  notes?: string[];
  warnings?: string[];
  successTitle: string;
  warningTitle: string;
}) => {
  const notes = options.notes ?? [];
  const warnings = options.warnings ?? [];
  const description = mergePetPalPageNotice([
    options.baseNotice || '',
    ...notes,
    ...warnings,
  ]);
  if (!description) {
    return null;
  }
  const hasWarning = warnings.some(item => item.trim());
  return {
    title: hasWarning ? options.warningTitle : options.successTitle,
    description,
    tone: hasWarning ? 'warning' as const : 'accent' as const,
  };
};

export const isPetPalReadySectionState = (
  state: PetPalSectionLoadState | PetPalRoleAwareSectionLoadState,
) => state === 'ready';

const getPetPalRouteQueryValue = (query: LocationQuery, key: string) => {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
};

export const getPetPalQueryString = (query: LocationQuery, key: string) => {
  const value = getPetPalRouteQueryValue(query, key);
  return typeof value === 'string' ? value.trim() : '';
};

export const getPetPalDeskFocusRole = (query: LocationQuery): PetPalDeskFocusRole | '' => {
  const role = getPetPalQueryString(query, 'focusRole');
  return role === 'owner' || role === 'caregiver' ? role : '';
};

export const getPetPalDeskOrderFilter = (query: LocationQuery): PetPalDeskOrderFilter | '' => {
  const filter = getPetPalQueryString(query, 'focusFilter');
  return ['all', 'needs_payment', 'active', 'aftersales', 'done'].includes(filter) ? filter as PetPalDeskOrderFilter : '';
};

export const getPetPalDeskSectionTab = (query: LocationQuery): PetPalDeskSectionTab | '' => {
  const tab = getPetPalQueryString(query, 'tab');
  return ['summary', 'messages', 'service', 'aftersales'].includes(tab) ? tab as PetPalDeskSectionTab : '';
};

export const buildPetPalDeskHandoffQuery = (options: {
  notice?: string;
  focusOrderId?: string;
  focusPetId?: string;
  focusRequestId?: string;
  focusServiceId?: string;
  focusRole?: PetPalDeskFocusRole;
  focusFilter?: PetPalDeskOrderFilter;
  tab?: PetPalDeskSectionTab;
}) => {
  const query: LocationQueryRaw = {};
  if (options.notice?.trim()) {
    query.notice = options.notice.trim();
  }
  if (options.focusOrderId?.trim()) {
    query.focusOrderId = options.focusOrderId.trim();
  }
  if (options.focusPetId?.trim()) {
    query.focusPetId = options.focusPetId.trim();
  }
  if (options.focusRequestId?.trim()) {
    query.focusRequestId = options.focusRequestId.trim();
  }
  if (options.focusServiceId?.trim()) {
    query.focusServiceId = options.focusServiceId.trim();
  }
  if (options.focusRole) {
    query.focusRole = options.focusRole;
  }
  if (options.focusFilter) {
    query.focusFilter = options.focusFilter;
  }
  if (options.tab) {
    query.tab = options.tab;
  }
  return query;
};

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
