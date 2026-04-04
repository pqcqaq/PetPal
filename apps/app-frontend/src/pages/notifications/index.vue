<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PetpalEmpty from '../petpal/rebuild/petpal-empty.vue'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import PetpalSegmented from '../petpal/rebuild/petpal-segmented.vue'
import { openAppNotificationAction, useNotificationStore, useTokenStore } from '@/store'
import { openLoginPage, stopPullDown } from '../petpal/rebuild/shared'

type FilterValue = 'UNREAD' | 'ALL'

const tokenStore = useTokenStore()
const notificationStore = useNotificationStore()
const loading = ref(false)
const filter = ref<FilterValue>('UNREAD')

const visibleRows = computed(() => {
  return notificationStore.items.filter(item => filter.value === 'ALL' || !notificationStore.isRead(item))
})
const unreadRows = computed(() => notificationStore.items.filter(item => !notificationStore.isRead(item)))

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    await notificationStore.refreshNotifications()
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openItem(id: string) {
  const item = notificationStore.items.find(row => row.id === id)
  if (!item) return
  notificationStore.markAsRead(item)
  openAppNotificationAction(item, {
    orderDetailSource: 'notifications',
  })
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="通知中心" subtitle="通知中心只展示待办和入口，不放额外解释。" eyebrow="Notifications" back :back-url="'/pages/me/me'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看通知">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="通知总览" :subtitle="unreadRows.length ? `当前还有 ${unreadRows.length} 条未读通知` : '当前没有未读通知'">
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">未读</text>
            <text class="petpal-stat__value">{{ unreadRows.length }}</text>
            <text class="petpal-stat__meta">等待处理</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">全部</text>
            <text class="petpal-stat__value">{{ notificationStore.items.length }}</text>
            <text class="petpal-stat__meta">已归档</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="筛选通知">
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '未读', value: 'UNREAD', badge: notificationStore.unreadCount },
            { label: '全部', value: 'ALL', badge: notificationStore.items.length },
          ]"
        />
      </PetpalSection>

      <PetpalSection title="通知列表" subtitle="每条通知只保留内容和入口，不再叠加额外说明。">
        <template v-if="visibleRows.length">
          <view v-for="item in visibleRows" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">{{ notificationStore.isRead(item) ? 'Read' : 'Unread' }}</text>
            <text class="petpal-banner__title">{{ item.title }}</text>
            <text class="petpal-banner__meta">{{ item.summary }}</text>
            <text class="petpal-note">{{ item.detail }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openItem(item.id)">{{ notificationStore.isRead(item) ? '再次打开' : item.actionLabel }}</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="没有更多通知" description="当前筛选下没有新的待处理项。"/>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="notificationStore.markAllAsRead()">全部设为已读</button>
        </view>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
