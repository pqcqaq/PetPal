<script lang="ts" setup>
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  OrderStatus,
  PetServiceType,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
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
import { useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  formatAmount,
  formatPercent,
  getCaregiverAuditHint,
  getCaregiverAuditLabel,
  getOrderStatusLabel,
  getOrderTone,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  serviceTypeLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalCaregiverEarningsPage',
})

definePage({
  style: {
    navigationBarTitleText: '收益表现',
    enablePullDownRefresh: true,
  },
})

type TimeframeValue = '7D' | '30D' | '90D' | 'ALL'

type ServiceTypePerformance = {
  serviceType: PetServiceType
  count: number
  netIncome: number
  refundedAmount: number
}

type ReminderItem = {
  title: string
  text: string
  type: 'default' | 'warning' | 'danger' | 'success'
}

const tokenStore = useTokenStore()
const userStore = useUserStore()

const loading = ref(false)
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])
const timeframe = ref<TimeframeValue>('30D')

const timeframeOptions = [
  { label: '近 7 天', value: '7D', description: '聚焦最近一周经营变化' },
  { label: '近 30 天', value: '30D', description: '查看最近一个月收入表现' },
  { label: '近 90 天', value: '90D', description: '观察季度经营趋势' },
  { label: '全部', value: 'ALL', description: '查看当前可加载到的全部订单' },
]

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || '照料者')
const activeServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '围绕照料者的收入、评分、完成率和售后风险，提供一个可日常查看的经营页面。'
    : '登录后即可查看照料者收益与表现。'
))

const rangeStart = computed(() => {
  if (timeframe.value === 'ALL') {
    return null
  }

  const daysMap: Record<Exclude<TimeframeValue, 'ALL'>, number> = {
    '7D': 7,
    '30D': 30,
    '90D': 90,
  }

  return dayjs().subtract(daysMap[timeframe.value], 'day').startOf('day')
})

const filteredOrders = computed(() => caregiverOrders.value.filter((order) => {
  if (!rangeStart.value) {
    return true
  }
  return dayjs(order.updatedAt).isAfter(rangeStart.value)
}))

const activeOrders = computed(() => filteredOrders.value.filter(order => (
  order.orderStatus === 'PENDING_ACCEPT'
  || order.orderStatus === 'ACCEPTED'
  || order.orderStatus === 'SERVING'
)))

const completedOrders = computed(() => filteredOrders.value.filter(order => order.orderStatus === 'COMPLETED'))
const aftersaleOrders = computed(() => filteredOrders.value.filter(order => (
  order.orderStatus === 'DISPUTED'
  || order.orderStatus === 'PARTIAL_REFUNDED'
  || order.orderStatus === 'REFUNDED'
)))
const cancelledOrders = computed(() => filteredOrders.value.filter(order => order.orderStatus === 'CANCELLED'))
const settledOrders = computed(() => filteredOrders.value.filter(order => (
  order.orderStatus === 'COMPLETED'
  || order.orderStatus === 'PARTIAL_REFUNDED'
  || order.orderStatus === 'REFUNDED'
)))

const settledNetIncome = computed(() => settledOrders.value.reduce((total, order) => (
  total + Math.max(0, Number(order.amountPaid ?? 0) - Number(order.amountRefunded ?? 0))
), 0))

const pipelineIncome = computed(() => activeOrders.value.reduce((total, order) => (
  total + Number(order.amountPaid ?? 0)
), 0))

const refundedAmount = computed(() => filteredOrders.value.reduce((total, order) => (
  total + Number(order.amountRefunded ?? 0)
), 0))

const completionRate = computed(() => {
  const closedCount = completedOrders.value.length + aftersaleOrders.value.length + cancelledOrders.value.length
  if (!closedCount) {
    return 0
  }
  return completedOrders.value.length / closedCount
})

const aftersaleRate = computed(() => {
  const settledCount = settledOrders.value.length + aftersaleOrders.value.length
  if (!settledCount) {
    return 0
  }
  return aftersaleOrders.value.length / settledCount
})

const averageTicket = computed(() => {
  if (!settledOrders.value.length) {
    return 0
  }
  return settledNetIncome.value / settledOrders.value.length
})

const performanceCards = computed(() => [
  {
    label: '平均评分',
    value: formatAmount(caregiverProfile.value?.ratingAvg),
    hint: caregiverProfile.value?.ratingCount ? `共 ${caregiverProfile.value.ratingCount} 条评价` : '还没有形成足够的评分样本。',
  },
  {
    label: '完成率',
    value: formatPercent(completionRate.value),
    hint: completedOrders.value.length ? `当前周期已完成 ${completedOrders.value.length} 笔订单` : '当前周期还没有完成订单。',
  },
  {
    label: '售后风险率',
    value: formatPercent(aftersaleRate.value),
    hint: aftersaleOrders.value.length ? `当前周期有 ${aftersaleOrders.value.length} 笔售后风险订单` : '当前周期没有售后风险订单。',
  },
  {
    label: '平均客单价',
    value: `¥${formatAmount(averageTicket.value)}`,
    hint: settledOrders.value.length ? '按已落定订单净收入测算。' : '等待形成更多结算订单后更新。',
  },
])

const incomeCards = computed(() => [
  {
    label: '已落定净收入',
    value: `¥${formatAmount(settledNetIncome.value)}`,
    hint: settledOrders.value.length ? `包含 ${settledOrders.value.length} 笔已落定订单` : '当前周期还没有形成已落定收入。',
  },
  {
    label: '在途已收',
    value: `¥${formatAmount(pipelineIncome.value)}`,
    hint: activeOrders.value.length ? `当前还有 ${activeOrders.value.length} 笔在途订单` : '当前没有在途订单金额。',
  },
  {
    label: '退款扣减',
    value: `¥${formatAmount(refundedAmount.value)}`,
    hint: refundedAmount.value ? '已按订单退款金额汇总售后扣减。' : '当前周期没有退款扣减。',
  },
  {
    label: '上架服务',
    value: String(activeServiceCount.value),
    hint: activeServiceCount.value ? '建议持续维护价格和服务城市。' : '至少保持一个可售服务处于上架状态。',
  },
])

const serviceTypePerformance = computed<ServiceTypePerformance[]>(() => {
  const totals = new Map<PetServiceType, ServiceTypePerformance>()

  filteredOrders.value.forEach((order) => {
    const current = totals.get(order.serviceType) || {
      serviceType: order.serviceType,
      count: 0,
      netIncome: 0,
      refundedAmount: 0,
    }

    current.count += 1
    current.netIncome += Math.max(0, Number(order.amountPaid ?? 0) - Number(order.amountRefunded ?? 0))
    current.refundedAmount += Number(order.amountRefunded ?? 0)

    totals.set(order.serviceType, current)
  })

  return [...totals.values()]
    .sort((left, right) => right.netIncome - left.netIncome || right.count - left.count)
})

const recentFinanceOrders = computed(() => [...filteredOrders.value]
  .filter(order => (
    order.orderStatus === 'COMPLETED'
    || order.orderStatus === 'SERVING'
    || order.orderStatus === 'PARTIAL_REFUNDED'
    || order.orderStatus === 'REFUNDED'
    || order.orderStatus === 'DISPUTED'
  ))
  .sort((left, right) => dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf())
  .slice(0, 5))

const monthlyIncome = computed(() => {
  return [2, 1, 0].map((offset) => {
    const start = dayjs().subtract(offset, 'month').startOf('month')
    const end = start.endOf('month')
    const total = settledOrders.value.reduce((sum, order) => {
      const updatedAt = dayjs(order.updatedAt)
      if (!updatedAt.isBefore(start) && !updatedAt.isAfter(end)) {
        return sum + Math.max(0, Number(order.amountPaid ?? 0) - Number(order.amountRefunded ?? 0))
      }
      return sum
    }, 0)

    return {
      label: start.format('M 月'),
      amount: total,
    }
  })
})

const reminderItems = computed<ReminderItem[]>(() => {
  const items: ReminderItem[] = []

  if (!caregiverProfile.value) {
    items.push({
      title: '先完成入驻资料',
      text: '还没有照料者档案，先补齐介绍、城市和资质材料，再开始沉淀收入表现。',
      type: 'warning',
    })
  }
  else if (caregiverProfile.value.auditStatus !== 'APPROVED') {
    items.push({
      title: '审核状态仍需关注',
      text: getCaregiverAuditHint(caregiverProfile.value.auditStatus),
      type: caregiverProfile.value.auditStatus === 'REJECTED' ? 'danger' : 'warning',
    })
  }

  if (!activeServiceCount.value) {
    items.push({
      title: '至少保持一个可售服务',
      text: '当前没有上架服务，主人侧将无法继续筛到你。',
      type: 'warning',
    })
  }

  if (activeOrders.value.some(order => order.orderStatus === 'PENDING_ACCEPT')) {
    items.push({
      title: '待接单需要尽快处理',
      text: `当前有 ${activeOrders.value.filter(order => order.orderStatus === 'PENDING_ACCEPT').length} 笔待接单订单，响应速度会直接影响转化。`,
      type: 'danger',
    })
  }

  if (aftersaleOrders.value.length) {
    items.push({
      title: '售后风险订单需要复盘',
      text: `当前周期有 ${aftersaleOrders.value.length} 笔售后风险订单，建议回看沟通、服务记录和退款原因。`,
      type: 'warning',
    })
  }

  if ((caregiverProfile.value?.ratingCount || 0) < 5) {
    items.push({
      title: '评价样本仍然偏少',
      text: '继续稳定完成订单并引导主人评价，后续匹配会更有说服力。',
      type: 'default',
    })
  }

  return items.slice(0, 4)
})

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

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

function getOrderTagType(status: OrderStatus) {
  const tone = getOrderTone(status)
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  return 'default'
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

function openOrderDetail(orderId: string, tab: 'overview' | 'service' = 'overview') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

async function listAllCaregiverOrders() {
  const allItems: CaregiverOrderRecord[] = []
  let currentPage = 1
  let totalPages = 1

  do {
    const response = await listCaregiverOrders({ page: currentPage, pageSize: 50 })
    allItems.push(...response.items)
    totalPages = Math.max(1, response.pagination.totalPages)
    currentPage += 1
  }
  while (currentPage <= totalPages)

  return allItems
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
      listAllCaregiverOrders(),
    ])

    caregiverProfile.value = profileResult.status === 'fulfilled' ? profileResult.value : null
    caregiverServices.value = servicesResult.status === 'fulfilled' ? servicesResult.value : []
    caregiverOrders.value = ordersResult.status === 'fulfilled' ? ordersResult.value : []
  }
  catch (error: unknown) {
    caregiverProfile.value = null
    caregiverServices.value = []
    caregiverOrders.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载收益表现失败'),
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
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="收益表现" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_EARNINGS_PAGE"
        title="照料者收益与表现"
        description="围绕收入、评分、完成率和售后风险建立经营视角，帮助照料者持续优化接单与服务质量。"
      />

      <AppSection title="统计周期" description="按订单最近更新时间滚动统计，便于快速看趋势。">
        <AppChoiceChips v-model="timeframe" :options="timeframeOptions" />
      </AppSection>

      <AppSection title="经营总览" description="把最重要的收入和质量指标放在第一屏。">
        <view class="earnings-hero">
          <view class="earnings-hero__copy">
            <AppTag :type="getAuditTagType()">
              {{ caregiverProfile ? getCaregiverAuditLabel(caregiverProfile.auditStatus) : '待创建档案' }}
            </AppTag>
            <text class="earnings-hero__title">{{ displayName }}</text>
            <text class="earnings-hero__summary">
              当前周期已落定净收入 ¥{{ formatAmount(settledNetIncome) }}，在途已收 ¥{{ formatAmount(pipelineIncome) }}，
              售后扣减 ¥{{ formatAmount(refundedAmount) }}。
            </text>
          </view>
          <view class="earnings-hero__actions">
            <AppButton size="medium" @click="openOrders">订单明细</AppButton>
            <AppButton size="medium" type="info" @click="openServices">服务管理</AppButton>
            <AppButton size="medium" type="info" @click="openProfile">入驻资料</AppButton>
          </view>
        </view>

        <view class="earnings-metric-grid">
          <view v-for="item in incomeCards" :key="item.label" class="earnings-metric-card">
            <text class="earnings-metric-card__label">{{ item.label }}</text>
            <text class="earnings-metric-card__value">{{ item.value }}</text>
            <text class="earnings-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="服务表现" description="收入只是结果，评分、完成率和售后风险决定后续增长。">
        <view class="earnings-metric-grid">
          <view v-for="item in performanceCards" :key="item.label" class="earnings-metric-card">
            <text class="earnings-metric-card__label">{{ item.label }}</text>
            <text class="earnings-metric-card__value">{{ item.value }}</text>
            <text class="earnings-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="月度净收入" description="快速看最近三个月的已落定净收入。">
        <view class="earnings-month-grid">
          <view v-for="item in monthlyIncome" :key="item.label" class="earnings-month-card">
            <text class="earnings-month-card__label">{{ item.label }}</text>
            <text class="earnings-month-card__value">¥{{ formatAmount(item.amount) }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="服务类型贡献" description="结合接单数量和净收入，判断当前更值得加码的服务类型。">
        <view v-if="serviceTypePerformance.length" class="earnings-service-list">
          <view v-for="item in serviceTypePerformance" :key="item.serviceType" class="earnings-service-card">
            <view class="earnings-service-card__header">
              <text class="earnings-service-card__title">{{ serviceTypeLabels[item.serviceType] }}</text>
              <AppTag type="primary">订单 {{ item.count }}</AppTag>
            </view>
            <text class="earnings-service-card__meta">净收入 ¥{{ formatAmount(item.netIncome) }}</text>
            <text class="earnings-service-card__meta">退款扣减 ¥{{ formatAmount(item.refundedAmount) }}</text>
          </view>
        </view>
        <view v-else class="earnings-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在分析服务贡献' : '当前周期还没有可统计的订单数据'" />
        </view>
      </AppSection>

      <AppSection title="近期收益订单" description="优先查看最近落定、服务中或有售后扣减的订单。">
        <view v-if="recentFinanceOrders.length" class="earnings-order-list">
          <view v-for="order in recentFinanceOrders" :key="order.id" class="earnings-order-card">
            <view class="earnings-order-card__header">
              <view class="earnings-order-card__headline">
                <text class="earnings-order-card__title">{{ order.orderNo }}</text>
                <text class="earnings-order-card__meta">
                  {{ order.petName || '宠物待补充' }} · {{ order.ownerNickname }} · {{ dayjs(order.updatedAt).format('MM-DD HH:mm') }}
                </text>
              </view>
              <AppTag :type="getOrderTagType(order.orderStatus)">
                {{ getOrderStatusLabel(order.orderStatus) }}
              </AppTag>
            </view>

            <text class="earnings-order-card__meta">
              预约 {{ dayjs(order.appointmentStart).format('MM-DD HH:mm') }} - {{ dayjs(order.appointmentEnd).format('MM-DD HH:mm') }}
            </text>

            <view class="earnings-order-card__amounts">
              <text>实付 ¥{{ formatAmount(order.amountPaid) }}</text>
              <text>退款 ¥{{ formatAmount(order.amountRefunded) }}</text>
              <text>净额 ¥{{ formatAmount(Math.max(0, toNumber(order.amountPaid) - toNumber(order.amountRefunded))) }}</text>
            </view>

            <view class="earnings-order-card__actions">
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'overview')">订单详情</AppButton>
              <AppButton size="medium" @click="openOrderDetail(order.id, 'service')">履约记录</AppButton>
            </view>
          </view>
        </view>
        <view v-else class="earnings-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步收益订单' : '当前周期还没有可展示的收益订单'" />
        </view>
      </AppSection>

      <AppSection title="经营提醒" description="把最影响收入和口碑的风险动作直接列出来。">
        <view v-if="reminderItems.length" class="earnings-reminder-list">
          <view v-for="item in reminderItems" :key="item.title" class="earnings-reminder-card">
            <view class="earnings-reminder-card__header">
              <text class="earnings-reminder-card__title">{{ item.title }}</text>
              <AppTag :type="item.type">{{ item.type === 'danger' ? '高优先级' : item.type === 'warning' ? '需关注' : item.type === 'success' ? '已稳定' : '建议' }}</AppTag>
            </view>
            <text class="earnings-reminder-card__text">{{ item.text }}</text>
          </view>
        </view>
        <view v-else class="earnings-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在生成经营提醒' : '当前没有额外经营提醒'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始查看收益表现">
        <view class="earnings-empty earnings-empty--login">
          <AppStatus text="登录后即可查看照料者收益、评分和售后风险。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.earnings-hero {
  display: grid;
  gap: 18rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.26), transparent 34%),
    linear-gradient(145deg, #7c2d12 0%, #b45309 48%, #ea580c 100%);
  color: #fff7ed;
}

.earnings-hero__copy {
  display: grid;
  gap: 12rpx;
}

.earnings-hero__title {
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.earnings-hero__summary {
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(255, 247, 237, 0.9);
}

.earnings-hero__actions,
.earnings-order-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.earnings-metric-grid,
.earnings-month-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.earnings-metric-card,
.earnings-month-card,
.earnings-service-card,
.earnings-order-card,
.earnings-reminder-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 26rpx;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.earnings-metric-card__label,
.earnings-metric-card__hint,
.earnings-order-card__meta,
.earnings-order-card__amounts,
.earnings-service-card__meta,
.earnings-reminder-card__text,
.earnings-month-card__label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.earnings-metric-card__value,
.earnings-month-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.earnings-service-list,
.earnings-order-list,
.earnings-reminder-list {
  display: grid;
  gap: 16rpx;
}

.earnings-service-card__header,
.earnings-order-card__header,
.earnings-reminder-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.earnings-service-card__title,
.earnings-order-card__title,
.earnings-reminder-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.earnings-order-card__headline {
  display: grid;
  gap: 6rpx;
}

.earnings-order-card__amounts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.earnings-empty {
  padding: 8rpx 0;
}

.earnings-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .earnings-metric-grid,
  .earnings-month-grid,
  .earnings-order-card__amounts {
    grid-template-columns: 1fr;
  }

  .earnings-service-card__header,
  .earnings-order-card__header,
  .earnings-reminder-card__header {
    flex-direction: column;
  }
}
</style>
