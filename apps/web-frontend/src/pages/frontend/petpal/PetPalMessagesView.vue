<template>
  <PetPalDeskPage
    eyebrow="消息中心"
    title="跨订单沟通统一查看，再决定进入哪一笔订单"
    summary="消息中心只负责找出有未读或最近更新的会话，发送消息和完整上下文留在订单详情页。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-messages"
    :actions="[{ label: '提醒中心', to: { name: 'frontend-petpal-reminders' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="ownerState === 'error'"
            :loading="sectionReloadingKey === 'owner'"
            @click="retryOwnerThreads"
          >
            重试主人侧
          </el-button>
          <el-button
            v-if="caregiverState === 'error'"
            :loading="sectionReloadingKey === 'caregiver'"
            @click="retryCaregiverThreads"
          >
            重试照料者侧
          </el-button>
          <RouterLink
            v-if="activeConversation && ownerState !== 'error' && caregiverState !== 'error'"
            :to="buildOrderDetailLink(activeConversation.id)"
          >
            进入这笔订单
          </RouterLink>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Role" title="选择查看视角" description="主人和照料者的跨订单消息在这里分开查看。">
      <div class="petpal-toolbar">
        <el-radio-group v-model="role" size="small">
          <el-radio-button label="owner">主人视角</el-radio-button>
          <el-radio-button label="caregiver">照料者视角</el-radio-button>
        </el-radio-group>
      </div>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection class="petpal-span-5" eyebrow="Threads" title="会话队列" description="优先显示最近有未读或最近更新的订单会话。">
        <PetPalDeskEmpty
          v-if="!conversations.length"
          title="当前没有可查看的会话"
          description="如果订单还没有开始沟通，会话会在发送第一条消息后出现。"
        />

        <div v-else class="petpal-sheet-list">
          <button
            v-for="item in conversations"
            :key="item.id"
            type="button"
            class="petpal-conversation-row"
            :class="{ 'is-active': item.id === selectedOrderId, 'is-focused': item.id === highlightedOrderId }"
            @click="selectedOrderId = item.id"
          >
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ item.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(item.orderStatus) }} · {{ getPetPalServiceTypeLabel(item.serviceType) }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalConversationPreview(item.conversation) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="threadUnread(item) ? 'is-danger' : ''">未读 {{ threadUnread(item) }}</span>
              <span class="petpal-muted">{{ formatPetPalConversationMeta(item.conversation, role, formatPetPalTime) }}</span>
            </div>
          </button>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-7" eyebrow="Current" title="当前会话摘要" description="确认这笔订单需要优先处理后，再进入订单详情发送消息。">
        <PetPalDeskEmpty
          v-if="!activeConversation"
          title="先选择左侧会话"
          description="选中会话后，这里会展示未读数量、最近消息和跳转入口。"
        />

        <template v-else>
          <div class="petpal-summary-strip">
            <div>
              <span>订单状态</span>
              <strong>{{ getPetPalOrderStatusLabel(activeConversation.orderStatus) }}</strong>
            </div>
            <div>
              <span>服务类型</span>
              <strong>{{ getPetPalServiceTypeLabel(activeConversation.serviceType) }}</strong>
            </div>
            <div>
              <span>未读数量</span>
              <strong>{{ threadUnread(activeConversation) }}</strong>
            </div>
          </div>

          <div class="petpal-side-stack">
            <p class="petpal-sheet-row__desc">{{ formatPetPalConversationPreview(activeConversation.conversation) }}</p>
            <p class="petpal-sheet-row__desc">{{ formatPetPalConversationMeta(activeConversation.conversation, role, formatPetPalTime) }}</p>
          </div>

          <div class="petpal-actions">
            <el-button
              v-if="threadUnread(activeConversation)"
              @click="markThreadRead(activeConversation.id)"
            >
              标记已读
            </el-button>
            <RouterLink :to="buildOrderDetailLink(activeConversation.id)">进入订单详情继续沟通</RouterLink>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, OrderRecord } from '@rbac/api-common';
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalDeskHandoffQuery,
  getPetPalDeskFocusRole,
  getPetPalQueryString,
  mergePetPalPageNotice,
  runPetPalSectionRetry,
  type PetPalRoleAwareSectionLoadState,
} from './recovery';
import {
  formatPetPalConversationMeta,
  formatPetPalConversationPreview,
  formatPetPalTime,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  petPalOwnerWorkspaceNav,
} from './shared';

type ConversationItem = Pick<OrderRecord, 'id' | 'orderNo' | 'orderStatus' | 'serviceType' | 'conversation'>
  | Pick<CaregiverOrderRecord, 'id' | 'orderNo' | 'orderStatus' | 'serviceType' | 'conversation'>;

const route = useRoute();
const ownerOrders = ref<OrderRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const role = ref<'owner' | 'caregiver'>('owner');
const selectedOrderId = ref('');
const ownerState = ref<PetPalRoleAwareSectionLoadState>('idle');
const caregiverState = ref<PetPalRoleAwareSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'owner' | 'caregiver'>('');

const conversations = computed<ConversationItem[]>(() => {
  const source = role.value === 'owner' ? ownerOrders.value : caregiverOrders.value;
  return [...source].sort((left, right) => {
    const unreadGap = getPetPalConversationUnreadCount(right.conversation, role.value) - getPetPalConversationUnreadCount(left.conversation, role.value);
    if (unreadGap !== 0) {
      return unreadGap;
    }
    return String(right.conversation?.lastMessageAt || '').localeCompare(String(left.conversation?.lastMessageAt || ''));
  });
});

const activeConversation = computed(() => conversations.value.find((item) => item.id === selectedOrderId.value) ?? conversations.value[0] ?? null);
const highlightedOrderId = computed(() => getPetPalQueryString(route.query, 'focusOrderId'));
const heroStats = computed(() => [
  { label: '主人会话', value: String(ownerOrders.value.length), hint: '按主人视角聚合' },
  { label: '照料者会话', value: String(caregiverOrders.value.length), hint: '按照料者视角聚合' },
  { label: '当前视角未读', value: String(conversations.value.reduce((sum, item) => sum + threadUnread(item), 0)), hint: '可先标记已读再进入详情' },
  { label: '当前视角', value: role.value === 'owner' ? '主人' : '照料者', hint: '两端消息不再混排' },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    ownerState.value === 'error' ? '主人侧会话暂未刷新完整，可只重试主人侧' : '',
    caregiverState.value === 'error' ? '照料者侧会话暂未刷新完整，可只重试照料者侧' : '',
  ]);
  if (!description) {
    return null;
  }
  const hasError = ownerState.value === 'error' || caregiverState.value === 'error';
  return {
    title: hasError ? '消息中心还有部分内容未刷新完成' : '已回到消息中心',
    description,
    tone: hasError ? 'warning' as const : 'accent' as const,
  };
});

const threadUnread = (item: ConversationItem) => getPetPalConversationUnreadCount(item.conversation, role.value);

function buildOrderDetailLink(orderId: string) {
  return {
    name: 'frontend-petpal-order-detail',
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这笔订单最近有沟通更新，可直接回到沟通区继续处理。',
      focusOrderId: orderId,
      focusRole: role.value,
      tab: 'messages',
    }),
  };
}

function applyRouteContext() {
  const requestedRole = getPetPalDeskFocusRole(route.query);
  if (requestedRole) {
    role.value = requestedRole;
  } else if (highlightedOrderId.value) {
    if (ownerOrders.value.some((item) => item.id === highlightedOrderId.value)) {
      role.value = 'owner';
    } else if (caregiverOrders.value.some((item) => item.id === highlightedOrderId.value)) {
      role.value = 'caregiver';
    }
  }

  if (highlightedOrderId.value && conversations.value.some((item) => item.id === highlightedOrderId.value)) {
    selectedOrderId.value = highlightedOrderId.value;
    return;
  }

  if (!conversations.value.some((item) => item.id === selectedOrderId.value)) {
    selectedOrderId.value = conversations.value[0]?.id || '';
  }
}

async function loadOwnerThreads() {
  ownerState.value = 'idle';
  try {
    ownerOrders.value = await api.petpal.orders.list();
    ownerState.value = 'ready';
  } catch (error) {
    ownerOrders.value = [];
    ownerState.value = 'error';
    throw error;
  }
}

async function loadCaregiverThreads() {
  caregiverState.value = 'idle';
  try {
    const result = await api.petpal.caregiver.orders({ page: 1, pageSize: 50 });
    caregiverOrders.value = result.items;
    caregiverState.value = 'ready';
  } catch (error) {
    caregiverOrders.value = [];
    caregiverState.value = 'error';
    throw error;
  }
}

async function loadPage() {
  const [ownerResult, caregiverResult] = await Promise.allSettled([
    loadOwnerThreads(),
    loadCaregiverThreads(),
  ]);
  applyRouteContext();

  if (ownerResult.status === 'rejected' && caregiverResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(ownerResult.reason, '加载消息中心失败'));
  }
}

async function retryOwnerThreads() {
  await runPetPalSectionRetry({
    key: 'owner',
    sectionReloadingKey,
    reload: async () => {
      await loadOwnerThreads();
      applyRouteContext();
    },
    getState: () => ownerState.value,
    successMessage: '主人侧会话已刷新',
    swallowError: true,
  });
}

async function retryCaregiverThreads() {
  await runPetPalSectionRetry({
    key: 'caregiver',
    sectionReloadingKey,
    reload: async () => {
      await loadCaregiverThreads();
      applyRouteContext();
    },
    getState: () => caregiverState.value,
    successMessage: '照料者侧会话已刷新',
    swallowError: true,
  });
}

async function markThreadRead(orderId: string) {
  try {
    await api.petpal.orders.markMessagesRead(orderId);
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '标记已读失败'));
  }
}

onMounted(() => {
  void loadPage();
});

watch(
  () => [route.query.focusOrderId, route.query.focusRole],
  () => {
    applyRouteContext();
  },
  { immediate: true },
);

watch(role, () => {
  if (highlightedOrderId.value && conversations.value.some((item) => item.id === highlightedOrderId.value)) {
    selectedOrderId.value = highlightedOrderId.value;
    return;
  }
  if (!conversations.value.some((item) => item.id === selectedOrderId.value)) {
    selectedOrderId.value = conversations.value[0]?.id || '';
  }
});
</script>

<style scoped lang="scss">
.petpal-conversation-row {
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

.petpal-conversation-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-conversation-row.is-active {
  color: #2563eb;
}

.petpal-conversation-row.is-focused {
  margin-inline: -10px;
  padding-inline: 10px;
  background: rgba(244, 248, 255, 0.9);
}
</style>
