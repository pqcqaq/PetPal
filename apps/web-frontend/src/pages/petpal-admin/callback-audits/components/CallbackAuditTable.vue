<template>
  <div class="callback-audit-table">
    <el-table
      :data="logs"
      :loading="loading"
      border
      stripe
      highlight-current-row
      max-height="600"
      @row-click="onRowSelect"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column label="回调类型" width="120" align="center">
        <template #default="{ row }">
          <el-tag type="info">{{ resolveCallbackTypeLabel(row.callbackType) }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="(getStatusTagType(row.callbackStatus) as any)">
            {{ resolveCallbackStatusLabel(row.callbackStatus) }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column label="验证来源" width="120" align="center">
        <template #default="{ row }">
          <el-tag type="warning">{{ resolveSourceModeLabel(row.sourceMode) }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column label="RequestId" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <code class="code-text">{{ row.requestId }}</code>
        </template>
      </el-table-column>

      <el-table-column label="时间戳" width="180" align="center">
        <template #default="{ row }">
          {{ formatAuditTimestamp(row.callbackTimestamp) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="onDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, next, jumper"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CallbackAuditRecord } from '@rbac/api-common';
import {
  formatAuditTimestamp,
  resolveCallbackStatusLabel,
  resolveCallbackTypeLabel,
  resolveSourceModeLabel,
} from '../callback-audit-display';

const props = defineProps<{
  logs: CallbackAuditRecord[];
  loading?: boolean;
  total: number;
  page: number;
  pageSize: number;
  selectedId?: string | null;
}>();

const emits = defineEmits<{
  detail: [row: CallbackAuditRecord];
  pageChange: [page: number];
  pageSizeChange: [pageSize: number];
  select: [row: CallbackAuditRecord];
}>();

const currentPage = computed({
  get: () => props.page,
  set: (value) => emits('pageChange', value),
});

const getStatusTagType = (status: string): string => {
  const typeMap: Record<string, string> = {
    SUCCESS: 'success',
    PENDING: 'warning',
    FAILURE: 'danger',
    ERROR: 'danger',
  };
  return typeMap[status] || 'success';
};

const onRowSelect = (row: CallbackAuditRecord) => {
  emits('select', row);
};

const onDetail = (row: CallbackAuditRecord) => {
  emits('detail', row);
};

const onPageChange = () => {
  emits('pageChange', currentPage.value);
};

const onPageSizeChange = (value: number) => {
  emits('pageSizeChange', value);
};
</script>

<style scoped>
.callback-audit-table {
  width: 100%;
}

.pagination-container {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.code-text {
  font-family: monospace;
  font-size: 12px;
  color: #666;
}
</style>
