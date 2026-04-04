<script setup lang="ts">
import type { ComplaintRecord, OrderDetailRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderComplaints, getOrderDetail } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { getComplaintTone, getErrorMessage, helpers, openLoginPage, openOrderComplaintPage, openOrderDetailPage, openPetPalAftersalesPage, stopPullDown, summarizeComplaint, toast } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const orderId = ref('')
const complaintId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])

const activeComplaint = computed(() => {
  if (complaintId.value) {
    return complaints.value.find(item => item.id === complaintId.value) ?? complaints.value[0] ?? null
  }
  return complaints.value[0] ?? null
})

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !orderId.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    const [orderResult, complaintsResult] = await Promise.all([
      getOrderDetail(orderId.value),
      getOrderComplaints(orderId.value),
    ])
    order.value = orderResult
    complaints.value = complaintsResult.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载投诉结果失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

onLoad((options) => {
  orderId.value = options?.orderId || options?.id || ''
  complaintId.value = options?.complaintId || ''
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})

function returnToAftersales() {
  if (!order.value || !activeComplaint.value) return
  openPetPalAftersalesPage({
    focusOrderId: order.value.id,
    filter: activeComplaint.value.status === 'PROCESSING' || activeComplaint.value.status === 'OPEN'
      ? 'HIGH'
      : 'COMPLAINT',
  })
}
</script>

<template>
  <PetpalPage title="投诉结果" subtitle="投诉页只看投诉本身，不再混进其他订单说明。" eyebrow="Complaint" back :back-url="'/pages/petpal/aftersales'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="activeComplaint && order">
      <view class="petpal-result-hero">
        <view :class="['petpal-result-hero__tone', `petpal-result-hero__tone--${getComplaintTone(activeComplaint.status)}`]">
          投
        </view>
        <text class="petpal-result-hero__title">{{ helpers.getComplaintStatusLabel(activeComplaint.status) }}</text>
        <text class="petpal-result-hero__summary">{{ activeComplaint.resultSummary || helpers.getComplaintStatusHint(activeComplaint.status) }}</text>
      </view>

      <PetpalSection title="最近一条投诉" :subtitle="activeComplaint.description">
        <view class="petpal-stack">
          <button
            v-for="item in complaints"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="complaintId = item.id"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.createdAt.slice(0, 10) }}</text>
              <text class="petpal-row__meta">{{ summarizeComplaint(item) }}</text>
              <text class="petpal-row__hint">{{ item.resultSummary || item.description }}</text>
            </view>
            <text class="petpal-row__value">{{ complaintId === item.id ? '当前' : '查看' }}</text>
          </button>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="returnToAftersales">回售后队列</button>
          <button
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="activeComplaint.status === 'REJECTED' ? openOrderComplaintPage(order.id) : openOrderDetailPage(order.id, 'aftersales', 'complaint-result', 'complaint-followup')"
          >
            {{ activeComplaint.status === 'REJECTED' ? '重新提交' : '回订单售后' }}
          </button>
        </view>
      </view>
    </template>

    <template v-else-if="!loading">
      <PetpalSection title="还没有投诉记录">
        <PetpalEmpty title="当前订单没有投诉结果" description="如果需要发起新的投诉，可从订单页进入。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderComplaintPage(orderId)">去投诉</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
