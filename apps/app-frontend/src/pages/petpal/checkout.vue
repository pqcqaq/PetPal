<script setup lang="ts">
import type { MatchedCaregiverRecord, OrderDetailRecord, OwnerPayChannel, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { createOwnerOrder, getOrderDetail, listServiceRequests, matchCaregivers, payOwnerOrder } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import {
  buildOwnerMatchQuery,
  describeCaregiverCapability,
  describeCaregiverMatch,
  getErrorMessage,
  helpers,
  openLoginPage,
  payChannelOptions,
  PETPAL_PAYMENT_RESULT_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
  stopPullDown,
  toast,
} from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const submitting = ref(false)

const requestId = ref('')
const caregiverServiceId = ref('')
const orderId = ref('')
const requestRecord = ref<ServiceRequestRecord | null>(null)
const order = ref<OrderDetailRecord | null>(null)
const caregiver = ref<MatchedCaregiverRecord | null>(null)
const payChannel = ref<OwnerPayChannel>('WECHAT_PAY')

const currentRequestId = computed(() => requestId.value || order.value?.serviceRequestId || '')

async function loadFromRequest() {
  if (!requestId.value) {
    return
  }

  const requests = await listServiceRequests()
  requestRecord.value = requests.find(item => item.id === requestId.value) ?? null

  if (!requestRecord.value) {
    return
  }

  const page = await matchCaregivers(buildOwnerMatchQuery({
    petSpecies: requestRecord.value.pet?.species || 'DOG',
    serviceType: requestRecord.value.serviceType,
    city: requestRecord.value.locationText || undefined,
    pageSize: 12,
  }))
  caregiver.value = page.items.find(item => item.serviceId === caregiverServiceId.value) ?? page.items[0] ?? null
  caregiverServiceId.value = caregiver.value?.serviceId || caregiverServiceId.value
}

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    if (orderId.value) {
      order.value = await getOrderDetail(orderId.value)
      requestId.value = order.value.serviceRequestId || requestId.value
    }

    await loadFromRequest()
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载结算页失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

async function submitPayment() {
  if (!tokenStore.hasLogin || submitting.value) {
    return
  }

  if (!order.value) {
    if (!requestRecord.value || !caregiver.value) {
      toast('请先确认需求和照料者')
      return
    }

    submitting.value = true
    try {
      order.value = await createOwnerOrder({
        requestId: requestRecord.value.id,
        caregiverServiceId: caregiver.value.serviceId,
      })
      orderId.value = order.value.id
    }
    catch (error: unknown) {
      submitting.value = false
      toast(getErrorMessage(error, '创建订单失败'))
      return
    }
  }

  submitting.value = true
  try {
    const paidOrder = await payOwnerOrder(order.value.id, { payChannel: payChannel.value })
    order.value = paidOrder
    uni.redirectTo({ url: `${PETPAL_PAYMENT_RESULT_PAGE}?orderId=${paidOrder.id}` })
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '支付失败'))
  }
  finally {
    submitting.value = false
  }
}

function backToRequest() {
  if (!currentRequestId.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${currentRequestId.value}` })
}

onLoad((options) => {
  requestId.value = options?.requestId || ''
  caregiverServiceId.value = options?.caregiverServiceId || ''
  orderId.value = options?.orderId || ''
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage
    title="确认支付"
    subtitle="这里只做结算，不混入需求编辑或订单售后。"
    eyebrow="Checkout"
    back
    :back-url="currentRequestId ? `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${currentRequestId}` : PETPAL_REQUEST_DETAIL_PAGE"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="!requestRecord && !order && !loading">
      <PetpalSection title="没有可结算的内容">
        <PetpalEmpty title="请先从需求详情页进入" description="结算页只接收已选好的需求和照料者。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="backToRequest">返回需求详情</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="本次服务" :subtitle="requestRecord ? helpers.serviceTypeLabels[requestRecord.serviceType] : '订单继续支付'">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">时间</text>
            <text class="petpal-stat__value">{{ requestRecord ? helpers.formatDateTime(requestRecord.startTime) : '--' }}</text>
            <text class="petpal-stat__meta">{{ requestRecord ? helpers.formatDateTime(requestRecord.endTime) : '订单时间同步中' }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">金额</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(order?.amountTotal || requestRecord?.budgetAmount) }}</text>
            <text class="petpal-stat__meta">{{ order ? order.orderNo : '将创建新订单' }}</text>
          </view>
        </view>
        <text class="petpal-note">{{ requestRecord?.locationText || '地点同步中' }}</text>
      </PetpalSection>

      <PetpalSection v-if="caregiver" title="你选择的照料者" subtitle="这里只保留即将成交的这一位。">
        <view class="petpal-banner">
          <text class="petpal-banner__title">{{ caregiver.caregiverName }}</text>
          <text class="petpal-banner__meta">{{ describeCaregiverMatch(caregiver) }}</text>
          <text class="petpal-note">{{ describeCaregiverCapability(caregiver) }}</text>
        </view>
      </PetpalSection>

      <PetpalSection title="支付方式" subtitle="支付行为单独处理，避免和其他逻辑混在一起。">
        <button
          v-for="item in payChannelOptions"
          :key="item.value"
          class="petpal-row-btn"
          hover-class="none"
          @click="payChannel = item.value"
        >
          <view class="petpal-row__copy">
            <text class="petpal-row__title">{{ item.label }}</text>
            <text class="petpal-row__hint">{{ item.note }}</text>
          </view>
          <text class="petpal-row__value">{{ payChannel === item.value ? '已选' : '选择' }}</text>
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="submitting" @click="submitPayment">
            {{ submitting ? '处理中...' : '确认支付' }}
          </button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="backToRequest">返回需求</button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
