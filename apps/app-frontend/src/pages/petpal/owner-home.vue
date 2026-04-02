<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人
 * Entry: 从角色入口进入、从订单/售后返回首页、打开 App 后继续上次任务
 * First screen: 先看到“今天最该做什么”和最近订单，不先看产品说明
 * Primary action: 根据当前状态直接去建档、发需求、跟单或售后
 * Secondary actions: 消息、提醒、宠物档案
 * States: 未登录、无宠物、无订单、有进行中订单、有售后、有未读消息
 */
import type {
  MatchedCaregiverRecord,
  OrderRecord,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import ActionSignalCard from './components/action-signal-card.vue'
import {
  buildOwnerMatchQuery,
  formatAmount,
  formatCaregiverExperience,
  formatCaregiverNoticeHours,
  formatCaregiverRadius,
  formatDistanceKm,
  formatPetTagSummary,
  formatRange,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getRequestStatusLabel,
  isRequestActive,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
  PETPAL_REQUEST_PAGE,
  openPetPalAction,
  serviceTypeLabels,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalOwnerHomePage',
})

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: 'PetPal 主人首页',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()

const loading = ref(false)
const selectedPetId = ref('')
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const readyPetCount = computed(() => pets.value.filter(item => (
  Boolean(item.feedingNote?.trim())
  && Boolean(item.emergencyContact?.name?.trim())
  && Boolean(item.emergencyContact?.phone?.trim())
)).length)
const activeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)
const aftersaleCount = computed(() => orders.value.filter(item => isOrderAftersalesTracked(item)).length)
const activeRequestCount = computed(() => requests.value.filter(item => (
  item.status === 'OPEN'
  || item.status === 'MATCHED'
)).length)
const unreadConversationCount = computed(() => orders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0))

const latestOrders = computed(() => [...orders.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 3))
const latestActiveRequest = computed(() => [...requests.value]
  .filter(item => isRequestActive(item.status))
  .sort((left, right) => {
    const leftRank = left.status === 'MATCHED' ? 0 : 1
    const rightRank = right.status === 'MATCHED' ? 0 : 1
    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })[0] ?? null)
const latestRequests = computed(() => [...requests.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 2))
const caregiverHighlights = computed(() => caregivers.value.slice(0, 2))
const focusPet = computed(() => {
  if (selectedPetId.value) {
    return pets.value.find(item => item.id === selectedPetId.value) ?? null
  }
  return pets.value[0] ?? null
})
const focusOrder = computed(() => [...orders.value]
  .sort((left, right) => {
    const leftRank = isOrderAftersalesTracked(left)
      ? 0
      : left.orderStatus === 'SERVING'
        ? 1
        : left.orderStatus === 'ACCEPTED'
          ? 2
          : left.orderStatus === 'PENDING_ACCEPT'
            ? 3
            : 4
    const rightRank = isOrderAftersalesTracked(right)
      ? 0
      : right.orderStatus === 'SERVING'
        ? 1
        : right.orderStatus === 'ACCEPTED'
          ? 2
          : right.orderStatus === 'PENDING_ACCEPT'
            ? 3
            : 4
    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })[0] ?? null)

const heroTags = computed(() => [
  { label: `${pets.value.length} 只宠物`, type: 'primary' as const },
  { label: `${activeRequestCount.value} 条需求`, type: activeRequestCount.value > 0 ? 'warning' as const : 'default' as const },
  { label: `${activeOrderCount.value} 笔进行中`, type: activeOrderCount.value > 0 ? 'warning' as const : 'default' as const },
  { label: unreadConversationCount.value > 0 ? `${unreadConversationCount.value} 条未读` : '消息已读完', type: unreadConversationCount.value > 0 ? 'danger' as const : 'default' as const },
])

const metricTiles = computed(() => [
  {
    label: '宠物',
    value: String(pets.value.length),
    helper: readyPetCount.value ? `${readyPetCount.value} 只可直接复用` : '先补第一只',
    action: openPets,
  },
  {
    label: '需求',
    value: String(activeRequestCount.value),
    helper: activeRequestCount.value ? '继续推进' : '现在可新建',
    action: activeRequestCount.value ? openLatestRequest : () => openRequests(focusPet.value?.id),
  },
  {
    label: '订单',
    value: String(activeOrderCount.value),
    helper: activeOrderCount.value ? '直接跟单' : '当前空闲',
    action: openOrders,
  },
  {
    label: '售后',
    value: String(aftersaleCount.value),
    helper: aftersaleCount.value ? '优先处理' : '当前平稳',
    action: openAftersales,
  },
])

const agendaTiles = computed(() => {
  const items: Array<{
    eyebrow: string
    title: string
    meta: string
    actionLabel: string
    action: () => void
  }> = []

  if (!pets.value.length) {
    items.push({
      eyebrow: '宠物',
      title: '补第一只宠物档案',
      meta: '名字、照料偏好和紧急联系人先录进去。',
      actionLabel: '去建档',
      action: openPets,
    })
  }
  else if (focusPet.value) {
    items.push({
      eyebrow: '宠物',
      title: focusPet.value.name,
      meta: `${speciesLabels[focusPet.value.species]}${focusPet.value.breed ? ` · ${focusPet.value.breed}` : ''}`,
      actionLabel: '用它发需求',
      action: () => openRequests(focusPet.value!.id),
    })
  }

  if (latestActiveRequest.value) {
    items.push({
      eyebrow: '需求',
      title: `${latestActiveRequest.value.pet?.name || '宠物'} · ${serviceTypeLabels[latestActiveRequest.value.serviceType]}`,
      meta: `${getRequestStatusLabel(latestActiveRequest.value.status)} · ${formatRange(latestActiveRequest.value.startTime, latestActiveRequest.value.endTime)}`,
      actionLabel: '继续处理',
      action: openLatestRequest,
    })
  }

  if (focusOrder.value) {
    items.push({
      eyebrow: '订单',
      title: focusOrder.value.orderNo,
      meta: `${getOrderStatusLabel(focusOrder.value.orderStatus)} · ${getConversationHint(focusOrder.value.conversation, 'owner')}`,
      actionLabel: isOrderAftersalesTracked(focusOrder.value) ? '看售后' : '看订单',
      action: isOrderAftersalesTracked(focusOrder.value)
        ? () => openOrderDetail(focusOrder.value!.id, 'aftersales')
        : () => openOrderDetail(focusOrder.value!.id, 'overview'),
    })
  }

  if (!items.length) {
    items.push({
      eyebrow: '现在',
      title: '今天可以直接发新需求',
      meta: '先选宠物，再补时间地点，然后继续筛人下单。',
      actionLabel: '发需求',
      action: openRequests,
    })
  }

  return items.slice(0, 3)
})

const primaryAction = computed(() => {
  if (!pets.value.length) {
    return {
      tone: 'pet',
      title: '先把第一只宠物建好',
      label: '先建宠物档案',
      hint: '档案建好后，发需求和跟单都会更顺。',
      meta: '档案建好后，发需求和跟单都会更顺。',
      action: openPets,
    }
  }
  if (aftersaleCount.value > 0) {
    return {
      tone: 'danger',
      title: '先处理售后',
      label: '处理售后',
      hint: `${aftersaleCount.value} 笔订单涉及退款或投诉，优先处理。`,
      meta: `${aftersaleCount.value} 笔订单涉及退款或投诉，优先处理。`,
      action: openAftersales,
    }
  }
  if (focusOrder.value) {
    return {
      tone: 'order',
      title: `继续跟进 ${getOrderStatusLabel(focusOrder.value.orderStatus)}`,
      label: '查看进行中订单',
      hint: `${focusOrder.value.orderNo} · ${formatRange(focusOrder.value.appointmentStart, focusOrder.value.appointmentEnd)}`,
      meta: `${focusOrder.value.orderNo} · ${formatRange(focusOrder.value.appointmentStart, focusOrder.value.appointmentEnd)}`,
      action: () => openOrderDetail(focusOrder.value!.id, 'overview'),
    }
  }
  if (activeRequestCount.value > 0) {
    return {
      tone: 'request',
      title: '继续当前需求',
      label: '继续当前需求',
      hint: `${activeRequestCount.value} 条需求还在推进。`,
      meta: `${activeRequestCount.value} 条需求还在推进。`,
      action: openLatestRequest,
    }
  }
  return {
    tone: 'fresh',
    title: '直接发一个新需求',
    label: '新建照料需求',
    hint: '今天还没有进行中的订单，可以直接开始新需求。',
    meta: '今天还没有进行中的订单，可以直接开始新需求。',
    action: openRequests,
  }
})

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function selectPet(petId: string) {
  selectedPetId.value = petId
}

function openPets() {
  openPetPalAction('redirect', PETPAL_PETS_PAGE)
}

function openRequests(petId?: string) {
  const query = petId ? `?petId=${petId}` : ''
  openPetPalAction('redirect', `${PETPAL_REQUEST_PAGE}${query}`)
}

function openLatestRequest() {
  if (latestActiveRequest.value) {
    openPetPalAction('redirect', `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${latestActiveRequest.value.id}`)
    return
  }
  openRequests()
}

function openOrders() {
  openPetPalAction('redirect', PETPAL_ORDERS_PAGE)
}

function openAftersales() {
  openPetPalAction('redirect', PETPAL_AFTERSALES_PAGE)
}

function openMessages() {
  openPetPalAction('navigate', PETPAL_MESSAGES_PAGE)
}

function openOrderDetail(orderId: string, tab: 'overview' | 'chat' | 'aftersales' = 'overview') {
  uni.navigateTo({ url: `${PETPAL_ORDER_DETAIL_PAGE}?id=${orderId}&tab=${tab}` })
}

function openRequestDetail(requestId: string) {
  uni.navigateTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${requestId}` })
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

    const latestPetId = selectedPetId.value && petRows.some(item => item.id === selectedPetId.value)
      ? selectedPetId.value
      : requestRows[0]?.petId || petRows[0]?.id || ''
    selectedPetId.value = latestPetId

    const latestPet = petRows.find(item => item.id === latestPetId) || petRows[0]
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
  void notificationStore.refreshNotifications()
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="主人首页">
    <template v-if="tokenStore.hasLogin">
      <view class="owner-home">
        <view class="owner-focus" :class="`owner-focus--${primaryAction.tone}`">
          <view class="owner-focus__copy">
            <text class="owner-focus__eyebrow">{{ displayName }}</text>
            <text class="owner-focus__title">{{ primaryAction.title }}</text>
            <text class="owner-focus__hint">{{ primaryAction.meta }}</text>
          </view>
          <view class="owner-focus__tags">
            <AppTag v-for="item in heroTags" :key="item.label" :type="item.type">{{ item.label }}</AppTag>
          </view>
          <view class="owner-focus__actions">
            <AppButton size="medium" @click="primaryAction.action">{{ primaryAction.label }}</AppButton>
            <AppButton size="medium" type="info" @click="openPets">宠物</AppButton>
            <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
          </view>
        </view>

        <scroll-view class="owner-metric-scroll" :scroll-x="true" :show-scrollbar="false">
          <view class="owner-metric-track">
            <view
              v-for="item in metricTiles"
              :key="item.label"
              class="owner-metric-tile"
              hover-class="owner-metric-tile--hover"
              :hover-stay-time="80"
              @click="item.action"
            >
              <text class="owner-metric-tile__label">{{ item.label }}</text>
              <text class="owner-metric-tile__value">{{ item.value }}</text>
              <text class="owner-metric-tile__helper">{{ item.helper }}</text>
            </view>
          </view>
        </scroll-view>

        <ActionSignalCard title="当前优先" scope="OWNER" empty-text="当前没有新的高优先事项，可以继续宠物、需求或订单主流程。" />

        <view class="owner-agenda-grid">
          <view
            v-for="item in agendaTiles"
            :key="`${item.eyebrow}-${item.title}`"
            class="owner-agenda-tile"
            hover-class="owner-agenda-tile--hover"
            :hover-stay-time="80"
            @click="item.action"
          >
            <text class="owner-agenda-tile__eyebrow">{{ item.eyebrow }}</text>
            <text class="owner-agenda-tile__title">{{ item.title }}</text>
            <text class="owner-agenda-tile__meta">{{ item.meta }}</text>
            <text class="owner-agenda-tile__action">{{ item.actionLabel }}</text>
          </view>
        </view>

        <view v-if="latestActiveRequest" class="owner-focus-panel owner-focus-panel--request">
          <text class="owner-focus-panel__title">{{ latestActiveRequest.pet?.name || '宠物' }} · {{ serviceTypeLabels[latestActiveRequest.serviceType] }}</text>
          <text class="owner-focus-panel__meta">{{ getRequestStatusLabel(latestActiveRequest.status) }} · {{ formatRange(latestActiveRequest.startTime, latestActiveRequest.endTime) }}</text>
          <text class="owner-focus-panel__meta">{{ latestActiveRequest.locationText }}</text>
          <view class="owner-focus__actions">
            <AppButton size="medium" @click="openLatestRequest">继续处理</AppButton>
            <AppButton size="medium" type="info" @click="openRequests(latestActiveRequest.petId)">新开一条</AppButton>
          </view>
        </view>

        <template v-if="pets.length && focusPet">
          <scroll-view class="owner-card-scroll" :scroll-x="true" :show-scrollbar="false">
            <view class="owner-pet-strip">
              <view
                v-for="pet in pets"
                :key="pet.id"
                class="owner-pet-chip"
                :class="pet.id === focusPet.id ? 'owner-pet-chip--active' : ''"
                @click="selectPet(pet.id)"
              >
                <text class="owner-pet-chip__name">{{ pet.name }}</text>
                <text class="owner-pet-chip__meta">{{ speciesLabels[pet.species] }}</text>
              </view>
            </view>
          </scroll-view>
          <view class="owner-focus-panel">
            <text class="owner-focus-panel__title">{{ focusPet.name }}</text>
            <text class="owner-focus-panel__meta">{{ speciesLabels[focusPet.species] }}{{ focusPet.breed ? ` · ${focusPet.breed}` : '' }}</text>
            <text class="owner-focus-panel__meta">{{ formatPetTagSummary(focusPet.temperamentTags) }}</text>
            <text class="owner-focus-panel__meta">{{ focusPet.feedingNote || '喂养说明待补充' }}</text>
            <text class="owner-focus-panel__meta">{{ focusPet.emergencyContact ? `${focusPet.emergencyContact.name} · ${focusPet.emergencyContact.phone}` : '紧急联系人待补充' }}</text>
            <view class="owner-focus__actions">
              <AppButton size="medium" @click="openRequests(focusPet.id)">用它发需求</AppButton>
              <AppButton size="medium" type="info" @click="openPets">编辑档案</AppButton>
            </view>
          </view>
        </template>
        <view v-else class="owner-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步宠物资料' : '还没有宠物档案'" />
          <AppButton block @click="openPets">去建档</AppButton>
        </view>

        <view v-if="focusOrder" class="owner-focus-panel owner-focus-panel--order">
          <text class="owner-focus-panel__title">{{ focusOrder.orderNo }}</text>
          <text class="owner-focus-panel__meta">{{ getOrderStatusLabel(focusOrder.orderStatus) }} · {{ formatRange(focusOrder.appointmentStart, focusOrder.appointmentEnd) }}</text>
          <text class="owner-focus-panel__meta">实付 ¥{{ formatAmount(focusOrder.amountPaid) }} · 已退 ¥{{ formatAmount(focusOrder.amountRefunded) }}</text>
          <text class="owner-focus-panel__meta">{{ getConversationPreview(focusOrder.conversation) }}</text>
          <view class="owner-focus__actions">
            <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
            <AppButton size="medium" @click="openOrders">去订单</AppButton>
            <AppButton size="medium" type="info" @click="openOrderDetail(focusOrder.id, 'aftersales')">售后</AppButton>
          </view>
        </view>

        <scroll-view v-if="caregiverHighlights.length" class="owner-card-scroll" :scroll-x="true" :show-scrollbar="false">
          <view class="owner-card-track">
            <view v-for="item in caregiverHighlights" :key="item.serviceId" class="owner-trust-card" @click="openLatestRequest">
              <text class="owner-trust-card__title">{{ item.caregiverName }}</text>
              <text class="owner-trust-card__meta">¥{{ formatAmount(item.pricePerUnit) }}/{{ item.unitType }} · {{ formatDistanceKm(item.distanceKm) }}</text>
              <text class="owner-trust-card__meta">{{ formatCaregiverExperience(item.experienceYears) }} · {{ formatCaregiverRadius(item.serviceRadiusKm) }}</text>
              <text class="owner-trust-card__meta">{{ formatCaregiverNoticeHours(item.minNoticeHours) }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </template>

    <template v-else>
      <view class="owner-home">
        <view class="owner-focus owner-focus--guest">
          <view class="owner-focus__copy">
            <text class="owner-focus__eyebrow">PetPal</text>
            <text class="owner-focus__title">登录后开始照料主流程</text>
            <text class="owner-focus__hint">建档、发需求、跟单和售后都会从这里继续。</text>
          </view>
          <AppButton block @click="goToLogin">去登录</AppButton>
        </view>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.owner-home {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.owner-focus {
  display: grid;
  gap: 18rpx;
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: 32rpx;
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.16), transparent 36%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.owner-focus--request,
.owner-focus--fresh {
  background:
    radial-gradient(circle at top right, rgba(11, 122, 117, 0.18), transparent 36%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.owner-focus--order {
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.18), transparent 36%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.owner-focus--danger {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(248, 221, 221, 0.9) 0%, var(--app-surface) 100%);
}

.owner-focus__copy {
  display: grid;
  gap: 10rpx;
}

.owner-focus__eyebrow,
.owner-agenda-tile__eyebrow,
.owner-metric-tile__label,
.owner-metric-tile__helper {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.owner-focus__title {
  color: var(--app-text);
  font-size: 38rpx;
  line-height: 1.24;
  font-weight: 700;
}

.owner-focus__hint {
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.68;
}

.owner-focus__tags,
.owner-focus__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.owner-metric-scroll,
.owner-card-scroll {
  white-space: nowrap;
}

.owner-metric-track,
.owner-card-track,
.owner-pet-strip {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.owner-metric-tile,
.owner-agenda-tile,
.owner-trust-card,
.owner-pet-chip,
.owner-focus-panel,
.owner-stack-row {
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
  box-shadow: var(--app-elevation-1);
}

.owner-metric-tile {
  width: 210rpx;
  display: grid;
  gap: 8rpx;
  padding: 22rpx 24rpx;
  border-radius: 28rpx;
  box-sizing: border-box;
}

.owner-metric-tile__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.1;
  font-weight: 700;
}

.owner-agenda-grid {
  display: grid;
  gap: 16rpx;
}

.owner-agenda-grid {
  padding: 0 24rpx;
}

.owner-agenda-tile,
.owner-focus-panel,
.owner-stack-row {
  margin: 0 24rpx;
  padding: 22rpx 24rpx;
  border-radius: 30rpx;
}

.owner-agenda-tile {
  display: grid;
  gap: 10rpx;
}

.owner-agenda-tile__title,
.owner-trust-card__title,
.owner-pet-chip__name,
.owner-focus-panel__title,
.owner-stack-row__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.42;
  font-weight: 700;
}

.owner-agenda-tile__meta,
.owner-agenda-tile__action,
.owner-trust-card__meta,
.owner-pet-chip__meta,
.owner-focus-panel__meta,
.owner-stack-row__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.62;
}

.owner-agenda-tile__action {
  color: var(--app-accent);
  font-weight: 700;
}

.owner-trust-card {
  width: 400rpx;
  display: grid;
  gap: 8rpx;
  padding: 22rpx 24rpx;
  border-radius: 28rpx;
  box-sizing: border-box;
}

.owner-pet-chip {
  width: 170rpx;
  display: grid;
  gap: 6rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  box-sizing: border-box;
}

.owner-pet-chip--active {
  border-color: transparent;
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.owner-focus-panel--request {
  background:
    radial-gradient(circle at top right, rgba(11, 122, 117, 0.18), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.owner-focus-panel--order {
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.18), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.owner-stack-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.owner-stack-row__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
  flex: 1;
}

.owner-empty {
  margin: 0 24rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
  box-shadow: var(--app-elevation-1);
}

@media (max-width: 680px) {
  .owner-metric-tile {
    width: 198rpx;
  }

  .owner-trust-card {
    width: 360rpx;
  }
}
</style>
