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
            :class="{ 'is-active': item.id === selectedOrderId }"
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
            <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: activeConversation.id } }">进入订单详情继续沟通</RouterLink>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, OrderRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
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

const ownerOrders = ref<OrderRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const role = ref<'owner' | 'caregiver'>('owner');
const selectedOrderId = ref('');

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
const heroStats = computed(() => [
  { label: '主人会话', value: String(ownerOrders.value.length), hint: '按主人视角聚合' },
  { label: '照料者会话', value: String(caregiverOrders.value.length), hint: '按照料者视角聚合' },
  { label: '当前视角未读', value: String(conversations.value.reduce((sum, item) => sum + threadUnread(item), 0)), hint: '可先标记已读再进入详情' },
  { label: '当前视角', value: role.value === 'owner' ? '主人' : '照料者', hint: '两端消息不再混排' },
]);

const threadUnread = (item: ConversationItem) => getPetPalConversationUnreadCount(item.conversation, role.value);

async function loadPage() {
  const [ownerResult, caregiverResult] = await Promise.allSettled([
    api.petpal.orders.list(),
    api.petpal.caregiver.orders({ page: 1, pageSize: 50 }),
  ]);
  ownerOrders.value = ownerResult.status === 'fulfilled' ? ownerResult.value : [];
  caregiverOrders.value = caregiverResult.status === 'fulfilled' ? caregiverResult.value.items : [];
  if (!selectedOrderId.value && conversations.value.length) {
    selectedOrderId.value = conversations.value[0].id;
  }

  if (ownerResult.status === 'rejected' && caregiverResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(ownerResult.reason, '加载消息中心失败'));
  }
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
</style>
