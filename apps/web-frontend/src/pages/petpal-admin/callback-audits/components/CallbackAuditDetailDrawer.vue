<template>
  <el-drawer
    v-model="visible"
    title="回调审计详情"
    size="50%"
    destroy-on-close
  >
    <el-empty v-if="!audit" description="无数据" />

    <div v-else class="detail-content">
      <el-collapse accordion>
        <el-collapse-item title="基本信息" name="basic">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="回调类型">
              {{ resolveCallbackTypeLabel(audit.callbackType) }}
            </el-descriptions-item>
            <el-descriptions-item label="回调状态">
              <el-tag :type="(getStatusTagType(audit.callbackStatus) as any)">
                {{ resolveCallbackStatusLabel(audit.callbackStatus) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="验证来源">
              {{ resolveSourceModeLabel(audit.sourceMode) }}
            </el-descriptions-item>
            <el-descriptions-item label="RequestId">
              <code>{{ audit.requestId }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="回调时间">
              {{ formatAuditTimestamp(audit.callbackTimestamp) }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ formatAuditTimestamp(audit.createdAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>

        <el-collapse-item v-if="audit.payment" title="支付关联信息" name="payment">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="支付订单号">
              {{ audit.payment.payNo }}
            </el-descriptions-item>
            <el-descriptions-item label="订单ID">
              {{ audit.payment.orderId }}
            </el-descriptions-item>
            <el-descriptions-item label="支付金额">
              ¥{{ audit.payment.amount }}
            </el-descriptions-item>
            <el-descriptions-item label="支付状态">
              {{ audit.payment.status }}
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>

        <el-collapse-item v-if="audit.refund" title="退款关联信息" name="refund">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="退款单号">
              {{ audit.refund.refundNo }}
            </el-descriptions-item>
            <el-descriptions-item label="订单ID">
              {{ audit.refund.orderId }}
            </el-descriptions-item>
            <el-descriptions-item label="退款金额">
              ¥{{ audit.refund.amount }}
            </el-descriptions-item>
            <el-descriptions-item label="退款状态">
              {{ audit.refund.status }}
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>

        <el-collapse-item title="验证结果详情" name="verification">
          <div class="json-viewer">
            <el-tree
              :data="jsonTreeData"
              node-key="id"
              :props="{ children: 'children', label: 'label' }"
              default-expand-all
              :indent="16"
            />
          </div>
        </el-collapse-item>

        <el-collapse-item title="原始回调体" name="payload">
          <el-input
            v-model="formattedPayload"
            type="textarea"
            :rows="10"
            readonly
            resize="none"
          />
          <el-button style="margin-top: 8px" @click="copyPayload">
            复制原始体
          </el-button>
        </el-collapse-item>

        <el-collapse-item title="签名验证信息" name="signature">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="签名摘要">
              <code>{{ audit.signatureDigest }}</code>
            </el-descriptions-item>
          </el-descriptions>
        </el-collapse-item>
      </el-collapse>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { CallbackAuditRecord } from '@rbac/api-common';
import {
  formatAuditTimestamp,
  resolveCallbackStatusLabel,
  resolveCallbackTypeLabel,
  resolveSourceModeLabel,
} from '../callback-audit-display';

const props = defineProps<{
  visible: boolean;
  audit: CallbackAuditRecord | null;
}>();

const emits = defineEmits<{
  'update:visible': [value: boolean];
}>();

const visible = computed({
  get: () => props.visible,
  set: (value) => emits('update:visible', value),
});

const formattedPayload = computed(() => {
  if (!props.audit?.rawPayload) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(props.audit.rawPayload), null, 2);
  } catch {
    return props.audit.rawPayload;
  }
});

const jsonTreeData = computed(() => {
  if (!props.audit?.verificationResult) {
    return [];
  }

  const buildTree = (obj: unknown, parentId = ''): Array<{ id: string; label: string; children: unknown[] }> => {
    if (!obj || typeof obj !== 'object') {
      return [];
    }

    return Object.entries(obj).map(([key, value], index) => {
      const id = `${parentId}-${key}-${index}`;
      const label = `${key}: ${typeof value === 'object' ? '{...}' : JSON.stringify(value)}`;

      return {
        id,
        label,
        children: typeof value === 'object' && value !== null ? buildTree(value, id) : [],
      };
    });
  };

  return buildTree(props.audit.verificationResult);
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

const copyPayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPayload.value);
    ElMessage.success('已复制到剪贴板');
  } catch {
    ElMessage.error('复制失败');
  }
};
</script>

<style scoped>
.detail-content {
  padding: 16px;
}

.json-viewer {
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
}

code {
  font-family: monospace;
  font-size: 12px;
  background-color: #f5f5f5;
  padding: 2px 4px;
  border-radius: 2px;
  color: #666;
}
</style>
