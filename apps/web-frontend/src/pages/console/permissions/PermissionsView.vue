<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出权限失败" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">新增权限</el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回权限清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button
          v-if="isDetailMode && canEdit && activePermissionId"
          type="primary"
          @click="openEditById"
        >
          编辑权限
        </el-button>
        <el-button v-if="isFormMode" type="primary" :loading="saving" @click="savePermission">
          {{ screenMode === 'create' ? '创建权限' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <PermissionsToolbar
        :filters="pageState.filters"
        :module-options="moduleOptions"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <SurfacePanel
      :caption="screenHeader.caption"
      :title="screenHeader.title"
      :description="screenHeader.description"
    >
      <div v-if="screenHeader.meta.length" class="permissions-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="permissions-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <PermissionsTable
      v-if="isListMode"
      :permissions="permissions"
      :loading="loading"
      :seed-count="seedCount"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="permissionContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removePermission"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="权限详情"
      title="权限编码与作用范围"
      description="详情页只展示权限本身，不再和编辑表单混合。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedPermission">
          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Permission Profile</p>
                <h3 class="panel-heading panel-heading--md">{{ selectedPermission.code }}</h3>
                <p class="muted">{{ selectedPermission.description || '该权限未填写描述。' }}</p>
              </div>
              <el-space wrap>
                <el-tag :type="selectedPermission.isSystem ? 'warning' : 'info'" round>
                  {{ selectedPermission.isSystem ? '系统种子' : '自定义权限' }}
                </el-tag>
                <el-button v-if="canEdit" link @click="openEditById">编辑</el-button>
                <el-button
                  v-if="canDelete && !selectedPermission.isSystem"
                  link
                  type="danger"
                  @click="removePermission(selectedPermission)"
                >
                  删除
                </el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>权限名称</span>
                <strong>{{ selectedPermission.name }}</strong>
              </div>
              <div class="detail-kv">
                <span>模块</span>
                <strong>{{ selectedPermission.module }}</strong>
              </div>
              <div class="detail-kv">
                <span>动作</span>
                <strong>{{ selectedPermission.action }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedPermission.updatedAt) }}</strong>
              </div>
              <div class="detail-kv">
                <span>创建时间</span>
                <strong>{{ formatTime(selectedPermission.createdAt) }}</strong>
              </div>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个权限，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建权限' : '编辑权限'"
      :title="screenMode === 'create' ? '权限创建只在这里完成' : '权限修改只在这里完成'"
      :description="screenMode === 'create'
        ? '创建页只负责权限编码、模块和动作的定义。'
        : '编辑页只保留当前权限需要修改的字段。'"
    >
      <el-form v-loading="panelLoading" label-position="top" class="page-form-grid">
        <el-form-item label="权限码" class="page-form-grid__full">
          <el-input v-model="form.code" :disabled="seedPermissionLocked" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="模块">
          <el-input v-model="form.module" :disabled="seedPermissionLocked" />
        </el-form-item>
        <el-form-item label="动作">
          <el-input v-model="form.action" :disabled="seedPermissionLocked" />
        </el-form-item>
        <el-form-item label="描述" class="page-form-grid__full">
          <el-input v-model="form.description" type="textarea" :rows="4" />
        </el-form-item>
        <p class="permissions-screen__form-note page-form-grid__full">
          系统种子权限的编码、模块和动作会保持锁定，只允许补充说明或局部修正展示信息。
        </p>
      </el-form>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { PermissionFormPayload, PermissionRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PermissionsTable from './components/PermissionsTable.vue';
import PermissionsToolbar from './components/PermissionsToolbar.vue';

defineOptions({ name: 'PermissionsView' });

definePage({
  viewKey: 'permissions',
  keepAlive: true,
});

type PermissionsPageState = {
  filters: {
    q: string;
    module: string;
    sourceType: '' | 'seed' | 'custom';
  };
  page: number;
};

type PermissionEditorForm = {
  code: string;
  name: string;
  module: string;
  action: string;
  description: string;
};

type PermissionScreenMode = 'list' | 'create' | 'edit' | 'detail';

const createEmptyForm = (): PermissionEditorForm => ({
  code: '',
  name: '',
  module: '',
  action: '',
  description: '',
});

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const permissions = ref<PermissionRecord[]>([]);
const moduleOptions = ref<string[]>([]);
const selectedPermission = ref<PermissionRecord | null>(null);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const total = ref(0);
const pageSize = 10;
const form = reactive<PermissionEditorForm>(createEmptyForm());

const { state: pageState } = usePageState<PermissionsPageState>('page:permissions', {
  filters: {
    q: '',
    module: '',
    sourceType: '',
  },
  page: 1,
});

const allowedModes: PermissionScreenMode[] = ['list', 'create', 'edit', 'detail'];
const screenMode = computed<PermissionScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as PermissionScreenMode) ? (value as PermissionScreenMode) : 'list';
});
const activePermissionId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('permission.create'));
const canEdit = computed(() => auth.hasPermission('permission.update'));
const canDelete = computed(() => auth.hasPermission('permission.delete'));
const seedPermissionLocked = computed(() => screenMode.value === 'edit' && Boolean(selectedPermission.value?.isSystem));
const seedCount = computed(() => permissions.value.filter((item) => item.isSystem).length);
const customCount = computed(() => permissions.value.length - seedCount.value);

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  return [
    { label: '权限总数', value: total.value },
    { label: '当前页系统种子', value: seedCount.value },
    { label: '当前页自定义', value: customCount.value },
    { label: '模块目录', value: moduleOptions.value.length },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'Permissions Workspace',
      title: '权限清单只负责筛选和进入下一步',
      description: '列表页只保留检索和进入详情，新增、编辑、删除不再通过弹窗打断浏览。',
      meta: [
        { label: '当前页记录', value: String(permissions.value.length) },
        { label: '筛选模块', value: pageState.filters.module || '全部模块' },
      ],
    };
  }

  if (isDetailMode.value && selectedPermission.value) {
    return {
      caption: 'Permission Detail',
      title: selectedPermission.value.code,
      description: '详情页只展示权限定义与来源类型。',
      meta: [
        { label: '模块', value: selectedPermission.value.module },
        { label: '动作', value: selectedPermission.value.action },
      ],
    };
  }

  return {
    caption: 'Permission Form',
    title: screenMode.value === 'create' ? '新增权限' : '编辑权限',
    description: screenMode.value === 'create'
      ? '新权限只在这个界面完成创建。'
      : '编辑页只保留权限本身需要修改的字段。',
    meta: [],
  };
});

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  module: pageState.filters.module || undefined,
  sourceType: pageState.filters.sourceType || undefined,
});

const buildExportRequest = () => api.permissions.export(buildFilterParams());

const formatTime = (value: string) => new Date(value).toLocaleString();

const resetForm = () => {
  Object.assign(form, createEmptyForm());
};

const assignForm = (permission: PermissionRecord) => {
  form.code = permission.code;
  form.name = permission.name;
  form.module = permission.module;
  form.action = permission.action;
  form.description = permission.description ?? '';
};

const navigateToMode = async (mode: PermissionScreenMode, id?: string) => {
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

const openEdit = async (row: PermissionRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activePermissionId.value) {
    return;
  }
  await navigateToMode('edit', activePermissionId.value);
};

const openDetail = async (row: PermissionRecord) => {
  await navigateToMode('detail', row.id);
};

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.permissions.list({
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
    permissions.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载权限列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadModuleOptions = async () => {
  try {
    moduleOptions.value = await api.permissions.modules();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载模块选项失败'));
  }
};

const loadPermissionDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedPermission.value = await api.permissions.detail(id);
  } catch (error: unknown) {
    selectedPermission.value = null;
    ElMessage.error(getErrorMessage(error, '加载权限详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await Promise.all([loadData(), loadModuleOptions()]);
    return;
  }

  if (!activePermissionId.value) {
    return;
  }

  await loadPermissionDetail(activePermissionId.value);
  if (screenMode.value === 'edit' && selectedPermission.value) {
    assignForm(selectedPermission.value);
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.module = '';
  pageState.filters.sourceType = '';
  pageState.page = 1;
  await loadData();
};

const validateForm = () => {
  if (!form.code.trim() || !form.name.trim() || !form.module.trim() || !form.action.trim()) {
    return '请完整填写权限码、名称、模块和动作';
  }

  return '';
};

const savePermission = async () => {
  const validationMessage = validateForm();
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: PermissionFormPayload = {
    code: form.code.trim(),
    name: form.name.trim(),
    module: form.module.trim(),
    action: form.action.trim(),
    description: form.description.trim(),
  };

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activePermissionId.value
      ? await api.permissions.update(activePermissionId.value, payload)
      : await api.permissions.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? '权限已更新' : '权限已新增');
    await Promise.all([loadData(), loadModuleOptions()]);
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存权限失败' : '创建权限失败'));
  } finally {
    saving.value = false;
  }
};

const removePermission = async (row: PermissionRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除权限“${row.code}”吗？删除后不可恢复。`,
      '删除权限',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.permissions.remove(row.id);
    ElMessage.success('权限已删除');
    await Promise.all([loadData(), loadModuleOptions()]);
    if (activePermissionId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除权限失败'));
  }
};

const permissionContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'edit-divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑权限',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除权限',
    hidden: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removePermission(row),
  },
] satisfies ContextMenuItem<PermissionRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

watch(
  () => [screenMode.value, activePermissionId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedPermission.value = null;
      return;
    }

    if (mode === 'create') {
      selectedPermission.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadPermissionDetail(id);
    if (mode === 'edit' && selectedPermission.value) {
      assignForm(selectedPermission.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await Promise.all([loadData(), loadModuleOptions()]);
});
</script>

<style scoped lang="scss">
.permissions-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.permissions-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.permissions-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.permissions-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.permissions-screen__form-note {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}
</style>
