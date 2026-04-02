<template>
  <PetPalDeskPage
    eyebrow="订单详情"
    :title="order ? order.orderNo : '订单详情'"
    summary="详情页只负责回看状态、沟通和履约留痕，支付和售后动作已经分去结果页。"
    :nav-items="navItems"
    :actions="heroActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="conversationState === 'error'"
            :loading="sectionReloadingKey === 'conversation'"
            @click="retryConversation"
          >
            重试沟通区
          </el-button>
          <el-button
            v-if="aftersalesState === 'error' && isOwnerView"
            :loading="sectionReloadingKey === 'aftersales'"
            @click="retryAftersales"
          >
            重试售后区
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

    <div ref="summarySectionRef">
      <PetPalDeskSection eyebrow="Summary" title="当前订单状态" description="先确认状态和下一步，再决定进入支付、评价或售后结果页。">
      <PetPalDeskEmpty
        v-if="!order"
        title="订单暂时不可用"
        description="请返回订单队列重试，或稍后刷新页面。"
      />

      <template v-else>
        <div class="petpal-kv-grid">
          <div class="petpal-kv">
            <span>订单状态</span>
            <strong>{{ getPetPalOrderStatusLabel(order.orderStatus) }}</strong>
          </div>
          <div class="petpal-kv">
            <span>服务类型</span>
            <strong>{{ getPetPalServiceTypeLabel(order.serviceType) }}</strong>
          </div>
          <div class="petpal-kv">
            <span>服务时间</span>
            <strong>{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</strong>
          </div>
          <div class="petpal-kv">
            <span>金额</span>
            <strong>{{ formatPetPalMoney(Number(order.amountTotal) + Number(order.amountAdjusted)) }} / 已付 {{ formatPetPalMoney(order.amountPaid) }}</strong>
          </div>
        </div>

        <div class="petpal-actions">
          <RouterLink
            v-if="isPetPalOutstandingOrder(order)"
            :to="{ name: 'frontend-petpal-payment-result', params: { id: order.id } }"
          >
            去支付结果页
          </RouterLink>
          <el-button
            v-if="canConfirmComplete"
            :loading="confirming"
            @click="confirmComplete"
          >
            确认完成
          </el-button>
          <RouterLink
            v-if="isOwnerView"
            :to="{ name: 'frontend-petpal-review-result', params: { id: order.id } }"
          >
            评价结果页
          </RouterLink>
          <RouterLink
            v-if="isOwnerView"
            :to="{ name: 'frontend-petpal-complaint-result', params: { id: order.id } }"
          >
            投诉结果页
          </RouterLink>
          <RouterLink
            v-if="isOwnerView"
            :to="{ name: 'frontend-petpal-refund-result', params: { id: order.id } }"
          >
            退款结果页
          </RouterLink>
        </div>
      </template>
      </PetPalDeskSection>
    </div>

    <div ref="messagesSectionRef">
      <PetPalDeskSection eyebrow="Messages" title="订单沟通" description="如果需要发消息，只在订单上下文里发送。">
      <PetPalDeskEmpty
        v-if="!order"
        title="暂无订单沟通"
        description="订单加载完成后，会显示这笔订单的沟通记录。"
      />

      <PetPalDeskEmpty
        v-else-if="conversationState === 'error'"
        title="订单沟通暂未刷新完成"
        description="可以直接重试沟通区，或稍后再回到这笔订单。"
      />

      <template v-else>
        <div class="petpal-toolbar">
          <span class="petpal-pill" :class="conversationUnreadCount ? 'is-danger' : ''">未读 {{ conversationUnreadCount }}</span>
          <el-button v-if="conversationUnreadCount" @click="markConversationRead">标记已读</el-button>
        </div>

        <div v-if="conversation?.messages.length" class="petpal-sheet-list">
          <div v-for="message in conversation.messages" :key="message.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ message.senderRole === 'OWNER' ? '宠物主人' : '照料者' }}</h3>
              <p class="petpal-sheet-row__desc">{{ formatPetPalTime(message.createdAt) }}</p>
              <p class="petpal-sheet-row__desc">{{ message.content || '发送了一条附件消息' }}</p>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="这笔订单还没有开始沟通"
          description="发送第一条消息后，会话就会出现在这里。"
        />

        <div class="petpal-side-stack">
          <el-input
            v-model="messageContent"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="补充照料安排、交接说明或售后沟通内容"
          />
          <div class="petpal-actions">
            <el-button type="primary" :loading="sendingMessage" :disabled="!order" @click="submitMessage">发送消息</el-button>
          </div>
        </div>
      </template>
      </PetPalDeskSection>
    </div>

    <div ref="serviceSectionRef">
      <PetPalDeskSection eyebrow="Service" title="履约留痕" description="这里只展示关键履约事件和服务记录。">
      <PetPalDeskEmpty
        v-if="!order || (!order.timeline.length && !order.serviceLogs.length)"
        title="还没有履约留痕"
        description="当接单、签到或提交服务记录后，这里会开始出现时间线。"
      />

      <div v-else class="petpal-sheet-list">
        <div v-for="event in order.timeline" :key="event.id" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ event.eventType }}</h3>
            <p class="petpal-sheet-row__desc">{{ event.operatorRole }} · {{ formatPetPalTime(event.createdAt) }}</p>
          </div>
        </div>
        <div v-for="log in order.serviceLogs" :key="log.id" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ log.logType }}</h3>
            <p class="petpal-sheet-row__desc">{{ formatPetPalTime(log.happenedAt) }}</p>
            <p class="petpal-sheet-row__desc">{{ log.textNote || '暂无补充说明' }}</p>
          </div>
        </div>
      </div>
      </PetPalDeskSection>
    </div>

    <div v-if="isOwnerView && order" ref="aftersalesSectionRef">
      <PetPalDeskSection
        eyebrow="Aftersales"
        title="当前售后摘要"
        description="这里只给摘要，具体填写和查看去结果页完成。"
      >
        <PetPalDeskEmpty
          v-if="aftersalesState === 'error'"
          title="售后摘要暂未刷新完成"
          description="可以直接重试售后区，或先回结果页继续跟进。"
        />

        <div v-else class="petpal-kv-grid">
          <div class="petpal-kv">
            <span>退款阶段</span>
            <strong>{{ refundProgress ? getPetPalRefundProgressStageLabel(refundProgress.stage) : '暂无退款' }}</strong>
          </div>
          <div class="petpal-kv">
            <span>投诉数量</span>
            <strong>{{ complaints.length }}</strong>
          </div>
        </div>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { ComplaintRecord, OrderConversationDetailRecord, OrderDetailRecord, OrderRefundProgressRecord } from '@rbac/api-common';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage, isDialogCancellation } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  getPetPalDeskSectionTab,
  getPetPalQueryString,
  mergePetPalPageNotice,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import {
  formatPetPalMoney,
  formatPetPalRange,
  formatPetPalTime,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalRefundProgressStageLabel,
  getPetPalServiceTypeLabel,
  isPetPalOutstandingOrder,
  petPalCaregiverWorkspaceNav,
  petPalOwnerWorkspaceNav,
} from './shared';

const auth = useAuthStore();
const route = useRoute();

const orderId = computed(() => String(route.params.id || ''));
const order = ref<OrderDetailRecord | null>(null);
const conversation = ref<OrderConversationDetailRecord | null>(null);
const complaints = ref<ComplaintRecord[]>([]);
const refundProgress = ref<OrderRefundProgressRecord | null>(null);
const sendingMessage = ref(false);
const confirming = ref(false);
const messageContent = ref('');
const conversationState = ref<PetPalSectionLoadState>('idle');
const aftersalesState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'conversation' | 'aftersales'>('');
const summarySectionRef = ref<HTMLElement | null>(null);
const messagesSectionRef = ref<HTMLElement | null>(null);
const serviceSectionRef = ref<HTMLElement | null>(null);
const aftersalesSectionRef = ref<HTMLElement | null>(null);

const isOwnerView = computed(() => order.value?.ownerId === auth.user?.id);
const navItems = computed(() => isOwnerView.value ? petPalOwnerWorkspaceNav : petPalCaregiverWorkspaceNav);
const heroActions = computed(() => [
  { label: isOwnerView.value ? '返回订单队列' : '返回履约队列', to: isOwnerView.value ? { name: 'frontend-petpal-orders' } : { name: 'frontend-petpal-caregiver-orders' }, tone: 'secondary' as const },
  { label: '消息中心', to: { name: 'frontend-petpal-messages' }, tone: 'secondary' as const },
]);

const heroStats = computed(() => [
  { label: '订单状态', value: order.value ? getPetPalOrderStatusLabel(order.value.orderStatus) : '--', hint: '先确认当前阶段' },
  { label: '未读消息', value: String(conversationUnreadCount.value), hint: conversationUnreadCount.value ? '建议先回看消息' : '当前无未读' },
  { label: '履约留痕', value: String(order.value ? order.value.timeline.length + order.value.serviceLogs.length : 0), hint: '包含事件和服务记录' },
  { label: '售后摘要', value: isOwnerView.value ? `${complaints.value.length} / ${refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : '暂无'}` : '照料者侧不展示', hint: '退款与投诉去结果页处理' },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    conversationState.value === 'error' ? '订单沟通暂未刷新完成，可只重试沟通区' : '',
    aftersalesState.value === 'error' && isOwnerView.value ? '售后摘要暂未刷新完成，可只重试售后区' : '',
  ]);
  if (!description) {
    return null;
  }
  const hasError = conversationState.value === 'error' || (aftersalesState.value === 'error' && isOwnerView.value);
  return {
    title: hasError ? '订单详情还有部分分区未刷新完成' : '已回到订单详情',
    description,
    tone: hasError ? 'warning' as const : 'accent' as const,
  };
});

const conversationUnreadCount = computed(() => {
  if (!order.value) {
    return 0;
  }
  return getPetPalConversationUnreadCount(order.value.conversation, isOwnerView.value ? 'owner' : 'caregiver');
});

const canConfirmComplete = computed(() => isOwnerView.value && order.value?.orderStatus === 'SERVING');

async function scrollToRequestedTab() {
  const tab = getPetPalDeskSectionTab(route.query);
  if (!tab) {
    return;
  }
  await nextTick();
  const element = ({
    summary: summarySectionRef.value,
    messages: messagesSectionRef.value,
    service: serviceSectionRef.value,
    aftersales: aftersalesSectionRef.value,
  } satisfies Record<string, HTMLElement | null>)[tab];
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadConversationSection(currentOrderId: string) {
  conversationState.value = 'idle';
  try {
    conversation.value = await api.petpal.orders.messages(currentOrderId);
    conversationState.value = 'ready';
  } catch {
    conversation.value = null;
    conversationState.value = 'error';
  }
}

async function loadAftersalesSection(currentOrderId: string) {
  aftersalesState.value = 'idle';
  try {
    const [complaintsResult, refundResult] = await Promise.allSettled([
      api.petpal.orders.complaints(currentOrderId),
      api.petpal.orders.refundProgress(currentOrderId),
    ]);
    complaints.value = complaintsResult.status === 'fulfilled' ? complaintsResult.value : [];
    refundProgress.value = refundResult.status === 'fulfilled' ? refundResult.value : null;
    aftersalesState.value = complaintsResult.status === 'fulfilled' && refundResult.status === 'fulfilled' ? 'ready' : 'error';
  } catch {
    complaints.value = [];
    refundProgress.value = null;
    aftersalesState.value = 'error';
  }
}

async function loadPage() {
  if (!orderId.value) {
    return;
  }
  try {
    order.value = await api.petpal.orders.detail(orderId.value);
    await loadConversationSection(orderId.value);
    if (order.value.ownerId === auth.user?.id) {
      await loadAftersalesSection(orderId.value);
    } else {
      complaints.value = [];
      refundProgress.value = null;
      aftersalesState.value = 'ready';
    }
    await scrollToRequestedTab();
  } catch (error: unknown) {
    order.value = null;
    ElMessage.error(getErrorMessage(error, '加载订单详情失败'));
  }
}

async function retryConversation() {
  if (!order.value) {
    return;
  }
  await runPetPalSectionRetry({
    key: 'conversation',
    sectionReloadingKey,
    reload: () => loadConversationSection(order.value!.id),
    getState: () => conversationState.value,
    successMessage: '订单沟通已刷新',
    swallowError: true,
  });
}

async function retryAftersales() {
  if (!order.value || !isOwnerView.value) {
    return;
  }
  await runPetPalSectionRetry({
    key: 'aftersales',
    sectionReloadingKey,
    reload: () => loadAftersalesSection(order.value!.id),
    getState: () => aftersalesState.value,
    successMessage: '售后摘要已刷新',
    swallowError: true,
  });
}

async function markConversationRead() {
  if (!order.value || !conversationUnreadCount.value) {
    return;
  }
  try {
    const summary = await api.petpal.orders.markMessagesRead(order.value.id);
    order.value = {
      ...order.value,
      conversation: summary,
    };
    if (conversation.value) {
      conversation.value = {
        ...conversation.value,
        ...summary,
      };
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '标记已读失败'));
  }
}

async function submitMessage() {
  if (!order.value || !messageContent.value.trim()) {
    ElMessage.warning('请先填写消息内容');
    return;
  }
  sendingMessage.value = true;
  try {
    const result = await api.petpal.orders.sendMessage(order.value.id, {
      content: messageContent.value.trim(),
    });
    conversation.value = result;
    order.value = {
      ...order.value,
      conversation: {
        id: result.id,
        orderId: result.orderId,
        ownerUnreadCount: result.ownerUnreadCount,
        caregiverUnreadCount: result.caregiverUnreadCount,
        lastMessageAt: result.lastMessageAt,
        lastMessagePreview: result.lastMessagePreview,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      },
    };
    messageContent.value = '';
    ElMessage.success('消息已发送');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发送消息失败'));
  } finally {
    sendingMessage.value = false;
  }
}

async function confirmComplete() {
  if (!order.value) {
    return;
  }
  try {
    await ElMessageBox.confirm('确认后订单会进入已完成状态，后续评价和售后都去结果页处理。', '确认完成订单', {
      confirmButtonText: '确认完成',
      cancelButtonText: '再看看',
      type: 'warning',
    });
  } catch (error: unknown) {
    if (!isDialogCancellation(error)) {
      ElMessage.error(getErrorMessage(error, '确认取消失败'));
    }
    return;
  }

  confirming.value = true;
  try {
    await api.petpal.orders.confirmComplete(order.value.id);
    ElMessage.success('订单已确认完成');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '确认完成失败'));
  } finally {
    confirming.value = false;
  }
}

onMounted(() => {
  void loadPage();
});

watch(
  () => route.query.tab,
  () => {
    void scrollToRequestedTab();
  },
);
</script>
