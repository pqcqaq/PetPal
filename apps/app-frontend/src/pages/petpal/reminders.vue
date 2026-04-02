<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { useNotificationStore, useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { openLoginPage, openPetPalAction, stopPullDown } from './rebuild/shared'

const tokenStore = useTokenStore()
const notificationStore = useNotificationStore()
const loading = ref(false)

const priorityRows = computed(() => notificationStore.items.filter(item => !notificationStore.isRead(item) && item.priority === 'HIGH'))
const secondaryRows = computed(() => notificationStore.items.filter(item => !notificationStore.isRead(item) && item.priority !== 'HIGH'))

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

function handleAction(id: string) {
  const item = notificationStore.items.find(row => row.id === id)
  if (!item) return
  notificationStore.markAsRead(item)
  openPetPalAction(item.actionMode === 'redirect' ? 'redirect' : 'navigate', item.actionUrl)
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="提醒中心" subtitle="这里只保留待办，不展示介绍或空洞概念。" eyebrow="Reminders" back :back-url="'/pages/petpal/index'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看当前待办">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="danger" title="待办总览" :subtitle="priorityRows.length ? `还有 ${priorityRows.length} 条高优先待办` : '当前没有高优先级待办'">
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">高优先级</text>
            <text class="petpal-stat__value">{{ priorityRows.length }}</text>
            <text class="petpal-stat__meta">优先处理</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">其他待办</text>
            <text class="petpal-stat__value">{{ secondaryRows.length }}</text>
            <text class="petpal-stat__meta">按需处理</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="高优先级待办" :subtitle="priorityRows.length ? '这一组只保留需要你马上处理的事项。' : '当前没有高优先级待办'">
        <template v-if="priorityRows.length">
          <view v-for="item in priorityRows" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">High Priority</text>
            <text class="petpal-banner__title">{{ item.title }}</text>
            <text class="petpal-banner__meta">{{ item.summary }}</text>
            <text class="petpal-note">{{ item.detail }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--danger" hover-class="none" @click="handleAction(item.id)">{{ item.actionLabel }}</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="暂时没有高优先级待办" description="你可以继续查看其他通知，或者直接进入主人/照料者首页。"/>
      </PetpalSection>

      <PetpalSection title="其他待办" subtitle="这里保留不那么紧急，但仍然未完成的事项。">
        <template v-if="secondaryRows.length">
          <view v-for="item in secondaryRows" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__title">{{ item.title }}</text>
            <text class="petpal-note">{{ item.summary }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="handleAction(item.id)">{{ item.actionLabel }}</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="其余待办为空" description="当前没有未读的中低优先级提醒。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
