<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，需要从订单队列里立刻知道“这单现在做什么”
 * Entry: Tabbar 订单、支付结果回流、售后中心回跳、消息页进入
 * First screen:
 * 1. 先锁定当前最急订单，不让用户先翻列表
 * 2. 订单列表必须像任务队列，可展开后直接处理沟通、支付、履约或售后
 * 3. 筛选只负责切换队列，不再额外堆统计说明卡
 * Primary action: 继续当前最急订单
 * Secondary actions: 进入沟通、进入售后、发布新需求
 * States: 未登录、空订单、待支付、待接单、服务中、已完成、售后中
 */
import type { OrderRecord, OrderStatus } from '@rbac/api-common'
import { computed, ref, watch } from 'vue'
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
  consumePetPalOrdersPageContext,
  formatAmount,
  formatRange,
  getConversationHint,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  getRefundProgressStageLabel,
  type OwnerOrderFilter,
  isOrderAftersalesTracked,
  openPetPalAction,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CHECKOUT_PAGE,
  PETPAL_MESSAGES_PAGE,
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

type ViewTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'
type ButtonTone = 'primary' | 'info' | 'default' | 'danger'

interface OrderQueueView {
  order: OrderRecord
  priority: number
  outstandingAmount: number
  unreadCount: number
}

interface FocusTag {
  label: string
  type: ViewTone
}

interface FocusPanel {
  key: string
  title: string
  value: string
  hint: string
  tone: ViewTone
}

const tokenStore = useTokenStore()

const loading = ref(false)
const orders = ref<OrderRecord[]>([])
const activeFilter = ref<OwnerOrderFilter>('ACTIVE')
const expandedOrderId = ref('')
const preferredOrderId = ref('')

const orderFilterOptions = [
  { label: '进行中', value: 'ACTIVE', description: '待支付、待接单和服务中的订单' },
  { label: '全部', value: 'ALL', description: '查看全部历史订单' },
  { label: '已完成', value: 'COMPLETED', description: '回看已结束订单和评价入口' },
  { label: '售后', value: 'AFTERSALES', description: '只看退款、投诉和争议订单' },
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
const pendingPaymentCount = computed(() => orders.value.filter(item => getOutstandingAmount(item) > 0).length)

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

const orderQueue = computed<OrderQueueView[]>(() => filteredOrders.value
  .map(order => ({
    order,
    priority: getOrderPriority(order),
    outstandingAmount: getOutstandingAmount(order),
    unreadCount: getConversationUnreadCount(order.conversation, 'owner'),
  }))
  .sort((left, right) => {
    const leftIsPreferred = left.order.id === preferredOrderId.value
    const rightIsPreferred = right.order.id === preferredOrderId.value
    if (leftIsPreferred !== rightIsPreferred) {
      return leftIsPreferred ? -1 : 1
    }
    if (right.priority !== left.priority) {
      return right.priority - left.priority
    }
    return new Date(right.order.updatedAt).getTime() - new Date(left.order.updatedAt).getTime()
  }))

const focusOrder = computed(() => orderQueue.value[0] ?? null)
const queueOrders = computed(() => orderQueue.value.slice(1))

const focusTags = computed<FocusTag[]>(() => {
  if (!focusOrder.value) {
    return []
  }

  const { order, outstandingAmount, unreadCount } = focusOrder.value
  const tags: FocusTag[] = [
    {
      label: getOrderStatusLabel(order.orderStatus),
      type: getOrderTagType(order.orderStatus),
    },
    {
      label: serviceTypeLabels[order.serviceType],
      type: 'primary',
    },
  ]

  if (outstandingAmount > 0) {
    tags.push({
      label: `待支付 ¥${formatAmount(outstandingAmount)}`,
      type: 'warning',
    })
  }

  if (isOrderAftersalesTracked(order)) {
    tags.push({
      label: order.refunds.length > 0 ? getRefundProgressStageLabel(Number(order.amountRefunded) > 0 ? 'PARTIAL_SUCCESS' : 'PENDING_REVIEW') : '售后处理中',
      type: 'danger',
    })
  }

  if (unreadCount > 0) {
    tags.push({
      label: `${unreadCount} 条未读`,
      type: 'warning',
    })
  }

  return tags
})

const focusPanels = computed<FocusPanel[]>(() => {
  if (!focusOrder.value) {
    return []
  }

  const { order, outstandingAmount, unreadCount } = focusOrder.value
  return [
    {
      key: 'next',
      title: '下一步',
      value: getPrimaryAction(order).label,
      hint: getOrderPriorityHint(order),
      tone: getPrimaryAction(order).tone,
    },
    {
      key: 'message',
      title: '沟通',
      value: unreadCount > 0 ? `${unreadCount} 条未读` : order.conversation?.lastMessageAt ? '沟通已读' : '暂未沟通',
      hint: getConversationHint(order.conversation, 'owner'),
      tone: unreadCount > 0 ? 'warning' : 'default',
    },
    {
      key: 'aftersales',
      title: '售后',
      value: isOrderAftersalesTracked(order) ? '正在跟进' : '当前稳定',
      hint: isOrderAftersalesTracked(order)
        ? `已退 ¥${formatAmount(order.amountRefunded)} · ${order.refunds.length} 笔退款`
        : '当前没有退款和投诉记录',
      tone: isOrderAftersalesTracked(order) ? 'danger' : 'success',
    },
  ]
})

watch(queueOrders, (items) => {
  if (!items.length) {
    expandedOrderId.value = ''
    return
  }

  if (!items.some(item => item.order.id === expandedOrderId.value)) {
    expandedOrderId.value = items[0].order.id
  }
}, { immediate: true })

function getOutstandingAmount(order: OrderRecord) {
  return Math.max(
    0,
    Number(order.amountTotal) + Number(order.amountAdjusted) - Number(order.amountPaid),
  )
}

function getOrderPriority(order: OrderRecord) {
  const outstandingAmount = getOutstandingAmount(order)
  if (outstandingAmount > 0) return 6
  if (isOrderAftersalesTracked(order)) return 5
  if (order.orderStatus === 'SERVING') return 4
  if (order.orderStatus === 'ACCEPTED') return 3
  if (order.orderStatus === 'PENDING_ACCEPT') return 2
  if (order.orderStatus === 'COMPLETED') return 1
  return 0
}

function getOrderTagType(status: OrderStatus): ViewTone {
  const tone = getOrderTone(status)
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  return 'default'
}

function getPrimaryAction(order: OrderRecord) {
  const outstandingAmount = getOutstandingAmount(order)

  if (order.orderStatus === 'PENDING_ACCEPT' && outstandingAmount > 0) {
    return {
      label: `去支付 ¥${formatAmount(outstandingAmount)}`,
      mode: 'checkout' as const,
      buttonType: 'primary' as ButtonTone,
      tone: 'warning' as ViewTone,
    }
  }
  if (isOrderAftersalesTracked(order)) {
    return {
      label: '处理售后',
      mode: 'detail' as const,
      tab: 'aftersales' as const,
      buttonType: 'danger' as ButtonTone,
      tone: 'danger' as ViewTone,
    }
  }
  if (order.orderStatus === 'SERVING' || order.orderStatus === 'ACCEPTED') {
    return {
      label: '看履约',
      mode: 'detail' as const,
      tab: 'service' as const,
      buttonType: 'primary' as ButtonTone,
      tone: 'primary' as ViewTone,
    }
  }
  if (order.orderStatus === 'COMPLETED') {
    return {
      label: '看结果',
      mode: 'detail' as const,
      tab: 'overview' as const,
      buttonType: 'info' as ButtonTone,
      tone: 'success' as ViewTone,
    }
  }
  return {
    label: '看详情',
    mode: 'detail' as const,
    tab: 'overview' as const,
    buttonType: 'primary' as ButtonTone,
    tone: 'primary' as ViewTone,
  }
}

function applyPendingNavigationContext() {
  const context = consumePetPalOrdersPageContext()
  if (!context) {
    return
  }

  if (context.filter) {
    activeFilter.value = context.filter
  }

  preferredOrderId.value = context.focusOrderId || ''
}

function getOrderPriorityHint(order: OrderRecord) {
  const outstandingAmount = getOutstandingAmount(order)
  if (outstandingAmount > 0) {
    return '这单还没完成支付，先补款再等待照料者接单。'
  }
  if (isOrderAftersalesTracked(order)) {
    return '这单已经进入售后跟进，先看退款或投诉进度。'
  }
  if (order.orderStatus === 'SERVING') {
    return '这单正在服务中，先看最新回传和沟通。'
  }
  if (order.orderStatus === 'ACCEPTED') {
    return '照料者已接单，接下来重点关注开场和履约。'
  }
  if (order.orderStatus === 'PENDING_ACCEPT') {
    return '这单已经下单，当前重点是等待照料者确认。'
  }
  return '这单已经收尾，可回看结果或继续评价售后。'
}

function getQueueHint(order: OrderRecord) {
  const outstandingAmount = getOutstandingAmount(order)
  if (outstandingAmount > 0) {
    return `待支付 ¥${formatAmount(outstandingAmount)}`
  }
  if (isOrderAftersalesTracked(order)) {
    return `售后中 · 已退 ¥${formatAmount(order.amountRefunded)}`
  }
  if (order.orderStatus === 'SERVING') {
    return '服务中，优先看履约和沟通'
  }
  if (order.orderStatus === 'ACCEPTED') {
    return '已接单，等待服务开始'
  }
  return '已完成，可回看结果'
}

function getQueuePillTone(order: OrderRecord, unread: number): ViewTone {
  if (unread > 0) return 'warning'
  if (isOrderAftersalesTracked(order)) return 'danger'
  return getOrderTagType(order.orderStatus)
}

function getQueuePillValue(order: OrderRecord, unread: number) {
  if (unread > 0) return `${unread} 条未读`
  if (isOrderAftersalesTracked(order)) return '售后中'
  if (getOutstandingAmount(order) > 0) return '待支付'
  return '可继续'
}

function isExpanded(orderId: string) {
  return expandedOrderId.value === orderId
}

function toggleExpanded(orderId: string) {
  expandedOrderId.value = expandedOrderId.value === orderId ? '' : orderId
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openRequestFlow() {
  openPetPalAction('redirect', PETPAL_REQUEST_PAGE)
}

function openAftersalesCenter() {
  openPetPalAction('redirect', PETPAL_AFTERSALES_PAGE)
}

function openMessages() {
  openPetPalAction('redirect', PETPAL_MESSAGES_PAGE)
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
  applyPendingNavigationContext()
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
})

onHide(() => {
  preferredOrderId.value = ''
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="订单">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="现在先处理">
        <template v-if="focusOrder">
          <view class="order-focus">
            <view class="order-focus__copy">
              <view class="order-focus__tags">
                <AppTag
                  v-for="tag in focusTags"
                  :key="tag.label"
                  :type="tag.type"
                >
                  {{ tag.label }}
                </AppTag>
              </view>
              <text class="order-focus__title">{{ focusOrder.order.orderNo }}</text>
              <text class="order-focus__meta">
                {{ serviceTypeLabels[focusOrder.order.serviceType] }} · {{ formatRange(focusOrder.order.appointmentStart, focusOrder.order.appointmentEnd) }}
              </text>
              <text class="order-focus__meta">
                总额 ¥{{ formatAmount(focusOrder.order.amountTotal) }} · 实付 ¥{{ formatAmount(focusOrder.order.amountPaid) }} · 已退 ¥{{ formatAmount(focusOrder.order.amountRefunded) }}
              </text>
              <text class="order-focus__summary">{{ getOrderPriorityHint(focusOrder.order) }}</text>
            </view>

            <view class="order-focus__panels">
              <view
                v-for="panel in focusPanels"
                :key="panel.key"
                class="order-focus__panel"
                :class="`order-focus__panel--${panel.tone}`"
              >
                <text class="order-focus__panel-label">{{ panel.title }}</text>
                <text class="order-focus__panel-value">{{ panel.value }}</text>
                <text class="order-focus__panel-hint">{{ panel.hint }}</text>
              </view>
            </view>

            <view class="order-toolbar">
                <AppButton
                  size="medium"
                  :type="getPrimaryAction(focusOrder.order).buttonType"
                  @click="handlePrimaryAction(focusOrder.order)"
                >
                {{ getPrimaryAction(focusOrder.order).label }}
              </AppButton>
              <AppButton size="medium" type="info" @click="openOrderDetail(focusOrder.order.id, 'chat')">
                沟通
              </AppButton>
              <AppButton size="medium" type="info" @click="openAftersalesCenter">
                售后中心
              </AppButton>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="order-empty">
            <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在整理订单队列' : '当前筛选下没有订单'" />
            <view v-if="!loading" class="order-empty__actions">
              <AppButton size="medium" @click="openRequestFlow">新建需求</AppButton>
            </view>
          </view>
        </template>
      </AppSection>

      <AppSection title="切换队列">
        <AppChoiceChips
          v-model="activeFilter"
          :options="orderFilterOptions"
          show-descriptions
        />
        <view class="order-toolbar">
          <AppTag :type="pendingPaymentCount > 0 ? 'warning' : 'default'">
            {{ pendingPaymentCount > 0 ? `${pendingPaymentCount} 单待支付` : '支付已处理' }}
          </AppTag>
          <AppTag :type="unreadCount > 0 ? 'warning' : 'default'">
            {{ unreadCount > 0 ? `${unreadCount} 条消息待看` : '消息已读' }}
          </AppTag>
          <AppTag :type="aftersalesCount > 0 ? 'danger' : completedCount > 0 ? 'success' : 'default'">
            {{
              activeFilter === 'ACTIVE'
                ? `${activeCount} 单进行中`
                : activeFilter === 'COMPLETED'
                  ? `${completedCount} 单已完成`
                  : activeFilter === 'AFTERSALES'
                    ? `${aftersalesCount} 单售后中`
                    : `${orders.length} 单全部订单`
            }}
          </AppTag>
          <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
          <AppButton size="medium" type="info" @click="openRequestFlow">新建需求</AppButton>
        </view>
      </AppSection>

      <AppSection :title="queueOrders.length ? `其他订单 (${queueOrders.length})` : '其他订单'">
        <template v-if="queueOrders.length">
          <view class="order-queue">
            <view
              v-for="item in queueOrders"
              :key="item.order.id"
              class="order-item"
              :class="isExpanded(item.order.id) ? 'order-item--expanded' : ''"
            >
              <view class="order-item__overview" @click="toggleExpanded(item.order.id)">
                <view class="order-item__copy">
                  <text class="order-item__title">{{ item.order.orderNo }}</text>
                  <text class="order-item__meta">
                    {{ serviceTypeLabels[item.order.serviceType] }} · {{ formatRange(item.order.appointmentStart, item.order.appointmentEnd) }}
                  </text>
                  <text class="order-item__meta">{{ getQueueHint(item.order) }}</text>
                </view>

                <view class="order-item__aside">
                  <view class="order-item__tags">
                    <AppTag :type="getOrderTagType(item.order.orderStatus)">
                      {{ getOrderStatusLabel(item.order.orderStatus) }}
                    </AppTag>
                    <AppTag :type="getQueuePillTone(item.order, item.unreadCount)">
                      {{ getQueuePillValue(item.order, item.unreadCount) }}
                    </AppTag>
                  </view>
                  <text class="order-item__toggle">{{ isExpanded(item.order.id) ? '收起' : '展开' }}</text>
                </view>
              </view>

              <view class="order-pill-row">
                <view class="order-pill" :class="`order-pill--${getPrimaryAction(item.order).tone}`">
                  <text class="order-pill__label">下一步</text>
                  <text class="order-pill__value">{{ getPrimaryAction(item.order).label }}</text>
                </view>
                <view class="order-pill" :class="`order-pill--${item.unreadCount > 0 ? 'warning' : 'default'}`">
                  <text class="order-pill__label">沟通</text>
                  <text class="order-pill__value">
                    {{ item.unreadCount > 0 ? `${item.unreadCount} 条未读` : item.order.conversation?.lastMessageAt ? '沟通已读' : '暂未沟通' }}
                  </text>
                </view>
                <view class="order-pill" :class="`order-pill--${isOrderAftersalesTracked(item.order) ? 'danger' : 'success'}`">
                  <text class="order-pill__label">售后</text>
                  <text class="order-pill__value">{{ isOrderAftersalesTracked(item.order) ? '处理中' : '当前稳定' }}</text>
                </view>
              </view>

              <view v-if="isExpanded(item.order.id)" class="order-item__details">
                <text class="order-item__summary">{{ getOrderPriorityHint(item.order) }}</text>
                <text class="order-item__meta">
                  总额 ¥{{ formatAmount(item.order.amountTotal) }} · 实付 ¥{{ formatAmount(item.order.amountPaid) }} · 已退 ¥{{ formatAmount(item.order.amountRefunded) }}
                </text>
                <text class="order-item__meta">{{ getConversationHint(item.order.conversation, 'owner') }}</text>

                <view class="order-item__actions">
                  <AppButton size="medium" type="info" @click="openOrderDetail(item.order.id, 'chat')">
                    沟通
                  </AppButton>
                  <AppButton
                    v-if="isOrderAftersalesTracked(item.order)"
                    size="medium"
                    type="danger"
                    @click="openOrderDetail(item.order.id, 'aftersales')"
                  >
                    售后
                  </AppButton>
                  <AppButton
                    size="medium"
                    :type="getPrimaryAction(item.order).buttonType"
                    @click="handlePrimaryAction(item.order)"
                  >
                    {{ getPrimaryAction(item.order).label }}
                  </AppButton>
                </view>
              </view>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="order-empty">
            <AppStatus
              :mode="loading ? 'loading' : 'empty'"
              :text="loading ? '正在整理订单队列' : focusOrder ? '当前筛选下需要处理的都在上面。' : '当前筛选下没有订单'"
            />
          </view>
        </template>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后查看订单">
        <view class="order-empty order-empty--login">
          <AppStatus text="登录后即可查看订单、沟通、履约和售后状态。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.order-focus,
.order-item {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
}

.order-focus {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 34%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.14), transparent 30%),
    linear-gradient(180deg, #eef5ff 0%, rgba(255, 251, 246, 0.98) 100%);
}

.order-focus__copy,
.order-item__copy,
.order-item__details,
.order-empty {
  display: grid;
  gap: 10rpx;
}

.order-focus__tags,
.order-toolbar,
.order-item__tags,
.order-item__actions,
.order-pill-row,
.order-empty__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.order-focus__title,
.order-item__title {
  color: var(--app-text);
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 32rpx;
  line-height: 1.18;
  font-weight: 700;
}

.order-focus__meta,
.order-focus__summary,
.order-item__meta,
.order-item__summary,
.order-item__toggle,
.order-focus__panel-label,
.order-focus__panel-hint,
.order-pill__label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.order-focus__summary,
.order-item__summary {
  color: var(--app-text);
}

.order-focus__panels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.order-focus__panel {
  display: grid;
  gap: 10rpx;
  padding: 20rpx;
  border-radius: var(--app-shape-lg);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
}

.order-focus__panel--primary,
.order-pill--primary {
  background: linear-gradient(180deg, #eef5ff 0%, rgba(255, 251, 246, 0.98) 100%);
}

.order-focus__panel--success,
.order-pill--success {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, rgba(255, 251, 246, 0.98) 100%);
}

.order-focus__panel--warning,
.order-pill--warning {
  background: linear-gradient(180deg, #fff0dd 0%, rgba(255, 251, 246, 0.98) 100%);
}

.order-focus__panel--danger,
.order-pill--danger {
  background: linear-gradient(180deg, rgba(255, 236, 234, 0.96) 0%, rgba(255, 251, 246, 0.98) 100%);
}

.order-focus__panel-value {
  color: var(--app-brand-strong);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.order-queue {
  display: grid;
  gap: 16rpx;
}

.order-item {
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.order-item--expanded {
  box-shadow: var(--app-elevation-2);
  border-color: rgba(37, 99, 235, 0.18);
}

.order-item__overview {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
}

.order-item__aside {
  display: grid;
  gap: 10rpx;
  justify-items: end;
}

.order-item__toggle {
  color: var(--app-accent);
  font-weight: 600;
}

.order-pill {
  display: inline-grid;
  gap: 4rpx;
  min-height: 68rpx;
  padding: 12rpx 22rpx;
  border-radius: 999rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  background: rgba(255, 251, 246, 0.92);
}

.order-pill--default {
  background: var(--app-surface);
}

.order-pill__value {
  color: var(--app-text);
  font-size: 22rpx;
  line-height: 1.3;
  font-weight: 700;
}

.order-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .order-focus__panels {
    grid-template-columns: 1fr;
  }

  .order-item__overview {
    flex-direction: column;
    align-items: flex-start;
  }

  .order-item__aside {
    justify-items: start;
  }
}
</style>
