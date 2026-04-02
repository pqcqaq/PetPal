<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，正在处理退款、投诉或争议
 * Entry: 从首页、订单列表、订单详情进入售后
 * First screen:
 * 1. 先锁定当前最急的一单，不让用户自己翻列表判断
 * 2. 首屏同时给出退款、投诉、沟通三条关键信号
 * 3. 其他订单留在下方队列里，就地展开后再决定是否进入详情
 * Primary action: 继续处理当前最急订单
 * Secondary actions: 联系对方、切换筛选、展开其他订单摘要
 * States: 无售后、处理中退款、处理中投诉、争议订单、已结案回看
 */
import type {
  ComplaintRecord,
  ComplaintStatus,
  OrderRecord,
  OrderRefundProgressRecord,
  RefundProgressStage,
} from '@rbac/api-common'
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getOrderComplaints, getOrderRefundProgress, listOrders } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  consumePetPalAftersalesPageContext,
  formatAmount,
  formatDateTime,
  formatRange,
  type AftersalesFilter,
  getComplaintStatusLabel,
  getComplaintTypeLabel,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  openPetPalAction,
  getRefundProgressStageLabel,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_COMPLAINT_RESULT_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_REFUND_RESULT_PAGE,
  PETPAL_ORDERS_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalAftersalesPage',
})

definePage({
  style: {
    navigationBarTitleText: '售后中心',
    enablePullDownRefresh: true,
  },
})

type AftersalesPriority = 'HIGH' | 'MEDIUM' | 'LOW'
type ViewTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

interface AftersalesOrderEntry {
  order: OrderRecord
  refundProgress: OrderRefundProgressRecord | null
  complaints: ComplaintRecord[]
}

interface AftersalesOrderView extends AftersalesOrderEntry {
  priority: AftersalesPriority
  activeComplaintCount: number
  latestActivityAt: number
}

interface QueueSignalCard {
  key: string
  title: string
  value: string
  hint: string
  tone: ViewTone
}

interface FocusTag {
  label: string
  type: ViewTone
}

interface FocusPanel {
  key: string
  title: string
  value: string
  hint: string
  tone: ViewTone
}

const tokenStore = useTokenStore()

const loading = ref(false)
const entries = ref<AftersalesOrderEntry[]>([])
const activeFilter = ref<AftersalesFilter>('HIGH')
const expandedOrderId = ref('')
const preferredOrderId = ref('')

const filterOptions = [
  { label: '优先', value: 'HIGH', description: '先看需要马上跟进的订单' },
  { label: '全部', value: 'ALL', description: '查看全部售后订单' },
  { label: '退款', value: 'REFUND', description: '只看退款相关进度' },
  { label: '投诉', value: 'COMPLAINT', description: '只看投诉相关进度' },
]

const orderCards = computed<AftersalesOrderView[]>(() => entries.value
  .map((entry) => {
    const activeComplaintCount = entry.complaints.filter(item => isComplaintActive(item.status)).length
    return {
      ...entry,
      activeComplaintCount,
      priority: getPriority(entry, activeComplaintCount),
      latestActivityAt: getLatestActivityAt(entry),
    }
  })
  .sort((left, right) => {
    const leftIsPreferred = left.order.id === preferredOrderId.value
    const rightIsPreferred = right.order.id === preferredOrderId.value
    if (leftIsPreferred !== rightIsPreferred) {
      return leftIsPreferred ? -1 : 1
    }
    const priorityGap = getPriorityWeight(right.priority) - getPriorityWeight(left.priority)
    if (priorityGap !== 0) {
      return priorityGap
    }
    return right.latestActivityAt - left.latestActivityAt
  }))

const filteredCards = computed(() => orderCards.value.filter((entry) => {
  if (activeFilter.value === 'ALL') {
    return true
  }
  if (activeFilter.value === 'HIGH') {
    return entry.priority !== 'LOW'
  }
  if (activeFilter.value === 'REFUND') {
    return getRefundStage(entry) !== 'NONE'
  }
  return entry.complaints.length > 0
}))

const focusCard = computed(() => filteredCards.value[0] ?? null)
const queueCards = computed(() => filteredCards.value.slice(1))

const pendingRefundCount = computed(() => orderCards.value.filter((entry) => {
  const stage = entry.refundProgress?.stage
  return stage === 'PENDING_REVIEW' || stage === 'APPROVED_WAITING'
}).length)

const activeComplaintCount = computed(() => orderCards.value.reduce((total, entry) => (
  total + entry.activeComplaintCount
), 0))

const unreadConversationCount = computed(() => orderCards.value.reduce((total, entry) => (
  total + getConversationUnreadCount(entry.order.conversation, 'owner')
), 0))

const settledRefundAmount = computed(() => orderCards.value.reduce((total, entry) => {
  const amount = entry.refundProgress?.settledRefundAmount ?? entry.order.amountRefunded
  return total + Number(amount ?? 0)
}, 0))

const queueSignalCards = computed<QueueSignalCard[]>(() => [
  {
    key: 'queue',
    title: activeFilter.value === 'ALL' ? '售后订单' : '当前队列',
    value: `${filteredCards.value.length} 单`,
    hint: focusCard.value ? getLatestProgressText(focusCard.value) : '当前筛选下没有待处理售后',
    tone: filteredCards.value.length > 0 ? 'primary' : 'default',
  },
  {
    key: 'refund',
    title: '退款处理中',
    value: `${pendingRefundCount.value} 单`,
    hint: settledRefundAmount.value > 0 ? `累计已退 ¥${formatAmount(settledRefundAmount.value)}` : '暂未产生到账退款',
    tone: pendingRefundCount.value > 0 ? 'warning' : settledRefundAmount.value > 0 ? 'success' : 'default',
  },
  {
    key: 'complaint',
    title: '投诉处理中',
    value: `${activeComplaintCount.value} 条`,
    hint: unreadConversationCount.value > 0 ? `${unreadConversationCount.value} 条沟通未读` : '当前沟通已读',
    tone: activeComplaintCount.value > 0 ? 'danger' : unreadConversationCount.value > 0 ? 'warning' : 'default',
  },
])

const focusTags = computed<FocusTag[]>(() => {
  if (!focusCard.value) {
    return []
  }

  const entry = focusCard.value
  const tags: FocusTag[] = [
    {
      label: getPriorityLabel(entry.priority),
      type: getPriorityTagType(entry.priority),
    },
    {
      label: getOrderStatusLabel(entry.order.orderStatus),
      type: getOrderTagType(entry.order.orderStatus),
    },
    {
      label: serviceTypeLabels[entry.order.serviceType],
      type: 'primary',
    },
  ]

  const refundStage = getRefundStage(entry)
  if (refundStage !== 'NONE') {
    tags.push({
      label: getRefundProgressStageLabel(refundStage),
      type: getRefundTone(refundStage),
    })
  }

  const complaint = getPrimaryComplaint(entry)
  if (complaint && isComplaintActive(complaint.status)) {
    tags.push({
      label: `${getComplaintTypeLabel(complaint.complaintType)}处理中`,
      type: 'danger',
    })
  }

  const unreadCount = getConversationUnreadCount(entry.order.conversation, 'owner')
  if (unreadCount > 0) {
    tags.push({
      label: `${unreadCount} 条未读`,
      type: 'warning',
    })
  }

  return tags
})

const focusPanels = computed<FocusPanel[]>(() => {
  if (!focusCard.value) {
    return []
  }

  const entry = focusCard.value
  const complaint = getPrimaryComplaint(entry) ?? getLatestComplaint(entry)
  const unreadCount = getConversationUnreadCount(entry.order.conversation, 'owner')

  return [
    {
      key: 'refund',
      title: '退款',
      value: getRefundProgressStageLabel(getRefundStage(entry)),
      hint: getRefundPanelHint(entry),
      tone: getRefundTone(getRefundStage(entry)),
    },
    {
      key: 'complaint',
      title: '投诉',
      value: getComplaintPanelValue(entry),
      hint: getComplaintPanelHint(entry),
      tone: getComplaintTone(complaint?.status),
    },
    {
      key: 'message',
      title: '沟通',
      value: unreadCount > 0 ? `${unreadCount} 条未读` : entry.order.conversation?.lastMessageAt ? '沟通已读' : '暂未沟通',
      hint: getMessagePanelHint(entry),
      tone: unreadCount > 0 ? 'warning' : 'default',
    },
  ]
})

watch(queueCards, (cards) => {
  if (!cards.length) {
    expandedOrderId.value = ''
    return
  }

  if (!cards.some(item => item.order.id === expandedOrderId.value)) {
    expandedOrderId.value = cards[0].order.id
  }
}, { immediate: true })

function isComplaintActive(status: ComplaintStatus) {
  return status === 'OPEN' || status === 'PROCESSING'
}

function getPriorityWeight(priority: AftersalesPriority) {
  if (priority === 'HIGH') return 3
  if (priority === 'MEDIUM') return 2
  return 1
}

function getPriority(
  entry: AftersalesOrderEntry,
  activeCount = entry.complaints.filter(item => isComplaintActive(item.status)).length,
): AftersalesPriority {
  const stage = entry.refundProgress?.stage

  if (
    entry.order.orderStatus === 'DISPUTED'
    || activeCount > 0
    || stage === 'FAILED'
    || stage === 'REJECTED'
  ) {
    return 'HIGH'
  }

  if (stage === 'PENDING_REVIEW' || stage === 'APPROVED_WAITING') {
    return 'MEDIUM'
  }

  return 'LOW'
}

function getLatestActivityAt(entry: AftersalesOrderEntry) {
  const timestamps = [
    new Date(entry.order.updatedAt).getTime(),
    entry.refundProgress?.latestAppliedAt ? new Date(entry.refundProgress.latestAppliedAt).getTime() : 0,
    entry.refundProgress?.latestReviewedAt ? new Date(entry.refundProgress.latestReviewedAt).getTime() : 0,
    ...entry.complaints.map(item => new Date(item.updatedAt).getTime()),
  ]

  return Math.max(...timestamps)
}

function getPriorityLabel(priority: AftersalesPriority) {
  if (priority === 'HIGH') return '优先处理'
  if (priority === 'MEDIUM') return '继续跟进'
  return '回看结果'
}

function getPriorityTagType(priority: AftersalesPriority): ViewTone {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}

function getOrderTagType(status: OrderRecord['orderStatus']): ViewTone {
  const tone = getOrderTone(status)
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  return 'default'
}

function getPrimaryComplaint(entry: AftersalesOrderView) {
  return entry.complaints.find(item => isComplaintActive(item.status)) ?? null
}

function getLatestComplaint(entry: AftersalesOrderView) {
  return [...entry.complaints]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null
}

function getLatestComplaintLog(entry: AftersalesOrderView) {
  const complaint = getPrimaryComplaint(entry) ?? getLatestComplaint(entry)
  if (!complaint || complaint.processLogs.length === 0) {
    return null
  }
  return complaint.processLogs[complaint.processLogs.length - 1] ?? null
}

function getRefundStage(entry: AftersalesOrderView): RefundProgressStage {
  return entry.refundProgress?.stage ?? 'NONE'
}

function getRefundTone(stage: RefundProgressStage): ViewTone {
  if (stage === 'FULL_SUCCESS') return 'success'
  if (stage === 'APPROVED_WAITING') return 'primary'
  if (stage === 'PENDING_REVIEW' || stage === 'PARTIAL_SUCCESS' || stage === 'REJECTED') return 'warning'
  if (stage === 'FAILED') return 'danger'
  return 'default'
}

function getComplaintTone(status: ComplaintStatus | null | undefined): ViewTone {
  if (status === 'OPEN') return 'warning'
  if (status === 'PROCESSING') return 'danger'
  if (status === 'RESOLVED') return 'success'
  return 'default'
}

function getPriorityHint(entry: AftersalesOrderView) {
  if (entry.activeComplaintCount > 0) {
    return `${entry.activeComplaintCount} 条投诉处理中，先看处理日志和证据。`
  }

  const stage = getRefundStage(entry)

  if (stage === 'FAILED') {
    return '退款失败，先核查渠道和处理结果。'
  }
  if (stage === 'REJECTED') {
    return '退款被驳回，先看原因再补说明。'
  }
  if (stage === 'PENDING_REVIEW') {
    return '退款已提交，等待平台审核。'
  }
  if (stage === 'APPROVED_WAITING') {
    return '退款已通过审核，等待到账。'
  }
  if (stage === 'PARTIAL_SUCCESS') {
    return '已完成部分退款，继续核对剩余争议。'
  }

  return '这一单当前以回看处理结果为主。'
}

function getLatestProgressText(entry: AftersalesOrderView) {
  const complaint = getLatestComplaint(entry)

  if (complaint) {
    return `投诉更新 ${formatDateTime(complaint.updatedAt)}`
  }

  const latestRefundTime = entry.refundProgress?.latestReviewedAt || entry.refundProgress?.latestAppliedAt
  if (latestRefundTime) {
    return `退款更新 ${formatDateTime(latestRefundTime)}`
  }

  return `订单更新 ${formatDateTime(entry.order.updatedAt)}`
}

function getRefundPanelHint(entry: AftersalesOrderView) {
  const progress = entry.refundProgress
  const stage = getRefundStage(entry)

  if (!progress || stage === 'NONE') {
    return Number(entry.order.amountRefunded) > 0
      ? `已退 ¥${formatAmount(entry.order.amountRefunded)}`
      : '当前没有退款申请'
  }

  const time = progress.latestReviewedAt || progress.latestAppliedAt
  const amount = progress.latestRefundAmount != null
    ? `最近 ¥${formatAmount(progress.latestRefundAmount)}`
    : `已退 ¥${formatAmount(progress.settledRefundAmount)}`

  return time ? `${amount} · ${formatDateTime(time)}` : amount
}

function getComplaintPillValue(entry: AftersalesOrderView) {
  const complaint = getPrimaryComplaint(entry)
  if (complaint) {
    return getComplaintStatusLabel(complaint.status)
  }
  if (entry.complaints.length > 0) {
    return '历史记录'
  }
  return '暂无投诉'
}

function getComplaintPanelValue(entry: AftersalesOrderView) {
  const complaint = getPrimaryComplaint(entry) ?? getLatestComplaint(entry)
  if (!complaint) {
    return '暂无投诉'
  }
  return `${getComplaintTypeLabel(complaint.complaintType)} · ${getComplaintStatusLabel(complaint.status)}`
}

function getComplaintPanelHint(entry: AftersalesOrderView) {
  const complaint = getPrimaryComplaint(entry) ?? getLatestComplaint(entry)
  if (!complaint) {
    return '需要时可进入订单发起投诉'
  }

  const latestLog = getLatestComplaintLog(entry)
  if (latestLog) {
    return `最近处理 ${formatDateTime(latestLog.createdAt)}`
  }

  return `发起于 ${formatDateTime(complaint.createdAt)}`
}

function getMessagePillValue(entry: AftersalesOrderView) {
  const unread = getConversationUnreadCount(entry.order.conversation, 'owner')
  if (unread > 0) {
    return `${unread} 条未读`
  }
  if (entry.order.conversation?.lastMessageAt) {
    return '最近有沟通'
  }
  return '暂未沟通'
}

function getMessagePanelHint(entry: AftersalesOrderView) {
  const unread = getConversationUnreadCount(entry.order.conversation, 'owner')
  if (entry.order.conversation?.lastMessageAt) {
    return unread > 0
      ? `最近 ${formatDateTime(entry.order.conversation.lastMessageAt)} 收到新消息`
      : `最近沟通 ${formatDateTime(entry.order.conversation.lastMessageAt)}`
  }
  return '需要时可直接联系对方'
}

function getPrimaryActionLabel(entry: AftersalesOrderView) {
  if (entry.activeComplaintCount > 0) {
    return '继续投诉'
  }

  const stage = getRefundStage(entry)
  if (stage === 'PENDING_REVIEW' || stage === 'APPROVED_WAITING' || stage === 'REJECTED' || stage === 'FAILED') {
    return '看退款'
  }
  if (stage === 'PARTIAL_SUCCESS' || stage === 'FULL_SUCCESS') {
    return '看结果'
  }

  return entry.priority === 'LOW' ? '回看结果' : '继续处理'
}

function getLatestDetailNote(entry: AftersalesOrderView) {
  const complaint = getLatestComplaint(entry)
  if (complaint?.resultSummary) {
    return `处理结论：${complaint.resultSummary}`
  }

  const refundReason = entry.refundProgress?.latestRefundReason?.trim()
  if (refundReason) {
    return `退款说明：${refundReason}`
  }

  return ''
}

function isExpanded(orderId: string) {
  return expandedOrderId.value === orderId
}

function toggleExpanded(orderId: string) {
  expandedOrderId.value = expandedOrderId.value === orderId ? '' : orderId
}

function openOrderDetail(orderId: string, tab: 'chat' | 'aftersales') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

function openRefundResult(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_REFUND_RESULT_PAGE}?orderId=${orderId}` })
}

function openComplaintResult(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_COMPLAINT_RESULT_PAGE}?orderId=${orderId}` })
}

function openPrimaryAction(entry: AftersalesOrderView) {
  if (entry.activeComplaintCount > 0) {
    openComplaintResult(entry.order.id)
    return
  }

  if (getRefundStage(entry) !== 'NONE') {
    openRefundResult(entry.order.id)
    return
  }

  if (entry.complaints.length > 0) {
    openComplaintResult(entry.order.id)
    return
  }

  openOrderDetail(entry.order.id, 'aftersales')
}

function applyPendingNavigationContext() {
  const context = consumePetPalAftersalesPageContext()
  if (!context) {
    return
  }

  if (context.filter) {
    activeFilter.value = context.filter
  }

  preferredOrderId.value = context.focusOrderId || ''
}

function openOrders() {
  openPetPalAction('redirect', PETPAL_ORDERS_PAGE)
}

function openMessages() {
  openPetPalAction('redirect', PETPAL_MESSAGES_PAGE)
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function buildEntry(order: OrderRecord): Promise<AftersalesOrderEntry> {
  const [refundProgressResult, complaintsResult] = await Promise.allSettled([
    getOrderRefundProgress(order.id),
    getOrderComplaints(order.id),
  ])

  return {
    order,
    refundProgress: refundProgressResult.status === 'fulfilled' ? refundProgressResult.value : null,
    complaints: complaintsResult.status === 'fulfilled' ? complaintsResult.value : [],
  }
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    const orderRows = await listOrders()
    const candidateOrders = orderRows
      .filter(item => isOrderAftersalesTracked(item))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())

    entries.value = candidateOrders.length
      ? await Promise.all(candidateOrders.map(order => buildEntry(order)))
      : []
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载售后中心失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => {
  applyPendingNavigationContext()
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
})

onHide(() => {
  preferredOrderId.value = ''
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="售后中心">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_AFTERSALES_PAGE"
        title="售后中心"
      />

      <AppSection title="现在先处理">
        <template v-if="focusCard">
          <view class="aftersales-focus">
            <view class="aftersales-focus__copy">
              <view class="aftersales-focus__tags">
                <AppTag
                  v-for="tag in focusTags"
                  :key="tag.label"
                  :type="tag.type"
                >
                  {{ tag.label }}
                </AppTag>
              </view>
              <text class="aftersales-focus__title">{{ focusCard.order.orderNo }}</text>
              <text class="aftersales-focus__meta">{{ serviceTypeLabels[focusCard.order.serviceType] }} · {{ formatRange(focusCard.order.appointmentStart, focusCard.order.appointmentEnd) }}</text>
              <text class="aftersales-focus__meta">实付 ¥{{ formatAmount(focusCard.order.amountPaid) }} · 已退 ¥{{ formatAmount(focusCard.order.amountRefunded) }}</text>
              <text class="aftersales-focus__summary">{{ getPriorityHint(focusCard) }}</text>
            </view>

            <view class="aftersales-summary">
              <view
                v-for="signal in queueSignalCards"
                :key="signal.key"
                class="aftersales-summary__card"
                :class="`aftersales-summary__card--${signal.tone}`"
              >
                <text class="aftersales-summary__label">{{ signal.title }}</text>
                <text class="aftersales-summary__value">{{ signal.value }}</text>
                <text class="aftersales-summary__hint">{{ signal.hint }}</text>
              </view>
            </view>

            <view class="aftersales-detail-grid">
              <view
                v-for="panel in focusPanels"
                :key="panel.key"
                class="aftersales-panel"
                :class="`aftersales-panel--${panel.tone}`"
              >
                <text class="aftersales-panel__label">{{ panel.title }}</text>
                <text class="aftersales-panel__value">{{ panel.value }}</text>
                <text class="aftersales-panel__hint">{{ panel.hint }}</text>
              </view>
            </view>

            <view v-if="getLatestDetailNote(focusCard)" class="aftersales-note">
              <text>{{ getLatestDetailNote(focusCard) }}</text>
            </view>

            <view class="aftersales-focus__actions">
              <AppButton
                size="medium"
                :type="focusCard.priority === 'HIGH' ? 'danger' : 'primary'"
                @click="openPrimaryAction(focusCard)"
              >
                {{ getPrimaryActionLabel(focusCard) }}
              </AppButton>
              <AppButton size="medium" type="info" @click="openOrderDetail(focusCard.order.id, 'chat')">
                联系
              </AppButton>
              <AppButton size="medium" type="info" @click="openOrders">
                订单
              </AppButton>
            </view>
          </view>
        </template>

        <template v-else>
          <AppStatus
            :mode="loading ? 'loading' : 'empty'"
            :text="loading ? '正在整理售后队列' : '当前筛选下没有需要处理的售后事项'"
          />
        </template>
      </AppSection>

      <AppSection title="切换队列">
        <AppChoiceChips
          v-model="activeFilter"
          :options="filterOptions"
          show-descriptions
        />
        <view class="aftersales-toolbar">
          <AppTag :type="unreadConversationCount > 0 ? 'warning' : 'default'">
            {{ unreadConversationCount > 0 ? `${unreadConversationCount} 条消息待看` : '沟通已读' }}
          </AppTag>
          <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
          <AppButton
            v-if="focusCard"
            size="medium"
            :type="focusCard.priority === 'HIGH' ? 'danger' : 'primary'"
            @click="openPrimaryAction(focusCard)"
          >
            继续当前最急
          </AppButton>
        </view>
      </AppSection>

      <AppSection :title="queueCards.length ? `其他订单 (${queueCards.length})` : '其他订单'">
        <template v-if="queueCards.length">
          <view class="aftersales-queue">
            <view
              v-for="entry in queueCards"
              :key="entry.order.id"
              class="aftersales-item"
              :class="isExpanded(entry.order.id) ? 'aftersales-item--expanded' : ''"
            >
              <view class="aftersales-item__overview" @click="toggleExpanded(entry.order.id)">
                <view class="aftersales-item__copy">
                  <text class="aftersales-item__title">{{ entry.order.orderNo }}</text>
                  <text class="aftersales-item__meta">{{ serviceTypeLabels[entry.order.serviceType] }} · {{ formatRange(entry.order.appointmentStart, entry.order.appointmentEnd) }}</text>
                  <text class="aftersales-item__meta">{{ getLatestProgressText(entry) }}</text>
                </view>

                <view class="aftersales-item__aside">
                  <view class="aftersales-item__tags">
                    <AppTag :type="getPriorityTagType(entry.priority)">
                      {{ getPriorityLabel(entry.priority) }}
                    </AppTag>
                    <AppTag :type="getOrderTagType(entry.order.orderStatus)">
                      {{ getOrderStatusLabel(entry.order.orderStatus) }}
                    </AppTag>
                  </view>
                  <text class="aftersales-item__toggle">{{ isExpanded(entry.order.id) ? '收起' : '展开' }}</text>
                </view>
              </view>

              <view class="aftersales-pill-row">
                <view class="aftersales-pill" :class="`aftersales-pill--${getRefundTone(getRefundStage(entry))}`">
                  <text class="aftersales-pill__label">退款</text>
                  <text class="aftersales-pill__value">{{ getRefundProgressStageLabel(getRefundStage(entry)) }}</text>
                </view>
                <view class="aftersales-pill" :class="`aftersales-pill--${getComplaintTone((getPrimaryComplaint(entry) ?? getLatestComplaint(entry))?.status)}`">
                  <text class="aftersales-pill__label">投诉</text>
                  <text class="aftersales-pill__value">{{ getComplaintPillValue(entry) }}</text>
                </view>
                <view class="aftersales-pill" :class="`aftersales-pill--${getConversationUnreadCount(entry.order.conversation, 'owner') > 0 ? 'warning' : 'default'}`">
                  <text class="aftersales-pill__label">沟通</text>
                  <text class="aftersales-pill__value">{{ getMessagePillValue(entry) }}</text>
                </view>
              </view>

              <view v-if="isExpanded(entry.order.id)" class="aftersales-item__details">
                <text class="aftersales-item__summary">{{ getPriorityHint(entry) }}</text>

                <view class="aftersales-detail-grid">
                  <view class="aftersales-panel" :class="`aftersales-panel--${getRefundTone(getRefundStage(entry))}`">
                    <text class="aftersales-panel__label">退款</text>
                    <text class="aftersales-panel__value">{{ getRefundProgressStageLabel(getRefundStage(entry)) }}</text>
                    <text class="aftersales-panel__hint">{{ getRefundPanelHint(entry) }}</text>
                  </view>

                  <view class="aftersales-panel" :class="`aftersales-panel--${getComplaintTone((getPrimaryComplaint(entry) ?? getLatestComplaint(entry))?.status)}`">
                    <text class="aftersales-panel__label">投诉</text>
                    <text class="aftersales-panel__value">{{ getComplaintPanelValue(entry) }}</text>
                    <text class="aftersales-panel__hint">{{ getComplaintPanelHint(entry) }}</text>
                  </view>

                  <view class="aftersales-panel" :class="`aftersales-panel--${getConversationUnreadCount(entry.order.conversation, 'owner') > 0 ? 'warning' : 'default'}`">
                    <text class="aftersales-panel__label">沟通</text>
                    <text class="aftersales-panel__value">{{ getMessagePillValue(entry) }}</text>
                    <text class="aftersales-panel__hint">{{ getMessagePanelHint(entry) }}</text>
                  </view>
                </view>

                <view v-if="getLatestDetailNote(entry)" class="aftersales-note">
                  <text>{{ getLatestDetailNote(entry) }}</text>
                </view>

                <view v-if="getLatestComplaintLog(entry)" class="aftersales-log">
                  <view class="aftersales-log__header">
                    <text class="aftersales-log__title">{{ getLatestComplaintLog(entry)?.operatorNickname || '平台处理' }}</text>
                    <text class="aftersales-log__meta">{{ formatDateTime(getLatestComplaintLog(entry)?.createdAt || '') }}</text>
                  </view>
                  <text v-if="getLatestComplaintLog(entry)?.note" class="aftersales-log__note">
                    {{ getLatestComplaintLog(entry)?.note }}
                  </text>
                </view>

                <view class="aftersales-item__actions">
                  <AppButton size="medium" type="info" @click="openOrderDetail(entry.order.id, 'chat')">
                    联系
                  </AppButton>
                  <AppButton
                    size="medium"
                    :type="entry.priority === 'HIGH' ? 'danger' : 'primary'"
                    @click="openPrimaryAction(entry)"
                  >
                    {{ getPrimaryActionLabel(entry) }}
                  </AppButton>
                </view>
              </view>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="aftersales-empty">
            <AppStatus
              :mode="loading ? 'loading' : 'empty'"
              :text="loading ? '正在整理售后队列' : focusCard ? '当前筛选下没有其他订单，需要处理的都在上面。' : '当前筛选下没有售后订单'"
            />
          </view>
        </template>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后查看售后">
        <view class="aftersales-empty aftersales-empty--login">
          <AppStatus text="登录后查看退款、投诉和争议订单。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.aftersales-focus,
.aftersales-summary__card,
.aftersales-panel,
.aftersales-item,
.aftersales-log {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.aftersales-focus {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.aftersales-focus__copy,
.aftersales-item__copy,
.aftersales-item__details,
.aftersales-log,
.aftersales-empty {
  display: grid;
  gap: 10rpx;
}

.aftersales-focus__tags,
.aftersales-focus__actions,
.aftersales-toolbar,
.aftersales-item__tags,
.aftersales-item__actions,
.aftersales-pill-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.aftersales-focus__title,
.aftersales-item__title {
  color: var(--app-text);
  font-size: 32rpx;
  line-height: 1.25;
  font-weight: 700;
}

.aftersales-focus__meta,
.aftersales-focus__summary,
.aftersales-item__meta,
.aftersales-item__summary,
.aftersales-summary__label,
.aftersales-summary__hint,
.aftersales-panel__label,
.aftersales-panel__hint,
.aftersales-item__toggle,
.aftersales-log__meta,
.aftersales-note {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.aftersales-focus__summary,
.aftersales-item__summary {
  color: var(--app-text);
}

.aftersales-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.aftersales-summary__card,
.aftersales-panel {
  padding: 20rpx;
  gap: 10rpx;
}

.aftersales-summary__card--primary,
.aftersales-panel--primary,
.aftersales-pill--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.aftersales-summary__card--success,
.aftersales-panel--success,
.aftersales-pill--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.aftersales-summary__card--warning,
.aftersales-panel--warning,
.aftersales-pill--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.aftersales-summary__card--danger,
.aftersales-panel--danger,
.aftersales-pill--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.aftersales-summary__value,
.aftersales-panel__value {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.aftersales-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.aftersales-note {
  padding: 18rpx 20rpx;
  border-radius: var(--app-shape-lg);
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface-soft);
}

.aftersales-item {
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.aftersales-item--expanded {
  box-shadow: var(--app-elevation-2);
  border-color: rgba(53, 89, 224, 0.16);
}

.aftersales-item__overview {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
}

.aftersales-item__aside {
  display: grid;
  gap: 10rpx;
  justify-items: end;
}

.aftersales-item__toggle {
  color: var(--app-accent);
  font-weight: 600;
}

.aftersales-pill {
  display: inline-grid;
  gap: 4rpx;
  min-height: 68rpx;
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
}

.aftersales-pill--default {
  background: var(--app-surface);
}

.aftersales-pill__label {
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 1.2;
}

.aftersales-pill__value {
  color: var(--app-text);
  font-size: 22rpx;
  line-height: 1.3;
  font-weight: 700;
}

.aftersales-log__header {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.aftersales-log__title {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.4;
  font-weight: 600;
}

.aftersales-log__note {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

.aftersales-queue {
  display: grid;
  gap: 16rpx;
}

.aftersales-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .aftersales-summary,
  .aftersales-detail-grid {
    grid-template-columns: 1fr;
  }

  .aftersales-item__overview,
  .aftersales-log__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .aftersales-item__aside {
    justify-items: start;
  }
}
</style>
