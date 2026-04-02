<script setup lang="ts">
import type { OrderRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { listOrders } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import PetpalSegmented from './rebuild/petpal-segmented.vue'
import { consumePetPalOrdersPageContext, describeConversation, describeOrder, getOwnerOrderFilterForOrder, openLoginPage, openOrderDetailPage, PETPAL_AFTERSALES_PAGE, PETPAL_CHECKOUT_PAGE, stopPullDown } from './rebuild/shared'

type FilterValue = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'AFTERSALES'

const tokenStore = useTokenStore()
const loading = ref(false)
const filter = ref<FilterValue>('ALL')
const focusOrderId = ref('')
const orders = ref<OrderRecord[]>([])

const filterOptions = computed(() => {
  const counts = {
    ALL: orders.value.length,
    ACTIVE: orders.value.filter(item => getOwnerOrderFilterForOrder(item) === 'ACTIVE').length,
    COMPLETED: orders.value.filter(item => getOwnerOrderFilterForOrder(item) === 'COMPLETED').length,
    AFTERSALES: orders.value.filter(item => getOwnerOrderFilterForOrder(item) === 'AFTERSALES').length,
  }
  return [
    { label: '全部', value: 'ALL', badge: counts.ALL },
    { label: '进行中', value: 'ACTIVE', badge: counts.ACTIVE },
    { label: '已完成', value: 'COMPLETED', badge: counts.COMPLETED },
    { label: '售后', value: 'AFTERSALES', badge: counts.AFTERSALES },
  ]
})

const visibleOrders = computed(() => {
  const rows = [...orders.value].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  const filtered = rows.filter((item) => filter.value === 'ALL' || getOwnerOrderFilterForOrder(item) === filter.value)
  if (!focusOrderId.value) {
    return filtered
  }
  return [...filtered].sort((left, right) => (left.id === focusOrderId.value ? -1 : right.id === focusOrderId.value ? 1 : 0))
})

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    orders.value = await listOrders()
    const context = consumePetPalOrdersPageContext()
    if (context?.filter) {
      filter.value = context.filter
    }
    focusOrderId.value = context?.focusOrderId || ''
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openAftersales() {
  uni.navigateTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openPay(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_CHECKOUT_PAGE}?orderId=${orderId}` })
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
    title="订单"
    subtitle="订单页只保留履约和付款，售后已经拆到售后中心。"
    eyebrow="Orders"
    :with-tabbar="true"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看订单">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection title="筛选订单">
        <PetpalSegmented v-model="filter" :options="filterOptions" />
      </PetpalSection>

      <PetpalSection :title="filter === 'AFTERSALES' ? '售后相关订单' : '订单列表'" :subtitle="focusOrderId ? '已把你刚关注的订单顶到前面。' : '查看、支付、沟通分别进入对应页面。'">
        <template v-if="visibleOrders.length">
          <view v-for="item in visibleOrders" :key="item.id" class="petpal-stack">
            <button class="petpal-row-btn" hover-class="none" @click="openOrderDetailPage(item.id)">
              <view class="petpal-row__copy">
                <text class="petpal-row__title">{{ item.orderNo }}</text>
                <text class="petpal-row__meta">{{ describeOrder(item) }}</text>
                <text class="petpal-row__hint">{{ describeConversation(item, 'owner').preview }}</text>
              </view>
              <text class="petpal-row__value">{{ describeConversation(item, 'owner').unread ? `${describeConversation(item, 'owner').unread} 未读` : '详情' }}</text>
            </button>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(item.id)">查看</button>
              <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="openOrderDetailPage(item.id, 'chat')">沟通</button>
              <button
                v-if="item.orderStatus === 'PENDING_ACCEPT'"
                class="petpal-btn petpal-btn--primary"
                hover-class="none"
                @click="openPay(item.id)"
              >
                继续支付
              </button>
              <button
                v-else-if="getOwnerOrderFilterForOrder(item) === 'AFTERSALES'"
                class="petpal-btn petpal-btn--secondary"
                hover-class="none"
                @click="openAftersales"
              >
                处理售后
              </button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="当前筛选下没有订单" description="切换筛选看看，或者回到首页发起新的需求。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="filter = 'ALL'">查看全部</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
