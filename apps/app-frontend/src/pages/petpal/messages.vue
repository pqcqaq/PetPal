<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人或照料者，需要快速回消息
 * Entry: 首页消息入口、提醒中心、订单详情回流
 * First screen: 先看到还有多少未读和应该先回哪一侧
 * Primary action: 打开具体订单聊天并立即回复
 * Secondary actions: 切角色、看通知、回主页
 * States: 未登录、无会话、只看未读、主人侧待回、照料者侧待回
 */
import type { CaregiverOrderRecord, OrderRecord, OrderStatus } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_HUB_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalMessagesPage',
})

definePage({
  style: {
    navigationBarTitleText: '消息中心',
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

const roleFilterOptions = [
  { label: '全部', value: 'ALL', description: '查看全部角色会话' },
  { label: '主人侧', value: 'OWNER', description: '聚焦主人视角' },
  { label: '照料者侧', value: 'CAREGIVER', description: '聚焦照料者视角' },
]

const viewFilterOptions = [
  { label: '未读', value: 'UNREAD', description: '只看当前仍有未读消息的订单' },
  { label: '全部', value: 'ALL', description: '包括还没开始沟通的活跃订单' },
]

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')

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

const caregiverUnreadCount = computed(() => messageItems.value
  .filter(item => item.role === 'caregiver')
  .reduce((total, item) => total + item.unreadCount, 0))

const totalUnreadCount = computed(() => ownerUnreadCount.value + caregiverUnreadCount.value)

const focusTitle = computed(() => (
  totalUnreadCount.value > 0
    ? `${displayName.value}，先回消息`
    : '消息已处理完'
))

const focusHint = computed(() => {
  if (!messageItems.value.length) {
    return '当前没有需要进入的订单沟通。'
  }
  if (totalUnreadCount.value > 0) {
    return `当前还有 ${totalUnreadCount.value} 条未读，优先处理最上面的会话。`
  }
  return '可以切到全部会话回看最近沟通。'
})

const signalCards = computed(() => [
  {
    label: '会话',
    value: String(messageItems.value.length),
    hint: messageItems.value.length ? '跨订单汇总' : '暂无会话',
  },
  {
    label: '主人未读',
    value: String(ownerUnreadCount.value),
    hint: ownerUnreadCount.value ? '需要主人回复' : '主人侧已读',
  },
  {
    label: '照料者未读',
    value: String(caregiverUnreadCount.value),
    hint: caregiverUnreadCount.value ? '需要照料者回复' : '照料者侧已读',
  },
  {
    label: '当前列表',
    value: String(filteredItems.value.length),
    hint: viewFilter.value === 'UNREAD' ? '只看未读' : '显示全部',
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
  return role === 'owner' ? '主人视角' : '照料者视角'
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

function openRoleHub() {
  uni.redirectTo({ url: PETPAL_HUB_PAGE })
}

function openOwnerHome() {
  uni.redirectTo({ url: PETPAL_OWNER_HOME_PAGE })
}

function openCaregiverHome() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_HOME_PAGE })
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
  <AppPageShell title="消息中心">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="待回消息">
        <view class="message-focus">
          <view class="message-focus__copy">
            <view class="message-focus__tags">
              <AppTag :type="totalUnreadCount > 0 ? 'warning' : 'default'">
                {{ totalUnreadCount > 0 ? `${totalUnreadCount} 条未读` : '已读' }}
              </AppTag>
              <AppTag type="primary">{{ filteredItems.length }} 个入口</AppTag>
            </view>
            <text class="message-focus__title">{{ focusTitle }}</text>
            <text class="message-focus__hint">{{ focusHint }}</text>
          </view>
          <view class="message-focus__actions">
            <AppButton size="medium" :disabled="!messageItems.length" @click="openFirstConversation">先回第一条</AppButton>
            <AppButton size="medium" type="info" @click="openNotifications">通知</AppButton>
            <AppButton size="medium" type="info" @click="openOwnerHome">主人首页</AppButton>
            <AppButton size="medium" type="info" @click="openCaregiverHome">照料者首页</AppButton>
            <AppButton size="medium" type="info" @click="openRoleHub">角色入口</AppButton>
          </view>
        </view>

        <view class="message-signal-grid">
          <view v-for="item in signalCards" :key="item.label" class="message-signal-card">
            <text class="message-metric-card__label">{{ item.label }}</text>
            <text class="message-metric-card__value">{{ item.value }}</text>
            <text class="message-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="筛选">
        <view class="message-filter-panel">
          <view class="message-filter-panel__group">
            <text class="message-filter-panel__label">角色视角</text>
            <AppChoiceChips v-model="roleFilter" :options="roleFilterOptions" />
          </view>
          <view class="message-filter-panel__group">
            <text class="message-filter-panel__label">列表范围</text>
            <AppChoiceChips v-model="viewFilter" :options="viewFilterOptions" />
          </view>
        </view>
      </AppSection>

      <AppSection :title="filteredItems.length ? `会话列表 (${filteredItems.length})` : '会话列表'">
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
                <AppButton size="medium" type="info" @click="openOrderOverview(item.orderId)">订单详情</AppButton>
                <AppButton size="medium" @click="openOrderChat(item.orderId)">打开聊天</AppButton>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="message-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步消息中心' : '当前筛选下没有需要进入的订单沟通'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后查看消息">
        <view class="message-empty message-empty--login">
          <AppStatus text="登录后即可查看跨订单消息。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.message-focus {
  display: grid;
  gap: 18rpx;
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

.message-focus__tags,
.message-focus__actions,
.message-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.message-focus__title {
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.message-focus__hint {
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(239, 246, 255, 0.9);
}

.message-signal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.message-signal-card,
.message-filter-panel,
.message-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.message-metric-card__label,
.message-card__meta,
.message-card__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.message-metric-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.message-metric-card__hint,
.message-filter-panel__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}

.message-filter-panel,
.message-filter-panel__group,
.message-list,
.message-card__headline,
.message-card__conversation {
  display: grid;
  gap: 16rpx;
}

.message-card__header,
.message-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.message-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.message-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
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

.message-empty {
  padding: 8rpx 0;
}

.message-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .message-signal-grid {
    grid-template-columns: 1fr;
  }

  .message-card__header,
  .message-card__footer {
    flex-direction: column;
  }
}
</style>
