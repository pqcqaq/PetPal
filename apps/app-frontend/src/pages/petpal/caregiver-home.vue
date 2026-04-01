<script lang="ts" setup>
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
} from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppCard from '@/components/app-card/app-card.vue'
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
  formatRange,
  getCaregiverAuditHint,
  getCaregiverAuditLabel,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOrderStatusLabel,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
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

const loading = ref(false)
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || '照料者')
const pendingOrderCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT').length)
const servingOrderCount = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING').length)
const unreadConversationCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0))
const activeServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '围绕照料者审核、服务配置、履约订单和消息协同重新组织移动端主流程。'
    : '登录后进入照料者任务流。'
))

const summaryCards = computed(() => [
  {
    label: '审核状态',
    value: caregiverProfile.value ? getCaregiverAuditLabel(caregiverProfile.value.auditStatus) : '待创建',
    hint: caregiverProfile.value ? getCaregiverAuditHint(caregiverProfile.value.auditStatus) : '先完善入驻资料与资质材料。',
  },
  {
    label: '上架服务',
    value: String(activeServiceCount.value),
    hint: activeServiceCount.value ? '保持价格、城市和时效信息最新。' : '至少配置一个可售服务。',
  },
  {
    label: '待接单',
    value: String(pendingOrderCount.value),
    hint: pendingOrderCount.value ? '及时接单，避免订单流失。' : '当前没有新的待接单。',
  },
  {
    label: '消息未读',
    value: String(unreadConversationCount.value),
    hint: unreadConversationCount.value ? '优先确认交接、异常和附件回传。' : '当前沟通都已读。',
  },
])

const latestOrders = computed(() => [...caregiverOrders.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 3))
const latestServices = computed(() => caregiverServices.value.slice(0, 3))

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
  uni.redirectTo({ url: PETPAL_MESSAGES_PAGE })
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
      listCaregiverOrders({ page: 1, pageSize: 8 }),
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
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="照料者首页" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_HOME_PAGE"
        title="照料者日常工作流"
        description="从审核状态、服务上架到接单履约，照料者侧流程已开始拆成独立页面，而不是继续塞进兼容工作台。"
      />

      <AppSection title="当前态势" description="把今天需要优先处理的审核、订单与沟通放到第一屏。">
        <AppCard>
          <view class="caregiver-hero">
            <view class="caregiver-hero__copy">
              <AppTag :type="getAuditTagType()">
                {{ caregiverProfile ? getCaregiverAuditLabel(caregiverProfile.auditStatus) : '待创建档案' }}
              </AppTag>
              <text class="caregiver-hero__title">{{ displayName }}</text>
              <text class="caregiver-hero__summary">
                当前有 {{ pendingOrderCount }} 笔待接单、{{ servingOrderCount }} 笔服务中订单和 {{ unreadConversationCount }} 条未读沟通。
              </text>
            </view>
            <view class="caregiver-hero__actions">
              <AppButton size="medium" @click="openOrders">处理订单</AppButton>
              <AppButton size="medium" type="info" @click="openEarnings">收益表现</AppButton>
              <AppButton size="medium" type="info" @click="openMessages">查看消息</AppButton>
            </view>
          </view>
        </AppCard>

        <view class="caregiver-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="caregiver-metric-card">
            <text class="caregiver-metric-card__label">{{ item.label }}</text>
            <text class="caregiver-metric-card__value">{{ item.value }}</text>
            <text class="caregiver-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="快捷推进" description="围绕照料者的真实动作拆开入口。">
        <view class="caregiver-quick-grid">
          <view class="caregiver-quick-card" @click="openProfile">
            <text class="caregiver-quick-card__title">完善入驻资料</text>
            <text class="caregiver-quick-card__text">维护介绍、经验、服务城市和资质材料。</text>
          </view>
          <view class="caregiver-quick-card" @click="openServices">
            <text class="caregiver-quick-card__title">管理服务配置</text>
            <text class="caregiver-quick-card__text">调整报价、适配宠物、服务半径和上架状态。</text>
          </view>
          <view class="caregiver-quick-card" @click="openOrders">
            <text class="caregiver-quick-card__title">处理履约订单</text>
            <text class="caregiver-quick-card__text">完成接单、签到、服务记录和签退动作。</text>
          </view>
          <view class="caregiver-quick-card" @click="openEarnings">
            <text class="caregiver-quick-card__title">查看收益表现</text>
            <text class="caregiver-quick-card__text">汇总收入、评分、完成率和售后风险。</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="档案与服务概览">
        <view class="caregiver-panels">
          <view class="caregiver-panel">
            <view class="caregiver-panel__header">
              <text class="caregiver-panel__title">入驻资料</text>
              <AppButton size="medium" type="info" @click="openProfile">维护</AppButton>
            </view>
            <template v-if="caregiverProfile">
              <text class="caregiver-panel__meta">
                {{ caregiverProfile.serviceCity || '城市待完善' }} · {{ caregiverProfile.experienceYears }} 年经验 · {{ caregiverProfile.serviceRadiusKm }}km 半径
              </text>
              <text class="caregiver-panel__note">{{ caregiverProfile.intro || '还没有填写服务介绍。' }}</text>
              <text class="caregiver-panel__meta">
                资质材料 {{ caregiverProfile.qualificationMaterials.length }} 份 · 评分 {{ formatAmount(caregiverProfile.ratingAvg) }}
              </text>
            </template>
            <AppStatus v-else text="还没有照料者档案，先去补齐入驻资料。" />
          </view>

          <view class="caregiver-panel">
            <view class="caregiver-panel__header">
              <text class="caregiver-panel__title">当前服务</text>
              <AppButton size="medium" type="info" @click="openServices">查看</AppButton>
            </view>
            <view v-if="latestServices.length" class="caregiver-mini-list">
              <view v-for="service in latestServices" :key="service.id" class="caregiver-mini-list__item">
                <text class="caregiver-mini-list__title">{{ serviceTypeLabels[service.serviceType] }} · {{ speciesLabels[service.petSpecies] }}</text>
                <text class="caregiver-mini-list__meta">
                  {{ service.serviceCity || '城市待完善' }} · ¥{{ formatAmount(service.pricePerUnit) }}/{{ service.unitType }}
                </text>
                <text class="caregiver-mini-list__meta">
                  提前 {{ service.minNoticeHours }} 小时 · {{ service.isActive ? '已上架' : '已停用' }}
                </text>
              </view>
            </view>
            <AppStatus v-else text="还没有服务配置，先新增一个可售服务。" />
          </view>
        </view>
      </AppSection>

      <AppSection title="履约订单" description="优先显示需要立即接单或继续服务反馈的订单。">
        <view v-if="latestOrders.length" class="caregiver-order-list">
          <view v-for="order in latestOrders" :key="order.id" class="caregiver-order-card">
            <view class="caregiver-order-card__header">
              <view class="caregiver-order-card__headline">
                <text class="caregiver-order-card__title">{{ order.orderNo }}</text>
                <text class="caregiver-order-card__meta">
                  {{ getOrderStatusLabel(order.orderStatus) }} · {{ formatRange(order.appointmentStart, order.appointmentEnd) }}
                </text>
              </view>
              <AppTag :type="getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? 'warning' : 'default'">
                {{ getConversationUnreadCount(order.conversation, 'caregiver') > 0 ? `待读 ${getConversationUnreadCount(order.conversation, 'caregiver')}` : '沟通已读' }}
              </AppTag>
            </view>

            <text class="caregiver-order-card__meta">
              {{ order.petName || '宠物待补充' }} · {{ order.ownerNickname }} · {{ order.locationText || '地点待补充' }}
            </text>

            <view class="caregiver-order-card__conversation">
              <text class="caregiver-order-card__conversation-title">订单沟通</text>
              <text class="caregiver-order-card__conversation-text">{{ getConversationPreview(order.conversation) }}</text>
              <text class="caregiver-order-card__conversation-meta">{{ getConversationHint(order.conversation, 'caregiver') }}</text>
            </view>

            <view class="caregiver-order-card__footer">
              <text class="caregiver-order-card__amount">实收 ¥{{ formatAmount(order.amountPaid) }}</text>
              <view class="caregiver-order-card__actions">
                <AppButton size="medium" type="info" @click="openOrderDetail(order.id, 'chat')">沟通</AppButton>
                <AppButton size="medium" @click="openOrderDetail(order.id, 'service')">履约</AppButton>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="caregiver-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步履约订单' : '当前没有需要处理的照料订单'" />
        </view>
      </AppSection>

      <AppSection title="工作提示" description="帮助照料者优先处理高风险动作。">
        <view class="caregiver-tip-list">
          <view class="caregiver-tip-card">
            <text class="caregiver-tip-card__title">审核与上架</text>
            <text class="caregiver-tip-card__text">档案未完善或审核未通过时，优先补齐资质材料与服务承诺。</text>
          </view>
          <view class="caregiver-tip-card">
            <text class="caregiver-tip-card__title">订单响应</text>
            <text class="caregiver-tip-card__text">待接单和未读沟通决定了订单流失风险，建议优先处理。</text>
          </view>
          <view class="caregiver-tip-card">
            <text class="caregiver-tip-card__title">服务记录</text>
            <text class="caregiver-tip-card__text">签到后及时上传服务日志，会直接提升主人信任和售后透明度。</text>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始进入照料者任务流">
        <view class="caregiver-empty caregiver-empty--login">
          <AppStatus text="登录后即可进入照料者工作流。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-hero {
  display: grid;
  gap: 20rpx;
}

.caregiver-hero__copy {
  display: grid;
  gap: 12rpx;
}

.caregiver-hero__title {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.caregiver-hero__summary {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.caregiver-hero__actions,
.caregiver-order-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.caregiver-metric-grid,
.caregiver-quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.caregiver-metric-card,
.caregiver-quick-card,
.caregiver-panel,
.caregiver-order-card,
.caregiver-tip-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 26rpx;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.caregiver-metric-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.caregiver-metric-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.caregiver-metric-card__hint,
.caregiver-quick-card__text,
.caregiver-panel__meta,
.caregiver-mini-list__meta,
.caregiver-order-card__meta,
.caregiver-order-card__conversation-meta,
.caregiver-tip-card__text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.caregiver-quick-card {
  cursor: pointer;
  background:
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.12), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #fffaf3 100%);
}

.caregiver-quick-card__title,
.caregiver-panel__title,
.caregiver-order-card__title,
.caregiver-tip-card__title,
.caregiver-mini-list__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.caregiver-panels,
.caregiver-order-list,
.caregiver-tip-list,
.caregiver-mini-list {
  display: grid;
  gap: 16rpx;
}

.caregiver-panel__header,
.caregiver-order-card__header,
.caregiver-order-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.caregiver-panel__note {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
}

.caregiver-mini-list__item {
  display: grid;
  gap: 6rpx;
  padding: 16rpx 18rpx;
  border-radius: 18rpx;
  background: var(--app-surface-soft);
}

.caregiver-order-card__headline {
  display: grid;
  gap: 6rpx;
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

.caregiver-order-card__amount {
  color: #c2410c;
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.caregiver-empty {
  padding: 8rpx 0;
}

.caregiver-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .caregiver-metric-grid,
  .caregiver-quick-grid {
    grid-template-columns: 1fr;
  }

  .caregiver-panel__header,
  .caregiver-order-card__header,
  .caregiver-order-card__footer {
    flex-direction: column;
  }
}
</style>
