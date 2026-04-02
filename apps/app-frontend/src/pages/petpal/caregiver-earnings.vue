<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverServiceRecord, OrderRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getCaregiverProfile, listCaregiverOrders, listCaregiverServices } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { helpers, openLoginPage, openOrderDetailPage, PETPAL_CAREGIVER_HOME_PAGE, stopPullDown } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const profile = ref<CaregiverProfileRecord | null>(null)
const services = ref<CaregiverServiceRecord[]>([])
const orders = ref<OrderRecord[]>([])

const completedOrders = computed(() => orders.value.filter(item => item.orderStatus === 'COMPLETED'))
const totalIncome = computed(() => completedOrders.value.reduce((total, item) => total + Number(item.amountPaid || 0), 0))
const averageIncome = computed(() => completedOrders.value.length ? totalIncome.value / completedOrders.value.length : 0)
const activeServiceCount = computed(() => services.value.filter(item => item.isActive).length)

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    const [profileResult, servicesResult, ordersResult] = await Promise.allSettled([
      getCaregiverProfile(),
      listCaregiverServices(),
      listCaregiverOrders({ page: 1, pageSize: 60 }),
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

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="收益表现" subtitle="收益页只看数据和近况，不混履约动作。" eyebrow="Earnings" back :back-url="PETPAL_CAREGIVER_HOME_PAGE">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看收益">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="收益总览" :subtitle="completedOrders.length ? `当前已完成 ${completedOrders.length} 笔订单` : '完成第一笔订单后，这里会开始累计收益'">
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">累计收入</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(totalIncome) }}</text>
            <text class="petpal-stat__meta">按已完成订单统计</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">完成单量</text>
            <text class="petpal-stat__value">{{ completedOrders.length }}</text>
            <text class="petpal-stat__meta">平均每单 {{ helpers.formatMoney(averageIncome) }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="档案与服务" subtitle="收益页只看表现，不混入履约动作。">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">评分</text>
            <text class="petpal-stat__value">{{ helpers.formatScore(profile?.ratingAvg) }}</text>
            <text class="petpal-stat__meta">评价数 {{ profile?.ratingCount || 0 }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">上架服务</text>
            <text class="petpal-stat__value">{{ activeServiceCount }}</text>
            <text class="petpal-stat__meta">全部服务 {{ services.length }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="最近完成的订单" subtitle="只保留已经形成收益的订单。">
        <template v-if="completedOrders.length">
          <view v-for="item in completedOrders.slice(0, 6)" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">Completed Order</text>
            <text class="petpal-banner__title">{{ item.orderNo }}</text>
            <text class="petpal-banner__meta">{{ helpers.formatMoney(item.amountPaid) }} · {{ helpers.formatRange(item.appointmentStart, item.appointmentEnd) }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(item.id)">查看订单</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="还没有完成订单" description="完成第一笔订单后，这里会开始累计你的收益表现。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
