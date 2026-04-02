<script setup lang="ts">
import type { OrderDetailRecord } from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getOrderDetail, reviewOrder } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { getErrorMessage, openLoginPage, PETPAL_REVIEW_RESULT_PAGE, reviewTagOptions, toggleTagValue, toast } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const orderId = ref('')
const loading = ref(false)
const submitting = ref(false)
const order = ref<OrderDetailRecord | null>(null)

const form = reactive({
  rating: 5,
  tags: [] as string[],
  content: '',
  isAnonymous: false,
})

const pageSubtitle = computed(() => order.value ? `${order.value.orderNo} · ${order.value.serviceType}` : '提交评价后会进入独立结果页。')

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !orderId.value) {
    return
  }
  loading.value = true
  try {
    order.value = await getOrderDetail(orderId.value)
    if (order.value.review) {
      form.rating = order.value.review.rating
      form.tags = [...order.value.review.tags]
      form.content = order.value.review.content || ''
      form.isAnonymous = order.value.review.isAnonymous
    }
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载评价页失败'))
  }
  finally {
    loading.value = false
  }
}

async function submitReview() {
  if (!tokenStore.hasLogin || submitting.value || !orderId.value) {
    return
  }
  submitting.value = true
  try {
    await reviewOrder(orderId.value, {
      rating: form.rating,
      tags: form.tags,
      content: form.content.trim() || undefined,
      isAnonymous: form.isAnonymous,
    })
    toast('评价已提交', 'success')
    uni.redirectTo({ url: `${PETPAL_REVIEW_RESULT_PAGE}?orderId=${orderId.value}` })
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '提交评价失败'))
  }
  finally {
    submitting.value = false
  }
}

onLoad((options) => {
  orderId.value = options?.id || options?.orderId || ''
  void loadPage()
})
</script>

<template>
  <PetpalPage title="订单评价" :subtitle="pageSubtitle" eyebrow="Review Form" back :back-url="orderId ? `/pages/order-detail/index?id=${orderId}` : '/pages/petpal/orders'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection title="评分">
        <view class="petpal-chip-row">
          <button
            v-for="score in [5, 4, 3, 2, 1]"
            :key="score"
            :class="['petpal-chip', form.rating === score ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="form.rating = score"
          >
            {{ score }} 星
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="标签">
        <view class="petpal-chip-row">
          <button
            v-for="tag in reviewTagOptions"
            :key="tag"
            :class="['petpal-chip', form.tags.includes(tag) ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="form.tags = toggleTagValue(form.tags, tag)"
          >
            {{ tag }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="补充评价">
        <textarea v-model="form.content" class="petpal-textarea" :maxlength="220" placeholder="可以补充照料过程、沟通体验和是否愿意再次预约" />
        <button
          :class="['petpal-chip', form.isAnonymous ? 'petpal-chip--active' : '']"
          hover-class="none"
          @click="form.isAnonymous = !form.isAnonymous"
        >
          {{ form.isAnonymous ? '匿名评价中' : '切换为匿名评价' }}
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="submitting" @click="submitReview">
            {{ submitting ? '提交中...' : '提交评价' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
