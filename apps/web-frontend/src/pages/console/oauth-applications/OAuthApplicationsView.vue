<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadData">刷新</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate">新增应用</el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回应用清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && activeApplicationId" type="primary" @click="openEditById">
          编辑应用
        </el-button>
        <el-button v-if="isFormMode" type="primary" :loading="saving" @click="saveApplication">
          {{ screenMode === 'create' ? '创建应用' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <OAuthApplicationToolbar
        :filters="pageState.filters"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <SurfacePanel
      :caption="screenHeader.caption"
      :title="screenHeader.title"
      :description="screenHeader.description"
    >
      <div v-if="screenHeader.meta.length" class="applications-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="applications-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <OAuthApplicationsTable
      v-if="isListMode"
      :applications="pagedApplications"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :confidential-count="confidentialCount"
      :context-menu-items="applicationContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeApplication"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="OAuth 应用详情"
      title="授权身份与跳转配置"
      description="详情页只负责查看当前应用的授权能力、跳转地址和 scopes，不再用抽屉挤压内容。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedApplication">
          <section class="detail-section">
            <div class="detail-section__header">
              <div class="applications-screen__identity">
                <div
                  v-if="selectedApplication.logoUrl"
                  class="applications-screen__logo applications-screen__logo--image"
                >
                  <img :src="selectedApplication.logoUrl" :alt="selectedApplication.name" />
                </div>
                <div v-else class="applications-screen__logo">
                  {{ selectedApplication.name.slice(0, 1).toUpperCase() }}
                </div>
                <div class="table-stack">
                  <strong>{{ selectedApplication.name }}</strong>
                  <span>{{ selectedApplication.code }}</span>
                </div>
              </div>
              <el-space wrap>
                <el-tag effect="light" round>
                  {{ resolveOAuthApplicationClientTypeLabel(selectedApplication.clientType) }}
                </el-tag>
                <el-tag :type="selectedApplication.enabled ? 'success' : 'info'" round>
                  {{ selectedApplication.enabled ? '启用' : '禁用' }}
                </el-tag>
                <el-button v-if="canEdit" link @click="openEditById">编辑</el-button>
                <el-button v-if="canDelete" link type="danger" @click="removeApplication(selectedApplication)">
                  删除
                </el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>客户端 ID</span>
                <strong>{{ selectedApplication.clientId }}</strong>
              </div>
              <div class="detail-kv">
                <span>客户端类型</span>
                <strong>{{ resolveOAuthApplicationClientTypeLabel(selectedApplication.clientType) }}</strong>
              </div>
              <div class="detail-kv">
                <span>首页地址</span>
                <strong>{{ selectedApplication.homepageUrl || '未配置' }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedApplication.updatedAt) }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>描述</span>
                <strong>{{ selectedApplication.description || '该应用未填写描述。' }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Redirects</p>
                <h3 class="panel-heading panel-heading--md">回调地址</h3>
              </div>
            </div>
            <div class="detail-kv-grid">
              <div class="detail-kv detail-kv--full">
                <span>Redirect URIs</span>
                <strong>{{ selectedApplication.redirectUris.join('\n') || '未配置' }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>Post Logout Redirect URIs</span>
                <strong>{{ selectedApplication.postLogoutRedirectUris.join('\n') || '未配置' }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Scopes</p>
                <h3 class="panel-heading panel-heading--md">默认 Scopes 与权限 Scopes</h3>
              </div>
            </div>
            <div class="detail-chip-list">
              <span v-for="scope in selectedApplication.defaultScopes" :key="scope" class="role-pill">
                {{ scope }}
              </span>
            </div>
            <div class="detail-chip-list">
              <span
                v-for="permission in selectedApplication.permissions"
                :key="permission.id"
                class="permission-tag"
              >
                {{ permission.code }}
              </span>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Policy</p>
                <h3 class="panel-heading panel-heading--md">授权策略</h3>
              </div>
            </div>
            <div class="detail-chip-list">
              <span class="role-pill">{{ selectedApplication.skipConsent ? '跳过 Consent' : '显示 Consent' }}</span>
              <span class="role-pill">{{ selectedApplication.requirePkce ? '要求 PKCE' : '不要求 PKCE' }}</span>
              <span class="role-pill">
                {{ selectedApplication.allowAuthorizationCode ? '允许授权码' : '禁止授权码' }}
              </span>
              <span class="role-pill">
                {{ selectedApplication.allowRefreshToken ? '允许刷新令牌' : '禁止刷新令牌' }}
              </span>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个应用，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建应用' : '编辑应用'"
      :title="screenMode === 'create' ? 'OAuth 应用只在这里创建' : 'OAuth 应用只在这里修改'"
      :description="screenMode === 'create'
        ? '创建页按身份、跳转地址、权限 scopes、授权策略四段整理。'
        : '编辑页保留同样的结构，避免超长弹窗打断配置流程。'"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Identity</p>
              <h3 class="panel-heading panel-heading--md">基础身份</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="应用编码">
              <el-input v-model="form.code" />
            </el-form-item>

            <el-form-item label="应用名称">
              <el-input v-model="form.name" />
            </el-form-item>

            <el-form-item label="客户端类型">
              <el-select v-model="form.clientType">
                <el-option label="Confidential" value="CONFIDENTIAL" />
                <el-option label="Public" value="PUBLIC" />
              </el-select>
            </el-form-item>

            <el-form-item label="状态">
              <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="禁用" />
            </el-form-item>

            <el-form-item label="描述" class="page-form-grid__full">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="3"
                maxlength="240"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="Logo URL" class="page-form-grid__full">
              <el-input v-model="form.logoUrl" placeholder="https://example.com/logo.png" />
            </el-form-item>

            <el-form-item label="Homepage URL" class="page-form-grid__full">
              <el-input v-model="form.homepageUrl" placeholder="https://app.example.com" />
            </el-form-item>

            <el-form-item label="Client ID">
              <el-input v-model="form.clientId" />
            </el-form-item>

            <el-form-item label="Client Secret">
              <el-input
                v-model="form.clientSecret"
                show-password
                :placeholder="
                  form.clientType === 'PUBLIC'
                    ? 'Public 应用无需配置 client secret'
                    : screenMode === 'edit'
                      ? '留空表示保持当前密钥'
                      : '请输入客户端密钥'
                "
                :disabled="form.clientType === 'PUBLIC'"
              />
            </el-form-item>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Redirects</p>
              <h3 class="panel-heading panel-heading--md">授权回调与登出回调</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="Redirect URIs" class="page-form-grid__full">
              <el-input
                v-model="form.redirectUrisText"
                type="textarea"
                :rows="4"
                placeholder="每行一个 redirect uri"
              />
            </el-form-item>

            <el-form-item label="Post Logout Redirect URIs" class="page-form-grid__full">
              <el-input
                v-model="form.postLogoutRedirectUrisText"
                type="textarea"
                :rows="3"
                placeholder="每行一个 post logout redirect uri"
              />
            </el-form-item>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Scopes</p>
              <h3 class="panel-heading panel-heading--md">默认 Scopes 与权限 Scopes</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="默认 Scopes" class="page-form-grid__full">
              <el-input
                v-model="form.defaultScopesText"
                type="textarea"
                :rows="4"
                placeholder="每行一个 scope，或用逗号分隔"
              />
            </el-form-item>

            <RelationSelectFormItem
              v-model="form.permissionIds"
              class="page-form-grid__full"
              label="权限 Scopes"
              dialog-title="选择权限 Scope"
              trigger-text="选择权限 Scope"
              :request="loadPermissionOptions"
              :search-defaults="{ q: '' }"
              multiple
              layout="card"
            >
              <template #search="{ params, search, reset }">
                <div class="applications-screen__relation-search">
                  <el-input
                    v-model="params.q"
                    clearable
                    placeholder="搜索权限名称、编码或模块"
                    @keyup.enter="search"
                  />
                  <el-button @click="search">搜索</el-button>
                  <el-button @click="reset">重置</el-button>
                </div>
              </template>

              <template #row="{ row, selected }">
                <div class="applications-screen__relation-card" :class="{ 'is-selected': selected }">
                  <div class="applications-screen__relation-card-head">
                    <strong>{{ row.name }}</strong>
                    <span class="applications-screen__relation-badge">
                      {{ selected ? '已选' : '选择' }}
                    </span>
                  </div>
                  <span>{{ row.code }}</span>
                  <p>{{ row.module }} · {{ row.action }}</p>
                </div>
              </template>
            </RelationSelectFormItem>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Policy</p>
              <h3 class="panel-heading panel-heading--md">授权策略</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="跳过 Consent">
              <el-switch
                v-model="form.skipConsent"
                inline-prompt
                active-text="开启"
                inactive-text="关闭"
              />
            </el-form-item>

            <el-form-item label="要求 PKCE">
              <el-switch
                v-model="form.requirePkce"
                inline-prompt
                active-text="开启"
                inactive-text="关闭"
              />
            </el-form-item>

            <el-form-item label="启用授权码">
              <el-switch
                v-model="form.allowAuthorizationCode"
                inline-prompt
                active-text="开启"
                inactive-text="关闭"
              />
            </el-form-item>

            <el-form-item label="启用刷新令牌">
              <el-switch
                v-model="form.allowRefreshToken"
                inline-prompt
                active-text="开启"
                inactive-text="关闭"
              />
            </el-form-item>
          </el-form>
        </section>
      </div>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { OAuthApplicationFormPayload, OAuthApplicationRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatTime } from '../oauth/oauth-management';
import OAuthApplicationsTable from './components/OAuthApplicationsTable.vue';
import OAuthApplicationToolbar from './components/OAuthApplicationToolbar.vue';
import {
  assignOAuthApplicationEditorForm,
  buildOAuthApplicationPayload,
  createEmptyOAuthApplicationEditorForm,
  formatOAuthApplicationPermissionSummary,
  formatOAuthApplicationScopeSummary,
  resolveOAuthApplicationClientTypeLabel,
  type OAuthApplicationEditorForm,
  validateOAuthApplicationForm,
} from './application-management';

defineOptions({ name: 'OAuthApplicationsView' });

definePage({
  viewKey: 'oauthApplications',
  keepAlive: true,
});

type OAuthApplicationsPageState = {
  filters: {
    q: string;
    enabled: '' | 'enabled' | 'disabled';
  };
  page: number;
};

type ApplicationScreenMode = 'list' | 'create' | 'edit' | 'detail';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const applications = ref<OAuthApplicationRecord[]>([]);
const selectedApplication = ref<OAuthApplicationRecord | null>(null);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const pageSize = 10;
const form = reactive<OAuthApplicationEditorForm>(createEmptyOAuthApplicationEditorForm());
const loadPermissionOptions = api.oauth.applications.permissions;

const { state: pageState } = usePageState<OAuthApplicationsPageState>('page:oauth-applications', {
  filters: {
    q: '',
    enabled: '',
  },
  page: 1,
});

const allowedModes: ApplicationScreenMode[] = ['list', 'create', 'edit', 'detail'];
const screenMode = computed<ApplicationScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as ApplicationScreenMode) ? (value as ApplicationScreenMode) : 'list';
});
const activeApplicationId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('oauth-application.create'));
const canEdit = computed(() => auth.hasPermission('oauth-application.update'));
const canDelete = computed(() => auth.hasPermission('oauth-application.delete'));

const total = computed(() => applications.value.length);
const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize), 1));
const pagedApplications = computed(() => {
  const start = (pageState.page - 1) * pageSize;
  return applications.value.slice(start, start + pageSize);
});
const enabledCount = computed(() => applications.value.filter((item) => item.enabled).length);
const confidentialCount = computed(
  () => applications.value.filter((item) => item.clientType === 'CONFIDENTIAL').length,
);
const permissionScopeCount = computed(() =>
  applications.value.reduce((count, item) => count + item.permissions.length, 0),
);

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  return [
    { label: '应用总数', value: total.value },
    { label: '启用应用', value: enabledCount.value },
    { label: 'Confidential', value: confidentialCount.value },
    { label: '权限 Scope 数', value: permissionScopeCount.value },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'OAuth Applications',
      title: '应用清单只负责筛选和进入下一步',
      description: '列表页只保留检索和进入详情，授权配置不再被长弹窗打断。',
      meta: [
        { label: '当前页记录', value: String(pagedApplications.value.length) },
        { label: '筛选状态', value: pageState.filters.enabled || '全部状态' },
      ],
    };
  }

  if (isDetailMode.value && selectedApplication.value) {
    return {
      caption: 'Application Detail',
      title: selectedApplication.value.name,
      description: '详情页只展示授权身份、回调地址与 scopes。',
      meta: [
        { label: '客户端类型', value: resolveOAuthApplicationClientTypeLabel(selectedApplication.value.clientType) },
        { label: '客户端 ID', value: selectedApplication.value.clientId },
      ],
    };
  }

  return {
    caption: 'Application Form',
    title: screenMode.value === 'create' ? '新增 OAuth 应用' : '编辑 OAuth 应用',
    description: screenMode.value === 'create'
      ? '新应用按身份、回调、scope、策略四段组织。'
      : '编辑页保持同样分段，方便快速定位配置区域。',
    meta: [],
  };
});

const resetForm = () => {
  Object.assign(form, createEmptyOAuthApplicationEditorForm());
};

const assignForm = (application: OAuthApplicationRecord) => {
  assignOAuthApplicationEditorForm(form, application);
};

const navigateToMode = async (mode: ApplicationScreenMode, id?: string) => {
  const query: Record<string, string> = {};
  if (mode !== 'list') {
    query.mode = mode;
  }
  if (id) {
    query.id = id;
  }
  await router.replace({ path: route.path, query });
};

const openList = async () => {
  await navigateToMode('list');
};

const openCreate = async () => {
  resetForm();
  await navigateToMode('create');
};

const openEdit = async (row: OAuthApplicationRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeApplicationId.value) {
    return;
  }
  await navigateToMode('edit', activeApplicationId.value);
};

const openDetail = async (row: OAuthApplicationRecord) => {
  await navigateToMode('detail', row.id);
};

const loadData = async () => {
  try {
    loading.value = true;
    applications.value = await api.oauth.applications.list({
      q: pageState.filters.q || undefined,
      enabled: pageState.filters.enabled || undefined,
    });

    if (pageState.page > totalPages.value) {
      pageState.page = totalPages.value;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载 OAuth 应用失败'));
  } finally {
    loading.value = false;
  }
};

const loadApplicationDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedApplication.value = await api.oauth.applications.detail(id);
  } catch (error: unknown) {
    selectedApplication.value = null;
    ElMessage.error(getErrorMessage(error, '加载 OAuth 应用详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadData();
    return;
  }

  if (!activeApplicationId.value) {
    return;
  }

  await loadApplicationDetail(activeApplicationId.value);
  if (screenMode.value === 'edit' && selectedApplication.value) {
    assignForm(selectedApplication.value);
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.enabled = '';
  pageState.page = 1;
  await loadData();
};

const saveApplication = async () => {
  const validationMessage = validateOAuthApplicationForm(
    form,
    screenMode.value === 'edit' ? activeApplicationId.value || null : null,
  );

  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: OAuthApplicationFormPayload = buildOAuthApplicationPayload(form);

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activeApplicationId.value
      ? await api.oauth.applications.update(activeApplicationId.value, payload)
      : await api.oauth.applications.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? 'OAuth 应用已更新' : 'OAuth 应用已创建');
    await loadData();
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存 OAuth 应用失败' : '创建 OAuth 应用失败'));
  } finally {
    saving.value = false;
  }
};

const removeApplication = async (row: OAuthApplicationRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除应用“${row.name}（${row.code}）”吗？`,
      '删除 OAuth 应用',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.oauth.applications.remove(row.id);
    ElMessage.success('OAuth 应用已删除');
    await loadData();
    if (activeApplicationId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除 OAuth 应用失败'));
  }
};

const copyApplicationSummary = async (row: OAuthApplicationRecord) => {
  try {
    await navigator.clipboard.writeText(
      [
        row.name,
        row.clientId,
        formatOAuthApplicationScopeSummary(row),
        formatOAuthApplicationPermissionSummary(row),
      ].join('\n'),
    );
    ElMessage.success('摘要已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const applicationContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'copy',
    label: '复制摘要',
    onSelect: (row) => {
      void copyApplicationSummary(row);
    },
  },
  {
    key: 'permissions',
    label: '查看权限 Scope',
    onSelect: (row) => {
      ElMessage.info(formatOAuthApplicationPermissionSummary(row));
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑应用',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除应用',
    hidden: () => !canDelete.value,
    danger: true,
    onSelect: (row) => removeApplication(row),
  },
] satisfies ContextMenuItem<OAuthApplicationRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
};

watch(
  () => [screenMode.value, activeApplicationId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedApplication.value = null;
      return;
    }

    if (mode === 'create') {
      selectedApplication.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadApplicationDetail(id);
    if (mode === 'edit' && selectedApplication.value) {
      assignForm(selectedApplication.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadData();
});
</script>

<style scoped lang="scss">
.applications-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.applications-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.applications-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.applications-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.applications-screen__identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.applications-screen__logo {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--surface-icon-tile);
  color: var(--ink-1);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
}

.applications-screen__logo--image {
  background: var(--surface-image-tile);
  border: 1px solid var(--line-soft);
}

.applications-screen__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.applications-screen__relation-search {
  display: flex;
  gap: 10px;
}

.applications-screen__relation-search :deep(.el-input) {
  flex: 1;
}

.applications-screen__relation-card {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 16px;
  background: var(--surface-1);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background-color 0.18s ease,
    transform 0.18s ease;
}

.applications-screen__relation-card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.applications-screen__relation-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.applications-screen__relation-badge {
  flex: 0 0 auto;
  min-width: 44px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--surface-accent-subtle);
  color: var(--accent-strong);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
}

.applications-screen__relation-card strong {
  font-size: 14px;
  line-height: 1.4;
}

.applications-screen__relation-card span,
.applications-screen__relation-card p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .applications-screen__relation-search {
    flex-direction: column;
  }
}
</style>
