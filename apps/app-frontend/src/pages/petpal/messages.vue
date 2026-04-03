<script setup lang="ts">
import type { CaregiverOrderRecord, OrderConversationDetailRecord, OrderConversationRecord, OrderRecord } from '@rbac/api-common'
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { getOrderMessages, listCaregiverOrders, listOrders, markOrderMessagesRead, sendOrderMessage } from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import PetpalSegmented from './rebuild/petpal-segmented.vue'
import {
  describeConversation,
  getErrorMessage,
  helpers,
  isCaregiverEnabled,
  openLoginPage,
  openOrderDetailPage,
  PETPAL_NOTIFICATIONS_PAGE,
  stopPullDown,
  toast,
} from './rebuild/shared'

type FilterValue = 'ALL' | 'UNREAD'
type RoleValue = 'owner' | 'caregiver'
type ConversationSource = OrderRecord | CaregiverOrderRecord
type UploadedMessageAttachment = {
  fileId: string
  url: string
  name: string
  mimeType: string
  size: number
  uploadedAt: string
}
type MessageDraftState = {
  content: string
  attachments: UploadedMessageAttachment[]
}

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)
const upload = useManagedAttachmentUpload({ maxCount: 3, maxSizeMb: 8 })

const loading = ref(false)
const threadLoading = ref(false)
const threadError = ref('')
const sendingMessage = ref(false)
const role = ref<RoleValue>('owner')
const filter = ref<FilterValue>('UNREAD')
const ownerOrders = ref<OrderRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])
const selectedOrderId = ref('')
const conversation = ref<OrderConversationDetailRecord | null>(null)
const messageText = ref('')
const messageAttachments = ref<UploadedMessageAttachment[]>([])
const messageDrafts = ref<Record<string, MessageDraftState>>({})

let threadRequestVersion = 0

const caregiverEnabled = computed(() => isCaregiverEnabled(userInfo.value))
const roleOptions = computed(() => {
  const options = [
    {
      label: '主人',
      value: 'owner',
      badge: ownerOrders.value.filter(item => item.conversation).length,
    },
  ]

  if (caregiverEnabled.value) {
    options.push({
      label: '照料者',
      value: 'caregiver',
      badge: caregiverOrders.value.filter(item => item.conversation).length,
    })
  }

  return options
})

const currentOrders = computed<ConversationSource[]>(() =>
  role.value === 'owner' ? ownerOrders.value : caregiverOrders.value)

const conversations = computed(() => {
  return currentOrders.value
    .filter(item => item.conversation)
    .map(item => ({
      order: item,
      summary: describeConversation(item, role.value),
    }))
    .sort((left, right) => {
      const unreadGap = right.summary.unread - left.summary.unread
      if (unreadGap !== 0) {
        return unreadGap
      }

      const leftTime = left.order.conversation?.lastMessageAt || left.order.updatedAt
      const rightTime = right.order.conversation?.lastMessageAt || right.order.updatedAt
      return new Date(rightTime).getTime() - new Date(leftTime).getTime()
    })
})

const visibleRows = computed(() => {
  return conversations.value.filter(item => filter.value === 'ALL' || item.summary.unread > 0)
})

const priorityRow = computed(() => visibleRows.value[0] ?? null)
const currentThreadOrder = computed(() => currentOrders.value.find(item => item.id === selectedOrderId.value) ?? null)
const currentThreadSummary = computed(() =>
  currentThreadOrder.value ? describeConversation(currentThreadOrder.value, role.value) : null)
const conversationMessages = computed(() => conversation.value?.messages || [])
const messageAttachmentSlotsLeft = computed(() => Math.max(0, 3 - messageAttachments.value.length))
const uploadingMessageAttachments = computed(() => upload.uploading.value)
const composerBusy = computed(() => upload.uploading.value || sendingMessage.value)

const cloneDraftAttachments = (attachments: UploadedMessageAttachment[]) =>
  attachments.map(item => ({
    fileId: item.fileId,
    url: item.url,
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
    uploadedAt: item.uploadedAt,
  }))

function resetComposer() {
  messageText.value = ''
  messageAttachments.value = []
}

function hasThreadDraft(orderId: string) {
  return Boolean(messageDrafts.value[orderId])
}

function clearThreadState() {
  threadRequestVersion += 1
  threadLoading.value = false
  threadError.value = ''
  conversation.value = null
  resetComposer()
}

function clearThreadDraft(orderId: string) {
  if (!messageDrafts.value[orderId]) {
    return
  }

  const nextDrafts = { ...messageDrafts.value }
  delete nextDrafts[orderId]
  messageDrafts.value = nextDrafts
}

function persistThreadDraft(orderId: string) {
  if (!orderId) {
    return
  }

  const content = messageText.value
  const attachments = cloneDraftAttachments(messageAttachments.value)
  const hasDraft = content.trim().length > 0 || attachments.length > 0
  if (!hasDraft) {
    clearThreadDraft(orderId)
    return
  }

  messageDrafts.value = {
    ...messageDrafts.value,
    [orderId]: {
      content,
      attachments,
    },
  }
}

function restoreThreadDraft(orderId: string) {
  const draft = messageDrafts.value[orderId]
  messageText.value = draft?.content || ''
  messageAttachments.value = draft ? cloneDraftAttachments(draft.attachments) : []
}

function patchConversationSummary(orderId: string, nextConversation: OrderConversationRecord) {
  ownerOrders.value = ownerOrders.value.map((item) =>
    item.id === orderId
      ? {
          ...item,
          conversation: nextConversation,
        }
      : item)

  caregiverOrders.value = caregiverOrders.value.map((item) =>
    item.id === orderId
      ? {
          ...item,
          conversation: nextConversation,
        }
      : item)
}

function syncSelectedOrderId() {
  const availableIds = conversations.value.map(item => item.order.id)
  if (selectedOrderId.value && availableIds.includes(selectedOrderId.value)) {
    return
  }
  selectedOrderId.value = visibleRows.value[0]?.order.id || conversations.value[0]?.order.id || ''
}

async function loadThread(orderId: string, options?: { resetComposer?: boolean }) {
  const requestVersion = ++threadRequestVersion
  threadLoading.value = true
  threadError.value = ''
  conversation.value = null

  if (options?.resetComposer) {
    resetComposer()
  }

  try {
    const nextConversation = await getOrderMessages(orderId)
    if (requestVersion !== threadRequestVersion || selectedOrderId.value !== orderId) {
      return
    }

    conversation.value = nextConversation
    patchConversationSummary(orderId, nextConversation)
  }
  catch (error: unknown) {
    if (requestVersion !== threadRequestVersion || selectedOrderId.value !== orderId) {
      return
    }

    threadError.value = getErrorMessage(error, '加载当前会话失败')
  }
  finally {
    if (requestVersion === threadRequestVersion) {
      threadLoading.value = false
    }
  }
}

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      tokenStore.bootstrap(),
      userStore.fetchUserInfo().catch(() => undefined),
      notificationStore.refreshNotifications().catch(() => undefined),
    ])

    const nextCaregiverEnabled = isCaregiverEnabled(userInfo.value)
    const [nextOwnerOrders, nextCaregiverOrders] = await Promise.all([
      listOrders().catch(() => []),
      nextCaregiverEnabled
        ? listCaregiverOrders({ page: 1, pageSize: 50 }).then(result => result.items).catch(() => [])
        : Promise.resolve([] as CaregiverOrderRecord[]),
    ])

    ownerOrders.value = nextOwnerOrders
    caregiverOrders.value = nextCaregiverOrders

    if (!nextCaregiverEnabled && role.value === 'caregiver') {
      role.value = 'owner'
    }

    const previousSelectedOrderId = selectedOrderId.value
    syncSelectedOrderId()

    if (selectedOrderId.value && selectedOrderId.value === previousSelectedOrderId) {
      await loadThread(selectedOrderId.value)
    }
    else if (!selectedOrderId.value) {
      clearThreadState()
    }
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载消息中心失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openPriorityThread() {
  if (!priorityRow.value) {
    return
  }
  selectedOrderId.value = priorityRow.value.order.id
}

function openSelectedOrder() {
  if (!currentThreadOrder.value) {
    return
  }
  openOrderDetailPage(currentThreadOrder.value.id, 'chat')
}

function previewImages(urls: string[], current?: string) {
  if (!urls.length) {
    return
  }

  uni.previewImage({
    urls,
    current: current || urls[0],
  })
}

async function markCurrentThreadRead() {
  if (!currentThreadOrder.value || !currentThreadSummary.value?.unread) {
    return
  }

  try {
    const nextConversation = await markOrderMessagesRead(currentThreadOrder.value.id)
    patchConversationSummary(currentThreadOrder.value.id, nextConversation)
    if (conversation.value?.orderId === currentThreadOrder.value.id) {
      conversation.value = {
        ...conversation.value,
        ...nextConversation,
      }
    }
    toast('已标记为已读', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '标记已读失败'))
  }
}

async function uploadMessageMaterials() {
  if (!currentThreadOrder.value) {
    toast('请先选择一条会话')
    return
  }
  if (messageAttachmentSlotsLeft.value <= 0) {
    toast('消息附件最多上传 3 张')
    return
  }

  try {
    const files = await upload.selectAndUploadAttachments({
      tag1: 'petpal-order-message',
      tag2: currentThreadOrder.value.id,
      maxCount: messageAttachmentSlotsLeft.value,
    })
    messageAttachments.value = [...messageAttachments.value, ...files]
    toast(files.length === 1 ? '消息图片已上传' : `已上传 ${files.length} 张图片`, 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '上传失败'))
  }
}

function removeMessageAttachment(fileId: string) {
  messageAttachments.value = messageAttachments.value.filter(item => item.fileId !== fileId)
}

async function handleSendMessage() {
  const content = messageText.value.trim()
  const mediaUrls = messageAttachments.value.map(item => item.url)
  if (!currentThreadOrder.value) {
    toast('请先选择一条会话')
    return
  }
  if (!content && !mediaUrls.length) {
    toast('请先输入消息或上传图片')
    return
  }

  sendingMessage.value = true
  try {
    const nextConversation = await sendOrderMessage(currentThreadOrder.value.id, {
      content: content || undefined,
      mediaUrls,
    })
    conversation.value = nextConversation
    patchConversationSummary(currentThreadOrder.value.id, nextConversation)
    clearThreadDraft(currentThreadOrder.value.id)
    resetComposer()
    toast('消息已发送', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '发送消息失败'))
  }
  finally {
    sendingMessage.value = false
  }
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})

watch(messageText, () => {
  if (currentThreadOrder.value?.id) {
    persistThreadDraft(currentThreadOrder.value.id)
  }
})

watch(messageAttachments, () => {
  if (currentThreadOrder.value?.id) {
    persistThreadDraft(currentThreadOrder.value.id)
  }
}, { deep: true })

watch(role, () => {
  syncSelectedOrderId()
})

watch(filter, () => {
  syncSelectedOrderId()
})

watch(selectedOrderId, (value, previousValue) => {
  if (value === previousValue) {
    return
  }

  if (previousValue) {
    persistThreadDraft(previousValue)
  }

  if (!value) {
    clearThreadState()
    return
  }

  restoreThreadDraft(value)
  void loadThread(value)
})
</script>

<template>
  <PetpalPage
    title="消息"
    subtitle="先统一处理跨订单沟通，再决定是否回到某一笔订单的完整上下文。"
    eyebrow="Messages"
    :with-tabbar="true"
  >
    <template #bar>
      <button
        v-if="tokenStore.hasLogin"
        class="petpal-icon-btn"
        hover-class="none"
        @click="openNotifications"
      >
        通知 {{ notificationStore.unreadCount }}
      </button>
    </template>

    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看订单沟通">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection
        v-if="priorityRow"
        tone="accent"
        title="先处理这条"
        :subtitle="priorityRow.summary.unread ? `${priorityRow.summary.unread} 条未读` : '最近一条会话'"
      >
        <view class="petpal-banner">
          <text class="petpal-banner__eyebrow">Priority Thread</text>
          <text class="petpal-banner__title">{{ priorityRow.order.orderNo }}</text>
          <text class="petpal-banner__meta">{{ helpers.serviceTypeLabels[priorityRow.order.serviceType] }} · {{ helpers.getOrderStatusLabel(priorityRow.order.orderStatus) }}</text>
          <text class="petpal-note">{{ priorityRow.summary.preview }}</text>
          <text class="petpal-note">{{ priorityRow.summary.meta }}</text>
          <text v-if="hasThreadDraft(priorityRow.order.id)" class="petpal-note">这条线程还有未发送草稿。</text>
        </view>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openPriorityThread">打开线程</button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(priorityRow.order.id, 'chat')">看订单</button>
        </view>
      </PetpalSection>

      <PetpalSection
        v-if="roleOptions.length > 1"
        title="切换视角"
        subtitle="主人和照料者会话分开看，避免把两条任务线混在一起。"
      >
        <PetpalSegmented v-model="role" :options="roleOptions" />
      </PetpalSection>

      <PetpalSection title="筛选会话" subtitle="未读优先，需要回看全部时再切到全部。">
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '未读', value: 'UNREAD', badge: conversations.filter(item => item.summary.unread > 0).length },
            { label: '全部', value: 'ALL', badge: conversations.length },
          ]"
        />
      </PetpalSection>

      <PetpalSection
        title="当前线程"
        :subtitle="currentThreadOrder ? `${role === 'owner' ? '主人侧' : '照料者侧'}当前正在处理的会话` : '先从下面会话队列里选中一条线程。'"
      >
        <template v-if="currentThreadOrder">
          <view class="petpal-banner">
            <text class="petpal-banner__eyebrow">Current Thread</text>
            <text class="petpal-banner__title">{{ currentThreadOrder.orderNo }}</text>
            <text class="petpal-banner__meta">{{ helpers.serviceTypeLabels[currentThreadOrder.serviceType] }} · {{ helpers.getOrderStatusLabel(currentThreadOrder.orderStatus) }}</text>
            <text class="petpal-note">{{ currentThreadSummary?.preview }}</text>
            <text class="petpal-note">{{ currentThreadSummary?.meta }}</text>
            <text v-if="hasThreadDraft(currentThreadOrder.id)" class="petpal-note">当前线程已有未发送草稿，切换会话后会继续保留。</text>
          </view>
          <view class="message-thread__stats">
            <view class="message-thread__stat">
              <text class="message-thread__stat-label">未读</text>
              <text class="message-thread__stat-value">{{ currentThreadSummary?.unread || 0 }}</text>
            </view>
            <view class="message-thread__stat">
              <text class="message-thread__stat-label">消息数</text>
              <text class="message-thread__stat-value">{{ conversationMessages.length }}</text>
            </view>
          </view>
          <view class="petpal-action-row">
            <button
              v-if="currentThreadSummary?.unread"
              class="petpal-btn petpal-btn--secondary"
              hover-class="none"
              @click="markCurrentThreadRead"
            >
              标记已读
            </button>
            <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="openSelectedOrder">看订单</button>
          </view>
        </template>
        <PetpalEmpty
          v-else
          :title="filter === 'UNREAD' ? '当前没有未读会话' : '当前没有会话'"
          :description="filter === 'UNREAD' ? '可以切到“全部”回看最近沟通。' : '等订单产生沟通后，会显示在这里。'"
        />
      </PetpalSection>

      <PetpalSection title="消息记录" subtitle="先看最近上下文，再决定是否立即回复。">
        <PetpalEmpty v-if="threadLoading" title="正在加载当前线程" description="正在拉取这笔订单的沟通记录。"/>
        <PetpalEmpty v-else-if="threadError" :title="threadError" description="可以重试当前线程，或先进入订单详情继续沟通。">
          <view class="petpal-action-row">
            <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="selectedOrderId && loadThread(selectedOrderId, { resetComposer: false })">重试线程</button>
            <button v-if="currentThreadOrder" class="petpal-btn petpal-btn--ghost" hover-class="none" @click="openSelectedOrder">看订单</button>
          </view>
        </PetpalEmpty>
        <template v-else-if="conversationMessages.length">
          <view class="detail-chat">
            <view
              v-for="item in conversationMessages"
              :key="item.id"
              :class="[
                'detail-chat__bubble',
                item.senderUserId === userInfo.id ? 'detail-chat__bubble--own' : '',
              ]"
            >
              <text class="detail-chat__meta">{{ item.senderRole === 'OWNER' ? '宠物主人' : '照料者' }} · {{ helpers.formatDateTime(item.createdAt) }}</text>
              <text v-if="item.content" class="detail-chat__content">{{ item.content }}</text>
              <text v-else class="detail-chat__content">发送了一条附件消息</text>
              <view v-if="item.mediaUrls.length" class="detail-chat__attachments">
                <image
                  v-for="url in item.mediaUrls"
                  :key="url"
                  class="detail-chat__attachment-image"
                  :src="url"
                  mode="aspectFill"
                  @click="previewImages(item.mediaUrls, url)"
                />
              </view>
            </view>
          </view>
        </template>
        <PetpalEmpty
          v-else
          title="还没有沟通记录"
          description="可以直接在下面发出第一条消息或图片。"
        />
      </PetpalSection>

      <PetpalSection title="直接回复" subtitle="不用每次都先进订单详情，当前线程可以直接回一句或补图片。">
        <template v-if="currentThreadOrder">
          <view class="petpal-form">
            <template v-if="messageAttachments.length">
              <view class="detail-chat__composer-meta">
                <text class="petpal-note">已上传 {{ messageAttachments.length }}/3 张，发送前可继续预览或移除。</text>
              </view>
              <view class="detail-chat__attachments">
                <view v-for="item in messageAttachments" :key="item.fileId" class="detail-chat__composer-attachment">
                  <image
                    class="detail-chat__attachment-image"
                    :src="item.url"
                    mode="aspectFill"
                    @click="previewImages(messageAttachments.map(current => current.url), item.url)"
                  />
                  <button class="petpal-btn petpal-btn--ghost detail-chat__remove-btn" hover-class="none" @click="removeMessageAttachment(item.fileId)">
                    移除
                  </button>
                </view>
              </view>
            </template>
            <textarea
              v-model="messageText"
              class="petpal-textarea"
              :maxlength="280"
              placeholder="输入要沟通的内容"
            />
            <view class="petpal-action-row">
              <button
                class="petpal-btn petpal-btn--secondary"
                hover-class="none"
                :disabled="composerBusy || messageAttachmentSlotsLeft <= 0"
                @click="uploadMessageMaterials"
              >
                {{ uploadingMessageAttachments ? '上传中...' : `上传图片${messageAttachmentSlotsLeft ? `（剩余 ${messageAttachmentSlotsLeft} 张）` : ''}` }}
              </button>
              <button
                class="petpal-btn petpal-btn--primary"
                hover-class="none"
                :disabled="uploadingMessageAttachments"
                @click="handleSendMessage"
              >
                {{ sendingMessage ? '发送中...' : '发送消息' }}
              </button>
            </view>
          </view>
        </template>
        <PetpalEmpty
          v-else
          title="先选中一条会话"
          description="选中会话后，这里才会显示当前线程的快捷回复区。"
        />
      </PetpalSection>

      <PetpalSection :title="filter === 'UNREAD' ? '未读会话' : '全部会话'" subtitle="点开线程处理，再决定是否回订单详情。">
        <template v-if="visibleRows.length">
          <button
            v-for="item in visibleRows"
            :key="item.order.id"
            :class="['petpal-row-btn', item.order.id === selectedOrderId ? 'petpal-row-btn--active' : '']"
            hover-class="none"
            :disabled="composerBusy"
            @click="selectedOrderId = item.order.id"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.order.orderNo }}</text>
              <text class="petpal-row__meta">{{ item.summary.preview }}</text>
              <text class="petpal-row__hint">{{ hasThreadDraft(item.order.id) ? `${item.summary.meta} · 草稿待发` : item.summary.meta }}</text>
            </view>
            <text class="petpal-row__value">{{ item.summary.unread ? `${item.summary.unread} 未读` : '打开' }}</text>
          </button>
        </template>
        <PetpalEmpty
          v-else
          :title="filter === 'UNREAD' ? '当前没有未读会话' : '当前没有会话'"
          :description="filter === 'UNREAD' ? '如果要回看最近会话，可以切到“全部”。' : '等订单产生沟通后，会显示在这里。'"
        />
      </PetpalSection>
    </template>
  </PetpalPage>
</template>

<style scoped lang="scss">
.petpal-row-btn--active {
  border-color: rgba(36, 84, 211, 0.22);
  background: rgba(36, 84, 211, 0.08);
}

.message-thread__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.message-thread__stat {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(255, 253, 249, 0.92);
  border: 1rpx solid rgba(143, 114, 84, 0.14);
}

.message-thread__stat-label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.message-thread__stat-value {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 600;
}

.detail-chat {
  display: grid;
  gap: 14rpx;
}

.detail-chat__bubble {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 22rpx;
  background: rgba(255, 253, 249, 0.96);
  border: 1rpx solid #eadfd3;
}

.detail-chat__bubble--own {
  background: rgba(36, 84, 211, 0.08);
  border-color: rgba(36, 84, 211, 0.18);
}

.detail-chat__meta {
  color: var(--app-text-muted);
  font-size: 21rpx;
}

.detail-chat__content {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.68;
}

.detail-chat__attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.detail-chat__attachment-image {
  width: 172rpx;
  height: 172rpx;
  border-radius: 20rpx;
  background: rgba(36, 84, 211, 0.08);
}

.detail-chat__composer-meta {
  margin-bottom: 4rpx;
}

.detail-chat__composer-attachment {
  display: grid;
  gap: 10rpx;
}

.detail-chat__remove-btn {
  min-width: 0;
}
</style>
