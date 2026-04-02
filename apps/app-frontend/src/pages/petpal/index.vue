<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录并需要快速进入主人或照料者工作状态的用户
 * Entry: 打开 App、切换身份、从其他页返回角色中枢
 * First screen: 先在两个身份卡片里确认“我此刻要以谁的身份做事”
 * Primary action: 进入当前身份首页
 * Secondary actions: 直接去消息、提醒和当前身份的三个高频任务
 * States: 未登录、已登录无待办、已登录有未读提醒
 */
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE } from '@/router/config'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import {
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  openPetPalAction,
  PETPAL_MESSAGES_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_REMINDERS_PAGE,
  PETPAL_REQUEST_PAGE,
} from './owner-shared'

defineOptions({
  name: 'PetPalHubPage',
})

definePage({
  style: {
    navigationBarTitleText: '切换身份',
    enablePullDownRefresh: true,
  },
})

type RoleMode = 'OWNER' | 'CAREGIVER'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const activeRole = ref<RoleMode>('OWNER')

const roleOptions = [
  { label: '主人', value: 'OWNER' },
  { label: '照料者', value: 'CAREGIVER' },
]

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const unreadNotificationCount = computed(() => notificationStore.items.filter(item => !notificationStore.isRead(item)).length)

const activeRoleTitle = computed(() => activeRole.value === 'OWNER' ? '主人' : '照料者')
const activeRoleSummary = computed(() => (
  activeRole.value === 'OWNER'
    ? '发需求、跟订单、处理售后。'
    : '接单、履约、管理服务和收益。'
))
const enterHomeLabel = computed(() => activeRole.value === 'OWNER' ? '进入主人首页' : '进入照料者首页')

const roleActionItems = computed(() => (
  activeRole.value === 'OWNER'
    ? [
        {
          title: '新建需求',
          label: '快速开始一次新的照料安排',
          value: '去发布',
          action: () => openPetPalAction('navigate', PETPAL_REQUEST_PAGE),
        },
        {
          title: '我的订单',
          label: '查看进行中、待确认和待评价订单',
          value: '去处理',
          action: () => openPetPalAction('navigate', PETPAL_ORDERS_PAGE),
        },
        {
          title: '售后中心',
          label: '退款、投诉、争议统一处理',
          value: '去跟进',
          action: () => openPetPalAction('navigate', PETPAL_AFTERSALES_PAGE),
        },
      ]
    : [
        {
          title: '履约订单',
          label: '先看待接单和服务中订单',
          value: '去接单',
          action: () => uni.navigateTo({ url: PETPAL_CAREGIVER_ORDERS_PAGE }),
        },
        {
          title: '服务管理',
          label: '调整报价、城市和上架状态',
          value: '去管理',
          action: () => uni.navigateTo({ url: PETPAL_CAREGIVER_SERVICES_PAGE }),
        },
        {
          title: '收益表现',
          label: '查看收入、评分和风险订单',
          value: '去查看',
          action: () => uni.navigateTo({ url: PETPAL_CAREGIVER_EARNINGS_PAGE }),
        },
      ]
))

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openActiveRoleHome() {
  openPetPalAction('redirect', activeRole.value === 'OWNER'
    ? PETPAL_OWNER_HOME_PAGE
    : PETPAL_CAREGIVER_HOME_PAGE)
}

function openMessages() {
  openPetPalAction('navigate', PETPAL_MESSAGES_PAGE)
}

function openReminders() {
  uni.navigateTo({ url: PETPAL_REMINDERS_PAGE })
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void tokenStore.bootstrap()
  void userStore.fetchUserInfo().catch(() => undefined)
  void notificationStore.refreshNotifications()
})
</script>

<template>
  <AppPageShell title="切换身份">
    <template v-if="tokenStore.hasLogin">
      <view class="hub-page">
        <view class="hub-focus">
          <view class="hub-focus__copy">
            <text class="hub-focus__eyebrow">{{ displayName }}</text>
            <text class="hub-focus__title">先选当前身份</text>
            <text class="hub-focus__meta">先切到当前身份，再继续处理今天要做的事。</text>
          </view>
          <view class="hub-focus__tags">
            <AppTag :type="activeRole === 'OWNER' ? 'primary' : 'warning'">
              {{ activeRoleTitle }}
            </AppTag>
            <AppTag :type="unreadNotificationCount > 0 ? 'danger' : 'success'">
              {{ unreadNotificationCount > 0 ? `${unreadNotificationCount} 待处理` : '当前平稳' }}
            </AppTag>
          </view>
        </view>

        <view class="hub-role-grid">
          <view
            v-for="item in roleOptions"
            :key="item.value"
            class="hub-role-card"
            :class="activeRole === item.value ? 'hub-role-card--active' : ''"
            @click="activeRole = item.value as RoleMode"
          >
            <text class="hub-role-card__title">{{ item.label }}</text>
            <text class="hub-role-card__meta">
              {{ item.value === 'OWNER' ? '发需求、跟单、售后' : '接单、履约、管理服务' }}
            </text>
            <text class="hub-role-card__action">{{ item.value === 'OWNER' ? '作为主人继续' : '作为照料者继续' }}</text>
          </view>
        </view>

        <view class="hub-launchpad">
          <view class="hub-launchpad__copy">
            <text class="hub-launchpad__title">{{ activeRoleTitle }}</text>
            <text class="hub-launchpad__summary">{{ activeRoleSummary }}</text>
          </view>
          <view class="hub-launchpad__actions">
            <AppButton size="medium" @click="openActiveRoleHome">{{ enterHomeLabel }}</AppButton>
            <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
            <AppButton size="medium" type="danger" @click="openReminders">提醒</AppButton>
          </view>
        </view>

        <view class="hub-action-grid">
          <view
            v-for="item in roleActionItems"
            :key="item.title"
            class="hub-action-card"
            @click="item.action"
          >
            <text class="hub-action-card__title">{{ item.title }}</text>
            <text class="hub-action-card__value">{{ item.value }}</text>
            <text class="hub-action-card__hint">{{ item.label }}</text>
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="hub-login">
        <AppStatus text="登录后直接进入主人或照料者任务。" />
        <AppButton block @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.hub-page {
  display: grid;
  gap: 18rpx;
  padding-bottom: 36rpx;
}

.hub-focus,
.hub-launchpad,
.hub-action-card,
.hub-role-card,
.hub-login {
  display: grid;
  gap: 14rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 32%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.hub-focus {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.hub-focus__copy,
.hub-launchpad__copy {
  display: grid;
  gap: 8rpx;
}

.hub-role-grid,
.hub-action-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.hub-role-card--active {
  border-color: transparent;
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.hub-focus__eyebrow {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.hub-focus__title,
.hub-launchpad__title,
.hub-role-card__title,
.hub-action-card__title {
  color: var(--app-text);
  font-size: 36rpx;
  line-height: 1.2;
  font-weight: 700;
}

.hub-launchpad__title,
.hub-action-card__title,
.hub-role-card__title {
  font-size: 30rpx;
  line-height: 1.28;
}

.hub-focus__meta,
.hub-launchpad__summary,
.hub-role-card__meta,
.hub-action-card__hint {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.hub-action-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.hub-role-card__action {
  color: var(--app-accent);
  font-size: 22rpx;
  line-height: 1.5;
  font-weight: 700;
}

.hub-focus__tags,
.hub-launchpad__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.hub-launchpad {
  background:
    radial-gradient(circle at top right, rgba(11, 122, 117, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

@media (max-width: 680px) {
  .hub-role-grid,
  .hub-action-grid {
    grid-template-columns: 1fr;
  }
}
</style>
