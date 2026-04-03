<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadLogs">刷新</el-button>
        <ListExportButton
          v-permission="'petpal.callback-audit.export'"
          :request="buildExportRequest"
          error-message="导出回调审计失败"
        />
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
        :page-size="pageState.pageSize"
        :selected-id="selectedLog?.id ?? null"
        @detail="openDetail"
        @page-change="changePage"
        @page-size-change="changePageSize"
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
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  CallbackAuditQuery,
  CallbackAuditRecord,
  CallbackAuditStats,
} from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import type {
  AuditSignalItem,
  CallbackAuditFilters,
} from './callback-audit-display';
import {
  callbackAuditSourceModeOptions,
  callbackAuditStatusOptions,
  callbackAuditTypeOptions,
  compareCallbackAuditRecency,
  getActiveAuditFilterTokens,
} from './callback-audit-display';
import CallbackAuditDetailDrawer from './components/CallbackAuditDetailDrawer.vue';
import CallbackAuditTable from './components/CallbackAuditTable.vue';
import CallbackAuditToolbar from './components/CallbackAuditToolbar.vue';
import CallbackAuditWorkbenchSidebar from './components/CallbackAuditWorkbenchSidebar.vue';

defineOptions({ name: 'PetPalCallbackAuditAdminView' });

definePage({
  viewKey: 'petpal-callback-audit',
  keepAlive: true,
});

type AuditPageState = {
  filters: CallbackAuditFilters;
  page: number;
  pageSize: number;
};

const logs = ref<CallbackAuditRecord[]>([]);
const selectedLogId = ref<string | null>(null);
const drawerVisible = ref(false);
const loading = ref(false);
const total = ref(0);
const route = useRoute();
const router = useRouter();
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
  pageSize: 10,
});

const selectedLog = computed(
  () => logs.value.find(item => item.id === selectedLogId.value)
    ?? logs.value[0]
    ?? null,
);

const routeFilterKeys = [
  'page',
  'pageSize',
  'callbackType',
  'callbackStatus',
  'sourceMode',
  'requestId',
  'startDate',
  'endDate',
] as const;

const getSingleQueryValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  return '';
};

const normalizeRouteQuery = (query: Record<string, unknown>) => Object.entries(query)
  .reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string' && value.trim()) {
      acc[key] = value.trim();
    }
    return acc;
  }, {});

const buildRouteQuery = () => {
  const query: Record<string, string> = {};
  if (pageState.page > 1) {
    query.page = String(pageState.page);
  }
  if (pageState.pageSize !== 10) {
    query.pageSize = String(pageState.pageSize);
  }
  if (pageState.filters.callbackType) {
    query.callbackType = pageState.filters.callbackType;
  }
  if (pageState.filters.callbackStatus) {
    query.callbackStatus = pageState.filters.callbackStatus;
  }
  if (pageState.filters.sourceMode) {
    query.sourceMode = pageState.filters.sourceMode;
  }
  if (pageState.filters.requestId?.trim()) {
    query.requestId = pageState.filters.requestId.trim();
  }
  if (pageState.filters.startDate) {
    query.startDate = pageState.filters.startDate;
  }
  if (pageState.filters.endDate) {
    query.endDate = pageState.filters.endDate;
  }
  return query;
};

const hydrateStateFromRoute = () => {
  const hasKnownQuery = routeFilterKeys.some((key) => typeof route.query[key] === 'string');
  if (!hasKnownQuery) {
    return;
  }

  const page = Number.parseInt(getSingleQueryValue(route.query.page), 10);
  const pageSize = Number.parseInt(getSingleQueryValue(route.query.pageSize), 10);
  const callbackType = getSingleQueryValue(route.query.callbackType);
  const callbackStatus = getSingleQueryValue(route.query.callbackStatus);
  const sourceMode = getSingleQueryValue(route.query.sourceMode);

  pageState.page = Number.isFinite(page) && page > 0 ? page : 1;
  pageState.pageSize = [10, 20, 50, 100].includes(pageSize) ? pageSize : 10;
  pageState.filters.callbackType = callbackAuditTypeOptions.some((item) => item.value === callbackType)
    ? callbackType as CallbackAuditFilters['callbackType']
    : undefined;
  pageState.filters.callbackStatus = callbackAuditStatusOptions.some(
    (item) => item.value === callbackStatus,
  )
    ? callbackStatus as CallbackAuditFilters['callbackStatus']
    : undefined;
  pageState.filters.sourceMode = callbackAuditSourceModeOptions.some(
    (item) => item.value === sourceMode,
  )
    ? sourceMode as CallbackAuditFilters['sourceMode']
    : undefined;
  pageState.filters.requestId = getSingleQueryValue(route.query.requestId) || undefined;
  pageState.filters.startDate = getSingleQueryValue(route.query.startDate) || undefined;
  pageState.filters.endDate = getSingleQueryValue(route.query.endDate) || undefined;
};

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
  callbackType: pageState.filters.callbackType || undefined,
  callbackStatus: pageState.filters.callbackStatus || undefined,
  sourceMode: pageState.filters.sourceMode || undefined,
  requestId: pageState.filters.requestId || undefined,
  startDate: pageState.filters.startDate || undefined,
  endDate: pageState.filters.endDate || undefined,
});

const buildFilterParams = (): CallbackAuditQuery => ({
  ...buildFilterQuery(),
  page: pageState.page,
  pageSize: pageState.pageSize,
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

const syncRouteAndLoad = async () => {
  const nextQuery = buildRouteQuery();
  const currentQuery = normalizeRouteQuery(route.query as Record<string, unknown>);
  const nextSnapshot = JSON.stringify(
    Object.entries(nextQuery).sort(([left], [right]) => left.localeCompare(right)),
  );
  const currentSnapshot = JSON.stringify(
    Object.entries(currentQuery).sort(([left], [right]) => left.localeCompare(right)),
  );

  if (nextSnapshot === currentSnapshot) {
    await loadLogs();
    return;
  }

  await router.replace({ query: nextQuery });
};

const applyFilters = async () => {
  pageState.page = 1;
  await syncRouteAndLoad();
};

const resetFilters = async () => {
  pageState.filters.callbackType = undefined;
  pageState.filters.callbackStatus = undefined;
  pageState.filters.sourceMode = undefined;
  pageState.filters.requestId = undefined;
  pageState.filters.startDate = undefined;
  pageState.filters.endDate = undefined;
  pageState.page = 1;
  pageState.pageSize = 10;
  await syncRouteAndLoad();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await syncRouteAndLoad();
};

const changePageSize = async (value: number) => {
  pageState.pageSize = value;
  pageState.page = 1;
  await syncRouteAndLoad();
};

const selectLog = (row: CallbackAuditRecord) => {
  selectedLogId.value = row.id;
};

const openDetail = (row: CallbackAuditRecord) => {
  selectedLogId.value = row.id;
  drawerVisible.value = true;
};

watch(
  () => route.fullPath,
  () => {
    hydrateStateFromRoute();
    void loadLogs();
  },
  { immediate: true },
);
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
