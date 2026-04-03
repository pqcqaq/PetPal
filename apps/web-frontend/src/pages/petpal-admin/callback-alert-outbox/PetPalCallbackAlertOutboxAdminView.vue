<template>
  <PageScaffold :stats="stats">
    <template #actions>
      <el-space>
        <el-button @click="loadOutbox">刷新</el-button>
        <el-button
          v-permission="'petpal.callback-alert.retry'"
          type="warning"
          plain
          @click="retryDeadRows"
        >
          重试死信（最多 50 条）
        </el-button>
      </el-space>
    </template>

    <template #toolbar>
      <el-space wrap>
        <el-select
          v-model="pageState.filters.status"
          placeholder="全部状态"
          clearable
          style="width: 200px"
          @change="applyFilters"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-space>
    </template>

    <el-table v-loading="loading" :data="rows" border>
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column prop="eventType" label="事件类型" min-width="150" />
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">
            {{ getCallbackAlertOutboxStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="回调类型" min-width="140">
        <template #default="{ row }">
          {{ row.callbackAudit?.callbackType ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column label="RequestId" min-width="220">
        <template #default="{ row }">
          {{ row.callbackAudit?.requestId ?? '-' }}
        </template>
      </el-table-column>
      <el-table-column label="重试次数" min-width="120">
        <template #default="{ row }">
          {{ row.retryCount }}/{{ row.maxRetries }}
        </template>
      </el-table-column>
      <el-table-column label="下次重试时间" min-width="170">
        <template #default="{ row }">
          {{ row.nextRetryAt }}
        </template>
      </el-table-column>
      <el-table-column label="最后错误" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.lastError || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="info" @click="openReplayLogs(row)">
            记录
          </el-button>
          <el-button
            v-permission="'petpal.callback-alert.retry'"
            link
            type="primary"
            :disabled="row.status === 'SENT' || row.status === 'PROCESSING'"
            @click="retryRow(row.id)"
          >
            重试
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :current-page="pageState.page"
        :page-size="pageSize"
        :total="total"
        @current-change="changePage"
      />
    </div>

    <el-drawer
      v-model="replayDrawerVisible"
      title="重放记录"
      size="520px"
    >
      <el-space wrap style="margin-bottom: 12px">
        <el-select
          v-model="replayFilter.actionType"
          placeholder="全部动作"
          clearable
          style="width: 180px"
        >
          <el-option
            v-for="item in callbackAlertReplayActionOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-input
          v-model="replayFilter.actorId"
          placeholder="操作人 ID"
          clearable
          style="width: 220px"
        />
        <el-date-picker
          v-model="replayFilter.range"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          value-format="YYYY-MM-DDTHH:mm:ss.SSS[Z]"
          style="width: 360px"
        />
        <ListExportButton
          v-permission="'petpal.callback-alert.export'"
          :request="buildReplayExportRequest"
          error-message="导出重放记录失败"
        />
        <el-button @click="applyReplayFilters">筛选</el-button>
      </el-space>
      <el-space wrap style="margin-bottom: 12px">
        <el-tag type="info">总记录 {{ replayStats.total }}</el-tag>
        <el-tag type="success">
          {{ getCallbackAlertReplayActionLabel('REQUEUE') }} {{ replayStats.byAction.REQUEUE }}
        </el-tag>
        <el-tag type="warning">
          {{ getCallbackAlertReplayActionLabel('REQUEUE_DEAD_BATCH') }} {{ replayStats.byAction.REQUEUE_DEAD_BATCH }}
        </el-tag>
        <el-tag>操作人数 {{ replayStats.uniqueActorCount }}</el-tag>
        <el-tag>批量占比 {{ Number((replayStats.batchReplayRatio * 100).toFixed(1)) }}%</el-tag>
        <el-tag>阈值 {{ Number((replayStats.dominanceThreshold * 100).toFixed(0)) }}% / {{ replayStats.dominanceMinSamples }} 条</el-tag>
        <el-tag>静默阈值 {{ replayStats.staleThresholdMinutes }} 分钟</el-tag>
        <el-tag type="info">最近重放 {{ replayStats.latestReplayAt || '-' }}</el-tag>
        <el-tag>距今 {{ replayStats.minutesSinceLastReplay ?? '-' }} 分钟</el-tag>
        <el-tag v-if="replayStats.isBatchReplayDominant" type="danger">批量重放占比偏高</el-tag>
        <el-tag v-if="replayStats.isReplayStale" type="danger">重放活动静默超阈值</el-tag>
      </el-space>
      <el-table v-loading="replayLoading" :data="replayLogs" border>
        <el-table-column prop="createdAt" label="时间" min-width="170" />
        <el-table-column prop="actionType" label="动作" min-width="150">
          <template #default="{ row }">
            {{ getCallbackAlertReplayActionLabel(row.actionType) }}
          </template>
        </el-table-column>
        <el-table-column prop="actorId" label="操作人" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.actorId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '-' }}</template>
        </el-table-column>
      </el-table>
      <div class="table-footer">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :current-page="replayPage"
          :page-size="replayPageSize"
          :total="replayTotal"
          @current-change="changeReplayPage"
        />
      </div>
    </el-drawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  CallbackAlertOutboxPage,
  CallbackAlertOutboxRecord,
  CallbackAlertOutboxStats,
  CallbackAlertOutboxStatus,
  CallbackAlertReplayLogPage,
  CallbackAlertReplayLogRecord,
  CallbackAlertReplayLogStats,
  DownloadRequestConfig,
} from '@rbac/api-common';
import { useRoute, useRouter } from 'vue-router';
import ListExportButton from '@/components/download/ListExportButton.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import {
  callbackAlertOutboxStatusOptions,
  callbackAlertReplayActionOptions,
  getCallbackAlertOutboxStatusLabel,
  getCallbackAlertOutboxStatusTagType,
  getCallbackAlertReplayActionLabel,
} from './callback-alert-outbox-options';
import {
  buildRouteQuerySnapshot,
  getSingleRouteQueryValue,
  normalizeStringRouteQuery,
} from '../shared/route-query';
import { hasSelectOptionValue } from '../shared/option-value';

defineOptions({ name: 'PetPalCallbackAlertOutboxAdminView' });

definePage({
  viewKey: 'petpal-callback-alert-outbox',
  keepAlive: true,
});

type PageFilters = {
  status?: CallbackAlertOutboxStatus;
};

type OutboxPageState = {
  page: number;
  filters: PageFilters;
};

const rows = ref<CallbackAlertOutboxRecord[]>([]);
const total = ref(0);
const pageSize = 10;
const loading = ref(false);
const replayLoading = ref(false);
const replayDrawerVisible = ref(false);
const replayLogs = ref<CallbackAlertReplayLogRecord[]>([]);
const replayPage = ref(1);
const replayPageSize = 10;
const replayTotal = ref(0);
const replayDominanceThreshold = 0.7;
const replayDominanceMinSamples = 5;
const replayStaleThresholdMinutes = 30;
const replayStats = ref<CallbackAlertReplayLogStats>({
  total: 0,
  byAction: {
    REQUEUE: 0,
    REQUEUE_DEAD_BATCH: 0,
  },
  uniqueActorCount: 0,
  batchReplayRatio: 0,
  isBatchReplayDominant: false,
  latestReplayAt: null,
  minutesSinceLastReplay: null,
  dominanceThreshold: replayDominanceThreshold,
  dominanceMinSamples: replayDominanceMinSamples,
  staleThresholdMinutes: replayStaleThresholdMinutes,
  isReplayStale: false,
});
const currentReplayOutboxId = ref<string>('');
const replayFilter = ref<{
  actionType?: 'REQUEUE' | 'REQUEUE_DEAD_BATCH';
  actorId?: string;
  range?: [string, string] | [];
}>({});
const processingTimeoutMinutes = 10;
const statsData = ref<CallbackAlertOutboxStats>({
  total: 0,
  byStatus: {
    PENDING: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
    DEAD: 0,
  },
  oldestPendingAgeMinutes: 0,
  oldestDeadAgeMinutes: 0,
  stuckProcessingCount: 0,
  processingTimeoutMinutes,
});
const route = useRoute();
const router = useRouter();

const { state: pageState } = usePageState<OutboxPageState>('page:petpal:callback-alert-outbox', {
  page: 1,
  filters: {
    status: undefined,
  },
});

const stats = computed(() => [
  { label: '总量', value: statsData.value.total },
  { label: '待处理', value: statsData.value.byStatus.PENDING },
  { label: '最老待处理(分钟)', value: statsData.value.oldestPendingAgeMinutes },
  { label: '失败', value: statsData.value.byStatus.FAILED },
  { label: '死信', value: statsData.value.byStatus.DEAD },
  { label: '最老死信(分钟)', value: statsData.value.oldestDeadAgeMinutes },
  {
    label: `处理中超时(>${statsData.value.processingTimeoutMinutes}分钟)`,
    value: statsData.value.stuckProcessingCount,
  },
  { label: '已发送', value: statsData.value.byStatus.SENT },
]);

const statusOptions = callbackAlertOutboxStatusOptions;
const statusTagType = getCallbackAlertOutboxStatusTagType;

const routeFilterKeys = ['page', 'status'] as const;

const buildRouteQuery = () => {
  const query: Record<string, string> = {};
  if (pageState.page > 1) {
    query.page = String(pageState.page);
  }
  if (pageState.filters.status) {
    query.status = pageState.filters.status;
  }
  return query;
};

const hydrateStateFromRoute = () => {
  const hasKnownQuery = routeFilterKeys.some((key) => typeof route.query[key] === 'string');
  if (!hasKnownQuery) {
    return;
  }

  const page = Number.parseInt(getSingleRouteQueryValue(route.query.page), 10);
  const status = getSingleRouteQueryValue(route.query.status);

  pageState.page = Number.isFinite(page) && page > 0 ? page : 1;
  pageState.filters.status = hasSelectOptionValue(statusOptions, status)
    ? status
    : undefined;
};

const buildQuery = () => ({
  status: pageState.filters.status,
  page: pageState.page,
  pageSize,
});

const loadOutbox = async () => {
  try {
    loading.value = true;
    const [listRes, statsRes] = await Promise.all([
      api.petpal.admin.callbackAlertOutbox(buildQuery()),
      api.petpal.admin.callbackAlertOutboxStats({
        status: pageState.filters.status,
        processingTimeoutMinutes,
      }),
    ]);

    const listData = listRes as CallbackAlertOutboxPage;
    rows.value = listData.items;
    total.value = listData.pagination.total;
    statsData.value = statsRes;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载回调告警队列失败'));
  } finally {
    loading.value = false;
  }
};

const syncRouteAndLoad = async () => {
  const nextQuery = buildRouteQuery();
  const currentQuery = normalizeStringRouteQuery(route.query as Record<string, unknown>);
  const nextSnapshot = buildRouteQuerySnapshot(nextQuery);
  const currentSnapshot = buildRouteQuerySnapshot(currentQuery);

  if (nextSnapshot === currentSnapshot) {
    await loadOutbox();
    return;
  }

  await router.replace({ query: nextQuery });
};

const applyFilters = async () => {
  pageState.page = 1;
  await syncRouteAndLoad();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await syncRouteAndLoad();
};

const retryRow = async (id: string) => {
  try {
    await api.petpal.admin.retryCallbackAlertOutbox(id);
    ElMessage.success('已重新入队');
    await loadOutbox();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '重试失败'));
  }
};

const openReplayLogs = async (row: CallbackAlertOutboxRecord) => {
  currentReplayOutboxId.value = row.id;
  replayFilter.value = {};
  replayPage.value = 1;
  replayDrawerVisible.value = true;
  await reloadReplayLogs();
};

const applyReplayFilters = async () => {
  replayPage.value = 1;
  await reloadReplayLogs();
};

const changeReplayPage = async (value: number) => {
  replayPage.value = value;
  await reloadReplayLogs();
};

const buildReplayExportRequest = (): DownloadRequestConfig =>
  api.petpal.admin.exportCallbackAlertOutboxReplayLogs({
    outboxId: currentReplayOutboxId.value,
    actionType: replayFilter.value.actionType,
    actorId: replayFilter.value.actorId?.trim() || undefined,
    startDate: replayFilter.value.range?.[0],
    endDate: replayFilter.value.range?.[1],
  });

const reloadReplayLogs = async () => {
  if (!currentReplayOutboxId.value) {
    replayLogs.value = [];
    return;
  }

  replayLoading.value = true;
  try {
    const replayQuery = {
      page: replayPage.value,
      pageSize: replayPageSize,
      actionType: replayFilter.value.actionType,
      actorId: replayFilter.value.actorId?.trim() || undefined,
      startDate: replayFilter.value.range?.[0],
      endDate: replayFilter.value.range?.[1],
      dominanceThreshold: replayDominanceThreshold,
      dominanceMinSamples: replayDominanceMinSamples,
      staleThresholdMinutes: replayStaleThresholdMinutes,
    };
    const [replayPageData, replayStatsData] = await Promise.all([
      api.petpal.admin.callbackAlertOutboxReplayLogs(currentReplayOutboxId.value, replayQuery),
      api.petpal.admin.callbackAlertOutboxReplayLogStats(currentReplayOutboxId.value, replayQuery),
    ]);
    const data = replayPageData as CallbackAlertReplayLogPage;
    replayLogs.value = data.items;
    replayTotal.value = data.pagination.total;
    replayStats.value = replayStatsData;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载重放记录失败'));
  } finally {
    replayLoading.value = false;
  }
};

const retryDeadRows = async () => {
  try {
    const result = await api.petpal.admin.retryDeadCallbackAlertOutbox(50);
    ElMessage.success(`已重试 ${result.requeued} 条死信`);
    await loadOutbox();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '批量重试死信失败'));
  }
};

watch(
  () => route.fullPath,
  () => {
    hydrateStateFromRoute();
    void loadOutbox();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.table-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
