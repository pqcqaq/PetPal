<template>
  <PetPalDeskPage
    eyebrow="订单队列"
    title="订单只在这里按状态整理，不再回总览里翻找"
    summary="待支付、履约中、已完成和售后中的订单都统一在这里切换查看。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-orders"
    :primary-action="{ label: '回主人总览', to: { name: 'frontend-petpal' }, tone: 'secondary' }"
    :actions="[{ label: '售后中心', to: { name: 'frontend-petpal-aftersales' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Filter" title="按状态筛选订单" description="支付、履约和售后已拆开，但都能从订单详情继续进入。">
      <div class="petpal-toolbar">
        <el-radio-group v-model="filter" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="needs_payment">待支付</el-radio-button>
          <el-radio-button label="active">进行中</el-radio-button>
          <el-radio-button label="aftersales">售后</el-radio-button>
          <el-radio-button label="done">已完成</el-radio-button>
        </el-radio-group>

        <ListExportButton :request="() => api.petpal.orders.exportTransactions()" label="导出交易记录" pending-label="导出中" />
      </div>

      <PetPalDeskEmpty
        v-if="!filteredOrders.length"
        title="当前筛选下没有订单"
        description="切换筛选，或先回需求队列创建新的订单。"
      />

      <div v-else class="petpal-sheet-list">
        <div v-for="order in filteredOrders" :key="order.id" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
            <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ getPetPalServiceTypeLabel(order.serviceType) }}</p>
            <p class="petpal-sheet-row__desc">{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
            <div class="petpal-pill-row">
              <span class="petpal-pill">总额 {{ formatPetPalMoney(Number(order.amountTotal) + Number(order.amountAdjusted)) }}</span>
              <span class="petpal-pill">已付 {{ formatPetPalMoney(order.amountPaid) }}</span>
              <span class="petpal-pill" :class="unreadCount(order) ? 'is-danger' : ''">未读 {{ unreadCount(order) }}</span>
            </div>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: order.id } }">查看详情</RouterLink>
            <RouterLink
              v-if="isPetPalOutstandingOrder(order)"
              :to="{ name: 'frontend-petpal-payment-result', params: { id: order.id } }"
            >
              继续支付
            </RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { OrderRecord } from '@rbac/api-common';
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
  formatPetPalRange,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  isPetPalAftersalesStatus,
  isPetPalOutstandingOrder,
  petPalOwnerWorkspaceNav,
} from './shared';

const orders = ref<OrderRecord[]>([]);
const filter = ref<'all' | 'needs_payment' | 'active' | 'aftersales' | 'done'>('all');

const filteredOrders = computed(() => orders.value.filter((item) => {
  if (filter.value === 'needs_payment') {
    return isPetPalOutstandingOrder(item);
  }
  if (filter.value === 'active') {
    return ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus);
  }
  if (filter.value === 'aftersales') {
    return isPetPalAftersalesStatus(item.orderStatus);
  }
  if (filter.value === 'done') {
    return item.orderStatus === 'COMPLETED';
  }
  return true;
}));

const heroStats = computed(() => [
  { label: '订单总数', value: String(orders.value.length), hint: '主人全部交易记录' },
  { label: '待支付', value: String(orders.value.filter((item) => isPetPalOutstandingOrder(item)).length), hint: '优先处理金额未结清订单' },
  { label: '进行中', value: String(orders.value.filter((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)).length), hint: '需要持续跟进履约' },
  { label: '售后中', value: String(orders.value.filter((item) => isPetPalAftersalesStatus(item.orderStatus)).length), hint: '退款投诉去售后中心' },
]);

const unreadCount = (order: OrderRecord) => getPetPalConversationUnreadCount(order.conversation, 'owner');

async function loadPage() {
  try {
    orders.value = await api.petpal.orders.list();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载订单队列失败'));
  }
}

onMounted(() => {
  void loadPage();
});
</script>
