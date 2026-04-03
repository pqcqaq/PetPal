<template>
  <div v-if="log" class="sidebar-panel">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>回调信息</span>
        </div>
      </template>

      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="回调类型">
          {{ resolveCallbackTypeLabel(log.callbackType) }}
        </el-descriptions-item>
        <el-descriptions-item label="回调状态">
          <el-tag :type="(getStatusTagType(log.callbackStatus) as any)">
            {{ resolveCallbackStatusLabel(log.callbackStatus) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="验证来源">
          {{ resolveSourceModeLabel(log.sourceMode) }}
        </el-descriptions-item>
        <el-descriptions-item label="RequestId">
          <code class="code-text">{{ log.requestId.substring(0, 16) }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="时间戳">
          {{ formatAuditTimestamp(log.callbackTimestamp) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="box-card" style="margin-top: 12px">
      <template #header>
        <div class="card-header">
          <span>关键指标</span>
        </div>
      </template>

      <div class="signals-grid">
        <div
          v-for="signal in pageSignals"
          :key="signal.label"
          class="signal-item"
          :class="`tone-${signal.tone || 'neutral'}`"
        >
          <div class="signal-label">{{ signal.label }}</div>
          <div class="signal-value">{{ signal.value }}</div>
        </div>
      </div>
    </el-card>

    <template v-if="log.payment">
      <el-card class="box-card" style="margin-top: 12px">
        <template #header>
          <div class="card-header">
            <span>支付关联</span>
          </div>
        </template>

        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="PayNo">
            <code class="code-text">{{ log.payment.payNo }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="金额">
            <strong>¥{{ log.payment.amount }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ log.payment.status }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <template v-if="log.refund">
      <el-card class="box-card" style="margin-top: 12px">
        <template #header>
          <div class="card-header">
            <span>退款关联</span>
          </div>
        </template>

        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="RefundNo">
            <code class="code-text">{{ log.refund.refundNo }}</code>
          </el-descriptions-item>
          <el-descriptions-item label="金额">
            <strong>¥{{ log.refund.amount }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ log.refund.status }}
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CallbackAuditRecord } from '@rbac/api-common';
import type { AuditSignalItem } from '../callback-audit-display';
import {
  formatAuditTimestamp,
  resolveCallbackStatusLabel,
  resolveCallbackStatusTagType,
  resolveCallbackTypeLabel,
  resolveSourceModeLabel,
} from '../callback-audit-display';

defineProps<{
  log: CallbackAuditRecord | null;
  pageSignals: AuditSignalItem[];
}>();

const getStatusTagType = resolveCallbackStatusTagType;
</script>

<style scoped>
.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.box-card {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.signals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 8px;
}

.signal-item {
  padding: 12px;
  border-radius: 4px;
  text-align: center;
  border: 1px solid #e0e0e0;
}

.signal-item.tone-danger {
  background-color: #fef0f0;
  border-color: #fde2e4;
  color: #f56c6c;
}

.signal-item.tone-warning {
  background-color: #fdf6ec;
  border-color: #f5dab1;
  color: #e6a23c;
}

.signal-item.tone-accent {
  background-color: #f0f9ff;
  border-color: #b3d8ff;
  color: #409eff;
}

.signal-item.tone-neutral {
  background-color: #f5f5f5;
  border-color: #e6e6e6;
  color: #666;
}

.signal-label {
  font-size: 12px;
  color: inherit;
  margin-bottom: 4px;
}

.signal-value {
  font-size: 16px;
  font-weight: bold;
  color: inherit;
}

.code-text {
  font-family: monospace;
  font-size: 12px;
  color: #666;
  background-color: #f5f5f5;
  padding: 2px 4px;
  border-radius: 2px;
}
</style>
