<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverServiceRecord, OrderRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getCaregiverProfile, listCaregiverOrders, listCaregiverServices } from '@/api/petpal'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { helpers, initials, openLoginPage, openOrderDetailPage, PETPAL_CAREGIVER_EARNINGS_PAGE, PETPAL_CAREGIVER_ORDERS_PAGE, PETPAL_CAREGIVER_PROFILE_PAGE, PETPAL_CAREGIVER_SERVICES_PAGE, PETPAL_NOTIFICATIONS_PAGE, stopPullDown } from './rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const loading = ref(false)
const profile = ref<CaregiverProfileRecord | null>(null)
const services = ref<CaregiverServiceRecord[]>([])
const orders = ref<OrderRecord[]>([])

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || '照料者')
const pendingOrders = computed(() => orders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT'))
const servingOrders = computed(() => orders.value.filter(item => item.orderStatus === 'SERVING'))

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    await notificationStore.refreshNotifications().catch(() => undefined)
    const [profileResult, servicesResult, ordersResult] = await Promise.allSettled([
      getCaregiverProfile(),
      listCaregiverServices(),
      listCaregiverOrders({ page: 1, pageSize: 20 }),
    ])
    profile.value = profileResult.status === 'fulfilled' ? profileResult.value : null
    services.value = servicesResult.status === 'fulfilled' ? servicesResult.value : []
    orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value.items : []
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openProfile() {
  uni.navigateTo({ url: PETPAL_CAREGIVER_PROFILE_PAGE })
}

function openOrders() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_ORDERS_PAGE })
}

function openServices() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_SERVICES_PAGE })
}

function openEarnings() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_EARNINGS_PAGE })
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="照料者首页" subtitle="接单、履约、收益分开处理，不再堆成一个大工作台。" eyebrow="Caregiver">
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
        <PetpalEmpty title="登录后查看照料者工作台">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent">
        <view class="petpal-inline">
          <view class="petpal-inline petpal-inline--start">
            <view class="petpal-avatar-badge">{{ initials(displayName) }}</view>
            <view class="petpal-stack petpal-stack--tight">
              <text class="petpal-banner__title">{{ displayName }}</text>
              <text class="petpal-note">{{ profile ? helpers.getCaregiverAuditLabel(profile.auditStatus) : '还未建立照料者档案' }}</text>
            </view>
          </view>
          <button class="petpal-icon-btn" hover-class="none" @click="openProfile">档案</button>
        </view>
        <view class="petpal-banner">
          <text class="petpal-banner__eyebrow">Current Focus</text>
          <text class="petpal-banner__title">
            {{ pendingOrders.length ? `先处理 ${pendingOrders.length} 笔待接单订单` : servingOrders.length ? `有 ${servingOrders.length} 笔服务中的订单需要持续回传` : '当前没有阻塞中的订单' }}
          </text>
          <text class="petpal-banner__meta">接单、服务设置、收益查看分别进入独立页面，不再混成一个大面板。</text>
        </view>
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">待接单</text>
            <text class="petpal-stat__value">{{ pendingOrders.length }}</text>
            <text class="petpal-stat__meta">优先处理</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">服务中</text>
            <text class="petpal-stat__value">{{ servingOrders.length }}</text>
            <text class="petpal-stat__meta">持续回传</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="进入工作区" subtitle="每个入口只处理一类动作，避免在同一页里切来切去。">
        <view class="petpal-choice-grid">
          <button class="petpal-choice-tile" hover-class="none" @click="openOrders">
            <text class="petpal-choice-tile__eyebrow">Orders</text>
            <text class="petpal-choice-tile__title">履约订单</text>
            <text class="petpal-choice-tile__meta">待接单 {{ pendingOrders.length }} / 服务中 {{ servingOrders.length }}</text>
            <text class="petpal-choice-tile__hint">处理接单、签到、签退和服务日志。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openServices">
            <text class="petpal-choice-tile__eyebrow">Services</text>
            <text class="petpal-choice-tile__title">服务管理</text>
            <text class="petpal-choice-tile__meta">当前 {{ services.length }} 项服务</text>
            <text class="petpal-choice-tile__hint">维护价格、通知时效和上架状态。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openEarnings">
            <text class="petpal-choice-tile__eyebrow">Earnings</text>
            <text class="petpal-choice-tile__title">收益表现</text>
            <text class="petpal-choice-tile__meta">查看收入、完成单量和近期表现</text>
            <text class="petpal-choice-tile__hint">收益页只看经营结果，不再夹杂订单操作。</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="最新待办订单" subtitle="这里只保留最关键的几笔。">
        <template v-if="pendingOrders.length || servingOrders.length">
          <button
            v-for="item in [...pendingOrders, ...servingOrders].slice(0, 4)"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openOrderDetailPage(item.id, 'service')"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.orderNo }}</text>
              <text class="petpal-row__meta">{{ helpers.getOrderStatusLabel(item.orderStatus) }} · {{ helpers.formatRange(item.appointmentStart, item.appointmentEnd) }}</text>
            </view>
            <text class="petpal-row__value">进入</text>
          </button>
        </template>
        <PetpalEmpty v-else title="当前没有待办订单" description="上架服务并通过审核后，这里会出现待接单和服务中订单。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
