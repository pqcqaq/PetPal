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
      <PetpalSection tone="accent" title="先给这次服务一个总体判断" subtitle="评分决定整体印象，标签和补充说明再往下细化。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="score in [5, 4, 3, 2, 1]"
            :key="score"
            :class="['petpal-choice-tile', form.rating === score ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.rating = score"
          >
            <text class="petpal-choice-tile__eyebrow">Rating</text>
            <text class="petpal-choice-tile__title">{{ score }} 星</text>
            <text class="petpal-choice-tile__hint">{{ form.rating === score ? '当前评分' : '选择这个评分' }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="评价标签" subtitle="只选真正影响复购判断的标签，不堆冗余标签墙。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="tag in reviewTagOptions"
            :key="tag"
            :class="['petpal-choice-tile', form.tags.includes(tag) ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.tags = toggleTagValue(form.tags, tag)"
          >
            <text class="petpal-choice-tile__eyebrow">Tag</text>
            <text class="petpal-choice-tile__title">{{ tag }}</text>
            <text class="petpal-choice-tile__hint">{{ form.tags.includes(tag) ? '当前已选' : '点击添加到本次评价' }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="补充说明" subtitle="补充沟通体验、照料过程和是否愿意再次预约。">
        <textarea v-model="form.content" class="petpal-textarea" :maxlength="220" placeholder="可以补充照料过程、沟通体验和是否愿意再次预约" />
        <view class="petpal-choice-grid">
          <button
            :class="['petpal-choice-tile', form.isAnonymous ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.isAnonymous = !form.isAnonymous"
          >
            <text class="petpal-choice-tile__eyebrow">Privacy</text>
            <text class="petpal-choice-tile__title">{{ form.isAnonymous ? '匿名评价' : '实名评价' }}</text>
            <text class="petpal-choice-tile__hint">{{ form.isAnonymous ? '评价结果中不会展示你的身份' : '评价会关联当前账号身份' }}</text>
          </button>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">提交后会进入独立结果页，不会在当前页继续叠加订单和售后动作。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="submitting" @click="submitReview">
            {{ submitting ? '提交中...' : '提交评价' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
