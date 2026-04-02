<!--
UX Blueprint
User: 主人需要按交易状态处理订单
Entry: 主人总览、消息/提醒/售后回流
First screen: 状态筛选、订单数量、直接进入某一笔订单详情
Primary action: 进入订单详情继续支付、沟通、确认完成或售后
Secondary actions: 切换筛选、查看售后队列
States: 未登录、加载失败、空态、列表可用
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="主人工作区"
      title="订单队列"
      summary="订单页只负责按状态筛选和进入详情，支付、沟通、履约和售后继续在订单详情或结果页处理。"
      :nav-items="petPalOwnerWorkspaceNav"
      active-name="frontend-petpal-orders"
      :stats="heroStats"
      :primary-action="{ label: '去需求队列', to: { name: 'frontend-petpal-requests' } }"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="订单队列"
          title="订单队列加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-card">
        <span class="frontend-card__eyebrow">订单筛选</span>
        <div class="petpal-toolbar">
          <el-radio-group v-model="filter" size="small">
            <el-radio-button label="ALL">全部</el-radio-button>
            <el-radio-button label="OUTSTANDING">待支付</el-radio-button>
            <el-radio-button label="ACTIVE">进行中</el-radio-button>
            <el-radio-button label="AFTERSALES">售后</el-radio-button>
            <el-radio-button label="COMPLETED">已完成</el-radio-button>
          </el-radio-group>
          <RouterLink :to="{ name: 'frontend-petpal-aftersales' }">去售后中心</RouterLink>
        </div>

        <div v-if="filteredOrders.length" class="petpal-order-list">
          <article v-for="order in filteredOrders" :key="order.id" class="petpal-order-card">
            <div class="petpal-order-card__head">
              <div>
                <h3>{{ order.orderNo }}</h3>
                <p>{{ getPetPalServiceTypeLabel(order.serviceType) }} · {{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
              </div>
              <el-tag size="small" :type="getOrderTagType(order)">{{ getPetPalOrderStatusLabel(order.orderStatus) }}</el-tag>
            </div>

            <div class="petpal-order-card__metrics">
              <div>
                <span>总额</span>
                <strong>¥{{ formatPetPalAmount(Number(order.amountTotal) + Number(order.amountAdjusted)) }}</strong>
              </div>
              <div>
                <span>已支付</span>
                <strong>¥{{ formatPetPalAmount(order.amountPaid) }}</strong>
              </div>
              <div>
                <span>已退款</span>
                <strong>¥{{ formatPetPalAmount(order.amountRefunded) }}</strong>
              </div>
            </div>

            <p class="petpal-order-card__hint">{{ buildOrderHint(order) }}</p>

            <div class="petpal-card-actions">
              <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-order-detail', params: { id: order.id } }">
                {{ buildPrimaryLabel(order) }}
              </RouterLink>
              <RouterLink
                v-if="isOrderOutstanding(order)"
                class="frontend-page__button is-secondary"
                :to="{ name: 'frontend-petpal-payment-result', params: { id: order.id } }"
              >
                支付状态
              </RouterLink>
            </div>
          </article>
        </div>

        <PetPalStatePanel
          v-else
          eyebrow="订单队列"
          title="当前筛选下没有订单"
          description="订单动作已收回详情页和结果页，这里只保留状态筛选和进入入口。"
        />
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="订单队列"
        title="登录后查看订单队列"
        description="登录后按待支付、进行中、售后和已完成筛选订单。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { OrderRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElButton } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  formatPetPalAmount,
  formatPetPalRange,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  petPalOwnerWorkspaceNav,
} from './shared';

type OrderFilter = 'ALL' | 'OUTSTANDING' | 'ACTIVE' | 'AFTERSALES' | 'COMPLETED';

const auth = useAuthStore();

const loading = ref(false);
const filter = ref<OrderFilter>('ALL');
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');
const orders = ref<OrderRecord[]>([]);

const outstandingCount = computed(() => orders.value.filter(isOrderOutstanding).length);
const activeCount = computed(() => orders.value.filter((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)).length);
const aftersalesCount = computed(() => orders.value.filter((item) => ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(item.orderStatus)).length);
const filteredOrders = computed(() => orders.value.filter((item) => {
  if (filter.value === 'OUTSTANDING') {
    return isOrderOutstanding(item);
  }
  if (filter.value === 'ACTIVE') {
    return ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus);
  }
  if (filter.value === 'AFTERSALES') {
    return ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(item.orderStatus);
  }
  if (filter.value === 'COMPLETED') {
    return item.orderStatus === 'COMPLETED';
  }
  return true;
}));

const heroStats = computed(() => [
  {
    label: '订单总数',
    value: String(orders.value.length),
    hint: '列表页只做筛选和进入',
  },
  {
    label: '待支付',
    value: String(outstandingCount.value),
    hint: outstandingCount.value ? '优先进入详情继续支付' : '当前没有待支付订单',
  },
  {
    label: '进行中',
    value: String(activeCount.value),
    hint: activeCount.value ? '继续沟通或看履约' : '当前没有进行中订单',
  },
  {
    label: '售后',
    value: String(aftersalesCount.value),
    hint: aftersalesCount.value ? '售后中心也可直接处理' : '当前没有售后积压',
  },
]);

const heroActions = computed(() => [
  { label: '返回总览', to: { name: 'frontend-petpal' }, tone: 'secondary' as const },
  { label: '消息中心', to: { name: 'frontend-petpal-messages' }, tone: 'secondary' as const },
]);

function isOrderOutstanding(order: Pick<OrderRecord, 'amountTotal' | 'amountAdjusted' | 'amountPaid'>) {
  const total = Number(order.amountTotal) + Number(order.amountAdjusted);
  return total - Number(order.amountPaid) > 0.01;
}

function getOrderTagType(order: OrderRecord) {
  if (['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)) {
    return 'danger';
  }
  if (isOrderOutstanding(order) || ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(order.orderStatus)) {
    return 'warning';
  }
  return 'success';
}

function buildPrimaryLabel(order: OrderRecord) {
  if (isOrderOutstanding(order)) {
    return '继续支付';
  }
  if (['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(order.orderStatus)) {
    return '继续跟单';
  }
  if (['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)) {
    return '继续售后';
  }
  return '查看订单';
}

function buildOrderHint(order: OrderRecord) {
  if (isOrderOutstanding(order)) {
    return '这笔订单还有未结清金额，进入详情后优先处理支付结果和后续动作。';
  }
  if (order.orderStatus === 'SERVING') {
    return '这笔订单正在服务中，建议先看履约记录和最新沟通。';
  }
  if (['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)) {
    return '这笔订单已进入售后链路，优先看退款和投诉进度。';
  }
  return '这笔订单可以回看时间、金额、评价和支付记录。';
}

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    orders.value = await api.petpal.orders.list();
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    orders.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载订单队列失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-toolbar,
.petpal-order-card__head,
.petpal-card-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-order-list,
.petpal-order-card {
  display: grid;
  gap: 14px;
}

.petpal-order-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-order-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.petpal-order-card__metrics div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.petpal-order-card__metrics span {
  color: #6d8683;
  font-size: 12px;
}

.petpal-order-card__hint {
  margin: 0;
}

@media (max-width: 720px) {
  .petpal-order-card__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
