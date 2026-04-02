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
    title="现在先做哪件事"
    :subtitle="tokenStore.hasLogin ? '这里只做分流，不堆介绍，不混流程。先选身份，再进入对应工作区。' : '先登录，再进入主人或照料者的独立流程。'"
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
      <PetpalSection tone="accent" title="先恢复你的账号" subtitle="登录后自动恢复宠物、订单、服务和提醒。">
        <PetpalEmpty title="当前未登录" description="没有登录态时，不展示冗长介绍，只保留进入系统需要的两个动作。">
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
          <view class="petpal-inline petpal-inline--start">
            <view class="petpal-avatar-badge">{{ initials(displayName) }}</view>
            <view class="petpal-stack petpal-stack--tight">
              <text class="petpal-banner__title">{{ displayName }}</text>
              <text class="petpal-note">{{ roleSummary(userInfo) }}</text>
            </view>
          </view>
          <button class="petpal-icon-btn" hover-class="none" @click="openReminders">
            待办 {{ unreadHighPriorityCount }}
          </button>
        </view>
        <view class="petpal-banner">
          <text class="petpal-banner__eyebrow">Current Focus</text>
          <text class="petpal-banner__title">
            {{ unreadHighPriorityCount ? `先处理 ${unreadHighPriorityCount} 条高优先待办` : '当前没有高优先阻塞事项' }}
          </text>
          <text class="petpal-banner__meta">你可以直接进入主人流程或照料者流程，每个流程都只保留一条主线。</text>
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

      <PetpalSection title="进入工作流" subtitle="两个入口都保留，但只做各自该做的事。">
        <view class="petpal-choice-grid">
          <button class="petpal-choice-tile" hover-class="none" @click="openRoleHome('owner')">
            <text class="petpal-choice-tile__eyebrow">Owner</text>
            <text class="petpal-choice-tile__title">主人首页</text>
            <text class="petpal-choice-tile__meta">{{ ownerNextAction }}</text>
            <text class="petpal-choice-tile__hint">宠物、需求、下单、消息、售后从这里继续。</text>
          </button>
          <button class="petpal-choice-tile" hover-class="none" @click="openRoleHome('caregiver')">
            <text class="petpal-choice-tile__eyebrow">Caregiver</text>
            <text class="petpal-choice-tile__title">照料者首页</text>
            <text class="petpal-choice-tile__meta">{{ caregiverNextAction }}</text>
            <text class="petpal-choice-tile__hint">审核、服务、接单、履约、收益在独立页面处理。</text>
          </button>
        </view>
        <view class="petpal-tag-row">
          <text class="petpal-pill petpal-pill--accent">主人需求 {{ requests.length }}</text>
          <text class="petpal-pill">主人订单 {{ ownerOrders.length }}</text>
          <text :class="['petpal-pill', caregiverProfile ? 'petpal-pill--success' : 'petpal-pill--warning']">
            {{ caregiverProfile ? helpers.getCaregiverAuditLabel(caregiverProfile.auditStatus) : '照料者未建档' }}
          </text>
          <text class="petpal-pill">照料服务 {{ caregiverServices.length }}</text>
          <text v-if="isCaregiverEnabled(userInfo)" class="petpal-pill petpal-pill--accent">已开通照料者</text>
        </view>
      </PetpalSection>

      <PetpalSection title="统一收口" subtitle="提醒和通知是两个总入口，其余信息不再堆在这里。">
        <button class="petpal-row-btn" hover-class="none" @click="openReminders">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">打开提醒中心</text>
            <text class="petpal-row__hint">集中处理高优先通知、未完成订单和需要你确认的事项。</text>
          </view>
          <text class="petpal-row__value">{{ unreadCount }} 条</text>
        </button>
        <button class="petpal-row-btn" hover-class="none" @click="openNotifications">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">查看全部通知</text>
            <text class="petpal-row__hint">资料、需求、沟通、售后全部通知统一归档到这里。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
