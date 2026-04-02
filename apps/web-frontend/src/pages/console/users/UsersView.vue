<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadUsers">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出用户失败" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          创建用户
        </el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回用户清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && activeUserId" type="primary" @click="openEditById">
          编辑用户
        </el-button>
        <el-button
          v-if="isFormMode"
          type="primary"
          :loading="saving"
          @click="saveUser"
        >
          {{ screenMode === 'create' ? '创建用户' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <UsersToolbar
        :filters="pageState.filters"
        :role-options="roleOptions"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <SurfacePanel
      :caption="screenHeader.caption"
      :title="screenHeader.title"
      :description="screenHeader.description"
    >
      <div v-if="screenHeader.meta.length" class="users-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="users-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <UsersTable
      v-if="isListMode"
      :users="users"
      :loading="loading"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="userContextMenuItems"
      @detail="openDetail"
      @permission-source="openPermissionSource"
      @edit="openEdit"
      @delete="removeUser"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="用户详情"
      title="账号信息与角色绑定"
      description="详情页只查看资料和角色，不再夹杂编辑表单。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedUser">
          <section class="detail-section">
            <div class="detail-section__header">
              <div class="table-user">
                <UserAvatar :avatar-url="selectedUser.avatarUrl" :name="selectedUser.nickname" size="lg" />
                <div class="table-user__meta">
                  <strong>{{ selectedUser.nickname }}</strong>
                  <span>{{ selectedUser.email || selectedUser.username }}</span>
                </div>
              </div>
              <el-space wrap>
                <el-tag :type="selectedUser.status === 'ACTIVE' ? 'success' : 'info'" round>
                  {{ selectedUser.status === 'ACTIVE' ? '启用' : '禁用' }}
                </el-tag>
                <el-button v-if="canExplore" link @click="openPermissionSourceById">权限来源</el-button>
                <el-button v-if="canEdit" link @click="openEditById">编辑</el-button>
                <el-button v-if="canDelete" link type="danger" @click="removeUser(selectedUser)">删除</el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>用户名</span>
                <strong>{{ selectedUser.username }}</strong>
              </div>
              <div class="detail-kv">
                <span>邮箱</span>
                <strong>{{ selectedUser.email || '未设置邮箱' }}</strong>
              </div>
              <div class="detail-kv">
                <span>创建时间</span>
                <strong>{{ formatTime(selectedUser.createdAt) }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedUser.updatedAt) }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Assigned Roles</p>
                <h3 class="panel-heading panel-heading--md">角色绑定</h3>
              </div>
              <el-tag type="info" round>{{ selectedUser.roles.length }} 个角色</el-tag>
            </div>
            <div class="detail-chip-list">
              <span v-for="role in selectedUser.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个用户，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isPermissionMode"
      caption="权限来源"
      title="这个账号为什么拥有这些权限"
      description="权限来源页单独展开有效权限和角色来源，不和用户详情或编辑页混在一起。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="permissionSource">
          <section class="detail-section">
            <div class="detail-section__header">
              <div class="table-user">
                <UserAvatar :avatar-url="permissionSource.user.avatarUrl" :name="permissionSource.user.nickname" size="lg" />
                <div class="table-user__meta">
                  <strong>{{ permissionSource.user.nickname }}</strong>
                  <span>{{ permissionSource.user.email || permissionSource.user.username }}</span>
                </div>
              </div>
              <el-tag round>{{ permissionSource.effectivePermissions.length }} 项权限</el-tag>
            </div>
            <div class="detail-chip-list">
              <span
                v-for="permission in permissionSource.effectivePermissions"
                :key="permission.id"
                class="permission-tag"
              >
                {{ permission.code }}
              </span>
            </div>
          </section>

          <section v-for="group in permissionSource.groups" :key="group.role.id" class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Role Source</p>
                <h3 class="panel-heading panel-heading--md">{{ group.role.name }}</h3>
                <p class="muted">{{ group.role.description || '该角色未填写描述。' }}</p>
              </div>
              <el-tag type="info" round>{{ group.permissions.length }} 项来源</el-tag>
            </div>
            <div class="detail-chip-list">
              <span v-for="permission in group.permissions" :key="permission.id" class="permission-tag">
                {{ permission.code }}
              </span>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到权限来源数据。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建用户' : '编辑用户'"
      :title="screenMode === 'create' ? '新账号只在这里创建' : '资料修改只在这里完成'"
      :description="screenMode === 'create'
        ? '创建页只负责账号基础信息和角色绑定。'
        : '编辑页只负责更新资料和账号状态，不再覆盖详情视图。'"
    >
      <el-form v-loading="panelLoading" label-position="top" class="page-form-grid">
        <el-form-item label="用户名">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="form.nickname" />
        </el-form-item>
        <el-form-item label="邮箱" class="page-form-grid__full">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="密码" class="page-form-grid__full">
          <el-input
            v-model="form.password"
            show-password
            :placeholder="screenMode === 'edit' ? '留空表示不修改密码' : '请输入初始密码'"
          />
        </el-form-item>
        <ImageSelectFormItem
          v-model="form.avatarFileId"
          class="page-form-grid__full"
          label="头像"
          dialog-title="选择头像"
          trigger-text="选择头像"
          upload-kind="avatar"
          :max-width="DEFAULT_AVATAR_IMAGE_MAX_WIDTH"
          :max-height="DEFAULT_AVATAR_IMAGE_MAX_HEIGHT"
          :upload-enabled="canUploadImages"
          :allow-clear="true"
        >
          <template #search="{ params, search, reset }">
            <div class="users-screen__relation-search">
              <el-input
                v-model="params.q"
                clearable
                placeholder="搜索图片名称、标签或上传者"
                @keyup.enter="search"
              />
              <el-button @click="search">搜索</el-button>
              <el-button @click="reset">重置</el-button>
            </div>
          </template>
        </ImageSelectFormItem>
        <el-form-item label="状态">
          <el-select v-model="form.status">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="禁用" value="DISABLED" />
          </el-select>
        </el-form-item>
        <RelationSelectFormItem
          v-model="form.roleIds"
          class="page-form-grid__full"
          label="角色"
          dialog-title="选择角色"
          trigger-text="选择角色"
          :request="loadRoleSelections"
          :search-defaults="{ q: '' }"
          :disabled="!canAssignRoles"
          multiple
          layout="card"
        >
          <template #search="{ params, search, reset }">
            <div class="users-screen__relation-search">
              <el-input
                v-model="params.q"
                clearable
                placeholder="搜索角色名称或编码"
                @keyup.enter="search"
              />
              <el-button @click="search">搜索</el-button>
              <el-button @click="reset">重置</el-button>
            </div>
          </template>

          <template #row="{ row, selected }">
            <div
              class="users-screen__relation-card"
              :class="{ 'is-selected': selected }"
            >
              <div class="users-screen__relation-card-head">
                <strong>{{ row.name }}</strong>
                <span class="users-screen__relation-badge">
                  {{ selected ? '已选' : '选择' }}
                </span>
              </div>
              <span>{{ row.code }}</span>
              <p v-if="row.description">{{ row.description }}</p>
            </div>
          </template>
        </RelationSelectFormItem>
        <p class="users-screen__form-note page-form-grid__full">
          角色可以留空。若当前账号没有 `user.assign-role` 权限，这里会自动切换为只读。
        </p>
      </el-form>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UserFormPayload, UserPermissionSource, UserRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import UserAvatar from '@/components/common/UserAvatar.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import ImageSelectFormItem from '@/components/form/ImageSelectFormItem.vue';
import {
  DEFAULT_AVATAR_IMAGE_MAX_HEIGHT,
  DEFAULT_AVATAR_IMAGE_MAX_WIDTH,
} from '@/components/form/image-select';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { fetchAllPaginatedItems } from '@/utils/paginated';
import UsersTable from './components/UsersTable.vue';
import UsersToolbar from './components/UsersToolbar.vue';

defineOptions({ name: 'UsersView' });

definePage({
  viewKey: 'users',
  keepAlive: true,
});

type UsersPageState = {
  filters: {
    q: string;
    status: '' | 'ACTIVE' | 'DISABLED';
    roleId: string;
  };
  page: number;
};

type UserEditorForm = {
  username: string;
  email: string;
  nickname: string;
  avatarFileId: string | null;
  password: string;
  status: 'ACTIVE' | 'DISABLED';
  roleIds: string[];
};

type UserScreenMode = 'list' | 'create' | 'edit' | 'detail' | 'permissions';

const createEmptyForm = (): UserEditorForm => ({
  username: '',
  email: '',
  nickname: '',
  avatarFileId: null,
  password: '',
  status: 'ACTIVE',
  roleIds: [],
});

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const users = ref<UserRecord[]>([]);
const selectedUser = ref<UserRecord | null>(null);
const roleOptions = ref<Array<{ id: string; name: string }>>([]);
const permissionSource = ref<UserPermissionSource | null>(null);
const total = ref(0);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const pageSize = 10;
const loadRoleSelections = api.users.roles;
const form = reactive<UserEditorForm>(createEmptyForm());

const { state: pageState } = usePageState<UsersPageState>('page:users', {
  filters: {
    q: '',
    status: '',
    roleId: '',
  },
  page: 1,
});

const allowedModes: UserScreenMode[] = ['list', 'create', 'edit', 'detail', 'permissions'];
const screenMode = computed<UserScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as UserScreenMode) ? value as UserScreenMode : 'list';
});
const activeUserId = computed(() => typeof route.query.id === 'string' ? route.query.id : '');
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isPermissionMode = computed(() => screenMode.value === 'permissions');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('user.create'));
const canEdit = computed(() => auth.hasPermission('user.update'));
const canDelete = computed(() => auth.hasPermission('user.delete'));
const canAssignRoles = computed(() => auth.hasPermission('user.assign-role'));
const canExplore = computed(() => auth.hasPermission('rbac.explorer'));
const canUploadImages = computed(() => auth.hasPermission('file.upload'));

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  const activeCount = users.value.filter((item) => item.status === 'ACTIVE').length;
  const disabledCount = users.value.filter((item) => item.status === 'DISABLED').length;

  return [
    { label: '成员总数', value: total.value },
    { label: '当前页启用', value: activeCount },
    { label: '当前页禁用', value: disabledCount },
    { label: '角色目录', value: roleOptions.value.length },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'Users Workspace',
      title: '列表页现在只负责筛选和进入下一步',
      description: '用户清单不再弹出详情和编辑窗口，所有查看、权限来源、修改都切到单独任务态。',
      meta: [
        { label: '当前页记录', value: String(users.value.length) },
        { label: '筛选角色', value: pageState.filters.roleId ? '已限定' : '全部角色' },
      ],
    };
  }

  if (isDetailMode.value && selectedUser.value) {
    return {
      caption: 'User Detail',
      title: selectedUser.value.nickname,
      description: '详情页只展示资料、状态和角色绑定。',
      meta: [
        { label: '用户名', value: selectedUser.value.username },
        { label: '账号状态', value: selectedUser.value.status === 'ACTIVE' ? '启用' : '禁用' },
      ],
    };
  }

  if (isPermissionMode.value && permissionSource.value) {
    return {
      caption: 'Permission Source',
      title: permissionSource.value.user.nickname,
      description: '权限来源页只解释有效权限来自哪些角色。',
      meta: [
        { label: '有效权限', value: String(permissionSource.value.effectivePermissions.length) },
        { label: '角色来源', value: String(permissionSource.value.groups.length) },
      ],
    };
  }

  return {
    caption: isFormMode.value ? 'User Form' : 'Users Workspace',
    title: screenMode.value === 'create' ? '创建用户' : '编辑用户',
    description: screenMode.value === 'create'
      ? '新账号只在这里创建，不再从列表页弹窗完成。'
      : '编辑页只保留当前账号需要修改的字段。',
    meta: [],
  };
});

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  status: pageState.filters.status || undefined,
  roleId: pageState.filters.roleId || undefined,
});

const buildExportRequest = () => api.users.export(buildFilterParams());

const formatTime = (value: string) => new Date(value).toLocaleString();

const resetForm = () => {
  Object.assign(form, createEmptyForm());
};

const assignForm = (user: UserRecord) => {
  form.username = user.username;
  form.email = user.email ?? '';
  form.nickname = user.nickname;
  form.avatarFileId = user.avatarFileId;
  form.password = '';
  form.status = user.status;
  form.roleIds = user.roles.map((role) => role.id);
};

const navigateToMode = async (mode: UserScreenMode, id?: string) => {
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

const openEdit = async (row: UserRecord) => {
  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeUserId.value) {
    return;
  }
  await navigateToMode('edit', activeUserId.value);
};

const openDetail = async (row: UserRecord) => {
  await navigateToMode('detail', row.id);
};

const openPermissionSource = async (id: string) => {
  await navigateToMode('permissions', id);
};

const openPermissionSourceById = async () => {
  if (!activeUserId.value) {
    return;
  }
  await navigateToMode('permissions', activeUserId.value);
};

const loadUsers = async () => {
  try {
    loading.value = true;
    const response = await api.users.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });

    const totalPages = Math.max(Math.ceil(response.meta.total / pageSize), 1);
    if (pageState.page > totalPages) {
      pageState.page = totalPages;
      await loadUsers();
      return;
    }

    users.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载用户列表失败'));
  } finally {
    loading.value = false;
  }
};

const loadRoleOptions = async () => {
  try {
    roleOptions.value = await fetchAllPaginatedItems(api.users.roles);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载角色选项失败'));
  }
};

const loadUserDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedUser.value = await api.users.detail(id);
  } catch (error: unknown) {
    selectedUser.value = null;
    ElMessage.error(getErrorMessage(error, '加载用户详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const loadPermissionSource = async (id: string) => {
  try {
    panelLoading.value = true;
    permissionSource.value = await api.users.permissionSources(id);
  } catch (error: unknown) {
    permissionSource.value = null;
    ElMessage.error(getErrorMessage(error, '加载权限来源失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadUsers();
    return;
  }

  if (!activeUserId.value) {
    return;
  }

  if (isPermissionMode.value) {
    await loadPermissionSource(activeUserId.value);
    return;
  }

  await loadUserDetail(activeUserId.value);
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadUsers();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.status = '';
  pageState.filters.roleId = '';
  pageState.page = 1;
  await loadUsers();
};

const validateForm = () => {
  if (!form.username.trim() || !form.nickname.trim() || !form.email.trim()) {
    return '请完整填写用户名、昵称和邮箱';
  }

  if (screenMode.value === 'create' && !form.password.trim()) {
    return '创建用户时必须填写密码';
  }

  return '';
};

const saveUser = async () => {
  const validationMessage = validateForm();
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: UserFormPayload = {
    username: form.username.trim(),
    email: form.email.trim(),
    nickname: form.nickname.trim(),
    avatarFileId: form.avatarFileId,
    password: form.password.trim() || undefined,
    status: form.status,
    roleIds: form.roleIds,
  };

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activeUserId.value
      ? await api.users.update(activeUserId.value, payload)
      : await api.users.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? '用户已更新' : '用户已创建');
    await loadUsers();
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存用户失败' : '创建用户失败'));
  } finally {
    saving.value = false;
  }
};

const removeUser = async (row: UserRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除用户“${row.nickname}”吗？删除后不可恢复。`,
      '删除用户',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.users.remove(row.id);
    ElMessage.success('用户已删除');
    await loadUsers();
    if (activeUserId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除用户失败'));
  }
};

const userContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'permission-source',
    label: '查看权限来源',
    hidden: () => !canExplore.value,
    onSelect: (row) => openPermissionSource(row.id),
  },
  {
    key: 'edit-divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑用户',
    hidden: () => !canEdit.value,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除用户',
    hidden: () => !canDelete.value,
    danger: true,
    onSelect: (row) => removeUser(row),
  },
] satisfies ContextMenuItem<UserRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadUsers();
};

watch(
  () => [screenMode.value, activeUserId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedUser.value = null;
      permissionSource.value = null;
      return;
    }

    if (mode === 'create') {
      selectedUser.value = null;
      permissionSource.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    if (mode === 'permissions') {
      selectedUser.value = null;
      await loadPermissionSource(id);
      return;
    }

    permissionSource.value = null;
    await loadUserDetail(id);

    if (mode === 'edit' && selectedUser.value) {
      assignForm(selectedUser.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await Promise.all([loadUsers(), loadRoleOptions()]);
});
</script>

<style scoped lang="scss">
.users-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.users-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.users-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.users-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.users-screen__relation-search {
  display: flex;
  gap: 10px;
}

.users-screen__relation-search :deep(.el-input) {
  flex: 1;
}

.users-screen__relation-card {
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

.users-screen__relation-card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.users-screen__relation-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.users-screen__relation-badge {
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

.users-screen__relation-card strong {
  font-size: 14px;
  line-height: 1.4;
}

.users-screen__relation-card span,
.users-screen__relation-card p,
.users-screen__form-note {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 960px) {
  .users-screen__relation-search {
    flex-direction: column;
  }
}
</style>
