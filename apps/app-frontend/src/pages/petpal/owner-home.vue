<script setup lang="ts">
import type { MatchedCaregiverRecord, OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref, watch } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { storeToRefs } from 'pinia'
import { listOrders, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import {
  buildOwnerMatchQuery,
  describeCaregiverCapability,
  describeCaregiverMatch,
  describeConversation,
  describeOrder,
  describePet,
  describePetCare,
  helpers,
  initials,
  openLoginPage,
  openOrderDetailPage,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
  PETPAL_REQUEST_PAGE,
  stopPullDown,
} from './rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { userInfo } = storeToRefs(userStore)

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const matchRows = ref<MatchedCaregiverRecord[]>([])
const selectedPetId = ref('')

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || '主人')
const selectedPet = computed(() => pets.value.find(item => item.id === selectedPetId.value) ?? pets.value[0] ?? null)
const activeRequest = computed(() => {
  return [...requests.value]
    .filter(item => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null
})
const upcomingOrders = computed(() => {
  return [...orders.value]
    .filter(item => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus))
    .sort((left, right) => new Date(left.appointmentStart).getTime() - new Date(right.appointmentStart).getTime())
})
const aftersalesCount = computed(() => orders.value.filter(item => ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(item.orderStatus)).length)

async function loadMatches() {
  if (!tokenStore.hasLogin || !selectedPet.value) {
    matchRows.value = []
    return
  }

  try {
    const page = await matchCaregivers(buildOwnerMatchQuery({
      petSpecies: selectedPet.value.species,
      serviceType: activeRequest.value?.serviceType || 'BOARDING',
      city: activeRequest.value?.locationText || undefined,
      pageSize: 4,
    }))
    matchRows.value = page.items
  }
  catch {
    matchRows.value = []
  }
}

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

    const [petsResult, requestsResult, ordersResult] = await Promise.allSettled([
      listPets(),
      listServiceRequests(),
      listOrders(),
    ])

    pets.value = petsResult.status === 'fulfilled' ? petsResult.value : []
    requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : []
    orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value : []

    if (!selectedPetId.value || !pets.value.some(item => item.id === selectedPetId.value)) {
      selectedPetId.value = activeRequest.value?.petId || pets.value[0]?.id || ''
    }

    await loadMatches()
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function openPets() {
  uni.navigateTo({ url: PETPAL_PETS_PAGE })
}

function openCreateRequest(petId?: string) {
  const suffix = petId ? `?petId=${petId}` : ''
  uni.navigateTo({ url: `${PETPAL_REQUEST_PAGE}${suffix}` })
}

function openRequestDetail(requestId: string) {
  uni.navigateTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${requestId}` })
}

function openMessages() {
  uni.switchTab({ url: PETPAL_MESSAGES_PAGE })
}

function openAftersales() {
  uni.navigateTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openPay(orderId: string) {
  uni.navigateTo({ url: `/pages/petpal/checkout?orderId=${orderId}` })
}

watch(selectedPetId, () => {
  void loadMatches()
})

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage
    title="主人首页"
    :subtitle="tokenStore.hasLogin ? '先确认宠物，再新建需求；需求、订单、售后全部独立分流。' : '登录后才能查看宠物、需求和订单。'"
    eyebrow="Owner"
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
        <PetpalEmpty title="还没有主人数据" description="登录后会自动拉取宠物档案、需求和订单。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
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
              <text class="petpal-note">今天先处理一件事：维护宠物档案，或直接发需求。</text>
            </view>
          </view>
          <button class="petpal-icon-btn" hover-class="none" @click="openMessages">消息</button>
        </view>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreateRequest(selectedPet?.id)">新建需求</button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openPets">宠物档案</button>
        </view>
      </PetpalSection>

      <PetpalSection title="先选宠物" subtitle="只显示你现在要操作的宠物，避免列表过长。">
        <template v-if="pets.length">
          <view class="petpal-chip-row">
            <button
              v-for="pet in pets"
              :key="pet.id"
              :class="['petpal-chip', selectedPetId === pet.id ? 'petpal-chip--active' : '']"
              hover-class="none"
              @click="selectedPetId = pet.id"
            >
              {{ pet.name }}
            </button>
          </view>
          <view v-if="selectedPet" class="petpal-banner">
            <text class="petpal-banner__title">{{ selectedPet.name }}</text>
            <text class="petpal-banner__meta">{{ describePet(selectedPet) }}</text>
            <text class="petpal-note">{{ describePetCare(selectedPet) }}</text>
          </view>
        </template>
        <PetpalEmpty v-else title="还没有宠物档案" description="先补一只宠物，后续所有需求都能直接复用。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openPets">去建档</button>
        </PetpalEmpty>
      </PetpalSection>

      <PetpalSection title="正在流转的需求" subtitle="需求单独成页，避免和订单混在一起。">
        <template v-if="activeRequest">
          <button class="petpal-row-btn" hover-class="none" @click="openRequestDetail(activeRequest.id)">
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ helpers.serviceTypeLabels[activeRequest.serviceType] }} · {{ activeRequest.pet?.name || '宠物' }}</text>
              <text class="petpal-row__meta">{{ helpers.getRequestStatusLabel(activeRequest.status) }} · {{ helpers.formatRange(activeRequest.startTime, activeRequest.endTime) }}</text>
              <text class="petpal-row__hint">{{ activeRequest.locationText }} · 预算 {{ helpers.formatMoney(activeRequest.budgetAmount) }}</text>
            </view>
            <text class="petpal-row__value">查看</text>
          </button>
        </template>
        <PetpalEmpty v-else title="没有进行中的需求" description="发起新需求后，匹配和下单会拆到后续页面继续处理。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openCreateRequest(selectedPet?.id)">现在新建</button>
        </PetpalEmpty>
      </PetpalSection>

      <PetpalSection title="接下来要看的订单" :subtitle="aftersalesCount ? `另有 ${aftersalesCount} 笔售后单已从普通订单中分流` : '订单里只保留履约本身，售后另进售后中心。'">
        <template v-if="upcomingOrders.length">
          <button
            v-for="item in upcomingOrders.slice(0, 3)"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openOrderDetailPage(item.id)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.orderNo }}</text>
              <text class="petpal-row__meta">{{ describeOrder(item) }}</text>
              <text class="petpal-row__hint">{{ describeConversation(item, 'owner').meta }}</text>
            </view>
            <text class="petpal-row__value">{{ describeConversation(item, 'owner').unread ? `${describeConversation(item, 'owner').unread} 未读` : '进入' }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="暂时没有待处理订单" description="成单后才会出现在这里；需要售后时请直接进入售后中心。">
          <view class="petpal-action-row">
            <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openAftersales">售后中心</button>
          </view>
        </PetpalEmpty>
      </PetpalSection>

      <PetpalSection title="可直接下单的照料者" subtitle="不堆叠大卡片，只保留最关键的价格、距离和能力。">
        <template v-if="matchRows.length">
          <button
            v-for="item in matchRows"
            :key="item.serviceId"
            class="petpal-row-btn"
            hover-class="none"
            @click="activeRequest ? openRequestDetail(activeRequest.id) : openCreateRequest(selectedPet?.id)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.caregiverName }}</text>
              <text class="petpal-row__meta">{{ describeCaregiverMatch(item) }}</text>
              <text class="petpal-row__hint">{{ describeCaregiverCapability(item) }}</text>
            </view>
            <text class="petpal-row__value">{{ helpers.formatScore(item.ratingAvg) }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="当前没有匹配建议" description="补齐宠物和时间后，系统会给你更准确的照料者列表。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openCreateRequest(selectedPet?.id)">去补需求</button>
        </PetpalEmpty>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreateRequest(selectedPet?.id)">新建需求</button>
          <button
            v-if="upcomingOrders[0] && upcomingOrders[0].orderStatus === 'PENDING_ACCEPT'"
            class="petpal-btn petpal-btn--ghost"
            hover-class="none"
            @click="openPay(upcomingOrders[0].id)"
          >
            继续支付
          </button>
          <button v-else class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openMessages">回消息</button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
