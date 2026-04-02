<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录照料者
 * Entry: 从角色入口进入、履约后回到首页、登录后继续当天工作
 * First screen: 先看到今天最该处理的事项，再进入订单、服务或审核动作
 * Primary action: 根据当前状态直接去入驻、上架、接单或履约
 * Secondary actions: 消息、提醒、收益
 * States: 未登录、未建档、待审核、审核驳回、无服务、待接单、服务中
 */
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  getCaregiverProfile,
  listCaregiverOrders,
  listCaregiverServices,
} from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import ActionSignalCard from './components/action-signal-card.vue'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  formatAmount,
  formatRange,
  getCaregiverAuditLabel,
  getConversationUnreadCount,
  getOrderStatusLabel,
  openPetPalAction,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_REMINDERS_PAGE,
  serviceTypeLabels,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalCaregiverHomePage',
})

definePage({
  style: {
    navigationBarTitleText: '照料者首页',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const loading = ref(false)
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || '照料者')
const pendingOrderCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT').length)
const acceptedOrderCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'ACCEPTED').length)
const servingOrderCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING').length)
const unreadConversationCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0))
const activeServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)

const focusAction = computed(() => {
  if (!caregiverProfile.value) {
    return {
      label: '先完成入驻',
      hint: '先把城市、经验和资质补齐，后续才能稳定接单。',
      action: openProfile,
    }
  }
  if (caregiverProfile.value.auditStatus === 'REJECTED') {
    return {
      label: '重新提交审核',
      hint: '资料被驳回后，优先修正入驻信息和资质。',
      action: openProfile,
    }
  }
  if (!activeServiceCount.value) {
    return {
      label: '先上架服务',
      hint: '还没有可售服务，主人无法直接筛到你。',
      action: openServices,
    }
  }
  if (pendingOrderCount.value > 0) {
    return {
      label: '去处理待接单',
      hint: `${pendingOrderCount.value} 笔订单等待响应，先处理转化风险最高的任务。`,
      action: openOrders,
    }
  }
  if (acceptedOrderCount.value + servingOrderCount.value > 0) {
    return {
      label: '继续履约',
      hint: `${acceptedOrderCount.value} 笔待签到，${servingOrderCount.value} 笔服务中。`,
      action: openOrders,
    }
  }
  if (unreadConversationCount.value > 0) {
    return {
      label: '先看消息',
      hint: `${unreadConversationCount.value} 条未读沟通需要确认。`,
      action: openMessages,
    }
  }
  return {
    label: '查看收益表现',
    hint: '今天的接单和履约较平稳，可以回看评分、收益和服务结构。',
    action: openEarnings,
  }
})

const taskRows = computed(() => [
  {
    title: '入驻审核',
    label: caregiverProfile.value
      ? `${getCaregiverAuditLabel(caregiverProfile.value.auditStatus)} · ${caregiverProfile.value.serviceCity || '城市待补充'}`
      : '还没有入驻档案',
    value: caregiverProfile.value ? '维护' : '创建',
    action: openProfile,
  },
  {
    title: '服务配置',
    label: activeServiceCount.value
      ? `${activeServiceCount.value} 个服务正在上架`
      : '先补一个可售服务',
    value: activeServiceCount.value ? '调整' : '上架',
    action: openServices,
  },
  {
    title: '履约订单',
    label: pendingOrderCount.value || acceptedOrderCount.value || servingOrderCount.value
      ? `待接单 ${pendingOrderCount.value} · 待签到 ${acceptedOrderCount.value} · 服务中 ${servingOrderCount.value}`
      : '当前没有待处理订单',
    value: pendingOrderCount.value + acceptedOrderCount.value + servingOrderCount.value ? '处理' : '查看',
    action: openOrders,
  },
  {
    title: '收益表现',
    label: caregiverProfile.value
      ? `评分 ${formatAmount(caregiverProfile.value.ratingAvg)} · ${caregiverProfile.value.ratingCount} 条评价`
      : '入驻后可查看评分和收益',
    value: caregiverProfile.value ? '查看' : '稍后',
    action: openEarnings,
  },
])

const recentOrders = computed(() => [...caregiverOrders.value]
  .sort((left, right) => {
    const priority = getOrderPriority(left.orderStatus) - getOrderPriority(right.orderStatus)
    if (priority !== 0) {
      return priority
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })
  .slice(0, 4))

const serviceRows = computed(() => caregiverServices.value
  .slice()
  .sort((left, right) => Number(right.isActive) - Number(left.isActive))
  .slice(0, 3))

function getAuditTagType() {
  if (!caregiverProfile.value) {
    return 'default'
  }
  if (caregiverProfile.value.auditStatus === 'APPROVED') {
    return 'success'
  }
  if (caregiverProfile.value.auditStatus === 'REJECTED') {
    return 'danger'
  }
  return 'warning'
}

function getOrderPriority(status: CaregiverOrderRecord['orderStatus']) {
  if (status === 'PENDING_ACCEPT') return 0
  if (status === 'ACCEPTED') return 1
  if (status === 'SERVING') return 2
  return 3
}

function getOrderPrimaryAction(order: CaregiverOrderRecord) {
  if (order.orderStatus === 'PENDING_ACCEPT') {
    return { label: '去接单', tab: 'service' as const }
  }
  if (order.orderStatus === 'ACCEPTED') {
    return { label: '去签到', tab: 'service' as const }
  }
  if (order.orderStatus === 'SERVING') {
    return { label: '记录服务', tab: 'service' as const }
  }
  return { label: '看详情', tab: 'overview' as const }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openProfile() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_PROFILE_PAGE })
}

function openServices() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_SERVICES_PAGE })
}

function openOrders() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_ORDERS_PAGE })
}

function openEarnings() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_EARNINGS_PAGE })
}

function openMessages() {
  openPetPalAction('redirect', PETPAL_MESSAGES_PAGE)
}

function openReminders() {
  uni.redirectTo({ url: PETPAL_REMINDERS_PAGE })
}

function openOrderDetail(orderId: string, tab: 'overview' | 'chat' | 'service' = 'overview') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      tokenStore.bootstrap(),
      userStore.fetchUserInfo().catch(() => undefined),
    ])

    const [profileResult, servicesResult, ordersResult] = await Promise.allSettled([
      getCaregiverProfile(),
      listCaregiverServices(),
      listCaregiverOrders({ page: 1, pageSize: 10 }),
    ])

    caregiverProfile.value = profileResult.status === 'fulfilled' ? profileResult.value : null
    caregiverServices.value = servicesResult.status === 'fulfilled' ? servicesResult.value : []
    caregiverOrders.value = ordersResult.status === 'fulfilled' ? ordersResult.value.items : []
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载照料者首页失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
  void notificationStore.refreshNotifications()
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="照料者首页">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_HOME_PAGE"
        title="照料者首页"
      />

      <AppSection title="今天先做这个">
        <view class="caregiver-focus">
          <view class="caregiver-focus__copy">
            <view class="caregiver-focus__headline">
              <text class="caregiver-focus__title">{{ displayName }}</text>
              <view class="caregiver-focus__tags">
                <AppTag :type="getAuditTagType()">
                  {{ caregiverProfile ? getCaregiverAuditLabel(caregiverProfile.auditStatus) : '未入驻' }}
                </AppTag>
                <AppTag :type="activeServiceCount > 0 ? 'success' : 'default'">
                  {{ activeServiceCount }} 个上架服务
                </AppTag>
                <AppTag :type="pendingOrderCount + acceptedOrderCount + servingOrderCount > 0 ? 'warning' : 'default'">
                  {{ pendingOrderCount + acceptedOrderCount + servingOrderCount }} 笔待办订单
                </AppTag>
              </view>
            </view>
            <text class="caregiver-focus__hint">{{ focusAction.hint }}</text>
          </view>
          <view class="caregiver-focus__actions">
            <AppButton size="medium" @click="focusAction.action">{{ focusAction.label }}</AppButton>
            <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
            <AppButton size="medium" type="danger" @click="openReminders">提醒</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="当前优先">
        <ActionSignalCard
          title="待处理事项"
          scope="CAREGIVER"
          empty-text="当前没有新的高优先事项，可以继续接单、维护服务或查看收益。"
        />
      </AppSection>

      <AppSection title="继续处理">
        <AppList>
          <AppListItem
            v-for="item in taskRows"
            :key="item.title"
            :title="item.title"
            :label="item.label"
            :value="item.value"
            value-emphasis
            clickable
            is-link
            @click="item.action"
          />
        </AppList>
      </AppSection>

      <AppSection title="今日订单">
        <view v-if="recentOrders.length" class="caregiver-order-list">
          <view v-for="order in recentOrders" :key="order.id" class="caregiver-order-row">
            <view class="caregiver-order-row__headline">
              <view class="caregiver-order-row__copy">
                <text class="caregiver-order-row__title">{{ order.petName || '宠物待补充' }} · {{ order.ownerNickname }}</text>
                <text class="caregiver-order-row__meta">{{ getOrderStatusLabel(order.orderStatus) }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
                <text class="caregiver-order-row__meta">{{ order.locationText || '地点待补充' }} · 实收 ¥{{ formatAmount(order.amountPaid) }}</text>
              </view>
              <view class="caregiver-order-row__tags">
                <AppTag type="warning">
                  {{ getOrderPrimaryAction(order).label }}
                </AppTag>
                <AppTag :type="getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? 'warning' : 'default'">
                  {{ getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'caregiver')}` : '已读' }}
                </AppTag>
              </view>
            </view>
            <view class="caregiver-order-row__actions">
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
              <AppButton size="medium" @click="openOrderDetail(order.id, getOrderPrimaryAction(order).tab)">
                {{ getOrderPrimaryAction(order).label }}
              </AppButton>
            </view>
          </view>
        </view>
        <view v-else class="caregiver-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步订单' : '当前没有待处理订单'" />
        </view>
      </AppSection>

      <AppSection title="服务与收益">
        <AppList v-if="serviceRows.length || caregiverProfile">
          <AppListItem
            v-if="caregiverProfile"
            title="我的表现"
            :label="`${caregiverProfile.serviceCity || '城市待补充'} · ${caregiverProfile.experienceYears} 年经验`"
            :value="`评分 ${formatAmount(caregiverProfile.ratingAvg)}`"
            value-emphasis
            clickable
            is-link
            @click="openEarnings"
          />
          <AppListItem
            v-for="service in serviceRows"
            :key="service.id"
            :title="`${serviceTypeLabels[service.serviceType]} · ${speciesLabels[service.petSpecies]}`"
            :label="`${service.serviceCity || '城市待补充'} · 提前 ${service.minNoticeHours} 小时`"
            :value="`¥${formatAmount(service.pricePerUnit)}/${service.unitType}`"
            value-emphasis
            clickable
            is-link
            @click="openServices"
          />
        </AppList>
        <view v-else class="caregiver-empty">
          <AppStatus text="还没有服务配置，先上架一个服务。" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后开始工作">
        <view class="caregiver-empty caregiver-empty--login">
          <AppStatus text="登录后即可查看审核、订单、服务和收益。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-focus {
  display: grid;
  gap: 16rpx;
  padding: 26rpx 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.22), transparent 34%),
    radial-gradient(circle at bottom left, rgba(37, 99, 235, 0.12), transparent 30%),
    linear-gradient(180deg, #fff0dd 0%, rgba(255, 251, 246, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
}

.caregiver-focus__copy,
.caregiver-focus__headline {
  display: grid;
  gap: 10rpx;
}

.caregiver-focus__title {
  color: var(--app-text);
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 38rpx;
  line-height: 1.14;
  font-weight: 700;
}

.caregiver-focus__hint {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.caregiver-focus__tags,
.caregiver-focus__actions,
.caregiver-order-row__tags,
.caregiver-order-row__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.caregiver-order-list {
  display: grid;
  gap: 16rpx;
}

.caregiver-order-row {
  display: grid;
  gap: 14rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 32%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
}

.caregiver-order-row__headline {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.caregiver-order-row__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.caregiver-order-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.24;
  font-weight: 700;
}

.caregiver-order-row__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.caregiver-empty {
  padding: 8rpx 0;
}

.caregiver-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .caregiver-order-row__headline {
    flex-direction: column;
  }
}
</style>
