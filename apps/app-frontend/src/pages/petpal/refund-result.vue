<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已提交退款或正在回看退款结果的主人
 * Entry: 售后中心退款队列、订单详情售后分栏、退款结果回流
 * First screen: 先确认退款在哪个阶段、已经退了多少、下一步做什么
 * Primary action: 进入当前退款阶段对应的下一步
 * Secondary actions: 看售后上下文、看沟通
 * States: 加载中、无退款、待审核、待退款、部分退款、退款完成、驳回、失败
 */
import type {
  ComplaintRecord,
  OrderDetailRecord,
  OrderRefundProgressRecord,
  RefundProgressStage,
  RefundRecordDetail,
  RefundStatus,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getOrderComplaints, getOrderDetail, getOrderRefundProgress } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatDateTime,
  formatRange,
  getComplaintStatusLabel,
  getComplaintTypeLabel,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getRefundProgressStageHint,
  getRefundProgressStageLabel,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_ORDER_COMPLAINT_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
  PETPAL_REVIEW_RESULT_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalRefundResultPage',
})

definePage({
  style: {
    navigationBarTitleText: '退款结果',
    enablePullDownRefresh: true,
  },
})

type ViewTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

type SignalCard = {
  key: string
  title: string
  value: string
  hint: string
  tone: ViewTone
}

type SummaryRow = {
  title: string
  value: string
  hint: string
}

const tokenStore = useTokenStore()

const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const refundProgress = ref<OrderRefundProgressRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])
const loading = ref(false)
const error = ref('')

const refundStatusLabels: Record<RefundStatus, string> = {
  PENDING: '待审核',
  APPROVED: '待退款',
  REJECTED: '已驳回',
  SUCCESS: '已退款',
  FAILED: '退款失败',
}

const sortedRefunds = computed(() => {
  if (!order.value) {
    return []
  }

  return [...order.value.refunds].sort((left, right) => {
    const leftTime = new Date(left.reviewedAt || left.updatedAt || left.createdAt).getTime()
    const rightTime = new Date(right.reviewedAt || right.updatedAt || right.createdAt).getTime()
    return rightTime - leftTime
  })
})

const latestRefund = computed(() => sortedRefunds.value[0] ?? null)
const activeComplaint = computed(() => complaints.value.find(item => (
  item.status === 'OPEN' || item.status === 'PROCESSING'
)) ?? null)

const settledRefundAmount = computed(() => {
  if (refundProgress.value) {
    return Number(refundProgress.value.settledRefundAmount ?? 0)
  }
  return Number(order.value?.amountRefunded ?? 0)
})

const refundableBalance = computed(() => {
  if (refundProgress.value) {
    return Number(refundProgress.value.refundableBalance ?? 0)
  }

  const paidAmount = Number(order.value?.amountPaid ?? 0)
  return Number(Math.max(0, paidAmount - settledRefundAmount.value).toFixed(2))
})

const requestedRefundAmount = computed(() => {
  if (refundProgress.value) {
    return Number(refundProgress.value.requestedRefundAmount ?? 0)
  }
  return Number(latestRefund.value?.refundAmount ?? 0)
})

const latestRefundAmount = computed(() => {
  if (refundProgress.value?.latestRefundAmount != null) {
    return Number(refundProgress.value.latestRefundAmount)
  }
  return Number(latestRefund.value?.refundAmount ?? 0)
})

const unreadCount = computed(() => getConversationUnreadCount(order.value?.conversation, 'owner'))

function inferRefundStage(): RefundProgressStage {
  if (refundProgress.value) {
    return refundProgress.value.stage
  }

  if (!latestRefund.value) {
    return settledRefundAmount.value > 0
      ? (refundableBalance.value > 0 ? 'PARTIAL_SUCCESS' : 'FULL_SUCCESS')
      : 'NONE'
  }

  if (latestRefund.value.refundStatus === 'PENDING') return 'PENDING_REVIEW'
  if (latestRefund.value.refundStatus === 'APPROVED') return 'APPROVED_WAITING'
  if (latestRefund.value.refundStatus === 'REJECTED') return 'REJECTED'
  if (latestRefund.value.refundStatus === 'FAILED') return 'FAILED'
  return refundableBalance.value > 0 ? 'PARTIAL_SUCCESS' : 'FULL_SUCCESS'
}

const refundStage = computed<RefundProgressStage>(() => inferRefundStage())

const hasRefundActivity = computed(() => Boolean(
  refundStage.value !== 'NONE'
  || sortedRefunds.value.length > 0
  || settledRefundAmount.value > 0,
))

function getStageTone(stage: RefundProgressStage): ViewTone {
  if (stage === 'FULL_SUCCESS') return 'success'
  if (stage === 'APPROVED_WAITING') return 'primary'
  if (stage === 'PENDING_REVIEW' || stage === 'PARTIAL_SUCCESS' || stage === 'REJECTED') return 'warning'
  if (stage === 'FAILED') return 'danger'
  return 'default'
}

function getRefundStatusTone(status: RefundStatus): ViewTone {
  if (status === 'SUCCESS') return 'success'
  if (status === 'APPROVED') return 'primary'
  if (status === 'PENDING') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'default'
}

const stageTone = computed<ViewTone>(() => getStageTone(refundStage.value))

const focusTitle = computed(() => {
  if (!order.value) {
    return '正在同步退款结果'
  }
  if (refundStage.value === 'PENDING_REVIEW') return '退款已提交'
  if (refundStage.value === 'APPROVED_WAITING') return '退款处理中'
  if (refundStage.value === 'PARTIAL_SUCCESS') return '已退回部分金额'
  if (refundStage.value === 'FULL_SUCCESS') return '退款已完成'
  if (refundStage.value === 'REJECTED') return '退款未通过'
  if (refundStage.value === 'FAILED') return '退款处理失败'
  return '当前没有退款申请'
})

const focusSummary = computed(() => {
  if (!order.value) {
    return '正在同步这笔订单的退款结果。'
  }
  if (refundStage.value === 'PENDING_REVIEW') {
    return '退款申请已经提交，现在先保留沟通和服务证据，等待平台审核。'
  }
  if (refundStage.value === 'APPROVED_WAITING') {
    return '退款已经通过审核，下一步只需要等待渠道到账。'
  }
  if (refundStage.value === 'PARTIAL_SUCCESS') {
    return '这单已经退回部分金额，剩余争议或余额可以继续在售后里处理。'
  }
  if (refundStage.value === 'FULL_SUCCESS') {
    return '退款金额已经结清，下一步回订单查看后续状态即可。'
  }
  if (refundStage.value === 'REJECTED') {
    return '本次退款没有通过，先看原因，再决定补充说明还是发起投诉。'
  }
  if (refundStage.value === 'FAILED') {
    return '退款处理失败，优先联系平台或继续投诉跟进渠道结果。'
  }
  return '当前还没有退款申请，可以返回订单继续查看售后。'
})

const heroTags = computed(() => {
  if (!order.value) {
    return []
  }

  const tags: Array<{ label: string, type: ViewTone }> = [
    {
      label: getRefundProgressStageLabel(refundStage.value),
      type: stageTone.value,
    },
    {
      label: serviceTypeLabels[order.value.serviceType],
      type: 'primary',
    },
    {
      label: getOrderStatusLabel(order.value.orderStatus),
      type: order.value.orderStatus === 'REFUNDED' ? 'success' : 'default',
    },
  ]

  if (activeComplaint.value) {
    tags.push({
      label: `投诉${getComplaintStatusLabel(activeComplaint.value.status)}`,
      type: activeComplaint.value.status === 'PROCESSING' ? 'danger' : 'warning',
    })
  }
  else if (unreadCount.value > 0) {
    tags.push({
      label: `${unreadCount.value} 条未读`,
      type: 'warning',
    })
  }

  return tags
})

const signalCards = computed<SignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  const latestStatus = refundProgress.value?.latestRefundStatus ?? latestRefund.value?.refundStatus ?? null
  const latestTime = refundProgress.value?.latestReviewedAt
    || refundProgress.value?.latestAppliedAt
    || latestRefund.value?.reviewedAt
    || latestRefund.value?.updatedAt
    || latestRefund.value?.createdAt
    || null

  return [
    {
      key: 'result',
      title: '结果',
      value: refundStage.value === 'FULL_SUCCESS' || refundStage.value === 'PARTIAL_SUCCESS'
        ? `已退 ¥${formatAmount(settledRefundAmount.value)}`
        : latestRefundAmount.value > 0
          ? `最近 ¥${formatAmount(latestRefundAmount.value)}`
          : getRefundProgressStageLabel(refundStage.value),
      hint: latestStatus
        ? `${refundStatusLabels[latestStatus]}${latestTime ? ` · ${formatDateTime(latestTime)}` : ''}`
        : getRefundProgressStageHint(refundStage.value),
      tone: stageTone.value,
    },
    {
      key: 'amount',
      title: '金额',
      value: `可退 ¥${formatAmount(refundableBalance.value)}`,
      hint: `申请 ¥${formatAmount(requestedRefundAmount.value)} · 已退 ¥${formatAmount(settledRefundAmount.value)}`,
      tone: refundableBalance.value > 0 ? 'warning' : 'success',
    },
    {
      key: 'follow',
      title: '后续',
      value: activeComplaint.value
        ? `${getComplaintTypeLabel(activeComplaint.value.complaintType)} · ${getComplaintStatusLabel(activeComplaint.value.status)}`
        : unreadCount.value > 0
          ? `${unreadCount.value} 条未读`
          : '当前无投诉',
      hint: activeComplaint.value
        ? `最近更新 ${formatDateTime(activeComplaint.value.updatedAt)}`
        : order.value.conversation?.lastMessageAt
          ? `最近沟通 ${formatDateTime(order.value.conversation.lastMessageAt)}`
          : '需要时可返回订单继续沟通',
      tone: activeComplaint.value ? 'danger' : unreadCount.value > 0 ? 'warning' : 'default',
    },
  ]
})

const summaryRows = computed<SummaryRow[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      title: '订单号',
      value: order.value.orderNo,
      hint: formatRange(order.value.appointmentStart, order.value.appointmentEnd),
    },
    {
      title: '退款进度',
      value: getRefundProgressStageLabel(refundStage.value),
      hint: getRefundProgressStageHint(refundStage.value),
    },
    {
      title: '金额汇总',
      value: `已退 ¥${formatAmount(settledRefundAmount.value)}`,
      hint: `已付 ¥${formatAmount(order.value.amountPaid)} · 可退 ¥${formatAmount(refundableBalance.value)}`,
    },
  ]
})

const primaryActionLabel = computed(() => {
  if (!order.value || !hasRefundActivity.value) {
    return '返回售后中心'
  }
  if (refundStage.value === 'REJECTED' || refundStage.value === 'FAILED') {
    return activeComplaint.value ? '看投诉进度' : '发起投诉'
  }
  if (refundStage.value === 'PENDING_REVIEW' || refundStage.value === 'APPROVED_WAITING') {
    return '返回售后处理'
  }
  if (refundStage.value === 'PARTIAL_SUCCESS') {
    return refundableBalance.value > 0 ? '继续处理售后' : '返回订单'
  }
  if (refundStage.value === 'FULL_SUCCESS' && order.value.orderStatus === 'COMPLETED') {
    return order.value.review ? '查看评价结果' : '去写评价'
  }
  return '返回订单'
})

const secondaryActionLabel = computed(() => {
  if (refundStage.value === 'PENDING_REVIEW' || refundStage.value === 'APPROVED_WAITING' || refundStage.value === 'PARTIAL_SUCCESS') {
    return '售后上下文'
  }
  return unreadCount.value > 0 ? '看沟通' : '订单详情'
})

function getRefundRecordHint(refund: RefundRecordDetail) {
  const time = refund.reviewedAt || refund.updatedAt || refund.createdAt
  return `${refund.refundReason}${time ? ` · ${formatDateTime(time)}` : ''}`
}

function openOrderDetail(tab: 'overview' | 'chat' | 'service' | 'aftersales' = 'overview') {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${order.value.id}&tab=${tab}` })
}

function openAftersales() {
  uni.redirectTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openComplaintPage() {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_COMPLAINT_PAGE}?id=${order.value.id}` })
}

function openReviewPage() {
  if (!order.value) {
    return
  }
  const targetPage = order.value.review ? PETPAL_REVIEW_RESULT_PAGE : PETPAL_ORDER_REVIEW_PAGE
  uni.redirectTo({ url: `${targetPage}?id=${order.value.id}` })
}

function openPrimaryAction() {
  if (!order.value || !hasRefundActivity.value) {
    openAftersales()
    return
  }

  if (refundStage.value === 'REJECTED' || refundStage.value === 'FAILED') {
    openComplaintPage()
    return
  }

  if (refundStage.value === 'PENDING_REVIEW' || refundStage.value === 'APPROVED_WAITING') {
    openAftersales()
    return
  }

  if (refundStage.value === 'PARTIAL_SUCCESS') {
    if (refundableBalance.value > 0 || activeComplaint.value) {
      openAftersales()
      return
    }
    openOrderDetail('overview')
    return
  }

  if (refundStage.value === 'FULL_SUCCESS' && order.value.orderStatus === 'COMPLETED') {
    openReviewPage()
    return
  }

  openOrderDetail('overview')
}

function openSecondaryAction() {
  if (!order.value) {
    openAftersales()
    return
  }

  if (refundStage.value === 'PENDING_REVIEW' || refundStage.value === 'APPROVED_WAITING' || refundStage.value === 'PARTIAL_SUCCESS') {
    openOrderDetail('aftersales')
    return
  }

  if (unreadCount.value > 0) {
    openOrderDetail('chat')
    return
  }

  openOrderDetail('overview')
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || !orderId.value || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  error.value = ''
  try {
    const [detailResult, refundProgressResult, complaintsResult] = await Promise.allSettled([
      getOrderDetail(orderId.value),
      getOrderRefundProgress(orderId.value),
      getOrderComplaints(orderId.value),
    ])

    if (detailResult.status !== 'fulfilled') {
      throw detailResult.reason
    }

    order.value = detailResult.value
    refundProgress.value = refundProgressResult.status === 'fulfilled' ? refundProgressResult.value : null
    complaints.value = complaintsResult.status === 'fulfilled' ? complaintsResult.value : []
  }
  catch (cause: unknown) {
    order.value = null
    refundProgress.value = null
    complaints.value = []
    error.value = getErrorMessage(cause, '加载退款结果失败')
    if (showError) {
      uni.showToast({ title: error.value, icon: 'none' })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onLoad((options: Record<string, string | undefined>) => {
  orderId.value = options.orderId || options.id || ''
})

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
  <AppPageShell title="退款结果">
    <template v-if="tokenStore.hasLogin">
      <view v-if="loading && !order" class="refund-empty">
        <AppStatus mode="loading" text="正在同步退款结果" />
      </view>

      <view v-else-if="order && hasRefundActivity" class="refund-page">
        <view class="refund-focus">
          <view class="refund-focus__copy">
            <view class="refund-focus__tags">
              <AppTag
                v-for="tag in heroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <text class="refund-focus__title">{{ focusTitle }}</text>
            <text class="refund-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="refund-focus__summary">{{ focusSummary }}</text>
          </view>

          <view class="refund-focus__actions">
            <AppButton size="medium" :type="refundStage === 'REJECTED' || refundStage === 'FAILED' ? 'danger' : 'primary'" @click="openPrimaryAction">
              {{ primaryActionLabel }}
            </AppButton>
            <AppButton size="medium" type="info" @click="openSecondaryAction">
              {{ secondaryActionLabel }}
            </AppButton>
          </view>
        </view>

        <view class="refund-signal-grid">
          <view
            v-for="signal in signalCards"
            :key="signal.key"
            class="refund-signal"
            :class="`refund-signal--${signal.tone}`"
          >
            <text class="refund-signal__title">{{ signal.title }}</text>
            <text class="refund-signal__value">{{ signal.value }}</text>
            <text class="refund-signal__hint">{{ signal.hint }}</text>
          </view>
        </view>

        <view class="refund-group">
          <view
            v-for="item in summaryRows"
            :key="item.title"
            class="refund-row"
          >
            <view class="refund-row__copy">
              <text class="refund-row__title">{{ item.title }}</text>
              <text class="refund-row__hint">{{ item.hint }}</text>
            </view>
            <text class="refund-row__value">{{ item.value }}</text>
          </view>

          <view v-if="activeComplaint" class="refund-row">
            <view class="refund-row__copy">
              <text class="refund-row__title">投诉联动</text>
              <text class="refund-row__hint">{{ getComplaintTypeLabel(activeComplaint.complaintType) }} · 最近更新 {{ formatDateTime(activeComplaint.updatedAt) }}</text>
            </view>
            <text class="refund-row__value">{{ getComplaintStatusLabel(activeComplaint.status) }}</text>
          </view>
        </view>

        <view v-if="sortedRefunds.length" class="refund-group">
          <view class="refund-group__head">
            <text class="refund-group__title">退款记录</text>
            <AppTag type="default">{{ sortedRefunds.length }} 条</AppTag>
          </view>

          <view class="refund-record-list">
            <view
              v-for="refund in sortedRefunds"
              :key="refund.id"
              class="refund-row"
            >
              <view class="refund-row__copy">
                <text class="refund-row__title">{{ refund.refundNo }}</text>
                <text class="refund-row__hint">{{ getRefundRecordHint(refund) }}</text>
              </view>
              <view class="refund-row__meta">
                <AppTag :type="getRefundStatusTone(refund.refundStatus)">
                  {{ refundStatusLabels[refund.refundStatus] }}
                </AppTag>
                <text class="refund-row__value">¥{{ formatAmount(refund.refundAmount) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="order" class="refund-empty">
        <AppStatus text="这笔订单当前没有可回看的退款结果。" />
        <AppButton block type="info" @click="openOrderDetail('aftersales')">返回订单售后</AppButton>
        <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
      </view>

      <view v-else class="refund-empty">
        <AppStatus :text="error || '订单不存在或暂时无法查看退款结果'" />
        <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
      </view>
    </template>

    <template v-else>
      <view class="refund-empty">
        <AppStatus text="登录后查看退款结果和下一步。" />
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.refund-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.refund-focus,
.refund-group,
.refund-empty {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.refund-focus {
  background:
    radial-gradient(circle at top right, rgba(236, 163, 31, 0.18), transparent 36%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.refund-focus__copy,
.refund-row__copy {
  display: grid;
  gap: 8rpx;
}

.refund-focus__tags,
.refund-focus__actions,
.refund-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
}

.refund-focus__title,
.refund-group__title,
.refund-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.refund-focus__meta,
.refund-focus__summary,
.refund-signal__title,
.refund-signal__hint,
.refund-row__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.refund-focus__summary {
  color: var(--app-text);
}

.refund-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  padding: 0 24rpx;
}

.refund-signal {
  display: grid;
  gap: 10rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  box-shadow: var(--app-elevation-1);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.refund-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.refund-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.refund-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.refund-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.refund-signal__value,
.refund-row__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.refund-group {
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
}

.refund-group__head,
.refund-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.refund-record-list {
  display: grid;
}

.refund-row {
  padding: 24rpx 0;
}

.refund-row + .refund-row {
  border-top: 1rpx solid var(--app-outline-variant);
}

.refund-empty {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

@media (max-width: 680px) {
  .refund-signal-grid {
    grid-template-columns: 1fr;
  }

  .refund-group__head,
  .refund-row {
    align-items: flex-start;
  }
}
</style>
