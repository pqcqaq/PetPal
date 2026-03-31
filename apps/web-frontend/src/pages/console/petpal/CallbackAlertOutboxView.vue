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

    <el-table :data="rows" v-loading="loading" border>
      <el-table-column prop="createdAt" label="创建时间" min-width="170" />
      <el-table-column prop="eventType" label="事件类型" min-width="150" />
      <el-table-column label="状态" min-width="120">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)">{{ row.status }}</el-tag>
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
          <el-button
            link
            type="info"
            @click="openReplayLogs(row)"
          >
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
      <el-table :data="replayLogs" v-loading="replayLoading" border>
        <el-table-column prop="createdAt" label="时间" min-width="170" />
        <el-table-column prop="actionType" label="动作" min-width="150" />
        <el-table-column prop="actorId" label="操作人" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.actorId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.note || '-' }}</template>
        </el-table-column>
      </el-table>
    </el-drawer>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import type {
  CallbackAlertReplayLogRecord,
  CallbackAlertOutboxPage,
  CallbackAlertOutboxRecord,
  CallbackAlertOutboxStatus,
  CallbackAlertOutboxStats,
} from '@rbac/api-common';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import { usePageState } from '@/composables/use-page-state';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';

defineOptions({ name: 'CallbackAlertOutboxView' });

definePage({
  viewKey: 'callback-alert-outbox',
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
});

const { state: pageState } = usePageState<OutboxPageState>('page:petpal:callback-alert-outbox', {
  page: 1,
  filters: {
    status: undefined,
  },
});

const statusOptions: Array<{ label: string; value: CallbackAlertOutboxStatus }> = [
  { label: '待处理', value: 'PENDING' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '已发送', value: 'SENT' },
  { label: '失败', value: 'FAILED' },
  { label: '死信', value: 'DEAD' },
];

const stats = computed(() => [
  { label: '总量', value: statsData.value.total },
  { label: '待处理', value: statsData.value.byStatus.PENDING },
  { label: '最老待处理(分钟)', value: statsData.value.oldestPendingAgeMinutes },
  { label: '失败', value: statsData.value.byStatus.FAILED },
  { label: '死信', value: statsData.value.byStatus.DEAD },
  { label: '最老死信(分钟)', value: statsData.value.oldestDeadAgeMinutes },
  { label: '已发送', value: statsData.value.byStatus.SENT },
]);

const statusTagType = (status: CallbackAlertOutboxStatus) => {
  if (status === 'SENT') {
    return 'success';
  }
  if (status === 'FAILED' || status === 'DEAD') {
    return 'danger';
  }
  if (status === 'PROCESSING') {
    return 'warning';
  }
  return 'info';
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
      api.petpal.admin.callbackAlertOutboxStats({ status: pageState.filters.status }),
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

const applyFilters = async () => {
  pageState.page = 1;
  await loadOutbox();
};

const changePage = async (value: number) => {
  pageState.page = value;
  await loadOutbox();
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
  replayDrawerVisible.value = true;
  replayLoading.value = true;
  try {
    replayLogs.value = await api.petpal.admin.callbackAlertOutboxReplayLogs(row.id, 50);
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

onMounted(loadOutbox);
</script>

<style scoped lang="scss">
.table-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
