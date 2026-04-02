<template>
  <PetPalDeskPage
    eyebrow="售后中心"
    title="售后链路单独集中查看，不再回订单详情里逐笔翻找"
    summary="退款进度、投诉状态和导出入口都收在这里，创建动作和完整上下文继续在结果页或订单详情处理。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-aftersales"
    :actions="[{ label: '订单队列', to: { name: 'frontend-petpal-orders' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="loadState === 'error' || summaryFailureCount"
            :loading="sectionReloadingKey === 'aftersales'"
            @click="retryAftersales"
          >
            重试售后摘要
          </el-button>
          <RouterLink v-else-if="activeOrder" :to="buildOrderDetailLink(activeOrder.id)">直接回当前订单</RouterLink>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Export" title="导出与售后清单" description="左侧看售后订单，右侧只看当前选中订单的退款和投诉摘要。">
      <div class="petpal-toolbar">
        <ListExportButton :request="() => api.petpal.orders.exportRefundDetails()" label="导出全部退款明细" pending-label="导出中" />
      </div>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection class="petpal-span-5" eyebrow="Orders" title="售后订单" description="这里只展示进入退款或投诉链路的订单。">
        <PetPalDeskEmpty
          v-if="!aftersalesOrders.length"
          title="当前没有售后订单"
          description="如果后续发生退款或投诉，订单会出现在这里。"
        />

        <div v-else class="petpal-sheet-list">
          <button
            v-for="order in aftersalesOrders"
            :key="order.id"
            type="button"
            class="petpal-aftersales-row"
            :class="{ 'is-active': order.id === selectedOrderId, 'is-focused': order.id === highlightedOrderId }"
            @click="selectedOrderId = order.id"
          >
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ getPetPalServiceTypeLabel(order.serviceType) }}</p>
              <p class="petpal-sheet-row__desc">已退 {{ formatPetPalMoney(order.amountRefunded) }} / 总额 {{ formatPetPalMoney(Number(order.amountTotal) + Number(order.amountAdjusted)) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="complaintsByOrder[order.id]?.length ? 'is-danger' : 'is-warning'">
                投诉 {{ complaintsByOrder[order.id]?.length || 0 }}
              </span>
            </div>
          </button>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-7" eyebrow="Current" title="当前订单售后摘要" description="确认信息后再进入具体结果页或订单详情。">
        <PetPalDeskEmpty
          v-if="!activeOrder"
          title="先选择左侧订单"
          description="选中订单后，这里会展示退款进度、投诉数和导出入口。"
        />

        <template v-else>
          <div class="petpal-summary-strip">
            <div>
              <span>订单状态</span>
              <strong>{{ getPetPalOrderStatusLabel(activeOrder.orderStatus) }}</strong>
            </div>
            <div>
              <span>退款阶段</span>
              <strong>{{ refundProgress ? getPetPalRefundProgressStageLabel(refundProgress.stage) : '暂无' }}</strong>
            </div>
            <div>
              <span>投诉数量</span>
              <strong>{{ complaints.length }}</strong>
            </div>
          </div>

          <div class="petpal-side-stack">
            <div class="petpal-kv-grid">
              <div class="petpal-kv">
                <span>最近退款</span>
                <strong>{{ refundProgress?.latestRefundNo || '暂无' }}</strong>
              </div>
              <div class="petpal-kv">
                <span>已结算退款</span>
                <strong>{{ refundProgress ? formatPetPalMoney(refundProgress.settledRefundAmount) : '¥0.00' }}</strong>
              </div>
            </div>

            <div class="petpal-sheet-list">
              <div v-for="item in complaints" :key="item.id" class="petpal-sheet-row">
                <div class="petpal-sheet-row__copy">
                  <h3 class="petpal-sheet-row__title">{{ getPetPalComplaintTypeLabel(item.complaintType) }}</h3>
                  <p class="petpal-sheet-row__desc">{{ getPetPalComplaintStatusLabel(item.status) }} · {{ getPetPalComplaintTargetRoleLabel(item.targetRole) }}</p>
                  <p class="petpal-sheet-row__desc">{{ item.resultSummary || item.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="petpal-actions">
            <ListExportButton :request="() => api.petpal.orders.exportRefunds(activeOrder.id)" label="导出当前订单退款" pending-label="导出中" />
            <RouterLink :to="{ name: 'frontend-petpal-refund-result', params: { id: activeOrder.id } }">查看退款结果页</RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-complaint-result', params: { id: activeOrder.id } }">查看投诉结果页</RouterLink>
            <RouterLink :to="buildOrderDetailLink(activeOrder.id)">回订单详情</RouterLink>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { ComplaintRecord, OrderRecord, OrderRefundProgressRecord } from '@rbac/api-common';
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalDeskHandoffQuery,
  getPetPalQueryString,
  mergePetPalPageNotice,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import {
  formatPetPalMoney,
  getPetPalComplaintStatusLabel,
  getPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel,
  getPetPalOrderStatusLabel,
  getPetPalRefundProgressStageLabel,
  getPetPalServiceTypeLabel,
  isPetPalAftersalesStatus,
  petPalOwnerWorkspaceNav,
} from './shared';

const route = useRoute();
const orders = ref<OrderRecord[]>([]);
const complaintsByOrder = ref<Record<string, ComplaintRecord[]>>({});
const refundProgressByOrder = ref<Record<string, OrderRefundProgressRecord | null>>({});
const selectedOrderId = ref('');
const loadState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'aftersales'>('');
const summaryFailureCount = ref(0);

const aftersalesOrders = computed(() => orders.value.filter((item) => (
  isPetPalAftersalesStatus(item.orderStatus)
  || (complaintsByOrder.value[item.id]?.length || 0) > 0
  || refundProgressByOrder.value[item.id]?.stage && refundProgressByOrder.value[item.id]?.stage !== 'NONE'
)));
const activeOrder = computed(() => aftersalesOrders.value.find((item) => item.id === selectedOrderId.value) ?? aftersalesOrders.value[0] ?? null);
const complaints = computed(() => activeOrder.value ? complaintsByOrder.value[activeOrder.value.id] || [] : []);
const refundProgress = computed(() => activeOrder.value ? refundProgressByOrder.value[activeOrder.value.id] || null : null);
const highlightedOrderId = computed(() => getPetPalQueryString(route.query, 'focusOrderId'));

const heroStats = computed(() => [
  { label: '售后订单', value: String(aftersalesOrders.value.length), hint: '退款或投诉中的订单' },
  { label: '投诉总数', value: String(Object.values(complaintsByOrder.value).reduce((sum, items) => sum + items.length, 0)), hint: '按订单聚合查看' },
  { label: '退款处理中', value: String(Object.values(refundProgressByOrder.value).filter((item) => item && item.stage !== 'NONE' && item.stage !== 'FULL_SUCCESS').length), hint: '持续关注渠道回执' },
  { label: '导出入口', value: '已独立', hint: '当前页可导出全部或单订单退款' },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    loadState.value === 'error' ? '售后中心刷新失败，可直接重试当前页' : '',
    summaryFailureCount.value ? `${summaryFailureCount.value} 笔订单的退款或投诉摘要未完全刷新` : '',
  ]);
  if (!description) {
    return null;
  }
  const hasWarning = loadState.value === 'error' || summaryFailureCount.value > 0;
  return {
    title: hasWarning ? '售后摘要还有部分内容待刷新' : '已回到售后中心',
    description,
    tone: hasWarning ? 'warning' as const : 'accent' as const,
  };
});

function buildOrderDetailLink(orderId: string) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这笔订单仍在售后链路中，可直接回售后摘要继续跟进。',
      focusOrderId: orderId,
      tab: 'aftersales',
    }),
  };
}

function applyRouteContext() {
  if (highlightedOrderId.value && aftersalesOrders.value.some((item) => item.id === highlightedOrderId.value)) {
    selectedOrderId.value = highlightedOrderId.value;
    return;
  }
  if (!aftersalesOrders.value.some((item) => item.id === selectedOrderId.value)) {
    selectedOrderId.value = aftersalesOrders.value[0]?.id || '';
  }
}

async function loadPage() {
  try {
    loadState.value = 'idle';
    summaryFailureCount.value = 0;
    orders.value = await api.petpal.orders.list();
    const complaintEntries = await Promise.all(orders.value.map(async (order) => {
      const [complaintsResult, refundResult] = await Promise.allSettled([
        api.petpal.orders.complaints(order.id),
        api.petpal.orders.refundProgress(order.id),
      ]);
      return {
        orderId: order.id,
        complaints: complaintsResult.status === 'fulfilled' ? complaintsResult.value : [],
        refund: refundResult.status === 'fulfilled' ? refundResult.value : null,
        failed: complaintsResult.status === 'rejected' || refundResult.status === 'rejected',
      };
    }));

    complaintsByOrder.value = Object.fromEntries(complaintEntries.map((item) => [item.orderId, item.complaints]));
    refundProgressByOrder.value = Object.fromEntries(complaintEntries.map((item) => [item.orderId, item.refund]));
    summaryFailureCount.value = complaintEntries.filter((item) => item.failed).length;
    loadState.value = 'ready';
    applyRouteContext();
  } catch (error: unknown) {
    loadState.value = 'error';
    ElMessage.error(getErrorMessage(error, '加载售后中心失败'));
  }
}

async function retryAftersales() {
  await runPetPalSectionRetry({
    key: 'aftersales',
    sectionReloadingKey,
    reload: loadPage,
    getState: () => loadState.value,
    successMessage: '售后摘要已刷新',
    swallowError: true,
  });
}

watch(
  () => route.query.focusOrderId,
  () => {
    applyRouteContext();
  },
  { immediate: true },
);

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-aftersales-row {
  width: 100%;
  display: flex;
  gap: 14px;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border: 0;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.petpal-aftersales-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-aftersales-row.is-active {
  color: #2563eb;
}

.petpal-aftersales-row.is-focused {
  margin-inline: -10px;
  padding-inline: 16px;
  background: rgba(244, 248, 255, 0.9);
}
</style>
