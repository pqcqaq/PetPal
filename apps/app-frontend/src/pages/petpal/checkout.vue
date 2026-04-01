<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已发布需求、准备选择照料者并支付的主人
 * Entry: 从发布需求页选人进入、从活跃需求继续结算进入，或从订单详情补支付进入
 * First screen: 先看到当前订单阶段、照料者、服务时间和应付金额
 * Primary action: 提交订单并支付，或对已有待支付订单直接完成支付
 * Secondary actions: 更换支付方式、返回需求页、进入订单详情
 * States: 未登录、参数缺失、订单创建中、待支付、支付完成、加载失败
 */
import type {
  MatchedCaregiverRecord,
  OrderDetailRecord,
  OwnerPayChannel,
  ServiceRequestRecord,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  createOwnerOrder,
  getOrderDetail,
  listServiceRequests,
  matchCaregivers,
  payOwnerOrder,
} from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  buildOwnerMatchQuery,
  formatAmount,
  formatRange,
  getRequestStatusLabel,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
  PETPAL_REQUEST_PAGE,
  serviceTypeLabels,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalCheckoutPage',
})

definePage({
  style: {
    navigationBarTitleText: '确认支付',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()

const loading = ref(false)
const creatingOrder = ref(false)
const paying = ref(false)
const error = ref('')

const requestId = ref('')
const caregiverServiceId = ref('')
const orderId = ref('')

const requestRecord = ref<ServiceRequestRecord | null>(null)
const caregiver = ref<MatchedCaregiverRecord | null>(null)
const order = ref<OrderDetailRecord | null>(null)
const payChannel = ref<OwnerPayChannel>('WECHAT_PAY')

const payChannelOptions = [
  { label: '微信支付', value: 'WECHAT_PAY', description: '最快完成当前订单支付' },
  { label: '支付宝', value: 'ALIPAY', description: '适合切换到支付宝付款' },
  { label: '平台余额', value: 'BALANCE', description: '从平台余额直接扣款' },
]

const estimatedUnits = computed(() => {
  if (!requestRecord.value || !caregiver.value) {
    return 0
  }

  const durationHours = Math.max(
    1,
    dayjs(requestRecord.value.endTime).diff(dayjs(requestRecord.value.startTime), 'minute') / 60,
  )
  const unitType = caregiver.value.unitType.trim().toUpperCase()

  if (unitType.includes('DAY')) {
    return Math.max(1, Math.ceil(durationHours / 24))
  }
  if (unitType.includes('HOUR')) {
    return Math.max(1, Math.ceil(durationHours))
  }
  if (unitType.includes('HALF')) {
    return Math.max(1, Math.ceil(durationHours / 12))
  }
  if (unitType.includes('VISIT') || unitType.includes('TIME') || unitType.includes('TRIP')) {
    return 1
  }
  if (requestRecord.value.serviceType === 'BOARDING') {
    return Math.max(1, Math.ceil(durationHours / 24))
  }
  return 1
})

const estimatedAmount = computed(() => {
  if (!caregiver.value) {
    return 0
  }
  return Number((Number(caregiver.value.pricePerUnit) * estimatedUnits.value).toFixed(2))
})

const totalAmount = computed(() => {
  if (order.value) {
    return Number(order.value.amountTotal) + Number(order.value.amountAdjusted)
  }
  return estimatedAmount.value
})

const outstandingAmount = computed(() => {
  if (!order.value) {
    return estimatedAmount.value
  }
  return Number(Math.max(0, totalAmount.value - Number(order.value.amountPaid)).toFixed(2))
})

const isOrderPaid = computed(() => Boolean(order.value && outstandingAmount.value <= 0))
const currentStageLabel = computed(() => {
  if (isOrderPaid.value) {
    return '支付完成'
  }
  if (order.value) {
    return '待支付'
  }
  return '确认订单'
})
const stageTagType = computed(() => {
  if (isOrderPaid.value) {
    return 'success'
  }
  if (order.value) {
    return 'warning'
  }
  return 'primary'
})
const primaryButtonLabel = computed(() => {
  if (isOrderPaid.value) {
    return '查看订单'
  }
  if (order.value) {
    return `立即支付 ¥${formatAmount(outstandingAmount.value)}`
  }
  return '提交订单'
})

async function resolveRequestContext() {
  if (!requestId.value) {
    return
  }

  const requests = await listServiceRequests()
  requestRecord.value = requests.find(item => item.id === requestId.value) ?? null

  if (!requestRecord.value) {
    throw new Error('需求不存在或已不可用')
  }

  const page = await matchCaregivers(buildOwnerMatchQuery({
    petSpecies: requestRecord.value.pet?.species,
    serviceType: requestRecord.value.serviceType,
    pageSize: 20,
  }))

  caregiver.value = page.items.find(item => item.serviceId === caregiverServiceId.value)
    ?? page.items.find(item => item.caregiverId === requestRecord.value?.matchedCaregiverId)
    ?? page.items[0]
    ?? null
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  error.value = ''
  try {
    if (orderId.value) {
      order.value = await getOrderDetail(orderId.value)
      requestId.value = order.value.serviceRequestId || requestId.value
    }

    if (requestId.value) {
      await resolveRequestContext()
    }

    if (!order.value && !requestId.value) {
      throw new Error('缺少结算参数')
    }

    if (!order.value && !caregiver.value) {
      throw new Error('当前需求还没有可用照料者')
    }
  }
  catch (cause: unknown) {
    error.value = getErrorMessage(cause, '加载结算页失败')
    if (showError) {
      uni.showToast({
        title: error.value,
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function createOrderAndStay() {
  if (order.value) {
    return order.value
  }
  if (!requestId.value || !caregiver.value) {
    uni.showToast({ title: '缺少需求或照料者信息', icon: 'none' })
    return null
  }

  creatingOrder.value = true
  try {
    order.value = await createOwnerOrder({
      requestId: requestId.value,
      caregiverServiceId: caregiver.value.serviceId,
    })
    orderId.value = order.value.id
    uni.showToast({ title: '订单已生成', icon: 'none' })
    return order.value
  }
  catch (cause: unknown) {
    uni.showToast({
      title: getErrorMessage(cause, '提交订单失败'),
      icon: 'none',
    })
    return null
  }
  finally {
    creatingOrder.value = false
  }
}

async function payNow() {
  const currentOrder = order.value ?? await createOrderAndStay()
  if (!currentOrder) {
    return
  }

  paying.value = true
  try {
    order.value = await payOwnerOrder(currentOrder.id, {
      payChannel: payChannel.value,
    })
    orderId.value = order.value.id
    uni.showToast({ title: '支付完成', icon: 'none' })
  }
  catch (cause: unknown) {
    uni.showToast({
      title: getErrorMessage(cause, '支付失败'),
      icon: 'none',
    })
  }
  finally {
    paying.value = false
  }
}

function handlePrimaryAction() {
  if (isOrderPaid.value && order.value) {
    uni.redirectTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${order.value.id}&tab=overview` })
    return
  }
  if (order.value) {
    void payNow()
    return
  }
  void createOrderAndStay()
}

function openOrderDetail() {
  if (!order.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${order.value.id}&tab=overview` })
}

function backToRequest() {
  const targetRequestId = requestId.value || order.value?.serviceRequestId || ''
  const url = targetRequestId
    ? `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${targetRequestId}`
    : PETPAL_REQUEST_PAGE
  uni.redirectTo({ url })
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

onLoad((options: Record<string, string | undefined>) => {
  requestId.value = options.requestId || ''
  caregiverServiceId.value = options.caregiverServiceId || ''
  orderId.value = options.orderId || ''
})

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="确认支付">
    <template v-if="tokenStore.hasLogin">
      <template v-if="loading">
        <AppSection title="同步状态">
          <AppStatus mode="loading" text="正在同步结算信息" />
        </AppSection>
      </template>

      <template v-else-if="!error">
        <AppSection title="当前阶段">
          <view class="checkout-stage">
            <view class="checkout-stage__copy">
              <view class="checkout-stage__tags">
                <AppTag :type="stageTagType">{{ currentStageLabel }}</AppTag>
                <AppTag v-if="requestRecord?.pet?.name" type="primary">{{ requestRecord.pet.name }}</AppTag>
                <AppTag v-if="order?.orderNo" type="default">{{ order.orderNo }}</AppTag>
              </view>
              <text class="checkout-stage__title">{{ serviceTypeLabels[order?.serviceType || requestRecord?.serviceType || 'BOARDING'] }}</text>
              <text class="checkout-stage__meta">
                {{ requestRecord ? formatRange(requestRecord.startTime, requestRecord.endTime) : formatRange(order?.appointmentStart, order?.appointmentEnd) }}
              </text>
            </view>
            <view class="checkout-amount">
              <text class="checkout-amount__label">{{ isOrderPaid ? '已支付' : '待支付' }}</text>
              <text class="checkout-amount__value">¥{{ formatAmount(isOrderPaid ? totalAmount : outstandingAmount) }}</text>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="requestRecord" title="服务安排">
          <AppList>
            <AppListItem
              title="宠物与服务"
              :label="`${requestRecord.pet?.name || '宠物'} · ${speciesLabels[requestRecord.pet?.species || 'DOG']}`"
              :value="serviceTypeLabels[requestRecord.serviceType]"
              value-emphasis
            />
            <AppListItem
              title="服务时间"
              :label="formatRange(requestRecord.startTime, requestRecord.endTime)"
              :value="`${estimatedUnits || 1} ${caregiver?.unitType || '次'}`"
            />
            <AppListItem
              title="服务地点"
              :label="requestRecord.locationText"
              :value="getRequestStatusLabel(requestRecord.status)"
            />
          </AppList>
        </AppSection>

        <AppSection v-if="caregiver" title="照料者">
          <view class="checkout-caregiver">
            <view class="checkout-caregiver__copy">
              <text class="checkout-caregiver__title">{{ caregiver.caregiverName }}</text>
              <text class="checkout-caregiver__meta">
                {{ caregiver.city || '城市待补充' }} · 评分 {{ formatAmount(caregiver.ratingAvg) }} · {{ caregiver.ratingCount }} 条评价
              </text>
            </view>
            <AppTag type="success">¥{{ formatAmount(caregiver.pricePerUnit) }}/{{ caregiver.unitType }}</AppTag>
          </view>
        </AppSection>

        <AppSection title="金额">
          <view class="checkout-grid">
            <view class="checkout-metric-card">
              <text class="checkout-metric-card__label">订单金额</text>
              <text class="checkout-metric-card__value">¥{{ formatAmount(totalAmount) }}</text>
            </view>
            <view class="checkout-metric-card">
              <text class="checkout-metric-card__label">已支付</text>
              <text class="checkout-metric-card__value">¥{{ formatAmount(order?.amountPaid || 0) }}</text>
            </view>
            <view class="checkout-metric-card checkout-metric-card--accent">
              <text class="checkout-metric-card__label">{{ isOrderPaid ? '支付状态' : '当前应付' }}</text>
              <text class="checkout-metric-card__value">
                {{ isOrderPaid ? '已完成' : `¥${formatAmount(outstandingAmount)}` }}
              </text>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="!isOrderPaid" title="支付方式">
          <AppChoiceChips v-model="payChannel" :options="payChannelOptions" />
        </AppSection>

        <AppSection v-if="order?.payments.length" :title="`支付记录 (${order.payments.length})`">
          <AppList>
            <AppListItem
              v-for="payment in order.payments"
              :key="payment.id"
              :title="payment.payNo"
              :label="payment.payStatus"
              :value="`¥${formatAmount(payment.payAmount)}`"
              value-emphasis
            />
          </AppList>
        </AppSection>

        <view class="checkout-action-bar">
          <AppButton block size="large" :loading="creatingOrder || paying" @click="handlePrimaryAction">
            {{ primaryButtonLabel }}
          </AppButton>
          <AppButton v-if="order" block size="large" type="info" @click="openOrderDetail">订单详情</AppButton>
          <AppButton v-else block size="large" type="info" @click="backToRequest">返回需求页</AppButton>
        </view>
      </template>

      <template v-else>
        <AppSection title="结算不可用">
          <AppStatus :text="error" />
        </AppSection>
        <view class="checkout-action-bar">
          <AppButton block size="large" type="info" @click="backToRequest">返回需求页</AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <AppStatus text="登录后才能确认订单和支付。" />
      </AppSection>
      <view class="checkout-action-bar">
        <AppButton block size="large" @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.checkout-stage,
.checkout-caregiver,
.checkout-metric-card {
  display: grid;
  gap: 14rpx;
}

.checkout-stage {
  padding: 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.checkout-stage__copy,
.checkout-stage__tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.checkout-stage__copy {
  display: grid;
}

.checkout-stage__title {
  color: var(--app-text);
  font-size: 36rpx;
  line-height: 1.2;
  font-weight: 700;
}

.checkout-stage__meta,
.checkout-caregiver__meta,
.checkout-metric-card__label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.checkout-amount {
  display: grid;
  gap: 6rpx;
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: linear-gradient(180deg, var(--app-primary-soft) 0%, var(--app-surface) 100%);
}

.checkout-amount__label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
}

.checkout-amount__value,
.checkout-metric-card__value {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.1;
  font-weight: 700;
}

.checkout-caregiver {
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.checkout-caregiver__copy {
  display: grid;
  gap: 10rpx;
}

.checkout-caregiver__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.checkout-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.checkout-metric-card {
  padding: 22rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.checkout-metric-card--accent {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.checkout-action-bar {
  padding: 0 32rpx 12rpx;
}

.checkout-action-bar .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .checkout-grid {
    grid-template-columns: 1fr;
  }
}
</style>
