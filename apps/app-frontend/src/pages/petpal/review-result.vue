<script setup lang="ts">
import type { OrderDetailRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { getOrderDetail } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { getErrorMessage, getOwnerOrderFilterForOrder, openLoginPage, openOrderDetailPage, openOrderReviewPage, openPetPalOrdersPage, stopPullDown, toast } from './rebuild/shared'

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
    toast(getErrorMessage(error, '加载评价结果失败'))
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

function returnToOrders() {
  if (!order.value) return
  openPetPalOrdersPage({
    filter: getOwnerOrderFilterForOrder(order.value),
    focusOrderId: order.value.id,
  })
}
</script>

<template>
  <PetpalPage title="评价结果" subtitle="评价完成后只保留结果摘要和后续动作。" eyebrow="Review" back :back-url="'/pages/petpal/orders'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="order">
      <view class="petpal-result-hero">
        <view :class="['petpal-result-hero__tone', order.review ? 'petpal-result-hero__tone--success' : 'petpal-result-hero__tone--accent']">
          {{ order.review ? '评' : '待' }}
        </view>
        <text class="petpal-result-hero__title">{{ order.review ? '评价已提交' : '还没有评价' }}</text>
        <text class="petpal-result-hero__summary">{{ order.review ? `${order.review.rating} 星 · ${order.review.tags.join(' / ') || '无标签'}` : '可以回到评价页继续补充评分和文字。' }}</text>
      </view>

      <PetpalSection v-if="order.review" title="评价内容" :subtitle="order.review.content || '未填写文字评价'">
        <view class="petpal-tag-row">
          <text v-for="tag in order.review.tags" :key="tag" class="petpal-mini-tag">{{ tag }}</text>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button
            class="petpal-btn petpal-btn--primary"
            hover-class="none"
            @click="order.review ? returnToOrders() : openOrderReviewPage(order.id)"
          >
            {{ order.review ? '回订单列表' : '去评价' }}
          </button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(order.id, 'overview', 'review-result')">
            回订单详情
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
