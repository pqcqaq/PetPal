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
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="petsState === 'error'"
            :loading="sectionReloadingKey === 'pets'"
            @click="retryPets"
          >
            重试宠物区
          </el-button>
          <el-button
            v-if="requestsState === 'error'"
            :loading="sectionReloadingKey === 'requests'"
            @click="retryRequests"
          >
            重试需求区
          </el-button>
          <el-button
            v-if="ordersState === 'error'"
            :loading="sectionReloadingKey === 'orders'"
            @click="retryOrders"
          >
            重试订单区
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

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
        <PetPalDeskEmpty
          v-if="petsState === 'error'"
          title="宠物档案暂未刷新完成"
          description="可以先重试宠物区，恢复后再继续建档或发需求。"
        />

        <div v-else-if="pets.length" class="petpal-sheet-list">
          <div v-for="pet in pets.slice(0, 3)" :key="pet.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ pet.name }}</h3>
              <p class="petpal-sheet-row__desc">{{ pet.species }} · {{ pet.breed || '品种待补充' }}</p>
              <p class="petpal-sheet-row__desc">{{ pet.feedingNote || '喂养说明待补充' }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink :to="buildOwnerPetEditRoute(pet.id)">编辑</RouterLink>
              <RouterLink
                :to="buildOwnerRequestCreateRoute(pet.id, '这里已经带着这只宠物进入需求表单，可直接继续填写服务时间和预算。')"
              >
                用它发需求
              </RouterLink>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="还没有宠物档案"
          description="先补齐第一只宠物的信息，后面的需求和订单都以它为起点。"
        >
          <template #actions>
            <RouterLink
              class="frontend-page__button is-primary"
              :to="buildOwnerPetCreateRoute('这里已经定位到新建宠物档案，可先补齐第一只宠物后再回来继续主人任务。')"
            >
              新建宠物档案
            </RouterLink>
          </template>
        </PetPalDeskEmpty>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Requests" title="需求队列" description="需求列表只看状态和匹配，建单动作被抽到队列页右侧。">
        <PetPalDeskEmpty
          v-if="requestsState === 'error'"
          title="需求队列暂未刷新完成"
          description="可以先重试需求区，恢复后再继续查看匹配结果。"
        />

        <div v-else-if="requests.length" class="petpal-sheet-list">
          <div v-for="request in requests.slice(0, 3)" :key="request.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ getPetPalServiceTypeLabel(request.serviceType) }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalServiceRequestStatusLabel(request.status) }} · {{ formatPetPalRange(request.startTime, request.endTime) }}</p>
              <p class="petpal-sheet-row__desc">{{ request.locationText }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink
                :to="{
                  name: 'frontend-petpal-requests',
                  query: buildPetPalDeskHandoffQuery({
                    notice: '这里已经定位到这条需求，可直接继续查看匹配和下单。',
                    focusRequestId: request.id,
                  }),
                }"
              >
                继续处理
              </RouterLink>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="当前没有活跃需求"
          description="需求发布已经单独拆到表单页，队列页只保留匹配和下单。"
        >
          <template #actions>
            <RouterLink
              class="frontend-page__button is-primary"
              :to="buildOwnerRequestCreateRoute(
                pets[0]?.id || '',
                '这里已经定位到新建需求页，可直接继续填写时间、地点和预算。',
              )"
            >
              新建需求
            </RouterLink>
          </template>
        </PetPalDeskEmpty>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Orders" title="订单队列" description="待支付、履约中、售后中的订单都从队列页继续。">
        <PetPalDeskEmpty
          v-if="ordersState === 'error'"
          title="订单队列暂未刷新完成"
          description="可以先重试订单区，恢复后再继续跟单或处理售后。"
        />

        <div v-else-if="orders.length" class="petpal-sheet-list">
          <div v-for="order in orders.slice(0, 3)" :key="order.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ getPetPalServiceTypeLabel(order.serviceType) }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(Number(order.amountTotal) + Number(order.amountAdjusted)) }} / 已付 {{ formatPetPalMoney(order.amountPaid) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink
                :to="{
                  name: 'frontend-petpal-order-detail',
                  params: { id: order.id },
                  query: buildPetPalDeskHandoffQuery({
                    notice: '当前已从主人工作台带着这笔订单进入详情，可直接继续处理。',
                    focusOrderId: order.id,
                    tab: 'summary',
                  }),
                }"
              >
                查看订单
              </RouterLink>
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
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
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
  formatPetPalRange,
  getPetPalOrderStatusLabel,
  getPetPalServiceRequestStatusLabel,
  getPetPalServiceTypeLabel,
  isPetPalAftersalesStatus,
  isPetPalOutstandingOrder,
  petPalOwnerWorkspaceNav,
} from './shared';

const auth = useAuthStore();
const route = useRoute();

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const orders = ref<OrderRecord[]>([]);
const petsState = ref<PetPalSectionLoadState>('idle');
const requestsState = ref<PetPalSectionLoadState>('idle');
const ordersState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'pets' | 'requests' | 'orders'>('');

const activeRequests = computed(() => requests.value.filter((item) => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status)));
const activeOrders = computed(() => orders.value.filter((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)));
const aftersalesOrders = computed(() => orders.value.filter((item) => isPetPalAftersalesStatus(item.orderStatus)));
const outstandingOrders = computed(() => orders.value.filter((item) => isPetPalOutstandingOrder(item)));
const unreadOrder = computed(() => orders.value.find((item) => (item.conversation?.ownerUnreadCount || 0) > 0) ?? null);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    petsState.value === 'error' ? '宠物区暂未刷新完成，可只重试宠物区' : '',
    requestsState.value === 'error' ? '需求区暂未刷新完成，可只重试需求区' : '',
    ordersState.value === 'error' ? '订单区暂未刷新完成，可只重试订单区' : '',
  ]);
  if (!description) {
    return null;
  }
  const hasError = petsState.value === 'error' || requestsState.value === 'error' || ordersState.value === 'error';
  return {
    title: hasError ? '主人工作台还有部分分区未刷新完成' : '已回到主人工作台',
    description,
    tone: hasError ? 'warning' as const : 'accent' as const,
  };
});

function buildOwnerPetCreateRoute(notice: string) {
  return {
    name: 'frontend-petpal-pet-create',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOwnerPetEditRoute(petId: string) {
  return {
    name: 'frontend-petpal-pet-edit',
    params: { id: petId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这里已经定位到这只宠物档案，可直接继续补齐资料。',
      focusPetId: petId,
    }),
  };
}

function buildOwnerRequestCreateRoute(petId: string, notice: string) {
  return {
    name: 'frontend-petpal-request-create',
    query: {
      ...(petId ? { petId } : {}),
      ...buildPetPalDeskHandoffQuery({
        notice,
        ...(petId ? { focusPetId: petId } : {}),
      }),
    },
  };
}

function buildMessagesRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-messages',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
      focusRole: 'owner',
    }),
  };
}

function buildAftersalesRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-aftersales',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
    }),
  };
}

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
    return {
      label: '先建宠物档案',
      to: buildOwnerPetCreateRoute('这里已经定位到新建宠物档案，可先补齐第一只宠物后再回来继续主人任务。'),
      tone: 'primary' as const,
    };
  }
  return {
    label: '新建照料需求',
    to: buildOwnerRequestCreateRoute(
      pets.value[0]?.id || '',
      '这里已经定位到新建需求页，可直接继续填写时间、地点和预算。',
    ),
    tone: 'primary' as const,
  };
});

const heroActions = computed(() => [
  {
    label: '消息中心',
    to: unreadOrder.value
      ? buildMessagesRoute('这里已经定位到最近一笔有未读沟通的订单，可直接继续回复。', unreadOrder.value.id)
      : buildMessagesRoute('这里已经回到主人消息中心，可继续查看跨订单沟通。'),
    tone: 'secondary' as const,
  },
  {
    label: '售后中心',
    to: aftersalesOrders.value[0]
      ? buildAftersalesRoute('这里已经定位到当前最急的一笔售后订单，可直接继续跟进。', aftersalesOrders.value[0].id)
      : buildAftersalesRoute('这里已经回到售后中心，可继续查看退款和投诉摘要。'),
    tone: 'secondary' as const,
  },
]);

const focusTask = computed(() => {
  if (!pets.value.length) {
    return {
      title: '先建立第一只宠物档案',
      description: '宠物建档完成后，需求表单和后续订单都能直接复用资料，避免重复输入。',
      actionLabel: '去建档',
      to: buildOwnerPetCreateRoute('这里已经定位到新建宠物档案，可先补齐第一只宠物后再回来继续主人任务。'),
    };
  }
  if (outstandingOrders.value.length) {
    return {
      title: '先处理待支付订单',
      description: `当前还有 ${outstandingOrders.value.length} 笔订单金额未结清，建议优先进入订单队列完成支付。`,
      actionLabel: '去订单队列',
      to: {
        name: 'frontend-petpal-orders',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一笔待支付订单，可直接继续付款。',
          focusOrderId: outstandingOrders.value[0].id,
          focusFilter: 'needs_payment',
        }),
      },
    };
  }
  if (activeRequests.value.length) {
    return {
      title: '继续查看活跃需求',
      description: `当前有 ${activeRequests.value.length} 条需求还在匹配或待确认，下一步通常是查看匹配结果并下单。`,
      actionLabel: '去需求队列',
      to: {
        name: 'frontend-petpal-requests',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一条活跃需求，可直接继续看匹配和下单。',
          focusRequestId: activeRequests.value[0].id,
        }),
      },
    };
  }
  if (aftersalesOrders.value.length) {
    return {
      title: '售后事项需要优先处理',
      description: `当前有 ${aftersalesOrders.value.length} 笔订单处在退款或投诉链路中，建议直接进入售后中心。`,
      actionLabel: '去售后中心',
      to: buildAftersalesRoute('这里已经定位到当前最急的一笔售后订单，可直接继续跟进。', aftersalesOrders.value[0].id),
    };
  }
  return {
    title: '开始新的照料需求',
    description: '宠物档案已经可用，可以直接发布新的服务时间、地点和预算需求。',
    actionLabel: '新建需求',
    to: buildOwnerRequestCreateRoute(
      pets.value[0]?.id || '',
      '这里已经定位到新建需求页，可直接继续填写时间、地点和预算。',
    ),
  };
});

async function loadPage() {
  if (!auth.isAuthenticated) {
    pets.value = [];
    requests.value = [];
    orders.value = [];
    petsState.value = 'ready';
    requestsState.value = 'ready';
    ordersState.value = 'ready';
    return;
  }

  petsState.value = 'idle';
  requestsState.value = 'idle';
  ordersState.value = 'idle';
  const [petsResult, requestsResult, ordersResult] = await Promise.allSettled([
    api.petpal.pets.list(),
    api.petpal.requests.list(),
    api.petpal.orders.list(),
  ]);
  pets.value = petsResult.status === 'fulfilled' ? petsResult.value : [];
  requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : [];
  orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
  petsState.value = petsResult.status === 'fulfilled' ? 'ready' : 'error';
  requestsState.value = requestsResult.status === 'fulfilled' ? 'ready' : 'error';
  ordersState.value = ordersResult.status === 'fulfilled' ? 'ready' : 'error';

  if (petsResult.status === 'rejected' && requestsResult.status === 'rejected' && ordersResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(petsResult.reason, '加载主人工作台失败'));
  }
}

async function retryPets() {
  await runPetPalSectionRetry({
    key: 'pets',
    sectionReloadingKey,
    reload: async () => {
      petsState.value = 'idle';
      try {
        pets.value = await api.petpal.pets.list();
        petsState.value = 'ready';
      } catch (error) {
        petsState.value = 'error';
        throw error;
      }
    },
    getState: () => petsState.value,
    successMessage: '宠物区已刷新',
    swallowError: true,
  });
}

async function retryRequests() {
  await runPetPalSectionRetry({
    key: 'requests',
    sectionReloadingKey,
    reload: async () => {
      requestsState.value = 'idle';
      try {
        requests.value = await api.petpal.requests.list();
        requestsState.value = 'ready';
      } catch (error) {
        requestsState.value = 'error';
        throw error;
      }
    },
    getState: () => requestsState.value,
    successMessage: '需求区已刷新',
    swallowError: true,
  });
}

async function retryOrders() {
  await runPetPalSectionRetry({
    key: 'orders',
    sectionReloadingKey,
    reload: async () => {
      ordersState.value = 'idle';
      try {
        orders.value = await api.petpal.orders.list();
        ordersState.value = 'ready';
      } catch (error) {
        ordersState.value = 'error';
        throw error;
      }
    },
    getState: () => ordersState.value,
    successMessage: '订单区已刷新',
    swallowError: true,
  });
}

onMounted(() => {
  void loadPage();
});
</script>
