<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录用户，需要在“我的”页快速确认账户状态并继续最近任务
 * Entry: 底栏我的、订单回流、通知回流
 * First screen: 头像、账户状态、一个最该继续的任务，不先展示说明
 * Primary action: 继续订单、售后、需求或宠物建档中的当前优先任务
 * Secondary actions: 资料、通知、提醒、帮助、设置、退出登录
 * States: 未登录、无宠物、无进行中订单、有售后、有未读通知
 */
import type { OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppAvatar from '@/components/app-avatar/app-avatar.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests } from '@/api/petpal'
import {
  formatAmount,
  getOrderStatusLabel,
  isOrderAftersalesTracked,
  openPetPalAction,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REMINDERS_PAGE,
  PETPAL_REQUEST_PAGE,
} from '@/pages/petpal/owner-shared'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useNotificationStore, useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'PetPalMePage',
})

definePage({
  style: {
    navigationBarTitleText: '我的',
    enablePullDownRefresh: true,
  },
})

type QuickActionTone = 'default' | 'alert'

type QuickActionItem = {
  title: string
  value: string
  hint: string
  tone: QuickActionTone
  action: () => void
}

type FocusTask = {
  eyebrow: string
  title: string
  meta: string
  primaryLabel: string
  primaryAction: () => void
  secondaryLabel: string
  secondaryAction: () => void
}

type ServiceRow = {
  title: string
  hint: string
  value: string
  action: () => void
}

const userStore = useUserStore()
const tokenStore = useTokenStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)

const petpalLoading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])

const HELP_PAGE = '/pages/help/index'
const ACCOUNT_SUPPORT_PAGE = '/pages/account/support'

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || '未登录')
const accountMeta = computed(() => userInfo.value.email || '建议补充邮箱，方便接收订单与售后通知')
const unreadNotificationCount = computed(() => notificationStore.unreadCount)
const statusTagType = computed(() => {
  if (!userInfo.value.status) {
    return 'default'
  }
  return userInfo.value.status === 'ACTIVE' ? 'success' : 'warning'
})
const statusTagText = computed(() => {
  if (!userInfo.value.status) {
    return '同步中'
  }
  return userInfo.value.status === 'ACTIVE' ? '账号正常' : '账号受限'
})

const activeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)

const aftersaleCount = computed(() => orders.value.filter(item => isOrderAftersalesTracked(item)).length)

const activeRequestCount = computed(() => requests.value.filter(item => (
  item.status === 'OPEN' || item.status === 'MATCHED'
)).length)

const latestOrders = computed(() => [...orders.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 3))

const heroSummary = computed(() => {
  if (aftersaleCount.value > 0) {
    return `${aftersaleCount.value} 项售后待处理`
  }
  if (activeOrderCount.value > 0) {
    return `${activeOrderCount.value} 单服务正在推进`
  }
  if (activeRequestCount.value > 0) {
    return `${activeRequestCount.value} 条需求还在推进`
  }
  if (pets.value.length > 0) {
    return `${pets.value.length} 只宠物档案可直接复用`
  }
  return '先补资料，再开始第一单服务'
})

const signalPills = computed(() => [
  { label: '宠物', value: `${pets.value.length}` },
  { label: '需求', value: `${activeRequestCount.value}` },
  { label: '订单', value: `${activeOrderCount.value}` },
  { label: '售后', value: `${aftersaleCount.value}` },
])

const quickActions = computed<QuickActionItem[]>(() => [
  {
    title: '订单',
    value: activeOrderCount.value ? `${activeOrderCount.value} 单` : '查看',
    hint: activeOrderCount.value ? '继续跟单' : '看全部订单',
    tone: 'default',
    action: openOrders,
  },
  {
    title: '售后',
    value: aftersaleCount.value ? `${aftersaleCount.value} 项` : '稳定',
    hint: aftersaleCount.value ? '退款和投诉待处理' : '当前无异常',
    tone: aftersaleCount.value ? 'alert' : 'default',
    action: openAftersalesCenter,
  },
  {
    title: '通知',
    value: unreadNotificationCount.value ? `${unreadNotificationCount.value} 条` : '已读',
    hint: unreadNotificationCount.value ? '有新动态' : '没有新通知',
    tone: unreadNotificationCount.value ? 'alert' : 'default',
    action: openNotificationsCenter,
  },
  {
    title: '资料',
    value: userInfo.value.email ? '已完善' : '去完善',
    hint: '头像、昵称、邮箱',
    tone: 'default',
    action: openProfile,
  },
])

const focusTask = computed<FocusTask>(() => {
  if (aftersaleCount.value > 0) {
    return {
      eyebrow: '优先处理',
      title: '先把售后问题跟进完',
      meta: `${aftersaleCount.value} 项退款或投诉还在处理中，建议先进入售后中心查看进展。`,
      primaryLabel: '去处理',
      primaryAction: openAftersalesCenter,
      secondaryLabel: '看提醒',
      secondaryAction: openRemindersCenter,
    }
  }

  if (activeOrderCount.value > 0) {
    return {
      eyebrow: '最近任务',
      title: '继续当前订单进度',
      meta: `${activeOrderCount.value} 单服务正在推进，可以直接回到订单页继续处理。`,
      primaryLabel: '看订单',
      primaryAction: openOrders,
      secondaryLabel: '去消息',
      secondaryAction: openMessages,
    }
  }

  if (activeRequestCount.value > 0) {
    return {
      eyebrow: '最近任务',
      title: '继续当前需求',
      meta: `${activeRequestCount.value} 条需求还没走完，可以继续筛人、下单或补充信息。`,
      primaryLabel: '去首页',
      primaryAction: openServiceBoard,
      secondaryLabel: '发新需求',
      secondaryAction: openNewRequest,
    }
  }

  if (pets.value.length > 0) {
    return {
      eyebrow: '下一步',
      title: '发一次新的照料需求',
      meta: `已有 ${pets.value.length} 只宠物档案，可以直接复用信息开始下单。`,
      primaryLabel: '发需求',
      primaryAction: openNewRequest,
      secondaryLabel: '看宠物',
      secondaryAction: openPets,
    }
  }

  return {
    eyebrow: '下一步',
    title: '先补第一只宠物档案',
    meta: '先把宠物资料建好，后面发需求、下单和售后跟进都会更顺。',
    primaryLabel: '去建档',
    primaryAction: openPets,
    secondaryLabel: '看首页',
    secondaryAction: openServiceBoard,
  }
})

const serviceRows = computed<ServiceRow[]>(() => [
  {
    title: '提醒中心',
    hint: '待办、售后和跨页面提醒都在这里汇总',
    value: aftersaleCount.value ? `${aftersaleCount.value} 项待看` : '查看',
    action: openRemindersCenter,
  },
  {
    title: '个人资料',
    hint: '更新头像、昵称和联系方式',
    value: userInfo.value.email ? '已完善' : '去完善',
    action: openProfile,
  },
  {
    title: '设置',
    hint: '通知偏好和界面选项',
    value: '调整',
    action: openSettings,
  },
  {
    title: '帮助中心',
    hint: '常见问题和使用帮助',
    value: '查看',
    action: openHelpCenter,
  },
  {
    title: '账户支持',
    hint: '账号状态、同步和异常问题',
    value: '支持',
    action: openAccountSupport,
  },
])

function handleLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function handleRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openServiceBoard() {
  openPetPalAction('navigate', PETPAL_OWNER_HOME_PAGE)
}

function openOrders() {
  openPetPalAction('navigate', PETPAL_ORDERS_PAGE)
}

function openMessages() {
  openPetPalAction('navigate', PETPAL_MESSAGES_PAGE)
}

function openPets() {
  openPetPalAction('navigate', PETPAL_PETS_PAGE)
}

function openNewRequest() {
  openPetPalAction('navigate', PETPAL_REQUEST_PAGE)
}

function openAftersalesCenter() {
  uni.navigateTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openRemindersCenter() {
  uni.navigateTo({ url: PETPAL_REMINDERS_PAGE })
}

function openNotificationsCenter() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openHelpCenter() {
  uni.navigateTo({ url: HELP_PAGE })
}

function openAccountSupport() {
  uni.navigateTo({ url: ACCOUNT_SUPPORT_PAGE })
}

function openOrderDetail(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=overview` })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    success: async (res) => {
      if (res.confirm) {
        await tokenStore.logout()
        uni.reLaunch({ url: LOGIN_PAGE })
      }
    },
  })
}

async function loadPetPalAccount(showError = false) {
  if (!tokenStore.hasLogin || petpalLoading.value) {
    uni.stopPullDownRefresh()
    return
  }

  petpalLoading.value = true
  try {
    await Promise.all([
      userStore.fetchUserInfo().catch(() => undefined),
      notificationStore.refreshNotifications(),
      listPets().then(rows => (pets.value = rows)),
      listServiceRequests().then(rows => (requests.value = rows)),
      listOrders().then(rows => (orders.value = rows)),
    ])
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载我的页面失败'),
        icon: 'none',
      })
    }
  }
  finally {
    petpalLoading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }

  void loadPetPalAccount(false)
})

onPullDownRefresh(() => {
  void loadPetPalAccount(true)
})
</script>

<template>
  <AppPageShell title="我的">
    <template v-if="tokenStore.hasLogin">
      <view class="me-page">
        <view class="me-hero">
          <AppAvatar
            class="me-hero__avatar"
            :src="userInfo.avatarUrl || '/static/images/default-avatar.png'"
            :text="displayName"
            size="large"
            shape="circle"
          />

          <view class="me-hero__body">
            <view class="me-hero__copy">
              <text class="me-hero__name">{{ displayName }}</text>
              <text class="me-hero__meta">{{ accountMeta }}</text>
              <text class="me-hero__summary">{{ heroSummary }}</text>
            </view>

            <view class="me-hero__tags">
              <AppTag :type="statusTagType">
                {{ statusTagText }}
              </AppTag>
              <AppTag :type="unreadNotificationCount > 0 ? 'danger' : 'default'">
                {{ unreadNotificationCount > 0 ? `${unreadNotificationCount} 条通知` : '通知已读' }}
              </AppTag>
            </view>
          </view>
        </view>

        <scroll-view class="me-quick-scroll" :scroll-x="true" :show-scrollbar="false">
          <view class="me-quick-track">
            <view
              v-for="item in quickActions"
              :key="item.title"
              class="me-quick-card"
              :class="item.tone === 'alert' ? 'me-quick-card--alert' : ''"
              @click="item.action"
            >
              <text class="me-quick-card__title">{{ item.title }}</text>
              <text class="me-quick-card__value">{{ item.value }}</text>
              <text class="me-quick-card__hint">{{ item.hint }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="me-focus">
          <view class="me-focus__copy">
            <text class="me-focus__eyebrow">{{ focusTask.eyebrow }}</text>
            <text class="me-focus__title">{{ focusTask.title }}</text>
            <text class="me-focus__meta">{{ focusTask.meta }}</text>
          </view>
          <view class="me-focus__actions">
            <AppButton size="medium" @click="focusTask.primaryAction">{{ focusTask.primaryLabel }}</AppButton>
            <AppButton size="medium" type="info" @click="focusTask.secondaryAction">{{ focusTask.secondaryLabel }}</AppButton>
          </view>
        </view>

        <view class="me-signal-wrap">
          <view v-for="item in signalPills" :key="item.label" class="me-signal-pill">
            <text class="me-signal-pill__label">{{ item.label }}</text>
            <text class="me-signal-pill__value">{{ item.value }}</text>
          </view>
        </view>

        <view class="me-group">
          <view
            v-for="item in serviceRows"
            :key="item.title"
            class="me-cell"
            @click="item.action"
          >
            <view class="me-cell__copy">
              <text class="me-cell__title">{{ item.title }}</text>
              <text class="me-cell__hint">{{ item.hint }}</text>
            </view>
            <view class="me-cell__meta">
              <text class="me-cell__value">{{ item.value }}</text>
              <view class="me-cell__arrow" />
            </view>
          </view>
        </view>

        <view class="me-group">
          <view class="me-group__head">
            <text class="me-group__title">最近订单</text>
            <AppButton size="medium" type="info" @click="openOrders">全部订单</AppButton>
          </view>

          <view v-if="latestOrders.length" class="me-order-list">
            <view
              v-for="order in latestOrders"
              :key="order.id"
              class="me-cell"
              @click="openOrderDetail(order.id)"
            >
              <view class="me-cell__copy">
                <text class="me-cell__title">{{ order.orderNo }}</text>
                <text class="me-cell__hint">
                  {{ getOrderStatusLabel(order.orderStatus) }} · 实付 ¥{{ formatAmount(order.amountPaid) }}
                </text>
              </view>
              <view class="me-cell__meta">
                <text class="me-cell__value">{{ isOrderAftersalesTracked(order) ? '售后中' : '查看' }}</text>
                <view class="me-cell__arrow" />
              </view>
            </view>
          </view>

          <view v-else class="me-empty">
            <AppStatus :mode="petpalLoading ? 'loading' : 'empty'" :text="petpalLoading ? '正在同步订单' : '最近没有需要跟进的订单'" />
          </view>
        </view>

        <view class="me-logout">
          <AppButton block size="large" type="info" @click="handleLogout">
            退出登录
          </AppButton>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="me-guest">
        <view class="me-guest__copy">
          <text class="me-guest__title">登录后继续</text>
          <text class="me-guest__meta">登录后查看账户、订单、售后和通知。</text>
        </view>
        <AppStatus text="先登录，再继续管理宠物服务进度。" />
        <view class="me-guest__actions">
          <AppButton block size="large" @click="handleLogin">去登录</AppButton>
          <AppButton block size="large" type="info" @click="handleRegister">去注册</AppButton>
        </view>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.me-page {
  display: grid;
  gap: 22rpx;
  padding-bottom: 40rpx;
}

.me-hero,
.me-focus,
.me-group,
.me-guest {
  margin: 0 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.me-hero {
  display: grid;
  grid-template-columns: 120rpx minmax(0, 1fr);
  gap: 20rpx;
  padding: 28rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.18), transparent 34%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.2), transparent 34%),
    linear-gradient(145deg, #2563eb 0%, #60a5fa 44%, #f97316 100%);
}

.me-hero__body,
.me-hero__copy,
.me-focus__copy,
.me-guest,
.me-guest__copy {
  display: grid;
  gap: 12rpx;
}

.me-hero__name {
  color: #eff6ff;
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 38rpx;
  line-height: 1.14;
  font-weight: 700;
}

.me-hero__meta,
.me-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.me-hero__tags,
.me-focus__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.me-quick-scroll {
  white-space: nowrap;
}

.me-quick-track {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.me-quick-card {
  display: grid;
  gap: 10rpx;
  width: 240rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 26rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
  box-sizing: border-box;
}

.me-quick-card--alert {
  background:
    radial-gradient(circle at top right, rgba(220, 38, 38, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(255, 236, 234, 0.96) 0%, rgba(255, 251, 246, 0.98) 100%);
}

.me-quick-card__title,
.me-focus__eyebrow,
.me-signal-pill__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.me-quick-card__value,
.me-signal-pill__value {
  color: var(--app-brand-strong);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.me-quick-card__hint,
.me-focus__meta,
.me-cell__hint,
.me-guest__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.me-focus {
  display: grid;
  gap: 18rpx;
  padding: 26rpx 28rpx;
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.18), transparent 36%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
}

.me-focus__title,
.me-group__title,
.me-cell__title,
.me-guest__title {
  color: var(--app-text);
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 30rpx;
  line-height: 1.22;
  font-weight: 700;
}

.me-signal-wrap {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  padding: 0 24rpx;
}

.me-signal-pill {
  display: grid;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 30%),
    rgba(255, 248, 239, 0.9);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
}

.me-group {
  overflow: hidden;
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
}

.me-group__head {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
  padding: 24rpx 24rpx 8rpx;
}

.me-order-list {
  display: grid;
}

.me-cell {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: center;
  padding: 26rpx 24rpx;
}

.me-cell + .me-cell {
  border-top: 1rpx solid rgba(245, 220, 192, 0.88);
}

.me-cell__copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8rpx;
}

.me-cell__meta {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex-shrink: 0;
}

.me-cell__value {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.me-cell__arrow {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid var(--app-brand-strong);
  border-right: 3rpx solid var(--app-brand-strong);
  transform: rotate(45deg);
}

.me-empty,
.me-logout {
  padding: 24rpx;
}

.me-guest {
  display: grid;
  gap: 20rpx;
  padding: 28rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 36%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
}

.me-guest__actions {
  display: grid;
  gap: 16rpx;
}

@media (max-width: 680px) {
  .me-signal-wrap {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .me-group__head,
  .me-cell {
    align-items: flex-start;
  }
}
</style>
