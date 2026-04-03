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
            :to="buildResultLink('payment', order.id)"
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
            :to="buildResultLink('review', order.id)"
          >
            评价结果页
          </RouterLink>
          <RouterLink
            v-if="isOwnerView"
            :to="buildResultLink('complaint', order.id)"
          >
            投诉结果页
          </RouterLink>
          <RouterLink
            v-if="isOwnerView"
            :to="buildResultLink('refund', order.id)"
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
              <div v-if="message.mediaUrls.length" class="petpal-message-attachments">
                <template v-for="url in message.mediaUrls" :key="url">
                  <button
                    v-if="isLikelyImageAttachment(url)"
                    type="button"
                    class="petpal-message-attachment-preview"
                    @click="openMessageAttachment(url)"
                  >
                    <img :src="url" alt="订单消息附件" class="petpal-message-attachment-image">
                  </button>
                  <a
                    v-else
                    class="petpal-message-attachment-link"
                    :href="url"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ getMessageAttachmentLabel(url) }}
                  </a>
                </template>
              </div>
            </div>
          </div>
        </div>
        <PetPalDeskEmpty
          v-else
          title="这笔订单还没有开始沟通"
          description="发送第一条消息后，会话就会出现在这里。"
        />

        <div class="petpal-side-stack">
          <PetPalDeskNotice
            v-if="currentMessageRecovery"
            eyebrow="Recovery"
            :title="currentMessageRecovery.stage === 'send' ? '上一条消息还没发出去' : '上一轮图片上传没有完成'"
            :description="currentMessageRecovery.message"
            tone="warning"
          >
            <template #actions>
              <el-button
                link
                :disabled="uploadingMessageAttachments || sendingMessage"
                @click="retryCurrentMessageRecovery"
              >
                {{ currentMessageRecovery.stage === 'send' ? '重试发送' : '重新上传图片' }}
              </el-button>
              <el-button link @click="clearCurrentMessageRecovery(order.id)">
                清除提示
              </el-button>
            </template>
          </PetPalDeskNotice>
          <div v-if="messageAttachments.length" class="petpal-message-drafts">
            <div v-for="item in messageAttachments" :key="item.fileId" class="petpal-message-draft-card">
              <button type="button" class="petpal-message-attachment-preview" @click="openMessageAttachment(item.url)">
                <img :src="item.url" :alt="item.name" class="petpal-message-attachment-image">
              </button>
              <div class="petpal-message-draft-meta">
                <strong>{{ item.name }}</strong>
                <span>{{ formatMessageAttachmentSize(item.size) }}</span>
              </div>
              <el-button class="petpal-message-draft-remove" link type="danger" @click="removeMessageAttachment(item.fileId)">
                移除
              </el-button>
            </div>
          </div>
          <el-input
            v-model="messageContent"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="补充照料安排、交接说明或售后沟通内容"
          />
          <input
            ref="messageAttachmentInputRef"
            class="petpal-message-upload-input"
            type="file"
            accept="image/*"
            multiple
            @change="handleMessageAttachmentChange"
          >
          <div class="petpal-message-upload-row">
            <el-button
              :loading="uploadingMessageAttachments"
              :disabled="!order || sendingMessage || messageAttachmentSlotsLeft <= 0"
              @click="triggerMessageAttachmentInput"
            >
              {{ uploadingMessageAttachments ? '上传中...' : `上传图片${messageAttachmentSlotsLeft > 0 ? `（剩余 ${messageAttachmentSlotsLeft} 张）` : ''}` }}
            </el-button>
            <span class="petpal-sheet-row__desc">消息图片会按当前订单范围上传，最多 3 张。</span>
          </div>
          <el-progress
            v-if="messageUploadProgress !== null"
            class="petpal-message-upload-progress"
            :percentage="messageUploadProgress"
            :status="messageUploadProgress >= 100 && !uploadingMessageAttachments ? 'success' : undefined"
          />
          <div class="petpal-actions">
            <el-button type="primary" :loading="sendingMessage" :disabled="!order || uploadingMessageAttachments" @click="submitMessage">发送消息</el-button>
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
import type {
  ComplaintRecord,
  OrderConversationDetailRecord,
  OrderDetailRecord,
  OrderRefundProgressRecord,
} from '@rbac/api-common';
import {
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_BYTES,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
} from '@rbac/api-common';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import { getErrorMessage, isDialogCancellation } from '@/utils/errors';
import {
  clearPetPalMessageDraft,
  clearPetPalMessageRecovery,
  getPetPalMessageComposerScope,
  getPetPalMessageRecovery,
  persistPetPalMessageDraft,
  restorePetPalMessageDraft,
  setPetPalMessageRecovery,
  type PetPalMessageComposerIdentity,
  type PetPalMessageComposerScope,
  type PetPalMessageDraftAttachment,
} from './message-composer-state';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalPageNotice,
  buildPetPalDeskHandoffQuery,
  getPetPalDeskFocusRole,
  getPetPalDeskSectionTab,
  getPetPalQueryString,
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

type DraftMessageAttachment = PetPalMessageDraftAttachment;

const IMAGE_ATTACHMENT_URL_RE = /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i;

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
const messageAttachments = ref<DraftMessageAttachment[]>([]);
const uploadingMessageAttachments = ref(false);
const messageUploadProgress = ref<number | null>(null);
const messageAttachmentInputRef = ref<HTMLInputElement | null>(null);
const conversationState = ref<PetPalSectionLoadState>('idle');
const aftersalesState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'conversation' | 'aftersales'>('');
const summarySectionRef = ref<HTMLElement | null>(null);
const messagesSectionRef = ref<HTMLElement | null>(null);
const serviceSectionRef = ref<HTMLElement | null>(null);
const aftersalesSectionRef = ref<HTMLElement | null>(null);

const isOwnerView = computed(() => order.value?.ownerId === auth.user?.id);
const currentRole = computed<'owner' | 'caregiver'>(() => {
  if (order.value) {
    return isOwnerView.value ? 'owner' : 'caregiver';
  }
  return getPetPalDeskFocusRole(route.query) || 'owner';
});
const messageComposerScope = ref<PetPalMessageComposerScope>(currentRole.value);
const navItems = computed(() => currentRole.value === 'owner' ? petPalOwnerWorkspaceNav : petPalCaregiverWorkspaceNav);
const heroActions = computed(() => {
  if (!order.value) {
    return [
      {
        label: currentRole.value === 'owner' ? '返回订单队列' : '返回履约队列',
        to: buildFallbackQueueLink(
          currentRole.value === 'owner'
            ? '订单详情暂时不可用，已回到订单队列，可稍后重新进入当前订单。'
            : '订单详情暂时不可用，已回到履约队列，可稍后重新进入当前订单。',
        ),
        tone: 'secondary' as const,
      },
      {
        label: '消息中心',
        to: buildMessagesLink('订单详情暂时不可用，可先回消息中心查看最近沟通。'),
        tone: 'secondary' as const,
      },
    ];
  }
  return [
    { label: isOwnerView.value ? '返回订单队列' : '返回履约队列', to: buildQueueLink(order.value), tone: 'secondary' as const },
    { label: '消息中心', to: buildMessagesLink('这里已经定位到这笔订单会话，可直接继续沟通。', order.value.id), tone: 'secondary' as const },
  ];
});

const heroStats = computed(() => [
  { label: '订单状态', value: order.value ? getPetPalOrderStatusLabel(order.value.orderStatus) : '--', hint: '先确认当前阶段' },
  { label: '未读消息', value: String(conversationUnreadCount.value), hint: conversationUnreadCount.value ? '建议先回看消息' : '当前无未读' },
  { label: '履约留痕', value: String(order.value ? order.value.timeline.length + order.value.serviceLogs.length : 0), hint: '包含事件和服务记录' },
  { label: '售后摘要', value: isOwnerView.value ? `${complaints.value.length} / ${refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : '暂无'}` : '照料者侧不展示', hint: '退款与投诉去结果页处理' },
]);
const pageNotice = computed(() => buildPetPalPageNotice({
  baseNotice: getPetPalQueryString(route.query, 'notice'),
  warnings: [
    conversationState.value === 'error' ? '订单沟通暂未刷新完成，可只重试沟通区' : '',
    aftersalesState.value === 'error' && isOwnerView.value ? '售后摘要暂未刷新完成，可只重试售后区' : '',
  ],
  successTitle: '已回到订单详情',
  warningTitle: '订单详情还有部分分区未刷新完成',
}));

function resolveOrderFilter(record: OrderDetailRecord) {
  if (isPetPalOutstandingOrder(record)) {
    return 'needs_payment' as const;
  }
  if (['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(record.orderStatus)) {
    return 'aftersales' as const;
  }
  if (['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(record.orderStatus)) {
    return 'active' as const;
  }
  if (record.orderStatus === 'COMPLETED') {
    return 'done' as const;
  }
  return 'all' as const;
}

function buildQueueLink(record: OrderDetailRecord) {
  if (currentRole.value === 'owner') {
    return {
      name: 'frontend-petpal-orders',
      query: buildPetPalDeskHandoffQuery({
        notice: '这里已经定位到这笔订单，可继续在队列里跟进当前阶段。',
        focusOrderId: record.id,
        focusFilter: resolveOrderFilter(record),
      }),
    };
  }
  return {
    name: 'frontend-petpal-caregiver-orders',
    query: buildPetPalDeskHandoffQuery({
      notice: '这里已经定位到这笔履约订单，可继续在履约队列里跟进。',
      focusOrderId: record.id,
      focusRole: 'caregiver',
    }),
  };
}

function buildFallbackQueueLink(notice: string) {
  if (currentRole.value === 'owner') {
    return {
      name: 'frontend-petpal-orders',
      query: buildPetPalDeskHandoffQuery({ notice }),
    };
  }
  return {
    name: 'frontend-petpal-caregiver-orders',
    query: buildPetPalDeskHandoffQuery({
      notice,
      focusRole: 'caregiver',
    }),
  };
}

function buildMessagesLink(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-messages',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
      focusRole: currentRole.value,
    }),
  };
}

function buildResultLink(mode: 'payment' | 'review' | 'complaint' | 'refund', orderId: string) {
  return {
    name: `frontend-petpal-${mode}-result`,
    params: { id: orderId },
    query: buildPetPalDeskHandoffQuery({
      notice: ({
        payment: '这里已经定位到这笔待支付订单的结果页，可直接继续付款。',
        review: '这里已经定位到这笔订单的评价结果页，可继续查看或提交评价。',
        complaint: '这里已经定位到这笔订单的投诉结果页，可继续查看或补充投诉。',
        refund: '这里已经定位到这笔订单的退款结果页，可继续查看退款阶段。',
      } satisfies Record<'payment' | 'review' | 'complaint' | 'refund', string>)[mode],
      focusOrderId: orderId,
    }),
  };
}

const conversationUnreadCount = computed(() => {
  if (!order.value) {
    return 0;
  }
  return getPetPalConversationUnreadCount(order.value.conversation, isOwnerView.value ? 'owner' : 'caregiver');
});

const canConfirmComplete = computed(() => isOwnerView.value && order.value?.orderStatus === 'SERVING');
const messageAttachmentSlotsLeft = computed(() =>
  Math.max(0, PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT - messageAttachments.value.length));
const currentMessageRecovery = computed(() => {
  const identity = buildMessageComposerIdentity(orderId.value);
  return identity ? getPetPalMessageRecovery(identity) : null;
});

const isLikelyImageAttachment = (url: string, mimeType?: string) =>
  mimeType?.startsWith('image/')
  || IMAGE_ATTACHMENT_URL_RE.test(url);

const getMessageAttachmentLabel = (url: string) => {
  const normalized = url.split('?')[0]?.split('#')[0] ?? url;
  const segment = normalized.slice(normalized.lastIndexOf('/') + 1).trim();
  return segment || '查看附件';
};

const formatMessageAttachmentSize = (size: number) => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
};

function buildMessageComposerIdentity(
  currentOrderId: string,
  scope?: PetPalMessageComposerScope,
): PetPalMessageComposerIdentity | null {
  const normalizedOrderId = currentOrderId.trim();
  const userId = auth.user?.id?.trim();
  if (!normalizedOrderId || !userId) {
    return null;
  }

  return scope
    ? {
        orderId: normalizedOrderId,
        userId,
        scope,
      }
    : {
        orderId: normalizedOrderId,
        userId,
      };
}

function resetComposer() {
  messageContent.value = '';
  messageAttachments.value = [];
  messageUploadProgress.value = null;
  if (messageAttachmentInputRef.value) {
    messageAttachmentInputRef.value.value = '';
  }
}

function restoreComposerState(currentOrderId: string) {
  const identity = buildMessageComposerIdentity(currentOrderId, messageComposerScope.value);
  const draft = identity ? restorePetPalMessageDraft(identity) : null;
  messageContent.value = draft?.content ?? '';
  messageAttachments.value = draft?.attachments ?? [];
  messageUploadProgress.value = null;
  if (messageAttachmentInputRef.value) {
    messageAttachmentInputRef.value.value = '';
  }
}

function persistCurrentMessageDraft(
  currentOrderId: string,
  scope: PetPalMessageComposerScope = messageComposerScope.value,
) {
  const identity = buildMessageComposerIdentity(currentOrderId, scope);
  if (!identity) {
    return;
  }

  persistPetPalMessageDraft(identity, messageContent.value, messageAttachments.value);
}

function clearCurrentMessageDraft(
  currentOrderId: string,
  scope: PetPalMessageComposerScope = messageComposerScope.value,
) {
  const identity = buildMessageComposerIdentity(currentOrderId, scope);
  if (!identity) {
    return;
  }

  clearPetPalMessageDraft(identity);
}

function clearCurrentMessageRecovery(
  currentOrderId: string,
  scope: PetPalMessageComposerScope = messageComposerScope.value,
) {
  const identity = buildMessageComposerIdentity(currentOrderId, scope);
  if (!identity) {
    return;
  }

  clearPetPalMessageRecovery(identity);
}

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
    messageComposerScope.value = order.value.ownerId === auth.user?.id ? 'owner' : 'caregiver';
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

function triggerMessageAttachmentInput() {
  if (!order.value || uploadingMessageAttachments.value || messageAttachmentSlotsLeft.value <= 0) {
    return;
  }
  messageAttachmentInputRef.value?.click();
}

function openMessageAttachment(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function removeMessageAttachment(fileId: string) {
  messageAttachments.value = messageAttachments.value.filter((item) => item.fileId !== fileId);
}

function retryCurrentMessageRecovery() {
  if (!currentMessageRecovery.value || uploadingMessageAttachments.value || sendingMessage.value) {
    return;
  }

  if (currentMessageRecovery.value.stage === 'send') {
    void submitMessage();
    return;
  }

  triggerMessageAttachmentInput();
}

async function handleMessageAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selectedFiles = Array.from(input.files ?? []);
  input.value = '';

  if (!order.value || !selectedFiles.length) {
    return;
  }

  const limitedFiles = selectedFiles.slice(0, messageAttachmentSlotsLeft.value);
  if (selectedFiles.length > limitedFiles.length) {
    ElMessage.warning(`一次最多还能添加 ${messageAttachmentSlotsLeft.value} 张图片`);
  }

  const validFiles = limitedFiles.filter((file) =>
    (!file.type || file.type.startsWith('image/')) && file.size <= PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_BYTES);

  if (validFiles.length < limitedFiles.length) {
    ElMessage.warning('仅支持上传不超过 8 MB 的图片文件');
  }

  if (!validFiles.length) {
    return;
  }

  uploadingMessageAttachments.value = true;
  messageUploadProgress.value = 0;

  const progressMap = new Map<number, number>();
  const reportProgress = () => {
    const total = Array.from(progressMap.values()).reduce((sum, current) => sum + current, 0);
    messageUploadProgress.value = Math.round(total / validFiles.length);
  };

  try {
    for (const [index, file] of validFiles.entries()) {
      const uploaded = await uploadAttachmentFile(
        file,
        {
          tag1: PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
          tag2: order.value.id,
        },
        (progress) => {
          progressMap.set(index, progress);
          reportProgress();
        },
      );

      progressMap.set(index, 100);
      reportProgress();
      messageAttachments.value = [
        ...messageAttachments.value,
        {
          fileId: uploaded.fileId,
          url: uploaded.url,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
      ];
    }

    ElMessage.success(validFiles.length === 1 ? '消息图片已上传' : `已上传 ${validFiles.length} 张消息图片`);
    clearCurrentMessageRecovery(order.value.id);
  } catch (error: unknown) {
    const message = `${getErrorMessage(error, '上传消息图片失败')}，已完成的图片仍会保留在当前草稿中。`;
    const identity = buildMessageComposerIdentity(order.value.id, messageComposerScope.value);
    if (identity) {
      setPetPalMessageRecovery(identity, 'upload', message);
    }
    ElMessage.error(message);
  } finally {
    uploadingMessageAttachments.value = false;
    messageUploadProgress.value = null;
  }
}

async function submitMessage() {
  const content = messageContent.value.trim();
  const mediaUrls = messageAttachments.value.map((item) => item.url);
  if (!order.value) {
    return;
  }
  if (!content && !mediaUrls.length) {
    ElMessage.warning('请先填写消息内容或上传图片');
    return;
  }
  sendingMessage.value = true;
  try {
    const result = await api.petpal.orders.sendMessage(order.value.id, {
      content: content || undefined,
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
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
    clearCurrentMessageDraft(order.value.id);
    clearCurrentMessageRecovery(order.value.id);
    resetComposer();
    ElMessage.success('消息已发送');
  } catch (error: unknown) {
    const message = `${getErrorMessage(error, '发送消息失败')}，当前输入和已上传图片都已保留。`;
    const identity = buildMessageComposerIdentity(order.value.id, messageComposerScope.value);
    if (identity) {
      setPetPalMessageRecovery(identity, 'send', message);
    }
    ElMessage.error(message);
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

watch(
  messageContent,
  () => {
    if (orderId.value) {
      persistCurrentMessageDraft(orderId.value, messageComposerScope.value);
    }
  },
);

watch(
  messageAttachments,
  () => {
    if (orderId.value) {
      persistCurrentMessageDraft(orderId.value, messageComposerScope.value);
    }
  },
  { deep: true },
);

watch(
  orderId,
  (value, previousValue) => {
    if (value === previousValue) {
      return;
    }
    if (previousValue) {
      persistCurrentMessageDraft(previousValue, messageComposerScope.value);
    }
    if (!value) {
      messageComposerScope.value = 'shared';
      resetComposer();
      return;
    }
    const routeScope = getPetPalDeskFocusRole(route.query);
    const identity = buildMessageComposerIdentity(value);
    messageComposerScope.value = (identity ? getPetPalMessageComposerScope(identity) : null)
      ?? (routeScope ? routeScope : 'shared');
    restoreComposerState(value);
  },
  { immediate: true },
);
</script>

<style scoped>
.petpal-message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.petpal-message-attachment-preview {
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.petpal-message-attachment-image {
  display: block;
  width: 112px;
  height: 112px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-light);
}

.petpal-message-attachment-link {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.petpal-message-drafts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.petpal-message-draft-card {
  display: grid;
  gap: 8px;
  width: 136px;
}

.petpal-message-draft-meta {
  display: grid;
  gap: 2px;
}

.petpal-message-draft-meta strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  word-break: break-word;
}

.petpal-message-draft-meta span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.petpal-message-draft-remove {
  justify-self: start;
  padding: 0;
}

.petpal-message-upload-input {
  display: none;
}

.petpal-message-upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.petpal-message-upload-progress {
  max-width: 280px;
}
</style>
