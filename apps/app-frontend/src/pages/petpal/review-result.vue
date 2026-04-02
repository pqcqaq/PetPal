<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已提交评价或正在回看评价结果的主人
 * Entry: 评价提交成功回流、订单详情评价入口、支付/退款/投诉结果页下一步
 * Core scenes:
 * 1. 首屏直接确认评价是否已提交、评分多少、当前订单下一步是什么
 * 2. 已评价时优先展示评分、标签和一句话反馈，不再回表单页确认
 * 3. 仍有沟通或售后时直接给出回流，不让用户自己猜该回哪里
 * Primary action: 进入当前订单最相关的下一步
 * Secondary actions: 回订单、回订单列表、继续评价
 * Feedback: 评分结果、订单阶段、未读沟通、服务记录数量、售后状态
 * States: 加载中、无评价、已评价、可继续评价、订单不存在
 */
import type { OrderDetailRecord } from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getOrderDetail } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatDateTime,
  formatRange,
  getConversationUnreadCount,
  getOrderStatusLabel,
  isOrderAftersalesTracked,
  openPetPalAction,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
  PETPAL_ORDERS_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalReviewResultPage',
})

definePage({
  style: {
    navigationBarTitleText: '评价结果',
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
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const loading = ref(false)
const error = ref('')

const isOwnerView = computed(() => Boolean(userInfo.value.id && order.value?.ownerId === userInfo.value.id))
const canCreateReview = computed(() => Boolean(
  isOwnerView.value
  && order.value
  && order.value.orderStatus === 'COMPLETED'
  && !order.value.review,
))
const hasReview = computed(() => Boolean(order.value?.review))
const unreadCount = computed(() => getConversationUnreadCount(order.value?.conversation, 'owner'))
const aftersalesTracked = computed(() => Boolean(order.value && isOrderAftersalesTracked(order.value)))

const heroTags = computed(() => {
  if (!order.value) {
    return []
  }

  const tags: Array<{ label: string, type: ViewTone }> = [
    {
      label: hasReview.value ? '已评价' : canCreateReview.value ? '待评价' : '暂无评价',
      type: hasReview.value ? 'success' : canCreateReview.value ? 'warning' : 'default',
    },
    {
      label: serviceTypeLabels[order.value.serviceType],
      type: 'primary',
    },
  ]

  if (order.value.review) {
    tags.push({
      label: `${order.value.review.rating} / 5 分`,
      type: 'success',
    })
    tags.push({
      label: order.value.review.isAnonymous ? '匿名评价' : '实名评价',
      type: order.value.review.isAnonymous ? 'warning' : 'default',
    })
  }

  if (unreadCount.value > 0) {
    tags.push({
      label: `${unreadCount.value} 条未读`,
      type: 'warning',
    })
  }
  else if (aftersalesTracked.value) {
    tags.push({
      label: '售后跟进中',
      type: 'warning',
    })
  }

  return tags
})

const headline = computed(() => {
  if (!order.value) {
    return '正在同步评价结果'
  }
  if (order.value.review) {
    return `${order.value.review.rating} / 5 分`
  }
  if (canCreateReview.value) {
    return '还没有评价'
  }
  return '当前没有评价记录'
})

const summary = computed(() => {
  if (!order.value) {
    return '正在同步这笔订单的评价结果。'
  }
  if (order.value.review) {
    if (aftersalesTracked.value) {
      return '评价已经提交，这单还有售后事项，建议先继续跟进处理。'
    }
    if (unreadCount.value > 0) {
      return '评价已经提交，当前还有未读沟通待处理。'
    }
    return '评价已经提交，可以直接回订单继续查看服务与金额状态。'
  }
  if (canCreateReview.value) {
    return '订单已经完成，现在可以直接写评价。'
  }
  return '当前这笔订单还没有可回看的评价结果。'
})

const signalCards = computed<ResultSignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      key: 'review',
      title: '评价结果',
      value: order.value.review
        ? `${order.value.review.rating} / 5 分`
        : canCreateReview.value ? '待提交' : '暂无记录',
      hint: order.value.review
        ? `${order.value.review.isAnonymous ? '匿名评价' : '实名评价'} · ${order.value.review.tags.length} 个标签`
        : canCreateReview.value ? '订单完成后可提交一次评价' : '当前没有可回看的评价结果',
      tone: order.value.review ? 'success' : canCreateReview.value ? 'warning' : 'default',
    },
    {
      key: 'stage',
      title: '订单阶段',
      value: getOrderStatusLabel(order.value.orderStatus),
      hint: `实付 ¥${formatAmount(order.value.amountPaid)} · 已退 ¥${formatAmount(order.value.amountRefunded)}`,
      tone: aftersalesTracked.value ? 'warning' : 'primary',
    },
    {
      key: 'follow-up',
      title: '继续处理',
      value: unreadCount.value > 0 ? `${unreadCount.value} 条未读` : `${order.value.serviceLogs.length} 条服务记录`,
      hint: aftersalesTracked.value
        ? '这单仍有售后事项，可直接回订单继续跟进'
        : unreadCount.value > 0
          ? '先去看沟通，再决定是否继续售后'
          : '没有未读沟通时，直接回订单查看完整记录',
      tone: unreadCount.value > 0 || aftersalesTracked.value ? 'warning' : 'default',
    },
  ]
})

const primaryActionLabel = computed(() => {
  if (!order.value) {
    return '返回订单列表'
  }
  if (canCreateReview.value) {
    return '去写评价'
  }
  if (aftersalesTracked.value) {
    return '查看售后'
  }
  if (unreadCount.value > 0) {
    return '看沟通'
  }
  return '返回订单'
})

const contextActionLabel = computed(() => {
  if (!order.value) {
    return '订单列表'
  }
  if (aftersalesTracked.value) {
    return '订单售后'
  }
  return '订单总览'
})

function openOrderDetail(tab: 'overview' | 'chat' | 'service' | 'aftersales' = 'overview') {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${order.value.id}&tab=${tab}` })
}

function openOrders() {
  openPetPalAction('redirect', PETPAL_ORDERS_PAGE)
}

function openAftersales() {
  uni.redirectTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openReviewPage() {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_REVIEW_PAGE}?id=${order.value.id}` })
}

function openPrimaryAction() {
  if (!order.value) {
    openOrders()
    return
  }
  if (canCreateReview.value) {
    openReviewPage()
    return
  }
  if (aftersalesTracked.value) {
    openAftersales()
    return
  }
  if (unreadCount.value > 0) {
    openOrderDetail('chat')
    return
  }
  openOrderDetail('overview')
}

function openContextAction() {
  if (!order.value) {
    openOrders()
    return
  }
  openOrderDetail(aftersalesTracked.value ? 'aftersales' : 'overview')
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
    order.value = await getOrderDetail(orderId.value)
  }
  catch (cause: unknown) {
    order.value = null
    error.value = getErrorMessage(cause, '加载评价结果失败')
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
  <AppPageShell title="评价结果">
    <template v-if="tokenStore.hasLogin">
      <template v-if="loading && !order">
        <AppSection title="同步评价结果">
          <AppStatus mode="loading" text="正在同步订单和评价状态" />
        </AppSection>
      </template>

      <template v-else-if="order">
        <AppSection title="评价结果">
          <view class="review-result-focus">
            <view class="review-result-focus__copy">
              <view class="review-result-focus__tags">
                <AppTag
                  v-for="tag in heroTags"
                  :key="tag.label"
                  :type="tag.type"
                >
                  {{ tag.label }}
                </AppTag>
              </view>
              <text class="review-result-focus__title">{{ headline }}</text>
              <text class="review-result-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
              <text class="review-result-focus__meta">
                {{ serviceTypeLabels[order.serviceType] }} · 实付 ¥{{ formatAmount(order.amountPaid) }} · 已退 ¥{{ formatAmount(order.amountRefunded) }}
              </text>
              <text class="review-result-focus__summary">{{ summary }}</text>
            </view>

            <view class="review-result-signal-grid">
              <view
                v-for="signal in signalCards"
                :key="signal.key"
                class="review-result-signal"
                :class="`review-result-signal--${signal.tone}`"
              >
                <text class="review-result-signal__title">{{ signal.title }}</text>
                <text class="review-result-signal__value">{{ signal.value }}</text>
                <text class="review-result-signal__hint">{{ signal.hint }}</text>
              </view>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="order.review" title="本次评价">
          <view class="review-result-card">
            <view class="review-result-card__header">
              <text class="review-result-card__title">{{ order.review.rating }} / 5 分</text>
              <AppTag :type="order.review.isAnonymous ? 'warning' : 'default'">
                {{ order.review.isAnonymous ? '匿名评价' : '实名评价' }}
              </AppTag>
            </view>

            <view v-if="order.review.tags.length" class="review-result-chip-row">
              <view
                v-for="tag in order.review.tags"
                :key="tag"
                class="review-result-chip review-result-chip--selected"
              >
                <text>{{ tag }}</text>
              </view>
            </view>

            <text v-if="order.review.content" class="review-result-card__content">{{ order.review.content }}</text>
            <text class="review-result-card__meta">提交于 {{ formatDateTime(order.review.createdAt) }}</text>
          </view>
        </AppSection>

        <AppSection v-else title="还没有评价">
          <AppStatus :text="canCreateReview ? '订单已经完成，可以直接提交评价。' : '当前没有可回看的评价记录。'" />
        </AppSection>

        <AppSection title="当前订单">
          <AppList>
            <AppListItem
              title="订单状态"
              :label="serviceTypeLabels[order.serviceType]"
              :value="getOrderStatusLabel(order.orderStatus)"
              value-emphasis
            />
            <AppListItem
              title="服务时间"
              :label="formatRange(order.appointmentStart, order.appointmentEnd)"
              :value="`${order.serviceLogs.length} 条记录`"
              value-emphasis
            />
            <AppListItem
              title="金额"
              :label="`实付 ¥${formatAmount(order.amountPaid)} · 已退 ¥${formatAmount(order.amountRefunded)}`"
              :value="aftersalesTracked ? '售后跟进中' : hasReview ? '评价已完成' : '待处理'"
              value-emphasis
            />
          </AppList>
        </AppSection>

        <AppSection title="下一步">
          <view class="review-result-actions">
            <AppButton size="medium" type="info" @click="openContextAction">{{ contextActionLabel }}</AppButton>
            <AppButton size="medium" @click="openPrimaryAction">{{ primaryActionLabel }}</AppButton>
          </view>
        </AppSection>
      </template>

      <template v-else>
        <AppSection title="评价结果不可用">
          <AppStatus :text="error || '订单不存在或暂时无法查看评价结果'" />
        </AppSection>
      </template>
    </template>

    <template v-else>
      <AppSection title="请先登录">
        <AppStatus text="登录后查看评价结果和订单下一步动作" />
        <view class="review-result-actions">
          <AppButton size="medium" @click="goToLogin">去登录</AppButton>
        </view>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.review-result-focus,
.review-result-card,
.review-result-signal {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.review-result-focus {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.review-result-focus__copy {
  display: grid;
  gap: 8rpx;
}

.review-result-focus__tags,
.review-result-card__header,
.review-result-chip-row,
.review-result-actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.review-result-focus__title,
.review-result-card__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.24;
  font-weight: 700;
}

.review-result-focus__meta,
.review-result-card__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.review-result-focus__summary,
.review-result-card__content {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

.review-result-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.review-result-signal {
  padding: 18rpx 20rpx;
  gap: 10rpx;
}

.review-result-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.review-result-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.review-result-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.review-result-signal--danger {
  background: linear-gradient(180deg, rgba(179, 38, 30, 0.12) 0%, var(--app-surface) 100%);
}

.review-result-signal__title {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.4;
}

.review-result-signal__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.review-result-signal__hint {
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 1.6;
}

.review-result-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 60rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text-secondary);
}

.review-result-chip--selected {
  border-color: rgba(53, 89, 224, 0.32);
  background: rgba(53, 89, 224, 0.12);
  color: var(--app-accent);
}

@media (max-width: 720px) {
  .review-result-signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
