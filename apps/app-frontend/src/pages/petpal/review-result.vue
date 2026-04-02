<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已提交评价或正在回看评价结果的主人
 * Entry: 评价提交成功回流、订单详情评价入口、支付/退款/投诉结果页下一步
 * First screen: 先确认有没有评价、打了几分、订单下一步是什么
 * Primary action: 进入当前订单最相关的下一步
 * Secondary actions: 回订单、回售后、继续评价
 * States: 加载中、无评价、已评价、可继续评价、订单不存在
 */
import type { OrderDetailRecord } from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
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
  getOwnerOrderFilterForOrder,
  getOrderStatusLabel,
  isOrderAftersalesTracked,
  openPetPalAftersalesPage,
  openPetPalOrdersPage,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
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

const focusTitle = computed(() => {
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

const focusSummary = computed(() => {
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

const signalCards = computed<SignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      key: 'review',
      title: '评价',
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
      title: '订单',
      value: getOrderStatusLabel(order.value.orderStatus),
      hint: `实付 ¥${formatAmount(order.value.amountPaid)} · 已退 ¥${formatAmount(order.value.amountRefunded)}`,
      tone: aftersalesTracked.value ? 'warning' : 'primary',
    },
    {
      key: 'follow',
      title: '后续',
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
      title: '服务类型',
      value: serviceTypeLabels[order.value.serviceType],
      hint: getOrderStatusLabel(order.value.orderStatus),
    },
    {
      title: '金额',
      value: `实付 ¥${formatAmount(order.value.amountPaid)}`,
      hint: `已退 ¥${formatAmount(order.value.amountRefunded)} · ${order.value.serviceLogs.length} 条服务记录`,
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

const secondaryActionLabel = computed(() => {
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
  if (order.value) {
    openPetPalOrdersPage({
      filter: getOwnerOrderFilterForOrder(order.value),
      focusOrderId: order.value.id,
    })
    return
  }

  openPetPalOrdersPage()
}

function openAftersales() {
  if (order.value) {
    openPetPalAftersalesPage({
      filter: order.value.orderStatus === 'DISPUTED' ? 'COMPLAINT' : 'REFUND',
      focusOrderId: order.value.id,
    })
    return
  }

  openPetPalAftersalesPage()
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

function openSecondaryAction() {
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
      <view v-if="loading && !order" class="review-empty">
        <AppStatus mode="loading" text="正在同步评价结果" />
      </view>

      <view v-else-if="order" class="review-page">
        <view class="review-focus">
          <view class="review-focus__copy">
            <view class="review-focus__tags">
              <AppTag
                v-for="tag in heroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <text class="review-focus__title">{{ focusTitle }}</text>
            <text class="review-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="review-focus__summary">{{ focusSummary }}</text>
          </view>

          <view class="review-focus__actions">
            <AppButton size="medium" @click="openPrimaryAction">{{ primaryActionLabel }}</AppButton>
            <AppButton size="medium" type="info" @click="openSecondaryAction">{{ secondaryActionLabel }}</AppButton>
          </view>
        </view>

        <view class="review-signal-grid">
          <view
            v-for="signal in signalCards"
            :key="signal.key"
            class="review-signal"
            :class="`review-signal--${signal.tone}`"
          >
            <text class="review-signal__title">{{ signal.title }}</text>
            <text class="review-signal__value">{{ signal.value }}</text>
            <text class="review-signal__hint">{{ signal.hint }}</text>
          </view>
        </view>

        <view v-if="order.review" class="review-group">
          <view class="review-group__head">
            <text class="review-group__title">本次评价</text>
            <AppTag :type="order.review.isAnonymous ? 'warning' : 'default'">
              {{ order.review.isAnonymous ? '匿名评价' : '实名评价' }}
            </AppTag>
          </view>

          <view class="review-card">
            <text class="review-card__score">{{ order.review.rating }} / 5 分</text>
            <view v-if="order.review.tags.length" class="review-card__chips">
              <view
                v-for="tag in order.review.tags"
                :key="tag"
                class="review-chip"
              >
                <text>{{ tag }}</text>
              </view>
            </view>
            <text v-if="order.review.content" class="review-card__content">{{ order.review.content }}</text>
            <text class="review-card__meta">提交于 {{ formatDateTime(order.review.createdAt) }}</text>
          </view>
        </view>

        <view v-else class="review-empty-block">
          <AppStatus :text="canCreateReview ? '订单已经完成，可以直接提交评价。' : '当前没有可回看的评价记录。'" />
        </view>

        <view class="review-group">
          <view
            v-for="item in summaryRows"
            :key="item.title"
            class="review-row"
          >
            <view class="review-row__copy">
              <text class="review-row__title">{{ item.title }}</text>
              <text class="review-row__hint">{{ item.hint }}</text>
            </view>
            <text class="review-row__value">{{ item.value }}</text>
          </view>
        </view>
      </view>

      <view v-else class="review-empty">
        <AppStatus :text="error || '订单不存在或暂时无法查看评价结果'" />
      </view>
    </template>

    <template v-else>
      <view class="review-empty">
        <AppStatus text="登录后查看评价结果和订单下一步。" />
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.review-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.review-focus,
.review-group,
.review-empty,
.review-empty-block {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.review-focus {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.review-focus__copy,
.review-row__copy,
.review-card {
  display: grid;
  gap: 8rpx;
}

.review-focus__tags,
.review-focus__actions,
.review-card__chips {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.review-focus__title,
.review-group__title,
.review-row__title,
.review-card__score {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.review-focus__meta,
.review-focus__summary,
.review-signal__title,
.review-signal__hint,
.review-row__hint,
.review-card__meta,
.review-card__content {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.review-focus__summary,
.review-card__content,
.review-row__value,
.review-signal__value {
  color: var(--app-text);
}

.review-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  padding: 0 24rpx;
}

.review-signal {
  display: grid;
  gap: 10rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  box-shadow: var(--app-elevation-1);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.review-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.review-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.review-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.review-signal--danger {
  background: linear-gradient(180deg, rgba(179, 38, 30, 0.12) 0%, var(--app-surface) 100%);
}

.review-signal__value,
.review-row__value {
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.review-group {
  overflow: hidden;
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.review-group__head,
.review-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.review-row {
  padding: 24rpx 0;
}

.review-row + .review-row {
  border-top: 1rpx solid var(--app-outline-variant);
}

.review-card {
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: var(--app-surface-soft);
}

.review-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(53, 89, 224, 0.32);
  background: rgba(53, 89, 224, 0.12);
  color: var(--app-accent);
}

.review-empty,
.review-empty-block {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

@media (max-width: 720px) {
  .review-signal-grid {
    grid-template-columns: 1fr;
  }

  .review-group__head,
  .review-row {
    align-items: flex-start;
  }
}
</style>
