<!--
UX Blueprint
User: 已登录主人，需要先判断现在该继续哪条交易任务
Entry: Web 前台主人入口、消息/提醒/售后回流
First screen: 当前优先任务、宠物/需求/订单状态摘要、直接进入对应列表页
Primary action: 去宠物建档、去需求队列或去订单队列
Secondary actions: 去消息、售后、照料者工作台
States: 未登录、加载失败、空态、可继续办事
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="主人工作区"
      title="主人任务总览"
      summary="总览页只回答现在该做什么。建档、发需求、跟单和售后都拆去各自页面，不再把表单和队列堆在这里。"
      :nav-items="petPalOwnerWorkspaceNav"
      active-name="frontend-petpal"
      :stats="heroStats"
      :primary-action="heroPrimaryAction"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="主人工作区"
          title="主人总览加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
            <RouterLink :to="{ name: 'frontend-petpal-orders' }">
              <el-button size="small">先看订单队列</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>

      <template v-else>
        <section class="frontend-page__section-grid">
          <article class="frontend-card petpal-grid-span-6">
            <span class="frontend-card__eyebrow">现在先做这个</span>
            <div class="petpal-focus-card">
              <div class="petpal-focus-card__copy">
                <h3>{{ primaryTask.title }}</h3>
                <p>{{ primaryTask.hint }}</p>
              </div>
              <RouterLink class="frontend-page__button is-primary" :to="primaryTask.to">
                {{ primaryTask.actionLabel }}
              </RouterLink>
            </div>
          </article>

          <article class="frontend-card petpal-grid-span-6">
            <span class="frontend-card__eyebrow">交易状态</span>
            <div class="petpal-queue-list">
              <div class="petpal-queue-item">
                <div>
                  <strong>待支付 / 待确认</strong>
                  <p>{{ paymentAndCompletionHint }}</p>
                </div>
                <RouterLink :to="{ name: 'frontend-petpal-orders' }">去订单队列</RouterLink>
              </div>
              <div class="petpal-queue-item">
                <div>
                  <strong>售后事项</strong>
                  <p>{{ aftersalesHint }}</p>
                </div>
                <RouterLink :to="{ name: 'frontend-petpal-aftersales' }">去售后中心</RouterLink>
              </div>
              <div class="petpal-queue-item">
                <div>
                  <strong>消息与提醒</strong>
                  <p>跨订单沟通和待办已拆成独立页面，避免再回大工作台里翻找。</p>
                </div>
                <div class="petpal-inline-actions">
                  <RouterLink :to="{ name: 'frontend-petpal-messages' }">消息</RouterLink>
                  <RouterLink :to="{ name: 'frontend-petpal-reminders' }">提醒</RouterLink>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section class="frontend-page__section-grid">
          <article class="frontend-card petpal-grid-span-4">
            <span class="frontend-card__eyebrow">宠物档案</span>
            <div class="petpal-section-head">
              <h3>先确定可用宠物</h3>
              <RouterLink :to="{ name: 'frontend-petpal-pets' }">查看全部</RouterLink>
            </div>

            <div v-if="pets.length" class="petpal-card-stack">
              <div v-for="pet in pets.slice(0, 3)" :key="pet.id" class="petpal-compact-card">
                <div class="petpal-compact-card__head">
                  <strong>{{ pet.name }}</strong>
                  <span>{{ pet.species }}</span>
                </div>
                <p>{{ pet.breed || '品种待补充' }}</p>
                <div class="petpal-inline-actions">
                  <RouterLink :to="{ name: 'frontend-petpal-pet-edit', params: { id: pet.id } }">编辑</RouterLink>
                  <RouterLink :to="{ name: 'frontend-petpal-request-create', query: { petId: pet.id } }">用它发需求</RouterLink>
                </div>
              </div>
            </div>
            <PetPalStatePanel
              v-else
              eyebrow="宠物档案"
              title="还没有宠物档案"
              description="先建第一只宠物，再去需求页提交时间、地点和预算。"
            >
              <template #actions>
                <RouterLink :to="{ name: 'frontend-petpal-pet-create' }">
                  <el-button size="small" type="primary">去建档</el-button>
                </RouterLink>
              </template>
            </PetPalStatePanel>
          </article>

          <article class="frontend-card petpal-grid-span-4">
            <span class="frontend-card__eyebrow">需求队列</span>
            <div class="petpal-section-head">
              <h3>看活跃需求</h3>
              <RouterLink :to="{ name: 'frontend-petpal-requests' }">查看全部</RouterLink>
            </div>

            <div v-if="requests.length" class="petpal-card-stack">
              <div v-for="request in requests.slice(0, 3)" :key="request.id" class="petpal-compact-card">
                <div class="petpal-compact-card__head">
                  <strong>{{ getPetPalServiceTypeLabel(request.serviceType) }}</strong>
                  <span>{{ getPetPalServiceRequestStatusLabel(request.status) }}</span>
                </div>
                <p>{{ formatPetPalRange(request.startTime, request.endTime) }}</p>
                <p>{{ request.locationText }}</p>
                <div class="petpal-inline-actions">
                  <RouterLink :to="{ name: 'frontend-petpal-requests' }">继续处理</RouterLink>
                  <RouterLink v-if="request.matchedCaregiverId" :to="{ name: 'frontend-petpal-orders' }">去结算</RouterLink>
                </div>
              </div>
            </div>
            <PetPalStatePanel
              v-else
              eyebrow="需求队列"
              title="当前没有活跃需求"
              description="需求发布已经独立成表单页，创建后再回队列里看匹配和下单。"
            >
              <template #actions>
                <RouterLink :to="{ name: 'frontend-petpal-request-create' }">
                  <el-button size="small" type="primary">新建需求</el-button>
                </RouterLink>
              </template>
            </PetPalStatePanel>
          </article>

          <article class="frontend-card petpal-grid-span-4">
            <span class="frontend-card__eyebrow">订单队列</span>
            <div class="petpal-section-head">
              <h3>看当前交易</h3>
              <RouterLink :to="{ name: 'frontend-petpal-orders' }">查看全部</RouterLink>
            </div>

            <div v-if="orders.length" class="petpal-card-stack">
              <div v-for="order in recentOrders" :key="order.id" class="petpal-compact-card">
                <div class="petpal-compact-card__head">
                  <strong>{{ order.orderNo }}</strong>
                  <span>{{ getPetPalOrderStatusLabel(order.orderStatus) }}</span>
                </div>
                <p>{{ getPetPalServiceTypeLabel(order.serviceType) }} · {{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
                <p>总额 ¥{{ formatPetPalAmount(Number(order.amountTotal) + Number(order.amountAdjusted)) }}</p>
                <div class="petpal-inline-actions">
                  <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: order.id } }">查看详情</RouterLink>
                  <RouterLink
                    v-if="isOrderOutstanding(order)"
                    :to="{ name: 'frontend-petpal-payment-result', params: { id: order.id } }"
                  >
                    看支付状态
                  </RouterLink>
                </div>
              </div>
            </div>
            <PetPalStatePanel
              v-else
              eyebrow="订单队列"
              title="当前没有订单"
              description="新的订单、支付和售后都从各自队列页继续处理，不再压在总览页里。"
            />
          </article>
        </section>
      </template>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="主人工作区"
        title="登录后继续主人任务"
        description="登录后从总览页直接进入宠物、需求、订单和售后的独立页面。"
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
import type { OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElButton } from 'element-plus';
import { RouterLink } from 'vue-router';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  formatPetPalAmount,
  formatPetPalRange,
  getPetPalOrderStatusLabel,
  getPetPalServiceRequestStatusLabel,
  getPetPalServiceTypeLabel,
  petPalOwnerWorkspaceNav,
} from './shared';

const auth = useAuthStore();

const loading = ref(false);
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const orders = ref<OrderRecord[]>([]);

const activeRequests = computed(() => requests.value.filter((item) => ['OPEN', 'MATCHED', 'MATCHING'].includes(item.status)));
const activeOrders = computed(() => orders.value.filter((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)));
const aftersalesOrders = computed(() => orders.value.filter((item) => ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(item.orderStatus)));
const outstandingOrders = computed(() => orders.value.filter(isOrderOutstanding));
const recentOrders = computed(() => [...orders.value].slice(0, 3));

const heroStats = computed(() => [
  {
    label: '宠物档案',
    value: String(pets.value.length),
    hint: pets.value.length ? '可直接带入需求' : '先建第一只宠物',
  },
  {
    label: '活跃需求',
    value: String(activeRequests.value.length),
    hint: activeRequests.value.length ? '去队列里继续匹配' : '当前可新建需求',
  },
  {
    label: '进行中订单',
    value: String(activeOrders.value.length),
    hint: activeOrders.value.length ? '优先看订单状态' : '当前没有履约中订单',
  },
  {
    label: '售后事项',
    value: String(aftersalesOrders.value.length),
    hint: aftersalesOrders.value.length ? '售后中心有待处理事项' : '当前没有售后积压',
  },
]);

const heroPrimaryAction = computed(() => {
  if (!pets.value.length) {
    return {
      label: '先建宠物档案',
      to: { name: 'frontend-petpal-pet-create' },
    };
  }
  return {
    label: '新建需求',
    to: { name: 'frontend-petpal-request-create' },
  };
});

const heroActions = computed(() => [
  { label: '宠物档案', to: { name: 'frontend-petpal-pets' }, tone: 'secondary' as const },
  { label: '订单队列', to: { name: 'frontend-petpal-orders' }, tone: 'secondary' as const },
  { label: '照料者工作区', to: { name: 'frontend-petpal-caregiver' }, tone: 'secondary' as const },
]);

const primaryTask = computed(() => {
  if (!pets.value.length) {
    return {
      title: '先建立第一只宠物档案',
      hint: '没有宠物档案时，需求表单和后续下单都无法稳定复用资料。',
      actionLabel: '去建档',
      to: { name: 'frontend-petpal-pet-create' },
    };
  }

  if (outstandingOrders.value.length) {
    return {
      title: '先回订单队列处理待支付',
      hint: `当前还有 ${outstandingOrders.value.length} 笔订单未完成支付或金额未结清。`,
      actionLabel: '去订单队列',
      to: { name: 'frontend-petpal-orders' },
    };
  }

  if (activeRequests.value.length) {
    return {
      title: '继续活跃需求',
      hint: `当前有 ${activeRequests.value.length} 条需求在匹配或待确认，建议直接看需求队列。`,
      actionLabel: '去需求队列',
      to: { name: 'frontend-petpal-requests' },
    };
  }

  if (aftersalesOrders.value.length) {
    return {
      title: '优先处理售后事项',
      hint: `当前有 ${aftersalesOrders.value.length} 笔订单处在退款或投诉链路中。`,
      actionLabel: '去售后中心',
      to: { name: 'frontend-petpal-aftersales' },
    };
  }

  return {
    title: '继续创建新的照料需求',
    hint: '宠物档案已经就绪，可以直接进入需求表单开始下一次下单。',
    actionLabel: '去新建需求',
    to: { name: 'frontend-petpal-request-create' },
  };
});

const paymentAndCompletionHint = computed(() => {
  if (outstandingOrders.value.length) {
    return `${outstandingOrders.value.length} 笔订单还有待支付金额，建议优先处理。`;
  }
  const awaitingCompletion = orders.value.filter((item) => item.orderStatus === 'COMPLETED').length;
  return awaitingCompletion ? `${awaitingCompletion} 笔订单已完成，可继续评价或回看。` : '当前没有待支付或待确认的交易。';
});

const aftersalesHint = computed(() => aftersalesOrders.value.length
  ? `${aftersalesOrders.value.length} 笔订单在售后链路中，退款和投诉已拆去独立队列页。`
  : '当前没有需要优先处理的退款或投诉事项。');

function isOrderOutstanding(order: Pick<OrderRecord, 'amountTotal' | 'amountAdjusted' | 'amountPaid'>) {
  const total = Number(order.amountTotal) + Number(order.amountAdjusted);
  const paid = Number(order.amountPaid);
  return total - paid > 0.01;
}

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    const [petsResult, requestsResult, ordersResult] = await Promise.all([
      api.petpal.pets.list(),
      api.petpal.requests.list(),
      api.petpal.orders.list(),
    ]);

    pets.value = petsResult;
    requests.value = requestsResult;
    orders.value = ordersResult;
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    pets.value = [];
    requests.value = [];
    orders.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载主人总览失败');
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
.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-grid-span-6 {
  grid-column: span 6;
}

.petpal-focus-card,
.petpal-focus-card__copy,
.petpal-card-stack,
.petpal-compact-card,
.petpal-compact-card__head,
.petpal-queue-list,
.petpal-queue-item,
.petpal-section-head,
.petpal-inline-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-focus-card__copy,
.petpal-card-stack,
.petpal-compact-card,
.petpal-queue-list {
  display: grid;
}

.petpal-section-head {
  margin-bottom: 4px;
}

.petpal-section-head a,
.petpal-inline-actions a,
.petpal-queue-item a {
  color: #0f766e;
  font-weight: 700;
  text-decoration: none;
}

.petpal-queue-list,
.petpal-card-stack {
  gap: 14px;
}

.petpal-queue-item,
.petpal-compact-card {
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-compact-card__head span {
  color: #6d8683;
  font-size: 12px;
}

@media (max-width: 1080px) {
  .petpal-grid-span-4,
  .petpal-grid-span-6 {
    grid-column: span 12;
  }
}
</style>
