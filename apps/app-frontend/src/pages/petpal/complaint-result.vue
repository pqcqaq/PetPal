<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已发起投诉或正在回看投诉处理结果的主人
 * Entry: 投诉提交成功回流、售后中心投诉队列、订单详情投诉入口
 * Core scenes:
 * 1. 首屏直接告诉用户投诉当前在哪个状态、平台最近处理到了哪一步
 * 2. 处理中和已结案都必须给出明确下一步，不让用户自己猜该继续沟通、回订单还是重新投诉
 * 3. 处理日志和证据留在同页回看，不再要求用户翻订单长页
 * Primary action: 进入当前投诉阶段对应的下一步
 * Secondary actions: 看沟通、回订单售后、重新投诉
 * Feedback: 投诉状态、处理结论、最近处理时间、退款联动、历史投诉记录
 * States: 加载中、无投诉、待受理、处理中、已解决、已驳回
 */
import type { ComplaintRecord, ComplaintStatus, OrderDetailRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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

interface ResultSignalCard {
  key: string
  title: string
  value: string
  hint: string
  tone: ViewTone
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

const resultHeadline = computed(() => {
  if (!targetComplaint.value) {
    return '当前没有投诉记录'
  }
  if (targetComplaint.value.status === 'OPEN') {
    return '投诉已提交'
  }
  if (targetComplaint.value.status === 'PROCESSING') {
    return '平台处理中'
  }
  if (targetComplaint.value.status === 'RESOLVED') {
    return '投诉已结案'
  }
  return '投诉未通过'
})

const resultSummary = computed(() => {
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
      ? `处理结论已经给出：${targetComplaint.value.resultSummary}`
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

const signalCards = computed<ResultSignalCard[]>(() => {
  if (!order.value || !targetComplaint.value) {
    return []
  }

  const latestLog = targetComplaint.value.processLogs[targetComplaint.value.processLogs.length - 1] ?? null

  return [
    {
      key: 'status',
      title: '投诉结果',
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
        ? '投诉处理时可结合退款结果一起判断后续动作'
        : '如涉及费用争议，可回订单继续查看售后金额变化',
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

const contextActionLabel = computed(() => {
  if (!targetComplaint.value) {
    return '售后中心'
  }
  if (targetComplaint.value.status === 'OPEN' || targetComplaint.value.status === 'PROCESSING') {
    return '订单售后'
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

function openContextAction() {
  if (!targetComplaint.value) {
    openAftersales()
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
      <template v-if="loading && !order">
        <AppSection title="同步投诉结果">
          <AppStatus mode="loading" text="正在同步投诉处理状态" />
        </AppSection>
      </template>

      <template v-else-if="order">
        <template v-if="hasComplaints && targetComplaint">
          <AppSection title="投诉结果">
            <view class="complaint-result-focus">
              <view class="complaint-result-focus__copy">
                <view class="complaint-result-focus__tags">
                  <AppTag
                    v-for="tag in heroTags"
                    :key="tag.label"
                    :type="tag.type"
                  >
                    {{ tag.label }}
                  </AppTag>
                </view>
                <text class="complaint-result-focus__title">{{ resultHeadline }}</text>
                <text class="complaint-result-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
                <text class="complaint-result-focus__meta">订单状态 {{ getOrderStatusLabel(order.orderStatus) }} · 实付 ¥{{ formatAmount(order.amountPaid) }}</text>
                <text class="complaint-result-focus__summary">{{ resultSummary }}</text>
              </view>

              <view class="complaint-result-signal-grid">
                <view
                  v-for="signal in signalCards"
                  :key="signal.key"
                  class="complaint-result-signal"
                  :class="`complaint-result-signal--${signal.tone}`"
                >
                  <text class="complaint-result-signal__title">{{ signal.title }}</text>
                  <text class="complaint-result-signal__value">{{ signal.value }}</text>
                  <text class="complaint-result-signal__hint">{{ signal.hint }}</text>
                </view>
              </view>
            </view>
          </AppSection>

          <AppSection title="当前投诉">
            <AppList>
              <AppListItem
                title="投诉类型"
                :label="getComplaintTargetRoleLabel(targetComplaint.targetRole)"
                :value="getComplaintTypeLabel(targetComplaint.complaintType)"
                value-emphasis
              />
              <AppListItem
                title="当前状态"
                :label="getComplaintStatusHint(targetComplaint.status)"
                :value="getComplaintStatusLabel(targetComplaint.status)"
                value-emphasis
              />
              <AppListItem
                title="发起时间"
                :label="formatDateTime(targetComplaint.createdAt)"
                :value="targetComplaint.closedAt ? formatDateTime(targetComplaint.closedAt) : formatDateTime(targetComplaint.updatedAt)"
              >
                <template #value>
                  <text class="complaint-result-list-value complaint-result-list-value--strong">
                    {{ targetComplaint.closedAt ? '已结案' : '最近更新' }} {{ targetComplaint.closedAt ? formatDateTime(targetComplaint.closedAt) : formatDateTime(targetComplaint.updatedAt) }}
                  </text>
                </template>
              </AppListItem>
              <AppListItem
                v-if="targetComplaint.assignedAdminNickname"
                title="当前负责人"
                :label="targetComplaint.resultSummary || '当前还没有处理结论'"
                :value="targetComplaint.assignedAdminNickname"
                value-emphasis
              />
            </AppList>

            <view class="complaint-result-note">
              <text>{{ targetComplaint.description }}</text>
            </view>

            <view v-if="targetComplaint.resultSummary" class="complaint-result-note complaint-result-note--accent">
              <text>处理结论：{{ targetComplaint.resultSummary }}</text>
            </view>

            <view v-if="targetComplaint.evidenceUrls.length" class="complaint-result-evidence-row">
              <view
                v-for="url in targetComplaint.evidenceUrls"
                :key="url"
                class="complaint-result-evidence-chip"
                @click="openEvidenceUrl(url)"
              >
                <text>查看证据</text>
              </view>
            </view>
          </AppSection>

          <AppSection v-if="targetComplaint.processLogs.length" :title="`处理日志 (${targetComplaint.processLogs.length})`">
            <view class="complaint-result-log-list">
              <view
                v-for="log in targetComplaint.processLogs"
                :key="log.id"
                class="complaint-result-log-item"
              >
                <view class="complaint-result-log-item__header">
                  <text class="complaint-result-log-item__title">{{ log.operatorNickname || '平台处理' }}</text>
                  <text class="complaint-result-log-item__meta">{{ formatDateTime(log.createdAt) }}</text>
                </view>
                <text class="complaint-result-log-item__label">{{ getComplaintActionLabel(log.actionType) }}</text>
                <text v-if="log.note" class="complaint-result-log-item__note">{{ log.note }}</text>
              </view>
            </view>
          </AppSection>

          <AppSection v-if="sortedComplaints.length > 1" :title="`历史投诉 (${sortedComplaints.length})`">
            <AppList>
              <AppListItem
                v-for="complaint in sortedComplaints"
                :key="complaint.id"
                :title="getComplaintTypeLabel(complaint.complaintType)"
                :label="`${getComplaintTargetRoleLabel(complaint.targetRole)} · ${formatDateTime(complaint.updatedAt)}`"
                :value="getComplaintStatusLabel(complaint.status)"
                value-emphasis
                clickable
                is-link
                @click="complaintId = complaint.id"
              />
            </AppList>
          </AppSection>

          <view class="complaint-result-actions">
            <AppButton block :type="targetComplaint.status === 'PROCESSING' ? 'danger' : 'primary'" @click="openPrimaryAction">
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
          <AppSection title="当前没有投诉">
            <AppStatus text="这笔订单当前没有可回看的投诉结果。" />
          </AppSection>
          <view class="complaint-result-actions">
            <AppButton v-if="canCreateComplaint" block @click="openComplaintPage">去投诉页</AppButton>
            <AppButton block type="info" @click="openOrderDetail('aftersales')">返回订单售后</AppButton>
            <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
          </view>
        </template>
      </template>

      <template v-else>
        <AppSection title="投诉结果不可用">
          <AppStatus :text="error || '订单不存在或暂时无法查看投诉结果'" />
        </AppSection>
        <view class="complaint-result-actions">
          <AppButton block type="info" @click="openAftersales">返回售后中心</AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后查看投诉结果">
        <AppStatus text="登录后查看投诉结果和下一步动作。" />
      </AppSection>
      <view class="complaint-result-actions">
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.complaint-result-focus,
.complaint-result-signal,
.complaint-result-log-item {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.complaint-result-focus {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.complaint-result-focus__copy,
.complaint-result-log-list {
  display: grid;
  gap: 10rpx;
}

.complaint-result-focus__tags,
.complaint-result-actions,
.complaint-result-evidence-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.complaint-result-focus__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.25;
  font-weight: 700;
}

.complaint-result-focus__meta,
.complaint-result-focus__summary,
.complaint-result-signal__title,
.complaint-result-signal__hint,
.complaint-result-list-value,
.complaint-result-log-item__meta,
.complaint-result-log-item__label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.complaint-result-focus__summary,
.complaint-result-list-value--strong,
.complaint-result-log-item__title,
.complaint-result-log-item__note {
  color: var(--app-text);
}

.complaint-result-list-value--strong,
.complaint-result-log-item__title {
  font-weight: 600;
}

.complaint-result-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.complaint-result-signal {
  padding: 18rpx 20rpx;
  gap: 10rpx;
}

.complaint-result-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.complaint-result-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.complaint-result-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.complaint-result-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.complaint-result-signal__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.complaint-result-note {
  margin-top: 20rpx;
  padding: 20rpx 22rpx;
  border-radius: var(--app-shape-lg);
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface-soft);
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

.complaint-result-note--accent {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.complaint-result-evidence-chip {
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

.complaint-result-log-item__header {
  display: flex;
  gap: 12rpx;
  justify-content: space-between;
  align-items: center;
}

.complaint-result-actions {
  padding: 0 32rpx 12rpx;
}

.complaint-result-actions .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .complaint-result-signal-grid {
    grid-template-columns: 1fr;
  }

  .complaint-result-log-item__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
