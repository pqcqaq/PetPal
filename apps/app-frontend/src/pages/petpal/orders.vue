<script lang="ts" setup>
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
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  formatAmount,
  formatRange,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_REQUEST_PAGE,
} from './owner-shared'

defineOptions({
  name: 'PetPalOrdersPage',
})

definePage({
  style: {
    navigationBarTitleText: '订单跟进',
    enablePullDownRefresh: true,
  },
})

type OwnerOrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'AFTERSALES'

const tokenStore = useTokenStore()

const loading = ref(false)
const orders = ref<OrderRecord[]>([])
const activeFilter = ref<OwnerOrderFilter>('ACTIVE')

const orderFilterOptions = [
  { label: '进行中', value: 'ACTIVE', description: '优先处理待接单、已接单和服务中订单' },
  { label: '全部', value: 'ALL', description: '查看全部历史订单' },
  { label: '已完成', value: 'COMPLETED', description: '核对已完成订单与评价状态' },
  { label: '售后', value: 'AFTERSALES', description: '聚焦退款、投诉和争议订单' },
]

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '按沟通、履约和售后场景重组订单跟进，不再把所有信息堆在单一工作台。'
    : '登录后即可跟进订单履约和售后。'
))

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

const summaryCards = computed(() => [
  {
    label: '进行中',
    value: String(orders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT' || item.orderStatus === 'ACCEPTED' || item.orderStatus === 'SERVING').length),
    hint: '需要继续跟进履约或确认完成。',
  },
  {
    label: '售后中',
    value: String(orders.value.filter(item => isOrderAftersalesTracked(item)).length),
    hint: '需要持续关注退款、投诉和争议进展。',
  },
  {
    label: '未读沟通',
    value: String(orders.value.reduce((total, item) => total + getConversationUnreadCount(item.conversation, 'owner'), 0)),
    hint: '订单内的说明、服务回传和异常反馈。',
  },
])

function getOrderTagType(status: OrderRecord['orderStatus']) {
  return getOrderTone(status) === 'danger'
    ? 'danger'
    : getOrderTone(status) === 'warning'
      ? 'warning'
      : getOrderTone(status) === 'success'
        ? 'success'
        : 'default'
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
        title: getErrorMessage(error, '加载订单跟进页失败'),
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
  <AppPageShell title="订单跟进" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_ORDERS_PAGE"
        title="订单沟通、履约与售后分段跟进"
        description="主人不再从一个大工作台里翻找信息，而是按处理任务直接进入相应订单场景。"
      />

      <AppSection title="订单概览">
        <view class="order-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="order-metric-card">
            <text class="order-metric-card__label">{{ item.label }}</text>
            <text class="order-metric-card__value">{{ item.value }}</text>
            <text class="order-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="筛选视图" description="根据当前任务快速聚焦进行中订单、已完成订单或售后订单。">
        <AppChoiceChips v-model="activeFilter" :options="orderFilterOptions" />
        <view class="order-filter-actions">
          <AppButton size="medium" type="danger" @click="openAftersalesCenter">进入售后中心</AppButton>
        </view>
      </AppSection>

      <AppSection :title="filteredOrders.length ? `订单列表 (${filteredOrders.length})` : '订单列表'">
        <view v-if="filteredOrders.length" class="order-card-list">
          <view v-for="order in filteredOrders" :key="order.id" class="order-card">
            <view class="order-card__header">
              <view class="order-card__headline">
                <text class="order-card__title">{{ order.orderNo }}</text>
                <text class="order-card__meta">
                  {{ getOrderStatusLabel(order.orderStatus) }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}
                </text>
              </view>
              <AppTag :type="getOrderTagType(order.orderStatus)">
                {{ getOrderStatusLabel(order.orderStatus) }}
              </AppTag>
            </view>

            <view class="order-card__amounts">
              <text>订单总额 ¥{{ formatAmount(order.amountTotal) }}</text>
              <text>实付 ¥{{ formatAmount(order.amountPaid) }}</text>
              <text>已退 ¥{{ formatAmount(order.amountRefunded) }}</text>
            </view>

            <view class="order-card__conversation">
              <text class="order-card__conversation-title">订单沟通</text>
              <text class="order-card__conversation-text">{{ getConversationPreview(order.conversation) }}</text>
              <text class="order-card__conversation-meta">{{ getConversationHint(order.conversation, 'owner') }}</text>
            </view>

            <view class="order-card__footer">
              <AppTag :type="getConversationUnreadCount(order.conversation, 'owner') > 0 ? 'warning' : 'default'">
                {{ getConversationUnreadCount(order.conversation, 'owner') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'owner')}` : '沟通已读' }}
              </AppTag>
              <view class="order-card__actions">
                <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
                <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'service')">履约</AppButton>
                <AppButton
                  size="medium"
                  :type="order.orderStatus === 'DISPUTED' || order.orderStatus === 'PARTIAL_REFUNDED' || order.orderStatus === 'REFUNDED' ? 'danger' : 'primary'"
                  @click="openOrderDetail(order.id, order.orderStatus === 'DISPUTED' || order.orderStatus === 'PARTIAL_REFUNDED' || order.orderStatus === 'REFUNDED' ? 'aftersales' : 'overview')"
                >
                  {{ order.orderStatus === 'DISPUTED' || order.orderStatus === 'PARTIAL_REFUNDED' || order.orderStatus === 'REFUNDED' ? '售后' : '详情' }}
                </AppButton>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="order-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步订单列表' : '当前筛选下没有订单'" />
          <view v-if="!loading" class="order-empty__actions">
            <AppButton size="medium" @click="openRequestFlow">去发布需求</AppButton>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始跟进订单">
        <view class="order-empty order-empty--login">
          <AppStatus text="登录后即可跟进订单履约和售后进展。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.order-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.order-metric-card,
.order-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.order-metric-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.order-metric-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.order-metric-card__hint,
.order-card__meta,
.order-card__amounts,
.order-card__conversation-meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.order-card-list {
  display: grid;
  gap: 16rpx;
}

.order-filter-actions,
.order-card__actions,
.order-empty__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.order-card__header,
.order-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.order-card__headline {
  display: grid;
  gap: 6rpx;
}

.order-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.order-card__amounts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.order-card__conversation {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: #eefaf7;
}

.order-card__conversation-title {
  color: #0f766e;
  font-size: 20rpx;
  font-weight: 700;
}

.order-card__conversation-text {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.order-empty {
  padding: 8rpx 0;
}

.order-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .order-metric-grid,
  .order-card__amounts {
    grid-template-columns: 1fr;
  }

  .order-card__header,
  .order-card__footer {
    flex-direction: column;
  }
}
</style>
