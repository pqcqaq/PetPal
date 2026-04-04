<script setup lang="ts">
import type { OrderDetailRecord, OrderRefundProgressRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderComplaints, getOrderDetail, getOrderRefundProgress } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { getErrorMessage, helpers, openLoginPage, openOrderComplaintPage, openOrderDetailPage, openPetPalAftersalesPage, PETPAL_COMPLAINT_RESULT_PAGE, stopPullDown, toast } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const refundProgress = ref<OrderRefundProgressRecord | null>(null)
const complaintCount = ref(0)

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !orderId.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    const [orderResult, refundResult, complaintsResult] = await Promise.all([
      getOrderDetail(orderId.value),
      getOrderRefundProgress(orderId.value),
      getOrderComplaints(orderId.value),
    ])
    order.value = orderResult
    refundProgress.value = refundResult
    complaintCount.value = complaintsResult.length
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载退款结果失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

onLoad((options) => {
  orderId.value = options?.orderId || options?.id || ''
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})

function returnToAftersales() {
  if (!order.value || !refundProgress.value) return
  openPetPalAftersalesPage({
    focusOrderId: order.value.id,
    filter: refundProgress.value.stage === 'REJECTED' || refundProgress.value.stage === 'FAILED'
      ? 'HIGH'
      : complaintCount.value > 0
        ? 'COMPLAINT'
        : 'REFUND',
  })
}

function openComplaintResult(orderId: string) {
  uni.navigateTo({ url: `${PETPAL_COMPLAINT_RESULT_PAGE}?orderId=${orderId}` })
}
</script>

<template>
  <PetpalPage title="退款结果" subtitle="退款进度单独看，不再混在普通订单信息里。" eyebrow="Refund" back :back-url="'/pages/petpal/aftersales'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="refundProgress && order">
      <view class="petpal-result-hero">
        <view :class="['petpal-result-hero__tone', refundProgress.stage === 'FULL_SUCCESS' ? 'petpal-result-hero__tone--success' : refundProgress.stage === 'REJECTED' || refundProgress.stage === 'FAILED' ? 'petpal-result-hero__tone--danger' : 'petpal-result-hero__tone--warning']">
          {{ refundProgress.stage === 'FULL_SUCCESS' ? '退' : '进' }}
        </view>
        <text class="petpal-result-hero__title">{{ helpers.getRefundProgressStageLabel(refundProgress.stage) }}</text>
        <text class="petpal-result-hero__summary">{{ helpers.getRefundProgressStageHint(refundProgress.stage) }}</text>
      </view>

      <PetpalSection title="退款摘要">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">已退金额</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(refundProgress.settledRefundAmount) }}</text>
            <text class="petpal-stat__meta">可退余额 {{ helpers.formatMoney(refundProgress.refundableBalance) }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">退款次数</text>
            <text class="petpal-stat__value">{{ refundProgress.totalRefundCount }}</text>
            <text class="petpal-stat__meta">投诉 {{ complaintCount }} 条</text>
          </view>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="returnToAftersales">回售后队列</button>
          <button
            v-if="complaintCount > 0"
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="openComplaintResult(order.id)"
          >
            查看投诉结果
          </button>
          <button
            v-else-if="refundProgress.stage === 'REJECTED' || refundProgress.stage === 'FAILED'"
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="openOrderComplaintPage(order.id)"
          >
            继续投诉
          </button>
          <button
            v-else
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="openOrderDetailPage(order.id, 'aftersales')"
          >
            回订单售后
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
