<script lang="ts" setup>
import { computed } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalEmpty from '../petpal/rebuild/petpal-empty.vue'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import {
  initials,
  isCaregiverEnabled,
  openLoginPage,
  openPetPalRemindersPage,
  openRoleHome,
  PETPAL_HUB_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  REGISTER_PAGE,
  roleSummary,
  stopPullDown,
} from '../petpal/rebuild/shared'

definePage({
  style: {
    navigationBarTitleText: '首页',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)
const { unreadCount, unreadHighPriorityCount } = storeToRefs(notificationStore)

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || 'PetPal 用户')
const canOpenCaregiver = computed(() => isCaregiverEnabled(userInfo.value))

async function loadPage() {
  if (!tokenStore.hasLogin) {
    stopPullDown()
    return
  }
  await Promise.all([
    userStore.fetchUserInfo().catch(() => undefined),
    notificationStore.refreshNotifications().catch(() => undefined),
  ])
  stopPullDown()
}

function openHub() {
  uni.navigateTo({ url: PETPAL_HUB_PAGE })
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openReminders() {
  openPetPalRemindersPage({
    scope: 'ALL',
    mode: 'navigate',
  })
}

function goRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage
    title="选择你现在要继续的入口"
    :subtitle="tokenStore.hasLogin ? '首页只做分流，不再展示旧门户式概览。' : '先登录，再进入主人或照料者主流程。'"
    eyebrow="Home"
    with-tabbar
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="先登录" subtitle="登录后直接进入新的 PetPal 办事流。">
        <PetpalEmpty title="当前未登录" description="不展示介绍性内容，只保留登录和注册两个入口。">
          <view class="app-entry-actions">
            <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
            <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="goRegister">注册账号</button>
          </view>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent">
        <view class="app-home-banner">
          <view class="app-home-banner__profile">
            <view class="petpal-avatar-badge">{{ initials(displayName) }}</view>
            <view class="app-home-banner__copy">
              <text class="app-home-banner__title">{{ displayName }}</text>
              <text class="app-home-banner__meta">{{ roleSummary(userInfo) }}</text>
            </view>
          </view>
          <button class="petpal-icon-btn" hover-class="none" @click="openNotifications">
            通知 {{ unreadCount }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="主人入口" subtitle="宠物、需求、下单、消息和售后都从主人首页分流。">
        <button class="app-entry-row" hover-class="none" @click="openRoleHome('owner')">
          <view class="app-entry-row__copy">
            <text class="app-entry-row__title">进入主人首页</text>
            <text class="app-entry-row__meta">继续宠物建档、需求发布和订单跟进。</text>
          </view>
          <text class="app-entry-row__value">打开</text>
        </button>
      </PetpalSection>

      <PetpalSection title="照料者入口" subtitle="资料、服务、履约和收益都已经拆成独立页面。">
        <button class="app-entry-row" hover-class="none" @click="openRoleHome('caregiver')">
          <view class="app-entry-row__copy">
            <text class="app-entry-row__title">进入照料者首页</text>
            <text class="app-entry-row__meta">{{ canOpenCaregiver ? '继续处理资料、服务和履约。' : '未开通照料者角色时也可先查看入口结构。' }}</text>
          </view>
          <text class="app-entry-row__value">打开</text>
        </button>
      </PetpalSection>

      <PetpalSection title="统一待办" subtitle="高优先通知和待办集中收口，不再散落在首页。">
        <button class="app-entry-row" hover-class="none" @click="openReminders">
          <view class="app-entry-row__copy">
            <text class="app-entry-row__title">提醒中心</text>
            <text class="app-entry-row__meta">当前高优先待办 {{ unreadHighPriorityCount }} 条。</text>
          </view>
          <text class="app-entry-row__value">进入</text>
        </button>
        <button class="app-entry-row" hover-class="none" @click="openHub">
          <view class="app-entry-row__copy">
            <text class="app-entry-row__title">PetPal 中枢</text>
            <text class="app-entry-row__meta">查看主人和照料者的分流入口。</text>
          </view>
          <text class="app-entry-row__value">进入</text>
        </button>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>

<style scoped lang="scss">
.app-entry-actions {
  display: flex;
  gap: 20rpx;
  flex-wrap: wrap;
  margin-top: 12rpx;
}

.app-home-banner {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: center;
}

.app-home-banner__profile {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.app-home-banner__copy {
  display: grid;
  gap: 6rpx;
}

.app-home-banner__title {
  font-size: 34rpx;
  color: var(--app-text);
  font-weight: 700;
}

.app-home-banner__meta {
  font-size: 24rpx;
  color: var(--app-text-secondary);
}

.app-entry-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
}

.app-entry-row__copy {
  display: grid;
  gap: 8rpx;
}

.app-entry-row__title {
  font-size: 30rpx;
  color: var(--app-text);
  font-weight: 700;
}

.app-entry-row__meta,
.app-entry-row__value {
  font-size: 24rpx;
  color: var(--app-text-secondary);
}
</style>
