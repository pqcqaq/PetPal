<script setup lang="ts">
import type { ComplaintRecord, OrderConversationDetailRecord, OrderDetailRecord, OrderRefundProgressRecord, ServiceLogType } from '@rbac/api-common'
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

type DetailTab = 'overview' | 'chat' | 'service' | 'aftersales'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const loading = ref(false)
const actionLoading = ref(false)
const orderId = ref('')
const activeTab = ref<DetailTab>('overview')
const order = ref<OrderDetailRecord | null>(null)
const refundProgress = ref<OrderRefundProgressRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])
const conversation = ref<OrderConversationDetailRecord | null>(null)
const messageText = ref('')
const serviceLogType = ref<ServiceLogType>('NOTE')
const serviceLogNote = ref('')

const isOwnerView = computed(() => Boolean(userInfo.value.id && order.value?.ownerId === userInfo.value.id))
const roleLabel = computed(() => (isOwnerView.value ? '主人视角' : '照料者视角'))
const conversationMessages = computed(() => conversation.value?.messages || [])

const tabOptions = computed(() => [
  { label: '概览', value: 'overview' },
  { label: '沟通', value: 'chat', badge: conversationMessages.value.length ? conversationMessages.value.length : '' },
  { label: '服务', value: 'service', badge: order.value?.serviceLogs.length || '' },
  { label: '售后', value: 'aftersales', badge: complaints.value.length || '' },
])

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

async function handleSendMessage() {
  const content = messageText.value.trim()
  if (!content || !order.value) {
    return
  }

  await withAction(async () => {
    conversation.value = await sendOrderMessage(order.value!.id, { content })
    messageText.value = ''
  }, '消息已发送')
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
      <PetpalSection tone="accent" title="当前订单" :subtitle="`${roleLabel} · ${helpers.getOrderStatusLabel(order.orderStatus)}`">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">订单号</text>
            <text class="petpal-stat__value">{{ order.orderNo }}</text>
            <text class="petpal-stat__meta">{{ helpers.serviceTypeLabels[order.serviceType] }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">金额</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(order.amountTotal) }}</text>
            <text class="petpal-stat__meta">已支付 {{ helpers.formatMoney(order.amountPaid) }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="切换内容">
        <PetpalSegmented v-model="activeTab" :options="tabOptions" />
      </PetpalSection>

      <PetpalSection v-if="activeTab === 'overview'" title="概览">
        <button class="petpal-row-btn" hover-class="none">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">预约时间</text>
            <text class="petpal-row__meta">{{ helpers.formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
          </view>
          <text class="petpal-row__value">{{ helpers.getOrderStatusLabel(order.orderStatus) }}</text>
        </button>
        <button
          v-for="item in order.timeline.slice().reverse().slice(0, 6)"
          :key="item.id"
          class="petpal-row-btn"
          hover-class="none"
        >
          <view class="petpal-row__copy">
            <text class="petpal-row__title">{{ item.eventType }}</text>
            <text class="petpal-row__hint">{{ helpers.formatDateTime(item.createdAt) }} · {{ item.operatorRole }}</text>
          </view>
        </button>
        <view class="petpal-action-row">
          <button
            v-if="isOwnerView && order.orderStatus === 'SERVING'"
            class="petpal-btn petpal-btn--primary"
            hover-class="none"
            @click="handleConfirmComplete"
          >
            确认完成
          </button>
          <button
            v-if="isOwnerView && order.orderStatus === 'COMPLETED' && !order.review"
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="openReview"
          >
            去评价
          </button>
          <button
            v-if="isOwnerView && ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)"
            class="petpal-btn petpal-btn--danger"
            hover-class="none"
            @click="openComplaint"
          >
            继续售后
          </button>
        </view>
      </PetpalSection>

      <PetpalSection v-else-if="activeTab === 'chat'" title="订单沟通">
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
              <text class="detail-chat__content">{{ item.content || '发送了一条附件消息' }}</text>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="还没有沟通记录" description="发送第一条消息后，会在这里持续留痕。"/>
        <view class="petpal-form">
          <textarea v-model="messageText" class="petpal-textarea" :maxlength="280" placeholder="输入要沟通的内容" />
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="handleSendMessage">发送消息</button>
        </view>
      </PetpalSection>

      <PetpalSection v-else-if="activeTab === 'service'" title="服务记录">
        <template v-if="order.serviceLogs.length">
          <button
            v-for="item in order.serviceLogs.slice().reverse()"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ helpers.getServiceLogTypeLabel(item.logType) }}</text>
              <text class="petpal-row__meta">{{ item.textNote || '未填写文字说明' }}</text>
              <text class="petpal-row__hint">{{ helpers.formatDateTime(item.happenedAt) }}</text>
            </view>
          </button>
        </template>
        <PetpalEmpty v-else title="还没有服务记录" description="签到、喂养、遛宠和备注都会记录在这里。"/>

        <template v-if="!isOwnerView">
          <view class="petpal-form">
            <view class="petpal-chip-row">
              <button
                v-for="item in serviceLogOptions"
                :key="item.value"
                :class="['petpal-chip', serviceLogType === item.value ? 'petpal-chip--active' : '']"
                hover-class="none"
                @click="serviceLogType = item.value"
              >
                {{ item.label }}
              </button>
            </view>
            <textarea v-model="serviceLogNote" class="petpal-textarea" :maxlength="220" placeholder="输入本次服务说明" />
          </view>
          <view class="petpal-action-row">
            <button v-if="order.orderStatus === 'PENDING_ACCEPT'" class="petpal-btn petpal-btn--primary" hover-class="none" @click="handleAccept">接单</button>
            <button v-if="order.orderStatus === 'ACCEPTED'" class="petpal-btn petpal-btn--primary" hover-class="none" @click="handleCheckIn">签到</button>
            <button v-if="order.orderStatus === 'SERVING'" class="petpal-btn petpal-btn--secondary" hover-class="none" @click="handleAddServiceLog">追加记录</button>
            <button v-if="order.orderStatus === 'SERVING'" class="petpal-btn petpal-btn--ghost" hover-class="none" @click="handleCheckOut">签退</button>
          </view>
        </template>
      </PetpalSection>

      <PetpalSection v-else title="售后信息">
        <template v-if="refundProgress">
          <view class="petpal-banner">
            <text class="petpal-banner__title">{{ helpers.getRefundProgressStageLabel(refundProgress.stage) }}</text>
            <text class="petpal-banner__meta">{{ helpers.getRefundProgressStageHint(refundProgress.stage) }}</text>
          </view>
        </template>
        <template v-if="complaints.length">
          <button
            v-for="item in complaints"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openComplaint"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.complaintType }}</text>
              <text class="petpal-row__meta">{{ helpers.getComplaintStatusLabel(item.status) }}</text>
              <text class="petpal-row__hint">{{ item.description }}</text>
            </view>
          </button>
        </template>
        <PetpalEmpty v-else title="当前没有投诉记录" description="如果需要发起投诉或补充材料，请从这里进入投诉页。"/>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openComplaint">投诉处理</button>
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openOrderDetailPage(order.id)">回概览</button>
        </view>
      </PetpalSection>
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
</style>
