<script setup lang="ts">
import type { OrderDetailRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderDetail } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { getErrorMessage, getOwnerOrderFilterForOrder, helpers, openLoginPage, openOrderDetailPage, openPetPalOrdersPage, PETPAL_CHECKOUT_PAGE, stopPullDown, toast } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !orderId.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    order.value = await getOrderDetail(orderId.value)
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载支付结果失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function retryPay() {
  if (!order.value) return
  uni.redirectTo({ url: `${PETPAL_CHECKOUT_PAGE}?orderId=${order.value.id}` })
}

function returnToOrders() {
  if (!order.value) return
  openPetPalOrdersPage({
    filter: getOwnerOrderFilterForOrder(order.value),
    focusOrderId: order.value.id,
    detailReason: 'payment-followup',
  })
}

onLoad((options) => {
  orderId.value = options?.orderId || options?.id || ''
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="支付结果" subtitle="支付完成后，只保留结果和下一步动作。" eyebrow="Payment" back :back-url="'/pages/petpal/orders'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="order">
      <view class="petpal-result-hero">
        <view :class="['petpal-result-hero__tone', Number(order.amountPaid) > 0 ? 'petpal-result-hero__tone--success' : 'petpal-result-hero__tone--accent']">
          {{ Number(order.amountPaid) > 0 ? '成' : '待' }}
        </view>
        <text class="petpal-result-hero__title">{{ Number(order.amountPaid) > 0 ? '支付已完成' : '订单已生成，等待支付' }}</text>
        <text class="petpal-result-hero__summary">{{ order.orderNo }} · 已支付 {{ helpers.formatMoney(order.amountPaid) }} / 应付 {{ helpers.formatMoney(order.amountTotal) }}</text>
      </view>

      <PetpalSection title="订单摘要">
        <button class="petpal-row-btn" hover-class="none" @click="openOrderDetailPage(order.id, 'overview', 'payment-result', 'payment-followup')">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">{{ order.orderNo }}</text>
            <text class="petpal-row__meta">{{ helpers.getOrderStatusLabel(order.orderStatus) }} · {{ helpers.formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
          </view>
          <text class="petpal-row__value">查看</text>
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button
            v-if="Number(order.amountPaid) <= 0"
            class="petpal-btn petpal-btn--primary"
            hover-class="none"
            @click="retryPay"
          >
            继续支付
          </button>
          <button
            v-else
            class="petpal-btn petpal-btn--primary"
            hover-class="none"
            @click="returnToOrders"
          >
            回订单队列
          </button>
          <button
            v-if="Number(order.amountPaid) <= 0"
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="returnToOrders"
          >
            回订单队列
          </button>
          <button
            v-else
            class="petpal-btn petpal-btn--secondary"
            hover-class="none"
            @click="openOrderDetailPage(order.id, 'chat', 'payment-result', 'payment-followup')"
          >
            去沟通
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
