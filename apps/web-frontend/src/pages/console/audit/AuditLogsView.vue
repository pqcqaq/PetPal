<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space v-if="!isDetailMode">
        <el-button @click="loadLogs">刷新日志</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出审计日志失败" />
      </el-space>

      <el-space v-else>
        <el-button @click="openList">返回审计清单</el-button>
        <el-button @click="refreshCurrentScreen">刷新当前详情</el-button>
      </el-space>
    </template>

    <template v-if="!isDetailMode" #toolbar>
      <AuditToolbar
        :filters="pageState.filters"
        :loading="loading"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <div v-if="!isDetailMode" class="audit-workbench">
      <AuditTable
        :logs="logs"
        :loading="loading"
        :total="total"
        :page="pageState.page"
        :page-size="pageSize"
        :selected-id="selectedLog?.id ?? null"
        @detail="openDetail"
        @page-change="changePage"
        @select="selectLog"
      />

      <AuditWorkbenchSidebar
        :log="selectedLog"
        :page-signals="pageSignals"
        :hot-models="hotModels"
        @detail="openDetail"
      />
    </div>

    <AuditDetailDrawer v-else :log="selectedLog" />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type { RequestAuditRecord } from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import type { AuditFilters, AuditSignalItem } from './audit-display';
import {
  compareRequestAuditRecency,
  formatAuditDuration,
  getActiveAuditFilterTokens,
} from './audit-display';
import AuditDetailDrawer from './components/AuditDetailDrawer.vue';
import AuditTable from './components/AuditTable.vue';
import AuditToolbar from './components/AuditToolbar.vue';
import AuditWorkbenchSidebar from './components/AuditWorkbenchSidebar.vue';

defineOptions({ name: 'AuditView' });

definePage({
  viewKey: 'audit',
  keepAlive: true,
});

type AuditPageState = {
  filters: AuditFilters;
  page: number;
};

type AuditScreenMode = 'list' | 'detail';

const logs = ref<RequestAuditRecord[]>([]);
const selectedLogId = ref<string | null>(null);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;
const route = useRoute();
const router = useRouter();

const { state: pageState } = usePageState<AuditPageState>('page:audit', {
  filters: {
    q: '',
    method: '',
    model: '',
    operation: '',
    status: '',
  },
  page: 1,
});

const allowedModes: AuditScreenMode[] = ['list', 'detail'];
const screenMode = computed<AuditScreenMode>(() => {
  const value = typeof route.query.mode === 'string' ? route.query.mode : '';
  return allowedModes.includes(value as AuditScreenMode) ? (value as AuditScreenMode) : 'list';
});
const activeAuditId = computed(() => (typeof route.query.id === 'string' ? route.query.id : ''));
const isDetailMode = computed(() => screenMode.value === 'detail');

const selectedLog = computed(() =>
  logs.value.find(item => item.id === selectedLogId.value)
  ?? logs.value[0]
  ?? null);
const failedCount = computed(() => logs.value.filter(item => !item.success).length);
const readOnlyCount = computed(() => logs.value.filter(item => item.writeCount === 0).length);
const writeRequestCount = computed(() => logs.value.filter(item => item.writeCount > 0).length);
const rolledBackRequestCount = computed(() =>
  logs.value.filter(item => item.operations.some(operation =>
    operation.effectKind === 'WRITE' && !operation.committed,
  )).length);
const pageOperationTotal = computed(() =>
  logs.value.reduce((sum, item) => sum + item.operationCount, 0));
const pageWriteOperationTotal = computed(() =>
  logs.value.reduce((sum, item) => sum + item.writeCount, 0));
const averageDurationMs = computed(() =>
  logs.value.length
    ? Math.round(logs.value.reduce((sum, item) => sum + item.durationMs, 0) / logs.value.length)
    : 0);
const hotModels = computed(() => {
  const counts = new Map<string, number>();

  logs.value.forEach((item) => {
    item.operations.forEach((operation) => {
      counts.set(operation.model, (counts.get(operation.model) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([model, count]) => ({ model, count }));
});
const activeKeyword = computed(() => {
  const filters = getActiveAuditFilterTokens(pageState.filters);
  return filters.length
    ? filters.map(item => `${item.label}:${item.value}`).join(' / ')
    : '全部请求';
});
const stats = computed(() => [
  { label: '请求总量', value: total.value },
  { label: '当前页操作', value: pageOperationTotal.value },
  { label: '写入请求', value: writeRequestCount.value },
  { label: '平均耗时', value: formatAuditDuration(averageDurationMs.value) },
  { label: '当前过滤', value: activeKeyword.value },
]);
const pageSignals = computed<AuditSignalItem[]>(() => [
  {
    label: '失败请求',
    value: failedCount.value,
    tone: failedCount.value ? 'danger' : 'neutral',
  },
  {
    label: '回滚请求',
    value: rolledBackRequestCount.value,
    tone: rolledBackRequestCount.value ? 'danger' : 'neutral',
  },
  {
    label: '只读请求',
    value: readOnlyCount.value,
    tone: 'neutral',
  },
  {
    label: '写入密度',
    value: `${pageOperationTotal.value
      ? Math.round((pageWriteOperationTotal.value / pageOperationTotal.value) * 100)
      : 0}%`,
    tone: 'accent',
  },
]);

const buildFilterParams = () => ({
  q: pageState.filters.q || undefined,
  method: pageState.filters.method || undefined,
  model: pageState.filters.model || undefined,
  operation: pageState.filters.operation || undefined,
  status: pageState.filters.status || undefined,
});

const buildExportRequest = () => api.audit.export(buildFilterParams());

const navigateToMode = async (mode: AuditScreenMode, id?: string) => {
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

const syncSelectedLog = () => {
  if (!logs.value.length) {
    selectedLogId.value = null;
    return;
  }

  if (isDetailMode.value && activeAuditId.value) {
    selectedLogId.value = activeAuditId.value;
  }

  const keepSelected = selectedLogId.value
    && logs.value.some(item => item.id === selectedLogId.value);

  if (!keepSelected) {
    selectedLogId.value = logs.value[0]?.id ?? null;
  }
};

const loadLogs = async () => {
  try {
    loading.value = true;
    const response = await api.audit.list({
      page: pageState.page,
      pageSize,
      ...buildFilterParams(),
    });

    logs.value = [...response.items].sort(compareRequestAuditRecency);
    total.value = response.meta.total;
    syncSelectedLog();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载审计日志失败'));
  } finally {
    loading.value = false;
  }
};

const refreshCurrentScreen = async () => {
  await loadLogs();
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadLogs();
};

const resetFilters = async () => {
  pageState.filters.q = '';
  pageState.filters.method = '';
  pageState.filters.model = '';
  pageState.filters.operation = '';
  pageState.filters.status = '';
  pageState.page = 1;
  await loadLogs();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await loadLogs();
};

const selectLog = (row: RequestAuditRecord) => {
  selectedLogId.value = row.id;
};

const openDetail = async (row: RequestAuditRecord) => {
  selectedLogId.value = row.id;
  await navigateToMode('detail', row.id);
};

watch(
  () => [screenMode.value, activeAuditId.value] as const,
  async ([mode, id]) => {
    if (mode === 'list') {
      return;
    }

    if (!id) {
      await openList();
      return;
    }

    selectedLogId.value = id;
  },
  { immediate: true },
);

onMounted(loadLogs);
</script>

<style scoped lang="scss">
.audit-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.95fr);
  gap: 14px;
  align-items: start;
}

@media (max-width: 1180px) {
  .audit-workbench {
    grid-template-columns: 1fr;
  }
}
</style>
