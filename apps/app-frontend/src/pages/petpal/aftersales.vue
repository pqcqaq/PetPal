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
import {
  type AftersalesFilter,
  type PetPalOrderDetailEntryReason,
  consumePetPalAftersalesPageContext,
  describeOrder,
  helpers,
  isOrderAftersalesTracked,
  openLoginPage,
  openOrderDetailPage,
  openPetPalOrdersPage,
  PETPAL_COMPLAINT_RESULT_PAGE,
  PETPAL_REFUND_RESULT_PAGE,
  stopPullDown,
} from './rebuild/shared'

type FilterValue = AftersalesFilter

const tokenStore = useTokenStore()
const loading = ref(false)
const filter = ref<FilterValue>('ALL')
const focusOrderId = ref('')
const detailReason = ref<PetPalOrderDetailEntryReason | ''>('')
const orders = ref<OrderRecord[]>([])

function hasRefundSignal(order: OrderRecord) {
  return (order.refunds?.length ?? 0) > 0 || Number(order.amountRefunded ?? 0) > 0
}

function hasComplaintSignal(order: OrderRecord) {
  return order.orderStatus === 'DISPUTED'
}

function isHighPriorityAftersales(order: OrderRecord) {
  return hasComplaintSignal(order) || order.refunds.some(item => ['PENDING', 'FAILED', 'REJECTED'].includes(item.refundStatus))
}

const refundCount = computed(() => orders.value.filter(item => hasRefundSignal(item)).length)
const complaintCount = computed(() => orders.value.filter(item => hasComplaintSignal(item)).length)
const highPriorityCount = computed(() => orders.value.filter(item => isHighPriorityAftersales(item)).length)

const aftersalesOrders = computed(() => {
  const rows = orders.value
    .filter(item => isOrderAftersalesTracked(item))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())

  const filtered = rows.filter((item) => {
    if (filter.value === 'HIGH') {
      return isHighPriorityAftersales(item)
    }
    if (filter.value === 'REFUND') {
      return hasRefundSignal(item)
    }
    if (filter.value === 'COMPLAINT') {
      return hasComplaintSignal(item)
    }
    return true
  })

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
    const context = consumePetPalAftersalesPageContext()
    if (context?.filter) {
      filter.value = context.filter
    }
    focusOrderId.value = context?.focusOrderId || ''
    detailReason.value = context?.detailReason || ''
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openRefund(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_REFUND_RESULT_PAGE}?orderId=${orderId}` })
}

function openComplaint(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_COMPLAINT_RESULT_PAGE}?orderId=${orderId}` })
}

function getDetailReason(orderId: string) {
  return orderId === focusOrderId.value ? (detailReason.value || undefined) : undefined
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
            <text class="petpal-stat__label">优先处理</text>
            <text class="petpal-stat__value">{{ highPriorityCount }}</text>
            <text class="petpal-stat__meta">待跟进投诉或退款</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">投诉相关</text>
            <text class="petpal-stat__value">{{ complaintCount }}</text>
            <text class="petpal-stat__meta">争议订单</text>
          </view>
        </view>
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '全部', value: 'ALL', badge: orders.filter(item => isOrderAftersalesTracked(item)).length },
            { label: '优先', value: 'HIGH', badge: highPriorityCount },
            { label: '退款', value: 'REFUND', badge: refundCount },
            { label: '投诉', value: 'COMPLAINT', badge: complaintCount },
          ]"
        />
      </PetpalSection>

      <PetpalSection :title="filter === 'HIGH' ? '优先处理售后' : filter === 'COMPLAINT' ? '投诉相关订单' : filter === 'REFUND' ? '退款相关订单' : '售后订单列表'" :subtitle="focusOrderId ? '已把你刚处理的售后订单顶到前面。' : '每笔售后只给三个入口：看详情、看退款、看投诉。'">
        <template v-if="aftersalesOrders.length">
          <view v-for="item in aftersalesOrders" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">{{ item.id === focusOrderId ? 'Focus' : item.orderStatus === 'DISPUTED' ? 'Complaint' : isHighPriorityAftersales(item) ? 'High' : 'Refund' }}</text>
            <text class="petpal-banner__title">{{ item.orderNo }}</text>
            <text class="petpal-banner__meta">{{ describeOrder(item) }}</text>
            <text class="petpal-note">已退款 {{ helpers.formatMoney(item.amountRefunded) }} · 退款记录 {{ item.refunds.length }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(item.id, 'aftersales', 'aftersales', getDetailReason(item.id))">订单售后</button>
              <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="openRefund(item.id)">退款进度</button>
              <button class="petpal-btn petpal-btn--danger" hover-class="none" @click="openComplaint(item.id)">投诉结果</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="当前没有售后事项" description="如果订单产生退款或争议，会在这里集中处理。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openPetPalOrdersPage({ filter: 'ALL' })">回订单队列</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
