<template>
  <PageScaffold :stats="pageStats">
    <template #actions>
      <el-space v-if="isListMode">
        <el-button @click="loadData">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出订阅授权失败" />
        <el-button v-if="canCreate" type="primary" @click="openCreate">
          新增订阅授权
        </el-button>
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回订阅授权清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前页</el-button>
        <el-button v-if="isDetailMode && canEdit && canEditCurrent" type="primary" @click="openEditById">
          编辑订阅授权
        </el-button>
        <el-button v-if="isFormMode" type="primary" :loading="saving" @click="saveTopic">
          {{ screenMode === 'create' ? '创建订阅授权' : '保存修改' }}
        </el-button>
      </el-space>
    </template>

    <template v-if="isListMode" #toolbar>
      <RealtimeTopicsToolbar
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
      <div v-if="screenHeader.meta.length" class="topics-screen__meta">
        <div v-for="item in screenHeader.meta" :key="item.label" class="topics-screen__meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
    </SurfacePanel>

    <RealtimeTopicsTable
      v-if="isListMode"
      :topics="topics"
      :loading="loading"
      :seed-count="seedCount"
      :total="total"
      :page="pageState.page"
      :page-size="pageSize"
      :context-menu-items="topicContextMenuItems"
      @detail="openDetail"
      @edit="openEdit"
      @delete="removeTopic"
      @page-change="changePage"
    />

    <SurfacePanel
      v-else-if="isDetailMode"
      caption="订阅授权详情"
      title="Topic Pattern 与权限绑定"
      description="详情页只解释这个订阅授权的覆盖范围和关联权限，不再覆盖编辑表单。"
    >
      <div v-loading="panelLoading" class="detail-stack">
        <template v-if="selectedTopic">
          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Binding</p>
                <h3 class="panel-heading panel-heading--md">{{ selectedTopic.name }}</h3>
                <p class="muted">{{ selectedTopic.description || '该订阅授权未填写描述。' }}</p>
              </div>
              <el-space wrap>
                <el-tag :type="selectedTopic.isSystem ? 'warning' : 'info'" round>
                  {{ resolveRealtimeTopicSourceLabel(selectedTopic.isSystem) }}
                </el-tag>
                <el-button v-if="canEdit && canEditCurrent" link @click="openEditById">编辑</el-button>
                <el-button
                  v-if="canDelete && canEditCurrent"
                  link
                  type="danger"
                  @click="removeTopic(selectedTopic)"
                >
                  删除
                </el-button>
              </el-space>
            </div>

            <div class="detail-kv-grid">
              <div class="detail-kv">
                <span>编码</span>
                <strong>{{ selectedTopic.code }}</strong>
              </div>
              <div class="detail-kv">
                <span>Topic Pattern</span>
                <strong>{{ selectedTopic.topicPattern }}</strong>
              </div>
              <div class="detail-kv">
                <span>绑定权限</span>
                <strong>{{ formatRealtimeTopicPermissionSummary(selectedTopic) }}</strong>
              </div>
              <div class="detail-kv">
                <span>更新时间</span>
                <strong>{{ formatTime(selectedTopic.updatedAt) }}</strong>
              </div>
              <div class="detail-kv">
                <span>创建时间</span>
                <strong>{{ formatTime(selectedTopic.createdAt) }}</strong>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <div class="detail-section__header">
              <div>
                <p class="panel-caption">Pattern Rules</p>
                <h3 class="panel-heading panel-heading--md">匹配约束</h3>
              </div>
            </div>
            <div class="topics-screen__rule-list">
              <span>`+` 只匹配单层。</span>
              <span>`#` 只能出现在最后一层，表示后续所有层级。</span>
              <span>订阅时会先匹配 pattern，再校验用户是否具备对应权限。</span>
            </div>
          </section>
        </template>

        <el-empty v-else description="没有找到这个订阅授权，可能已经被删除。" />
      </div>
    </SurfacePanel>

    <SurfacePanel
      v-else-if="isFormMode"
      :caption="screenMode === 'create' ? '创建订阅授权' : '编辑订阅授权'"
      :title="screenMode === 'create' ? '新绑定只在这里创建' : '绑定修改只在这里完成'"
      :description="screenMode === 'create'
        ? '创建页只负责 Topic Pattern 和权限绑定。'
        : '编辑页只保留当前绑定需要修改的字段。'"
    >
      <el-form v-loading="panelLoading" label-position="top" class="page-form-grid">
        <el-form-item label="编码">
          <el-input v-model="form.code" placeholder="如 user-rbac-project-admin" />
        </el-form-item>

        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="如 项目管理员 RBAC 变更" />
        </el-form-item>

        <el-form-item label="Topic Pattern" class="page-form-grid__full">
          <el-input v-model="form.topicPattern" placeholder="/system/users/+/rbac-updated" />
        </el-form-item>

        <RelationSelectFormItem
          v-model="form.permissionId"
          class="page-form-grid__full"
          label="绑定权限"
          dialog-title="选择订阅权限"
          trigger-text="选择权限"
          :request="loadPermissionSelections"
          :search-defaults="{ q: '' }"
          layout="card"
        >
          <template #search="{ params, search, reset }">
            <div class="topics-screen__relation-search">
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
            <div class="topics-screen__relation-card" :class="{ 'is-selected': selected }">
              <div class="topics-screen__relation-card-head">
                <strong>{{ row.name }}</strong>
                <span class="topics-screen__relation-badge">{{ selected ? '已选' : '使用' }}</span>
              </div>
              <span>{{ row.code }}</span>
              <p>{{ row.module }} · {{ row.action }}</p>
            </div>
          </template>
        </RelationSelectFormItem>

        <el-form-item label="描述" class="page-form-grid__full">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="4"
            maxlength="120"
            show-word-limit
            placeholder="可选，补充订阅边界或业务场景"
          />
        </el-form-item>

        <div class="topics-screen__pattern-guide page-form-grid__full">
          <strong>Pattern 规则</strong>
          <span>`+` 匹配单层，`#` 只能出现在最后一层。</span>
          <span>示例：`/chat/global/message`、`/system/users/+/rbac-updated`、`/system/#`</span>
        </div>
      </el-form>
    </SurfacePanel>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { RealtimeTopicFormPayload, RealtimeTopicRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import type { ContextMenuItem } from '@/components/common/context-menu';
import ListExportButton from '@/components/download/ListExportButton.vue';
import RelationSelectFormItem from '@/components/form/RelationSelectFormItem.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';
import { usePageState } from '@/composables/use-page-state';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import RealtimeTopicsTable from './components/RealtimeTopicsTable.vue';
import RealtimeTopicsToolbar from './components/RealtimeTopicsToolbar.vue';
import {
  assignRealtimeTopicEditorForm,
  buildRealtimeTopicClipboardSummary,
  buildRealtimeTopicPayload,
  createEmptyRealtimeTopicEditorForm,
  formatRealtimeTopicPermissionSummary,
  resolveRealtimeTopicSourceLabel,
  type RealtimeTopicEditorForm,
  validateRealtimeTopicForm,
} from './realtime-topic-management';

defineOptions({ name: 'RealtimeTopicsView' });

definePage({
  viewKey: 'realtimeTopics',
  keepAlive: true,
});

type RealtimeTopicsPageState = {
  filters: {
    q: string;
    sourceType: '' | 'seed' | 'custom';
  };
  page: number;
};

type TopicScreenMode = 'list' | 'create' | 'edit' | 'detail';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const topics = ref<RealtimeTopicRecord[]>([]);
const selectedTopic = ref<RealtimeTopicRecord | null>(null);
const loading = ref(false);
const panelLoading = ref(false);
const saving = ref(false);
const total = ref(0);
const pageSize = 10;
const loadPermissionSelections = api.realtimeTopics.permissions;
const form = reactive<RealtimeTopicEditorForm>(createEmptyRealtimeTopicEditorForm());

const { state: pageState } = usePageState<RealtimeTopicsPageState>('page:realtime-topics', {
  filters: {
    q: '',
    sourceType: '',
  },
  page: 1,
});

const allowedModes: TopicScreenMode[] = ['list', 'create', 'edit', 'detail'];
const screenMode = computed<TopicScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as TopicScreenMode) ? (value as TopicScreenMode) : 'list';
});
const activeTopicId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isListMode = computed(() => screenMode.value === 'list');
const isDetailMode = computed(() => screenMode.value === 'detail');
const isFormMode = computed(() => screenMode.value === 'create' || screenMode.value === 'edit');

const canCreate = computed(() => auth.hasPermission('realtime-topic.create'));
const canEdit = computed(() => auth.hasPermission('realtime-topic.update'));
const canDelete = computed(() => auth.hasPermission('realtime-topic.delete'));
const canEditCurrent = computed(() => Boolean(selectedTopic.value && !selectedTopic.value.isSystem));
const seedCount = computed(() => topics.value.filter((item) => item.isSystem).length);
const customCount = computed(() => topics.value.length - seedCount.value);
const permissionCount = computed(() => new Set(topics.value.map((item) => item.permissionId)).size);

const pageStats = computed(() => {
  if (!isListMode.value) {
    return [];
  }

  return [
    { label: '绑定总数', value: total.value },
    { label: '当前页系统注册', value: seedCount.value },
    { label: '当前页自定义', value: customCount.value },
    { label: '当前页关联权限', value: permissionCount.value },
  ];
});

const screenHeader = computed(() => {
  if (isListMode.value) {
    return {
      caption: 'Realtime Topics',
      title: '订阅授权清单只负责筛选和进入下一步',
      description: '列表页只保留检索和进入详情，新增、编辑、删除不再通过弹窗覆盖表格。',
      meta: [
        { label: '当前页记录', value: String(topics.value.length) },
        { label: '筛选来源', value: pageState.filters.sourceType || '全部来源' },
      ],
    };
  }

  if (isDetailMode.value && selectedTopic.value) {
    return {
      caption: 'Binding Detail',
      title: selectedTopic.value.name,
      description: '详情页只展示 topic 覆盖范围和绑定权限。',
      meta: [
        { label: '编码', value: selectedTopic.value.code },
        { label: '来源', value: resolveRealtimeTopicSourceLabel(selectedTopic.value.isSystem) },
      ],
    };
  }

  return {
    caption: 'Binding Form',
    title: screenMode.value === 'create' ? '新增订阅授权' : '编辑订阅授权',
    description: screenMode.value === 'create'
      ? '新绑定只在这个界面完成创建。'
      : '编辑页只保留当前绑定需要修改的字段。',
    meta: [],
  };
});

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  sourceType: pageState.filters.sourceType || undefined,
});

const buildExportRequest = () => api.realtimeTopics.export(buildFilterParams());

const formatTime = (value: string) => new Date(value).toLocaleString();

const resetForm = () => {
  Object.assign(form, createEmptyRealtimeTopicEditorForm());
};

const assignForm = (topic: RealtimeTopicRecord) => {
  assignRealtimeTopicEditorForm(form, topic);
};

const navigateToMode = async (mode: TopicScreenMode, id?: string) => {
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

const openEdit = async (row: RealtimeTopicRecord) => {
  if (row.isSystem) {
    ElMessage.warning('系统注册的订阅授权不可编辑');
    return;
  }

  await navigateToMode('edit', row.id);
};

const openEditById = async () => {
  if (!activeTopicId.value || !selectedTopic.value || selectedTopic.value.isSystem) {
    return;
  }
  await navigateToMode('edit', activeTopicId.value);
};

const openDetail = async (row: RealtimeTopicRecord) => {
  await navigateToMode('detail', row.id);
};

const loadData = async () => {
  try {
    loading.value = true;
    const response = await api.realtimeTopics.list({
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

    topics.value = response.items;
    total.value = response.meta.total;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载订阅授权失败'));
  } finally {
    loading.value = false;
  }
};

const loadTopicDetail = async (id: string) => {
  try {
    panelLoading.value = true;
    selectedTopic.value = await api.realtimeTopics.detail(id);
  } catch (error: unknown) {
    selectedTopic.value = null;
    ElMessage.error(getErrorMessage(error, '加载订阅授权详情失败'));
  } finally {
    panelLoading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  if (isListMode.value) {
    await loadData();
    return;
  }

  if (!activeTopicId.value) {
    return;
  }

  await loadTopicDetail(activeTopicId.value);
  if (screenMode.value === 'edit' && selectedTopic.value && !selectedTopic.value.isSystem) {
    assignForm(selectedTopic.value);
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadData();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.sourceType = '';
  pageState.page = 1;
  await loadData();
};

const saveTopic = async () => {
  const validationMessage = validateRealtimeTopicForm(form);
  if (validationMessage) {
    ElMessage.warning(validationMessage);
    return;
  }

  const payload: RealtimeTopicFormPayload = buildRealtimeTopicPayload(form);

  try {
    saving.value = true;
    const result = screenMode.value === 'edit' && activeTopicId.value
      ? await api.realtimeTopics.update(activeTopicId.value, payload)
      : await api.realtimeTopics.create(payload);

    ElMessage.success(screenMode.value === 'edit' ? '订阅授权已更新' : '订阅授权已创建');
    await loadData();
    await navigateToMode('detail', result.id);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, screenMode.value === 'edit' ? '保存订阅授权失败' : '创建订阅授权失败'));
  } finally {
    saving.value = false;
  }
};

const removeTopic = async (row: RealtimeTopicRecord) => {
  try {
    await ElMessageBox.confirm(
      `确定删除订阅授权“${row.name}（${row.topicPattern}）”吗？删除后不可恢复。`,
      '删除订阅授权',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消',
      },
    );

    await api.realtimeTopics.remove(row.id);
    ElMessage.success('订阅授权已删除');
    await loadData();
    if (activeTopicId.value === row.id) {
      await openList();
    }
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return;
    }
    ElMessage.error(getErrorMessage(error, '删除订阅授权失败'));
  }
};

const copyBindingSummary = async (row: RealtimeTopicRecord) => {
  try {
    await navigator.clipboard.writeText(buildRealtimeTopicClipboardSummary(row));
    ElMessage.success('绑定摘要已复制');
  } catch {
    ElMessage.warning('当前环境不支持复制');
  }
};

const topicContextMenuItems = [
  {
    key: 'detail',
    label: '查看详情',
    onSelect: (row) => openDetail(row),
  },
  {
    key: 'copy',
    label: '复制绑定摘要',
    onSelect: (row) => {
      void copyBindingSummary(row);
    },
  },
  {
    key: 'permission',
    label: '查看绑定权限',
    onSelect: (row) => {
      ElMessage.info(formatRealtimeTopicPermissionSummary(row));
    },
  },
  {
    key: 'divider',
    type: 'divider',
  },
  {
    key: 'edit',
    label: '编辑订阅授权',
    hidden: (row) => !canEdit.value || row.isSystem,
    onSelect: (row) => openEdit(row),
  },
  {
    key: 'delete',
    label: '删除订阅授权',
    hidden: (row) => !canDelete.value || row.isSystem,
    danger: true,
    onSelect: (row) => removeTopic(row),
  },
] satisfies ContextMenuItem<RealtimeTopicRecord>[];

const changePage = async (value: number) => {
  pageState.page = value;
  await loadData();
};

watch(
  () => [screenMode.value, activeTopicId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      selectedTopic.value = null;
      return;
    }

    if (mode === 'create') {
      selectedTopic.value = null;
      resetForm();
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    await loadTopicDetail(id);

    if (mode === 'edit' && selectedTopic.value) {
      if (selectedTopic.value.isSystem) {
        ElMessage.warning('系统注册的订阅授权不可编辑');
        await navigateToMode('detail', selectedTopic.value.id);
        return;
      }
      assignForm(selectedTopic.value);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  await loadData();
});
</script>

<style scoped lang="scss">
.topics-screen__meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.topics-screen__meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid var(--line-soft);
}

.topics-screen__meta-item span {
  color: var(--ink-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.topics-screen__meta-item strong {
  color: var(--ink-1);
  font-size: 20px;
  line-height: 1.2;
}

.topics-screen__relation-search {
  display: flex;
  gap: 10px;
}

.topics-screen__relation-search :deep(.el-input) {
  flex: 1;
}

.topics-screen__relation-card {
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

.topics-screen__relation-card.is-selected {
  border-color: color-mix(in srgb, var(--accent) 46%, var(--line-strong));
  background: var(--surface-accent-soft);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}

.topics-screen__relation-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.topics-screen__relation-badge {
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

.topics-screen__relation-card strong {
  font-size: 14px;
  line-height: 1.4;
}

.topics-screen__relation-card span,
.topics-screen__relation-card p {
  margin: 0;
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.topics-screen__pattern-guide,
.topics-screen__rule-list {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px dashed var(--line-strong);
  border-radius: 16px;
  background: var(--surface-1);
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.6;
}

.topics-screen__pattern-guide strong {
  color: var(--ink-1);
  font-size: 13px;
}

@media (max-width: 960px) {
  .topics-screen__relation-search {
    flex-direction: column;
  }
}
</style>
