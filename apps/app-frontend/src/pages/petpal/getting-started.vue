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

const ownerTasks = computed(() => notificationStore.items.filter(item => item.scope === 'OWNER').slice(0, 6))
const caregiverTasks = computed(() => notificationStore.items.filter(item => item.scope === 'CAREGIVER').slice(0, 6))

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

function openTask(id: string) {
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
  <PetpalPage title="起步向导" subtitle="不是介绍页，而是把主人和照料者当前要补的步骤列出来。" eyebrow="Getting Started" back :back-url="'/pages/petpal/index'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后生成你的起步任务">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection title="主人起步">
        <template v-if="ownerTasks.length">
          <button
            v-for="item in ownerTasks"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openTask(item.id)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.title }}</text>
              <text class="petpal-row__hint">{{ item.summary }}</text>
            </view>
            <text class="petpal-row__value">{{ item.actionLabel }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="主人侧已经比较完整" description="你可以直接进入主人首页开始使用。"/>
      </PetpalSection>

      <PetpalSection title="照料者起步">
        <template v-if="caregiverTasks.length">
          <button
            v-for="item in caregiverTasks"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openTask(item.id)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.title }}</text>
              <text class="petpal-row__hint">{{ item.summary }}</text>
            </view>
            <text class="petpal-row__value">{{ item.actionLabel }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="照料者侧已经比较完整" description="你可以直接进入照料者首页开始接单。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
