<script setup lang="ts">
import { computed } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { openLoginPage, roleSummary, stopPullDown } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || 'PetPal 用户')

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

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openNotifications() {
  uni.navigateTo({ url: '/pages/notifications/index' })
}

function openHelp() {
  uni.navigateTo({ url: '/pages/help/index' })
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="账户支持" subtitle="账户相关能力单独收口，不跟业务页混排。" eyebrow="Support" back :back-url="'/pages/me/me'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="账户状态" :subtitle="displayName">
        <view class="petpal-tag-row">
          <text class="petpal-pill petpal-pill--accent">{{ roleSummary(userInfo) }}</text>
          <text class="petpal-pill">{{ userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限' }}</text>
        </view>
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">邮箱</text>
            <text class="petpal-stat__value">{{ userInfo.email ? '已补齐' : '待补齐' }}</text>
            <text class="petpal-stat__meta">{{ userInfo.email || '建议补充邮箱，方便接收售后与订单提醒' }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">未读通知</text>
            <text class="petpal-stat__value">{{ notificationStore.unreadCount }}</text>
            <text class="petpal-stat__meta">账号提醒与待办统一收口</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="常用支持入口" subtitle="资料、设置和提醒各自独立，不再挤在一页里。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button class="petpal-choice-tile" hover-class="none" @click="openProfile">
            <text class="petpal-choice-tile__eyebrow">Profile</text>
            <text class="petpal-choice-tile__title">修改资料</text>
            <text class="petpal-choice-tile__hint">昵称、邮箱、头像集中处理。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openSettings">
            <text class="petpal-choice-tile__eyebrow">Settings</text>
            <text class="petpal-choice-tile__title">体验设置</text>
            <text class="petpal-choice-tile__hint">主题、密度、动效和底栏样式。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openNotifications">
            <text class="petpal-choice-tile__eyebrow">Notifications</text>
            <text class="petpal-choice-tile__title">通知中心</text>
            <text class="petpal-choice-tile__meta">{{ notificationStore.unreadCount }} 条待处理</text>
            <text class="petpal-choice-tile__hint">集中查看账号提醒和当前待办。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openHelp">
            <text class="petpal-choice-tile__eyebrow">Help</text>
            <text class="petpal-choice-tile__title">帮助中心</text>
            <text class="petpal-choice-tile__hint">快速查看主人、照料者和账户路径。</text>
          </button>
        </view>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
