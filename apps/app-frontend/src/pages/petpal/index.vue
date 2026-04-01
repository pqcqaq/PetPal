<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录并需要快速进入主人或照料者工作状态的用户
 * Entry: 打开 App、切换身份、从其他页返回角色中枢
 * First screen: 只解决“我现在以哪个身份做什么”
 * Primary action: 进入当前身份首页
 * Secondary actions: 直接去消息、提醒、订单或服务
 * States: 未登录、已登录无待办、已登录有未读提醒
 */
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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
    navigationBarTitleText: 'PetPal',
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

const activeRoleTitle = computed(() => activeRole.value === 'OWNER' ? '主人模式' : '照料者模式')
const activeRoleSummary = computed(() => (
  activeRole.value === 'OWNER'
    ? '查看订单、发布需求、处理售后。'
    : '接单、履约、管理服务和收益。'
))

const roleActionItems = computed(() => (
  activeRole.value === 'OWNER'
    ? [
        {
          title: '新建需求',
          label: '快速开始一次新的照料安排',
          value: '去发布',
          action: () => uni.navigateTo({ url: PETPAL_REQUEST_PAGE }),
        },
        {
          title: '我的订单',
          label: '查看进行中、待确认和待评价订单',
          value: '去处理',
          action: () => uni.navigateTo({ url: PETPAL_ORDERS_PAGE }),
        },
        {
          title: '售后中心',
          label: '退款、投诉、争议统一处理',
          value: '去跟进',
          action: () => uni.navigateTo({ url: PETPAL_AFTERSALES_PAGE }),
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
  uni.redirectTo({
    url: activeRole.value === 'OWNER'
      ? PETPAL_OWNER_HOME_PAGE
      : PETPAL_CAREGIVER_HOME_PAGE,
  })
}

function openMessages() {
  uni.navigateTo({ url: PETPAL_MESSAGES_PAGE })
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
  <AppPageShell title="PetPal">
    <template v-if="tokenStore.hasLogin">
      <view class="hub-shell">
        <view class="hub-top">
          <view class="hub-top__headline">
            <text class="hub-top__title">{{ displayName }}</text>
            <text class="hub-top__meta">直接进入当前要处理的身份任务。</text>
          </view>
          <view class="hub-top__tags">
            <AppTag :type="activeRole === 'OWNER' ? 'primary' : 'warning'">
              {{ activeRoleTitle }}
            </AppTag>
            <AppTag :type="unreadNotificationCount > 0 ? 'danger' : 'success'">
              {{ unreadNotificationCount > 0 ? `${unreadNotificationCount} 待处理` : '当前平稳' }}
            </AppTag>
          </view>
        </view>

        <AppSection title="切换身份">
          <AppChoiceChips v-model="activeRole" :options="roleOptions" />
        </AppSection>

        <AppSection title="现在开始">
          <view class="hub-primary">
            <view class="hub-primary__copy">
              <text class="hub-primary__title">{{ activeRoleTitle }}</text>
              <text class="hub-primary__summary">{{ activeRoleSummary }}</text>
            </view>
            <view class="hub-primary__actions">
              <AppButton size="medium" @click="openActiveRoleHome">进入首页</AppButton>
              <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
              <AppButton size="medium" type="danger" @click="openReminders">提醒</AppButton>
            </view>
          </view>
        </AppSection>

        <AppSection title="直接操作">
          <AppList>
            <AppListItem
              v-for="item in roleActionItems"
              :key="item.title"
              :title="item.title"
              :label="item.label"
              :value="item.value"
              value-emphasis
              clickable
              is-link
              @click="item.action"
            />
          </AppList>
        </AppSection>
      </view>
    </template>

    <template v-else>
      <AppSection title="登录后开始">
        <view class="hub-empty">
          <AppStatus text="登录后直接进入主人或照料者任务。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.hub-shell {
  display: grid;
  gap: 18rpx;
}

.hub-top,
.hub-primary {
  display: grid;
  gap: 14rpx;
  padding: 26rpx 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 32%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.hub-top__headline,
.hub-primary__copy {
  display: grid;
  gap: 8rpx;
}

.hub-top__title,
.hub-primary__title {
  color: var(--app-text);
  font-size: 36rpx;
  line-height: 1.2;
  font-weight: 700;
}

.hub-top__meta,
.hub-primary__summary {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.hub-top__tags,
.hub-primary__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.hub-empty {
  padding-bottom: 28rpx;
}
</style>
