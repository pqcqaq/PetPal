<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 刚完成支付或回看支付结果的主人
 * Entry: 结算页支付成功、待支付订单回流、历史结果回看
 * First screen: 先确认有没有付成功，以及下一步该进订单还是继续支付
 * Primary action: 进入当前订单的下一步
 * Secondary actions: 看沟通、回订单列表
 * States: 加载中、订单不存在、支付完成、仍待支付
 */
import type { OrderDetailRecord, PaymentRecordDetail } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getOrderDetail } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatDateTime,
  formatRange,
  getConversationUnreadCount,
  getOwnerOrderFilterForOrder,
  getOrderStatusLabel,
  getOrderTone,
  openPetPalOrdersPage,
  PETPAL_CHECKOUT_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
  PETPAL_REVIEW_RESULT_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalPaymentResultPage',
})

definePage({
  style: {
    navigationBarTitleText: '支付结果',
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

type DetailRow = {
  title: string
  value: string
  hint: string
}

const tokenStore = useTokenStore()

const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const loading = ref(false)
const error = ref('')

const paymentStatusLabels: Record<PaymentRecordDetail['payStatus'], string> = {
  PENDING: '待支付',
  PAID: '支付成功',
  FAILED: '支付失败',
  CLOSED: '已关闭',
}

const sortedPayments = computed(() => {
  if (!order.value) {
    return []
  }

  return [...order.value.payments].sort((left, right) => {
    const leftTime = new Date(left.paidAt || left.updatedAt || left.createdAt).getTime()
    const rightTime = new Date(right.paidAt || right.updatedAt || right.createdAt).getTime()
    return rightTime - leftTime
  })
})

const latestPayment = computed(() => sortedPayments.value[0] ?? null)

const totalAmount = computed(() => {
  if (!order.value) {
    return 0
  }
  return Number(order.value.amountTotal) + Number(order.value.amountAdjusted)
})

const outstandingAmount = computed(() => {
  if (!order.value) {
    return 0
  }
  return Number(Math.max(0, totalAmount.value - Number(order.value.amountPaid)).toFixed(2))
})

const isFullyPaid = computed(() => Boolean(order.value && outstandingAmount.value <= 0))
const unreadCount = computed(() => getConversationUnreadCount(order.value?.conversation, 'owner'))

const stageLabel = computed(() => {
  if (!order.value) {
    return '同步中'
  }
  if (!isFullyPaid.value) {
    return `仍待支付 ¥${formatAmount(outstandingAmount.value)}`
  }
  if (order.value.orderStatus === 'PENDING_ACCEPT') {
    return '已支付，等待接单'
  }
  if (order.value.orderStatus === 'ACCEPTED') {
    return '已接单，等待服务开始'
  }
  if (order.value.orderStatus === 'SERVING') {
    return '服务进行中'
  }
  if (order.value.orderStatus === 'COMPLETED' && !order.value.review) {
    return '订单完成，待评价'
  }
  return getOrderStatusLabel(order.value.orderStatus)
})

const stageTone = computed<ViewTone>(() => {
  if (!order.value) {
    return 'default'
  }
  if (!isFullyPaid.value) {
    return 'warning'
  }
  const tone = getOrderTone(order.value.orderStatus)
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  return 'primary'
})

const focusTitle = computed(() => {
  if (!order.value) {
    return '正在同步支付结果'
  }
  return isFullyPaid.value ? '支付已完成' : '继续支付'
})

const focusSummary = computed(() => {
  if (!order.value) {
    return '正在同步订单和支付状态。'
  }
  if (!isFullyPaid.value) {
    return '这单还没有付完，先回到支付页补齐金额。'
  }
  if (order.value.orderStatus === 'PENDING_ACCEPT') {
    return '款项已经到账，下一步等照料者接单。'
  }
  if (order.value.orderStatus === 'ACCEPTED') {
    return '照料者已经接单，下一步直接看订单安排。'
  }
  if (order.value.orderStatus === 'SERVING') {
    return '订单已经进入服务中，直接回订单看履约记录。'
  }
  if (order.value.orderStatus === 'COMPLETED' && !order.value.review) {
    return '订单已经完成，下一步可以直接去写评价。'
  }
  return '支付结果已经同步，继续进入订单处理下一步。'
})

const heroTags = computed(() => {
  if (!order.value) {
    return []
  }

  const tags = [
    { label: isFullyPaid.value ? '支付完成' : '待补款', type: isFullyPaid.value ? 'success' : 'warning' as ViewTone },
    { label: stageLabel.value, type: stageTone.value },
    { label: serviceTypeLabels[order.value.serviceType], type: 'primary' as ViewTone },
  ]

  if (unreadCount.value > 0) {
    tags.push({
      label: `${unreadCount.value} 条未读`,
      type: 'warning' as ViewTone,
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
      key: 'payment',
      title: '支付',
      value: isFullyPaid.value ? `已付 ¥${formatAmount(order.value.amountPaid)}` : `待付 ¥${formatAmount(outstandingAmount.value)}`,
      hint: latestPayment.value
        ? `${paymentStatusLabels[latestPayment.value.payStatus]} · ${formatDateTime(latestPayment.value.paidAt || latestPayment.value.updatedAt || latestPayment.value.createdAt)}`
        : '还没有支付记录',
      tone: isFullyPaid.value ? 'success' : 'warning',
    },
    {
      key: 'stage',
      title: '阶段',
      value: stageLabel.value,
      hint: `订单总额 ¥${formatAmount(totalAmount.value)}`,
      tone: stageTone.value,
    },
    {
      key: 'message',
      title: '沟通',
      value: unreadCount.value > 0 ? `${unreadCount.value} 条未读` : order.value.conversation?.lastMessageAt ? '沟通已读' : '暂未沟通',
      hint: order.value.conversation?.lastMessageAt
        ? `最近沟通 ${formatDateTime(order.value.conversation.lastMessageAt)}`
        : '需要时可直接联系照料者',
      tone: unreadCount.value > 0 ? 'warning' : 'default',
    },
  ]
})

const detailRows = computed<DetailRow[]>(() => {
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
      value: `已付 ¥${formatAmount(order.value.amountPaid)}`,
      hint: isFullyPaid.value ? '当前无需补款' : `还差 ¥${formatAmount(outstandingAmount.value)}`,
    },
  ]
})

const primaryActionLabel = computed(() => {
  if (!order.value) {
    return '返回订单'
  }
  if (!isFullyPaid.value) {
    return `继续支付 ¥${formatAmount(outstandingAmount.value)}`
  }
  if (order.value.orderStatus === 'COMPLETED') {
    return order.value.review ? '查看评价结果' : '去写评价'
  }
  return '进入订单'
})

const secondaryActionLabel = computed(() => {
  if (!order.value) {
    return '订单列表'
  }
  return isFullyPaid.value ? (unreadCount.value > 0 ? '看沟通' : '订单列表') : '订单列表'
})

function getPaymentTagType(status: PaymentRecordDetail['payStatus']): ViewTone {
  if (status === 'PAID') return 'success'
  if (status === 'PENDING') return 'warning'
  if (status === 'FAILED') return 'danger'
  return 'default'
}

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

function openCheckout() {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_CHECKOUT_PAGE}?orderId=${order.value.id}` })
}

function openPrimaryAction() {
  if (!order.value) {
    openOrders()
    return
  }

  if (!isFullyPaid.value) {
    openCheckout()
    return
  }

  if (order.value.orderStatus === 'COMPLETED') {
    const targetPage = order.value.review ? PETPAL_REVIEW_RESULT_PAGE : PETPAL_ORDER_REVIEW_PAGE
    uni.redirectTo({ url: `${targetPage}?id=${order.value.id}` })
    return
  }

  if (order.value.orderStatus === 'SERVING') {
    openOrderDetail('service')
    return
  }

  if (
    order.value.orderStatus === 'DISPUTED'
    || order.value.orderStatus === 'PARTIAL_REFUNDED'
    || order.value.orderStatus === 'REFUNDED'
  ) {
    openOrderDetail('aftersales')
    return
  }

  openOrderDetail('overview')
}

function openSecondaryAction() {
  if (!order.value) {
    openOrders()
    return
  }

  if (isFullyPaid.value && unreadCount.value > 0) {
    openOrderDetail('chat')
    return
  }

  openOrders()
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
    error.value = getErrorMessage(cause, '加载支付结果失败')
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
  <AppPageShell title="支付结果">
    <template v-if="tokenStore.hasLogin">
      <view v-if="loading && !order" class="pay-empty">
        <AppStatus mode="loading" text="正在同步支付结果" />
      </view>

      <view v-else-if="order" class="pay-page">
        <view class="pay-focus">
          <view class="pay-focus__copy">
            <view class="pay-focus__tags">
              <AppTag
                v-for="tag in heroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <text class="pay-focus__title">{{ focusTitle }}</text>
            <text class="pay-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
            <text class="pay-focus__summary">{{ focusSummary }}</text>
          </view>

          <view class="pay-focus__actions">
            <AppButton size="medium" @click="openPrimaryAction">{{ primaryActionLabel }}</AppButton>
            <AppButton size="medium" type="info" @click="openSecondaryAction">{{ secondaryActionLabel }}</AppButton>
          </view>
        </view>

        <view class="pay-signal-grid">
          <view
            v-for="signal in signalCards"
            :key="signal.key"
            class="pay-signal"
            :class="`pay-signal--${signal.tone}`"
          >
            <text class="pay-signal__title">{{ signal.title }}</text>
            <text class="pay-signal__value">{{ signal.value }}</text>
            <text class="pay-signal__hint">{{ signal.hint }}</text>
          </view>
        </view>

        <view class="pay-group">
          <view
            v-for="item in detailRows"
            :key="item.title"
            class="pay-row"
          >
            <view class="pay-row__copy">
              <text class="pay-row__title">{{ item.title }}</text>
              <text class="pay-row__hint">{{ item.hint }}</text>
            </view>
            <text class="pay-row__value">{{ item.value }}</text>
          </view>
        </view>

        <view v-if="sortedPayments.length" class="pay-group">
          <view class="pay-group__head">
            <text class="pay-group__title">支付记录</text>
            <AppTag type="default">{{ sortedPayments.length }} 条</AppTag>
          </view>

          <view class="pay-record-list">
            <view
              v-for="payment in sortedPayments"
              :key="payment.id"
              class="pay-row"
            >
              <view class="pay-row__copy">
                <text class="pay-row__title">{{ payment.payNo }}</text>
                <text class="pay-row__hint">{{ formatDateTime(payment.paidAt || payment.updatedAt || payment.createdAt) }}</text>
              </view>
              <view class="pay-row__meta">
                <AppTag :type="getPaymentTagType(payment.payStatus)">
                  {{ paymentStatusLabels[payment.payStatus] }}
                </AppTag>
                <text class="pay-row__value">¥{{ formatAmount(payment.payAmount) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="pay-empty">
        <AppStatus :text="error || '订单不存在或暂时无法查看支付结果'" />
        <AppButton block type="info" @click="openOrders">返回订单列表</AppButton>
      </view>
    </template>

    <template v-else>
      <view class="pay-empty">
        <AppStatus text="登录后查看支付结果和下一步。" />
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.pay-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.pay-focus,
.pay-group,
.pay-empty {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.pay-focus {
  background:
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.pay-focus__copy,
.pay-row__copy {
  display: grid;
  gap: 8rpx;
}

.pay-focus__tags,
.pay-focus__actions,
.pay-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  align-items: center;
}

.pay-focus__title,
.pay-group__title,
.pay-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.pay-focus__meta,
.pay-focus__summary,
.pay-signal__title,
.pay-signal__hint,
.pay-row__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.pay-focus__summary {
  color: var(--app-text);
}

.pay-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  padding: 0 24rpx;
}

.pay-signal {
  display: grid;
  gap: 10rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  box-shadow: var(--app-elevation-1);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.pay-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.pay-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.pay-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.pay-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.pay-signal__value,
.pay-row__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.pay-group {
  overflow: hidden;
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.pay-group__head,
.pay-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.pay-record-list {
  display: grid;
}

.pay-row {
  padding: 24rpx 0;
}

.pay-row + .pay-row {
  border-top: 1rpx solid var(--app-outline-variant);
}

.pay-empty {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

@media (max-width: 680px) {
  .pay-signal-grid {
    grid-template-columns: 1fr;
  }

  .pay-group__head,
  .pay-row {
    align-items: flex-start;
  }
}
</style>
