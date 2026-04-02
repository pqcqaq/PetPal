<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出客户端失败" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">新增客户端</el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回客户端清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && activeClientId" type="primary" @click="openEditById">
          编辑客户端
        </el-button>
        <el-button v-if="isFormMode" type="primary" :loading="saving" @click="saveClient">
          {{ screenMode === 'create' ? '创建客户端' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <ClientToolbar
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
      <div v-if="screenHeader.meta.length" class="clients-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="clients-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <ClientsTable
      v-if="isListMode"
      :clients="clients"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :enabled-count="enabledCount"
      :disabled-count="disabledCount"
      :context-menu-items="clientContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeClient"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="客户端详情"
      title="身份配置与连接信息"
      description="详情页只负责查看当前客户端的类型、状态和类型配置，不再用抽屉覆盖列表。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedClient">
          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Client</p>
                <h3 class="panel-heading panel-heading--md">{{ selectedClient.name }}</h3>
                <p class="muted">{{ selectedClient.description || '该客户端未填写描述。' }}</p>
              </div>
              <el-space wrap>
                <el-tag effect="light" round>{{ resolveClientTypeLabel(selectedClient.type) }}</el-tag>
                <el-tag :type="selectedClient.enabled ? 'success' : 'info'" round>
                  {{ selectedClient.enabled ? '启用' : '禁用' }}
                </el-tag>
                <el-button v-if="canEdit" link @click="openEditById">编辑</el-button>
                <el-button v-if="canDelete" link type="danger" @click="removeClient(selectedClient)">删除</el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>客户端编码</span>
                <strong>{{ selectedClient.code }}</strong>
              </div>
              <div class="detail-kv">
                <span>客户端类型</span>
                <strong>{{ resolveClientTypeLabel(selectedClient.type) }}</strong>
              </div>
              <div class="detail-kv">
                <span>状态</span>
                <strong>{{ selectedClient.enabled ? '启用' : '禁用' }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedClient.updatedAt) }}</strong>
              </div>
              <div class="detail-kv">
                <span>创建时间</span>
                <strong>{{ formatTime(selectedClient.createdAt) }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Config</p>
                <h3 class="panel-heading panel-heading--md">类型配置</h3>
              </div>
            </div>
            <div class="detail-kv-grid">
              <div v-for="item in configEntries" :key="item.label" class="detail-kv">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个客户端，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建客户端' : '编辑客户端'"
      :title="screenMode === 'create' ? '客户端身份只在这里创建' : '客户端配置只在这里修改'"
      :description="screenMode === 'create'
        ? '创建页按身份信息和类型配置分段组织，不再通过弹窗堆叠字段。'
        : '编辑页保留同样结构，方便快速定位要修改的连接参数。'"
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
            <el-form-item label="客户端编码">
              <el-input v-model="form.code" />
            </el-form-item>

            <el-form-item label="客户端名称">
              <el-input v-model="form.name" />
            </el-form-item>

            <el-form-item label="客户端类型">
              <el-select v-model="form.type">
                <el-option label="Web" :value="AuthClientType.WEB" />
                <el-option label="微信小程序" :value="AuthClientType.UNI_WECHAT_MINIAPP" />
                <el-option label="App" :value="AuthClientType.APP" />
              </el-select>
            </el-form-item>

            <el-form-item label="状态">
              <el-switch
                v-model="form.enabled"
                inline-prompt
                active-text="启用"
                inactive-text="禁用"
              />
            </el-form-item>

            <el-form-item label="描述" class="page-form-grid__full">
              <el-input v-model="form.description" type="textarea" :rows="3" maxlength="120" show-word-limit />
            </el-form-item>

            <el-form-item label="Client Secret" class="page-form-grid__full">
              <el-input
                v-model="form.clientSecret"
                show-password
                :placeholder="screenMode === 'edit' ? '留空表示不变更当前 secret' : '不少于 16 位'"
              />
            </el-form-item>
          </el-form>
        </section>

        <section class="detail-section">
          <div class="detail-section__header">
            <div>
              <p class="panel-caption">Type Config</p>
              <h3 class="panel-heading panel-heading--md">类型配置</h3>
              <p class="muted">不同客户端类型显示不同的连接字段，避免在一个面板塞满无关配置。</p>
            </div>
            <el-tag effect="light" round>{{ resolveClientTypeLabel(form.type) }}</el-tag>
          </div>

          <el-form label-position="top" class="page-form-grid">
            <ClientConfigFields :type="form.type" :config="form.config" />
          </el-form>
        </section>
      </div>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { AuthClientType, type AuthClientFormPayload, type AuthClientRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  assignClientEditorForm,
  buildClientConfigEntries,
  buildClientPayload,
  createEmptyClientEditorForm,
  formatClientConfigSummary,
  resolveClientTypeLabel,
  type ClientEditorForm,
  validateClientForm,
} from './client-management';
import ClientConfigFields from './components/ClientConfigFields.vue';
import ClientsTable from './components/ClientsTable.vue';
import ClientToolbar from './components/ClientToolbar.vue';

defineOptions({ name: 'ClientsView' });

definePage({
  viewKey: 'clients',
  keepAlive: true,
});

type ClientsPageState = {
  filters: {
    q: string;
    type: '' | AuthClientType;
    enabled: '' | 'enabled' | 'disabled';
  };
  page: number;
};

type ClientScreenMode = 'list' | 'create' | 'edit' | 'detail';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const clients = ref<AuthClientRecord[]>([]);
const selectedClient = ref<AuthClientRecord | null>(null);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const total = ref(0);
const pageSize = 10;
const form = reactive<ClientEditorForm>(createEmptyClientEditorForm());

const { state: pageState } = usePageState<ClientsPageState>('page:clients', {
  filters: {
    q: '',
    type: '',
    enabled: '',
  },
  page: 1,
});

const allowedModes: ClientScreenMode[] = ['list', 'create', 'edit', 'detail'];
const screenMode = computed<ClientScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as ClientScreenMode) ? (value as ClientScreenMode) : 'list';
});
const activeClientId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('client.create'));
const canEdit = computed(() => auth.hasPermission('client.update'));
const canDelete = computed(() => auth.hasPermission('client.delete'));
const enabledCount = computed(() => clients.value.filter((item) => item.enabled).length);
const disabledCount = computed(() => clients.value.filter((item) => !item.enabled).length);
const miniappCount = computed(() => clients.value.filter((item) => item.type === AuthClientType.UNI_WECHAT_MINIAPP).length);
const configEntries = computed(() => (selectedClient.value ? buildClientConfigEntries(selectedClient.value) : []));

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  return [
    { label: '客户端总数', value: total.value },
    { label: '当前页启用', value: enabledCount.value },
    { label: '当前页禁用', value: disabledCount.value },
    { label: '当前页小程序', value: miniappCount.value },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'Clients Workspace',
      title: '客户端清单只负责筛选和进入下一步',
      description: '列表页只保留检索和进入详情，配置编辑不再在弹窗里堆所有字段。',
      meta: [
        { label: '当前页记录', value: String(clients.value.length) },
        { label: '筛选类型', value: pageState.filters.type ? resolveClientTypeLabel(pageState.filters.type) : '全部类型' },
      ],
    };
  }

  if (isDetailMode.value && selectedClient.value) {
    return {
      caption: 'Client Detail',
      title: selectedClient.value.name,
      description: '详情页只展示客户端身份和类型配置。',
      meta: [
        { label: '客户端编码', value: selectedClient.value.code },
        { label: '连接摘要', value: formatClientConfigSummary(selectedClient.value) },
      ],
    };
  }

  return {
    caption: 'Client Form',
    title: screenMode.value === 'create' ? '新增客户端' : '编辑客户端',
    description: screenMode.value === 'create'
      ? '新客户端只在这个界面完成创建。'
      : '编辑页按身份和类型配置分段展示，避免信息挤在一起。',
    meta: [],
  };
});

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  type: pageState.filters.type || undefined,
  enabled: pageState.filters.enabled || undefined,
});

const buildExportRequest = () => api.clients.export(buildFilterParams());

const formatTime = (value: string) => new Date(value).toLocaleString();

const resetForm = () => {
  Object.assign(form, createEmptyClientEditorForm());
};

const assignForm = (client: AuthClientRecord) => {
  assignClientEditorForm(form, client);
};

const navigateToMode = async (mode: ClientScreenMode, id?: string) => {
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

const openEdit = async (row: AuthClientRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeClientId.value) {
    return;
  }
  await navigateToMode('edit', activeClientId.value);
};

const openDetail = async (row: AuthClientRecord) => {
  await navigateToMode('detail', row.id);
};

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.clients.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });

    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadData();
      return;
    }

    clients.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载客户端列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadClientDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedClient.value = await api.clients.detail(id);
  } catch (error: unknown) {
    selectedClient.value = null;
    ElMessage.error(getErrorMessage(error, '加载客户端详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadData();
    return;
  }

  if (!activeClientId.value) {
    return;
  }

  await loadClientDetail(activeClientId.value);
  if (screenMode.value === 'edit' && selectedClient.value) {
    assignForm(selectedClient.value);
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.type = '';
  pageState.filters.enabled = '';
  pageState.page = 1;
  await loadData();
};

const saveClient = async () => {
  const validationMessage = validateClientForm(form, screenMode.value === 'edit' ? activeClientId.value || null : null);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: AuthClientFormPayload = buildClientPayload(form);

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activeClientId.value
      ? await api.clients.update(activeClientId.value, payload)
      : await api.clients.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? '客户端已更新' : '客户端已创建');
    await loadData();
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存客户端失败' : '创建客户端失败'));
  } finally {
    saving.value = false;
  }
};

const removeClient = async (row: AuthClientRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除客户端“${row.name}（${row.code}）”吗？删除后不可恢复。`,
      '删除客户端',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.clients.remove(row.id);
    ElMessage.success('客户端已删除');
    await loadData();
    if (activeClientId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除客户端失败'));
  }
};

const clientContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'summary',
    label: '复制配置摘要',
    onSelect: async (row) => {
      try {
        await navigator.clipboard.writeText(formatClientConfigSummary(row));
        ElMessage.success('配置摘要已复制');
      } catch {
        ElMessage.warning('当前环境不支持复制');
      }
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑客户端',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除客户端',
    hidden: () => !canDelete.value,
    danger: true,
    onSelect: (row) => removeClient(row),
  },
  {
    key: 'type',
    label: '查看类型',
    onSelect: (row) => {
      ElMessage.info(`客户端类型：${resolveClientTypeLabel(row.type)}`);
    },
  },
  {
    key: 'config',
    label: '查看配置摘要',
    onSelect: (row) => {
      ElMessage.info(formatClientConfigSummary(row));
    },
  },
] satisfies ContextMenuItem<AuthClientRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

watch(
  () => [screenMode.value, activeClientId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedClient.value = null;
      return;
    }

    if (mode === 'create') {
      selectedClient.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadClientDetail(id);
    if (mode === 'edit' && selectedClient.value) {
      assignForm(selectedClient.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadData();
});
</script>

<style scoped lang="scss">
.clients-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.clients-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.clients-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.clients-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}
</style>
