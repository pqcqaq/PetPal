<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { openLoginPage, roleSummary } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || 'PetPal 用户')

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openNotifications() {
  uni.navigateTo({ url: '/pages/notifications/index' })
}
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
          <text class="petpal-pill">{{ userInfo.email || '邮箱未补齐' }}</text>
          <text class="petpal-pill">{{ userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限' }}</text>
        </view>
      </PetpalSection>

      <PetpalSection title="常用支持入口">
        <button class="petpal-row-btn" hover-class="none" @click="openProfile">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">修改资料</text>
            <text class="petpal-row__hint">昵称、邮箱、头像集中处理。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
        <button class="petpal-row-btn" hover-class="none" @click="openSettings">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">体验设置</text>
            <text class="petpal-row__hint">主题、密度、动效和底栏样式。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
        <button class="petpal-row-btn" hover-class="none" @click="openNotifications">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">通知中心</text>
            <text class="petpal-row__hint">当前还有 {{ notificationStore.unreadCount }} 条未处理提醒。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
