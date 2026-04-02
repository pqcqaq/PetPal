<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已发起投诉或正在回看投诉处理结果的主人
 * Entry: 投诉提交成功回流、售后中心投诉队列、订单详情投诉入口
 * First screen: 先确认投诉现在在哪个状态，以及下一步该继续跟进还是回订单
 * Primary action: 进入当前投诉阶段对应的下一步
 * Secondary actions: 看沟通、回售后上下文、重新投诉
 * States: 加载中、无投诉、待受理、处理中、已解决、已驳回
 */
import type { ComplaintRecord, ComplaintStatus, OrderDetailRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getOrderComplaints, getOrderDetail } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatDateTime,
  formatRange,
  getComplaintStatusHint,
  getComplaintStatusLabel,
  getComplaintTargetRoleLabel,
  getComplaintTypeLabel,
  getConversationUnreadCount,
  getOrderStatusLabel,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_ORDER_COMPLAINT_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
  PETPAL_REVIEW_RESULT_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalComplaintResultPage',
})

definePage({
  style: {
    navigationBarTitleText: '投诉结果',
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
const complaintId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])
const loading = ref(false)
const error = ref('')

const sortedComplaints = computed(() => [...complaints.value].sort((left, right) => (
  new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
)))

const activeComplaint = computed(() => sortedComplaints.value.find((item) => (
  item.status === 'OPEN' || item.status === 'PROCESSING'
)) ?? null)

const targetComplaint = computed(() => {
  if (complaintId.value) {
    return sortedComplaints.value.find(item => item.id === complaintId.value) ?? activeComplaint.value ?? sortedComplaints.value[0] ?? null
  }
  return activeComplaint.value ?? sortedComplaints.value[0] ?? null
})

const unreadCount = computed(() => getConversationUnreadCount(order.value?.conversation, 'owner'))
const hasComplaints = computed(() => sortedComplaints.value.length > 0)

const canCreateComplaint = computed(() => Boolean(
  order.value
  && ['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(order.value.orderStatus)
  && !activeComplaint.value,
))

function getComplaintTone(status: ComplaintStatus | null | undefined): ViewTone {
  if (status === 'PROCESSING') return 'danger'
  if (status === 'OPEN') return 'warning'
  if (status === 'RESOLVED') return 'success'
  if (status === 'REJECTED') return 'default'
  return 'default'
}

function getComplaintActionLabel(actionType: string) {
  const labels: Record<string, string> = {
    OPEN: '发起投诉',
    ASSIGN: '平台接单',
    INVESTIGATE: '补充调查',
    CALL_USER: '联系用户',
    PENALTY: '处理措施',
    CLOSE: '结案',
  }
  return labels[actionType] || '处理更新'
}

const stageTone = computed<ViewTone>(() => getComplaintTone(targetComplaint.value?.status))

const focusTitle = computed(() => {
  if (!targetComplaint.value) {
    return '当前没有投诉记录'
  }
  if (targetComplaint.value.status === 'OPEN') return '投诉已提交'
  if (targetComplaint.value.status === 'PROCESSING') return '平台处理中'
  if (targetComplaint.value.status === 'RESOLVED') return '投诉已结案'
  return '投诉未通过'
})

const focusSummary = computed(() => {
  if (!targetComplaint.value) {
    return '当前这笔订单没有可回看的投诉结果。'
  }

  if (targetComplaint.value.status === 'OPEN') {
    return '投诉已经提交，先保留沟通和证据，等待平台受理。'
  }
  if (targetComplaint.value.status === 'PROCESSING') {
    return '平台正在核查投诉内容，下一步先回看处理日志和沟通更新。'
  }
  if (targetComplaint.value.status === 'RESOLVED') {
    return targetComplaint.value.resultSummary?.trim()
      ? `处理结论：${targetComplaint.value.resultSummary}`
      : '投诉已经完成处理，下一步回订单继续后续动作。'
  }
  return targetComplaint.value.resultSummary?.trim()
    ? `本次投诉未通过：${targetComplaint.value.resultSummary}`
    : '本次投诉未通过，建议先看原因，再决定是否重新发起。'
})

const heroTags = computed(() => {
  if (!order.value || !targetComplaint.value) {
    return []
  }

  const tags: Array<{ label: string, type: ViewTone }> = [
    {
      label: getComplaintStatusLabel(targetComplaint.value.status),
      type: stageTone.value,
    },
    {
      label: getComplaintTypeLabel(targetComplaint.value.complaintType),
      type: 'danger',
    },
    {
      label: serviceTypeLabels[order.value.serviceType],
      type: 'primary',
    },
  ]

  if (unreadCount.value > 0) {
    tags.push({
      label: `${unreadCount.value} 条未读`,
      type: 'warning',
    })
  }
  else if (Number(order.value.amountRefunded) > 0) {
    tags.push({
      label: `已退 ¥${formatAmount(order.value.amountRefunded)}`,
      type: 'warning',
    })
  }

  return tags
})

const signalCards = computed<SignalCard[]>(() => {
  if (!order.value || !targetComplaint.value) {
    return []
  }

  const latestLog = targetComplaint.value.processLogs[targetComplaint.value.processLogs.length - 1] ?? null

  return [
    {
      key: 'status',
      title: '结果',
      value: getComplaintStatusLabel(targetComplaint.value.status),
      hint: latestLog
        ? `${latestLog.operatorNickname || '平台处理'} · ${formatDateTime(latestLog.createdAt)}`
        : getComplaintStatusHint(targetComplaint.value.status),
      tone: stageTone.value,
    },
    {
      key: 'refund',
      title: '退款联动',
      value: Number(order.value.amountRefunded) > 0 ? `已退 ¥${formatAmount(order.value.amountRefunded)}` : '当前未退款',
      hint: Number(order.value.amountRefunded) > 0
        ? '可结合退款结果判断后续动作'
        : '如涉及费用争议，可继续查看售后金额变化',
      tone: Number(order.value.amountRefunded) > 0 ? 'warning' : 'default',
    },
    {
      key: 'message',
      title: '沟通',
      value: unreadCount.value > 0 ? `${unreadCount.value} 条未读` : order.value.conversation?.lastMessageAt ? '沟通已读' : '暂未沟通',
      hint: order.value.conversation?.lastMessageAt
        ? `最近沟通 ${formatDateTime(order.value.conversation.lastMessageAt)}`
        : '需要时可直接联系对方',
      tone: unreadCount.value > 0 ? 'warning' : 'default',
    },
  ]
})

const summaryRows = computed<SummaryRow[]>(() => {
  if (!order.value || !targetComplaint.value) {
    return []
  }

  return [
    {
      title: '订单号',
      value: order.value.orderNo,
      hint: formatRange(order.value.appointmentStart, order.value.appointmentEnd),
    },
    {
      title: '投诉类型',
      value: getComplaintTypeLabel(targetComplaint.value.complaintType),
      hint: getComplaintTargetRoleLabel(targetComplaint.value.targetRole),
    },
    {
      title: '当前状态',
      value: getComplaintStatusLabel(targetComplaint.value.status),
      hint: targetComplaint.value.assignedAdminNickname ? `当前负责人 ${targetComplaint.value.assignedAdminNickname}` : getComplaintStatusHint(targetComplaint.value.status),
    },
  ]
})

const primaryActionLabel = computed(() => {
  if (!order.value || !targetComplaint.value) {
    return '返回订单售后'
  }
  if (targetComplaint.value.status === 'OPEN' || targetComplaint.value.status === 'PROCESSING') {
    return '继续跟进'
  }
  if (targetComplaint.value.status === 'REJECTED' && canCreateComplaint.value) {
    return '重新投诉'
  }
  if (targetComplaint.value.status === 'RESOLVED' && order.value.orderStatus === 'COMPLETED') {
    return order.value.review ? '查看评价结果' : '去写评价'
  }
  return '返回订单'
})

const secondaryActionLabel = computed(() => {
  if (!targetComplaint.value) {
    return '售后中心'
  }
  if (targetComplaint.value.status === 'OPEN' || targetComplaint.value.status === 'PROCESSING') {
    return unreadCount.value > 0 ? '看沟通' : '售后上下文'
  }
  return '售后中心'
})

function openComplaintPage() {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_COMPLAINT_PAGE}?id=${order.value.id}` })
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

function openReviewPage() {
  if (!order.value) {
    return
  }
  const targetPage = order.value.review ? PETPAL_REVIEW_RESULT_PAGE : PETPAL_ORDER_REVIEW_PAGE
  uni.redirectTo({ url: `${targetPage}?id=${order.value.id}` })
}

function openPrimaryAction() {
  if (!order.value || !targetComplaint.value) {
    openAftersales()
    return
  }

  if (targetComplaint.value.status === 'OPEN' || targetComplaint.value.status === 'PROCESSING') {
    openOrderDetail('aftersales')
    return
  }

  if (targetComplaint.value.status === 'REJECTED' && canCreateComplaint.value) {
    openComplaintPage()
    return
  }

  if (targetComplaint.value.status === 'RESOLVED' && order.value.orderStatus === 'COMPLETED') {
    openReviewPage()
    return
  }

  openOrderDetail('overview')
}

function openSecondaryAction() {
  if (!targetComplaint.value) {
    openAftersales()
    return
  }

  if ((targetComplaint.value.status === 'OPEN' || targetComplaint.value.status === 'PROCESSING') && unreadCount.value > 0) {
    openOrderDetail('chat')
    return
  }

  if (targetComplaint.value.status === 'OPEN' || targetComplaint.value.status === 'PROCESSING') {
    openOrderDetail('aftersales')
    return
  }

  openAftersales()
}

function openEvidenceUrl(url: string) {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: '证据链接已复制', icon: 'none' })
    },
    fail: () => {
      uni.showToast({ title: '当前环境暂不支持直接打开', icon: 'none' })
    },
  })
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
    const [detailResult, complaintsResult] = await Promise.all([
      getOrderDetail(orderId.value),
      getOrderComplaints(orderId.value),
    ])
    order.value = detailResult
    complaints.value = complaintsResult
  }
  catch (cause: unknown) {
    order.value = null
    complaints.value = []
    error.value = getErrorMessage(cause, '加载投诉结果失败')
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
  complaintId.value = options.complaintId || ''
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
  <AppPageShell title="投诉结果">
    <template v-if="tokenStore.hasLogin">
      <view v-if="loading && !order" class="complaint-empty">
        <AppStatus mode="loading" text="正在同步投诉处理状态" />
      </view>

      <view v-else-if="order && hasComplaints && targetComplaint" class="complaint-page">
        <view class="complaint-focus">
          <view class="complaint-focus__copy">
            <view class="complaint-focus__tags">
              <AppTag
                v-for="tag in heroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <text class="complaint-focus__title">{{ focusTitle }}</text>
            <text class="complaint-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="complaint-focus__summary">{{ focusSummary }}</text>
          </view>

          <view class="complaint-focus__actions">
            <AppButton size="medium" :type="targetComplaint.status === 'PROCESSING' ? 'danger' : 'primary'" @click="openPrimaryAction">
              {{ primaryActionLabel }}
            </AppButton>
            <AppButton size="medium" type="info" @click="openSecondaryAction">
              {{ secondaryActionLabel }}
            </AppButton>
          </view>
        </view>

        <view class="complaint-signal-grid">
          <view
            v-for="signal in signalCards"
            :key="signal.key"
            class="complaint-signal"
            :class="`complaint-signal--${signal.tone}`"
          >
            <text class="complaint-signal__title">{{ signal.title }}</text>
            <text class="complaint-signal__value">{{ signal.value }}</text>
            <text class="complaint-signal__hint">{{ signal.hint }}</text>
          </view>
        </view>

        <view class="complaint-group">
          <view
            v-for="item in summaryRows"
            :key="item.title"
            class="complaint-row"
          >
            <view class="complaint-row__copy">
              <text class="complaint-row__title">{{ item.title }}</text>
              <text class="complaint-row__hint">{{ item.hint }}</text>
            </view>
            <text class="complaint-row__value">{{ item.value }}</text>
          </view>

          <view class="complaint-note">
            <text class="complaint-note__label">投诉说明</text>
            <text class="complaint-note__text">{{ targetComplaint.description }}</text>
          </view>

          <view v-if="targetComplaint.resultSummary" class="complaint-note complaint-note--accent">
            <text class="complaint-note__label">处理结论</text>
            <text class="complaint-note__text">{{ targetComplaint.resultSummary }}</text>
          </view>

          <view v-if="targetComplaint.evidenceUrls.length" class="complaint-evidence">
            <text class="complaint-note__label">证据材料</text>
            <view class="complaint-evidence__row">
              <view
                v-for="url in targetComplaint.evidenceUrls"
                :key="url"
                class="complaint-evidence__chip"
                @click="openEvidenceUrl(url)"
              >
                <text>查看证据</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="targetComplaint.processLogs.length" class="complaint-group">
          <view class="complaint-group__head">
            <text class="complaint-group__title">处理日志</text>
            <AppTag type="default">{{ targetComplaint.processLogs.length }} 条</AppTag>
          </view>

          <view class="complaint-log-list">
            <view
              v-for="log in targetComplaint.processLogs"
              :key="log.id"
              class="complaint-log"
            >
              <view class="complaint-log__head">
                <text class="complaint-log__title">{{ log.operatorNickname || '平台处理' }}</text>
                <text class="complaint-log__meta">{{ formatDateTime(log.createdAt) }}</text>
              </view>
              <text class="complaint-log__label">{{ getComplaintActionLabel(log.actionType) }}</text>
              <text v-if="log.note" class="complaint-log__note">{{ log.note }}</text>
            </view>
          </view>
        </view>

        <view v-if="sortedComplaints.length > 1" class="complaint-group">
          <view class="complaint-group__head">
            <text class="complaint-group__title">历史投诉</text>
            <AppTag type="default">{{ sortedComplaints.length }} 条</AppTag>
          </view>

          <view class="complaint-history-list">
            <view
              v-for="complaint in sortedComplaints"
              :key="complaint.id"
              class="complaint-row"
              @click="complaintId = complaint.id"
            >
              <view class="complaint-row__copy">
                <text class="complaint-row__title">{{ getComplaintTypeLabel(complaint.complaintType) }}</text>
                <text class="complaint-row__hint">{{ getComplaintTargetRoleLabel(complaint.targetRole) }} · {{ formatDateTime(complaint.updatedAt) }}</text>
              </view>
              <text class="complaint-row__value">{{ getComplaintStatusLabel(complaint.status) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="order" class="complaint-empty">
        <AppStatus text="这笔订单当前没有可回看的投诉结果。" />
        <AppButton v-if="canCreateComplaint" block @click="openComplaintPage">去投诉页</AppButton>
        <AppButton block type="info" @click="openOrderDetail('aftersales')">返回订单售后</AppButton>
        <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
      </view>

      <view v-else class="complaint-empty">
        <AppStatus :text="error || '订单不存在或暂时无法查看投诉结果'" />
        <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
      </view>
    </template>

    <template v-else>
      <view class="complaint-empty">
        <AppStatus text="登录后查看投诉结果和下一步。" />
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.complaint-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.complaint-focus,
.complaint-group,
.complaint-empty,
.complaint-log {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.complaint-focus {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.complaint-focus__copy,
.complaint-row__copy,
.complaint-log-list,
.complaint-log {
  display: grid;
  gap: 8rpx;
}

.complaint-focus__tags,
.complaint-focus__actions,
.complaint-evidence__row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.complaint-focus__title,
.complaint-group__title,
.complaint-row__title,
.complaint-log__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.complaint-focus__meta,
.complaint-focus__summary,
.complaint-signal__title,
.complaint-signal__hint,
.complaint-row__hint,
.complaint-log__meta,
.complaint-log__label,
.complaint-log__note,
.complaint-note__label,
.complaint-note__text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.complaint-focus__summary,
.complaint-note__text,
.complaint-row__value,
.complaint-signal__value {
  color: var(--app-text);
}

.complaint-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  padding: 0 24rpx;
}

.complaint-signal {
  display: grid;
  gap: 10rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  box-shadow: var(--app-elevation-1);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.complaint-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.complaint-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.complaint-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.complaint-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.complaint-signal__value,
.complaint-row__value {
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.complaint-group {
  overflow: hidden;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
}

.complaint-group__head,
.complaint-row,
.complaint-log__head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.complaint-row {
  padding: 24rpx 0;
}

.complaint-row + .complaint-row {
  border-top: 1rpx solid var(--app-outline-variant);
}

.complaint-note,
.complaint-evidence {
  display: grid;
  gap: 10rpx;
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface-soft);
}

.complaint-note--accent {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.complaint-evidence__chip {
  display: inline-flex;
  min-height: 56rpx;
  align-items: center;
  justify-content: center;
  padding: 0 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text-secondary);
}

.complaint-empty {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

@media (max-width: 680px) {
  .complaint-signal-grid {
    grid-template-columns: 1fr;
  }

  .complaint-group__head,
  .complaint-row,
  .complaint-log__head {
    align-items: flex-start;
  }
}
</style>
