<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Messages</p>
      <h1>宠托帮跨订单消息中心</h1>
      <p>把主人和照料者两侧的订单沟通从详情页里抽出来，按角色和未读状态集中处理，减少来回翻订单的成本。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="loading || Boolean(markingReadKey)" @click="reloadAll">刷新消息概览</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          返回主人服务台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          返回照料者工作台
        </RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">主人未读</span>
        <strong class="petpal-summary-value">{{ ownerUnreadCount }}</strong>
        <p class="petpal-summary-copy">优先处理主人视角下待确认的订单沟通。</p>
      </article>
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">照料者未读</span>
        <strong class="petpal-summary-value">{{ caregiverUnreadCount }}</strong>
        <p class="petpal-summary-copy">快速查看接单前确认和履约中的补充消息。</p>
      </article>
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">有沟通订单</span>
        <strong class="petpal-summary-value">{{ totalConversationCount }}</strong>
        <p class="petpal-summary-copy">跨订单聚合会话，不必逐张订单切换查找。</p>
      </article>
      <article class="frontend-card petpal-grid-span-3">
        <span class="frontend-card__eyebrow">筛选范围</span>
        <strong class="petpal-summary-value">{{ activeScopeLabel }}</strong>
        <p class="petpal-summary-copy">支持按角色、未读和订单关键词快速收窄范围。</p>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">筛选消息</span>
      <div class="petpal-filter-toolbar">
        <el-radio-group v-model="messageScope" size="small">
          <el-radio-button label="ALL">全部</el-radio-button>
          <el-radio-button label="OWNER">主人视角</el-radio-button>
          <el-radio-button label="CAREGIVER">照料者视角</el-radio-button>
        </el-radio-group>
        <el-checkbox v-model="unreadOnly">仅看未读</el-checkbox>
        <el-input
          v-model="keyword"
          clearable
          size="small"
          maxlength="64"
          placeholder="按订单号或主人昵称筛选"
          style="width: min(100%, 240px)"
        />
      </div>
    </section>

    <section v-if="shouldShowOwnerSection" class="frontend-card">
      <span class="frontend-card__eyebrow">主人消息</span>
      <div class="petpal-section-heading">
        <div class="petpal-section-heading__meta">
          <h3>主人侧订单沟通</h3>
          <p>聚合主人视角下的订单会话，适合先处理未读和最近更新的沟通。</p>
        </div>
        <el-tag type="info">共 {{ filteredOwnerOrders.length }} 条</el-tag>
      </div>

      <el-table :data="filteredOwnerOrders" size="small" v-loading="loading">
        <el-table-column prop="orderNo" label="订单号" min-width="180" />
        <el-table-column prop="serviceType" label="服务" min-width="100" />
        <el-table-column prop="orderStatus" label="状态" min-width="120">
          <template #default="scope">
            {{ getOrderStatusLabel(scope.row.orderStatus) }}
          </template>
        </el-table-column>
        <el-table-column label="最近沟通" min-width="320">
          <template #default="scope">
            <div class="petpal-conversation-cell">
              <div class="petpal-conversation-cell__copy">
                <p class="petpal-conversation-cell__preview">
                  {{ formatConversationPreview(scope.row.conversation) }}
                </p>
                <p class="petpal-conversation-cell__meta">
                  {{ formatConversationMeta(scope.row.conversation, 'owner') }}
                </p>
              </div>
              <el-tag
                v-if="getConversationUnreadCount(scope.row.conversation, 'owner') > 0"
                type="danger"
                size="small"
              >
                待读 {{ getConversationUnreadCount(scope.row.conversation, 'owner') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="appointmentStart" label="预约开始" min-width="170">
          <template #default="scope">
            {{ formatTime(scope.row.appointmentStart) }}
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="190" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button
                v-if="getConversationUnreadCount(scope.row.conversation, 'owner') > 0"
                link
                type="warning"
                size="small"
                :loading="markingReadKey === `owner:${scope.row.id}`"
                @click="markConversationRead(scope.row.id, 'owner')"
              >
                标记已读
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                <el-button link type="primary" size="small">打开订单</el-button>
              </RouterLink>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <p v-if="!loading && filteredOwnerOrders.length === 0" class="petpal-empty-state">
        当前筛选下没有主人侧会话，可先回到主人服务台或订单详情发起沟通。
      </p>
    </section>

    <section v-if="shouldShowCaregiverSection" class="frontend-card">
      <span class="frontend-card__eyebrow">照料者消息</span>
      <div class="petpal-section-heading">
        <div class="petpal-section-heading__meta">
          <h3>照料者侧订单沟通</h3>
          <p>聚合照料者视角下的订单会话，适合集中确认接单前沟通和履约补充信息。</p>
        </div>
        <el-tag type="success">共 {{ filteredCaregiverOrders.length }} 条</el-tag>
      </div>

      <el-table :data="filteredCaregiverOrders" size="small" v-loading="loading">
        <el-table-column prop="orderNo" label="订单号" min-width="160" />
        <el-table-column prop="ownerNickname" label="主人" min-width="120" />
        <el-table-column prop="petName" label="宠物" min-width="120" />
        <el-table-column prop="orderStatus" label="状态" min-width="120">
          <template #default="scope">
            {{ getOrderStatusLabel(scope.row.orderStatus) }}
          </template>
        </el-table-column>
        <el-table-column label="最近沟通" min-width="320">
          <template #default="scope">
            <div class="petpal-conversation-cell">
              <div class="petpal-conversation-cell__copy">
                <p class="petpal-conversation-cell__preview">
                  {{ formatConversationPreview(scope.row.conversation) }}
                </p>
                <p class="petpal-conversation-cell__meta">
                  {{ formatConversationMeta(scope.row.conversation, 'caregiver') }}
                </p>
              </div>
              <el-tag
                v-if="getConversationUnreadCount(scope.row.conversation, 'caregiver') > 0"
                type="danger"
                size="small"
              >
                待读 {{ getConversationUnreadCount(scope.row.conversation, 'caregiver') }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="appointmentStart" label="预约开始" min-width="170">
          <template #default="scope">
            {{ formatTime(scope.row.appointmentStart) }}
          </template>
        </el-table-column>
        <el-table-column label="动作" min-width="190" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button
                v-if="getConversationUnreadCount(scope.row.conversation, 'caregiver') > 0"
                link
                type="warning"
                size="small"
                :loading="markingReadKey === `caregiver:${scope.row.id}`"
                @click="markConversationRead(scope.row.id, 'caregiver')"
              >
                标记已读
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: scope.row.id } }">
                <el-button link type="primary" size="small">打开订单</el-button>
              </RouterLink>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <p v-if="!loading && filteredCaregiverOrders.length === 0" class="petpal-empty-state">
        当前筛选下没有照料者侧会话，可先回到照料者工作台或订单详情发起沟通。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import type {
  CaregiverOrderRecord,
  OrderConversationRecord,
  OrderRecord,
} from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  formatPetPalConversationMeta,
  formatPetPalConversationPreview,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
} from './shared';

defineOptions({
  name: 'PetPalMessagesView',
});

type MessageScope = 'ALL' | 'OWNER' | 'CAREGIVER';

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

const ownerOrders = ref<OrderRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const loading = ref(false);
const markingReadKey = ref('');
const messageScope = ref<MessageScope>('ALL');
const unreadOnly = ref(false);
const keyword = ref('');

const formatTime = (value: string) => new Date(value).toLocaleString();

const sortOrdersByConversation = <T extends OrderRecord>(items: T[], role: 'owner' | 'caregiver') => [...items]
  .sort((left, right) => {
    const unreadDiff = getPetPalConversationUnreadCount(right.conversation, role)
      - getPetPalConversationUnreadCount(left.conversation, role);
    if (unreadDiff !== 0) {
      return unreadDiff;
    }

    const rightTime = right.conversation?.lastMessageAt ?? right.updatedAt;
    const leftTime = left.conversation?.lastMessageAt ?? left.updatedAt;
    return new Date(rightTime).getTime() - new Date(leftTime).getTime();
  });

const matchesKeyword = (input: string, values: Array<string | null | undefined>) => {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return values.some((item) => item?.toLowerCase().includes(normalized));
};

const filteredOwnerOrders = computed(() => sortOrdersByConversation(ownerOrders.value.filter((item) => {
  if (unreadOnly.value && getPetPalConversationUnreadCount(item.conversation, 'owner') === 0) {
    return false;
  }

  return matchesKeyword(keyword.value, [item.orderNo, item.serviceType, getPetPalOrderStatusLabel(item.orderStatus)]);
}), 'owner'));

const filteredCaregiverOrders = computed(() => sortOrdersByConversation(caregiverOrders.value.filter((item) => {
  if (unreadOnly.value && getPetPalConversationUnreadCount(item.conversation, 'caregiver') === 0) {
    return false;
  }

  return matchesKeyword(keyword.value, [
    item.orderNo,
    item.ownerNickname,
    item.petName,
    item.serviceType,
    getPetPalOrderStatusLabel(item.orderStatus),
  ]);
}), 'caregiver'));

const ownerUnreadCount = computed(() => ownerOrders.value.reduce((total, item) => (
  total + getPetPalConversationUnreadCount(item.conversation, 'owner')
), 0));

const caregiverUnreadCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getPetPalConversationUnreadCount(item.conversation, 'caregiver')
), 0));

const totalConversationCount = computed(() => (
  ownerOrders.value.filter(item => item.conversation).length
  + caregiverOrders.value.filter(item => item.conversation).length
));

const shouldShowOwnerSection = computed(() => messageScope.value === 'ALL' || messageScope.value === 'OWNER');
const shouldShowCaregiverSection = computed(() => messageScope.value === 'ALL' || messageScope.value === 'CAREGIVER');

const activeScopeLabel = computed(() => ({
  ALL: '全部会话',
  OWNER: '主人视角',
  CAREGIVER: '照料者视角',
}[messageScope.value]));

const getOrderStatusLabel = getPetPalOrderStatusLabel;
const getConversationUnreadCount = getPetPalConversationUnreadCount;
const formatConversationPreview = formatPetPalConversationPreview;
const formatConversationMeta = (
  conversation: OrderConversationRecord | null | undefined,
  role: 'owner' | 'caregiver',
) => formatPetPalConversationMeta(conversation, role, formatTime);

const applyConversationSummaryToOrders = (
  target: 'owner' | 'caregiver',
  orderId: string,
  summary: OrderConversationRecord,
) => {
  const source = target === 'owner' ? ownerOrders.value : caregiverOrders.value;
  const next = source.map(item => (item.id === orderId ? { ...item, conversation: { ...summary } } : item));
  if (target === 'owner') {
    ownerOrders.value = next;
    return;
  }
  caregiverOrders.value = next as CaregiverOrderRecord[];
};

const loadOwnerOrders = async () => {
  ownerOrders.value = await api.petpal.orders.list();
};

const loadCaregiverOrders = async () => {
  const page = await api.petpal.caregiver.orders({
    page: 1,
    pageSize: 100,
  });
  caregiverOrders.value = page.items;
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    ElMessage.info('登录后可查看跨订单消息中心');
    return;
  }

  loading.value = true;
  const results = await Promise.allSettled([
    loadOwnerOrders(),
    loadCaregiverOrders(),
  ]);
  loading.value = false;

  if (results[0].status === 'rejected') {
    ownerOrders.value = [];
    if (!isRoleUnavailableError(results[0].reason)) {
      ElMessage.error(getErrorMessage(results[0].reason, '加载主人消息概览失败'));
    }
  }

  if (results[1].status === 'rejected') {
    caregiverOrders.value = [];
    if (!isRoleUnavailableError(results[1].reason)) {
      ElMessage.error(getErrorMessage(results[1].reason, '加载照料者消息概览失败'));
    }
  }
};

const markConversationRead = async (orderId: string, target: 'owner' | 'caregiver') => {
  try {
    markingReadKey.value = `${target}:${orderId}`;
    const summary = await api.petpal.orders.markMessagesRead(orderId);
    applyConversationSummaryToOrders(target, orderId, summary);
    ElMessage.success('已标记为已读');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '标记已读失败'));
  } finally {
    markingReadKey.value = '';
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

.petpal-summary-value {
  display: block;
  font-size: 32px;
  line-height: 1.05;
  color: #17384a;
}

.petpal-summary-copy {
  margin: 8px 0 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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

.petpal-section-heading h3 {
  margin: 0;
}

.petpal-section-heading__meta p {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-conversation-cell {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.petpal-conversation-cell__copy {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.petpal-conversation-cell__preview,
.petpal-conversation-cell__meta {
  margin: 0;
  line-height: 1.6;
}

.petpal-conversation-cell__preview {
  color: #0f172a;
}

.petpal-conversation-cell__meta {
  color: var(--frontend-color-muted);
  font-size: 12px;
}

.petpal-empty-state {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .petpal-grid-span-3 {
    grid-column: span 6;
  }
}

@media (max-width: 720px) {
  .petpal-grid-span-3 {
    grid-column: span 12;
  }

  .petpal-section-heading {
    flex-direction: column;
  }

  .petpal-filter-toolbar {
    align-items: stretch;
  }
}
</style>
