<script lang="ts" setup>
import type {
  ComplaintRecord,
  ComplaintStatus,
  OrderRecord,
  OrderRefundProgressRecord,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
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

const highPriorityCards = computed(() => orderCards.value.filter(entry => entry.priority !== 'LOW').slice(0, 3))

const reminderCards = computed(() => {
  if (!orderCards.value.length) {
    return [
      {
        title: '当前没有售后事项',
        detail: '订单仍处于正常履约或已平稳结束，后续如有退款、投诉或争议会在这里集中展示。',
      },
    ]
  }

  const reminders = []

  if (activeComplaintCount.value > 0) {
    reminders.push({
      title: `有 ${activeComplaintCount.value} 条投诉正在处理`,
      detail: '优先查看争议订单，确认平台处理日志、补充证据和沟通记录是否完整。',
    })
  }

  if (pendingRefundCount.value > 0) {
    reminders.push({
      title: `${pendingRefundCount.value} 笔订单处于退款处理中`,
      detail: '重点关注待审核和待退款阶段，避免用户在订单详情和售后进度之间来回查找。',
    })
  }

  if (unreadConversationCount.value > 0) {
    reminders.push({
      title: `${unreadConversationCount.value} 条售后相关沟通未读`,
      detail: '先处理沟通补充说明，再决定是否进入具体订单的售后页继续跟进。',
    })
  }

  if (!reminders.length) {
    reminders.push({
      title: '售后事项已进入收尾阶段',
      detail: '当前主要是复核已退款或已结案订单，适合留档和回看处理过程。',
    })
  }

  return reminders
})

const summaryCards = computed(() => [
  {
    label: '跟进订单',
    value: String(orderCards.value.length),
    hint: orderCards.value.length ? '集中展示退款、投诉和争议相关订单。' : '当前没有需要跟进的售后订单。',
  },
  {
    label: '退款处理中',
    value: String(pendingRefundCount.value),
    hint: pendingRefundCount.value ? '存在待审核或待退款的订单。' : '当前没有处理中退款。',
  },
  {
    label: '投诉处理中',
    value: String(activeComplaintCount.value),
    hint: activeComplaintCount.value ? '优先查看平台处理中或待受理投诉。' : '当前没有进行中的投诉。',
  },
  {
    label: '累计已退',
    value: `¥${formatAmount(settledRefundAmount.value)}`,
    hint: '用于快速确认售后退款金额沉淀。',
  },
])

const pageDescription = computed(() => {
  if (!tokenStore.hasLogin) {
    return '登录后集中查看退款、投诉和争议订单，不再依赖订单详情深层跳转。'
  }

  return `当前有 ${orderCards.value.length} 笔售后跟进订单、${pendingRefundCount.value} 笔退款处理中订单和 ${activeComplaintCount.value} 条进行中投诉。`
})

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
  if (priority === 'MEDIUM') return '持续跟进'
  return '已进入收尾'
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

function getRefundStageTagType(stage: OrderRefundProgressRecord['stage'] | null | undefined) {
  if (stage === 'FAILED' || stage === 'REJECTED') return 'danger'
  if (stage === 'PENDING_REVIEW' || stage === 'APPROVED_WAITING' || stage === 'PARTIAL_SUCCESS') return 'warning'
  if (stage === 'FULL_SUCCESS') return 'success'
  return 'default'
}

function getComplaintTagType(status: ComplaintStatus) {
  if (status === 'OPEN' || status === 'PROCESSING') return 'warning'
  if (status === 'RESOLVED') return 'success'
  return 'default'
}

function getPrimaryComplaintStatus(complaints: ComplaintRecord[]) {
  return complaints.find(item => isComplaintActive(item.status))?.status
    ?? complaints[0]?.status
    ?? 'RESOLVED'
}

function getPriorityHint(entry: AftersalesOrderView) {
  if (entry.activeComplaintCount > 0) {
    return `当前有 ${entry.activeComplaintCount} 条投诉正在平台处理中，建议先核对证据与处理日志。`
  }

  const stage = entry.refundProgress?.stage

  if (stage === 'FAILED') {
    return '退款处理失败，需要尽快回看渠道结果与平台反馈。'
  }
  if (stage === 'REJECTED') {
    return '退款申请已被驳回，建议查看原因后决定是否继续沟通或补充说明。'
  }
  if (stage === 'PENDING_REVIEW') {
    return '退款申请已提交，当前处于平台审核阶段。'
  }
  if (stage === 'APPROVED_WAITING') {
    return '退款申请已经通过审核，等待退款渠道处理。'
  }
  if (stage === 'PARTIAL_SUCCESS') {
    return '本单已完成部分退款，可继续跟进剩余金额和投诉结论。'
  }
  if (stage === 'FULL_SUCCESS') {
    return '退款已经结清，当前主要用于留档和回看处理轨迹。'
  }

  return '当前以售后留痕和结果复核为主。'
}

function getLatestProgressText(entry: AftersalesOrderView) {
  const complaint = [...entry.complaints]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]

  if (complaint) {
    return `最近投诉更新于 ${formatDateTime(complaint.updatedAt)}`
  }

  const latestRefundTime = entry.refundProgress?.latestReviewedAt || entry.refundProgress?.latestAppliedAt
  if (latestRefundTime) {
    return `最近退款更新于 ${formatDateTime(latestRefundTime)}`
  }

  return `订单最后更新于 ${formatDateTime(entry.order.updatedAt)}`
}

function getRefundStageHint(stage: OrderRefundProgressRecord['stage']) {
  const hints: Record<OrderRefundProgressRecord['stage'], string> = {
    NONE: '当前暂无退款申请。',
    PENDING_REVIEW: '平台正在审核退款申请。',
    APPROVED_WAITING: '退款已通过审核，等待渠道处理。',
    PARTIAL_SUCCESS: '订单已完成部分退款。',
    FULL_SUCCESS: '退款已结清。',
    REJECTED: '退款申请已被驳回。',
    FAILED: '退款处理失败，请尽快复核。',
  }
  return hints[stage]
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
  <AppPageShell title="售后中心" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_AFTERSALES_PAGE"
        title="主人售后中心"
        description="把退款、投诉和争议订单从订单列表里抽离出来，优先处理最容易影响体验和信任的事项。"
      />

      <AppSection title="售后总览" description="第一屏只保留需要决策和跟进的售后信息。">
        <view class="aftersales-hero">
          <view class="aftersales-hero__copy">
            <AppTag type="danger">
              售后聚合视图
            </AppTag>
            <text class="aftersales-hero__title">退款、投诉、争议统一收口</text>
            <text class="aftersales-hero__summary">
              {{ orderCards.length ? `当前售后中心已聚合 ${orderCards.length} 笔订单，避免在订单详情和列表之间重复查找。` : '当前没有需要处理的售后事项。' }}
            </text>
          </view>
          <view class="aftersales-hero__actions">
            <AppButton size="medium" type="info" @click="openOrders">查看订单列表</AppButton>
            <AppButton size="medium" @click="openMessages">查看消息中心</AppButton>
          </view>
        </view>

        <view class="aftersales-summary-grid">
          <view v-for="item in summaryCards" :key="item.label" class="aftersales-summary-card">
            <text class="aftersales-summary-card__label">{{ item.label }}</text>
            <text class="aftersales-summary-card__value">{{ item.value }}</text>
            <text class="aftersales-summary-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="处理建议" description="优先告诉用户下一步该做什么，而不是先展示冗长流水。">
        <view class="aftersales-reminder-grid">
          <view v-for="item in reminderCards" :key="item.title" class="aftersales-reminder-card">
            <text class="aftersales-reminder-card__title">{{ item.title }}</text>
            <text class="aftersales-reminder-card__detail">{{ item.detail }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="优先处理" description="先处理争议、失败退款和处理中投诉，再看已收尾事项。">
        <view v-if="highPriorityCards.length" class="aftersales-priority-list">
          <view v-for="entry in highPriorityCards" :key="entry.order.id" class="aftersales-priority-card">
            <view class="aftersales-priority-card__header">
              <view class="aftersales-priority-card__headline">
                <text class="aftersales-priority-card__title">{{ entry.order.orderNo }}</text>
                <text class="aftersales-priority-card__meta">
                  {{ serviceTypeLabels[entry.order.serviceType] }} · {{ formatRange(entry.order.appointmentStart, entry.order.appointmentEnd) }}
                </text>
              </view>
              <AppTag :type="getPriorityTagType(entry.priority)">
                {{ getPriorityLabel(entry.priority) }}
              </AppTag>
            </view>
            <text class="aftersales-priority-card__hint">{{ getPriorityHint(entry) }}</text>
            <view class="aftersales-priority-card__actions">
              <AppButton size="medium" type="info" @click="openOrderDetail(entry.order.id, 'chat')">查看沟通</AppButton>
              <AppButton size="medium" type="danger" @click="openOrderDetail(entry.order.id, 'aftersales')">进入处理</AppButton>
            </view>
          </view>
        </view>
        <view v-else class="aftersales-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在整理售后事项' : '当前没有需要优先处理的售后事项'" />
        </view>
      </AppSection>

      <AppSection :title="orderCards.length ? `售后订单列表 (${orderCards.length})` : '售后订单列表'">
        <view v-if="orderCards.length" class="aftersales-order-list">
          <view v-for="entry in orderCards" :key="entry.order.id" class="aftersales-order-card">
            <view class="aftersales-order-card__header">
              <view class="aftersales-order-card__headline">
                <text class="aftersales-order-card__title">{{ entry.order.orderNo }}</text>
                <text class="aftersales-order-card__meta">
                  {{ serviceTypeLabels[entry.order.serviceType] }} · {{ formatRange(entry.order.appointmentStart, entry.order.appointmentEnd) }}
                </text>
                <text class="aftersales-order-card__meta">{{ getLatestProgressText(entry) }}</text>
              </view>
              <view class="aftersales-order-card__tags">
                <AppTag :type="getPriorityTagType(entry.priority)">
                  {{ getPriorityLabel(entry.priority) }}
                </AppTag>
                <AppTag :type="getOrderTagType(entry.order.orderStatus)">
                  {{ getOrderStatusLabel(entry.order.orderStatus) }}
                </AppTag>
              </view>
            </view>

            <view class="aftersales-amount-grid">
              <view class="aftersales-amount-card">
                <text class="aftersales-amount-card__label">订单总额</text>
                <text class="aftersales-amount-card__value">¥{{ formatAmount(entry.order.amountTotal) }}</text>
              </view>
              <view class="aftersales-amount-card">
                <text class="aftersales-amount-card__label">实付金额</text>
                <text class="aftersales-amount-card__value">¥{{ formatAmount(entry.order.amountPaid) }}</text>
              </view>
              <view class="aftersales-amount-card">
                <text class="aftersales-amount-card__label">已退款</text>
                <text class="aftersales-amount-card__value">¥{{ formatAmount(entry.order.amountRefunded) }}</text>
              </view>
            </view>

            <view class="aftersales-signal-grid">
              <view class="aftersales-signal-card">
                <text class="aftersales-signal-card__title">退款进度</text>
                <template v-if="entry.refundProgress && entry.refundProgress.stage !== 'NONE'">
                  <view class="aftersales-signal-card__headline">
                    <AppTag :type="getRefundStageTagType(entry.refundProgress.stage)">
                      {{ getRefundProgressStageLabel(entry.refundProgress.stage) }}
                    </AppTag>
                    <text class="aftersales-signal-card__value">
                      ¥{{ formatAmount(entry.refundProgress.settledRefundAmount) }}
                    </text>
                  </view>
                  <text class="aftersales-signal-card__meta">{{ getRefundStageHint(entry.refundProgress.stage) }}</text>
                  <text class="aftersales-signal-card__meta">
                    最近退款：{{ entry.refundProgress.latestRefundNo || '--' }}{{ entry.refundProgress.latestAppliedAt ? ` · ${formatDateTime(entry.refundProgress.latestAppliedAt)}` : '' }}
                  </text>
                </template>
                <template v-else>
                  <text class="aftersales-empty-text">当前暂无退款申请记录。</text>
                </template>
              </view>

              <view class="aftersales-signal-card">
                <text class="aftersales-signal-card__title">投诉处理</text>
                <template v-if="entry.complaints.length">
                  <view class="aftersales-signal-card__headline">
                    <AppTag :type="getComplaintTagType(getPrimaryComplaintStatus(entry.complaints))">
                      {{ entry.activeComplaintCount ? `处理中 ${entry.activeComplaintCount}` : `已结案 ${entry.complaints.length}` }}
                    </AppTag>
                    <text class="aftersales-signal-card__value">{{ entry.complaints.length }} 条</text>
                  </view>
                  <view class="aftersales-complaint-list">
                    <view v-for="complaint in entry.complaints.slice(0, 2)" :key="complaint.id" class="aftersales-complaint-item">
                      <text class="aftersales-complaint-item__title">{{ getComplaintTypeLabel(complaint.complaintType) }}</text>
                      <text class="aftersales-complaint-item__meta">
                        {{ getComplaintStatusLabel(complaint.status) }} · {{ formatDateTime(complaint.updatedAt) }}
                      </text>
                    </view>
                  </view>
                </template>
                <template v-else>
                  <text class="aftersales-empty-text">当前没有投诉记录。</text>
                </template>
              </view>
            </view>

            <view class="aftersales-order-card__footer">
              <AppTag :type="getConversationUnreadCount(entry.order.conversation, 'owner') > 0 ? 'warning' : 'default'">
                {{ getConversationUnreadCount(entry.order.conversation, 'owner') > 0 ? `待读 ${getConversationUnreadCount(entry.order.conversation, 'owner')}` : '沟通已读' }}
              </AppTag>
              <view class="aftersales-order-card__actions">
                <AppButton size="medium" type="info" @click="openOrderDetail(entry.order.id, 'chat')">沟通</AppButton>
                <AppButton size="medium" :type="entry.priority === 'HIGH' ? 'danger' : 'primary'" @click="openOrderDetail(entry.order.id, 'aftersales')">
                  售后详情
                </AppButton>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="aftersales-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步售后数据' : '当前没有售后订单'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始使用售后中心" description="登录后统一查看退款、投诉和争议订单。">
        <view class="aftersales-empty aftersales-empty--login">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.aftersales-hero {
  display: grid;
  gap: 20rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 36%),
    linear-gradient(145deg, #8a1c3a 0%, #b03552 52%, #c25532 100%);
  box-shadow: 0 18rpx 42rpx rgba(127, 29, 29, 0.16);
}

.aftersales-hero__copy {
  display: grid;
  gap: 12rpx;
}

.aftersales-hero__title {
  color: #fff7ed;
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.aftersales-hero__summary {
  color: rgba(255, 247, 237, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.aftersales-hero__actions,
.aftersales-priority-card__actions,
.aftersales-order-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.aftersales-summary-grid,
.aftersales-reminder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.aftersales-summary-card,
.aftersales-reminder-card,
.aftersales-priority-card,
.aftersales-order-card,
.aftersales-signal-card,
.aftersales-amount-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.aftersales-summary-card__label,
.aftersales-amount-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.aftersales-summary-card__value,
.aftersales-amount-card__value,
.aftersales-signal-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.aftersales-summary-card__hint,
.aftersales-reminder-card__detail,
.aftersales-priority-card__hint,
.aftersales-order-card__meta,
.aftersales-signal-card__meta,
.aftersales-empty-text,
.aftersales-complaint-item__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.aftersales-reminder-card {
  background:
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 36%),
    linear-gradient(180deg, #ffffff 0%, #f7fbfb 100%);
}

.aftersales-reminder-card__title,
.aftersales-priority-card__title,
.aftersales-order-card__title,
.aftersales-signal-card__title,
.aftersales-complaint-item__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.aftersales-priority-list,
.aftersales-order-list {
  display: grid;
  gap: 16rpx;
}

.aftersales-priority-card {
  background:
    radial-gradient(circle at top right, rgba(239, 68, 68, 0.08), transparent 36%),
    linear-gradient(180deg, #ffffff 0%, #fff8f7 100%);
}

.aftersales-priority-card__header,
.aftersales-order-card__header,
.aftersales-order-card__footer,
.aftersales-signal-card__headline {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.aftersales-priority-card__headline,
.aftersales-order-card__headline {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.aftersales-order-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  justify-content: flex-end;
}

.aftersales-amount-grid,
.aftersales-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.aftersales-signal-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.aftersales-signal-card {
  gap: 10rpx;
  background: var(--app-surface-soft);
}

.aftersales-complaint-list {
  display: grid;
  gap: 10rpx;
}

.aftersales-complaint-item {
  display: grid;
  gap: 4rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: #ffffff;
  border: 1rpx solid rgba(15, 23, 42, 0.06);
}

.aftersales-empty {
  padding: 8rpx 0;
}

.aftersales-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .aftersales-summary-grid,
  .aftersales-reminder-grid,
  .aftersales-amount-grid,
  .aftersales-signal-grid {
    grid-template-columns: 1fr;
  }

  .aftersales-priority-card__header,
  .aftersales-order-card__header,
  .aftersales-order-card__footer,
  .aftersales-signal-card__headline {
    flex-direction: column;
  }
}
</style>
