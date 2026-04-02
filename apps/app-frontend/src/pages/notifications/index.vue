<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import PetpalEmpty from '../petpal/rebuild/petpal-empty.vue'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import PetpalSegmented from '../petpal/rebuild/petpal-segmented.vue'
import { useNotificationStore, useTokenStore } from '@/store'
import { openLoginPage, openPetPalAction, stopPullDown } from '../petpal/rebuild/shared'

type FilterValue = 'UNREAD' | 'ALL'

const tokenStore = useTokenStore()
const notificationStore = useNotificationStore()
const loading = ref(false)
const filter = ref<FilterValue>('UNREAD')

const visibleRows = computed(() => {
  return notificationStore.items.filter(item => filter.value === 'ALL' || !notificationStore.isRead(item))
})

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
  <PetpalPage title="通知中心" subtitle="通知中心只展示待办和入口，不放额外解释。" eyebrow="Notifications" back :back-url="'/pages/me/me'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看通知">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection title="筛选通知">
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '未读', value: 'UNREAD', badge: notificationStore.unreadCount },
            { label: '全部', value: 'ALL', badge: notificationStore.items.length },
          ]"
        />
      </PetpalSection>

      <PetpalSection title="通知列表">
        <template #trailing>
          <button class="petpal-icon-btn" hover-class="none" @click="notificationStore.markAllAsRead()">全部已读</button>
        </template>
        <template v-if="visibleRows.length">
          <button
            v-for="item in visibleRows"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openItem(item.id)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.title }}</text>
              <text class="petpal-row__meta">{{ item.summary }}</text>
              <text class="petpal-row__hint">{{ item.detail }}</text>
            </view>
            <text class="petpal-row__value">{{ notificationStore.isRead(item) ? '已读' : item.actionLabel }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="没有更多通知" description="当前筛选下没有新的待处理项。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
