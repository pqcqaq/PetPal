<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已提交退款或正在回看退款结果的主人
 * Entry: 售后中心退款队列、订单详情售后分栏、退款结果回流
 * Core scenes:
 * 1. 首屏直接告诉用户退款现在在哪个阶段、已退多少、还剩多少可退
 * 2. 驳回、失败和部分退款必须给出明确下一步，避免用户自己猜该回订单还是继续售后
 * 3. 历史退款记录留在同页回看，不再要求用户翻订单长页时间线
 * Primary action: 进入当前退款阶段对应的下一步
 * Secondary actions: 看沟通、回售后中心、回订单
 * Feedback: 退款阶段、最新退款金额、可退余额、投诉联动、历史退款记录
 * States: 加载中、无退款、待审核、待退款、部分退款成功、退款完成、驳回、失败
 */
import type {
  ComplaintRecord,
  ComplaintStatus,
  OrderDetailRecord,
  OrderRefundProgressRecord,
  RefundProgressStage,
  RefundRecordDetail,
  RefundStatus,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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

interface ResultSignalCard {
  key: string
  title: string
  value: string
  hint: string
  tone: ViewTone
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

const resultHeadline = computed(() => {
  if (!order.value) {
    return '正在同步退款结果'
  }
  if (refundStage.value === 'PENDING_REVIEW') {
    return '退款已提交'
  }
  if (refundStage.value === 'APPROVED_WAITING') {
    return '退款处理中'
  }
  if (refundStage.value === 'PARTIAL_SUCCESS') {
    return '已退回部分金额'
  }
  if (refundStage.value === 'FULL_SUCCESS') {
    return '退款已完成'
  }
  if (refundStage.value === 'REJECTED') {
    return '退款未通过'
  }
  if (refundStage.value === 'FAILED') {
    return '退款处理失败'
  }
  return '当前没有退款申请'
})

const resultSummary = computed(() => {
  if (!order.value) {
    return '正在同步这笔订单的退款结果。'
  }
  if (refundStage.value === 'PENDING_REVIEW') {
    return '退款申请已经提交，现在先保留沟通和服务证据，等待平台审核。'
  }
  if (refundStage.value === 'APPROVED_WAITING') {
    return '退款已经通过审核，下一步只需要等待退款渠道到账。'
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

const signalCards = computed<ResultSignalCard[]>(() => {
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
      title: '退款结果',
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
      title: '金额进度',
      value: `可退 ¥${formatAmount(refundableBalance.value)}`,
      hint: `申请 ¥${formatAmount(requestedRefundAmount.value)} · 已退 ¥${formatAmount(settledRefundAmount.value)}`,
      tone: refundableBalance.value > 0 ? 'warning' : 'success',
    },
    {
      key: 'follow-up',
      title: '后续处理',
      value: activeComplaint.value
        ? `${getComplaintTypeLabel(activeComplaint.value.complaintType)} · ${getComplaintStatusLabel(activeComplaint.value.status)}`
        : unreadCount.value > 0
          ? `${unreadCount.value} 条未读`
          : '当前无投诉',
      hint: activeComplaint.value
        ? `最近更新 ${formatDateTime(activeComplaint.value.updatedAt)}`
        : order.value.conversation?.lastMessageAt
          ? `最近沟通 ${formatDateTime(order.value.conversation.lastMessageAt)}`
          : refundStage.value === 'REJECTED' || refundStage.value === 'FAILED'
            ? '如对结果有异议，可直接发起投诉'
            : '需要时可返回订单继续沟通',
      tone: activeComplaint.value ? 'danger' : unreadCount.value > 0 ? 'warning' : 'default',
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

const contextActionLabel = computed(() => {
  if (!order.value) {
    return '订单详情'
  }
  if (refundStage.value === 'PENDING_REVIEW' || refundStage.value === 'APPROVED_WAITING' || refundStage.value === 'PARTIAL_SUCCESS') {
    return '售后中心'
  }
  return '订单详情'
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

function openContextAction() {
  if (refundStage.value === 'PENDING_REVIEW' || refundStage.value === 'APPROVED_WAITING' || refundStage.value === 'PARTIAL_SUCCESS') {
    openAftersales()
    return
  }
  openOrderDetail('aftersales')
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
      <template v-if="loading && !order">
        <AppSection title="同步退款结果">
          <AppStatus mode="loading" text="正在同步退款和订单状态" />
        </AppSection>
      </template>

      <template v-else-if="order">
        <template v-if="hasRefundActivity">
          <AppSection title="退款结果">
            <view class="refund-result-focus">
              <view class="refund-result-focus__copy">
                <view class="refund-result-focus__tags">
                  <AppTag
                    v-for="tag in heroTags"
                    :key="tag.label"
                    :type="tag.type"
                  >
                    {{ tag.label }}
                  </AppTag>
                </view>
                <text class="refund-result-focus__title">{{ resultHeadline }}</text>
                <text class="refund-result-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
                <text class="refund-result-focus__meta">订单已付 ¥{{ formatAmount(order.amountPaid) }} · 已退 ¥{{ formatAmount(settledRefundAmount) }}</text>
                <text class="refund-result-focus__summary">{{ resultSummary }}</text>
              </view>

              <view class="refund-result-signal-grid">
                <view
                  v-for="signal in signalCards"
                  :key="signal.key"
                  class="refund-result-signal"
                  :class="`refund-result-signal--${signal.tone}`"
                >
                  <text class="refund-result-signal__title">{{ signal.title }}</text>
                  <text class="refund-result-signal__value">{{ signal.value }}</text>
                  <text class="refund-result-signal__hint">{{ signal.hint }}</text>
                </view>
              </view>
            </view>
          </AppSection>

          <AppSection title="当前订单">
            <AppList>
              <AppListItem
                title="服务类型"
                :label="serviceTypeLabels[order.serviceType]"
                :value="getOrderStatusLabel(order.orderStatus)"
                value-emphasis
              />
              <AppListItem
                title="服务时间"
                :label="formatRange(order.appointmentStart, order.appointmentEnd)"
                :value="formatAmount(order.amountPaid)"
              >
                <template #value>
                  <text class="refund-result-list-value refund-result-list-value--strong">已付 ¥{{ formatAmount(order.amountPaid) }}</text>
                </template>
              </AppListItem>
              <AppListItem
                title="退款进度"
                :label="getRefundProgressStageHint(refundStage)"
                :value="getRefundProgressStageLabel(refundStage)"
                value-emphasis
              />
              <AppListItem
                title="可退余额"
                :label="`已退 ¥${formatAmount(settledRefundAmount)} · 申请 ¥${formatAmount(requestedRefundAmount)}`"
                :value="`¥${formatAmount(refundableBalance)}`"
                value-emphasis
              />
              <AppListItem
                v-if="activeComplaint"
                title="投诉联动"
                :label="`${getComplaintTypeLabel(activeComplaint.complaintType)} · 最近更新 ${formatDateTime(activeComplaint.updatedAt)}`"
                :value="getComplaintStatusLabel(activeComplaint.status)"
                value-emphasis
              />
            </AppList>
          </AppSection>

          <AppSection v-if="refundProgress?.latestRefundNo || latestRefund" title="最近退款">
            <AppList>
              <AppListItem
                title="退款单号"
                :label="refundProgress?.latestReviewedAt || refundProgress?.latestAppliedAt || latestRefund?.reviewedAt || latestRefund?.updatedAt || latestRefund?.createdAt ? formatDateTime(refundProgress?.latestReviewedAt || refundProgress?.latestAppliedAt || latestRefund?.reviewedAt || latestRefund?.updatedAt || latestRefund?.createdAt || '') : '等待同步时间'"
                :value="refundProgress?.latestRefundNo || latestRefund?.refundNo || '--'"
                value-emphasis
              />
              <AppListItem
                title="最近金额"
                :label="refundProgress?.latestRefundReason || latestRefund?.refundReason || '当前没有补充退款原因'"
                :value="`¥${formatAmount(latestRefundAmount)}`"
                value-emphasis
              />
              <AppListItem
                v-if="refundProgress?.latestRefundStatus || latestRefund?.refundStatus"
                title="处理状态"
                :label="refundProgress?.latestReviewedAt ? `审核于 ${formatDateTime(refundProgress.latestReviewedAt)}` : latestRefund?.reviewedAt ? `审核于 ${formatDateTime(latestRefund.reviewedAt)}` : '等待审核或到账回执'"
                :value="refundStatusLabels[refundProgress?.latestRefundStatus || latestRefund?.refundStatus || 'PENDING']"
                value-emphasis
              />
            </AppList>
          </AppSection>

          <AppSection v-if="sortedRefunds.length" :title="`退款记录 (${sortedRefunds.length})`">
            <AppList>
              <AppListItem
                v-for="refund in sortedRefunds"
                :key="refund.id"
                :title="refund.refundNo"
                :label="getRefundRecordHint(refund)"
                :value="`¥${formatAmount(refund.refundAmount)}`"
              >
                <template #value>
                  <view class="refund-result-payment-value">
                    <AppTag :type="getRefundStatusTone(refund.refundStatus)">
                      {{ refundStatusLabels[refund.refundStatus] }}
                    </AppTag>
                    <text class="refund-result-payment-value__amount">¥{{ formatAmount(refund.refundAmount) }}</text>
                  </view>
                </template>
              </AppListItem>
            </AppList>
          </AppSection>

          <view class="refund-result-actions">
            <AppButton block :type="refundStage === 'REJECTED' || refundStage === 'FAILED' ? 'danger' : 'primary'" @click="openPrimaryAction">
              {{ primaryActionLabel }}
            </AppButton>
            <AppButton block type="info" @click="openOrderDetail('chat')">
              {{ unreadCount > 0 ? `看沟通 (${unreadCount})` : '去沟通' }}
            </AppButton>
            <AppButton block type="info" @click="openContextAction">
              {{ contextActionLabel }}
            </AppButton>
          </view>
        </template>

        <template v-else>
          <AppSection title="当前没有退款">
            <AppStatus text="这笔订单当前没有可回看的退款结果。" />
          </AppSection>
          <view class="refund-result-actions">
            <AppButton block type="info" @click="openOrderDetail('aftersales')">返回订单售后</AppButton>
            <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
          </view>
        </template>
      </template>

      <template v-else>
        <AppSection title="退款结果不可用">
          <AppStatus :text="error || '订单不存在或暂时无法查看退款结果'" />
        </AppSection>
        <view class="refund-result-actions">
          <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后查看退款结果">
        <AppStatus text="登录后查看退款结果和下一步动作。" />
      </AppSection>
      <view class="refund-result-actions">
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.refund-result-focus,
.refund-result-signal {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.refund-result-focus {
  background:
    radial-gradient(circle at top right, rgba(236, 163, 31, 0.18), transparent 36%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.refund-result-focus__copy {
  display: grid;
  gap: 10rpx;
}

.refund-result-focus__tags,
.refund-result-payment-value {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.refund-result-focus__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.25;
  font-weight: 700;
}

.refund-result-focus__meta,
.refund-result-focus__summary,
.refund-result-signal__title,
.refund-result-signal__hint,
.refund-result-list-value {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.refund-result-focus__summary {
  color: var(--app-text);
}

.refund-result-list-value--strong {
  color: var(--app-text);
  font-weight: 600;
}

.refund-result-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.refund-result-signal {
  padding: 18rpx 20rpx;
  gap: 10rpx;
}

.refund-result-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.refund-result-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.refund-result-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.refund-result-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.refund-result-signal__value,
.refund-result-payment-value__amount {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.refund-result-actions {
  padding: 0 32rpx 12rpx;
}

.refund-result-actions .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .refund-result-signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
