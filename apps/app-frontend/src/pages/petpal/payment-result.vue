<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 刚完成支付或回看支付结果的主人
 * Entry: 结算页支付成功、待支付订单回流、历史结果回看
 * Core scenes:
 * 1. 首屏先确认这次钱有没有付成功，订单已经走到哪一步
 * 2. 直接告诉用户接下来该进订单、看沟通还是继续支付
 * 3. 支付记录留在同页回看，不要求用户再回结算页判断状态
 * Primary action: 进入当前订单的下一步
 * Secondary actions: 看沟通、回订单列表、继续支付
 * Feedback: 支付结果、当前订单阶段、未读沟通、最近支付记录
 * States: 加载中、订单不存在、支付完成、仍待支付
 */
import type { OrderDetailRecord, PaymentRecordDetail } from '@rbac/api-common'
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
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatDateTime,
  formatRange,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  PETPAL_CHECKOUT_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
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

const unreadCount = computed(() => getConversationUnreadCount(order.value?.conversation, 'owner'))

const heroTags = computed(() => {
  if (!order.value) {
    return []
  }

  const tags = [
    { label: isFullyPaid.value ? '支付完成' : '仍待支付', type: isFullyPaid.value ? 'success' : 'warning' as ViewTone },
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

const stageSummary = computed(() => {
  if (!order.value) {
    return '正在同步订单结果。'
  }
  if (!isFullyPaid.value) {
    return '这单还没有付完，先回到支付页补齐金额。'
  }
  if (order.value.orderStatus === 'PENDING_ACCEPT') {
    return '款项已经到账，现在等照料者接单。'
  }
  if (order.value.orderStatus === 'ACCEPTED') {
    return '照料者已经接单，下一步直接跟进沟通和服务安排。'
  }
  if (order.value.orderStatus === 'SERVING') {
    return '订单已经进入服务中，直接去看履约记录。'
  }
  if (order.value.orderStatus === 'COMPLETED' && !order.value.review) {
    return '订单已经完成，下一步可以直接写评价。'
  }
  return '支付结果已经同步，继续进入订单处理下一步。'
})

const signalCards = computed<ResultSignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      key: 'payment',
      title: '支付结果',
      value: isFullyPaid.value ? `已付 ¥${formatAmount(order.value.amountPaid)}` : `仍待 ¥${formatAmount(outstandingAmount.value)}`,
      hint: latestPayment.value
        ? `${paymentStatusLabels[latestPayment.value.payStatus]} · ${formatDateTime(latestPayment.value.paidAt || latestPayment.value.updatedAt || latestPayment.value.createdAt)}`
        : '当前还没有支付记录',
      tone: isFullyPaid.value ? 'success' : 'warning',
    },
    {
      key: 'stage',
      title: '当前阶段',
      value: stageLabel.value,
      hint: stageSummary.value,
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

const primaryActionLabel = computed(() => {
  if (!order.value) {
    return '返回订单'
  }
  if (!isFullyPaid.value) {
    return `继续支付 ¥${formatAmount(outstandingAmount.value)}`
  }
  if (order.value.orderStatus === 'COMPLETED' && !order.value.review) {
    return '去写评价'
  }
  return '进入订单'
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
  uni.redirectTo({ url: PETPAL_ORDERS_PAGE })
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

  if (order.value.orderStatus === 'COMPLETED' && !order.value.review) {
    uni.redirectTo({ url: `${PETPAL_ORDER_REVIEW_PAGE}?id=${order.value.id}` })
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
      <template v-if="loading && !order">
        <AppSection title="同步支付结果">
          <AppStatus mode="loading" text="正在同步订单和支付状态" />
        </AppSection>
      </template>

      <template v-else-if="order">
        <AppSection title="支付结果">
          <view class="payment-result-focus">
            <view class="payment-result-focus__copy">
              <view class="payment-result-focus__tags">
                <AppTag
                  v-for="tag in heroTags"
                  :key="tag.label"
                  :type="tag.type"
                >
                  {{ tag.label }}
                </AppTag>
              </view>
              <text class="payment-result-focus__title">{{ isFullyPaid ? '支付已完成' : '还差一步' }}</text>
              <text class="payment-result-focus__meta">{{ order.orderNo }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
              <text class="payment-result-focus__meta">订单金额 ¥{{ formatAmount(totalAmount) }} · 已支付 ¥{{ formatAmount(order.amountPaid) }}</text>
              <text class="payment-result-focus__summary">{{ stageSummary }}</text>
            </view>

            <view class="payment-result-signal-grid">
              <view
                v-for="signal in signalCards"
                :key="signal.key"
                class="payment-result-signal"
                :class="`payment-result-signal--${signal.tone}`"
              >
                <text class="payment-result-signal__title">{{ signal.title }}</text>
                <text class="payment-result-signal__value">{{ signal.value }}</text>
                <text class="payment-result-signal__hint">{{ signal.hint }}</text>
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
              :value="isFullyPaid ? '已支付' : '待补款'"
              value-emphasis
            />
            <AppListItem
              title="订单金额"
              :label="`总额 ¥${formatAmount(totalAmount)} · 已付 ¥${formatAmount(order.amountPaid)}`"
              :value="isFullyPaid ? '已到账' : `还差 ¥${formatAmount(outstandingAmount)}`"
              value-emphasis
            />
          </AppList>
        </AppSection>

        <AppSection v-if="sortedPayments.length" :title="`支付记录 (${sortedPayments.length})`">
          <AppList>
            <AppListItem
              v-for="payment in sortedPayments"
              :key="payment.id"
              :title="payment.payNo"
              :label="formatDateTime(payment.paidAt || payment.updatedAt || payment.createdAt)"
              :value="`¥${formatAmount(payment.payAmount)}`"
              value-emphasis
            >
              <template #value>
                <view class="payment-result-payment-value">
                  <AppTag :type="getPaymentTagType(payment.payStatus)">
                    {{ paymentStatusLabels[payment.payStatus] }}
                  </AppTag>
                  <text class="payment-result-payment-value__amount">¥{{ formatAmount(payment.payAmount) }}</text>
                </view>
              </template>
            </AppListItem>
          </AppList>
        </AppSection>

        <view class="payment-result-actions">
          <AppButton block @click="openPrimaryAction">
            {{ primaryActionLabel }}
          </AppButton>
          <AppButton v-if="isFullyPaid" block type="info" @click="openOrderDetail('chat')">
            看沟通
          </AppButton>
          <AppButton v-else block type="info" @click="openCheckout">
            返回支付页
          </AppButton>
          <AppButton block type="info" @click="openOrders">
            订单列表
          </AppButton>
        </view>
      </template>

      <template v-else>
        <AppSection title="支付结果不可用">
          <AppStatus :text="error || '订单不存在或暂时无法查看支付结果'" />
        </AppSection>
        <view class="payment-result-actions">
          <AppButton block type="info" @click="openOrders">返回订单列表</AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后查看支付结果">
        <AppStatus text="登录后查看支付结果和订单下一步。" />
      </AppSection>
      <view class="payment-result-actions">
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.payment-result-focus,
.payment-result-signal {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.payment-result-focus {
  background:
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.payment-result-focus__copy {
  display: grid;
  gap: 10rpx;
}

.payment-result-focus__tags,
.payment-result-payment-value {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.payment-result-focus__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.25;
  font-weight: 700;
}

.payment-result-focus__meta,
.payment-result-focus__summary,
.payment-result-signal__title,
.payment-result-signal__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.payment-result-focus__summary {
  color: var(--app-text);
}

.payment-result-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.payment-result-signal {
  padding: 18rpx 20rpx;
  gap: 10rpx;
}

.payment-result-signal--primary {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.payment-result-signal--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.payment-result-signal--warning {
  background: linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.payment-result-signal--danger {
  background: linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.payment-result-signal__value,
.payment-result-payment-value__amount {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.3;
  font-weight: 700;
}

.payment-result-actions {
  padding: 0 32rpx 12rpx;
}

.payment-result-actions .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .payment-result-signal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
