<script lang="ts" setup>
import type { CaregiverOrderRecord, ServiceLogType } from '@rbac/api-common'
import { computed, reactive, ref, watch } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  acceptCaregiverOrder,
  addCaregiverServiceLog,
  checkInCaregiverOrder,
  checkOutCaregiverOrder,
  listCaregiverOrders,
} from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  caregiverOrderFilterOptions,
  formatAmount,
  formatRange,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOrderStatusLabel,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  serviceLogTypeOptions,
} from './owner-shared'

defineOptions({
  name: 'PetPalCaregiverOrdersPage',
})

definePage({
  style: {
    navigationBarTitleText: '履约订单',
    enablePullDownRefresh: true,
  },
})

type CaregiverOrderFilterValue = 'ALL' | 'PENDING_ACCEPT' | 'ACCEPTED' | 'SERVING' | 'COMPLETED'

const tokenStore = useTokenStore()

const loading = ref(false)
const caregiverActionLoadingKey = ref('')
const serviceLogSubmitting = ref(false)
const caregiverOrders = ref<CaregiverOrderRecord[]>([])
const caregiverOrderFilter = ref<CaregiverOrderFilterValue>('PENDING_ACCEPT')
const activeServiceLogOrderId = ref('')

const serviceLogForm = reactive({
  logType: 'NOTE' as ServiceLogType,
  textNote: '',
})

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '接单、签到、服务记录和签退全部集中在履约订单页处理。'
    : '登录后即可处理履约订单。'
))

const pendingCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT').length)
const servingCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING').length)
const completedCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'COMPLETED').length)
const unreadCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0))
const currentServiceLogOrder = computed(() => caregiverOrders.value.find(item => item.id === activeServiceLogOrderId.value) ?? null)

const summaryCards = computed(() => [
  { label: '待接单', value: String(pendingCount.value), hint: '及时接单有助于提高转化。' },
  { label: '服务中', value: String(servingCount.value), hint: '别忘记补充服务记录和反馈。' },
  { label: '已完成', value: String(completedCount.value), hint: '完成后仍可继续查看沟通和评价。' },
  { label: '未读沟通', value: String(unreadCount.value), hint: '优先确认交接与异常消息。' },
])

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openMessages() {
  uni.redirectTo({ url: PETPAL_MESSAGES_PAGE })
}

function openOrderDetail(orderId: string, tab: 'overview' | 'chat' | 'service') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    const response = await listCaregiverOrders({
      page: 1,
      pageSize: 12,
      status: caregiverOrderFilter.value === 'ALL' ? undefined : caregiverOrderFilter.value,
    })
    caregiverOrders.value = response.items
  }
  catch (error: unknown) {
    caregiverOrders.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载履约订单失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function runCaregiverOrderAction(
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) {
  caregiverActionLoadingKey.value = key
  try {
    await action()
    uni.showToast({ title: successMessage, icon: 'none' })
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '履约操作失败'), icon: 'none' })
  }
  finally {
    caregiverActionLoadingKey.value = ''
  }
}

async function handleAcceptOrder(orderId: string) {
  await runCaregiverOrderAction(`accept:${orderId}`, '已接单', async () => {
    await acceptCaregiverOrder(orderId)
  })
}

async function handleCheckInOrder(orderId: string) {
  await runCaregiverOrderAction(`checkin:${orderId}`, '签到成功', async () => {
    await checkInCaregiverOrder(orderId, { note: '移动端签到' })
  })
}

async function handleCheckOutOrder(orderId: string) {
  await runCaregiverOrderAction(`checkout:${orderId}`, '签退成功', async () => {
    await checkOutCaregiverOrder(orderId, { note: '移动端签退' })
  })
}

function openServiceLogComposer(orderId: string) {
  activeServiceLogOrderId.value = orderId
  serviceLogForm.logType = 'NOTE'
  serviceLogForm.textNote = ''
}

function closeServiceLogComposer() {
  activeServiceLogOrderId.value = ''
  serviceLogForm.logType = 'NOTE'
  serviceLogForm.textNote = ''
}

async function submitServiceLog() {
  if (!activeServiceLogOrderId.value) {
    return
  }

  const textNote = serviceLogForm.textNote.trim()
  if (!textNote) {
    uni.showToast({ title: '请填写服务记录说明', icon: 'none' })
    return
  }

  serviceLogSubmitting.value = true
  caregiverActionLoadingKey.value = `log:${activeServiceLogOrderId.value}`
  try {
    await addCaregiverServiceLog(activeServiceLogOrderId.value, {
      logType: serviceLogForm.logType,
      textNote,
    })
    uni.showToast({ title: '服务记录已提交', icon: 'none' })
    closeServiceLogComposer()
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '提交服务记录失败'), icon: 'none' })
  }
  finally {
    serviceLogSubmitting.value = false
    caregiverActionLoadingKey.value = ''
  }
}

watch(caregiverOrderFilter, () => {
  if (tokenStore.hasLogin) {
    void loadPage(false)
  }
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
  <AppPageShell title="履约订单" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_ORDERS_PAGE"
        title="照料者履约订单"
        description="待接单、签到、记录服务和签退都集中在这里，不再要求照料者在一个超级工作台里滚动查找操作。"
      />

      <AppSection title="履约概览">
        <view class="caregiver-order-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="caregiver-order-metric-card">
            <text class="caregiver-order-metric-card__label">{{ item.label }}</text>
            <text class="caregiver-order-metric-card__value">{{ item.value }}</text>
            <text class="caregiver-order-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="筛选与协同" description="优先处理待接单和服务中订单，未读消息可直接跳到消息中心。">
        <AppChoiceChips v-model="caregiverOrderFilter" :options="caregiverOrderFilterOptions" />
        <view class="caregiver-order-action-row">
          <AppButton size="medium" type="info" @click="openMessages">打开消息中心</AppButton>
        </view>
      </AppSection>

      <AppSection v-if="currentServiceLogOrder" title="记录服务" description="针对当前服务中的订单快速补充服务日志。">
        <view class="caregiver-order-log-panel">
          <text class="caregiver-order-log-panel__title">{{ currentServiceLogOrder.orderNo }} · {{ currentServiceLogOrder.petName || '宠物待补充' }}</text>
          <view class="caregiver-order-log-panel__group">
            <text class="caregiver-order-log-panel__label">记录类型</text>
            <AppChoiceChips v-model="serviceLogForm.logType" :options="serviceLogTypeOptions" />
          </view>
          <textarea
            v-model="serviceLogForm.textNote"
            class="caregiver-order-textarea"
            :maxlength="240"
            auto-height
            placeholder="记录本次喂养、遛宠、互动或健康观察情况"
          />
          <view class="caregiver-order-action-row">
            <AppButton size="medium" type="info" @click="closeServiceLogComposer">取消</AppButton>
            <AppButton size="medium" :loading="serviceLogSubmitting" @click="submitServiceLog">提交服务记录</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection :title="caregiverOrders.length ? `订单列表 (${caregiverOrders.length})` : '订单列表'">
        <view v-if="caregiverOrders.length" class="caregiver-order-list">
          <view v-for="order in caregiverOrders" :key="order.id" class="caregiver-order-card">
            <view class="caregiver-order-card__header">
              <view class="caregiver-order-card__headline">
                <text class="caregiver-order-card__title">{{ order.orderNo }}</text>
                <text class="caregiver-order-card__meta">
                  {{ order.petName || '宠物待补充' }} · {{ order.ownerNickname }} · {{ order.locationText || '地点待补充' }}
                </text>
              </view>
              <AppTag :type="getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? 'warning' : 'default'">
                {{ getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'caregiver')}` : '沟通已读' }}
              </AppTag>
            </view>

            <text class="caregiver-order-card__meta">
              {{ getOrderStatusLabel(order.orderStatus) }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}
            </text>
            <text class="caregiver-order-card__meta">实收 ¥{{ formatAmount(order.amountPaid) }}</text>

            <view class="caregiver-order-card__conversation">
              <text class="caregiver-order-card__conversation-title">订单沟通</text>
              <text class="caregiver-order-card__conversation-text">{{ getConversationPreview(order.conversation) }}</text>
              <text class="caregiver-order-card__conversation-meta">{{ getConversationHint(order.conversation, 'caregiver') }}</text>
            </view>

            <view class="caregiver-order-action-row">
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'service')">详情</AppButton>
              <AppButton
                v-if="order.orderStatus === 'PENDING_ACCEPT'"
                size="medium"
                :loading="caregiverActionLoadingKey === `accept:${order.id}`"
                @click="handleAcceptOrder(order.id)"
              >
                接单
              </AppButton>
              <AppButton
                v-if="order.orderStatus === 'ACCEPTED'"
                size="medium"
                :loading="caregiverActionLoadingKey === `checkin:${order.id}`"
                @click="handleCheckInOrder(order.id)"
              >
                签到
              </AppButton>
              <AppButton
                v-if="order.orderStatus === 'SERVING'"
                size="medium"
                type="info"
                @click="openServiceLogComposer(order.id)"
              >
                记录服务
              </AppButton>
              <AppButton
                v-if="order.orderStatus === 'SERVING'"
                size="medium"
                :loading="caregiverActionLoadingKey === `checkout:${order.id}`"
                @click="handleCheckOutOrder(order.id)"
              >
                签退
              </AppButton>
            </view>
          </view>
        </view>
        <view v-else class="caregiver-order-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步履约订单' : '当前筛选下没有履约订单'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始处理履约订单">
        <view class="caregiver-order-empty caregiver-order-empty--login">
          <AppStatus text="登录后即可处理照料订单。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-order-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.caregiver-order-metric-card,
.caregiver-order-card,
.caregiver-order-log-panel {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.caregiver-order-metric-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.caregiver-order-metric-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.caregiver-order-metric-card__hint,
.caregiver-order-card__meta,
.caregiver-order-card__conversation-meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.caregiver-order-action-row,
.caregiver-order-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.caregiver-order-list {
  display: grid;
  gap: 16rpx;
}

.caregiver-order-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.caregiver-order-card__headline {
  display: grid;
  gap: 6rpx;
}

.caregiver-order-card__title,
.caregiver-order-log-panel__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.caregiver-order-card__conversation {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: #fff5eb;
}

.caregiver-order-card__conversation-title {
  color: #c2410c;
  font-size: 20rpx;
  font-weight: 700;
}

.caregiver-order-card__conversation-text {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.caregiver-order-log-panel__group {
  display: grid;
  gap: 12rpx;
}

.caregiver-order-log-panel__label {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.caregiver-order-textarea {
  width: 100%;
  min-height: 150rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  box-sizing: border-box;
  line-height: 1.7;
}

.caregiver-order-empty {
  padding: 8rpx 0;
}

.caregiver-order-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .caregiver-order-metric-grid {
    grid-template-columns: 1fr;
  }

  .caregiver-order-card__header {
    flex-direction: column;
  }
}
</style>
