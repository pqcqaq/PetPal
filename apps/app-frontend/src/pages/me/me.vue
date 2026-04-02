<script setup lang="ts">
import { computed } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { initials, openLoginPage, PETPAL_AFTERSALES_PAGE, PETPAL_NOTIFICATIONS_PAGE, roleSummary, stopPullDown } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || '未登录')
const accountMeta = computed(() => userInfo.value.email || '建议补充邮箱，方便接收订单和售后通知')

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openAftersales() {
  uni.navigateTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openHelp() {
  uni.navigateTo({ url: '/pages/help/index' })
}

function openSupport() {
  uni.navigateTo({ url: '/pages/account/support' })
}

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

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="我的" :subtitle="tokenStore.hasLogin ? '账号页只保留资料、设置和通知入口。' : '登录后查看账号资料和快捷入口。'" eyebrow="Account" :with-tabbar="true">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="当前未登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent">
        <view class="petpal-inline">
          <view class="petpal-inline" style="justify-content: flex-start;">
            <view class="petpal-avatar-badge">{{ initials(displayName) }}</view>
            <view class="petpal-stack" style="gap: 6rpx;">
              <text class="petpal-banner__title">{{ displayName }}</text>
              <text class="petpal-note">{{ accountMeta }}</text>
            </view>
          </view>
        </view>
        <view class="petpal-tag-row">
          <text class="petpal-pill petpal-pill--accent">{{ roleSummary(userInfo) }}</text>
          <text class="petpal-pill">{{ userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限' }}</text>
        </view>
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">未读通知</text>
            <text class="petpal-stat__value">{{ notificationStore.unreadCount }}</text>
            <text class="petpal-stat__meta">统一收在通知中心</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">售后入口</text>
            <text class="petpal-stat__value">独立</text>
            <text class="petpal-stat__meta">退款和投诉已拆出业务页</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="账户工作区" subtitle="资料、设置、通知、售后各自独立，不再塞成长列表。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button class="petpal-choice-tile" hover-class="none" @click="openProfile">
            <text class="petpal-choice-tile__eyebrow">Profile</text>
            <text class="petpal-choice-tile__title">个人资料</text>
            <text class="petpal-choice-tile__hint">修改昵称、邮箱和头像。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openSettings">
            <text class="petpal-choice-tile__eyebrow">Settings</text>
            <text class="petpal-choice-tile__title">体验设置</text>
            <text class="petpal-choice-tile__hint">调整主题、密度和动效。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openNotifications">
            <text class="petpal-choice-tile__eyebrow">Notifications</text>
            <text class="petpal-choice-tile__title">通知中心</text>
            <text class="petpal-choice-tile__meta">{{ notificationStore.unreadCount }} 条未读</text>
            <text class="petpal-choice-tile__hint">统一查看提醒和当前任务。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openAftersales">
            <text class="petpal-choice-tile__eyebrow">Aftersales</text>
            <text class="petpal-choice-tile__title">售后中心</text>
            <text class="petpal-choice-tile__hint">退款、投诉、争议集中处理。</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="更多支持">
        <button class="petpal-row-btn" hover-class="none" @click="openHelp">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">帮助中心</text>
            <text class="petpal-row__hint">快速看懂主人和照料者新流程。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
        <button class="petpal-row-btn" hover-class="none" @click="openSupport">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">账户支持</text>
            <text class="petpal-row__hint">账户问题、资料同步和反馈入口。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
