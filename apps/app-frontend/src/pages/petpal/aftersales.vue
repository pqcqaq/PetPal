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
import { describeOrder, helpers, isOrderAftersalesTracked, openLoginPage, openOrderDetailPage, stopPullDown } from './rebuild/shared'

type FilterValue = 'ALL' | 'REFUND' | 'DISPUTE'

const tokenStore = useTokenStore()
const loading = ref(false)
const filter = ref<FilterValue>('ALL')
const orders = ref<OrderRecord[]>([])

const refundCount = computed(() => orders.value.filter(item => (item.refunds?.length ?? 0) > 0 || Number(item.amountRefunded ?? 0) > 0).length)
const disputeCount = computed(() => orders.value.filter(item => item.orderStatus === 'DISPUTED').length)

const aftersalesOrders = computed(() => {
  const rows = orders.value.filter(item => isOrderAftersalesTracked(item))

  return rows.filter((item) => {
    if (filter.value === 'REFUND') {
      return (item.refunds?.length ?? 0) > 0 || Number(item.amountRefunded ?? 0) > 0
    }
    if (filter.value === 'DISPUTE') {
      return item.orderStatus === 'DISPUTED'
    }
    return true
  })
})

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    orders.value = await listOrders()
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openRefund(orderId: string) {
  uni.navigateTo({ url: `/pages/petpal/refund-result?orderId=${orderId}` })
}

function openComplaint(orderId: string) {
  uni.navigateTo({ url: `/pages/petpal/complaint-result?orderId=${orderId}` })
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
    title="售后中心"
    subtitle="退款、投诉、争议从普通订单里拆出来单独处理。"
    eyebrow="Aftersales"
    back
    :back-url="'/pages/petpal/orders'"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看售后订单">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="danger" title="售后总览" :subtitle="aftersalesOrders.length ? `当前有 ${aftersalesOrders.length} 笔售后相关订单` : '当前没有售后订单'">
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">退款相关</text>
            <text class="petpal-stat__value">{{ refundCount }}</text>
            <text class="petpal-stat__meta">含部分退款</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">争议中</text>
            <text class="petpal-stat__value">{{ disputeCount }}</text>
            <text class="petpal-stat__meta">需继续处理</text>
          </view>
        </view>
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '全部', value: 'ALL', badge: orders.filter(item => isOrderAftersalesTracked(item)).length },
            { label: '退款', value: 'REFUND', badge: refundCount },
            { label: '争议', value: 'DISPUTE', badge: disputeCount },
          ]"
        />
      </PetpalSection>

      <PetpalSection title="售后订单列表" subtitle="每笔售后只给三个入口：看详情、看退款、看投诉。">
        <template v-if="aftersalesOrders.length">
          <view v-for="item in aftersalesOrders" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">{{ item.orderStatus === 'DISPUTED' ? 'Dispute' : 'Refund' }}</text>
            <text class="petpal-banner__title">{{ item.orderNo }}</text>
            <text class="petpal-banner__meta">{{ describeOrder(item) }}</text>
            <text class="petpal-note">已退款 {{ helpers.formatMoney(item.amountRefunded) }} · 退款记录 {{ item.refunds.length }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(item.id, 'aftersales')">订单售后</button>
              <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="openRefund(item.id)">退款进度</button>
              <button class="petpal-btn petpal-btn--danger" hover-class="none" @click="openComplaint(item.id)">投诉结果</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="当前没有售后事项" description="如果订单产生退款或争议，会在这里集中处理。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
