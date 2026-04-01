<script lang="ts" setup>
import type {
  MatchedCaregiverRecord,
  MatchCaregiverQuery,
  OrderRecord,
  OrderStatus,
  PetProfileRecord,
  ServiceRequestRecord,
  ServiceRequestStatus,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { isOrderAftersalesTracked, PETPAL_REMINDERS_PAGE } from '@/pages/petpal/owner-shared'
import { useTokenStore, useUiStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'Home',
})

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: 'PetPal',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const uiStore = useUiStore()

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])

const isFocusLayout = computed(() => uiStore.preferences.portalLayout === 'focus')
const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const layoutLabel = computed(() => isFocusLayout.value ? '聚焦办事' : '概览看板')

const activeRequestCount = computed(() => requests.value.filter(item => (
  item.status === 'OPEN' || item.status === 'MATCHING' || item.status === 'CONFIRMED'
)).length)

const activeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)

const aftersaleCount = computed(() => orders.value.filter(item => isOrderAftersalesTracked(item)).length)

const upcomingOrders = computed(() => {
  const limit = isFocusLayout.value ? 2 : 4
  return [...orders.value]
    .sort((left, right) => dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf())
    .slice(0, limit)
})

const latestRequests = computed(() => {
  const limit = isFocusLayout.value ? 2 : 4
  return [...requests.value]
    .sort((left, right) => dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf())
    .slice(0, limit)
})

const latestPets = computed(() => {
  const limit = isFocusLayout.value ? 2 : 4
  return [...pets.value]
    .sort((left, right) => dayjs(right.createdAt).valueOf() - dayjs(left.createdAt).valueOf())
    .slice(0, limit)
})

const recommendedCaregivers = computed(() => caregivers.value.slice(0, isFocusLayout.value ? 2 : 4))

const summaryCards = computed(() => [
  {
    label: '宠物档案',
    value: String(pets.value.length),
    hint: pets.value.length ? '已建档宠物，可直接用于发布需求。' : '还没有宠物档案，先去创建第一只宠物。',
  },
  {
    label: '活跃需求',
    value: String(activeRequestCount.value),
    hint: activeRequestCount.value ? '仍在匹配或已确认的需求。' : '当前没有待跟进需求。',
  },
  {
    label: '进行中订单',
    value: String(activeOrderCount.value),
    hint: activeOrderCount.value ? '需要持续关注签到、服务进展和确认完成。' : '当前没有进行中的订单。',
  },
  {
    label: '售后关注',
    value: String(aftersaleCount.value),
    hint: aftersaleCount.value ? '存在退款、争议或已退款订单。' : '当前没有售后风险订单。',
  },
])

const pageDescription = computed(() => (
  `${displayName.value}，当前有 ${pets.value.length} 只宠物、${activeRequestCount.value} 条活跃需求和 ${activeOrderCount.value} 笔进行中订单。`
))

const accountStatusTag = computed(() => userStore.userInfo.status === 'ACTIVE' ? 'success' : 'warning')

const formatTime = (value: string) => dayjs(value).format('MM-DD HH:mm')
const formatAmount = (value: number | string) => typeof value === 'number' ? value.toFixed(2) : value

const getOrderStatusLabel = (status: OrderStatus) => ({
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
}[status] ?? status)

const getRequestStatusLabel = (status: ServiceRequestStatus) => ({
  OPEN: '待匹配',
  MATCHING: '匹配中',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}[status] ?? status)

function openServiceBoard() {
  uni.navigateTo({ url: '/pages/petpal/owner-home' })
}

function openProfile() {
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openReminders() {
  uni.navigateTo({ url: PETPAL_REMINDERS_PAGE })
}

function openMine() {
  uni.switchTab({ url: '/pages/me/me' })
}

function goToOrderDetail(orderId: string) {
  uni.navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
}

function buildMatchQuery(): MatchCaregiverQuery {
  const referencePet = pets.value[0]
  const referenceRequest = requests.value[0]

  return {
    serviceType: referenceRequest?.serviceType || 'BOARDING',
    petSpecies: referencePet?.species || 'DOG',
    page: 1,
    pageSize: 6,
  }
}

async function loadHome(showError = false) {
  if (loading.value) {
    return
  }

  loading.value = true
  try {
    await tokenStore.bootstrap()
    await userStore.fetchUserInfo().catch(() => undefined)

    const [petRows, requestRows, orderRows] = await Promise.all([
      listPets(),
      listServiceRequests(),
      listOrders(),
    ])

    pets.value = petRows
    requests.value = requestRows
    orders.value = orderRows
    caregivers.value = (await matchCaregivers(buildMatchQuery())).items
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载 PetPal 首页失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onLoad(() => {
  void loadHome(false)
})

onPullDownRefresh(() => {
  void loadHome(true)
})
</script>

<template>
  <AppPageShell title="PetPal" :description="pageDescription">
    <template #extra>
      <view class="petpal-chip-row">
        <AppTag type="primary">
          {{ layoutLabel }}
        </AppTag>
        <AppTag :type="accountStatusTag">
          {{ userStore.userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限' }}
        </AppTag>
      </view>
    </template>

    <AppSection title="同步状态" description="首页围绕宠物、需求、订单与售后进展组织，不再展示通用 RBAC 门户数据。">
      <view class="app-status-wrap">
        <AppStatus
          :mode="loading ? 'loading' : 'empty'"
          :text="loading ? '正在同步 PetPal 数据' : '已同步最新 PetPal 首页数据'"
        />
      </view>
    </AppSection>

    <AppSection title="今日概览">
      <view class="petpal-metric-grid">
        <view v-for="item in summaryCards" :key="item.label" class="petpal-metric-card">
          <text class="petpal-metric-card__label">{{ item.label }}</text>
          <text class="petpal-metric-card__value">{{ item.value }}</text>
          <text class="petpal-metric-card__hint">{{ item.hint }}</text>
        </view>
      </view>
    </AppSection>

    <AppSection title="快捷操作" description="把常用 PetPal 动作放到首页第一屏。">
      <AppList>
        <AppListItem title="进入服务台" label="发布需求、维护宠物档案和查看匹配照料者。" is-link clickable @click="openServiceBoard" />
        <AppListItem title="提醒中心" label="集中查看主人端、照料者端和售后相关待办。" is-link clickable @click="openReminders" />
        <AppListItem title="查看我的资料" label="更新昵称、头像、联系方式与账号状态。" is-link clickable @click="openProfile" />
        <AppListItem title="PetPal 设置" label="调整首页布局、底栏样式与主题外观。" is-link clickable @click="openSettings" />
        <AppListItem title="进入我的" label="查看账号状态、宠物资产和订单提醒。" is-link clickable @click="openMine" />
      </AppList>
    </AppSection>

    <AppSection title="宠物档案预览">
      <AppList v-if="latestPets.length">
        <AppListItem
          v-for="pet in latestPets"
          :key="pet.id"
          :title="`${pet.name} · ${pet.species}`"
          :label="pet.breed || '未填写品种'"
          :value="`体重 ${pet.weightKg || '-'}kg`"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="还没有宠物档案，先去服务台创建第一只宠物。" />
      </view>
    </AppSection>

    <AppSection title="近期需求">
      <AppList v-if="latestRequests.length">
        <AppListItem
          v-for="item in latestRequests"
          :key="item.id"
          :title="`${item.pet?.name || '宠物'} · ${item.serviceType}`"
          :label="`${getRequestStatusLabel(item.status)} · ${item.locationText}`"
          :value="formatTime(item.startTime)"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无需求，进入服务台发布新的照料计划。" />
      </view>
    </AppSection>

    <AppSection title="订单跟进">
      <AppList v-if="upcomingOrders.length">
        <AppListItem
          v-for="order in upcomingOrders"
          :key="order.id"
          :title="order.orderNo"
          :label="`状态：${getOrderStatusLabel(order.orderStatus)}`"
          :value="`实付 ${formatAmount(order.amountPaid)} / 已退 ${formatAmount(order.amountRefunded)}`"
          is-link
          clickable
          @click="goToOrderDetail(order.id)"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无订单，完成需求发布后会在这里持续跟进。" />
      </view>
    </AppSection>

    <AppSection title="推荐照料者" description="默认按当前宠物与最新需求做快速匹配。">
      <AppList v-if="recommendedCaregivers.length">
        <AppListItem
          v-for="caregiver in recommendedCaregivers"
          :key="caregiver.serviceId"
          :title="caregiver.caregiverName"
          :label="`${caregiver.city || '未知城市'} · 评分 ${caregiver.ratingAvg}`"
          :value="`${formatAmount(caregiver.pricePerUnit)} / ${caregiver.unitType}`"
        />
      </AppList>
      <view v-else class="app-status-wrap">
        <AppStatus text="暂无推荐照料者，补齐宠物档案后会更容易匹配。" />
      </view>
    </AppSection>
  </AppPageShell>
</template>

<style scoped lang="scss">
.petpal-chip-row {
  display: flex;
  flex-wrap: wrap;
  margin-left: -12rpx;
  margin-bottom: -12rpx;
}

.petpal-chip-row :deep(.app-tag) {
  margin-left: 12rpx;
  margin-bottom: 12rpx;
}

.petpal-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.petpal-metric-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.petpal-metric-card__label {
  font-size: 22rpx;
  color: var(--app-text-muted);
}

.petpal-metric-card__value {
  font-size: 42rpx;
  line-height: 1.05;
  color: var(--app-text);
  font-weight: 700;
}

.petpal-metric-card__hint {
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--app-text-secondary);
}

@media (max-width: 680px) {
  .petpal-metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
