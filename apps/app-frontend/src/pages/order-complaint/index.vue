<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 需要发起或跟进投诉的主人
 * Entry: 从订单详情点击发起投诉或查看投诉进入
 * Core scenes:
 * 1. 首屏先判断当前是否可投诉、是否已有进行中的投诉
 * 2. 可投诉时直接选对象、类型并填写问题，不让用户先看长说明
 * 3. 已有投诉时先看进度、日志和证据，再决定是否继续跟进
 * Primary action: 提交投诉
 * Secondary actions: 查看处理日志、补充问题描述、返回订单售后页
 * Feedback: 当前阶段、投诉数量、退款联动、最近处理时间
 * States: 加载中、订单不存在、不可投诉、可投诉、处理中投诉、已结案投诉
 */
import type {
  ComplaintRecord,
  ComplaintTargetRole,
  ComplaintType,
  CreateComplaintPayload,
  OrderDetailRecord,
} from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { createOrderComplaint, getOrderComplaints, getOrderDetail } from '@/api/petpal'
import { useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatDateTime,
  formatRange,
  getComplaintStatusLabel,
  getComplaintTargetRoleLabel,
  getComplaintTypeLabel,
  getOrderStatusLabel,
  PETPAL_ORDER_DETAIL_PAGE,
  serviceTypeLabels,
} from '../petpal/owner-shared'

type ComplaintSignalTone = 'primary' | 'warning' | 'danger' | 'default'

interface ComplaintSignalCard {
  key: string
  title: string
  value: string
  hint: string
  tone: ComplaintSignalTone
}

defineOptions({
  name: 'OrderComplaintPage',
})

definePage({
  style: {
    navigationBarTitleText: '投诉处理',
    enablePullDownRefresh: true,
  },
})

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])
const loading = ref(false)
const error = ref('')
const submitting = ref(false)

const complaintForm = reactive({
  targetRole: 'CAREGIVER' as ComplaintTargetRole,
  complaintType: 'SERVICE' as ComplaintType,
  description: '',
  evidenceUrlsText: '',
})

const complaintTargetOptions = [
  { label: '照料者', value: 'CAREGIVER', description: '针对履约和服务质量问题' },
  { label: '平台', value: 'PLATFORM', description: '针对平台响应和售后处理' },
]

const complaintTypeOptions = [
  { label: '服务质量', value: 'SERVICE', description: '沟通、照料或履约质量问题' },
  { label: '安全问题', value: 'SAFETY', description: '涉及宠物安全和环境风险' },
  { label: '费用争议', value: 'FEE', description: '收费、退款或金额争议' },
  { label: '欺诈风险', value: 'FRAUD', description: '虚假服务或异常行为' },
  { label: '其他问题', value: 'OTHER', description: '其他需要平台介入的情况' },
]
const complaintSnippetSuggestions = [
  '与约定服务内容不符',
  '服务记录缺失或明显滞后',
  '沟通响应慢，处理不及时',
  '宠物状态异常，需要平台介入',
  '退款处理进度不清晰',
]

const isOwnerView = computed(() => Boolean(userInfo.value.id && order.value?.ownerId === userInfo.value.id))
const activeComplaint = computed(() => complaints.value.find(item => (
  item.status === 'OPEN' || item.status === 'PROCESSING'
)) ?? null)
const sortedComplaints = computed(() => [...complaints.value].sort((left, right) => (
  new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
)))
const canCreateComplaint = computed(() => Boolean(
  isOwnerView.value
  && order.value
  && ['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(order.value.orderStatus)
  && !activeComplaint.value,
))
const complaintStageLabel = computed(() => {
  if (activeComplaint.value) {
    return `投诉${getComplaintStatusLabel(activeComplaint.value.status)}`
  }
  if (canCreateComplaint.value) {
    return '可发起投诉'
  }
  if (sortedComplaints.value.length > 0) {
    return '历史投诉可回看'
  }
  return '当前不可投诉'
})
const complaintStageTagType = computed(() => {
  if (activeComplaint.value) {
    return 'danger'
  }
  if (canCreateComplaint.value) {
    return 'warning'
  }
  if (sortedComplaints.value.length > 0) {
    return 'success'
  }
  return 'default'
})
const complaintHeroTags = computed(() => {
  if (!order.value) {
    return []
  }

  const tags = [
    { label: serviceTypeLabels[order.value.serviceType], type: 'primary' as const },
    { label: complaintStageLabel.value, type: complaintStageTagType.value as 'danger' | 'warning' | 'success' | 'default' },
  ]

  if (Number(order.value.amountRefunded) > 0) {
    tags.push({
      label: `已退 ¥${formatAmount(order.value.amountRefunded)}`,
      type: 'warning' as const,
    })
  }

  return tags
})
const complaintSummaryHint = computed(() => {
  if (activeComplaint.value) {
    return '先看处理日志和结果，再决定是否继续补充证据。'
  }
  if (canCreateComplaint.value) {
    return '先选问题类型，再写清时间点、经过和诉求。'
  }
  if (sortedComplaints.value.length > 0) {
    return '当前这单已有历史投诉记录，可先回看结果。'
  }
  return '当前订单暂时不可发起新的投诉。'
})
const complaintSignalCards = computed<ComplaintSignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      key: 'stage',
      title: '当前阶段',
      value: complaintStageLabel.value,
      hint: complaintSummaryHint.value,
      tone: activeComplaint.value ? 'danger' : canCreateComplaint.value ? 'warning' : 'default',
    },
    {
      key: 'count',
      title: '投诉记录',
      value: activeComplaint.value ? `${sortedComplaints.value.length} 条记录` : sortedComplaints.value.length > 0 ? `${sortedComplaints.value.length} 条历史记录` : '暂无投诉记录',
      hint: activeComplaint.value
        ? `最近更新 ${formatDateTime(activeComplaint.value.updatedAt)}`
        : sortedComplaints.value.length > 0
          ? `最近更新 ${formatDateTime(sortedComplaints.value[0].updatedAt)}`
          : '当前没有售后争议记录',
      tone: activeComplaint.value ? 'danger' : sortedComplaints.value.length > 0 ? 'primary' : 'default',
    },
    {
      key: 'refund',
      title: '退款联动',
      value: Number(order.value.amountRefunded) > 0 ? `已退 ¥${formatAmount(order.value.amountRefunded)}` : '当前未退款',
      hint: Number(order.value.amountRefunded) > 0 ? '投诉时可结合退款结果说明争议' : '如涉及金额争议，可在描述中说明诉求',
      tone: Number(order.value.amountRefunded) > 0 ? 'warning' : 'default',
    },
  ]
})

function resetComplaintForm() {
  complaintForm.targetRole = 'CAREGIVER'
  complaintForm.complaintType = 'SERVICE'
  complaintForm.description = ''
  complaintForm.evidenceUrlsText = ''
}

function appendComplaintSnippet(text: string) {
  const current = complaintForm.description.trim()
  if (!current) {
    complaintForm.description = text
    return
  }
  if (current.includes(text)) {
    return
  }
  complaintForm.description = `${current}\n${text}`
}

function openOrderAftersales() {
  if (!orderId.value) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId.value}&tab=aftersales` })
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

function getComplaintTagType(status: ComplaintRecord['status']) {
  if (status === 'RESOLVED') {
    return 'success'
  }
  if (status === 'REJECTED') {
    return 'default'
  }
  return 'warning'
}

async function loadPage(showError = false) {
  if (!orderId.value || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  error.value = ''
  try {
    const [detail, complaintRows] = await Promise.all([
      getOrderDetail(orderId.value),
      getOrderComplaints(orderId.value),
    ])
    order.value = detail
    complaints.value = complaintRows
  }
  catch (err) {
    order.value = null
    complaints.value = []
    error.value = getErrorMessage(err, '加载投诉页失败')
    if (showError) {
      uni.showToast({ title: error.value, icon: 'none' })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitComplaint() {
  if (!order.value || !canCreateComplaint.value) {
    return
  }

  const description = complaintForm.description.trim()
  if (description.length < 5) {
    uni.showToast({ title: '请填写至少 5 个字的投诉说明', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload: CreateComplaintPayload = {
      targetRole: complaintForm.targetRole,
      complaintType: complaintForm.complaintType,
      description,
      evidenceUrls: complaintForm.evidenceUrlsText
        .split(/[\n,，]/)
        .map(item => item.trim())
        .filter(Boolean),
    }
    await createOrderComplaint(order.value.id, payload)
    resetComplaintForm()
    await loadPage(false)
    uni.showToast({ title: '投诉已提交', icon: 'none' })
  }
  catch (err) {
    uni.showToast({ title: getErrorMessage(err, '提交投诉失败'), icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

onLoad((options: Record<string, string | undefined>) => {
  if (options?.id) {
    orderId.value = options.id
  }
  resetComplaintForm()
  void loadPage(false)
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="投诉处理">
    <template v-if="loading && !order">
      <AppSection title="正在准备投诉页">
        <AppStatus mode="loading" text="正在同步订单和售后进度" />
      </AppSection>
    </template>

    <template v-else-if="order">
      <AppSection title="当前订单">
        <view class="order-complaint-focus">
          <view class="order-complaint-focus__copy">
            <view class="order-complaint-focus__tags">
              <AppTag
                v-for="tag in complaintHeroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <text class="order-complaint-focus__title">{{ order.orderNo }}</text>
            <text class="order-complaint-focus__meta">{{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="order-complaint-focus__meta">实付 ¥{{ formatAmount(order.amountPaid) }} · 已退 ¥{{ formatAmount(order.amountRefunded) }}</text>
            <text class="order-complaint-focus__meta order-complaint-focus__meta--strong">{{ complaintSummaryHint }}</text>
          </view>
          <view class="order-complaint-actions">
            <AppButton size="medium" type="info" @click="openOrderAftersales">返回售后</AppButton>
          </view>

          <view class="order-complaint-signal-grid">
            <view
              v-for="signal in complaintSignalCards"
              :key="signal.key"
              class="order-complaint-signal"
              :class="`order-complaint-signal--${signal.tone}`"
            >
              <text class="order-complaint-signal__title">{{ signal.title }}</text>
              <text class="order-complaint-signal__value">{{ signal.value }}</text>
              <text class="order-complaint-signal__hint">{{ signal.hint }}</text>
            </view>
          </view>
        </view>
      </AppSection>

      <AppSection v-if="activeComplaint" title="进行中的投诉">
        <view class="order-complaint-card">
          <view class="order-complaint-card__header">
            <text class="order-complaint-card__title">{{ getComplaintTypeLabel(activeComplaint.complaintType) }}</text>
            <AppTag :type="getComplaintTagType(activeComplaint.status)">
              {{ getComplaintStatusLabel(activeComplaint.status) }}
            </AppTag>
          </view>
          <text class="order-complaint-card__meta">
            投诉对象：{{ getComplaintTargetRoleLabel(activeComplaint.targetRole) }} · {{ formatDateTime(activeComplaint.updatedAt) }}
          </text>
          <text class="order-complaint-card__content">{{ activeComplaint.description }}</text>
          <view v-if="activeComplaint.evidenceUrls.length" class="order-complaint-evidence-row">
            <view
              v-for="url in activeComplaint.evidenceUrls"
              :key="url"
              class="order-complaint-evidence-chip"
              @click="openEvidenceUrl(url)"
            >
              <text>查看证据</text>
            </view>
          </view>
          <view v-if="activeComplaint.processLogs.length" class="order-complaint-log-list">
            <view v-for="log in activeComplaint.processLogs" :key="log.id" class="order-complaint-log-item">
              <text class="order-complaint-log-item__title">{{ log.operatorNickname || '平台处理' }}</text>
              <text class="order-complaint-log-item__meta">{{ formatDateTime(log.createdAt) }}</text>
              <text v-if="log.note" class="order-complaint-log-item__note">{{ log.note }}</text>
            </view>
          </view>
        </view>
      </AppSection>

      <AppSection v-else-if="canCreateComplaint" title="发起投诉">
        <view class="order-complaint-form">
          <view class="order-complaint-form__group">
            <text class="order-complaint-form__label">投诉对象</text>
            <AppChoiceChips v-model="complaintForm.targetRole" :options="complaintTargetOptions" show-descriptions />
          </view>

          <view class="order-complaint-form__group">
            <text class="order-complaint-form__label">投诉类型</text>
            <AppChoiceChips v-model="complaintForm.complaintType" :options="complaintTypeOptions" show-descriptions />
          </view>

          <view class="order-complaint-form__group">
            <text class="order-complaint-form__label">快速补充</text>
            <view class="order-complaint-evidence-row">
              <view
                v-for="snippet in complaintSnippetSuggestions"
                :key="snippet"
                class="order-complaint-evidence-chip"
                @click="appendComplaintSnippet(snippet)"
              >
                <text>{{ snippet }}</text>
              </view>
            </view>
          </view>

          <view class="order-complaint-form__group">
            <text class="order-complaint-form__label">问题说明</text>
            <textarea
              v-model="complaintForm.description"
              class="order-complaint-textarea"
              :maxlength="400"
              auto-height
              placeholder="写清发生了什么、时间点、证据和你希望平台怎样处理"
            />
          </view>

          <view class="order-complaint-form__group">
            <text class="order-complaint-form__label">证据链接</text>
            <textarea
              v-model="complaintForm.evidenceUrlsText"
              class="order-complaint-textarea order-complaint-textarea--compact"
              :maxlength="400"
              auto-height
              placeholder="可补充图片或文件链接，每行一条或用逗号分隔"
            />
          </view>

          <view class="order-complaint-actions">
            <AppButton size="medium" type="info" @click="openOrderAftersales">稍后处理</AppButton>
            <AppButton size="medium" type="danger" :loading="submitting" @click="submitComplaint">提交投诉</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection v-else title="投诉历史">
        <view v-if="sortedComplaints.length" class="order-complaint-history">
          <view v-for="complaint in sortedComplaints" :key="complaint.id" class="order-complaint-card">
            <view class="order-complaint-card__header">
              <text class="order-complaint-card__title">{{ getComplaintTypeLabel(complaint.complaintType) }}</text>
              <AppTag :type="getComplaintTagType(complaint.status)">
                {{ getComplaintStatusLabel(complaint.status) }}
              </AppTag>
            </view>
            <text class="order-complaint-card__meta">
              投诉对象：{{ getComplaintTargetRoleLabel(complaint.targetRole) }} · {{ formatDateTime(complaint.updatedAt) }}
            </text>
            <text class="order-complaint-card__content">{{ complaint.description }}</text>
            <view v-if="complaint.evidenceUrls.length" class="order-complaint-evidence-row">
              <view
                v-for="url in complaint.evidenceUrls"
                :key="url"
                class="order-complaint-evidence-chip"
                @click="openEvidenceUrl(url)"
              >
                <text>查看证据</text>
              </view>
            </view>
            <text v-if="complaint.resultSummary" class="order-complaint-card__result">处理结论：{{ complaint.resultSummary }}</text>
          </view>
        </view>
        <AppStatus v-else text="当前订单暂时不可发起新的投诉。" />
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="投诉页不可用">
        <AppStatus :text="error || '订单不存在或暂时无法投诉'" />
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.order-complaint-focus,
.order-complaint-card,
.order-complaint-form {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.order-complaint-focus {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.order-complaint-focus__copy,
.order-complaint-log-list,
.order-complaint-history,
.order-complaint-form__group {
  display: grid;
  gap: 10rpx;
}

.order-complaint-focus__tags,
.order-complaint-actions,
.order-complaint-card__header {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
}

.order-complaint-focus__title,
.order-complaint-card__title {
  color: var(--app-text);
  font-size: 32rpx;
  line-height: 1.25;
  font-weight: 700;
}

.order-complaint-focus__meta,
.order-complaint-card__meta,
.order-complaint-form__label,
.order-complaint-log-item__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.order-complaint-focus__meta--strong {
  color: var(--app-text);
}

.order-complaint-card__content,
.order-complaint-log-item__note,
.order-complaint-card__result {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

.order-complaint-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.order-complaint-signal {
  display: grid;
  gap: 10rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--app-shape-lg);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.order-complaint-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.order-complaint-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.order-complaint-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.order-complaint-signal__title {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.order-complaint-signal__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.order-complaint-signal__hint {
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 1.6;
}

.order-complaint-log-item {
  display: grid;
  gap: 6rpx;
  padding: 18rpx 20rpx;
  border-radius: var(--app-shape-lg);
  background: var(--app-surface-soft);
}

.order-complaint-log-item__title {
  color: var(--app-text);
  font-size: 24rpx;
  font-weight: 600;
}

.order-complaint-textarea {
  width: 100%;
  min-height: 180rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text);
  line-height: 1.7;
  box-sizing: border-box;
}

.order-complaint-textarea--compact {
  min-height: 120rpx;
}

.order-complaint-evidence-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.order-complaint-evidence-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text-secondary);
}

@media (max-width: 680px) {
  .order-complaint-signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
