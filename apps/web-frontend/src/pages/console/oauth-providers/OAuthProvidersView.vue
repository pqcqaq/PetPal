<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadData">刷新</el-button>
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          新增供应商
        </el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回供应商清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && activeProviderId" type="primary" @click="openEditById">
          编辑供应商
        </el-button>
        <el-button v-if="isFormMode" type="primary" :loading="saving" @click="saveProvider">
          {{ screenMode === 'create' ? '创建供应商' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <OAuthProviderToolbar
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
      <div v-if="screenHeader.meta.length" class="provider-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="provider-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <OAuthProvidersTable
      v-if="isListMode"
      :providers="pagedProviders"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :login-enabled-count="loginEnabledCount"
      :context-menu-items="providerContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeProvider"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="OAuth 供应商详情"
      title="接入信息与登录策略"
      description="详情页只负责查看协议、端点和行为策略，不再把配置表单塞进抽屉。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedProvider">
          <section class="detail-section">
            <div class="detail-section__header">
              <div class="provider-screen__identity">
                <div v-if="selectedProvider.logoUrl" class="provider-screen__logo provider-screen__logo--image">
                  <img :src="selectedProvider.logoUrl" :alt="selectedProvider.name" />
                </div>
                <div v-else class="provider-screen__logo">
                  {{ selectedProvider.name.slice(0, 1).toUpperCase() }}
                </div>
                <div class="table-stack">
                  <strong>{{ selectedProvider.name }}</strong>
                  <span>{{ selectedProvider.code }}</span>
                </div>
              </div>
              <el-space wrap>
                <el-tag effect="light" round>
                  {{ resolveOAuthProviderProtocolLabel(selectedProvider.protocol) }}
                </el-tag>
                <el-tag :type="selectedProvider.enabled ? 'success' : 'info'" round>
                  {{ selectedProvider.enabled ? '启用' : '禁用' }}
                </el-tag>
                <el-tag :type="selectedProvider.allowLogin ? 'success' : 'warning'" round>
                  {{ selectedProvider.allowLogin ? '允许登录' : '禁止登录' }}
                </el-tag>
                <el-button v-if="canEdit" link @click="openEditById">编辑</el-button>
                <el-button v-if="canDelete" link type="danger" @click="removeProvider(selectedProvider)">
                  删除
                </el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>客户端 ID</span>
                <strong>{{ selectedProvider.clientId }}</strong>
              </div>
              <div class="detail-kv">
                <span>客户端鉴权</span>
                <strong>{{ resolveOAuthProviderClientAuthMethodLabel(selectedProvider.clientAuthMethod) }}</strong>
              </div>
              <div class="detail-kv">
                <span>默认 Scopes</span>
                <strong>{{ formatOAuthProviderScopeSummary(selectedProvider) }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedProvider.updatedAt) }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>描述</span>
                <strong>{{ selectedProvider.description || '该供应商未填写描述。' }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Endpoints</p>
                <h3 class="panel-heading panel-heading--md">协议端点</h3>
              </div>
            </div>
            <div class="detail-kv-grid">
              <div class="detail-kv detail-kv--full">
                <span>Authorization Endpoint</span>
                <strong>{{ selectedProvider.authorizationEndpoint }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>Token Endpoint</span>
                <strong>{{ selectedProvider.tokenEndpoint }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>Userinfo Endpoint</span>
                <strong>{{ selectedProvider.userinfoEndpoint || '未配置' }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>JWKS URI</span>
                <strong>{{ selectedProvider.jwksUri || '未配置' }}</strong>
              </div>
              <div class="detail-kv">
                <span>Discovery URL</span>
                <strong>{{ selectedProvider.discoveryUrl || '未配置' }}</strong>
              </div>
              <div class="detail-kv">
                <span>Issuer</span>
                <strong>{{ selectedProvider.issuer || '未配置' }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Behavior</p>
                <h3 class="panel-heading panel-heading--md">登录与注册策略</h3>
              </div>
            </div>
            <div class="detail-chip-list">
              <span class="role-pill">{{ selectedProvider.allowLogin ? '允许登录' : '禁止登录' }}</span>
              <span class="role-pill">{{ selectedProvider.autoRegister ? '自动注册' : '禁止自动注册' }}</span>
              <span class="role-pill">{{ selectedProvider.autoLinkByEmail ? '邮箱自动关联' : '手动关联' }}</span>
              <span class="role-pill">{{ selectedProvider.usePkce ? '启用 PKCE' : '不使用 PKCE' }}</span>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Claim Mapping</p>
                <h3 class="panel-heading panel-heading--md">用户字段映射</h3>
              </div>
            </div>
            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>Subject</span>
                <strong>{{ selectedProvider.claimMapping.subject }}</strong>
              </div>
              <div class="detail-kv">
                <span>Email</span>
                <strong>{{ selectedProvider.claimMapping.email || '未映射' }}</strong>
              </div>
              <div class="detail-kv">
                <span>Username</span>
                <strong>{{ selectedProvider.claimMapping.username || '未映射' }}</strong>
              </div>
              <div class="detail-kv">
                <span>Nickname</span>
                <strong>{{ selectedProvider.claimMapping.nickname || '未映射' }}</strong>
              </div>
              <div class="detail-kv detail-kv--full">
                <span>Avatar</span>
                <strong>{{ selectedProvider.claimMapping.avatarUrl || '未映射' }}</strong>
              </div>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个供应商，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建供应商' : '编辑供应商'"
      :title="screenMode === 'create' ? '接入配置只在这里创建' : '接入配置只在这里修改'"
      :description="screenMode === 'create'
        ? '创建页按身份、端点、策略、映射四段整理，不再塞进单个弹窗。'
        : '编辑页也保持同样的分段结构，方便快速定位改动。'"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Identity</p>
              <h3 class="panel-heading panel-heading--md">基础信息</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="供应商编码">
              <el-input v-model="form.code" />
            </el-form-item>
            <el-form-item label="供应商名称">
              <el-input v-model="form.name" />
            </el-form-item>
            <el-form-item label="协议">
              <el-select v-model="form.protocol">
                <el-option label="OIDC" value="OIDC" />
                <el-option label="OAuth 2.0" value="OAUTH2" />
              </el-select>
            </el-form-item>
            <el-form-item label="Client Auth Method">
              <el-select v-model="form.clientAuthMethod">
                <el-option label="Client Secret Basic" value="CLIENT_SECRET_BASIC" />
                <el-option label="Client Secret Post" value="CLIENT_SECRET_POST" />
              </el-select>
            </el-form-item>
            <el-form-item label="描述" class="page-form-grid__full">
              <el-input v-model="form.description" type="textarea" :rows="3" maxlength="240" show-word-limit />
            </el-form-item>
            <el-form-item label="Logo URL" class="page-form-grid__full">
              <el-input v-model="form.logoUrl" placeholder="https://example.com/logo.png" />
            </el-form-item>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Endpoints</p>
              <h3 class="panel-heading panel-heading--md">客户端与协议端点</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="Client ID">
              <el-input v-model="form.clientId" />
            </el-form-item>
            <el-form-item label="Client Secret">
              <el-input
                v-model="form.clientSecret"
                show-password
                :placeholder="screenMode === 'edit' ? '留空表示保持当前密钥' : '请输入客户端密钥'"
              />
            </el-form-item>
            <el-form-item label="Discovery URL">
              <el-input v-model="form.discoveryUrl" placeholder="https://issuer/.well-known/openid-configuration" />
            </el-form-item>
            <el-form-item label="Issuer">
              <el-input v-model="form.issuer" placeholder="https://issuer.example.com" />
            </el-form-item>
            <el-form-item label="Authorization Endpoint" class="page-form-grid__full">
              <el-input v-model="form.authorizationEndpoint" placeholder="https://issuer.example.com/oauth2/authorize" />
            </el-form-item>
            <el-form-item label="Token Endpoint" class="page-form-grid__full">
              <el-input v-model="form.tokenEndpoint" placeholder="https://issuer.example.com/oauth2/token" />
            </el-form-item>
            <el-form-item label="Userinfo Endpoint" class="page-form-grid__full">
              <el-input v-model="form.userinfoEndpoint" placeholder="https://issuer.example.com/oauth2/userinfo" />
            </el-form-item>
            <el-form-item label="JWKS URI" class="page-form-grid__full">
              <el-input v-model="form.jwksUri" placeholder="https://issuer.example.com/oauth2/jwks" />
            </el-form-item>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Behavior</p>
              <h3 class="panel-heading panel-heading--md">登录策略与默认 Scope</h3>
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
            <el-form-item label="启用">
              <el-switch v-model="form.enabled" inline-prompt active-text="启用" inactive-text="禁用" />
            </el-form-item>
            <el-form-item label="允许登录">
              <el-switch v-model="form.allowLogin" inline-prompt active-text="允许" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="自动注册">
              <el-switch v-model="form.autoRegister" inline-prompt active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="邮箱自动关联">
              <el-switch v-model="form.autoLinkByEmail" inline-prompt active-text="开启" inactive-text="关闭" />
            </el-form-item>
            <el-form-item label="使用 PKCE">
              <el-switch v-model="form.usePkce" inline-prompt active-text="开启" inactive-text="关闭" />
            </el-form-item>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Claim Mapping</p>
              <h3 class="panel-heading panel-heading--md">用户字段映射</h3>
            </div>
          </div>
          <el-form label-position="top" class="page-form-grid">
            <el-form-item label="Subject Claim">
              <el-input v-model="form.claimMapping.subject" />
            </el-form-item>
            <el-form-item label="Email Claim">
              <el-input v-model="form.claimMapping.email" />
            </el-form-item>
            <el-form-item label="Username Claim">
              <el-input v-model="form.claimMapping.username" />
            </el-form-item>
            <el-form-item label="Nickname Claim">
              <el-input v-model="form.claimMapping.nickname" />
            </el-form-item>
            <el-form-item label="Avatar Claim" class="page-form-grid__full">
              <el-input v-model="form.claimMapping.avatarUrl" />
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
import type { OAuthProviderFormPayload, OAuthProviderRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatTime } from '../oauth/oauth-management';
import OAuthProvidersTable from './components/OAuthProvidersTable.vue';
import OAuthProviderToolbar from './components/OAuthProviderToolbar.vue';
import {
  assignOAuthProviderEditorForm,
  buildOAuthProviderPayload,
  createEmptyOAuthProviderEditorForm,
  formatOAuthProviderEndpointSummary,
  formatOAuthProviderScopeSummary,
  resolveOAuthProviderClientAuthMethodLabel,
  resolveOAuthProviderProtocolLabel,
  type OAuthProviderEditorForm,
  validateOAuthProviderForm,
} from './provider-management';

defineOptions({ name: 'OAuthProvidersView' });

definePage({
  viewKey: 'oauthProviders',
  keepAlive: true,
});

type OAuthProvidersPageState = {
  filters: {
    q: string;
    enabled: '' | 'enabled' | 'disabled';
  };
  page: number;
};

type ProviderScreenMode = 'list' | 'create' | 'edit' | 'detail';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const providers = ref<OAuthProviderRecord[]>([]);
const selectedProvider = ref<OAuthProviderRecord | null>(null);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const pageSize = 10;
const form = reactive<OAuthProviderEditorForm>(createEmptyOAuthProviderEditorForm());

const { state: pageState } = usePageState<OAuthProvidersPageState>('page:oauth-providers', {
  filters: {
    q: '',
    enabled: '',
  },
  page: 1,
});

const allowedModes: ProviderScreenMode[] = ['list', 'create', 'edit', 'detail'];
const screenMode = computed<ProviderScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as ProviderScreenMode) ? (value as ProviderScreenMode) : 'list';
});
const activeProviderId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('oauth-provider.create'));
const canEdit = computed(() => auth.hasPermission('oauth-provider.update'));
const canDelete = computed(() => auth.hasPermission('oauth-provider.delete'));

const total = computed(() => providers.value.length);
const totalPages = computed(() => Math.max(Math.ceil(total.value / pageSize), 1));
const pagedProviders = computed(() => {
  const start = (pageState.page - 1) * pageSize;
  return providers.value.slice(start, start + pageSize);
});
const enabledCount = computed(() => providers.value.filter((item) => item.enabled).length);
const loginEnabledCount = computed(() => providers.value.filter((item) => item.enabled && item.allowLogin).length);
const oidcCount = computed(() => providers.value.filter((item) => item.protocol === 'OIDC').length);

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  return [
    { label: '供应商总数', value: total.value },
    { label: '启用供应商', value: enabledCount.value },
    { label: '允许登录', value: loginEnabledCount.value },
    { label: 'OIDC 协议', value: oidcCount.value },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'OAuth Providers',
      title: '供应商清单只负责筛选和进入下一步',
      description: '列表页只保留检索和进入详情，接入配置不再通过大弹窗塞满整个视口。',
      meta: [
        { label: '当前页记录', value: String(pagedProviders.value.length) },
        { label: '筛选状态', value: pageState.filters.enabled || '全部状态' },
      ],
    };
  }

  if (isDetailMode.value && selectedProvider.value) {
    return {
      caption: 'Provider Detail',
      title: selectedProvider.value.name,
      description: '详情页只展示协议、端点与登录行为。',
      meta: [
        { label: '协议', value: resolveOAuthProviderProtocolLabel(selectedProvider.value.protocol) },
        { label: '端点摘要', value: formatOAuthProviderEndpointSummary(selectedProvider.value) },
      ],
    };
  }

  return {
    caption: 'Provider Form',
    title: screenMode.value === 'create' ? '新增 OAuth 供应商' : '编辑 OAuth 供应商',
    description: screenMode.value === 'create'
      ? '新供应商按身份、端点、策略、映射四段组织。'
      : '编辑页保持同样分段，避免在单页长表单中迷失。',
    meta: [],
  };
});

const resetForm = () => {
  Object.assign(form, createEmptyOAuthProviderEditorForm());
};

const assignForm = (provider: OAuthProviderRecord) => {
  assignOAuthProviderEditorForm(form, provider);
};

const navigateToMode = async (mode: ProviderScreenMode, id?: string) => {
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

const openEdit = async (row: OAuthProviderRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeProviderId.value) {
    return;
  }
  await navigateToMode('edit', activeProviderId.value);
};

const openDetail = async (row: OAuthProviderRecord) => {
  await navigateToMode('detail', row.id);
};

const loadData = async () => {
  try {
    loading.value = true;
    providers.value = await api.oauth.providers.list({
      q: pageState.filters.q || undefined,
      enabled: pageState.filters.enabled || undefined,
    });

    if (pageState.page > totalPages.value) {
      pageState.page = totalPages.value;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载 OAuth 供应商失败'));
  } finally {
    loading.value = false;
  }
};

const loadProviderDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedProvider.value = await api.oauth.providers.detail(id);
  } catch (error: unknown) {
    selectedProvider.value = null;
    ElMessage.error(getErrorMessage(error, '加载 OAuth 供应商详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadData();
    return;
  }

  if (!activeProviderId.value) {
    return;
  }

  await loadProviderDetail(activeProviderId.value);
  if (screenMode.value === 'edit' && selectedProvider.value) {
    assignForm(selectedProvider.value);
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

const saveProvider = async () => {
  const validationMessage = validateOAuthProviderForm(
    form,
    screenMode.value === 'edit' ? activeProviderId.value || null : null,
  );

  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: OAuthProviderFormPayload = buildOAuthProviderPayload(form);

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activeProviderId.value
      ? await api.oauth.providers.update(activeProviderId.value, payload)
      : await api.oauth.providers.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? 'OAuth 供应商已更新' : 'OAuth 供应商已创建');
    await loadData();
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存 OAuth 供应商失败' : '创建 OAuth 供应商失败'));
  } finally {
    saving.value = false;
  }
};

const removeProvider = async (row: OAuthProviderRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除供应商“${row.name}（${row.code}）”吗？删除后不可恢复。`,
      '删除 OAuth 供应商',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.oauth.providers.remove(row.id);
    ElMessage.success('OAuth 供应商已删除');
    await loadData();
    if (activeProviderId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除 OAuth 供应商失败'));
  }
};

const copyProviderSummary = async (row: OAuthProviderRecord) => {
  try {
    await navigator.clipboard.writeText(`${row.name}\n${formatOAuthProviderEndpointSummary(row)}\n${formatOAuthProviderScopeSummary(row)}`);
    ElMessage.success('摘要已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const providerContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'copy',
    label: '复制摘要',
    onSelect: (row) => {
      void copyProviderSummary(row);
    },
  },
  {
    key: 'protocol',
    label: '查看协议',
    onSelect: (row) => {
      ElMessage.info(`协议：${resolveOAuthProviderProtocolLabel(row.protocol)}`);
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑供应商',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除供应商',
    hidden: () => !canDelete.value,
    danger: true,
    onSelect: (row) => removeProvider(row),
  },
] satisfies ContextMenuItem<OAuthProviderRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
};

watch(
  () => [screenMode.value, activeProviderId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedProvider.value = null;
      return;
    }

    if (mode === 'create') {
      selectedProvider.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadProviderDetail(id);
    if (mode === 'edit' && selectedProvider.value) {
      assignForm(selectedProvider.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadData();
});
</script>

<style scoped lang="scss">
.provider-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.provider-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.provider-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.provider-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.provider-screen__identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-screen__logo {
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

.provider-screen__logo--image {
  background: var(--surface-image-tile);
  border: 1px solid var(--line-soft);
}

.provider-screen__logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
