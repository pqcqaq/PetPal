<script lang="ts" setup>
import type {
  MatchedCaregiverRecord,
  OrderRecord,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppCard from '@/components/app-card/app-card.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  buildOwnerMatchQuery,
  formatAmount,
  formatRange,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getRequestStatusLabel,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_PAGE,
  serviceTypeLabels,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalOwnerHomePage',
})

definePage({
  style: {
    navigationBarTitleText: 'PetPal 主人首页',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const activeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)
const aftersaleCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'DISPUTED'
  || item.orderStatus === 'PARTIAL_REFUNDED'
  || item.orderStatus === 'REFUNDED'
)).length)
const activeRequestCount = computed(() => requests.value.filter(item => (
  item.status === 'OPEN'
  || item.status === 'MATCHING'
  || item.status === 'CONFIRMED'
)).length)
const unreadConversationCount = computed(() => orders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0))
const pageDescription = computed(() => {
  if (!tokenStore.hasLogin) {
    return '登录后从主人任务流进入宠物建档、发布需求和订单跟进。'
  }

  return `${displayName.value}，当前有 ${activeRequestCount.value} 条活跃需求、${activeOrderCount.value} 笔进行中订单和 ${unreadConversationCount.value} 条未读沟通。`
})

const summaryCards = computed(() => [
  { label: '宠物档案', value: String(pets.value.length), hint: pets.value.length ? '宠物资料已沉淀，可直接复用下单。' : '先完善第一只宠物资料。' },
  { label: '活跃需求', value: String(activeRequestCount.value), hint: activeRequestCount.value ? '仍在匹配或等待确认。' : '暂无待跟进需求。' },
  { label: '进行中订单', value: String(activeOrderCount.value), hint: activeOrderCount.value ? '需要持续关注履约和确认完成。' : '当前没有进行中的订单。' },
  { label: '售后关注', value: String(aftersaleCount.value), hint: aftersaleCount.value ? '存在退款或投诉跟进事项。' : '当前没有售后风险。' },
])

const latestOrders = computed(() => [...orders.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 3))
const latestRequests = computed(() => [...requests.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 3))
const petHighlights = computed(() => pets.value.slice(0, 3))
const caregiverHighlights = computed(() => caregivers.value.slice(0, 3))

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openPets() {
  uni.redirectTo({ url: PETPAL_PETS_PAGE })
}

function openRequests() {
  uni.redirectTo({ url: PETPAL_REQUEST_PAGE })
}

function openOrders() {
  uni.redirectTo({ url: PETPAL_ORDERS_PAGE })
}

function openOrderDetail(orderId: string, tab: 'overview' | 'chat' = 'overview') {
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

    const [petRows, requestRows, orderRows] = await Promise.all([
      listPets(),
      listServiceRequests(),
      listOrders(),
    ])

    pets.value = petRows
    requests.value = requestRows
    orders.value = orderRows

    const latestPet = petRows[0]
    const latestRequest = requestRows[0]
    caregivers.value = latestPet
      ? (await matchCaregivers(buildOwnerMatchQuery({
          petSpecies: latestPet.species,
          serviceType: latestRequest?.serviceType,
          pageSize: 4,
        }))).items
      : []
  }
  catch (error: unknown) {
    caregivers.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载主人首页失败'),
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
  <AppPageShell title="主人首页" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_OWNER_HOME_PAGE"
        title="PetPal 主人任务流"
        description="按真实办事顺序重建：先确认宠物资料，再发起需求，随后持续跟进履约、沟通与售后。"
      />

      <AppSection title="当前态势" description="把今天最需要处理的事项集中到第一屏。">
        <AppCard>
          <view class="owner-hero">
            <view class="owner-hero__copy">
              <AppTag type="primary">
                主人视角
              </AppTag>
              <text class="owner-hero__title">{{ displayName }}</text>
              <text class="owner-hero__summary">
                你有 {{ activeRequestCount }} 条活跃需求、{{ activeOrderCount }} 笔进行中订单和 {{ unreadConversationCount }} 条待查看沟通。
              </text>
            </view>
            <view class="owner-hero__actions">
              <AppButton size="medium" @click="openRequests">发布新需求</AppButton>
              <AppButton size="medium" type="info" @click="openOrders">处理订单</AppButton>
            </view>
          </view>
        </AppCard>

        <view class="owner-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="owner-metric-card">
            <text class="owner-metric-card__label">{{ item.label }}</text>
            <text class="owner-metric-card__value">{{ item.value }}</text>
            <text class="owner-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="快捷推进" description="把主人侧的关键动作独立成明确任务，不再挤在一个超级页面里。">
        <view class="owner-quick-grid">
          <view class="owner-quick-card" @click="openPets">
            <text class="owner-quick-card__title">维护宠物档案</text>
            <text class="owner-quick-card__text">补齐生日、体重、喂养和紧急联系人信息。</text>
          </view>
          <view class="owner-quick-card" @click="openRequests">
            <text class="owner-quick-card__title">创建照料需求</text>
            <text class="owner-quick-card__text">选择宠物、时间与预算，快速发布本次托管计划。</text>
          </view>
          <view class="owner-quick-card" @click="openOrders">
            <text class="owner-quick-card__title">跟进订单履约</text>
            <text class="owner-quick-card__text">从沟通、服务记录到售后进展统一跟踪。</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="宠物与需求概览">
        <view class="owner-panels">
          <view class="owner-panel">
            <view class="owner-panel__header">
              <text class="owner-panel__title">宠物档案</text>
              <AppButton size="medium" type="info" @click="openPets">管理</AppButton>
            </view>
            <view v-if="petHighlights.length" class="owner-mini-list">
              <view v-for="pet in petHighlights" :key="pet.id" class="owner-mini-list__item">
                <text class="owner-mini-list__title">{{ pet.name }}</text>
                <text class="owner-mini-list__meta">
                  {{ speciesLabels[pet.species] }}{{ pet.breed ? ` · ${pet.breed}` : '' }} · {{ pet.weightKg || '-' }}kg
                </text>
              </view>
            </view>
            <AppStatus v-else text="还没有宠物档案，先去建档。" />
          </view>

          <view class="owner-panel">
            <view class="owner-panel__header">
              <text class="owner-panel__title">近期需求</text>
              <AppButton size="medium" type="info" @click="openRequests">查看</AppButton>
            </view>
            <view v-if="latestRequests.length" class="owner-mini-list">
              <view v-for="item in latestRequests" :key="item.id" class="owner-mini-list__item">
                <text class="owner-mini-list__title">{{ item.pet?.name || '宠物' }} · {{ serviceTypeLabels[item.serviceType] }}</text>
                <text class="owner-mini-list__meta">{{ formatRange(item.startTime, item.endTime) }}</text>
                <text class="owner-mini-list__meta">{{ getRequestStatusLabel(item.status) }} · {{ item.locationText }}</text>
              </view>
            </view>
            <AppStatus v-else text="当前还没有服务需求。" />
          </view>
        </view>
      </AppSection>

      <AppSection title="订单跟进" description="优先展示需要继续沟通或确认的订单。">
        <view v-if="latestOrders.length" class="owner-order-list">
          <view v-for="order in latestOrders" :key="order.id" class="owner-order-card">
            <view class="owner-order-card__header">
              <view class="owner-order-card__headline">
                <text class="owner-order-card__title">{{ order.orderNo }}</text>
                <text class="owner-order-card__meta">{{ getOrderStatusLabel(order.orderStatus) }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}</text>
              </view>
              <AppTag :type="getConversationUnreadCount(order.conversation, 'owner') > 0 ? 'warning' : 'default'">
                {{ getConversationUnreadCount(order.conversation, 'owner') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'owner')}` : '沟通已读' }}
              </AppTag>
            </view>

            <view class="owner-order-card__conversation">
              <text class="owner-order-card__conversation-title">订单沟通</text>
              <text class="owner-order-card__conversation-text">{{ getConversationPreview(order.conversation) }}</text>
              <text class="owner-order-card__conversation-meta">{{ getConversationHint(order.conversation, 'owner') }}</text>
            </view>

            <view class="owner-order-card__footer">
              <text class="owner-order-card__amount">实付 ¥{{ formatAmount(order.amountPaid) }} / 已退 ¥{{ formatAmount(order.amountRefunded) }}</text>
              <view class="owner-order-card__actions">
                <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
                <AppButton size="medium" @click="openOrderDetail(order.id, 'overview')">详情</AppButton>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="owner-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步订单数据' : '还没有订单，先去发布需求。'" />
        </view>
      </AppSection>

      <AppSection title="推荐照料者" description="用当前宠物和最近需求做轻量匹配，帮助你快速开始比较。">
        <view v-if="caregiverHighlights.length" class="owner-caregiver-grid">
          <view v-for="caregiver in caregiverHighlights" :key="caregiver.serviceId" class="owner-caregiver-card">
            <text class="owner-caregiver-card__name">{{ caregiver.caregiverName }}</text>
            <text class="owner-caregiver-card__meta">
              {{ serviceTypeLabels[caregiver.serviceType] }} · {{ speciesLabels[caregiver.petSpecies] }}
            </text>
            <text class="owner-caregiver-card__meta">
              {{ caregiver.city || '城市待补充' }} · 评分 {{ formatAmount(caregiver.ratingAvg) }}
            </text>
            <text class="owner-caregiver-card__price">¥{{ formatAmount(caregiver.pricePerUnit) }}/{{ caregiver.unitType }}</text>
          </view>
        </view>
        <view v-else class="owner-empty">
          <AppStatus text="补齐宠物与需求后，这里会提供更准确的照料者推荐。" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始使用主人任务流" description="登录后可维护宠物资料、发布需求并跟进服务订单。">
        <view class="owner-empty owner-empty--login">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.owner-hero {
  display: grid;
  gap: 20rpx;
}

.owner-hero__copy {
  display: grid;
  gap: 12rpx;
}

.owner-hero__title {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.owner-hero__summary {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.owner-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.owner-metric-grid,
.owner-quick-grid,
.owner-caregiver-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.owner-metric-card,
.owner-quick-card,
.owner-caregiver-card,
.owner-panel,
.owner-order-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 26rpx;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.owner-metric-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.owner-metric-card__value {
  color: var(--app-text);
  font-size: 42rpx;
  line-height: 1.05;
  font-weight: 700;
}

.owner-metric-card__hint,
.owner-quick-card__text,
.owner-caregiver-card__meta,
.owner-mini-list__meta,
.owner-order-card__meta,
.owner-order-card__conversation-meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.owner-quick-card {
  cursor: pointer;
  background:
    radial-gradient(circle at top right, rgba(20, 184, 166, 0.12), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f7fbfb 100%);
}

.owner-quick-card__title,
.owner-panel__title,
.owner-caregiver-card__name,
.owner-order-card__title,
.owner-mini-list__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.owner-caregiver-card__price,
.owner-order-card__amount {
  color: #0f766e;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.owner-panels,
.owner-order-list {
  display: grid;
  gap: 16rpx;
}

.owner-panel__header,
.owner-order-card__header,
.owner-order-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.owner-mini-list {
  display: grid;
  gap: 12rpx;
}

.owner-mini-list__item {
  display: grid;
  gap: 6rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: var(--app-surface-soft);
}

.owner-order-card__headline {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.owner-order-card__conversation {
  display: grid;
  gap: 8rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: #eefaf7;
}

.owner-order-card__conversation-title {
  color: #0f766e;
  font-size: 20rpx;
  font-weight: 700;
}

.owner-order-card__conversation-text {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.owner-order-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.owner-empty {
  padding: 8rpx 0;
}

.owner-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .owner-metric-grid,
  .owner-quick-grid,
  .owner-caregiver-grid {
    grid-template-columns: 1fr;
  }

  .owner-panel__header,
  .owner-order-card__header,
  .owner-order-card__footer {
    flex-direction: column;
  }
}
</style>
