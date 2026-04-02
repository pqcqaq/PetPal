<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="reloadAll">刷新结构</el-button>
        <el-button v-if="workspaceMode !== 'inspect' && selectedNode" @click="openInspect">返回详情</el-button>
        <el-button v-permission="'menu.create'" type="primary" @click="openCreateRootDialog('DIRECTORY')">新增目录</el-button>
        <el-button v-permission="'menu.create'" type="primary" plain @click="openCreateRootDialog('PAGE')">新增页面</el-button>
      </el-space>
    </template>

    <div class="menu-management-grid">
      <MenuTreePanel
        :loading="loading"
        :keyword="keyword"
        :nodes="filteredTree"
        :total-nodes="totalNodeCount"
        :expanded-keys="treeExpandedKeys"
        :expanded-count="expandedBranchCount"
        :current-node-key="currentNodeKey"
        :can-create="canCreate"
        :can-update="canUpdate"
        :can-delete="canDelete"
        @update:keyword="keyword = $event"
        @select="handleSelectNode"
        @edit="openEditDialog"
        @create-sibling="openCreateSiblingDialog"
        @create-child="openCreateChildDialog"
        @delete="openDeleteDialog"
        @expand="handleExpandNode"
        @collapse="handleCollapseNode"
        @expand-all="expandAllNodes"
        @collapse-all="collapseAllNodes"
        @expand-selection="expandSelectionPath"
      />

      <MenuInspectorPanel
        v-if="workspaceMode === 'inspect'"
        :selected-node="selectedNode"
        :selected-parent-node="selectedParentNode"
        :description="inspectorDescription"
        @edit="handleInspectorEdit"
        @create-sibling="openCreateSiblingDialog"
        @create-child="handleInspectorCreateChild"
        @delete="handleInspectorDelete"
      />

      <SurfacePanel
        v-else-if="workspaceMode === 'create' || workspaceMode === 'edit'"
        caption="结构编辑"
        :title="editorTitle"
        :description="editorDescription"
      >
        <template #actions>
          <el-space wrap>
            <el-button @click="resetEditor">恢复初始值</el-button>
            <el-button @click="openInspect">取消</el-button>
            <el-button
              v-permission="workspaceMode === 'edit' ? 'menu.update' : 'menu.create'"
              type="primary"
              :loading="saving"
              :disabled="!canSubmit"
              @click="saveNode"
            >
              保存
            </el-button>
          </el-space>
        </template>

        <div class="menu-editor-layout">
          <section class="detail-section">
            <el-form label-position="top" class="page-form-grid">
              <el-form-item label="类型">
                <el-select v-model="form.type" :disabled="lockType">
                  <el-option
                    v-for="option in availableTypeOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="父级">
                <el-select
                  v-model="form.parentId"
                  :clearable="form.type !== 'ACTION'"
                  :placeholder="form.type === 'ACTION' ? '行为必须挂在页面节点下' : '根级'"
                >
                  <el-option v-for="option in parentOptions" :key="option.id" :label="option.label" :value="option.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="排序">
                <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
              </el-form-item>
              <el-form-item v-if="form.type !== 'ACTION'" :label="codeFieldLabel">
                <el-input v-model="form.code" :placeholder="codePlaceholder" />
              </el-form-item>
              <el-form-item :label="nameFieldLabel">
                <el-input v-model="form.title" :placeholder="namePlaceholder" />
              </el-form-item>
              <el-form-item v-if="form.type !== 'ACTION'" label="图标">
                <UnoIconPicker v-model="form.icon" :fallback="previewIcon" />
              </el-form-item>
              <el-form-item v-if="form.type !== 'ACTION'" label="副标题">
                <el-input v-model="form.caption" placeholder="可选，建议控制在一行内" />
              </el-form-item>
              <el-form-item label="说明" class="page-form-grid__full">
                <el-input v-model="form.description" type="textarea" :rows="3" :placeholder="descriptionPlaceholder" />
              </el-form-item>
              <el-form-item v-if="form.type === 'PAGE'" label="页面路径">
                <el-input v-model="form.path" placeholder="/menus" />
              </el-form-item>
              <el-form-item v-if="form.type === 'PAGE'" label="页面视图">
                <el-select v-model="form.viewKey" filterable placeholder="选择前端页面视图">
                  <el-option v-for="option in pageViewOptions" :key="option.viewKey" :label="option.label" :value="option.viewKey" :disabled="option.disabled" />
                </el-select>
              </el-form-item>
            </el-form>
          </section>

          <section v-if="form.type !== 'DIRECTORY'" class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Permission</p>
                <h3 class="panel-heading panel-heading--md">{{ permissionFieldLabel }}</h3>
              </div>
              <el-button v-if="form.type === 'ACTION' && canCreatePermission" plain type="primary" @click="togglePermissionCreator">
                {{ permissionCreatorVisible ? '收起权限新建' : '新建权限' }}
              </el-button>
            </div>

            <RelationSelectFormItem
              v-model="form.permissionId"
              :label="permissionFieldLabel"
              :disabled="!canAssignPermission"
              :dialog-title="permissionDialogTitle"
              trigger-text="选择权限"
              :request="loadPermissionOptions"
              :search-defaults="{ q: '' }"
              :show-selected-preview="form.type !== 'ACTION'"
              layout="card"
            >
              <template #search="{ params, search, reset }">
                <div class="menu-editor__relation-search">
                  <el-input v-model="params.q" clearable placeholder="搜索权限名称、编码或模块" @keyup.enter="search" />
                  <el-button @click="search">搜索</el-button>
                  <el-button @click="reset">重置</el-button>
                </div>
              </template>

              <template #row="{ row, selected }">
                <div class="menu-editor__permission-card" :class="{ 'is-selected': selected }">
                  <div class="menu-editor__permission-card-head">
                    <strong>{{ row.name }}</strong>
                    <span class="menu-editor__permission-badge">{{ selected ? '已选' : '使用' }}</span>
                  </div>
                  <span>{{ row.code }}</span>
                  <p>{{ row.module }} · {{ row.action }}</p>
                </div>
              </template>
            </RelationSelectFormItem>

            <p v-if="form.type === 'ACTION'" class="menu-editor__field-note">行为节点建议直接关联一个权限；没有现成权限时先新建，再自动回填到当前行为。</p>
            <p v-if="!canAssignPermission" class="menu-editor__field-note">当前账号缺少 `menu.assign-permission`，这里只能查看已绑定权限，不能修改。</p>
          </section>

          <section v-if="permissionCreatorVisible && form.type === 'ACTION' && canCreatePermission" class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Create Permission</p>
                <h3 class="panel-heading panel-heading--md">为当前行为创建权限</h3>
              </div>
              <el-button @click="resetPermissionForm">重置</el-button>
            </div>

            <el-form label-position="top" class="page-form-grid">
              <el-form-item label="权限码" class="page-form-grid__full"><el-input v-model="permissionForm.code" /></el-form-item>
              <el-form-item label="名称"><el-input v-model="permissionForm.name" /></el-form-item>
              <el-form-item label="模块"><el-input v-model="permissionForm.module" /></el-form-item>
              <el-form-item label="动作"><el-input v-model="permissionForm.action" /></el-form-item>
              <el-form-item label="描述" class="page-form-grid__full"><el-input v-model="permissionForm.description" type="textarea" :rows="3" /></el-form-item>
            </el-form>

            <div class="menu-editor__inline-actions">
              <el-button @click="permissionCreatorVisible = false">取消</el-button>
              <el-button type="primary" :loading="permissionSaving" @click="savePermissionFromMenu">创建并回填</el-button>
            </div>
          </section>

          <div class="menu-editor__hint">
            <strong>结构约束</strong>
            <span>{{ structureHint }}</span>
          </div>
        </div>
      </SurfacePanel>

      <SurfacePanel
        v-else-if="workspaceMode === 'delete'"
        caption="删除确认"
        :title="selectedNode ? `删除 ${selectedNode.title}` : '删除菜单节点'"
        description="删除确认单独展示，避免和查看或编辑信息混在一起。"
      >
        <template #actions>
          <el-space wrap>
            <el-button @click="openInspect">取消</el-button>
            <el-button type="danger" :loading="deleting" :disabled="!selectedNode" @click="confirmDelete">确认删除</el-button>
          </el-space>
        </template>

        <div v-if="selectedNode" class="menu-delete-panel">
          <section class="menu-delete-panel__hero">
            <span class="menu-delete-panel__icon">
              <UnoIcon :name="resolveMenuNodeIcon(selectedNode)" :title="selectedNode.title" :size="24" />
            </span>
            <div class="menu-delete-panel__copy">
              <strong>{{ selectedNode.title }}</strong>
              <span>{{ resolveTypeLabel(selectedNode.type) }} · {{ selectedNode.code }}</span>
            </div>
          </section>

          <p class="menu-delete-panel__warning">
            {{ selectedNodeDescendantCount
              ? `该节点下还有 ${selectedNodeDescendantCount} 个子节点，确认后会一并删除。`
              : '删除后不可恢复，请确认这是你期望的操作。' }}
          </p>

          <div class="menu-delete-panel__facts">
            <article class="menu-delete-panel__fact">
              <span>页面路径</span>
              <strong>{{ selectedNode.path || '不适用' }}</strong>
            </article>
            <article class="menu-delete-panel__fact">
              <span>权限绑定</span>
              <strong>{{ resolvePermissionSummary(selectedNode) }}</strong>
            </article>
          </div>
        </div>

        <el-empty v-else description="先从左侧选择一个菜单项，再进行删除确认。" />
      </SurfacePanel>
    </div>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type {
  MenuNodeFormPayload,
  MenuNodeRecord,
  PermissionFormPayload,
} from '@rbac/api-common';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import UnoIcon from '@/components/common/UnoIcon.vue';
import UnoIconPicker from '@/components/common/UnoIconPicker.vue';
import { resolveMenuNodeIcon } from '@/components/common/uno-icons';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { pageRegistry } from '@/meta/pages';
import { useAuthStore } from '@/stores/auth';
import { useMenuStore } from '@/stores/menus';
import { useWorkbenchStore } from '@/stores/workbench';
import { getErrorMessage } from '@/utils/errors';
import MenuInspectorPanel from './components/MenuInspectorPanel.vue';
import MenuTreePanel from './components/MenuTreePanel.vue';
import {
  collectDescendantIds,
  collectExpandableIds,
  countDescendants,
  deriveActionCodeFromPermissionCode,
  filterTree,
  findNodeById,
  findNodePath,
  flattenNodes,
  resolveCodeFieldLabel,
  resolveCodePlaceholder,
  resolveEntityLabel,
  resolveNameFieldLabel,
  resolvePermissionSummary,
  resolveStructureHint,
  resolveTypeLabel,
  typeOptions,
} from './menu-management';
import type { EditorMode, MenuNodeType, RootCreatableNodeType } from './menu-management';

defineOptions({ name: 'MenusView' });

definePage({
  viewKey: 'menus',
  keepAlive: true,
});

type PageViewOption = {
  viewKey: string;
  label: string;
  disabled: boolean;
};

type WorkspaceMode = 'inspect' | 'create' | 'edit' | 'delete';

const menus = useMenuStore();
const workbench = useWorkbenchStore();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const keyword = ref('');
const selectedNodeId = ref<string | null>(null);
const tree = ref<MenuNodeRecord[]>([]);
const expandedNodeIds = ref<string[]>([]);
const workspaceMode = ref<WorkspaceMode>('inspect');
const formMode = ref<EditorMode>('create');
const permissionCreatorVisible = ref(false);
const pendingDeleteNodeId = ref<string | null>(null);
const permissionSaving = ref(false);
const loadPermissionOptions = api.menus.permissions;

const createEmptyForm = (): MenuNodeFormPayload => ({
  code: '',
  type: 'DIRECTORY',
  title: '',
  caption: '',
  description: '',
  icon: '',
  path: '',
  viewKey: '',
  sortOrder: 10,
  parentId: null,
  permissionId: null,
});

const form = reactive<MenuNodeFormPayload>(createEmptyForm());
const editorSeed = ref<MenuNodeFormPayload>(createEmptyForm());
const createEmptyPermissionForm = () => ({
  code: '',
  name: '',
  module: '',
  action: '',
  description: '',
});
const permissionForm = reactive(createEmptyPermissionForm());

const canCreate = computed(() => auth.hasPermission('menu.create'));
const canUpdate = computed(() => auth.hasPermission('menu.update'));
const canDelete = computed(() => auth.hasPermission('menu.delete'));
const canAssignPermission = computed(() => auth.hasPermission('menu.assign-permission'));
const canCreatePermission = computed(
  () => canAssignPermission.value && auth.hasPermission('permission.create'),
);
const canSubmit = computed(() => (formMode.value === 'create' ? canCreate.value : canUpdate.value));

const allNodes = computed(() => flattenNodes(tree.value));
const totalNodeCount = computed(() => allNodes.value.length);
const currentNodeKey = computed(() => selectedNodeId.value ?? undefined);
const selectedNode = computed(() => findNodeById(tree.value, selectedNodeId.value));
const selectedParentNode = computed(() =>
  findNodeById(tree.value, selectedNode.value?.parentId ?? null),
);
const pendingDeleteNode = computed(() => findNodeById(tree.value, pendingDeleteNodeId.value));
const formParentNode = computed(() => findNodeById(tree.value, form.parentId ?? null));
const selectedNodeDescendantCount = computed(() =>
  pendingDeleteNode.value ? countDescendants(pendingDeleteNode.value) : 0,
);
const filteredTree = computed(() => filterTree(tree.value, keyword.value));
const treeExpandedKeys = computed(() =>
  keyword.value.trim() ? collectExpandableIds(filteredTree.value) : expandedNodeIds.value,
);
const expandedBranchCount = computed(() => expandedNodeIds.value.length);
const availableTypeValues = computed<MenuNodeType[]>(() => {
  if (workspaceMode.value === 'edit' && selectedNode.value?.children.length) {
    return [form.type];
  }

  const parent = findNodeById(tree.value, form.parentId ?? null);
  if (!parent) {
    return ['DIRECTORY', 'PAGE'];
  }

  if (parent.type === 'DIRECTORY') {
    return ['DIRECTORY', 'PAGE'];
  }

  if (parent.type === 'PAGE') {
    return ['ACTION'];
  }

  return [form.type];
});
const availableTypeOptions = computed(() =>
  typeOptions.filter((option) => availableTypeValues.value.includes(option.value)),
);
const lockType = computed(
  () =>
    Boolean(selectedNode.value?.children.length && workspaceMode.value === 'edit')
    || availableTypeOptions.value.length <= 1,
);

const stats = computed(() => [
  { label: '节点总数', value: totalNodeCount.value },
  { label: '目录节点', value: allNodes.value.filter((node) => node.type === 'DIRECTORY').length },
  { label: '页面节点', value: allNodes.value.filter((node) => node.type === 'PAGE').length },
  { label: '行为节点', value: allNodes.value.filter((node) => node.type === 'ACTION').length },
]);

const editorTitle = computed(() => `${formMode.value === 'edit' ? '编辑' : '新增'}${resolveEntityLabel(form.type)}`);
const editorDescription = computed(() => {
  if (formMode.value === 'edit' && selectedNode.value) {
    return `正在编辑 ${selectedNode.value.title}，保存后会立即同步到导航树和权限映射。`;
  }

  const parent = formParentNode.value;
  if (parent) {
    return `${resolveEntityLabel(form.type)}会挂载到 ${parent.title} 下。`;
  }

  return `${resolveEntityLabel(form.type)}会作为根级项插入当前菜单树。`;
});

const inspectorDescription = computed(() => {
  if (!selectedNode.value) {
    return '';
  }

  return `${selectedNode.value.code}${selectedNode.value.path ? ` · ${selectedNode.value.path}` : ''}`;
});

const previewIcon = computed(() =>
  resolveMenuNodeIcon({
    code: form.code.trim(),
    type: form.type,
    icon: form.icon,
  }),
);

const structureHint = computed(() => resolveStructureHint(form.type));
const nameFieldLabel = computed(() => resolveNameFieldLabel(form.type));
const namePlaceholder = computed(() =>
  form.type === 'ACTION'
    ? '如 导出数据 / 审核通过'
    : form.type === 'PAGE'
      ? '用于页面导航展示'
      : '用于目录导航展示',
);
const codeFieldLabel = computed(() =>
  form.type === 'ACTION' ? '' : resolveCodeFieldLabel(form.type),
);
const codePlaceholder = computed(() =>
  form.type === 'ACTION' ? '' : resolveCodePlaceholder(form.type),
);
const descriptionPlaceholder = computed(() =>
  form.type === 'ACTION'
    ? '可选，补充这个行为的用途或边界'
    : `可选，补充这个${resolveEntityLabel(form.type)}的用途说明`,
);
const permissionFieldLabel = computed(() =>
  form.type === 'ACTION' ? '关联权限' : '页面权限',
);
const permissionDialogTitle = computed(() =>
  form.type === 'ACTION' ? '选择行为权限' : '选择页面权限',
);

const syncExpandedPath = (nodeId: string | null, mode: 'merge' | 'replace' = 'merge') => {
  const pathIds = findNodePath(tree.value, nodeId)
    .filter((node) => node.children.length > 0)
    .map((node) => node.id);

  if (mode === 'replace') {
    expandedNodeIds.value = pathIds;
    return;
  }

  expandedNodeIds.value = Array.from(new Set([...expandedNodeIds.value, ...pathIds]));
};

const trimExpandedState = (nodes: MenuNodeRecord[]) => {
  const validIds = new Set(collectExpandableIds(nodes));
  expandedNodeIds.value = expandedNodeIds.value.filter((id) => validIds.has(id));
};

const toPayload = (): MenuNodeFormPayload => ({
  code: form.code.trim(),
  type: form.type,
  title: form.title.trim(),
  caption: form.caption?.trim() || null,
  description: form.description?.trim() || null,
  icon: form.icon?.trim() || null,
  path: form.type === 'PAGE' ? form.path?.trim() || null : null,
  viewKey: form.type === 'PAGE' ? form.viewKey?.trim() || null : null,
  sortOrder: Number(form.sortOrder),
  parentId: form.parentId || null,
  permissionId: form.type === 'DIRECTORY' ? null : form.permissionId || null,
});

const patchForm = (payload: MenuNodeFormPayload) => {
  form.code = payload.code;
  form.type = payload.type;
  form.title = payload.title;
  form.caption = payload.caption ?? '';
  form.description = payload.description ?? '';
  form.icon = payload.icon ?? '';
  form.path = payload.path ?? '';
  form.viewKey = payload.viewKey ?? '';
  form.sortOrder = payload.sortOrder;
  form.parentId = payload.parentId ?? null;
  form.permissionId = payload.permissionId ?? null;
};

const openEditor = (mode: EditorMode, payload: MenuNodeFormPayload) => {
  formMode.value = mode;
  editorSeed.value = { ...payload };
  patchForm(payload);
  pendingDeleteNodeId.value = null;
  permissionCreatorVisible.value = false;
  workspaceMode.value = mode;
};

const nextSortOrder = (siblings: MenuNodeRecord[]) =>
  Math.max(...siblings.map((item) => item.sortOrder), 0) + 10;
const resolveDefaultCreateType = (parent: MenuNodeRecord): MenuNodeType =>
  parent.type === 'PAGE' ? 'ACTION' : 'PAGE';

const resetEditor = () => {
  patchForm(editorSeed.value);
};

const resetPermissionForm = () => {
  Object.assign(permissionForm, createEmptyPermissionForm());
};

const normalizePermissionFragment = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ':')
  .replace(/^:+|:+$/g, '');

const resolveSuggestedPermissionModule = () => {
  if (formParentNode.value?.permission?.module) {
    return formParentNode.value.permission.module;
  }

  return formParentNode.value?.code ?? '';
};

const seedPermissionForm = () => {
  resetPermissionForm();
  const normalizedModule = normalizePermissionFragment(resolveSuggestedPermissionModule());
  const normalizedAction = normalizePermissionFragment(form.code || form.title);

  permissionForm.name = form.title.trim();
  permissionForm.module = normalizedModule;
  permissionForm.action = normalizedAction;
  permissionForm.code = [normalizedModule, normalizedAction].filter(Boolean).join(':');
};

const togglePermissionCreator = () => {
  if (!canCreatePermission.value) {
    return;
  }

  if (!permissionCreatorVisible.value) {
    seedPermissionForm();
  }

  permissionCreatorVisible.value = !permissionCreatorVisible.value;
};

const validatePermissionForm = () => {
  if (
    !permissionForm.code.trim() ||
    !permissionForm.name.trim() ||
    !permissionForm.module.trim() ||
    !permissionForm.action.trim()
  ) {
    return '请完整填写权限码、名称、模块和动作';
  }

  return null;
};

const savePermissionFromMenu = async () => {
  const validationError = validatePermissionForm();
  if (validationError) {
    ElMessage.warning(validationError);
    return;
  }

  try {
    permissionSaving.value = true;
    const payload: PermissionFormPayload = {
      code: permissionForm.code.trim(),
      name: permissionForm.name.trim(),
      module: permissionForm.module.trim(),
      action: permissionForm.action.trim(),
      description: permissionForm.description.trim(),
    };
    const created = await api.permissions.create(payload);

    form.permissionId = created.id;
    if (form.type === 'ACTION') {
      if (!form.title.trim()) {
        form.title = created.name;
      }
      if (!form.code.trim()) {
        form.code = deriveActionCodeFromPermissionCode(created.code);
      }
    }

    permissionCreatorVisible.value = false;
    resetPermissionForm();
    ElMessage.success('权限已新增并关联到当前行为');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '新增权限失败'));
  } finally {
    permissionSaving.value = false;
  }
};

watch(
  () => form.type,
  (value) => {
    if (value !== 'PAGE') {
      form.path = '';
      form.viewKey = '';
    }

    if (value === 'DIRECTORY') {
      form.permissionId = null;
    }

    if (value !== 'ACTION') {
      permissionCreatorVisible.value = false;
    }
  },
  { immediate: true },
);

watch(
  availableTypeValues,
  (value) => {
    if (!value.length || value.includes(form.type)) {
      return;
    }

    form.type = value[0] ?? 'DIRECTORY';
  },
  { immediate: true },
);

const handleSelectNode = (node: MenuNodeRecord) => {
  if (workspaceMode.value === 'create' || workspaceMode.value === 'edit') {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);

  if (workspaceMode.value === 'delete') {
    pendingDeleteNodeId.value = node.id;
  }
};

const handleExpandNode = (node: MenuNodeRecord) => {
  if (keyword.value.trim()) {
    return;
  }

  expandedNodeIds.value = Array.from(new Set([...expandedNodeIds.value, node.id]));
};

const handleCollapseNode = (node: MenuNodeRecord) => {
  if (keyword.value.trim()) {
    return;
  }

  const collapsedIds = collectDescendantIds(node);
  expandedNodeIds.value = expandedNodeIds.value.filter((id) => !collapsedIds.has(id));

  if (
    selectedNodeId.value &&
    collapsedIds.has(selectedNodeId.value) &&
    selectedNodeId.value !== node.id
  ) {
    selectedNodeId.value = node.id;
  }
};

const expandAllNodes = () => {
  expandedNodeIds.value = collectExpandableIds(tree.value);
};

const collapseAllNodes = () => {
  expandedNodeIds.value = [];
  const path = findNodePath(tree.value, selectedNodeId.value);
  selectedNodeId.value = path[0]?.id ?? selectedNodeId.value;
};

const expandSelectionPath = () => {
  syncExpandedPath(selectedNodeId.value);
};

const openInspect = () => {
  workspaceMode.value = 'inspect';
  pendingDeleteNodeId.value = null;
  permissionCreatorVisible.value = false;
};

const handleInspectorEdit = () => {
  if (selectedNode.value) {
    openEditDialog(selectedNode.value);
  }
};

const handleInspectorCreateChild = () => {
  if (selectedNode.value) {
    openCreateChildDialog(selectedNode.value);
  }
};

const handleInspectorDelete = () => {
  if (selectedNode.value) {
    openDeleteDialog(selectedNode.value);
  }
};

const openEditDialog = (node: MenuNodeRecord) => {
  if (!canUpdate.value) {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
  openEditor('edit', {
    code: node.code,
    type: node.type,
    title: node.title,
    caption: node.caption ?? '',
    description: node.description ?? '',
    icon: node.icon ?? '',
    path: node.path ?? '',
    viewKey: node.viewKey ?? '',
    sortOrder: node.sortOrder,
    parentId: node.parentId ?? null,
    permissionId: node.permissionId ?? null,
  });
};

const openCreateRootDialog = (type: RootCreatableNodeType) => {
  if (!canCreate.value) {
    return;
  }

  openEditor('create', {
    ...createEmptyForm(),
    type,
    sortOrder: nextSortOrder(tree.value),
  });
};

const openCreateSiblingDialog = (targetNode = selectedNode.value) => {
  if (!canCreate.value) {
    return;
  }

  if (!targetNode) {
    openCreateRootDialog('DIRECTORY');
    return;
  }

  selectedNodeId.value = targetNode.id;
  syncExpandedPath(targetNode.id);

  const siblings = targetNode.parentId
    ? (findNodeById(tree.value, targetNode.parentId)?.children ?? tree.value)
    : tree.value;

  openEditor('create', {
    ...createEmptyForm(),
    type: targetNode.type,
    parentId: targetNode.parentId ?? null,
    sortOrder: nextSortOrder(siblings),
  });
};

const openCreateChildDialog = (node: MenuNodeRecord) => {
  if (!canCreate.value || node.type === 'ACTION') {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
  openEditor('create', {
    ...createEmptyForm(),
    type: resolveDefaultCreateType(node),
    parentId: node.id,
    sortOrder: nextSortOrder(node.children),
  });
};

const openDeleteDialog = (node: MenuNodeRecord) => {
  if (!canDelete.value) {
    return;
  }

  selectedNodeId.value = node.id;
  syncExpandedPath(node.id);
  pendingDeleteNodeId.value = node.id;
  permissionCreatorVisible.value = false;
  workspaceMode.value = 'delete';
};

const ensureSelection = (nodes: MenuNodeRecord[]) => {
  if (!nodes.length) {
    selectedNodeId.value = null;
    workspaceMode.value = 'inspect';
    return;
  }

  if (!selectedNodeId.value || !findNodeById(nodes, selectedNodeId.value)) {
    selectedNodeId.value = nodes[0]?.id ?? null;
  }

  syncExpandedPath(selectedNodeId.value);
};

const reloadAll = async () => {
  try {
    loading.value = true;
    const [menuTree] = await Promise.all([api.menus.tree(), menus.refresh(router)]);

    tree.value = menuTree;
    trimExpandedState(menuTree);
    workbench.syncWithMenus();
    ensureSelection(menuTree);

    if (pendingDeleteNodeId.value && !findNodeById(menuTree, pendingDeleteNodeId.value)) {
      pendingDeleteNodeId.value = null;
      if (workspaceMode.value === 'delete') {
        workspaceMode.value = 'inspect';
      }
    }

    if (
      (workspaceMode.value === 'edit' || workspaceMode.value === 'delete')
      && selectedNodeId.value
      && !findNodeById(menuTree, selectedNodeId.value)
    ) {
      workspaceMode.value = 'inspect';
      permissionCreatorVisible.value = false;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载菜单结构失败'));
  } finally {
    loading.value = false;
  }
};

const parentOptions = computed(() => {
  const editingNode = selectedNode.value;
  const disallowedIds =
    formMode.value === 'edit' ? collectDescendantIds(editingNode) : new Set<string>();
  const options: Array<{ id: string; label: string }> = [];

  const visit = (nodes: MenuNodeRecord[], depth: number) => {
    nodes.forEach((node) => {
      if (disallowedIds.has(node.id)) {
        return;
      }

      const isAllowedParent =
        form.type === 'DIRECTORY'
          ? node.type === 'DIRECTORY'
          : form.type === 'PAGE'
            ? node.type === 'DIRECTORY'
            : node.type === 'PAGE';

      if (isAllowedParent) {
        options.push({
          id: node.id,
          label: `${'　'.repeat(depth)}${node.title} · ${node.code}`,
        });
      }

      visit(node.children, depth + 1);
    });
  };

  visit(tree.value, 0);
  return options;
});

const pageViewOptions = computed<PageViewOption[]>(() => {
  const editingId = formMode.value === 'edit' ? (selectedNode.value?.id ?? null) : null;
  const usedViewKeys = new Set(
    allNodes.value
      .filter((node) => node.type === 'PAGE' && node.viewKey && node.id !== editingId)
      .map((node) => node.viewKey as string),
  );

  return [...pageRegistry]
    .sort((left, right) => left.viewKey.localeCompare(right.viewKey, 'en'))
    .map((page) => ({
      viewKey: page.viewKey,
      label: `${page.viewKey}${page.title ? ` · ${page.title}` : ''}`,
      disabled: usedViewKeys.has(page.viewKey),
    }));
});

const validatePayload = (payload: MenuNodeFormPayload): string | null => {
  if (payload.type !== 'ACTION' && !payload.code) {
    return payload.type === 'PAGE' ? '请填写页面标识' : '请填写目录标识';
  }

  if (!payload.title) {
    if (payload.type === 'ACTION') {
      return '请填写行为名称';
    }

    return payload.type === 'PAGE' ? '请填写页面标题' : '请填写目录名称';
  }

  if (!Number.isFinite(payload.sortOrder)) {
    return '排序值无效';
  }

  const parentNode = findNodeById(tree.value, payload.parentId ?? null);
  if (payload.parentId && !parentNode) {
    return '父级节点不存在或已失效';
  }

  if (payload.type === 'PAGE') {
    if (!payload.path) {
      return '页面节点必须填写页面路径';
    }

    if (!payload.path.startsWith('/')) {
      return '页面路径必须以 / 开头';
    }

    if (!payload.viewKey) {
      return '页面节点必须选择页面视图';
    }

    if (parentNode && parentNode.type !== 'DIRECTORY') {
      return '页面节点只能挂载到目录下';
    }
  }

  if (payload.type === 'DIRECTORY' && parentNode && parentNode.type !== 'DIRECTORY') {
    return '目录节点只能挂载到目录下';
  }

  if (payload.type === 'ACTION' && (!payload.parentId || parentNode?.type !== 'PAGE')) {
    return '行为节点必须挂载到页面节点下';
  }

  if (payload.type === 'ACTION' && formMode.value === 'create' && !payload.permissionId) {
    return '新增行为前请先关联权限，或先新建权限再回填';
  }

  return null;
};

const resolveActionPermission = async (permissionId: string) => {
  const resolved = await api.menus.permissions.resolve([permissionId]);
  return resolved[0] ?? null;
};

const saveNode = async () => {
  try {
    const payload = toPayload();
    if (payload.type === 'ACTION' && !payload.code && payload.permissionId) {
      const permission = await resolveActionPermission(payload.permissionId);
      if (permission) {
        payload.code = deriveActionCodeFromPermissionCode(permission.code);
      }
    }
    const validationError = validatePayload(payload);
    if (validationError) {
      ElMessage.warning(validationError);
      return;
    }

    const editingNodeId = formMode.value === 'edit' ? (selectedNode.value?.id ?? null) : null;

    saving.value = true;
    const response = editingNodeId
      ? await api.menus.update(editingNodeId, payload)
      : await api.menus.create(payload);

    ElMessage.success(formMode.value === 'edit' ? '菜单项已更新' : '菜单项已创建');
    selectedNodeId.value = response.id;
    workspaceMode.value = 'inspect';
    permissionCreatorVisible.value = false;
    await reloadAll();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存菜单项失败'));
  } finally {
    saving.value = false;
  }
};

const confirmDelete = async () => {
  if (!pendingDeleteNode.value) {
    return;
  }

  const fallbackSelectionId = pendingDeleteNode.value.parentId ?? null;

  try {
    deleting.value = true;
    await api.menus.remove(pendingDeleteNode.value.id);
    ElMessage.success('菜单项已删除');
    selectedNodeId.value = fallbackSelectionId;
    workspaceMode.value = 'inspect';
    pendingDeleteNodeId.value = null;
    await reloadAll();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '删除菜单项失败'));
  } finally {
    deleting.value = false;
  }
};

onMounted(reloadAll);
</script>

<style scoped lang="scss">
.menu-management-grid {
  display: grid;
  gap: 24px;
  align-items: start;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 0.92fr);
}

.menu-management-grid > * {
  min-width: 0;
}

.menu-editor-layout {
  display: grid;
  gap: 18px;
}

.menu-editor-layout :deep(.relation-select-form-item__trigger-control) {
  width: 100%;
}

.menu-editor__relation-search {
  display: flex;
  gap: 10px;
}

.menu-editor__relation-search :deep(.el-input) {
  flex: 1;
}

.menu-editor__permission-card {
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

.menu-editor__permission-card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.menu-editor__permission-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.menu-editor__permission-badge {
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

.menu-editor__permission-card strong {
  font-size: 14px;
  line-height: 1.4;
}

.menu-editor__permission-card span,
.menu-editor__permission-card p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.menu-editor__field-note {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.menu-editor__inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.menu-editor__hint {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: var(--surface-card-muted-bg);
  color: var(--ink-2);
}

.menu-editor__hint strong {
  color: var(--ink-1);
  font-size: 13px;
}

.menu-delete-panel {
  display: grid;
  gap: 16px;
}

.menu-delete-panel__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--line-soft);
  border-radius: 20px;
  background: var(--surface-card-strong-bg);
}

.menu-delete-panel__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: var(--surface-danger-subtle);
  color: var(--danger);
}

.menu-delete-panel__copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.menu-delete-panel__copy strong {
  color: var(--ink-1);
  font-size: 18px;
  line-height: 1.2;
}

.menu-delete-panel__copy span {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.menu-delete-panel__warning {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--danger) 22%, var(--line-strong));
  border-radius: 16px;
  background: var(--surface-danger-subtle);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.6;
}

.menu-delete-panel__facts {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.menu-delete-panel__fact {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--line-soft);
  border-radius: 18px;
  background: var(--surface-card-bg);
}

.menu-delete-panel__fact span {
  color: var(--ink-3);
  font-size: 12px;
}

.menu-delete-panel__fact strong {
  color: var(--ink-1);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

@media (max-width: 1280px) {
  .menu-management-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .menu-editor__relation-search,
  .menu-editor__inline-actions,
  .menu-delete-panel__hero {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
