<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Legacy</p>
      <h1>宠托帮兼容入口</h1>
      <p>旧的混合工作台不再承载新功能，这里只保留旧书签兼容与任务分发，真实操作请直接进入主人页、照料者页、消息中心和售后中心。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="loading" @click="reloadAll">刷新兼容概览</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          主人服务台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          照料者工作台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-messages' }">
          消息中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-aftersales' }">
          售后中心
        </RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-3" v-loading="loading">
        <span class="frontend-card__eyebrow">主人资产</span>
        <strong class="petpal-summary-value">{{ pets.length }}</strong>
        <p class="petpal-summary-copy">{{ pets.length ? '已建档宠物可直接复用到需求和订单。' : '先回到主人服务台建立第一只宠物档案。' }}</p>
      </article>
      <article class="frontend-card petpal-grid-span-3" v-loading="loading">
        <span class="frontend-card__eyebrow">当前需求</span>
        <strong class="petpal-summary-value">{{ requests.length }}</strong>
        <p class="petpal-summary-copy">{{ requests.length ? '已有需求待匹配或待跟进。' : '当前没有进行中的主人需求。' }}</p>
      </article>
      <article class="frontend-card petpal-grid-span-3" v-loading="loading">
        <span class="frontend-card__eyebrow">主人待处理</span>
        <strong class="petpal-summary-value">{{ ownerPriorityOrders.length }}</strong>
        <p class="petpal-summary-copy">优先处理主人侧未读沟通、服务中订单和售后风险。</p>
      </article>
      <article class="frontend-card petpal-grid-span-3" v-loading="loading">
        <span class="frontend-card__eyebrow">照料者待处理</span>
        <strong class="petpal-summary-value">{{ caregiverPriorityOrders.length }}</strong>
        <p class="petpal-summary-copy">优先处理待接单、服务中和照料者侧未读沟通。</p>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">主人主流程</span>
        <h3>宠物 / 需求 / 订单</h3>
        <p class="petpal-route-copy">宠物建档、需求发布、匹配照料者、交易导出、退款导出和确认完成都已经迁回主人页。</p>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          打开主人服务台
        </RouterLink>
      </article>
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">照料者主流程</span>
        <h3>入驻 / 服务 / 履约</h3>
        <p class="petpal-route-copy">照料者档案、资质材料、服务配置、接单、签到、服务记录和签退都已经迁回照料者页。</p>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          打开照料者工作台
        </RouterLink>
      </article>
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">跨订单沟通</span>
        <h3>未读筛选 / 快捷跳转</h3>
        <p class="petpal-route-copy">跨订单消息聚合、角色视角切换和标记已读已经迁到独立消息中心，不再混在老工作台里。</p>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-messages' }">
          打开消息中心
        </RouterLink>
      </article>
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">售后处理</span>
        <h3>退款 / 投诉 / 轨迹回看</h3>
        <p class="petpal-route-copy">主人侧退款进度、投诉处理和售后优先级已经迁到独立售后中心，不必再逐个订单翻找。</p>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-aftersales' }">
          打开售后中心
        </RouterLink>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-6" v-loading="loading">
        <span class="frontend-card__eyebrow">主人优先处理</span>
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>主人侧订单</h3>
            <p>先处理主人侧未读消息、服务中订单和售后相关风险。</p>
          </div>
          <el-tag type="info">未读 {{ ownerUnreadCount }}</el-tag>
        </div>

        <div v-if="ownerPriorityOrders.length" class="petpal-priority-list">
          <div v-for="item in ownerPriorityOrders" :key="item.id" class="petpal-priority-item">
            <div class="petpal-priority-copy">
              <strong>{{ item.orderNo }}</strong>
              <span>{{ getOrderStatusLabel(item.orderStatus) }} · {{ formatTime(item.updatedAt) }}</span>
              <span>
                {{ getConversationUnreadCount(item.conversation, 'owner')
                  ? `主人侧 ${getConversationUnreadCount(item.conversation, 'owner')} 条未读`
                  : '可进入订单详情继续跟进沟通、履约或售后。'
                }}
              </span>
            </div>
            <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: item.id } }">
              <el-button link type="primary">打开订单</el-button>
            </RouterLink>
          </div>
        </div>

        <p v-else class="petpal-empty-state">
          当前没有需要优先处理的主人侧订单，可直接去主人服务台继续建档、发需求或跟进正常订单。
        </p>
      </article>

      <article class="frontend-card petpal-grid-span-6" v-loading="loading">
        <span class="frontend-card__eyebrow">照料者优先处理</span>
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <h3>照料者侧订单</h3>
            <p>先处理待接单、服务中和照料者侧未读沟通。</p>
          </div>
          <el-tag type="success">未读 {{ caregiverUnreadCount }}</el-tag>
        </div>

        <div v-if="caregiverPriorityOrders.length" class="petpal-priority-list">
          <div v-for="item in caregiverPriorityOrders" :key="item.id" class="petpal-priority-item">
            <div class="petpal-priority-copy">
              <strong>{{ item.orderNo }}</strong>
              <span>{{ item.ownerNickname || '主人未命名' }} · {{ item.petName || '宠物未命名' }}</span>
              <span>
                {{ getOrderStatusLabel(item.orderStatus) }} ·
                {{ getConversationUnreadCount(item.conversation, 'caregiver')
                  ? `照料者侧 ${getConversationUnreadCount(item.conversation, 'caregiver')} 条未读`
                  : formatTime(item.updatedAt)
                }}
              </span>
            </div>
            <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: item.id } }">
              <el-button link type="primary">打开订单</el-button>
            </RouterLink>
          </div>
        </div>

        <p v-else class="petpal-empty-state">
          当前没有需要优先处理的照料者侧订单；如果尚未开启照料者能力，可直接忽略这部分并进入主人服务台。
        </p>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">兼容策略</span>
      <h3>旧入口只保留跳转与概览</h3>
      <p class="petpal-compat-note">
        后续新的 PetPal Web 功能不再继续加回这个页面。`/petpal/legacy` 只承担旧链接兼容、概览汇总和任务分发职责，避免重新长成混合超级页面。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import type {
  CaregiverOrderRecord,
  OrderRecord,
  OrderStatus,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
} from './shared';

defineOptions({
  name: 'PetPalLegacyWorkbenchView',
});

const auth = useAuthStore();

const hasStatusCode = (error: unknown): error is { status: number } => (
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number'
);

const isRoleUnavailableError = (error: unknown) => (
  hasStatusCode(error)
  && [401, 403, 404].includes(error.status)
);

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const ownerOrders = ref<OrderRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const loading = ref(false);

const formatTime = (value: string) => new Date(value).toLocaleString();

const getOrderStatusLabel = getPetPalOrderStatusLabel;
const getConversationUnreadCount = getPetPalConversationUnreadCount;

const orderPriorityWeight = (status: OrderStatus, unread: number) => {
  const statusWeight = ({
    DISPUTED: 60,
    SERVING: 50,
    PENDING_ACCEPT: 40,
    ACCEPTED: 35,
    PARTIAL_REFUNDED: 30,
    REFUNDED: 20,
    COMPLETED: 10,
    CANCELLED: 0,
  } satisfies Partial<Record<OrderStatus, number>>)[status] ?? 0;

  return (unread * 100) + statusWeight;
};

const ownerPriorityOrders = computed(() => [...ownerOrders.value]
  .filter(item => (
    getConversationUnreadCount(item.conversation, 'owner') > 0
    || ['SERVING', 'DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED', 'ACCEPTED'].includes(item.orderStatus)
  ))
  .sort((left, right) => {
    const weightDiff = orderPriorityWeight(right.orderStatus, getConversationUnreadCount(right.conversation, 'owner'))
      - orderPriorityWeight(left.orderStatus, getConversationUnreadCount(left.conversation, 'owner'));
    if (weightDiff !== 0) {
      return weightDiff;
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })
  .slice(0, 5));

const caregiverPriorityOrders = computed(() => [...caregiverOrders.value]
  .filter(item => (
    getConversationUnreadCount(item.conversation, 'caregiver') > 0
    || ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING', 'DISPUTED'].includes(item.orderStatus)
  ))
  .sort((left, right) => {
    const weightDiff = orderPriorityWeight(right.orderStatus, getConversationUnreadCount(right.conversation, 'caregiver'))
      - orderPriorityWeight(left.orderStatus, getConversationUnreadCount(left.conversation, 'caregiver'));
    if (weightDiff !== 0) {
      return weightDiff;
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  })
  .slice(0, 5));

const ownerUnreadCount = computed(() => ownerOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0));

const caregiverUnreadCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0));

const loadPets = async () => {
  pets.value = await api.petpal.pets.list();
};

const loadRequests = async () => {
  requests.value = await api.petpal.requests.list();
};

const loadOwnerOrders = async () => {
  ownerOrders.value = await api.petpal.orders.list();
};

const loadCaregiverOrders = async () => {
  const page = await api.petpal.caregiver.orders({
    page: 1,
    pageSize: 50,
  });
  caregiverOrders.value = page.items;
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    ElMessage.info('登录后可查看兼容概览');
    return;
  }

  loading.value = true;
  const results = await Promise.allSettled([
    loadPets(),
    loadRequests(),
    loadOwnerOrders(),
    loadCaregiverOrders(),
  ]);
  loading.value = false;

  if (results[0].status === 'rejected') {
    pets.value = [];
    ElMessage.error(getErrorMessage(results[0].reason, '加载宠物概览失败'));
  }

  if (results[1].status === 'rejected') {
    requests.value = [];
    ElMessage.error(getErrorMessage(results[1].reason, '加载需求概览失败'));
  }

  if (results[2].status === 'rejected') {
    ownerOrders.value = [];
    if (!isRoleUnavailableError(results[2].reason)) {
      ElMessage.error(getErrorMessage(results[2].reason, '加载主人订单概览失败'));
    }
  }

  if (results[3].status === 'rejected') {
    caregiverOrders.value = [];
    if (!isRoleUnavailableError(results[3].reason)) {
      ElMessage.error(getErrorMessage(results[3].reason, '加载照料者订单概览失败'));
    }
  }
};

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void reloadAll();
});
</script>

<style scoped lang="scss">
.petpal-grid-span-3 {
  grid-column: span 3;
}

.petpal-grid-span-6 {
  grid-column: span 6;
}

.petpal-summary-value {
  display: block;
  font-size: 32px;
  line-height: 1.05;
  color: #17384a;
}

.petpal-summary-copy,
.petpal-route-copy,
.petpal-compat-note {
  margin: 8px 0 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.petpal-section-heading__meta {
  display: grid;
  gap: 8px;
}

.petpal-section-heading h3,
.petpal-route-card h3 {
  margin: 0;
}

.petpal-section-heading__meta p {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-priority-list {
  display: grid;
  gap: 12px;
}

.petpal-priority-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.petpal-priority-copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.petpal-priority-copy strong,
.petpal-priority-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.petpal-priority-copy span {
  color: var(--frontend-color-muted);
  line-height: 1.6;
  white-space: nowrap;
}

.petpal-empty-state {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .petpal-grid-span-3,
  .petpal-grid-span-6 {
    grid-column: span 6;
  }
}

@media (max-width: 720px) {
  .petpal-grid-span-3,
  .petpal-grid-span-6 {
    grid-column: span 12;
  }

  .petpal-section-heading,
  .petpal-priority-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .petpal-priority-copy span {
    white-space: normal;
  }
}
</style>
