<script setup lang="ts">
import type { OrderRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { listOrders } from '@/api/petpal'
import { useNotificationStore, useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import PetpalSegmented from './rebuild/petpal-segmented.vue'
import { describeConversation, openLoginPage, openOrderDetailPage, PETPAL_NOTIFICATIONS_PAGE, stopPullDown } from './rebuild/shared'

type FilterValue = 'ALL' | 'UNREAD'

const tokenStore = useTokenStore()
const notificationStore = useNotificationStore()
const loading = ref(false)
const filter = ref<FilterValue>('UNREAD')
const orders = ref<OrderRecord[]>([])

const conversations = computed(() => {
  return [...orders.value]
    .filter(item => item.conversation)
    .map((item) => ({
      order: item,
      summary: describeConversation(item, 'owner'),
    }))
    .sort((left, right) => {
      const leftTime = left.order.conversation?.lastMessageAt || left.order.updatedAt
      const rightTime = right.order.conversation?.lastMessageAt || right.order.updatedAt
      return new Date(rightTime).getTime() - new Date(leftTime).getTime()
    })
})

const visibleRows = computed(() => {
  return conversations.value.filter(item => filter.value === 'ALL' || item.summary.unread > 0)
})

const priorityRow = computed(() => visibleRows.value[0] ?? null)

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    await notificationStore.refreshNotifications().catch(() => undefined)
    orders.value = await listOrders()
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
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
    title="消息"
    subtitle="消息中心只保留会话摘要，真正聊天进入订单详情里的聊天页。"
    eyebrow="Messages"
    :with-tabbar="true"
  >
    <template #bar>
      <button
        v-if="tokenStore.hasLogin"
        class="petpal-icon-btn"
        hover-class="none"
        @click="openNotifications"
      >
        通知 {{ notificationStore.unreadCount }}
      </button>
    </template>

    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看订单沟通">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection v-if="priorityRow" tone="accent" title="先处理这条" :subtitle="priorityRow.summary.unread ? `${priorityRow.summary.unread} 条未读` : '最近一条会话'">
        <view class="petpal-banner">
          <text class="petpal-banner__title">{{ priorityRow.order.orderNo }}</text>
          <text class="petpal-banner__meta">{{ priorityRow.summary.preview }}</text>
          <text class="petpal-note">{{ priorityRow.summary.meta }}</text>
        </view>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openOrderDetailPage(priorityRow.order.id, 'chat')">去回复</button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(priorityRow.order.id)">看订单</button>
        </view>
      </PetpalSection>

      <PetpalSection title="会话列表">
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '未读', value: 'UNREAD', badge: conversations.filter(item => item.summary.unread > 0).length },
            { label: '全部', value: 'ALL', badge: conversations.length },
          ]"
        />
      </PetpalSection>

      <PetpalSection :title="filter === 'UNREAD' ? '未读会话' : '全部会话'" subtitle="这里不堆聊天气泡，只保留摘要和入口。">
        <template v-if="visibleRows.length">
          <button
            v-for="item in visibleRows"
            :key="item.order.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openOrderDetailPage(item.order.id, 'chat')"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.order.orderNo }}</text>
              <text class="petpal-row__meta">{{ item.summary.preview }}</text>
              <text class="petpal-row__hint">{{ item.summary.meta }}</text>
            </view>
            <text class="petpal-row__value">{{ item.summary.unread ? `${item.summary.unread} 未读` : '继续聊' }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="当前没有会话" description="等订单产生沟通后，会显示在这里。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
