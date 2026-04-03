<template>
  <PetPalDeskPage
    eyebrow="消息中心"
    title="跨订单沟通统一查看，再决定先处理哪一笔订单"
    summary="消息中心现在支持直接回复当前线程和发送订单范围图片；需要完整履约、售后上下文时再进入订单详情。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-messages"
    :actions="pageActions"
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
        <el-radio-group v-model="role" size="small" :disabled="composerBusy">
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
            :disabled="composerBusy"
            @click="selectedOrderId = item.id"
          >
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ item.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(item.orderStatus) }} · {{ getPetPalServiceTypeLabel(item.serviceType) }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalConversationPreview(item.conversation) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="threadUnread(item) ? 'is-danger' : ''">未读 {{ threadUnread(item) }}</span>
              <span v-if="hasThreadDraft(item.id)" class="petpal-pill">草稿</span>
              <span v-if="hasThreadRecovery(item.id)" class="petpal-pill is-warning">待恢复</span>
              <span class="petpal-muted">{{ formatPetPalConversationMeta(item.conversation, role, formatPetPalTime) }}</span>
            </div>
          </button>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-7" eyebrow="Current" title="当前线程与快捷回复" description="可以先在这里回一句或补图片，需要完整订单上下文时再进入详情页。">
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
              <strong>{{ activeThreadUnreadCount }}</strong>
            </div>
          </div>

          <div class="petpal-side-stack">
            <p class="petpal-sheet-row__desc">{{ formatPetPalConversationPreview(activeConversation.conversation) }}</p>
            <p class="petpal-sheet-row__desc">{{ formatPetPalConversationMeta(activeConversation.conversation, role, formatPetPalTime) }}</p>
            <p v-if="hasThreadDraft(activeConversation.id)" class="petpal-sheet-row__desc">当前线程已有未发送草稿，切换会话后会继续保留。</p>
            <p v-if="currentThreadRecovery" class="petpal-sheet-row__desc">
              {{ currentThreadRecovery.stage === 'send' ? '当前线程上次发送失败，草稿仍已保留。' : '当前线程上次上传没有完成，可继续补图。' }}
            </p>
          </div>

          <div class="petpal-toolbar">
            <el-button
              v-if="activeThreadUnreadCount"
              @click="markThreadRead(activeConversation.id)"
            >
              标记已读
            </el-button>
            <el-button
              v-if="activeThreadState === 'error'"
              :loading="sectionReloadingKey === 'thread'"
              @click="retryActiveThread"
            >
              重试当前会话
            </el-button>
          </div>

          <PetPalDeskEmpty
            v-if="activeThreadState === 'idle'"
            title="当前会话加载中"
            description="正在拉取这笔订单的沟通记录和快捷回复区。"
          />

          <PetPalDeskEmpty
            v-else-if="activeThreadState === 'error'"
            title="当前会话暂未刷新完成"
            description="可以重试当前会话，或先进入订单详情继续沟通。"
          />

          <template v-else>
            <div v-if="activeThread?.messages.length" class="petpal-sheet-list">
              <div v-for="message in activeThread.messages" :key="message.id" class="petpal-sheet-row">
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
              description="可以直接在这里发出第一条消息或图片。"
            />

            <div class="petpal-side-stack">
              <PetPalDeskNotice
                v-if="currentThreadRecovery"
                eyebrow="Recovery"
                :title="currentThreadRecovery.stage === 'send' ? '上一条消息还没发出去' : '上一轮图片上传没有完成'"
                :description="currentThreadRecovery.message"
                tone="warning"
              >
                <template #actions>
                  <el-button link @click="retryCurrentThreadRecovery">
                    {{ currentThreadRecovery.stage === 'send' ? '重试发送' : '重新上传图片' }}
                  </el-button>
                  <el-button link @click="clearThreadRecovery(activeConversation.id)">
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
                placeholder="补充交接安排、照料提醒或售后沟通内容"
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
                  :disabled="sendingMessage || messageAttachmentSlotsLeft <= 0"
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
            </div>
          </template>

          <div class="petpal-actions">
            <el-button
              v-if="activeThreadState === 'ready'"
              type="primary"
              :loading="sendingMessage"
              :disabled="uploadingMessageAttachments"
              @click="submitMessage"
            >
              发送消息
            </el-button>
            <RouterLink :to="buildOrderDetailLink(activeConversation.id)">进入订单详情继续沟通</RouterLink>
          </div>
        </template>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, OrderConversationDetailRecord, OrderRecord } from '@rbac/api-common';
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalPageNotice,
  buildPetPalDeskHandoffQuery,
  getPetPalDeskFocusRole,
  getPetPalQueryString,
  runPetPalSectionRetry,
  type PetPalRoleAwareSectionLoadState,
  type PetPalSectionLoadState,
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

type DraftMessageAttachment = {
  fileId: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
};

type ConversationSummary = {
  id: string;
  orderId: string;
  ownerUnreadCount: number;
  caregiverUnreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string;
  updatedAt: string;
};

type MessageDraftState = {
  content: string;
  attachments: DraftMessageAttachment[];
};

type ThreadRecoveryStage = 'upload' | 'send';

type ThreadRecoveryState = {
  stage: ThreadRecoveryStage;
  message: string;
};

const MAX_MESSAGE_ATTACHMENTS = 3;
const MAX_MESSAGE_ATTACHMENT_SIZE = 8 * 1024 * 1024;
const IMAGE_ATTACHMENT_URL_RE = /\.(png|jpe?g|gif|webp|bmp|svg)(?:$|[?#])/i;

const route = useRoute();
const ownerOrders = ref<OrderRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const role = ref<'owner' | 'caregiver'>('owner');
const selectedOrderId = ref('');
const activeThread = ref<OrderConversationDetailRecord | null>(null);
const activeThreadState = ref<PetPalSectionLoadState>('idle');
const messageContent = ref('');
const messageAttachments = ref<DraftMessageAttachment[]>([]);
const messageDrafts = ref<Record<string, MessageDraftState>>({});
const messageRecoveries = ref<Record<string, ThreadRecoveryState>>({});
const uploadingMessageAttachments = ref(false);
const messageUploadProgress = ref<number | null>(null);
const sendingMessage = ref(false);
const messageAttachmentInputRef = ref<HTMLInputElement | null>(null);
const ownerState = ref<PetPalRoleAwareSectionLoadState>('idle');
const caregiverState = ref<PetPalRoleAwareSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'owner' | 'caregiver' | 'thread'>('');
let activeThreadRequestVersion = 0;

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
const composerBusy = computed(() => uploadingMessageAttachments.value || sendingMessage.value);
const currentThreadRecovery = computed(() =>
  activeConversation.value ? messageRecoveries.value[activeConversation.value.id] ?? null : null);
const activeThreadUnreadCount = computed(() =>
  activeThread.value
    ? getPetPalConversationUnreadCount(activeThread.value, role.value)
    : activeConversation.value
      ? threadUnread(activeConversation.value)
      : 0);
const messageAttachmentSlotsLeft = computed(() =>
  Math.max(0, MAX_MESSAGE_ATTACHMENTS - messageAttachments.value.length));
const pageActions = computed(() => [
  {
    label: '提醒中心',
    to: buildRemindersLink(
      role.value === 'caregiver'
        ? '这里已经回到照料者侧待办，可继续处理服务、履约或跨订单沟通。'
        : '这里已经回到主人侧待办，可继续处理宠物、订单或跨订单沟通。',
      role.value,
    ),
    tone: 'secondary' as const,
  },
]);
const heroStats = computed(() => [
  { label: '主人会话', value: String(ownerOrders.value.length), hint: '按主人视角聚合' },
  { label: '照料者会话', value: String(caregiverOrders.value.length), hint: '按照料者视角聚合' },
  { label: '当前视角未读', value: String(conversations.value.reduce((sum, item) => sum + threadUnread(item), 0)), hint: '可先标记已读再进入详情' },
  { label: '当前视角', value: role.value === 'owner' ? '主人' : '照料者', hint: '两端消息不再混排' },
]);
const pageNotice = computed(() => buildPetPalPageNotice({
  baseNotice: getPetPalQueryString(route.query, 'notice'),
  warnings: [
    ownerState.value === 'error' ? '主人侧会话暂未刷新完整，可只重试主人侧' : '',
    caregiverState.value === 'error' ? '照料者侧会话暂未刷新完整，可只重试照料者侧' : '',
  ],
  successTitle: '已回到消息中心',
  warningTitle: '消息中心还有部分内容未刷新完成',
}));

const threadUnread = (item: ConversationItem) => getPetPalConversationUnreadCount(item.conversation, role.value);

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

const cloneDraftAttachments = (attachments: DraftMessageAttachment[]) =>
  attachments.map((item) => ({
    fileId: item.fileId,
    url: item.url,
    name: item.name,
    size: item.size,
    mimeType: item.mimeType,
  }));

function buildRemindersLink(notice: string, focusRole: 'owner' | 'caregiver') {
  return {
    name: 'frontend-petpal-reminders',
    query: buildPetPalDeskHandoffQuery({
      notice,
      focusRole,
    }),
  };
}

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

function hasThreadDraft(orderId: string) {
  return Boolean(messageDrafts.value[orderId]);
}

function hasThreadRecovery(orderId: string) {
  return Boolean(messageRecoveries.value[orderId]);
}

function resetComposer() {
  messageContent.value = '';
  messageAttachments.value = [];
  messageUploadProgress.value = null;
  if (messageAttachmentInputRef.value) {
    messageAttachmentInputRef.value.value = '';
  }
}

function clearThreadDraft(orderId: string) {
  if (!messageDrafts.value[orderId]) {
    return;
  }

  const nextDrafts = { ...messageDrafts.value };
  delete nextDrafts[orderId];
  messageDrafts.value = nextDrafts;
}

function clearThreadRecovery(orderId: string) {
  if (!messageRecoveries.value[orderId]) {
    return;
  }

  const nextRecoveries = { ...messageRecoveries.value };
  delete nextRecoveries[orderId];
  messageRecoveries.value = nextRecoveries;
}

function setThreadRecovery(orderId: string, stage: ThreadRecoveryStage, message: string) {
  if (!orderId) {
    return;
  }

  messageRecoveries.value = {
    ...messageRecoveries.value,
    [orderId]: {
      stage,
      message,
    },
  };
}

function persistThreadDraft(orderId: string) {
  if (!orderId) {
    return;
  }

  const content = messageContent.value;
  const attachments = cloneDraftAttachments(messageAttachments.value);
  const hasDraft = content.trim().length > 0 || attachments.length > 0;
  if (!hasDraft) {
    clearThreadDraft(orderId);
    return;
  }

  messageDrafts.value = {
    ...messageDrafts.value,
    [orderId]: {
      content,
      attachments,
    },
  };
}

function restoreThreadDraft(orderId: string) {
  const draft = messageDrafts.value[orderId];
  messageContent.value = draft?.content ?? '';
  messageAttachments.value = draft ? cloneDraftAttachments(draft.attachments) : [];
  messageUploadProgress.value = null;
  if (messageAttachmentInputRef.value) {
    messageAttachmentInputRef.value.value = '';
  }
}

function toConversationSummary(conversation: ConversationSummary): ConversationSummary {
  return {
    id: conversation.id,
    orderId: conversation.orderId,
    ownerUnreadCount: conversation.ownerUnreadCount,
    caregiverUnreadCount: conversation.caregiverUnreadCount,
    lastMessageAt: conversation.lastMessageAt,
    lastMessagePreview: conversation.lastMessagePreview,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function patchConversationSummary(orderId: string, conversation: ConversationSummary) {
  const summary = toConversationSummary(conversation);
  ownerOrders.value = ownerOrders.value.map((item) =>
    item.id === orderId
      ? {
          ...item,
          conversation: summary,
        }
      : item);
  caregiverOrders.value = caregiverOrders.value.map((item) =>
    item.id === orderId
      ? {
          ...item,
          conversation: summary,
        }
      : item);
}

function patchActiveThreadSummary(conversation: ConversationSummary) {
  if (!activeThread.value || activeThread.value.orderId !== conversation.orderId) {
    return;
  }
  activeThread.value = {
    ...activeThread.value,
    ...toConversationSummary(conversation),
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

async function loadActiveThread(orderId: string) {
  const requestVersion = ++activeThreadRequestVersion;
  activeThread.value = null;
  activeThreadState.value = 'idle';

  try {
    const conversation = await api.petpal.orders.messages(orderId);
    if (requestVersion !== activeThreadRequestVersion || activeConversation.value?.id !== orderId) {
      return;
    }
    activeThread.value = conversation;
    activeThreadState.value = 'ready';
    patchConversationSummary(orderId, conversation);
  } catch {
    if (requestVersion !== activeThreadRequestVersion || activeConversation.value?.id !== orderId) {
      return;
    }
    activeThread.value = null;
    activeThreadState.value = 'error';
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

async function retryActiveThread() {
  if (!activeConversation.value) {
    return;
  }
  await runPetPalSectionRetry({
    key: 'thread',
    sectionReloadingKey,
    reload: () => loadActiveThread(activeConversation.value!.id),
    getState: () => activeThreadState.value,
    successMessage: '当前会话已刷新',
    swallowError: true,
  });
}

async function markThreadRead(orderId: string) {
  try {
    const summary = await api.petpal.orders.markMessagesRead(orderId);
    patchConversationSummary(orderId, summary);
    patchActiveThreadSummary(summary);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '标记已读失败'));
  }
}

function triggerMessageAttachmentInput() {
  if (!activeConversation.value || activeThreadState.value !== 'ready' || composerBusy.value || messageAttachmentSlotsLeft.value <= 0) {
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

function retryCurrentThreadRecovery() {
  if (!activeConversation.value || !currentThreadRecovery.value || composerBusy.value) {
    return;
  }

  if (currentThreadRecovery.value.stage === 'send') {
    void submitMessage();
    return;
  }

  triggerMessageAttachmentInput();
}

async function handleMessageAttachmentChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selectedFiles = Array.from(input.files ?? []);
  input.value = '';

  const currentOrderId = activeConversation.value?.id;
  if (!currentOrderId || activeThreadState.value !== 'ready' || !selectedFiles.length) {
    return;
  }

  const limitedFiles = selectedFiles.slice(0, messageAttachmentSlotsLeft.value);
  if (selectedFiles.length > limitedFiles.length) {
    ElMessage.warning(`一次最多还能添加 ${messageAttachmentSlotsLeft.value} 张图片`);
  }

  const validFiles = limitedFiles.filter((file) =>
    (!file.type || file.type.startsWith('image/')) && file.size <= MAX_MESSAGE_ATTACHMENT_SIZE);

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
          tag1: 'petpal-order-message',
          tag2: currentOrderId,
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
    clearThreadRecovery(currentOrderId);
  } catch (error: unknown) {
    const message = `${getErrorMessage(error, '上传消息图片失败')}，已完成的图片仍会保留在当前草稿中。`;
    setThreadRecovery(currentOrderId, 'upload', message);
    ElMessage.error(message);
  } finally {
    uploadingMessageAttachments.value = false;
    messageUploadProgress.value = null;
  }
}

async function submitMessage() {
  const orderId = activeConversation.value?.id;
  const content = messageContent.value.trim();
  const mediaUrls = messageAttachments.value.map((item) => item.url);

  if (!orderId || activeThreadState.value !== 'ready') {
    return;
  }
  if (!content && !mediaUrls.length) {
    ElMessage.warning('请先填写消息内容或上传图片');
    return;
  }

  sendingMessage.value = true;
  try {
    const result = await api.petpal.orders.sendMessage(orderId, {
      content: content || undefined,
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    });
    activeThread.value = result;
    activeThreadState.value = 'ready';
    patchConversationSummary(orderId, result);
    clearThreadDraft(orderId);
    clearThreadRecovery(orderId);
    resetComposer();
    ElMessage.success('消息已发送');
  } catch (error: unknown) {
    const message = `${getErrorMessage(error, '发送消息失败')}，当前输入和已上传图片都已保留。`;
    setThreadRecovery(orderId, 'send', message);
    ElMessage.error(message);
  } finally {
    sendingMessage.value = false;
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

watch(
  messageContent,
  () => {
    if (activeConversation.value?.id) {
      persistThreadDraft(activeConversation.value.id);
    }
  },
);

watch(
  messageAttachments,
  () => {
    if (activeConversation.value?.id) {
      persistThreadDraft(activeConversation.value.id);
    }
  },
  { deep: true },
);

watch(
  () => activeConversation.value?.id || '',
  (orderId, previousOrderId) => {
    if (orderId === previousOrderId) {
      return;
    }
    if (previousOrderId) {
      persistThreadDraft(previousOrderId);
    }
    if (!orderId) {
      activeThreadRequestVersion += 1;
      activeThread.value = null;
      activeThreadState.value = 'idle';
      resetComposer();
      return;
    }
    restoreThreadDraft(orderId);
    void loadActiveThread(orderId);
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

.petpal-conversation-row:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.petpal-conversation-row.is-active {
  color: #2563eb;
}

.petpal-conversation-row.is-focused {
  margin-inline: -10px;
  padding-inline: 10px;
  background: rgba(244, 248, 255, 0.9);
}

.petpal-conversation-row :deep(.petpal-pill.is-warning) {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

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
