<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverServiceRecord, OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { getCaregiverProfile, listCaregiverOrders, listCaregiverServices, listOrders, listPets, listServiceRequests } from '@/api/petpal'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { helpers, initials, isCaregiverEnabled, openLoginPage, openRoleHome, PETPAL_NOTIFICATIONS_PAGE, PETPAL_REMINDERS_PAGE, REGISTER_PAGE, roleSummary, stopPullDown } from './rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)
const { unreadCount, unreadHighPriorityCount } = storeToRefs(notificationStore)

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const ownerOrders = ref<OrderRecord[]>([])
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrderCount = ref(0)

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || 'PetPal 用户')
const ownerNextAction = computed(() => {
  if (!pets.value.length) return '先建立宠物档案'
  const activeRequest = requests.value.find(item => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status))
  if (activeRequest) return '回看正在流转的需求'
  return '新建一次照料需求'
})
const caregiverNextAction = computed(() => {
  if (!caregiverProfile.value) return '先建立照料者档案'
  if (!caregiverServices.value.some(item => item.isActive)) return '先上架一个服务'
  if (caregiverOrderCount.value > 0) return '处理待履约订单'
  return '继续保持服务在线'
})

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      tokenStore.bootstrap(),
      userStore.fetchUserInfo().catch(() => undefined),
      notificationStore.refreshNotifications().catch(() => undefined),
    ])

    const [
      petsResult,
      requestsResult,
      ownerOrdersResult,
      caregiverProfileResult,
      caregiverServicesResult,
      caregiverOrdersResult,
    ] = await Promise.allSettled([
      listPets(),
      listServiceRequests(),
      listOrders(),
      getCaregiverProfile(),
      listCaregiverServices(),
      listCaregiverOrders({ page: 1, pageSize: 20 }),
    ])

    pets.value = petsResult.status === 'fulfilled' ? petsResult.value : []
    requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : []
    ownerOrders.value = ownerOrdersResult.status === 'fulfilled' ? ownerOrdersResult.value : []
    caregiverProfile.value = caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null
    caregiverServices.value = caregiverServicesResult.status === 'fulfilled' ? caregiverServicesResult.value : []
    caregiverOrderCount.value = caregiverOrdersResult.status === 'fulfilled' ? caregiverOrdersResult.value.pagination.total : 0
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openReminders() {
  uni.navigateTo({ url: PETPAL_REMINDERS_PAGE })
}

function goToRegister() {
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
    title="选择你现在要做的事"
    :subtitle="tokenStore.hasLogin ? '主人和照料者入口都保留，但每个入口只做一件事，避免混在同一页里。' : '先登录后再进入主人或照料者主流程。'"
    eyebrow="PetPal"
  >
    <template #bar>
      <button
        v-if="tokenStore.hasLogin"
        class="petpal-icon-btn"
        hover-class="none"
        @click="openNotifications"
      >
        通知 {{ unreadCount }}
      </button>
    </template>

    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="先登录" subtitle="登录后会自动恢复你上次的主人和照料者数据。">
        <PetpalEmpty title="当前未登录" description="没有登录态时，不展示冗长介绍，只保留两个入口动作。">
          <view class="petpal-action-row">
            <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
            <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="goToRegister">注册账号</button>
          </view>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent">
        <view class="petpal-inline">
          <view class="petpal-inline" style="justify-content: flex-start;">
            <view class="petpal-avatar-badge">{{ initials(displayName) }}</view>
            <view class="petpal-stack" style="gap: 6rpx;">
              <text class="petpal-banner__title">{{ displayName }}</text>
              <text class="petpal-note">{{ roleSummary(userInfo) }}</text>
            </view>
          </view>
          <button class="petpal-icon-btn" hover-class="none" @click="openReminders">
            待办 {{ unreadHighPriorityCount }}
          </button>
        </view>
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">主人侧</text>
            <text class="petpal-stat__value">{{ pets.length }}/{{ ownerOrders.length }}</text>
            <text class="petpal-stat__meta">宠物档案 / 订单数</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">照料者侧</text>
            <text class="petpal-stat__value">{{ caregiverServices.length }}/{{ caregiverOrderCount }}</text>
            <text class="petpal-stat__meta">服务数 / 订单数</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="主人入口" :subtitle="ownerNextAction">
        <button class="petpal-row-btn" hover-class="none" @click="openRoleHome('owner')">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">进入主人首页</text>
            <text class="petpal-row__meta">宠物、需求、下单、消息、售后都从这里分流。</text>
          </view>
          <text class="petpal-row__value">打开</text>
        </button>
        <view class="petpal-tag-row">
          <text class="petpal-pill petpal-pill--accent">宠物 {{ pets.length }}</text>
          <text class="petpal-pill">需求 {{ requests.length }}</text>
          <text class="petpal-pill">订单 {{ ownerOrders.length }}</text>
        </view>
      </PetpalSection>

      <PetpalSection title="照料者入口" :subtitle="caregiverNextAction">
        <button class="petpal-row-btn" hover-class="none" @click="openRoleHome('caregiver')">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">进入照料者首页</text>
            <text class="petpal-row__meta">审核、服务、接单、履约、收益会拆成独立流转。</text>
          </view>
          <text class="petpal-row__value">打开</text>
        </button>
        <view class="petpal-tag-row">
          <text :class="['petpal-pill', caregiverProfile ? 'petpal-pill--success' : 'petpal-pill--warning']">
            {{ caregiverProfile ? helpers.getCaregiverAuditLabel(caregiverProfile.auditStatus) : '未建档' }}
          </text>
          <text class="petpal-pill">服务 {{ caregiverServices.length }}</text>
          <text class="petpal-pill">订单 {{ caregiverOrderCount }}</text>
          <text v-if="isCaregiverEnabled(userInfo)" class="petpal-pill petpal-pill--accent">已开通照料者角色</text>
        </view>
      </PetpalSection>

      <PetpalSection title="当前最急的事" subtitle="保持简洁，只放任务，不放说明文案。">
        <button class="petpal-row-btn" hover-class="none" @click="openReminders">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">打开提醒中心</text>
            <text class="petpal-row__hint">这里集中收口高优先通知和待处理订单。</text>
          </view>
          <text class="petpal-row__value">{{ unreadCount }} 条</text>
        </button>
        <button class="petpal-row-btn" hover-class="none" @click="openNotifications">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">查看全部通知</text>
            <text class="petpal-row__hint">包括资料、需求、未读沟通和售后提醒。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
