<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已完成订单的主人，要快速完成一次清晰评价
 * Entry: 从订单详情点击写评价或查看评价进入
 * Core scenes:
 * 1. 首屏先判断这单现在是否能评、是否已评
 * 2. 在同一屏完成评分、标签和一句话反馈
 * 3. 已评价时先看结果，不再重复出现提交表单
 * Primary action: 提交评价
 * Secondary actions: 快速补标签、切实名/匿名、返回订单详情
 * Feedback: 当前阶段、已退金额、服务记录数量、当前评分与标签数量
 * States: 加载中、订单不存在、不可评价、可评价、已评价
 */
import type {
  CreateOrderReviewPayload,
  OrderDetailRecord,
} from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getOrderDetail, reviewOrder } from '@/api/petpal'
import { useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatRange,
  getOrderStatusLabel,
  joinTagText,
  PETPAL_ORDER_DETAIL_PAGE,
  serviceTypeLabels,
  splitTagText,
} from '../petpal/owner-shared'

defineOptions({
  name: 'OrderReviewPage',
})

definePage({
  style: {
    navigationBarTitleText: '订单评价',
    enablePullDownRefresh: true,
  },
})

type YesNoChoice = 'YES' | 'NO'
type ReviewSignalTone = 'primary' | 'success' | 'warning' | 'default'

interface ReviewSignalCard {
  key: string
  title: string
  value: string
  hint: string
  tone: ReviewSignalTone
}

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const loading = ref(false)
const error = ref('')
const submitting = ref(false)

const reviewForm = reactive({
  rating: '5',
  tagsText: '准时签到，沟通顺畅',
  content: '',
  isAnonymous: 'NO' as YesNoChoice,
})

const ratingOptions = [
  { label: '1 分', value: '1', description: '明显不满意' },
  { label: '2 分', value: '2', description: '仍有较多问题' },
  { label: '3 分', value: '3', description: '整体合格' },
  { label: '4 分', value: '4', description: '体验良好' },
  { label: '5 分', value: '5', description: '愿意继续复购' },
]

const visibilityOptions = [
  { label: '实名评价', value: 'NO', description: '展示当前昵称' },
  { label: '匿名评价', value: 'YES', description: '隐藏昵称' },
]

const reviewTagSuggestions = [
  '准时签到',
  '沟通顺畅',
  '记录清晰',
  '宠物状态稳定',
  '反馈及时',
  '值得复购',
]

const isOwnerView = computed(() => Boolean(userInfo.value.id && order.value?.ownerId === userInfo.value.id))
const canSubmitReview = computed(() => Boolean(
  isOwnerView.value
  && order.value
  && order.value.orderStatus === 'COMPLETED'
  && !order.value.review,
))
const selectedTags = computed(() => splitTagText(reviewForm.tagsText))
const reviewStageLabel = computed(() => {
  if (order.value?.review) {
    return '已评价'
  }
  if (canSubmitReview.value) {
    return '待评价'
  }
  return '当前不可评价'
})
const reviewStageTagType = computed(() => {
  if (order.value?.review) {
    return 'success'
  }
  if (canSubmitReview.value) {
    return 'warning'
  }
  return 'default'
})
const reviewHeroTags = computed(() => {
  if (!order.value) {
    return []
  }
  const tags = [
    { label: serviceTypeLabels[order.value.serviceType], type: 'primary' as const },
    { label: reviewStageLabel.value, type: reviewStageTagType.value as 'success' | 'warning' | 'default' },
  ]

  if (Number(order.value.amountRefunded) > 0) {
    tags.push({
      label: `已退 ¥${formatAmount(order.value.amountRefunded)}`,
      type: 'warning' as const,
    })
  }

  return tags
})
const reviewSummaryHint = computed(() => {
  if (order.value?.review) {
    return '评价结果已经提交，可直接回看内容。'
  }
  if (canSubmitReview.value) {
    return '先给整体评分，再补标签和一句话反馈。'
  }
  return '只有主人在订单完成后才能提交一次评价。'
})
const reviewSignalCards = computed<ReviewSignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      key: 'stage',
      title: '当前阶段',
      value: reviewStageLabel.value,
      hint: reviewSummaryHint.value,
      tone: order.value.review ? 'success' : canSubmitReview.value ? 'warning' : 'default',
    },
    {
      key: 'service',
      title: '履约记录',
      value: order.value.serviceLogs.length > 0 ? `${order.value.serviceLogs.length} 条服务记录` : '暂未记录服务日志',
      hint: order.value.serviceLogs.length > 0 ? '可结合履约记录判断体验' : '可结合沟通和服务结果评价',
      tone: order.value.serviceLogs.length > 0 ? 'primary' : 'default',
    },
    {
      key: 'draft',
      title: order.value.review ? '评价结果' : '当前填写',
      value: order.value.review
        ? `${order.value.review.rating} / 5 分`
        : `${reviewForm.rating} / 5 分`,
      hint: order.value.review
        ? `${order.value.review.tags.length} 个标签`
        : `${selectedTags.value.length} 个标签`,
      tone: order.value.review ? 'success' : 'primary',
    },
  ]
})

function resetReviewForm() {
  reviewForm.rating = '5'
  reviewForm.tagsText = '准时签到，沟通顺畅'
  reviewForm.content = ''
  reviewForm.isAnonymous = 'NO'
}

function toggleSuggestion(tag: string) {
  const current = splitTagText(reviewForm.tagsText)
  const exists = current.includes(tag)
  reviewForm.tagsText = joinTagText(
    exists ? current.filter(item => item !== tag) : [...current, tag],
  )
}

function openOrderDetail() {
  if (!orderId.value) {
    uni.navigateBack({ delta: 1 })
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId.value}&tab=overview` })
}

async function loadPage(showError = false) {
  if (!orderId.value || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  error.value = ''
  try {
    order.value = await getOrderDetail(orderId.value)
  }
  catch (err) {
    order.value = null
    error.value = getErrorMessage(err, '加载评价页失败')
    if (showError) {
      uni.showToast({ title: error.value, icon: 'none' })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitReview() {
  if (!order.value || !canSubmitReview.value) {
    return
  }

  const rating = Number(reviewForm.rating)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    uni.showToast({ title: '请选择有效评分', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload: CreateOrderReviewPayload = {
      rating,
      tags: splitTagText(reviewForm.tagsText),
      content: reviewForm.content.trim() || undefined,
      isAnonymous: reviewForm.isAnonymous === 'YES',
    }
    order.value = await reviewOrder(order.value.id, payload)
    uni.showToast({ title: '评价已提交', icon: 'none' })
  }
  catch (err) {
    uni.showToast({ title: getErrorMessage(err, '提交评价失败'), icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

onLoad((options: Record<string, string | undefined>) => {
  if (options?.id) {
    orderId.value = options.id
  }
  resetReviewForm()
  void loadPage(false)
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="订单评价">
    <template v-if="loading && !order">
      <AppSection title="正在准备评价">
        <AppStatus mode="loading" text="正在同步订单信息" />
      </AppSection>
    </template>

    <template v-else-if="order">
      <AppSection title="当前订单">
        <view class="order-review-focus">
          <view class="order-review-focus__copy">
            <view class="order-review-focus__tags">
              <AppTag
                v-for="tag in reviewHeroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <text class="order-review-focus__title">{{ order.orderNo }}</text>
            <text class="order-review-focus__meta">{{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="order-review-focus__meta">实付 ¥{{ formatAmount(order.amountPaid) }} · 已退 ¥{{ formatAmount(order.amountRefunded) }}</text>
            <text class="order-review-focus__meta order-review-focus__meta--strong">{{ reviewSummaryHint }}</text>
          </view>
          <view class="order-review-actions">
            <AppButton size="medium" type="info" @click="openOrderDetail">返回订单</AppButton>
          </view>

          <view class="order-review-signal-grid">
            <view
              v-for="signal in reviewSignalCards"
              :key="signal.key"
              class="order-review-signal"
              :class="`order-review-signal--${signal.tone}`"
            >
              <text class="order-review-signal__title">{{ signal.title }}</text>
              <text class="order-review-signal__value">{{ signal.value }}</text>
              <text class="order-review-signal__hint">{{ signal.hint }}</text>
            </view>
          </view>
        </view>
      </AppSection>

      <AppSection v-if="order.review" title="已提交评价">
        <view class="order-review-result">
          <view class="order-review-result__header">
            <text class="order-review-result__title">{{ order.review.rating }} / 5 分</text>
            <AppTag :type="order.review.isAnonymous ? 'warning' : 'default'">
              {{ order.review.isAnonymous ? '匿名评价' : '实名评价' }}
            </AppTag>
          </view>
          <view v-if="order.review.tags.length" class="order-review-chip-row">
            <view
              v-for="tag in order.review.tags"
              :key="tag"
              class="order-review-chip order-review-chip--selected"
            >
              <text>{{ tag }}</text>
            </view>
          </view>
          <text v-if="order.review.content" class="order-review-result__content">{{ order.review.content }}</text>
          <text class="order-review-result__meta">提交于 {{ formatRange(order.review.createdAt, order.review.createdAt).split(' - ')[0] }}</text>
        </view>
      </AppSection>

      <AppSection v-else-if="canSubmitReview" title="写评价">
        <view class="order-review-form">
          <view class="order-review-form__group">
            <text class="order-review-form__label">本次体验</text>
            <AppChoiceChips v-model="reviewForm.rating" :options="ratingOptions" show-descriptions />
          </view>

          <view class="order-review-form__group">
            <text class="order-review-form__label">快速标签</text>
            <view class="order-review-chip-row">
              <view
                v-for="tag in reviewTagSuggestions"
                :key="tag"
                class="order-review-chip"
                :class="selectedTags.includes(tag) ? 'order-review-chip--selected' : ''"
                @click="toggleSuggestion(tag)"
              >
                <text>{{ tag }}</text>
              </view>
            </view>
          </view>

          <AppInput v-model="reviewForm.tagsText" label="标签" placeholder="多个标签用逗号分隔" />

          <view class="order-review-form__group">
            <text class="order-review-form__label">补充说明</text>
            <textarea
              v-model="reviewForm.content"
              class="order-review-textarea"
              :maxlength="240"
              auto-height
              placeholder="补充这次照料体验、沟通和宠物状态"
            />
          </view>

          <view class="order-review-form__group">
            <text class="order-review-form__label">展示方式</text>
            <AppChoiceChips v-model="reviewForm.isAnonymous" :options="visibilityOptions" show-descriptions />
          </view>

          <view class="order-review-actions">
            <AppButton size="medium" type="info" @click="openOrderDetail">稍后再写</AppButton>
            <AppButton size="medium" :loading="submitting" @click="submitReview">提交评价</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection v-else title="当前还不能评价">
        <AppStatus text="只有主人在订单完成后才能提交一次评价。" />
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="评价页不可用">
        <AppStatus :text="error || '订单不存在或暂时无法评价'" />
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.order-review-focus,
.order-review-result,
.order-review-form,
.order-review-signal {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.order-review-focus {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.order-review-focus__copy {
  display: grid;
  gap: 8rpx;
}

.order-review-focus__tags,
.order-review-actions,
.order-review-result__header,
.order-review-chip-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.order-review-focus__title,
.order-review-result__title {
  color: var(--app-text);
  font-size: 32rpx;
  line-height: 1.25;
  font-weight: 700;
}

.order-review-focus__meta,
.order-review-form__label,
.order-review-result__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.order-review-focus__meta--strong {
  color: var(--app-text);
}

.order-review-form__group {
  display: grid;
  gap: 12rpx;
}

.order-review-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.order-review-signal {
  padding: 18rpx 20rpx;
  gap: 10rpx;
}

.order-review-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.order-review-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.order-review-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.order-review-signal__title {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.order-review-signal__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.order-review-signal__hint {
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 1.6;
}

.order-review-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 60rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text-secondary);
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.order-review-chip--selected {
  border-color: transparent;
  background: var(--app-accent-soft);
  color: var(--app-text);
  transform: translateY(-1rpx);
}

.order-review-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text);
  line-height: 1.7;
  box-sizing: border-box;
}

.order-review-result__content {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

@media (max-width: 680px) {
  .order-review-signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
