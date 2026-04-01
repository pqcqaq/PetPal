<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，正在处理退款、投诉或争议
 * Entry: 从首页、订单列表、订单详情进入售后
 * First screen: 先告诉用户哪几单最急，以及急在哪里
 * Primary action: 进入具体订单的售后分栏
 * Secondary actions: 查看沟通、返回订单列表
 * States: 无售后、处理中退款、处理中投诉、争议订单、已收尾订单
 */
import type {
  ComplaintRecord,
  ComplaintStatus,
  OrderRecord,
  OrderRefundProgressRecord,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
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
  formatAmount,
  formatDateTime,
  formatRange,
  getComplaintStatusLabel,
  getComplaintTypeLabel,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  getRefundProgressStageLabel,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
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
type AftersalesFilter = 'ALL' | 'HIGH' | 'REFUND' | 'COMPLAINT'

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

const tokenStore = useTokenStore()

const loading = ref(false)
const entries = ref<AftersalesOrderEntry[]>([])
const activeFilter = ref<AftersalesFilter>('HIGH')

const filterOptions = [
  { label: '优先处理', value: 'HIGH' },
  { label: '全部', value: 'ALL' },
  { label: '退款', value: 'REFUND' },
  { label: '投诉', value: 'COMPLAINT' },
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
    return Boolean(entry.refundProgress && entry.refundProgress.stage !== 'NONE')
  }
  return entry.complaints.length > 0
}))

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
  if (priority === 'HIGH') return '优先'
  if (priority === 'MEDIUM') return '跟进'
  return '回看'
}

function getPriorityTagType(priority: AftersalesPriority) {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}

function getOrderTagType(status: OrderRecord['orderStatus']) {
  return getOrderTone(status) === 'danger'
    ? 'danger'
    : getOrderTone(status) === 'warning'
      ? 'warning'
      : getOrderTone(status) === 'success'
        ? 'success'
        : 'default'
}

function getPrimaryComplaint(entry: AftersalesOrderView) {
  return entry.complaints.find(item => isComplaintActive(item.status)) ?? entry.complaints[0] ?? null
}

function getPriorityHint(entry: AftersalesOrderView) {
  if (entry.activeComplaintCount > 0) {
    return `${entry.activeComplaintCount} 条投诉处理中，先看证据和处理日志。`
  }

  const stage = entry.refundProgress?.stage

  if (stage === 'FAILED') {
    return '退款失败，需要立即核查。'
  }
  if (stage === 'REJECTED') {
    return '退款被驳回，需要补充说明。'
  }
  if (stage === 'PENDING_REVIEW') {
    return '退款刚提交，等待平台审核。'
  }
  if (stage === 'APPROVED_WAITING') {
    return '退款已通过审核，等待渠道处理。'
  }
  if (stage === 'PARTIAL_SUCCESS') {
    return '已完成部分退款，继续核对剩余争议。'
  }

  return '当前主要用于回看处理轨迹。'
}

function getLatestProgressText(entry: AftersalesOrderView) {
  const complaint = [...entry.complaints]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]

  if (complaint) {
    return `投诉更新 ${formatDateTime(complaint.updatedAt)}`
  }

  const latestRefundTime = entry.refundProgress?.latestReviewedAt || entry.refundProgress?.latestAppliedAt
  if (latestRefundTime) {
    return `退款更新 ${formatDateTime(latestRefundTime)}`
  }

  return `订单更新 ${formatDateTime(entry.order.updatedAt)}`
}

function openOrderDetail(orderId: string, tab: 'chat' | 'aftersales') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

function openOrders() {
  uni.redirectTo({ url: PETPAL_ORDERS_PAGE })
}

function openMessages() {
  uni.redirectTo({ url: PETPAL_MESSAGES_PAGE })
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
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
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

      <AppSection title="售后状态">
        <view class="aftersales-summary">
          <view class="aftersales-summary__card">
            <text class="aftersales-summary__label">售后订单</text>
            <text class="aftersales-summary__value">{{ orderCards.length }}</text>
          </view>
          <view class="aftersales-summary__card">
            <text class="aftersales-summary__label">退款处理中</text>
            <text class="aftersales-summary__value">{{ pendingRefundCount }}</text>
          </view>
          <view class="aftersales-summary__card">
            <text class="aftersales-summary__label">投诉处理中</text>
            <text class="aftersales-summary__value">{{ activeComplaintCount }}</text>
          </view>
          <view class="aftersales-summary__card">
            <text class="aftersales-summary__label">累计已退</text>
            <text class="aftersales-summary__value">¥{{ formatAmount(settledRefundAmount) }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="快速筛选">
        <AppChoiceChips v-model="activeFilter" :options="filterOptions" />
        <view class="aftersales-toolbar">
          <AppTag :type="unreadConversationCount > 0 ? 'warning' : 'default'">
            {{ unreadConversationCount > 0 ? `${unreadConversationCount} 条售后消息未读` : '沟通已读' }}
          </AppTag>
          <AppButton size="medium" type="info" @click="openOrders">订单列表</AppButton>
          <AppButton size="medium" @click="openMessages">消息</AppButton>
        </view>
      </AppSection>

      <AppSection :title="filteredCards.length ? `售后队列 (${filteredCards.length})` : '售后队列'">
        <view v-if="filteredCards.length" class="aftersales-list">
          <view v-for="entry in filteredCards" :key="entry.order.id" class="aftersales-row">
            <view class="aftersales-row__header">
              <view class="aftersales-row__copy">
                <text class="aftersales-row__title">{{ entry.order.orderNo }}</text>
                <text class="aftersales-row__meta">
                  {{ serviceTypeLabels[entry.order.serviceType] }} · {{ formatRange(entry.order.appointmentStart, entry.order.appointmentEnd) }}
                </text>
                <text class="aftersales-row__meta">{{ getLatestProgressText(entry) }}</text>
              </view>
              <view class="aftersales-row__tags">
                <AppTag :type="getPriorityTagType(entry.priority)">
                  {{ getPriorityLabel(entry.priority) }}
                </AppTag>
                <AppTag :type="getOrderTagType(entry.order.orderStatus)">
                  {{ getOrderStatusLabel(entry.order.orderStatus) }}
                </AppTag>
              </view>
            </view>

            <text class="aftersales-row__hint">{{ getPriorityHint(entry) }}</text>

            <view class="aftersales-row__signals">
              <view class="aftersales-signal">
                <text class="aftersales-signal__label">退款</text>
                <text class="aftersales-signal__value">
                  {{ entry.refundProgress && entry.refundProgress.stage !== 'NONE' ? getRefundProgressStageLabel(entry.refundProgress.stage) : '暂无退款' }}
                </text>
              </view>
              <view class="aftersales-signal">
                <text class="aftersales-signal__label">投诉</text>
                <text class="aftersales-signal__value">
                  {{ getPrimaryComplaint(entry) ? getComplaintTypeLabel(getPrimaryComplaint(entry)!.complaintType) : '暂无投诉' }}
                </text>
              </view>
              <view class="aftersales-signal">
                <text class="aftersales-signal__label">金额</text>
                <text class="aftersales-signal__value">已退 ¥{{ formatAmount(entry.order.amountRefunded) }}</text>
              </view>
            </view>

            <view class="aftersales-row__actions">
              <AppButton size="medium" type="info" @click="openOrderDetail(entry.order.id, 'chat')">沟通</AppButton>
              <AppButton size="medium" :type="entry.priority === 'HIGH' ? 'danger' : 'primary'" @click="openOrderDetail(entry.order.id, 'aftersales')">
                进入处理
              </AppButton>
            </view>
          </view>
        </view>
        <view v-else class="aftersales-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在整理售后队列' : '当前筛选下没有售后订单'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后查看售后">
        <view class="aftersales-empty aftersales-empty--login">
          <AppStatus text="登录后统一查看退款、投诉和争议订单。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.aftersales-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.aftersales-summary__card,
.aftersales-row,
.aftersales-signal {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.aftersales-summary__label,
.aftersales-row__meta,
.aftersales-row__hint,
.aftersales-signal__label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.aftersales-summary__value,
.aftersales-signal__value {
  color: var(--app-text);
  font-size: 38rpx;
  line-height: 1.1;
  font-weight: 700;
}

.aftersales-toolbar,
.aftersales-row__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.aftersales-list {
  display: grid;
  gap: 16rpx;
}

.aftersales-row__header {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.aftersales-row__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.aftersales-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.aftersales-row__tags {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.aftersales-row__signals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.aftersales-empty {
  padding: 8rpx 0;
}

.aftersales-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .aftersales-summary,
  .aftersales-row__signals {
    grid-template-columns: 1fr;
  }

  .aftersales-row__header {
    flex-direction: column;
  }
}
</style>
