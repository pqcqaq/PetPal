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
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import ActionSignalCard from './components/action-signal-card.vue'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  buildOwnerMatchQuery,
  formatAmount,
  formatRange,
  getConversationUnreadCount,
  getOrderStatusLabel,
  getRequestStatusLabel,
  isRequestActive,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
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
const notificationStore = useNotificationStore()

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
const petHighlights = computed(() => pets.value.slice(0, 2))
const caregiverHighlights = computed(() => caregivers.value.slice(0, 2))

const primaryAction = computed(() => {
  if (!pets.value.length) {
    return {
      label: '先建宠物档案',
      hint: '没有宠物档案时，后续需求和订单都不好继续。',
      action: openPets,
    }
  }
  if (aftersaleCount.value > 0) {
    return {
      label: '处理售后',
      hint: `${aftersaleCount.value} 笔订单涉及退款或投诉，优先处理。`,
      action: openAftersales,
    }
  }
  if (activeOrderCount.value > 0) {
    return {
      label: '查看进行中订单',
      hint: `${activeOrderCount.value} 笔订单还在履约中。`,
      action: openOrders,
    }
  }
  if (activeRequestCount.value > 0) {
    return {
      label: '继续当前需求',
      hint: `${activeRequestCount.value} 条需求还在推进。`,
      action: openLatestRequest,
    }
  }
  return {
    label: '新建照料需求',
    hint: '今天还没有进行中的订单，可以直接开始新需求。',
    action: openRequests,
  }
})

const taskRows = computed(() => [
  {
    title: '宠物档案',
    label: pets.value.length
      ? `${pets.value.length} 只宠物可直接复用下单`
      : '先补第一只宠物的资料和照料偏好',
    value: pets.value.length ? '维护' : '建档',
    action: openPets,
  },
  {
    title: '照料需求',
    label: activeRequestCount.value
      ? `${activeRequestCount.value} 条需求还在推进`
      : '当前没有活跃需求，可新建一条',
    value: activeRequestCount.value ? '继续' : '创建',
    action: activeRequestCount.value ? openLatestRequest : openRequests,
  },
  {
    title: '订单处理',
    label: activeOrderCount.value
      ? `${activeOrderCount.value} 笔订单需要继续跟单`
      : '当前没有进行中订单',
    value: activeOrderCount.value ? '查看' : '浏览',
    action: openOrders,
  },
  {
    title: '售后处理',
    label: aftersaleCount.value
      ? `${aftersaleCount.value} 笔订单进入售后`
      : '当前没有售后事项',
    value: aftersaleCount.value ? '优先' : '查看',
    action: openAftersales,
  },
])

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openPets() {
  uni.redirectTo({ url: PETPAL_PETS_PAGE })
}

function openRequests() {
  uni.redirectTo({ url: PETPAL_REQUEST_PAGE })
}

function openLatestRequest() {
  if (latestActiveRequest.value) {
    uni.redirectTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${latestActiveRequest.value.id}` })
    return
  }
  openRequests()
}

function openOrders() {
  uni.redirectTo({ url: PETPAL_ORDERS_PAGE })
}

function openAftersales() {
  uni.redirectTo({ url: PETPAL_AFTERSALES_PAGE })
}

function openMessages() {
  uni.navigateTo({ url: PETPAL_MESSAGES_PAGE })
}

function openOrderDetail(orderId: string, tab: 'overview' | 'chat' = 'overview') {
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
  void notificationStore.refreshNotifications()
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="主人首页">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_OWNER_HOME_PAGE"
        title="主人首页"
      />

      <AppSection title="今天先做这个">
        <view class="owner-focus">
          <view class="owner-focus__copy">
            <view class="owner-focus__headline">
              <text class="owner-focus__title">{{ displayName }}</text>
              <view class="owner-focus__tags">
                <AppTag type="primary">{{ pets.length }} 只宠物</AppTag>
                <AppTag :type="activeOrderCount > 0 ? 'warning' : 'default'">{{ activeOrderCount }} 笔进行中</AppTag>
                <AppTag :type="aftersaleCount > 0 ? 'danger' : 'default'">{{ aftersaleCount }} 笔售后</AppTag>
              </view>
            </view>
            <text class="owner-focus__hint">{{ primaryAction.hint }}</text>
          </view>
          <view class="owner-focus__actions">
            <AppButton size="medium" @click="primaryAction.action">{{ primaryAction.label }}</AppButton>
            <AppButton size="medium" type="info" @click="openMessages">消息</AppButton>
            <AppButton size="medium" type="danger" @click="openAftersales">售后</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="当前优先">
        <ActionSignalCard
          title="待处理事项"
          scope="OWNER"
          empty-text="当前没有新的高优先事项，可以继续维护宠物、需求和订单。"
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

      <AppSection title="最近订单">
        <view v-if="latestOrders.length" class="owner-order-list">
          <view v-for="order in latestOrders" :key="order.id" class="owner-order-row">
            <view class="owner-order-row__headline">
              <view class="owner-order-row__copy">
                <text class="owner-order-row__title">{{ order.orderNo }}</text>
                <text class="owner-order-row__meta">
                  {{ getOrderStatusLabel(order.orderStatus) }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}
                </text>
                <text class="owner-order-row__meta">
                  实付 ¥{{ formatAmount(order.amountPaid) }} · 已退 ¥{{ formatAmount(order.amountRefunded) }}
                </text>
              </view>
              <AppTag :type="getConversationUnreadCount(order.conversation, 'owner') > 0 ? 'warning' : 'default'">
                {{ getConversationUnreadCount(order.conversation, 'owner') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'owner')}` : '已读' }}
              </AppTag>
            </view>
            <view class="owner-order-row__actions">
              <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
              <AppButton size="medium" @click="openOrderDetail(order.id, 'overview')">详情</AppButton>
            </view>
          </view>
        </view>
        <view v-else class="owner-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步订单' : '当前还没有订单'" />
        </view>
      </AppSection>

      <AppSection title="最近宠物和需求">
        <view class="owner-dual-grid">
          <AppList>
            <AppListItem
              v-for="pet in petHighlights"
              :key="pet.id"
              :title="pet.name"
              :label="`${speciesLabels[pet.species]}${pet.breed ? ` · ${pet.breed}` : ''}`"
              :value="`${pet.weightKg || '-'}kg`"
              value-emphasis
            />
            <view v-if="!petHighlights.length" class="owner-list-empty">
              <AppStatus text="还没有宠物档案" />
            </view>
          </AppList>

          <AppList>
            <AppListItem
              v-for="item in latestRequests"
              :key="item.id"
              :title="`${item.pet?.name || '宠物'} · ${serviceTypeLabels[item.serviceType]}`"
              :label="formatRange(item.startTime, item.endTime)"
              :value="getRequestStatusLabel(item.status)"
              value-emphasis
              clickable
              is-link
              @click="openRequestDetail(item.id)"
            />
            <view v-if="!latestRequests.length" class="owner-list-empty">
              <AppStatus text="当前还没有需求" />
            </view>
          </AppList>
        </view>
      </AppSection>

      <AppSection title="最近匹配">
        <AppList v-if="caregiverHighlights.length">
          <AppListItem
            v-for="caregiver in caregiverHighlights"
            :key="caregiver.serviceId"
            :title="caregiver.caregiverName"
            :label="`${serviceTypeLabels[caregiver.serviceType]} · ${speciesLabels[caregiver.petSpecies]} · ${caregiver.city || '城市待补充'}`"
            :value="`¥${formatAmount(caregiver.pricePerUnit)}/${caregiver.unitType}`"
            value-emphasis
          />
        </AppList>
        <view v-else class="owner-empty">
          <AppStatus text="补齐宠物和需求后，这里会出现更准确的匹配结果。" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后开始">
        <view class="owner-empty owner-empty--login">
          <AppStatus text="登录后即可管理宠物、需求、订单和售后。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.owner-focus {
  display: grid;
  gap: 16rpx;
  padding: 26rpx 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.owner-focus__copy,
.owner-focus__headline {
  display: grid;
  gap: 10rpx;
}

.owner-focus__title {
  color: var(--app-text);
  font-size: 38rpx;
  line-height: 1.2;
  font-weight: 700;
}

.owner-focus__hint {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}

.owner-focus__tags,
.owner-focus__actions,
.owner-order-row__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.owner-order-list {
  display: grid;
  gap: 16rpx;
}

.owner-order-row {
  display: grid;
  gap: 14rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.owner-order-row__headline {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.owner-order-row__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.owner-order-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.owner-order-row__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.owner-dual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.owner-empty,
.owner-list-empty {
  padding: 8rpx 0;
}

.owner-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .owner-dual-grid {
    grid-template-columns: 1fr;
  }

  .owner-order-row__headline {
    flex-direction: column;
  }
}
</style>
