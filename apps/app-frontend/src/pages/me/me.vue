<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录用户，需要从“我的”页快速进入账户和高频工具
 * Entry: 底栏我的、订单或通知回流
 * First screen: 先看到账号状态、未读通知和立即可做的动作
 * Primary action: 进入服务台、提醒、通知或资料设置
 * Secondary actions: 帮助、账户支持、退出登录
 * States: 未登录、通知未读、有进行中订单、有售后、无近期订单
 */
import type { OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppAvatar from '@/components/app-avatar/app-avatar.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests } from '@/api/petpal'
import {
  formatAmount,
  getOrderStatusLabel,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_GETTING_STARTED_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '@/pages/petpal/owner-shared'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useNotificationStore, useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: '我的 PetPal',
  },
})

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
const unreadNotificationCount = computed(() => notificationStore.unreadCount)
const notificationShortcutText = computed(() => unreadNotificationCount.value
  ? `当前有 ${unreadNotificationCount.value} 条未读通知。`
  : '没有新的通知。')
const petpalTierSummary = computed(() => {
  if (userInfo.value.roles.some(role => role.code === 'super-admin')) {
    return '平台全量治理账号'
  }

  if (userInfo.value.roles.some(role => role.code === 'ops-manager')) {
    return '运营协同账号'
  }

  return '主人服务账号'
})
const statusTagType = computed(() => userInfo.value.status === 'ACTIVE' ? 'success' : 'warning')

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

const accountSignals = computed(() => [
  {
    label: '宠物档案',
    value: String(pets.value.length),
    hint: pets.value.length ? '已建档' : '去建档',
  },
  {
    label: '服务需求',
    value: String(activeRequestCount.value),
    hint: activeRequestCount.value ? '继续处理' : '暂无进行中',
  },
  {
    label: '进行中订单',
    value: String(activeOrderCount.value),
    hint: activeOrderCount.value ? '跟单中' : '暂无进行中',
  },
  {
    label: '售后',
    value: String(aftersaleCount.value),
    hint: aftersaleCount.value ? '优先处理' : '当前稳定',
  },
])

const taskCards = computed(() => [
  {
    title: '服务台',
    value: activeOrderCount.value ? `${activeOrderCount.value} 单` : pets.value.length ? '继续' : '建档',
    hint: activeOrderCount.value ? '继续跟单、支付和查看详情' : '宠物、需求和订单都从这里继续',
    tone: 'default' as const,
    action: openServiceBoard,
  },
  {
    title: '提醒',
    value: aftersaleCount.value ? `${aftersaleCount.value} 项` : '查看',
    hint: aftersaleCount.value ? '售后和待办优先处理' : '统一看待办和售后',
    tone: aftersaleCount.value ? 'alert' as const : 'default' as const,
    action: openRemindersCenter,
  },
  {
    title: '通知',
    value: unreadNotificationCount.value ? `${unreadNotificationCount.value} 条` : '已读',
    hint: notificationShortcutText.value,
    tone: unreadNotificationCount.value ? 'alert' as const : 'default' as const,
    action: openNotificationsCenter,
  },
  {
    title: '起步',
    value: activeRequestCount.value ? '继续' : '查看',
    hint: '按主人路径继续当前最该做的事',
    tone: 'default' as const,
    action: openGettingStartedGuide,
  },
])

function handleLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function handleRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}

function openProfile() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openServiceBoard() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.switchTab({ url: '/pages/petpal/owner-home' })
}

function openAftersalesCenter() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openRemindersCenter() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: PETPAL_REMINDERS_PAGE })
}

function openNotificationsCenter() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openGettingStartedGuide() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: PETPAL_GETTING_STARTED_PAGE })
}

function openHelpCenter() {
  uni.navigateTo({ url: HELP_PAGE })
}

function openAccountSupport() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: ACCOUNT_SUPPORT_PAGE })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前 PetPal 账号吗？',
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
    return
  }

  petpalLoading.value = true
  try {
    await Promise.all([
      userStore.fetchUserInfo().catch(() => undefined),
      listPets().then(rows => (pets.value = rows)),
      listServiceRequests().then(rows => (requests.value = rows)),
      listOrders().then(rows => (orders.value = rows)),
    ])
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载 PetPal 账户失败'),
        icon: 'none',
      })
    }
  }
  finally {
    petpalLoading.value = false
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }

  void loadPetPalAccount(false)
  void notificationStore.refreshNotifications()
})
</script>

<template>
  <AppPageShell title="我的 PetPal">
    <view class="app-hero app-hero--account">
      <AppAvatar
        class="app-hero__avatar"
        :src="userInfo.avatarUrl || '/static/images/default-avatar.png'"
        :text="displayName"
        size="large"
        shape="square"
      />
      <view class="app-hero__body">
        <view class="app-hero__title">
          {{ displayName }}
        </view>
        <view class="app-hero__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
        <view class="app-tag-row">
          <AppTag :type="tokenStore.hasLogin ? statusTagType : 'default'">
            {{ tokenStore.hasLogin ? (userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限') : '未登录' }}
          </AppTag>
          <AppTag v-if="tokenStore.hasLogin" type="primary">
            {{ petpalTierSummary }}
          </AppTag>
          <AppTag v-if="tokenStore.hasLogin" :type="unreadNotificationCount ? 'danger' : 'default'">
            {{ unreadNotificationCount ? `通知 ${unreadNotificationCount}` : '通知已读' }}
          </AppTag>
        </view>
        <view v-if="tokenStore.hasLogin" class="account-hero__actions">
          <AppButton size="medium" @click="openServiceBoard">服务台</AppButton>
          <AppButton size="medium" type="info" @click="openNotificationsCenter">通知</AppButton>
          <AppButton size="medium" type="info" @click="openSettings">设置</AppButton>
        </view>
      </view>
    </view>

    <template v-if="tokenStore.hasLogin">
      <AppSection title="账号概览">
        <view class="petpal-me-grid">
          <view v-for="item in accountSignals" :key="item.label" class="petpal-me-card">
            <text class="petpal-me-card__label">{{ item.label }}</text>
            <text class="petpal-me-card__value">{{ item.value }}</text>
            <text class="petpal-me-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="现在处理">
        <view class="petpal-shortcut-grid">
          <view
            v-for="item in taskCards"
            :key="item.title"
            class="petpal-shortcut-card"
            :class="item.tone === 'alert' ? 'petpal-shortcut-card--alert' : ''"
            @click="item.action"
          >
            <text class="petpal-shortcut-card__title">{{ item.title }}</text>
            <text class="petpal-shortcut-card__value">{{ item.value }}</text>
            <text class="petpal-shortcut-card__text">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="账户工具">
        <AppList>
          <AppListItem title="个人资料" label="更新头像、昵称和联系方式" is-link clickable @click="openProfile" />
          <AppListItem title="提醒中心" label="查看待办、售后和跨页面提醒" is-link clickable @click="openRemindersCenter" />
          <AppListItem title="售后中心" label="集中处理退款、投诉和争议" is-link clickable @click="openAftersalesCenter" />
          <AppListItem title="账户支持" label="查看账号状态和同步情况" is-link clickable @click="openAccountSupport" />
          <AppListItem title="帮助中心" label="查看使用帮助和常见问题" is-link clickable @click="openHelpCenter" />
          <AppListItem title="设置" label="调整界面和使用偏好" is-link clickable @click="openSettings" />
        </AppList>
      </AppSection>

      <AppSection title="近期订单">
        <AppList v-if="latestOrders.length">
          <AppListItem
            v-for="order in latestOrders"
            :key="order.id"
            :title="order.orderNo"
            :label="`状态：${getOrderStatusLabel(order.orderStatus)}`"
            :value="`实付 ${formatAmount(order.amountPaid)} / 已退 ${formatAmount(order.amountRefunded)}`"
          />
        </AppList>
        <view v-else class="app-status-wrap">
          <AppStatus :mode="petpalLoading ? 'loading' : 'empty'" :text="petpalLoading ? '正在同步订单数据' : '暂无订单提醒'" />
        </view>
      </AppSection>

      <view class="petpal-action-block">
        <AppButton block size="large" type="info" @click="handleLogout">
          退出登录
        </AppButton>
      </view>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <view class="app-status-wrap app-status-wrap--spacious">
          <AppStatus text="登录后可查看 PetPal 资料、宠物资产和服务进展。" />
        </view>
      </AppSection>

      <view class="petpal-action-block">
        <AppButton block size="large" @click="handleLogin">
          去登录
        </AppButton>
        <AppButton block size="large" type="info" @click="handleRegister">
          去注册
        </AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.account-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.petpal-me-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.petpal-shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.petpal-me-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.petpal-me-card__label {
  font-size: 22rpx;
  color: var(--app-text-muted);
}

.petpal-me-card__value {
  font-size: 40rpx;
  line-height: 1.05;
  color: var(--app-text);
  font-weight: 700;
}

.petpal-me-card__hint {
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--app-text-secondary);
}

.petpal-shortcut-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-surface-container-high) 0%, var(--app-surface) 100%);
  box-shadow: var(--app-elevation-1);
}

.petpal-shortcut-card--alert {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.petpal-shortcut-card__title {
  font-size: 28rpx;
  line-height: 1.4;
  color: var(--app-text);
  font-weight: 700;
}

.petpal-shortcut-card__value {
  font-size: 40rpx;
  line-height: 1.05;
  color: var(--app-text);
  font-weight: 700;
}

.petpal-shortcut-card__text {
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-secondary);
}

.petpal-action-block {
  padding: 0 32rpx 12rpx;
}

.petpal-action-block .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .petpal-me-grid,
  .petpal-shortcut-grid {
    grid-template-columns: 1fr;
  }
}
</style>
