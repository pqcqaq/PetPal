<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，需要快速处理订单
 * Entry: 首页点击订单、消息跳转、售后跳转、支付后回流
 * First screen: 先按状态筛订单，再直接执行下一步
 * Primary action: 根据订单状态进入详情、服务、沟通或售后
 * Secondary actions: 去售后中心、去发布新需求
 * States: 未登录、空订单、进行中、已完成、售后中
 */
import type { OrderRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatRange,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CHECKOUT_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_REQUEST_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalOrdersPage',
})

definePage({
  style: {
    navigationBarTitleText: '订单',
    enablePullDownRefresh: true,
  },
})

type OwnerOrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'AFTERSALES'

const tokenStore = useTokenStore()

const loading = ref(false)
const orders = ref<OrderRecord[]>([])
const activeFilter = ref<OwnerOrderFilter>('ACTIVE')

const orderFilterOptions = [
  { label: '进行中', value: 'ACTIVE' },
  { label: '全部', value: 'ALL' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '售后', value: 'AFTERSALES' },
]

const activeCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)
const completedCount = computed(() => orders.value.filter(item => item.orderStatus === 'COMPLETED').length)
const aftersalesCount = computed(() => orders.value.filter(item => isOrderAftersalesTracked(item)).length)
const unreadCount = computed(() => orders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0))

const filteredOrders = computed(() => orders.value.filter((item) => {
  if (activeFilter.value === 'ALL') {
    return true
  }
  if (activeFilter.value === 'COMPLETED') {
    return item.orderStatus === 'COMPLETED'
  }
  if (activeFilter.value === 'AFTERSALES') {
    return isOrderAftersalesTracked(item)
  }
  return item.orderStatus === 'PENDING_ACCEPT'
    || item.orderStatus === 'ACCEPTED'
    || item.orderStatus === 'SERVING'
}))

function getOrderTagType(status: OrderRecord['orderStatus']) {
  return getOrderTone(status) === 'danger'
    ? 'danger'
    : getOrderTone(status) === 'warning'
      ? 'warning'
      : getOrderTone(status) === 'success'
        ? 'success'
        : 'default'
}

function getPrimaryAction(order: OrderRecord) {
  const outstandingAmount = Math.max(
    0,
    Number(order.amountTotal) + Number(order.amountAdjusted) - Number(order.amountPaid),
  )

  if (order.orderStatus === 'PENDING_ACCEPT' && outstandingAmount > 0) {
    return {
      label: `去支付 ¥${formatAmount(outstandingAmount)}`,
      mode: 'checkout' as const,
      type: 'primary' as const,
    }
  }
  if (isOrderAftersalesTracked(order)) {
    return { label: '处理售后', mode: 'detail' as const, tab: 'aftersales' as const, type: 'danger' as const }
  }
  if (order.orderStatus === 'SERVING' || order.orderStatus === 'ACCEPTED') {
    return { label: '看服务', mode: 'detail' as const, tab: 'service' as const, type: 'primary' as const }
  }
  if (order.orderStatus === 'COMPLETED') {
    return { label: '看详情', mode: 'detail' as const, tab: 'overview' as const, type: 'primary' as const }
  }
  return { label: '查看详情', mode: 'detail' as const, tab: 'overview' as const, type: 'primary' as const }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openRequestFlow() {
  uni.redirectTo({ url: PETPAL_REQUEST_PAGE })
}

function openAftersalesCenter() {
  uni.redirectTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openOrderDetail(orderId: string, tab: 'overview' | 'chat' | 'service' | 'aftersales') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

function handlePrimaryAction(order: OrderRecord) {
  const action = getPrimaryAction(order)
  if (action.mode === 'checkout') {
    uni.navigateTo({ url: `${PETPAL_CHECKOUT_PAGE}?orderId=${order.id}` })
    return
  }
  openOrderDetail(order.id, action.tab)
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    orders.value = await listOrders()
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载订单失败'),
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
  <AppPageShell title="订单">
    <template v-if="tokenStore.hasLogin">
      <view class="order-focus">
        <view class="order-focus__copy">
          <view class="order-focus__tags">
            <AppTag :type="activeCount > 0 ? 'warning' : 'default'">
              {{ activeCount > 0 ? `${activeCount} 单进行中` : '当前空闲' }}
            </AppTag>
            <AppTag :type="unreadCount > 0 ? 'danger' : 'default'">
              {{ unreadCount > 0 ? `${unreadCount} 条待读` : '消息已读' }}
            </AppTag>
          </view>
          <text class="order-focus__title">订单</text>
          <text class="order-focus__hint">先按状态筛，再直接进入支付、服务、沟通或售后。</text>
        </view>
        <view class="order-toolbar">
          <AppButton size="medium" type="danger" @click="openAftersalesCenter">售后中心</AppButton>
          <AppButton size="medium" type="info" @click="openRequestFlow">新建需求</AppButton>
        </view>
      </view>

      <AppSection title="订单状态">
        <view class="order-summary">
          <view class="order-summary__card">
            <text class="order-summary__label">进行中</text>
            <text class="order-summary__value">{{ activeCount }}</text>
          </view>
          <view class="order-summary__card">
            <text class="order-summary__label">已完成</text>
            <text class="order-summary__value">{{ completedCount }}</text>
          </view>
          <view class="order-summary__card">
            <text class="order-summary__label">售后中</text>
            <text class="order-summary__value">{{ aftersalesCount }}</text>
          </view>
          <view class="order-summary__card">
            <text class="order-summary__label">未读消息</text>
            <text class="order-summary__value">{{ unreadCount }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="筛选">
        <AppChoiceChips v-model="activeFilter" :options="orderFilterOptions" />
      </AppSection>

      <AppSection :title="filteredOrders.length ? `订单列表 (${filteredOrders.length})` : '订单列表'">
        <view v-if="filteredOrders.length" class="order-list">
          <view v-for="order in filteredOrders" :key="order.id" class="order-row">
            <view class="order-row__header">
              <view class="order-row__copy">
                <text class="order-row__title">{{ order.orderNo }}</text>
                <text class="order-row__meta">
                  {{ serviceTypeLabels[order.serviceType] }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}
                </text>
                <text class="order-row__meta">
                  总额 ¥{{ formatAmount(order.amountTotal) }} · 实付 ¥{{ formatAmount(order.amountPaid) }} · 已退 ¥{{ formatAmount(order.amountRefunded) }}
                </text>
                <text v-if="order.orderStatus === 'PENDING_ACCEPT'" class="order-row__meta order-row__meta--accent">
                  {{
                    Number(order.amountTotal) + Number(order.amountAdjusted) - Number(order.amountPaid) > 0
                      ? `待支付 ¥${formatAmount(Number(order.amountTotal) + Number(order.amountAdjusted) - Number(order.amountPaid))}`
                      : '已支付，等待照料者接单'
                  }}
                </text>
              </view>
              <view class="order-row__tags">
                <AppTag :type="getOrderTagType(order.orderStatus)">
                  {{ getOrderStatusLabel(order.orderStatus) }}
                </AppTag>
                <AppTag :type="getConversationUnreadCount(order.conversation, 'owner') > 0 ? 'warning' : 'default'">
                  {{ getConversationUnreadCount(order.conversation, 'owner') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'owner')}` : '已读' }}
                </AppTag>
              </view>
            </view>

            <view class="order-row__actions">
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
              <AppButton
                size="medium"
                :type="getPrimaryAction(order).type"
                @click="handlePrimaryAction(order)"
              >
                {{ getPrimaryAction(order).label }}
              </AppButton>
            </view>
          </view>
        </view>
        <view v-else class="order-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步订单' : '当前筛选下没有订单'" />
          <view v-if="!loading" class="order-empty__actions">
            <AppButton size="medium" @click="openRequestFlow">去发布需求</AppButton>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后查看订单">
        <view class="order-empty order-empty--login">
          <AppStatus text="登录后即可查看订单、服务和售后状态。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.order-focus {
  display: grid;
  gap: 18rpx;
  margin: 0 24rpx 20rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.16), transparent 36%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.order-focus__copy {
  display: grid;
  gap: 10rpx;
}

.order-focus__tags,
.order-toolbar,
.order-row__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.order-focus__title {
  color: var(--app-text);
  font-size: 36rpx;
  line-height: 1.2;
  font-weight: 700;
}

.order-focus__hint,
.order-summary__label,
.order-row__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.order-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.order-summary__card,
.order-row {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.order-row__meta--accent {
  color: #0f766e;
  font-weight: 600;
}

.order-summary__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.order-list {
  display: grid;
  gap: 16rpx;
}

.order-row__header {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.order-row__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.order-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.order-row__tags,
.order-empty__actions {
  display: flex;
  gap: 10rpx;
  flex-wrap: wrap;
}

.order-empty {
  padding: 8rpx 0;
}

.order-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .order-summary {
    grid-template-columns: 1fr;
  }

  .order-row__header {
    flex-direction: column;
  }
}
</style>
