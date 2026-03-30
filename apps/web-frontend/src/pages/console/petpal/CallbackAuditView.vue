<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadLogs">刷新</el-button>
        <ListExportButton :request="buildExportRequest" error-message="导出回调审计失败" />
      </el-space>
    </template>

    <template #toolbar>
      <CallbackAuditToolbar
        :filters="pageState.filters"
        :loading="loading"
        @apply="applyFilters"
        @reset="resetFilters"
      />
    </template>

    <div class="audit-workbench">
      <CallbackAuditTable
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

      <CallbackAuditWorkbenchSidebar
        :log="selectedLog"
        :page-signals="pageSignals"
      />
    </div>

    <CallbackAuditDetailDrawer
      v-model:visible="drawerVisible"
      :audit="selectedLog"
    />
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  CallbackAuditQuery,
  CallbackAuditRecord,
  CallbackAuditStats,
} from '@rbac/api-common';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import type { CallbackAuditFilters, AuditSignalItem } from './callback-audit-display';
import {
  compareCallbackAuditRecency,
  getActiveAuditFilterTokens,
} from './callback-audit-display';
import CallbackAuditDetailDrawer from './components/CallbackAuditDetailDrawer.vue';
import CallbackAuditTable from './components/CallbackAuditTable.vue';
import CallbackAuditToolbar from './components/CallbackAuditToolbar.vue';
import CallbackAuditWorkbenchSidebar from './components/CallbackAuditWorkbenchSidebar.vue';

defineOptions({ name: 'CallbackAuditView' });

definePage({
  viewKey: 'callback-audit',
  keepAlive: true,
});

type AuditPageState = {
  filters: CallbackAuditFilters;
  page: number;
};

const logs = ref<CallbackAuditRecord[]>([]);
const selectedLogId = ref<string | null>(null);
const drawerVisible = ref(false);
const loading = ref(false);
const total = ref(0);
const pageSize = 10;
const statsData = ref<CallbackAuditStats>({
  total: 0,
  successRate: 0,
  byStatus: {
    PENDING: 0,
    SUCCESS: 0,
    FAILURE: 0,
    ERROR: 0,
  },
  byType: {
    PAYMENT_CALLBACK: 0,
    REFUND_CALLBACK: 0,
  },
  bySourceMode: {
    TOKEN: 0,
    WECHATPAY_HMAC: 0,
    WECHATPAY_SDK: 0,
  },
});

const { state: pageState } = usePageState<AuditPageState>('page:petpal:callback-audit', {
  filters: {
    callbackType: undefined,
    callbackStatus: undefined,
    sourceMode: undefined,
    requestId: undefined,
    startDate: undefined,
    endDate: undefined,
  },
  page: 1,
});

const selectedLog = computed(() =>
  logs.value.find(item => item.id === selectedLogId.value)
  ?? logs.value[0]
  ?? null);

const failureCount = computed(() => statsData.value.byStatus.FAILURE + statsData.value.byStatus.ERROR);
const paymentCallbackCount = computed(() => statsData.value.byType.PAYMENT_CALLBACK);
const refundCallbackCount = computed(() => statsData.value.byType.REFUND_CALLBACK);

const activeKeyword = computed(() => {
  const filters = getActiveAuditFilterTokens(pageState.filters);
  return filters.length
    ? filters.map(item => `${item.label}:${item.value}`).join(' / ')
    : '全部回调';
});

const stats = computed(() => [
  { label: '回调总量', value: statsData.value.total },
  { label: '成功回调', value: statsData.value.byStatus.SUCCESS },
  { label: '失败回调', value: failureCount.value },
  { label: '支付回调', value: paymentCallbackCount.value },
  { label: '当前过滤', value: activeKeyword.value },
]);

const pageSignals = computed<AuditSignalItem[]>(() => [
  {
    label: '失败回调',
    value: failureCount.value,
    tone: failureCount.value ? 'danger' : 'neutral',
  },
  {
    label: '退款回调',
    value: refundCallbackCount.value,
    tone: 'neutral',
  },
  {
    label: '成功率',
    value: `${statsData.value.successRate}%`,
    tone: 'accent',
  },
]);

const buildFilterQuery = (): CallbackAuditQuery => ({
  callbackType: pageState.filters.callbackType as any || undefined,
  callbackStatus: pageState.filters.callbackStatus as any || undefined,
  sourceMode: pageState.filters.sourceMode as any || undefined,
  requestId: pageState.filters.requestId || undefined,
  startDate: pageState.filters.startDate || undefined,
  endDate: pageState.filters.endDate || undefined,
});

const buildFilterParams = (): CallbackAuditQuery => ({
  ...buildFilterQuery(),
  page: pageState.page,
  pageSize,
});

const buildExportRequest = () => api.petpal.admin.exportCallbackAudits(buildFilterQuery());

const syncSelectedLog = () => {
  if (!logs.value.length) {
    selectedLogId.value = null;
    return;
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
    const [response, statsResponse] = await Promise.all([
      api.petpal.admin.callbackAudits(buildFilterParams()),
      api.petpal.admin.callbackAuditStats(buildFilterQuery()),
    ]);

    logs.value = [...response.items].sort(compareCallbackAuditRecency);
    total.value = response.pagination.total;
    statsData.value = statsResponse;
    syncSelectedLog();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载回调审计日志失败'));
  } finally {
    loading.value = false;
  }
};

const applyFilters = async () => {
  pageState.page = 1;
  await loadLogs();
};

const resetFilters = async () => {
  pageState.filters.callbackType = undefined;
  pageState.filters.callbackStatus = undefined;
  pageState.filters.sourceMode = undefined;
  pageState.filters.requestId = undefined;
  pageState.filters.startDate = undefined;
  pageState.filters.endDate = undefined;
  pageState.page = 1;
  await loadLogs();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await loadLogs();
};

const selectLog = (row: CallbackAuditRecord) => {
  selectedLogId.value = row.id;
};

const openDetail = (row: CallbackAuditRecord) => {
  selectedLogId.value = row.id;
  drawerVisible.value = true;
};

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