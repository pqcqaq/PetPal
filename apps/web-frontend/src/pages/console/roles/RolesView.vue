<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadRoles">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出角色失败" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          新建角色
        </el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回角色清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && activeRoleId" type="primary" @click="openEditById">
          编辑角色
        </el-button>
        <el-button v-if="isFormMode" type="primary" :loading="saving" @click="saveRole">
          {{ screenMode === 'create' ? '创建角色' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <RolesToolbar
        :filters="pageState.filters"
        :permission-options="permissionOptions"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <SurfacePanel
      :caption="screenHeader.caption"
      :title="screenHeader.title"
      :description="screenHeader.description"
    >
      <div v-if="screenHeader.meta.length" class="roles-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="roles-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <RolesTable
      v-if="isListMode"
      :roles="roles"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="roleContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeRole"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="角色详情"
      title="角色信息与权限构成"
      description="详情页只用来看角色资料、成员影响和权限清单，不再混入编辑动作。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedRole">
          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Role Profile</p>
                <h3 class="panel-heading panel-heading--md">{{ selectedRole.name }}</h3>
                <p class="muted">{{ selectedRole.description || '该角色未填写描述。' }}</p>
              </div>
              <el-space wrap>
                <el-tag :type="selectedRole.isSystem ? 'warning' : 'info'" round>
                  {{ selectedRole.isSystem ? '系统角色' : '自定义角色' }}
                </el-tag>
                <el-tag :type="selectedRole.isDefault ? 'success' : 'info'" round>
                  {{ selectedRole.isDefault ? '默认继承' : '手动分配' }}
                </el-tag>
                <el-button v-if="canEdit" link @click="openEditById">编辑</el-button>
                <el-button
                  v-if="canDelete && !selectedRole.isSystem"
                  link
                  type="danger"
                  @click="removeRole(selectedRole)"
                >
                  删除
                </el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>角色编码</span>
                <strong>{{ selectedRole.code }}</strong>
              </div>
              <div class="detail-kv">
                <span>成员数量</span>
                <strong>{{ selectedRole.userCount }}</strong>
              </div>
              <div class="detail-kv">
                <span>权限数量</span>
                <strong>{{ selectedRole.permissionCount }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedRole.updatedAt) }}</strong>
              </div>
              <div class="detail-kv">
                <span>创建时间</span>
                <strong>{{ formatTime(selectedRole.createdAt) }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Attached Permissions</p>
                <h3 class="panel-heading panel-heading--md">权限构成</h3>
              </div>
              <el-tag type="info" round>{{ selectedRole.permissions.length }} 项权限</el-tag>
            </div>

            <div v-if="selectedRole.permissions.length" class="detail-chip-list">
              <span v-for="permission in selectedRole.permissions" :key="permission.id" class="permission-tag">
                {{ permission.code }}
              </span>
            </div>
            <el-empty v-else description="这个角色还没有绑定权限。" />
          </section>
        </template>

        <el-empty v-else description="没有找到这个角色，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建角色' : '编辑角色'"
      :title="screenMode === 'create' ? '角色创建只在这里完成' : '角色修改只在这里完成'"
      :description="screenMode === 'create'
        ? '创建页只负责角色信息和权限分配。'
        : '编辑页只保留当前角色需要修改的字段。'"
    >
      <el-form v-loading="panelLoading" label-position="top" class="page-form-grid">
        <el-form-item label="角色编码">
          <el-input v-model="form.code" :disabled="systemRoleLocked" />
        </el-form-item>
        <el-form-item label="角色名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="角色描述" class="page-form-grid__full">
          <el-input v-model="form.description" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="默认角色">
          <el-switch v-model="form.isDefault" />
          <p class="roles-screen__form-note">新注册用户会自动继承所有标记为默认的角色。</p>
        </el-form-item>
        <RelationSelectFormItem
          v-model="form.permissionIds"
          class="page-form-grid__full"
          label="分配权限"
          dialog-title="选择角色权限"
          trigger-text="选择权限"
          :request="loadPermissionSelections"
          :search-defaults="{ q: '' }"
          :disabled="!canAssignPermissions"
          multiple
          layout="card"
        >
          <template #search="{ params, search, reset }">
            <div class="roles-screen__relation-search">
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
            <div class="roles-screen__relation-card" :class="{ 'is-selected': selected }">
              <div class="roles-screen__relation-card-head">
                <strong>{{ row.name }}</strong>
                <span class="roles-screen__relation-badge">{{ selected ? '已选' : '选择' }}</span>
              </div>
              <span>{{ row.code }}</span>
              <p>{{ row.module }} · {{ row.action }}</p>
            </div>
          </template>
        </RelationSelectFormItem>
        <p class="roles-screen__form-note page-form-grid__full">
          至少为角色分配一项权限。系统角色的编码保持锁定，避免误改基础权限结构。
        </p>
      </el-form>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { PermissionSummary, RoleFormPayload, RoleRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { fetchAllPaginatedItems } from '@/utils/paginated';
import RolesTable from './components/RolesTable.vue';
import RolesToolbar from './components/RolesToolbar.vue';

defineOptions({ name: 'RolesView' });

definePage({
  viewKey: 'roles',
  keepAlive: true,
});

type RolesPageState = {
  filters: {
    q: string;
    permissionId: string;
    roleType: '' | 'system' | 'custom';
  };
  page: number;
};

type RoleEditorForm = {
  code: string;
  name: string;
  description: string;
  isDefault: boolean;
  permissionIds: string[];
};

type RoleScreenMode = 'list' | 'create' | 'edit' | 'detail';

const createEmptyForm = (): RoleEditorForm => ({
  code: '',
  name: '',
  description: '',
  isDefault: false,
  permissionIds: [],
});

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const roles = ref<RoleRecord[]>([]);
const selectedRole = ref<RoleRecord | null>(null);
const permissionOptions = ref<PermissionSummary[]>([]);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const total = ref(0);
const pageSize = 10;
const loadPermissionSelections = api.roles.permissions;
const form = reactive<RoleEditorForm>(createEmptyForm());
const systemRoleLocked = ref(false);

const { state: pageState } = usePageState<RolesPageState>('page:roles', {
  filters: {
    q: '',
    permissionId: '',
    roleType: '',
  },
  page: 1,
});

const allowedModes: RoleScreenMode[] = ['list', 'create', 'edit', 'detail'];
const screenMode = computed<RoleScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as RoleScreenMode) ? (value as RoleScreenMode) : 'list';
});
const activeRoleId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('role.create') && auth.hasPermission('role.assign-permission'));
const canEdit = computed(() => auth.hasPermission('role.update'));
const canDelete = computed(() => auth.hasPermission('role.delete'));
const canAssignPermissions = computed(() => auth.hasPermission('role.assign-permission'));

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  const systemRoleCount = roles.value.filter((item) => item.isSystem).length;
  const defaultRoleCount = roles.value.filter((item) => item.isDefault).length;
  const memberCount = roles.value.reduce((sum, item) => sum + item.userCount, 0);

  return [
    { label: '角色总数', value: total.value },
    { label: '当前页系统角色', value: systemRoleCount },
    { label: '当前页默认角色', value: defaultRoleCount },
    { label: '当前页成员', value: memberCount },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'Roles Workspace',
      title: '角色清单只负责筛选和进入下一步',
      description: '列表页不再承担详情和编辑弹窗，查看与修改都切到单独任务态。',
      meta: [
        { label: '当前页记录', value: String(roles.value.length) },
        { label: '筛选权限', value: pageState.filters.permissionId ? '已限定' : '全部权限' },
      ],
    };
  }

  if (isDetailMode.value && selectedRole.value) {
    return {
      caption: 'Role Detail',
      title: selectedRole.value.name,
      description: '详情页只展示角色信息、成员影响和权限构成。',
      meta: [
        { label: '角色编码', value: selectedRole.value.code },
        { label: '角色类型', value: selectedRole.value.isSystem ? '系统角色' : '自定义角色' },
      ],
    };
  }

  return {
    caption: 'Role Form',
    title: screenMode.value === 'create' ? '创建角色' : '编辑角色',
    description: screenMode.value === 'create'
      ? '新角色只在这个界面完成创建。'
      : '编辑页只保留当前角色需要修改的字段。',
    meta: [],
  };
});

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  permissionId: pageState.filters.permissionId || undefined,
  roleType: pageState.filters.roleType || undefined,
});

const buildExportRequest = () => api.roles.export(buildFilterParams());

const formatTime = (value: string) => new Date(value).toLocaleString();

const resetForm = () => {
  Object.assign(form, createEmptyForm());
  systemRoleLocked.value = false;
};

const assignForm = (role: RoleRecord) => {
  form.code = role.code;
  form.name = role.name;
  form.description = role.description ?? '';
  form.isDefault = role.isDefault;
  form.permissionIds = role.permissions.map((permission) => permission.id);
  systemRoleLocked.value = role.isSystem;
};

const navigateToMode = async (mode: RoleScreenMode, id?: string) => {
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

const openEdit = async (row: RoleRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeRoleId.value) {
    return;
  }
  await navigateToMode('edit', activeRoleId.value);
};

const openDetail = async (row: RoleRecord) => {
  await navigateToMode('detail', row.id);
};

const loadRoles = async () => {
  try {
    loading.value = true;
    const response = await api.roles.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });
    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadRoles();
      return;
    }
    roles.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载角色列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadPermissionOptions = async () => {
  try {
    permissionOptions.value = await fetchAllPaginatedItems(api.roles.permissions);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载权限选项失败'));
  }
};

const loadRoleDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedRole.value = await api.roles.detail(id);
  } catch (error: unknown) {
    selectedRole.value = null;
    ElMessage.error(getErrorMessage(error, '加载角色详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadRoles();
    return;
  }

  if (!activeRoleId.value) {
    return;
  }

  await loadRoleDetail(activeRoleId.value);
  if (screenMode.value === 'edit' && selectedRole.value) {
    assignForm(selectedRole.value);
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadRoles();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.permissionId = '';
  pageState.filters.roleType = '';
  pageState.page = 1;
  await loadRoles();
};

const validateForm = () => {
  if (!form.code.trim() || !form.name.trim()) {
    return '请完整填写角色编码和角色名称';
  }

  if (!form.permissionIds.length) {
    return '至少为角色分配一项权限';
  }

  return '';
};

const saveRole = async () => {
  const validationMessage = validateForm();
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: RoleFormPayload = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    isDefault: form.isDefault,
    permissionIds: form.permissionIds,
  };

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activeRoleId.value
      ? await api.roles.update(activeRoleId.value, payload)
      : await api.roles.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? '角色已更新' : '角色已创建');
    await Promise.all([loadRoles(), loadPermissionOptions()]);
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存角色失败' : '创建角色失败'));
  } finally {
    saving.value = false;
  }
};

const removeRole = async (row: RoleRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除角色“${row.name}”吗？删除后不可恢复。`,
      '删除角色',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.roles.remove(row.id);
    ElMessage.success('角色已删除');
    await loadRoles();
    if (activeRoleId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除角色失败'));
  }
};

const roleContextMenuItems = [
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
    label: '编辑角色',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除角色',
    hidden: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removeRole(row),
  },
] satisfies ContextMenuItem<RoleRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadRoles();
};

watch(
  () => [screenMode.value, activeRoleId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedRole.value = null;
      systemRoleLocked.value = false;
      return;
    }

    if (mode === 'create') {
      selectedRole.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadRoleDetail(id);
    if (mode === 'edit' && selectedRole.value) {
      assignForm(selectedRole.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await Promise.all([loadRoles(), loadPermissionOptions()]);
});
</script>

<style scoped lang="scss">
.roles-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.roles-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.roles-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.roles-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.roles-screen__relation-search {
  display: flex;
  gap: 10px;
}

.roles-screen__relation-search :deep(.el-input) {
  flex: 1;
}

.roles-screen__relation-card {
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

.roles-screen__relation-card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.roles-screen__relation-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.roles-screen__relation-badge {
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

.roles-screen__relation-card strong {
  font-size: 14px;
  line-height: 1.4;
}

.roles-screen__relation-card span,
.roles-screen__relation-card p,
.roles-screen__form-note {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .roles-screen__relation-search {
    flex-direction: column;
  }
}
</style>
