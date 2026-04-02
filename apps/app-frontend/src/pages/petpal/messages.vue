<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人或照料者，需要快速回消息
 * Entry: 首页消息入口、提醒中心、订单详情回流
 * First screen: 先看到最该先回的一条会话，再按角色切到主人侧或照料者侧
 * Primary action: 打开具体订单聊天并立即回复
 * Secondary actions: 切到另一侧会话、看订单、看通知
 * States: 未登录、无会话、只看未读、主人侧待回、照料者侧待回
 */
import type { CaregiverOrderRecord, OrderRecord, OrderStatus } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listCaregiverOrders, listOrders } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatAmount,
  formatRange,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getOrderTone,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalMessagesPage',
})

definePage({
  style: {
    navigationBarTitleText: '消息',
    enablePullDownRefresh: true,
  },
})

type MessageRole = 'owner' | 'caregiver'
type MessageRoleFilter = 'ALL' | 'OWNER' | 'CAREGIVER'
type MessageViewFilter = 'ALL' | 'UNREAD'

type MessageCenterItem = {
  key: string
  role: MessageRole
  orderId: string
  orderNo: string
  orderStatus: OrderStatus
  appointmentStart: string
  appointmentEnd: string
  amountPaid: number | string
  contextLabel: string
  secondaryLabel: string
  preview: string
  hint: string
  unreadCount: number
  sortAt: string
}

const tokenStore = useTokenStore()
const userStore = useUserStore()

const loading = ref(false)
const ownerOrders = ref<OrderRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])
const roleFilter = ref<MessageRoleFilter>('ALL')
const viewFilter = ref<MessageViewFilter>('UNREAD')

const viewFilterOptions = [
  { label: '未读', value: 'UNREAD', description: '只看当前仍有未读消息的订单' },
  { label: '全部', value: 'ALL', description: '包括还没开始沟通的活跃订单' },
]

const messageItems = computed<MessageCenterItem[]>(() => {
  const ownerItems = ownerOrders.value
    .filter(order => isMessageRelevant(order))
    .map(order => buildOwnerMessageItem(order))
  const caregiverItems = caregiverOrders.value
    .filter(order => isMessageRelevant(order))
    .map(order => buildCaregiverMessageItem(order))

  return [...ownerItems, ...caregiverItems]
    .sort((left, right) => new Date(right.sortAt).getTime() - new Date(left.sortAt).getTime())
})

const filteredItems = computed(() => messageItems.value.filter((item) => {
  if (roleFilter.value === 'OWNER' && item.role !== 'owner') {
    return false
  }
  if (roleFilter.value === 'CAREGIVER' && item.role !== 'caregiver') {
    return false
  }
  if (viewFilter.value === 'UNREAD') {
    return item.unreadCount > 0
  }
  return true
}))

const ownerUnreadCount = computed(() => messageItems.value
  .filter(item => item.role === 'owner')
  .reduce((total, item) => total + item.unreadCount, 0))

const ownerConversationCount = computed(() => messageItems.value.filter(item => item.role === 'owner').length)

const caregiverUnreadCount = computed(() => messageItems.value
  .filter(item => item.role === 'caregiver')
  .reduce((total, item) => total + item.unreadCount, 0))

const caregiverConversationCount = computed(() => messageItems.value.filter(item => item.role === 'caregiver').length)

const totalUnreadCount = computed(() => ownerUnreadCount.value + caregiverUnreadCount.value)

const priorityConversation = computed(() => filteredItems.value.find(item => item.unreadCount > 0) ?? filteredItems.value[0] ?? null)

const focusTitle = computed(() => (
  priorityConversation.value
    ? priorityConversation.value.unreadCount > 0
      ? `先回复 ${priorityConversation.value.orderNo}`
      : '继续最近会话'
    : '消息已处理完'
))

const focusHint = computed(() => {
  if (!priorityConversation.value) {
    return '当前没有需要进入的订单沟通。'
  }
  return `${priorityConversation.value.contextLabel} · ${priorityConversation.value.hint}`
})

const roleSummaryCards = computed(() => [
  {
    label: '全部',
    value: 'ALL' as MessageRoleFilter,
    metric: `${messageItems.value.length}`,
    unread: totalUnreadCount.value,
    hint: messageItems.value.length ? '跨角色会话' : '暂无会话',
  },
  {
    label: '主人侧',
    value: 'OWNER' as MessageRoleFilter,
    metric: `${ownerConversationCount.value}`,
    unread: ownerUnreadCount.value,
    hint: ownerConversationCount.value ? '主人订单沟通' : '暂无主人会话',
  },
  {
    label: '照料者侧',
    value: 'CAREGIVER' as MessageRoleFilter,
    metric: `${caregiverConversationCount.value}`,
    unread: caregiverUnreadCount.value,
    hint: caregiverConversationCount.value ? '履约订单沟通' : '暂无照料者会话',
  },
])

function isMessageRelevant(order: OrderRecord) {
  if (order.conversation) {
    return true
  }
  return order.orderStatus === 'PENDING_ACCEPT'
    || order.orderStatus === 'ACCEPTED'
    || order.orderStatus === 'SERVING'
    || order.orderStatus === 'DISPUTED'
    || order.orderStatus === 'PARTIAL_REFUNDED'
    || order.orderStatus === 'REFUNDED'
}

function buildOwnerMessageItem(order: OrderRecord): MessageCenterItem {
  return {
    key: `owner:${order.id}`,
    role: 'owner',
    orderId: order.id,
    orderNo: order.orderNo,
    orderStatus: order.orderStatus,
    appointmentStart: order.appointmentStart,
    appointmentEnd: order.appointmentEnd,
    amountPaid: order.amountPaid,
    contextLabel: `主人侧 · ${serviceTypeLabels[order.serviceType]}`,
    secondaryLabel: `实付 ¥${formatAmount(order.amountPaid)} · ${getOrderStatusLabel(order.orderStatus)}`,
    preview: getConversationPreview(order.conversation),
    hint: getConversationHint(order.conversation, 'owner'),
    unreadCount: getConversationUnreadCount(order.conversation, 'owner'),
    sortAt: order.conversation?.lastMessageAt || order.updatedAt,
  }
}

function buildCaregiverMessageItem(order: CaregiverOrderRecord): MessageCenterItem {
  return {
    key: `caregiver:${order.id}`,
    role: 'caregiver',
    orderId: order.id,
    orderNo: order.orderNo,
    orderStatus: order.orderStatus,
    appointmentStart: order.appointmentStart,
    appointmentEnd: order.appointmentEnd,
    amountPaid: order.amountPaid,
    contextLabel: `照料者侧 · ${order.petName || '宠物待补充'}`,
    secondaryLabel: `${order.ownerNickname} · ${order.locationText || '地点待补充'}`,
    preview: getConversationPreview(order.conversation),
    hint: getConversationHint(order.conversation, 'caregiver'),
    unreadCount: getConversationUnreadCount(order.conversation, 'caregiver'),
    sortAt: order.conversation?.lastMessageAt || order.updatedAt,
  }
}

function getRoleTagType(role: MessageRole) {
  return role === 'owner' ? 'primary' : 'warning'
}

function getRoleLabel(role: MessageRole) {
  return role === 'owner' ? '主人' : '照料者'
}

function getOrderTagType(status: OrderStatus) {
  const tone = getOrderTone(status)
  if (tone === 'danger') {
    return 'danger'
  }
  if (tone === 'warning') {
    return 'warning'
  }
  if (tone === 'success') {
    return 'success'
  }
  return 'default'
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function setRoleFilter(value: MessageRoleFilter) {
  roleFilter.value = value
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openFirstConversation() {
  const firstItem = filteredItems.value[0] || messageItems.value[0]
  if (!firstItem) {
    return
  }
  openOrderChat(firstItem.orderId)
}

function openOrderChat(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=chat` })
}

function openOrderOverview(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=overview` })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      tokenStore.bootstrap(),
      userStore.fetchUserInfo().catch(() => undefined),
    ])

    const [ownerResult, caregiverResult] = await Promise.allSettled([
      listOrders(),
      listCaregiverOrders({ page: 1, pageSize: 20 }),
    ])

    ownerOrders.value = ownerResult.status === 'fulfilled' ? ownerResult.value : []
    caregiverOrders.value = caregiverResult.status === 'fulfilled' ? caregiverResult.value.items : []
  }
  catch (error: unknown) {
    ownerOrders.value = []
    caregiverOrders.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载消息中心失败'),
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
  <AppPageShell title="消息">
    <template v-if="tokenStore.hasLogin">
      <view class="message-page">
        <view class="message-focus">
          <view class="message-focus__copy">
            <view class="message-focus__tags">
              <AppTag :type="totalUnreadCount > 0 ? 'warning' : 'default'">
                {{ totalUnreadCount > 0 ? `${totalUnreadCount} 条未读` : '已读' }}
              </AppTag>
              <AppTag type="primary">{{ filteredItems.length }} 个会话</AppTag>
            </view>
            <text class="message-focus__title">{{ focusTitle }}</text>
            <text class="message-focus__hint">{{ focusHint }}</text>
          </view>
          <view class="message-focus__actions">
            <AppButton size="medium" :disabled="!messageItems.length" @click="openFirstConversation">先回第一条</AppButton>
            <AppButton size="medium" type="info" @click="openNotifications">通知</AppButton>
          </view>
        </view>

        <scroll-view class="message-role-scroll" :scroll-x="true" :show-scrollbar="false">
          <view class="message-role-track">
            <view
              v-for="item in roleSummaryCards"
              :key="item.label"
              class="message-role-card"
              :class="roleFilter === item.value ? 'message-role-card--active' : ''"
              @click="setRoleFilter(item.value)"
            >
              <view class="message-role-card__head">
                <text class="message-role-card__label">{{ item.label }}</text>
                <AppTag :type="item.unread > 0 ? 'danger' : (roleFilter === item.value ? 'primary' : 'default')">
                  {{ item.unread > 0 ? `${item.unread} 未读` : '已读' }}
                </AppTag>
              </view>
              <text class="message-role-card__value">{{ item.metric }}</text>
              <text class="message-role-card__hint">{{ item.hint }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="message-filter-panel">
          <view class="message-filter-panel__group">
            <text class="message-filter-panel__label">列表范围</text>
            <AppChoiceChips v-model="viewFilter" :options="viewFilterOptions" />
          </view>
        </view>

        <view v-if="priorityConversation" class="message-priority">
          <view class="message-priority__copy">
            <view class="message-card__tags">
              <AppTag :type="getRoleTagType(priorityConversation.role)">
                {{ getRoleLabel(priorityConversation.role) }}
              </AppTag>
              <AppTag :type="getOrderTagType(priorityConversation.orderStatus)">
                {{ getOrderStatusLabel(priorityConversation.orderStatus) }}
              </AppTag>
              <AppTag :type="priorityConversation.unreadCount > 0 ? 'danger' : 'default'">
                {{ priorityConversation.unreadCount > 0 ? `未读 ${priorityConversation.unreadCount}` : '已读' }}
              </AppTag>
            </view>
            <text class="message-priority__title">{{ priorityConversation.orderNo }}</text>
            <text class="message-priority__hint">{{ priorityConversation.preview }}</text>
            <text class="message-priority__meta">{{ priorityConversation.secondaryLabel }}</text>
          </view>
          <view class="message-focus__actions">
            <AppButton size="medium" @click="openOrderChat(priorityConversation.orderId)">回消息</AppButton>
            <AppButton size="medium" type="info" @click="openOrderOverview(priorityConversation.orderId)">看订单</AppButton>
          </view>
        </view>

        <view class="message-list-block">
          <view class="message-list-block__head">
            <text class="message-list-block__title">{{ filteredItems.length ? `会话 ${filteredItems.length}` : '会话列表' }}</text>
            <AppTag type="default">{{ viewFilter === 'UNREAD' ? '未读优先' : '全部会话' }}</AppTag>
          </view>

          <view v-if="filteredItems.length" class="message-list">
            <view v-for="item in filteredItems" :key="item.key" class="message-card">
              <view class="message-card__header">
                <view class="message-card__headline">
                  <view class="message-card__tags">
                    <AppTag :type="getRoleTagType(item.role)">
                      {{ getRoleLabel(item.role) }}
                    </AppTag>
                    <AppTag :type="getOrderTagType(item.orderStatus)">
                      {{ getOrderStatusLabel(item.orderStatus) }}
                    </AppTag>
                  </view>
                  <text class="message-card__title">{{ item.orderNo }}</text>
                  <text class="message-card__meta">{{ item.contextLabel }} · {{ formatRange(item.appointmentStart, item.appointmentEnd) }}</text>
                </view>
                <AppTag :type="item.unreadCount > 0 ? 'danger' : 'default'">
                  {{ item.unreadCount > 0 ? `未读 ${item.unreadCount}` : '已读' }}
                </AppTag>
              </view>

              <view class="message-card__conversation">
                <text class="message-card__preview">{{ item.preview }}</text>
                <text class="message-card__hint">{{ item.hint }}</text>
                <text class="message-card__meta">{{ item.secondaryLabel }}</text>
              </view>

              <view class="message-card__footer">
                <text class="message-card__amount">实付 ¥{{ formatAmount(item.amountPaid) }}</text>
                <view class="message-card__actions">
                  <AppButton size="medium" type="info" @click="openOrderOverview(item.orderId)">订单</AppButton>
                  <AppButton size="medium" @click="openOrderChat(item.orderId)">{{ item.unreadCount > 0 ? '回消息' : '继续聊' }}</AppButton>
                </view>
              </view>
            </view>
          </view>

          <view v-else class="message-empty">
            <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步消息中心' : '当前筛选下没有需要进入的订单沟通'" />
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="message-login">
        <AppStatus text="登录后即可查看跨订单消息。" />
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.message-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.message-focus {
  display: grid;
  gap: 18rpx;
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.26), transparent 34%),
    linear-gradient(145deg, #1d4ed8 0%, #0f766e 48%, #155e75 100%);
  color: #eff6ff;
}

.message-focus__copy {
  display: grid;
  gap: 12rpx;
}

.message-role-scroll {
  white-space: nowrap;
}

.message-role-track {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.message-role-card,
.message-filter-panel,
.message-priority,
.message-card,
.message-list-block,
.message-login {
  display: grid;
  gap: 12rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: var(--app-elevation-1);
}

.message-role-card {
  width: 260rpx;
  padding: 22rpx;
  border-radius: 26rpx;
  box-sizing: border-box;
}

.message-role-card--active {
  border-color: transparent;
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.message-role-card__head {
  display: flex;
  gap: 10rpx;
  align-items: center;
  justify-content: space-between;
}

.message-focus__tags,
.message-focus__actions,
.message-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.message-role-card__label,
.message-filter-panel__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.message-role-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.08;
  font-weight: 700;
}

.message-focus__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.message-role-card__hint,
.message-focus__hint {
  font-size: 24rpx;
  line-height: 1.7;
}

.message-role-card__hint {
  color: var(--app-text-secondary);
}

.message-focus__hint {
  color: rgba(239, 246, 255, 0.9);
}

.message-filter-panel,
.message-priority,
.message-list-block,
.message-login {
  margin: 0 24rpx;
  padding: 24rpx;
  border-radius: 28rpx;
}

.message-list-block__head,
.message-card__header,
.message-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.message-list-block__title,
.message-priority__title,
.message-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.message-priority__copy,
.message-filter-panel,
.message-filter-panel__group,
.message-list,
.message-card__headline,
.message-card__conversation {
  display: grid;
  gap: 16rpx;
}

.message-priority {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.12), transparent 36%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.message-priority__hint,
.message-priority__meta,
.message-card__meta,
.message-card__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.message-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.message-card__conversation {
  padding: 18rpx;
  border-radius: 22rpx;
  background: #eef7ff;
}

.message-card__preview {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

.message-card__amount {
  color: #0f766e;
  font-size: 24rpx;
  line-height: 1.6;
  font-weight: 700;
}

@media (max-width: 680px) {
  .message-card__header,
  .message-card__footer,
  .message-list-block__head {
    flex-direction: column;
  }
}
</style>
