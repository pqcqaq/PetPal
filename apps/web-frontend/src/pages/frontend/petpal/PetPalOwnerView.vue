<template>
  <PetPalDeskPage
    eyebrow="主人工作台"
    title="先处理当前最值得继续的主人任务"
    summary="总览页只负责分流，不再混入表单、匹配、支付和售后细节。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal"
    :primary-action="primaryAction"
    :actions="heroActions"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Priority" title="当前下一步" description="优先动作会根据宠物、需求、订单和售后状态自动切换。">
      <PetPalDeskEmpty
        v-if="!auth.isAuthenticated"
        title="登录后进入主人任务流"
        description="主人端的宠物、需求、订单、消息和售后都已经拆开，登录后会按状态继续。"
      >
        <template #actions>
          <RouterLink class="frontend-page__button is-primary" to="/login">去登录</RouterLink>
        </template>
      </PetPalDeskEmpty>

      <div v-else class="petpal-sheet-list">
        <div class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ focusTask.title }}</h3>
            <p class="petpal-sheet-row__desc">{{ focusTask.description }}</p>
            <div class="petpal-pill-row">
              <span class="petpal-pill is-accent">宠物 {{ pets.length }}</span>
              <span class="petpal-pill">活跃需求 {{ activeRequests.length }}</span>
              <span class="petpal-pill">进行中订单 {{ activeOrders.length }}</span>
              <span class="petpal-pill" :class="aftersalesOrders.length ? 'is-danger' : ''">售后 {{ aftersalesOrders.length }}</span>
            </div>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="focusTask.to">{{ focusTask.actionLabel }}</RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection class="petpal-span-4" eyebrow="Pets" title="宠物档案" description="建档和更新都去独立表单页完成。">
        <div v-if="pets.length" class="petpal-sheet-list">
          <div v-for="pet in pets.slice(0, 3)" :key="pet.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ pet.name }}</h3>
              <p class="petpal-sheet-row__desc">{{ pet.species }} · {{ pet.breed || '品种待补充' }}</p>
              <p class="petpal-sheet-row__desc">{{ pet.feedingNote || '喂养说明待补充' }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink :to="{ name: 'frontend-petpal-pet-edit', params: { id: pet.id } }">编辑</RouterLink>
              <RouterLink :to="{ name: 'frontend-petpal-request-create', query: { petId: pet.id } }">用它发需求</RouterLink>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="还没有宠物档案"
          description="先补齐第一只宠物的信息，后面的需求和订单都以它为起点。"
        >
          <template #actions>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-pet-create' }">新建宠物档案</RouterLink>
          </template>
        </PetPalDeskEmpty>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Requests" title="需求队列" description="需求列表只看状态和匹配，建单动作被抽到队列页右侧。">
        <div v-if="requests.length" class="petpal-sheet-list">
          <div v-for="request in requests.slice(0, 3)" :key="request.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ getPetPalServiceTypeLabel(request.serviceType) }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalServiceRequestStatusLabel(request.status) }} · {{ formatPetPalRange(request.startTime, request.endTime) }}</p>
              <p class="petpal-sheet-row__desc">{{ request.locationText }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink :to="{ name: 'frontend-petpal-requests' }">继续处理</RouterLink>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="当前没有活跃需求"
          description="需求发布已经单独拆到表单页，队列页只保留匹配和下单。"
        >
          <template #actions>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-request-create' }">新建需求</RouterLink>
          </template>
        </PetPalDeskEmpty>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Orders" title="订单队列" description="待支付、履约中、售后中的订单都从队列页继续。">
        <div v-if="orders.length" class="petpal-sheet-list">
          <div v-for="order in orders.slice(0, 3)" :key="order.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ getPetPalServiceTypeLabel(order.serviceType) }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(Number(order.amountTotal) + Number(order.amountAdjusted)) }} / 已付 {{ formatPetPalMoney(order.amountPaid) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: order.id } }">查看订单</RouterLink>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="当前没有订单"
          description="当需求成功匹配后，新的订单会直接进入订单队列。"
        />
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalOrderStatusLabel,
  getPetPalServiceRequestStatusLabel,
  getPetPalServiceTypeLabel,
  isPetPalAftersalesStatus,
  isPetPalOutstandingOrder,
  petPalOwnerWorkspaceNav,
} from './shared';

const auth = useAuthStore();

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const orders = ref<OrderRecord[]>([]);

const activeRequests = computed(() => requests.value.filter((item) => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status)));
const activeOrders = computed(() => orders.value.filter((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)));
const aftersalesOrders = computed(() => orders.value.filter((item) => isPetPalAftersalesStatus(item.orderStatus)));
const outstandingOrders = computed(() => orders.value.filter((item) => isPetPalOutstandingOrder(item)));

const heroStats = computed(() => [
  { label: '宠物档案', value: String(pets.value.length), hint: pets.value.length ? '资料可复用' : '先建第一只' },
  { label: '活跃需求', value: String(activeRequests.value.length), hint: activeRequests.value.length ? '继续匹配' : '可直接新建' },
  { label: '进行中订单', value: String(activeOrders.value.length), hint: activeOrders.value.length ? '查看履约进度' : '暂无进行中订单' },
  { label: '售后事项', value: String(aftersalesOrders.value.length), hint: aftersalesOrders.value.length ? '售后中心有待处理事项' : '当前无售后积压' },
]);

const primaryAction = computed(() => {
  if (!auth.isAuthenticated) {
    return { label: '去登录', to: '/login', tone: 'primary' as const };
  }
  if (!pets.value.length) {
    return { label: '先建宠物档案', to: { name: 'frontend-petpal-pet-create' }, tone: 'primary' as const };
  }
  return { label: '新建照料需求', to: { name: 'frontend-petpal-request-create' }, tone: 'primary' as const };
});

const heroActions = computed(() => [
  { label: '消息中心', to: { name: 'frontend-petpal-messages' }, tone: 'secondary' as const },
  { label: '售后中心', to: { name: 'frontend-petpal-aftersales' }, tone: 'secondary' as const },
]);

const focusTask = computed(() => {
  if (!pets.value.length) {
    return {
      title: '先建立第一只宠物档案',
      description: '宠物建档完成后，需求表单和后续订单都能直接复用资料，避免重复输入。',
      actionLabel: '去建档',
      to: { name: 'frontend-petpal-pet-create' },
    };
  }
  if (outstandingOrders.value.length) {
    return {
      title: '先处理待支付订单',
      description: `当前还有 ${outstandingOrders.value.length} 笔订单金额未结清，建议优先进入订单队列完成支付。`,
      actionLabel: '去订单队列',
      to: { name: 'frontend-petpal-orders' },
    };
  }
  if (activeRequests.value.length) {
    return {
      title: '继续查看活跃需求',
      description: `当前有 ${activeRequests.value.length} 条需求还在匹配或待确认，下一步通常是查看匹配结果并下单。`,
      actionLabel: '去需求队列',
      to: { name: 'frontend-petpal-requests' },
    };
  }
  if (aftersalesOrders.value.length) {
    return {
      title: '售后事项需要优先处理',
      description: `当前有 ${aftersalesOrders.value.length} 笔订单处在退款或投诉链路中，建议直接进入售后中心。`,
      actionLabel: '去售后中心',
      to: { name: 'frontend-petpal-aftersales' },
    };
  }
  return {
    title: '开始新的照料需求',
    description: '宠物档案已经可用，可以直接发布新的服务时间、地点和预算需求。',
    actionLabel: '新建需求',
    to: { name: 'frontend-petpal-request-create' },
  };
});

async function loadPage() {
  if (!auth.isAuthenticated) {
    pets.value = [];
    requests.value = [];
    orders.value = [];
    return;
  }

  try {
    const [petsResult, requestsResult, ordersResult] = await Promise.all([
      api.petpal.pets.list(),
      api.petpal.requests.list(),
      api.petpal.orders.list(),
    ]);
    pets.value = petsResult;
    requests.value = requestsResult;
    orders.value = ordersResult;
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载主人工作台失败'));
  }
}

onMounted(() => {
  void loadPage();
});
</script>
