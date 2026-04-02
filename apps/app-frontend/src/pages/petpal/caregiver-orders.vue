<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录照料者，需要连续处理接单、签到、服务记录和签退
 * Entry: 首页点击待办、提醒跳转、订单详情返回
 * First screen: 先按状态看任务队列，再直接执行下一步动作
 * Primary action: 接单、签到、记录服务、签退
 * Secondary actions: 沟通、查看详情、切换筛选
 * States: 未登录、空队列、待接单、待签到、服务中、已完成
 */
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
  openPetPalAction,
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

const pendingCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT').length)
const acceptedCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'ACCEPTED').length)
const servingCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING').length)
const completedCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'COMPLETED').length)
const unreadCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0))
const currentServiceLogOrder = computed(() => caregiverOrders.value.find(item => item.id === activeServiceLogOrderId.value) ?? null)
const sortedOrders = computed(() => [...caregiverOrders.value].sort((left, right) => {
  const priority = getOrderPriority(left.orderStatus) - getOrderPriority(right.orderStatus)
  if (priority !== 0) {
    return priority
  }
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
}))

function getOrderPriority(status: CaregiverOrderRecord['orderStatus']) {
  if (status === 'PENDING_ACCEPT') return 0
  if (status === 'ACCEPTED') return 1
  if (status === 'SERVING') return 2
  return 3
}

function getPrimaryAction(order: CaregiverOrderRecord) {
  if (order.orderStatus === 'PENDING_ACCEPT') {
    return { label: '接单', type: 'primary' as const, key: `accept:${order.id}` }
  }
  if (order.orderStatus === 'ACCEPTED') {
    return { label: '签到', type: 'primary' as const, key: `checkin:${order.id}` }
  }
  if (order.orderStatus === 'SERVING') {
    return { label: '记录服务', type: 'primary' as const, key: `log:${order.id}` }
  }
  return { label: '查看详情', type: 'info' as const, key: '' }
}

function getNextStepText(order: CaregiverOrderRecord) {
  if (order.orderStatus === 'PENDING_ACCEPT') {
    return '先确认能否接单'
  }
  if (order.orderStatus === 'ACCEPTED') {
    return '预约开始后立即签到'
  }
  if (order.orderStatus === 'SERVING') {
    return '补充服务记录后再签退'
  }
  return '回看履约结果和沟通记录'
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openMessages() {
  openPetPalAction('redirect', PETPAL_MESSAGES_PAGE)
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

function handlePrimaryAction(order: CaregiverOrderRecord) {
  if (order.orderStatus === 'PENDING_ACCEPT') {
    void handleAcceptOrder(order.id)
    return
  }
  if (order.orderStatus === 'ACCEPTED') {
    void handleCheckInOrder(order.id)
    return
  }
  if (order.orderStatus === 'SERVING') {
    openServiceLogComposer(order.id)
    return
  }
  openOrderDetail(order.id, 'overview')
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
  closeServiceLogComposer()
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
  <AppPageShell title="履约订单">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_ORDERS_PAGE"
        title="履约订单"
      />

      <AppSection title="先处理这些">
        <view class="caregiver-order-board">
          <view class="caregiver-order-summary">
            <view class="caregiver-order-summary__item">
              <text class="caregiver-order-summary__label">待接单</text>
              <text class="caregiver-order-summary__value">{{ pendingCount }}</text>
            </view>
            <view class="caregiver-order-summary__item">
              <text class="caregiver-order-summary__label">待签到</text>
              <text class="caregiver-order-summary__value">{{ acceptedCount }}</text>
            </view>
            <view class="caregiver-order-summary__item">
              <text class="caregiver-order-summary__label">服务中</text>
              <text class="caregiver-order-summary__value">{{ servingCount }}</text>
            </view>
            <view class="caregiver-order-summary__item">
              <text class="caregiver-order-summary__label">未读消息</text>
              <text class="caregiver-order-summary__value">{{ unreadCount }}</text>
            </view>
          </view>
          <AppChoiceChips v-model="caregiverOrderFilter" :options="caregiverOrderFilterOptions" />
          <view class="caregiver-order-toolbar">
            <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
            <AppButton v-if="currentServiceLogOrder" size="medium" type="danger" @click="closeServiceLogComposer">关闭记录面板</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection v-if="currentServiceLogOrder" title="补服务记录">
        <view class="caregiver-order-log-panel">
          <text class="caregiver-order-log-panel__title">{{ currentServiceLogOrder.petName || '宠物待补充' }} · {{ currentServiceLogOrder.ownerNickname }}</text>
          <text class="caregiver-order-log-panel__meta">{{ currentServiceLogOrder.orderNo }} · {{ formatRange(currentServiceLogOrder.appointmentStart, currentServiceLogOrder.appointmentEnd) }}</text>
          <AppChoiceChips v-model="serviceLogForm.logType" :options="serviceLogTypeOptions" />
          <textarea
            v-model="serviceLogForm.textNote"
            class="caregiver-order-textarea"
            :maxlength="240"
            auto-height
            placeholder="记录喂养、遛宠、互动或健康观察"
          />
          <view class="caregiver-order-toolbar">
            <AppButton size="medium" type="info" @click="closeServiceLogComposer">取消</AppButton>
            <AppButton size="medium" :loading="serviceLogSubmitting" @click="submitServiceLog">提交记录</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection :title="sortedOrders.length ? `任务队列 (${sortedOrders.length})` : '任务队列'">
        <view v-if="sortedOrders.length" class="caregiver-order-list">
          <view v-for="order in sortedOrders" :key="order.id" class="caregiver-order-card">
            <view class="caregiver-order-card__header">
              <view class="caregiver-order-card__copy">
                <text class="caregiver-order-card__title">{{ order.petName || '宠物待补充' }} · {{ order.ownerNickname }}</text>
                <text class="caregiver-order-card__meta">{{ order.locationText || '地点待补充' }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
                <text class="caregiver-order-card__meta">实收 ¥{{ formatAmount(order.amountPaid) }} · {{ getNextStepText(order) }}</text>
              </view>
              <view class="caregiver-order-card__tags">
                <AppTag type="warning">{{ getOrderStatusLabel(order.orderStatus) }}</AppTag>
                <AppTag :type="getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? 'warning' : 'default'">
                  {{ getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'caregiver')}` : '已读' }}
                </AppTag>
              </view>
            </view>

            <view class="caregiver-order-card__conversation">
              <text class="caregiver-order-card__conversation-text">{{ getConversationPreview(order.conversation) }}</text>
              <text class="caregiver-order-card__conversation-meta">{{ getConversationHint(order.conversation, 'caregiver') }}</text>
            </view>

            <view class="caregiver-order-toolbar">
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'service')">详情</AppButton>
              <AppButton
                size="medium"
                :type="getPrimaryAction(order).type"
                :loading="Boolean(getPrimaryAction(order).key) && caregiverActionLoadingKey === getPrimaryAction(order).key"
                @click="handlePrimaryAction(order)"
              >
                {{ getPrimaryAction(order).label }}
              </AppButton>
              <AppButton
                v-if="order.orderStatus === 'SERVING'"
                size="medium"
                type="danger"
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

      <AppSection title="已完成">
        <view class="caregiver-order-completed">
          <AppTag :type="completedCount > 0 ? 'success' : 'default'">
            已完成 {{ completedCount }} 笔
          </AppTag>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后处理订单">
        <view class="caregiver-order-empty caregiver-order-empty--login">
          <AppStatus text="登录后即可接单、签到、记录服务和签退。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-order-board,
.caregiver-order-card,
.caregiver-order-log-panel {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.caregiver-order-board {
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.caregiver-order-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.caregiver-order-summary__item {
  display: grid;
  gap: 8rpx;
  padding: 20rpx;
  border-radius: var(--app-shape-lg);
  background: rgba(255, 255, 255, 0.74);
}

.caregiver-order-summary__label,
.caregiver-order-card__meta,
.caregiver-order-card__conversation-meta,
.caregiver-order-log-panel__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.caregiver-order-summary__value {
  color: var(--app-text);
  font-size: 38rpx;
  line-height: 1.1;
  font-weight: 700;
}

.caregiver-order-list {
  display: grid;
  gap: 16rpx;
}

.caregiver-order-toolbar,
.caregiver-order-card__tags,
.caregiver-order-completed {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.caregiver-order-card__header {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.caregiver-order-card__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.caregiver-order-card__title,
.caregiver-order-log-panel__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.caregiver-order-card__conversation {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: var(--app-shape-lg);
  background: var(--app-surface-soft);
}

.caregiver-order-card__conversation-text {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.6;
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
  .caregiver-order-summary {
    grid-template-columns: 1fr;
  }

  .caregiver-order-card__header {
    flex-direction: column;
  }
}
</style>
