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
            :class="{ 'is-active': order.id === selectedOrderId }"
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
            <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: activeOrder.id } }">回订单详情</RouterLink>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { ComplaintRecord, OrderRecord, OrderRefundProgressRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
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

const orders = ref<OrderRecord[]>([]);
const complaintsByOrder = ref<Record<string, ComplaintRecord[]>>({});
const refundProgressByOrder = ref<Record<string, OrderRefundProgressRecord | null>>({});
const selectedOrderId = ref('');

const aftersalesOrders = computed(() => orders.value.filter((item) => (
  isPetPalAftersalesStatus(item.orderStatus)
  || (complaintsByOrder.value[item.id]?.length || 0) > 0
  || refundProgressByOrder.value[item.id]?.stage && refundProgressByOrder.value[item.id]?.stage !== 'NONE'
)));
const activeOrder = computed(() => aftersalesOrders.value.find((item) => item.id === selectedOrderId.value) ?? aftersalesOrders.value[0] ?? null);
const complaints = computed(() => activeOrder.value ? complaintsByOrder.value[activeOrder.value.id] || [] : []);
const refundProgress = computed(() => activeOrder.value ? refundProgressByOrder.value[activeOrder.value.id] || null : null);

const heroStats = computed(() => [
  { label: '售后订单', value: String(aftersalesOrders.value.length), hint: '退款或投诉中的订单' },
  { label: '投诉总数', value: String(Object.values(complaintsByOrder.value).reduce((sum, items) => sum + items.length, 0)), hint: '按订单聚合查看' },
  { label: '退款处理中', value: String(Object.values(refundProgressByOrder.value).filter((item) => item && item.stage !== 'NONE' && item.stage !== 'FULL_SUCCESS').length), hint: '持续关注渠道回执' },
  { label: '导出入口', value: '已独立', hint: '当前页可导出全部或单订单退款' },
]);

async function loadPage() {
  try {
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
      };
    }));

    complaintsByOrder.value = Object.fromEntries(complaintEntries.map((item) => [item.orderId, item.complaints]));
    refundProgressByOrder.value = Object.fromEntries(complaintEntries.map((item) => [item.orderId, item.refund]));

    if (!selectedOrderId.value && aftersalesOrders.value.length) {
      selectedOrderId.value = aftersalesOrders.value[0].id;
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载售后中心失败'));
  }
}

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
</style>
