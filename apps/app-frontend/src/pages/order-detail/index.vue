<script setup lang="ts">
import {
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_MB,
  PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
  type ComplaintRecord,
  type OrderConversationDetailRecord,
  type OrderDetailRecord,
  type OrderRefundProgressRecord,
  type ServiceLogType,
} from '@rbac/api-common'
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import {
  acceptCaregiverOrder,
  addCaregiverServiceLog,
  checkInCaregiverOrder,
  checkOutCaregiverOrder,
  confirmOrderComplete,
  getOrderComplaints,
  getOrderDetail,
  getOrderMessages,
  getOrderRefundProgress,
  markOrderMessagesRead,
  sendOrderMessage,
} from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import { useTokenStore, useUserStore } from '@/store'
import PetpalEmpty from '../petpal/rebuild/petpal-empty.vue'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import PetpalSegmented from '../petpal/rebuild/petpal-segmented.vue'
import {
  getErrorMessage,
  helpers,
  openLoginPage,
  openOrderComplaintPage,
  openOrderDetailPage,
  openOrderReviewPage,
  serviceLogOptions,
  stopPullDown,
  toast,
} from '../petpal/rebuild/shared'
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
} from '../petpal/message-composer-state'

type DetailTab = 'overview' | 'chat' | 'service' | 'aftersales'
type UploadedMessageAttachment = PetPalMessageDraftAttachment

const tokenStore = useTokenStore()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const upload = useManagedAttachmentUpload({
  maxCount: PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT,
  maxSizeMb: PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_SIZE_MB,
})

const loading = ref(false)
const actionLoading = ref(false)
const orderId = ref('')
const activeTab = ref<DetailTab>('overview')
const order = ref<OrderDetailRecord | null>(null)
const refundProgress = ref<OrderRefundProgressRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])
const conversation = ref<OrderConversationDetailRecord | null>(null)
const messageText = ref('')
const messageAttachments = ref<UploadedMessageAttachment[]>([])
const messageComposerScope = ref<PetPalMessageComposerScope>('shared')
const serviceLogType = ref<ServiceLogType>('NOTE')
const serviceLogNote = ref('')

const isOwnerView = computed(() => Boolean(userInfo.value.id && order.value?.ownerId === userInfo.value.id))
const roleLabel = computed(() => (isOwnerView.value ? '主人视角' : '照料者视角'))
const conversationMessages = computed(() => conversation.value?.messages || [])
const messageAttachmentSlotsLeft = computed(() =>
  Math.max(0, PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT - messageAttachments.value.length))
const uploadingMessageAttachments = computed(() => upload.uploading.value)
const currentMessageRecovery = computed(() => {
  const identity = buildMessageComposerIdentity(orderId.value)
  return identity ? getPetPalMessageRecovery(identity) : null
})
const currentStatusLabel = computed(() => order.value ? helpers.getOrderStatusLabel(order.value.orderStatus) : '')
const recentTimeline = computed(() => order.value?.timeline.slice().reverse().slice(0, 6) || [])
const visibleServiceLogs = computed(() => order.value?.serviceLogs.slice().reverse() || [])
const focusHint = computed(() => {
  if (!order.value) {
    return ''
  }
  if (isOwnerView.value) {
    if (order.value.orderStatus === 'PENDING_ACCEPT') return '等待照料者接单，当前只需回看沟通和支付状态。'
    if (order.value.orderStatus === 'SERVING') return '当前服务进行中，重点查看回传记录并在结束后确认完成。'
    if (order.value.orderStatus === 'COMPLETED' && !order.value.review) return '订单已完成，下一步是评价或结束本次服务。'
    if (['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.value.orderStatus)) return '当前订单已进入售后阶段，重点查看退款和投诉进展。'
    return '当前订单没有额外阻塞动作，可按需查看沟通和服务记录。'
  }

  if (order.value.orderStatus === 'PENDING_ACCEPT') return '当前最重要的是接单，接单后再进入签到和服务回传。'
  if (order.value.orderStatus === 'ACCEPTED') return '已接单，下一步是按约定时间签到。'
  if (order.value.orderStatus === 'SERVING') return '服务中，持续补充服务记录并在结束时签退。'
  return '当前订单以查看记录为主，详细动作按状态决定。'
})

const tabOptions = computed(() => [
  { label: '概览', value: 'overview' },
  { label: '沟通', value: 'chat', badge: conversationMessages.value.length ? conversationMessages.value.length : '' },
  { label: '服务', value: 'service', badge: order.value?.serviceLogs.length || '' },
  { label: '售后', value: 'aftersales', badge: complaints.value.length || '' },
])

function resetComposer() {
  messageText.value = ''
  messageAttachments.value = []
}

function buildMessageComposerIdentity(
  currentOrderId: string,
  scope?: PetPalMessageComposerScope,
): PetPalMessageComposerIdentity | null {
  const normalizedOrderId = currentOrderId.trim()
  const userId = userInfo.value.id?.trim()
  if (!normalizedOrderId || !userId) {
    return null
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
      }
}

function restoreComposerState(currentOrderId: string) {
  const identity = buildMessageComposerIdentity(currentOrderId, messageComposerScope.value)
  const draft = identity ? restorePetPalMessageDraft(identity) : null
  messageText.value = draft?.content || ''
  messageAttachments.value = draft?.attachments || []
}

function persistCurrentMessageDraft(
  currentOrderId: string,
  scope: PetPalMessageComposerScope = messageComposerScope.value,
) {
  const identity = buildMessageComposerIdentity(currentOrderId, scope)
  if (!identity) {
    return
  }

  persistPetPalMessageDraft(identity, messageText.value, messageAttachments.value)
}

function clearCurrentMessageDraft(
  currentOrderId: string,
  scope: PetPalMessageComposerScope = messageComposerScope.value,
) {
  const identity = buildMessageComposerIdentity(currentOrderId, scope)
  if (!identity) {
    return
  }

  clearPetPalMessageDraft(identity)
}

function clearCurrentMessageRecovery(
  currentOrderId: string,
  scope: PetPalMessageComposerScope = messageComposerScope.value,
) {
  const identity = buildMessageComposerIdentity(currentOrderId, scope)
  if (!identity) {
    return
  }

  clearPetPalMessageRecovery(identity)
}

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !orderId.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    const [detailResult, refundResult, complaintsResult, messagesResult] = await Promise.all([
      getOrderDetail(orderId.value),
      getOrderRefundProgress(orderId.value).catch(() => null),
      getOrderComplaints(orderId.value).catch(() => []),
      getOrderMessages(orderId.value).catch(() => null),
    ])
    order.value = detailResult
    messageComposerScope.value = detailResult.ownerId === userInfo.value.id ? 'owner' : 'caregiver'
    refundProgress.value = refundResult
    complaints.value = complaintsResult
    conversation.value = messagesResult

    if (activeTab.value === 'chat') {
      await markOrderMessagesRead(orderId.value).catch(() => undefined)
    }
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载订单详情失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

async function withAction(task: () => Promise<void>, successText: string) {
  if (actionLoading.value || !order.value) {
    return
  }
  actionLoading.value = true
  try {
    await task()
    toast(successText, 'success')
    await loadPage()
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '操作失败'))
  }
  finally {
    actionLoading.value = false
  }
}

function openComplaint() {
  if (!order.value) return
  openOrderComplaintPage(order.value.id)
}

function openReview() {
  if (!order.value) return
  openOrderReviewPage(order.value.id)
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

async function uploadMessageMaterials() {
  if (upload.uploading.value || actionLoading.value) {
    return
  }
  if (!orderId.value) {
    toast('缺少订单信息，暂时无法上传消息图片')
    return
  }
  if (messageAttachmentSlotsLeft.value <= 0) {
    toast(`消息附件最多上传 ${PETPAL_ORDER_MESSAGE_ATTACHMENT_MAX_COUNT} 张`)
    return
  }

  try {
    const files = await upload.selectAndUploadAttachments({
      tag1: PETPAL_ORDER_MESSAGE_ATTACHMENT_TAG,
      tag2: orderId.value,
      maxCount: messageAttachmentSlotsLeft.value,
    })
    messageAttachments.value = [...messageAttachments.value, ...files]
    clearCurrentMessageRecovery(orderId.value)
    toast(files.length === 1 ? '消息图片已上传' : `已上传 ${files.length} 张图片`, 'success')
  }
  catch (error: unknown) {
    const message = `${getErrorMessage(error, '上传失败')}，已完成的图片仍会保留在当前草稿中。`
    const identity = buildMessageComposerIdentity(orderId.value, messageComposerScope.value)
    if (identity) {
      setPetPalMessageRecovery(identity, 'upload', message)
    }
    toast(message)
  }
}

function removeMessageAttachment(fileId: string) {
  messageAttachments.value = messageAttachments.value.filter(item => item.fileId !== fileId)
}

async function handleSendMessage() {
  const content = messageText.value.trim()
  const mediaUrls = messageAttachments.value.map(item => item.url)
  if (!order.value || actionLoading.value) {
    return
  }
  if (!content && !mediaUrls.length) {
    toast('请先输入消息或上传图片')
    return
  }

  actionLoading.value = true
  try {
    conversation.value = await sendOrderMessage(order.value.id, {
      content: content || undefined,
      mediaUrls,
    })
    clearCurrentMessageDraft(order.value.id)
    clearCurrentMessageRecovery(order.value.id)
    resetComposer()
    toast('消息已发送', 'success')
    await loadPage()
  }
  catch (error: unknown) {
    const message = `${getErrorMessage(error, '发送消息失败')}，当前输入和已上传图片都已保留。`
    const identity = buildMessageComposerIdentity(order.value.id, messageComposerScope.value)
    if (identity) {
      setPetPalMessageRecovery(identity, 'send', message)
    }
    toast(message)
  }
  finally {
    actionLoading.value = false
  }
}

function retryCurrentMessageRecovery() {
  if (!currentMessageRecovery.value || uploadingMessageAttachments.value || actionLoading.value) {
    return
  }

  if (currentMessageRecovery.value.stage === 'send') {
    void handleSendMessage()
    return
  }

  void uploadMessageMaterials()
}

async function handleConfirmComplete() {
  if (!order.value) return
  await withAction(async () => {
    order.value = await confirmOrderComplete(order.value!.id)
  }, '已确认完成')
}

async function handleAccept() {
  if (!order.value) return
  await withAction(async () => {
    order.value = await acceptCaregiverOrder(order.value!.id)
  }, '已接单')
}

async function handleCheckIn() {
  if (!order.value) return
  await withAction(async () => {
    order.value = await checkInCaregiverOrder(order.value!.id, { note: '移动端签到' })
  }, '签到成功')
}

async function handleCheckOut() {
  if (!order.value) return
  await withAction(async () => {
    order.value = await checkOutCaregiverOrder(order.value!.id, { note: '移动端签退' })
  }, '签退成功')
}

async function handleAddServiceLog() {
  if (!order.value || !serviceLogNote.value.trim()) {
    toast('请先填写服务记录')
    return
  }

  await withAction(async () => {
    order.value = await addCaregiverServiceLog(order.value!.id, {
      logType: serviceLogType.value,
      textNote: serviceLogNote.value.trim(),
    })
    serviceLogNote.value = ''
  }, '服务记录已添加')
}

watch(activeTab, async (value) => {
  if (value === 'chat' && orderId.value) {
    await markOrderMessagesRead(orderId.value).catch(() => undefined)
  }
})

watch(messageText, () => {
  if (orderId.value) {
    persistCurrentMessageDraft(orderId.value, messageComposerScope.value)
  }
})

watch(messageAttachments, () => {
  if (orderId.value) {
    persistCurrentMessageDraft(orderId.value, messageComposerScope.value)
  }
}, { deep: true })

watch(orderId, (value, previousValue) => {
  if (value === previousValue) {
    return
  }
  if (previousValue) {
    persistCurrentMessageDraft(previousValue, messageComposerScope.value)
  }
  if (!value) {
    messageComposerScope.value = 'shared'
    resetComposer()
    return
  }
  const identity = buildMessageComposerIdentity(value)
  messageComposerScope.value = identity ? (getPetPalMessageComposerScope(identity) ?? 'shared') : 'shared'
  restoreComposerState(value)
}, { immediate: true })

onLoad((options) => {
  orderId.value = options?.id || options?.orderId || ''
  activeTab.value = (options?.tab as DetailTab) || 'overview'
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="订单详情" subtitle="一笔订单拆成四个标签处理，不再把所有动作塞在一个长页里。" eyebrow="Order" back :back-url="'/pages/petpal/orders'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="order">
      <PetpalSection tone="accent" title="当前订单" :subtitle="`${roleLabel} · ${currentStatusLabel}`">
        <view class="petpal-banner">
          <text class="petpal-banner__eyebrow">Current Focus</text>
          <text class="petpal-banner__title">{{ order.orderNo }}</text>
          <text class="petpal-banner__meta">{{ helpers.serviceTypeLabels[order.serviceType] }} · {{ currentStatusLabel }}</text>
          <text class="petpal-note">{{ focusHint }}</text>
        </view>
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">订单金额</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(order.amountTotal) }}</text>
            <text class="petpal-stat__meta">已支付 {{ helpers.formatMoney(order.amountPaid) }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">预约时间</text>
            <text class="petpal-stat__value">{{ helpers.formatDateTime(order.appointmentStart) }}</text>
            <text class="petpal-stat__meta">{{ helpers.formatDateTime(order.appointmentEnd) }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="切换工作区" subtitle="同一订单的概览、沟通、履约、售后在这里独立切换。">
        <PetpalSegmented v-model="activeTab" :options="tabOptions" />
      </PetpalSection>

      <template v-if="activeTab === 'overview'">
        <PetpalSection title="订单概览" subtitle="先看当前状态，再回看最近流转。">
          <view class="petpal-sheet">
            <text class="petpal-banner__eyebrow">Schedule</text>
            <text class="petpal-banner__title">{{ helpers.formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="petpal-banner__meta">{{ currentStatusLabel }}</text>
          </view>
          <template v-if="recentTimeline.length">
            <view v-for="item in recentTimeline" :key="item.id" class="petpal-sheet">
              <text class="petpal-banner__title">{{ item.eventType }}</text>
              <text class="petpal-note">{{ helpers.formatDateTime(item.createdAt) }} · {{ item.operatorRole }}</text>
            </view>
          </template>
          <PetpalEmpty v-else title="还没有更多流转记录" description="订单状态变化后会在这里持续留痕。"/>
        </PetpalSection>

        <PetpalSection v-if="isOwnerView" title="当前能做的动作" subtitle="概览页只保留这一阶段最可能需要的操作。">
          <view class="petpal-action-row">
            <button
              v-if="order.orderStatus === 'SERVING'"
              class="petpal-btn petpal-btn--primary"
              hover-class="none"
              @click="handleConfirmComplete"
            >
              确认完成
            </button>
            <button
              v-if="order.orderStatus === 'COMPLETED' && !order.review"
              class="petpal-btn petpal-btn--secondary"
              hover-class="none"
              @click="openReview"
            >
              去评价
            </button>
            <button
              v-if="['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)"
              class="petpal-btn petpal-btn--danger"
              hover-class="none"
              @click="openComplaint"
            >
              继续售后
            </button>
          </view>
        </PetpalSection>
      </template>

      <template v-else-if="activeTab === 'chat'">
        <PetpalSection title="订单沟通" subtitle="消息只保留在当前订单上下文里，不再散落到其他页面。">
          <template v-if="conversationMessages.length">
            <view class="detail-chat">
              <view
                v-for="item in conversationMessages"
                :key="item.id"
                :class="[
                  'detail-chat__bubble',
                  item.senderUserId === userInfo.id ? 'detail-chat__bubble--own' : '',
                ]"
              >
                <text class="detail-chat__meta">{{ item.senderRole }} · {{ helpers.formatDateTime(item.createdAt) }}</text>
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
          <PetpalEmpty v-else title="还没有沟通记录" description="发送第一条消息后，会在这里持续留痕。"/>
        </PetpalSection>

        <PetpalSection title="发送消息" subtitle="消息发送动作单独放在这里，不和订单概览混在一起。">
          <view class="petpal-form">
            <view v-if="currentMessageRecovery" class="message-recovery">
              <text class="message-recovery__title">{{ currentMessageRecovery.stage === 'send' ? '上一条消息还没发出去' : '上一轮图片上传没有完成' }}</text>
              <text class="message-recovery__detail">{{ currentMessageRecovery.message }}</text>
              <view class="petpal-action-row">
                <button
                  class="petpal-btn petpal-btn--secondary"
                  hover-class="none"
                  :disabled="uploadingMessageAttachments || actionLoading"
                  @click="retryCurrentMessageRecovery"
                >
                  {{ currentMessageRecovery.stage === 'send' ? '重试发送' : '重新上传图片' }}
                </button>
                <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="clearCurrentMessageRecovery(order.id)">
                  清除提示
                </button>
              </view>
            </view>
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
            <textarea v-model="messageText" class="petpal-textarea" :maxlength="280" placeholder="输入要沟通的内容" />
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" :disabled="uploadingMessageAttachments || actionLoading || messageAttachmentSlotsLeft <= 0" @click="uploadMessageMaterials">
                {{ uploadingMessageAttachments ? '上传中...' : `上传图片${messageAttachmentSlotsLeft ? `（剩余 ${messageAttachmentSlotsLeft} 张）` : ''}` }}
              </button>
              <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="uploadingMessageAttachments || actionLoading" @click="handleSendMessage">
                {{ actionLoading ? '发送中...' : '发送消息' }}
              </button>
            </view>
          </view>
        </PetpalSection>
      </template>

      <template v-else-if="activeTab === 'service'">
        <PetpalSection title="服务记录" subtitle="签到、喂养、遛宠和备注都只在这里留痕。">
          <template v-if="visibleServiceLogs.length">
            <view v-for="item in visibleServiceLogs" :key="item.id" class="petpal-sheet">
              <text class="petpal-banner__eyebrow">{{ helpers.getServiceLogTypeLabel(item.logType) }}</text>
              <text class="petpal-banner__title">{{ item.textNote || '未填写文字说明' }}</text>
              <text class="petpal-note">{{ helpers.formatDateTime(item.happenedAt) }}</text>
            </view>
          </template>
          <PetpalEmpty v-else title="还没有服务记录" description="签到、喂养、遛宠和备注都会记录在这里。"/>
        </PetpalSection>

        <PetpalSection v-if="!isOwnerView" tone="accent" title="继续履约" subtitle="照料者动作只放在这一块，避免和查看记录混在一起。">
          <view class="petpal-choice-grid">
            <button
              v-for="item in serviceLogOptions"
              :key="item.value"
              :class="['petpal-choice-tile', serviceLogType === item.value ? 'petpal-choice-tile--active' : '']"
              hover-class="none"
              @click="serviceLogType = item.value"
            >
              <text class="petpal-choice-tile__eyebrow">Log Type</text>
              <text class="petpal-choice-tile__title">{{ item.label }}</text>
              <text class="petpal-choice-tile__hint">{{ item.note }}</text>
            </button>
          </view>
          <textarea v-model="serviceLogNote" class="petpal-textarea" :maxlength="220" placeholder="输入本次服务说明" />
          <view class="petpal-action-row">
            <button v-if="order.orderStatus === 'PENDING_ACCEPT'" class="petpal-btn petpal-btn--primary" hover-class="none" @click="handleAccept">接单</button>
            <button v-if="order.orderStatus === 'ACCEPTED'" class="petpal-btn petpal-btn--primary" hover-class="none" @click="handleCheckIn">签到</button>
            <button v-if="order.orderStatus === 'SERVING'" class="petpal-btn petpal-btn--secondary" hover-class="none" @click="handleAddServiceLog">追加记录</button>
            <button v-if="order.orderStatus === 'SERVING'" class="petpal-btn petpal-btn--ghost" hover-class="none" @click="handleCheckOut">签退</button>
          </view>
        </PetpalSection>
      </template>

      <template v-else>
        <PetpalSection title="售后进展" subtitle="退款阶段和投诉记录都拆到这里，不再混在订单概览里。">
          <template v-if="refundProgress">
            <view class="petpal-banner">
              <text class="petpal-banner__eyebrow">Refund Progress</text>
              <text class="petpal-banner__title">{{ helpers.getRefundProgressStageLabel(refundProgress.stage) }}</text>
              <text class="petpal-banner__meta">{{ helpers.getRefundProgressStageHint(refundProgress.stage) }}</text>
            </view>
          </template>
          <template v-if="complaints.length">
            <view v-for="item in complaints" :key="item.id" class="petpal-sheet">
              <text class="petpal-banner__title">{{ item.complaintType }}</text>
              <text class="petpal-banner__meta">{{ helpers.getComplaintStatusLabel(item.status) }}</text>
              <text class="petpal-note">{{ item.description }}</text>
            </view>
          </template>
          <PetpalEmpty v-else title="当前没有投诉记录" description="如果需要发起投诉或补充材料，请从这里进入投诉页。"/>
        </PetpalSection>

        <PetpalSection title="售后动作" subtitle="售后只保留投诉入口和返回概览两个动作。">
          <view class="petpal-action-row">
            <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openComplaint">投诉处理</button>
            <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openOrderDetailPage(order.id)">回概览</button>
          </view>
        </PetpalSection>
      </template>
    </template>

    <template v-else-if="!loading">
      <PetpalSection title="没有找到订单">
        <PetpalEmpty title="订单不存在或暂不可用" />
      </PetpalSection>
    </template>
  </PetpalPage>
</template>

<style scoped lang="scss">
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

.message-recovery {
  display: grid;
  gap: 12rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: rgba(255, 247, 237, 0.92);
  border: 1rpx solid rgba(217, 119, 6, 0.18);
}

.message-recovery__title {
  color: #9a3412;
  font-size: 26rpx;
  font-weight: 600;
}

.message-recovery__detail {
  color: var(--app-text);
  font-size: 23rpx;
  line-height: 1.7;
}
</style>
