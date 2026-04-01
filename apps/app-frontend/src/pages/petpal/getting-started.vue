<script lang="ts" setup>
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  OrderRecord,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common'
import { storeToRefs } from 'pinia'
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
  listOrders,
  listPets,
  listServiceRequests,
} from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  getCaregiverAuditLabel,
  isOrderAftersalesTracked,
  PETPAL_ACCOUNT_SUPPORT_PAGE,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_HELP_PAGE,
  PETPAL_HUB_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REMINDERS_PAGE,
  PETPAL_REQUEST_PAGE,
} from './owner-shared'

defineOptions({
  name: 'PetPalGettingStartedPage',
})

definePage({
  style: {
    navigationBarTitleText: '起步向导',
    enablePullDownRefresh: true,
  },
})

type GuideView = 'OWNER' | 'CAREGIVER'
type GuideStepStatus = 'DONE' | 'CURRENT' | 'UPCOMING'

type GuideStep = {
  key: string
  stage: number
  title: string
  summary: string
  detail: string
  status: GuideStepStatus
  actionLabel: string
  actionUrl: string
}

type SupportCard = {
  title: string
  text: string
  actionLabel: string
  actionUrl: string
  type: 'primary' | 'warning' | 'danger' | 'default'
}

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { unreadCount } = storeToRefs(notificationStore)

const loading = ref(false)
const guideView = ref<GuideView>('OWNER')
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])

const viewOptions = [
  { label: '主人路径', value: 'OWNER', description: '围绕建档、下单、订单与售后推进' },
  { label: '照料者路径', value: 'CAREGIVER', description: '围绕入驻、服务、接单与收益推进' },
]

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const ownerHasActiveRequests = computed(() => requests.value.some(item => (
  item.status === 'OPEN'
  || item.status === 'MATCHING'
  || item.status === 'CONFIRMED'
)))
const ownerHasOrders = computed(() => orders.value.length > 0)
const ownerHasFullLoop = computed(() => orders.value.some(item => (
  item.orderStatus === 'COMPLETED'
  || isOrderAftersalesTracked(item)
)))
const ownerAftersalesCount = computed(() => orders.value.filter(item => isOrderAftersalesTracked(item)).length)
const activeCaregiverServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)
const caregiverHasProfile = computed(() => Boolean(caregiverProfile.value))
const caregiverApproved = computed(() => caregiverProfile.value?.auditStatus === 'APPROVED')
const caregiverHasOrders = computed(() => caregiverOrders.value.length > 0)
const caregiverHasCompletedOrders = computed(() => caregiverOrders.value.some(item => item.orderStatus === 'COMPLETED'))
const caregiverPendingOrders = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT').length)

const ownerSteps = computed<GuideStep[]>(() => [
  {
    key: 'owner-pets',
    stage: 1,
    title: '建立宠物档案',
    summary: pets.value.length ? `已建档 ${pets.value.length} 只宠物，可继续复用到需求和订单。` : '先补齐第一只宠物的基础资料、喂养偏好和紧急联系人。',
    detail: pets.value.length
      ? '宠物档案已经是后续发布需求、查看订单和售后处理的统一基础数据。'
      : '没有宠物档案时，主人主流程会一直停留在入口层，后续需求和订单配置都无法稳定复用。',
    status: pets.value.length ? 'DONE' : 'CURRENT',
    actionLabel: pets.value.length ? '查看宠物档案' : '去建第一只宠物',
    actionUrl: PETPAL_PETS_PAGE,
  },
  {
    key: 'owner-request',
    stage: 2,
    title: '发布第一条照料需求',
    summary: requests.value.length ? `已累计 ${requests.value.length} 条需求，当前${ownerHasActiveRequests.value ? '仍有需求在流转。' : '可以继续优化下一次下单节奏。'}` : '把时间、地点、服务类型和预算先沉淀成一条真实需求。',
    detail: requests.value.length
      ? '需求发布页已经可以承接宠物档案与匹配逻辑，后续重点是继续优化时间安排和候选照料者筛选。'
      : '建档完成后先发出一条需求，用户才能真正体验匹配、沟通和下单的完整路径。',
    status: requests.value.length ? 'DONE' : (pets.value.length ? 'CURRENT' : 'UPCOMING'),
    actionLabel: requests.value.length ? '继续管理需求' : '去发布需求',
    actionUrl: PETPAL_REQUEST_PAGE,
  },
  {
    key: 'owner-orders',
    stage: 3,
    title: '开始跟进订单与沟通',
    summary: ownerHasOrders.value ? `当前已有 ${orders.value.length} 笔订单，可继续查看沟通、履约和进度。` : '订单跟进页负责承接沟通、履约记录、完成确认和状态变化。',
    detail: ownerHasOrders.value
      ? '订单详情已经按概览、沟通、履约和售后拆开，不需要再回到旧综合工作台处理。'
      : '只有进入订单流，主人端的沟通、履约透明度和售后处理能力才会真正形成闭环。',
    status: ownerHasOrders.value ? 'DONE' : (requests.value.length ? 'CURRENT' : 'UPCOMING'),
    actionLabel: ownerHasOrders.value ? '查看订单跟进' : '去订单页看看',
    actionUrl: PETPAL_ORDERS_PAGE,
  },
  {
    key: 'owner-followup',
    stage: 4,
    title: '形成通知、提醒与售后习惯',
    summary: ownerHasFullLoop.value
      ? `你已经走到订单后段流程${ownerAftersalesCount.value ? `，其中 ${ownerAftersalesCount.value} 笔仍需售后关注。` : '，可以继续通过通知和提醒保持节奏。'}`
      : '订单进入后段后，通知中心、提醒中心和售后中心会比首页提示更有效。',
    detail: ownerHasFullLoop.value
      ? '建议把通知中心作为统一收件箱，把提醒中心作为任务面板，把售后中心作为风险处理台。'
      : '这一阶段的重点不是新建更多入口，而是形成固定的收件和待办处理习惯，避免消息、退款和争议被遗漏。',
    status: ownerHasFullLoop.value ? 'DONE' : (ownerHasOrders.value ? 'CURRENT' : 'UPCOMING'),
    actionLabel: ownerAftersalesCount.value ? '进入售后中心' : '进入通知中心',
    actionUrl: ownerAftersalesCount.value ? PETPAL_AFTERSALES_PAGE : PETPAL_NOTIFICATIONS_PAGE,
  },
])

const caregiverSteps = computed<GuideStep[]>(() => [
  {
    key: 'caregiver-profile',
    stage: 1,
    title: '建立照料者档案',
    summary: caregiverHasProfile.value ? '照料者档案已建立，可继续维护介绍、城市和专长。' : '先把入驻资料、经验介绍和资质材料整理完整。',
    detail: caregiverHasProfile.value
      ? '入驻中心已经从旧工作台中独立出来，后续所有审核与服务配置都会围绕这份档案展开。'
      : '如果没有照料者档案，后面的审核、服务配置和接单都没有稳定落点。',
    status: caregiverHasProfile.value ? 'DONE' : 'CURRENT',
    actionLabel: caregiverHasProfile.value ? '继续维护档案' : '去建立档案',
    actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
  },
  {
    key: 'caregiver-audit',
    stage: 2,
    title: '推进审核通过',
    summary: caregiverHasProfile.value
      ? `当前审核状态：${getCaregiverAuditLabel(caregiverProfile.value?.auditStatus || 'PENDING')}`
      : '先完成档案，平台才能进入审核流程。',
    detail: caregiverApproved.value
      ? '审核已经通过，下一步重点转到服务上架和接单准备。'
      : '审核中的重点不是等待，而是继续补齐资料和材料，避免反复退回修改。',
    status: caregiverApproved.value ? 'DONE' : (caregiverHasProfile.value ? 'CURRENT' : 'UPCOMING'),
    actionLabel: caregiverApproved.value ? '查看审核档案' : '继续处理审核',
    actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
  },
  {
    key: 'caregiver-services',
    stage: 3,
    title: '上架至少一个服务',
    summary: activeCaregiverServiceCount.value
      ? `当前已上架 ${activeCaregiverServiceCount.value} 个服务，可继续优化价格和覆盖范围。`
      : '没有可售服务时，主人端无法稳定看到你的承接能力。',
    detail: activeCaregiverServiceCount.value
      ? '服务管理页已经能承接价格、服务范围、上架状态和能力表达。'
      : '服务是照料者端的真正商品层，没有这一步，审核通过后也无法顺利开始接单。',
    status: activeCaregiverServiceCount.value ? 'DONE' : (caregiverApproved.value ? 'CURRENT' : 'UPCOMING'),
    actionLabel: activeCaregiverServiceCount.value ? '继续管理服务' : '去上架服务',
    actionUrl: PETPAL_CAREGIVER_SERVICES_PAGE,
  },
  {
    key: 'caregiver-orders',
    stage: 4,
    title: '接第一单并保持履约回传',
    summary: caregiverHasOrders.value
      ? `当前已有 ${caregiverOrders.value.length} 笔履约订单${caregiverPendingOrders.value ? `，其中 ${caregiverPendingOrders.value} 笔待接单。` : '。'}`
      : '履约订单页负责承接接单、签到、服务日志和签退。',
    detail: caregiverHasOrders.value
      ? '一旦进入履约页，主人沟通、服务记录和风险反馈就不必再分散在多个入口里。'
      : '只有把接单和履约放到一个稳定页面里，照料者端才算真正进入可运营状态。',
    status: caregiverHasOrders.value ? 'DONE' : (activeCaregiverServiceCount.value ? 'CURRENT' : 'UPCOMING'),
    actionLabel: caregiverHasOrders.value ? '查看履约订单' : '去履约订单页',
    actionUrl: PETPAL_CAREGIVER_ORDERS_PAGE,
  },
  {
    key: 'caregiver-review',
    stage: 5,
    title: '用消息、通知和收益页做持续复盘',
    summary: caregiverHasCompletedOrders.value
      ? '你已经形成基础承接闭环，可以继续通过收益页和通知流做迭代。'
      : '接单后不要只看订单状态，还要固定查看消息、通知和收益表现。',
    detail: caregiverHasCompletedOrders.value
      ? '这一阶段建议重点看评分、净收入、售后风险和未读沟通，逐步形成稳定工作节奏。'
      : '照料者不只是“能接单”，更需要通过固定的回传、沟通和收益复盘把服务质量拉稳。',
    status: caregiverHasCompletedOrders.value ? 'DONE' : (caregiverHasOrders.value ? 'CURRENT' : 'UPCOMING'),
    actionLabel: caregiverHasCompletedOrders.value ? '查看收益表现' : '进入消息中心',
    actionUrl: caregiverHasCompletedOrders.value ? PETPAL_CAREGIVER_EARNINGS_PAGE : PETPAL_MESSAGES_PAGE,
  },
])

const ownerCompletedCount = computed(() => ownerSteps.value.filter(item => item.status === 'DONE').length)
const caregiverCompletedCount = computed(() => caregiverSteps.value.filter(item => item.status === 'DONE').length)
const currentSteps = computed(() => guideView.value === 'OWNER' ? ownerSteps.value : caregiverSteps.value)
const activeGuideSummary = computed(() => {
  if (guideView.value === 'OWNER') {
    if (!pets.value.length) {
      return '建议先建立第一只宠物档案，再继续发布需求。'
    }
    if (!requests.value.length) {
      return '主人路径下一步是把真实需求发出去，避免一直停留在浏览状态。'
    }
    if (!orders.value.length) {
      return '已经有建档和需求，下一步重点是把沟通和订单流走起来。'
    }
    return '主人路径已经进入后段流程，接下来重点放在通知、提醒和售后节奏。'
  }

  if (!caregiverHasProfile.value) {
    return '照料者路径第一优先级仍是建立档案，不要直接跳去履约页。'
  }
  if (!caregiverApproved.value) {
    return '档案已建立，但审核还未通过，建议继续补齐材料和说明。'
  }
  if (!activeCaregiverServiceCount.value) {
    return '审核通过后下一步不是等待，而是先上架至少一个服务。'
  }
  if (!caregiverHasOrders.value) {
    return '当前已经具备接单基础，下一步重点是进入履约订单页等待并处理首单。'
  }
  return '照料者路径已具备稳定工作基础，继续通过消息、通知和收益页做复盘。'
})

const summaryCards = computed(() => [
  {
    label: '主人进度',
    value: `${ownerCompletedCount.value}/${ownerSteps.value.length}`,
    hint: ownerHasOrders.value ? '主人主流程已经进入订单期。' : '先完成建档和需求发布。',
  },
  {
    label: '照料者进度',
    value: `${caregiverCompletedCount.value}/${caregiverSteps.value.length}`,
    hint: caregiverHasProfile.value ? '照料者主流程已经起步。' : '还没有建立照料者档案。',
  },
  {
    label: '未读通知',
    value: String(unreadCount.value),
    hint: unreadCount.value ? '通知中心里还有待消化的收件。' : '当前通知已清空或已读。',
  },
  {
    label: '当前重点',
    value: guideView.value === 'OWNER'
      ? (ownerHasActiveRequests.value ? '需求 / 订单' : '建档 / 发布')
      : (caregiverPendingOrders.value ? '待接单' : '入驻 / 服务'),
    hint: activeGuideSummary.value,
  },
])

const supportCards = computed<SupportCard[]>(() => [
  {
    title: '返回角色入口',
    text: '如果你不确定当前应该走主人路径还是照料者路径，先回到角色入口重新选择。',
    actionLabel: '打开角色入口',
    actionUrl: PETPAL_HUB_PAGE,
    type: 'primary',
  },
  {
    title: '统一查看通知与提醒',
    text: unreadCount.value
      ? `当前还有 ${unreadCount.value} 条未读通知，建议先在统一收件箱里处理。`
      : '通知中心负责收件，提醒中心负责待办优先级，建议把两者配合使用。',
    actionLabel: unreadCount.value ? '进入通知中心' : '进入提醒中心',
    actionUrl: unreadCount.value ? PETPAL_NOTIFICATIONS_PAGE : PETPAL_REMINDERS_PAGE,
    type: unreadCount.value ? 'danger' : 'warning',
  },
  {
    title: '查看帮助与账户支持',
    text: '如果你想先理解页面职责边界或当前账号还缺什么动作，再回到帮助中心和账户支持页。',
    actionLabel: '进入帮助中心',
    actionUrl: PETPAL_HELP_PAGE,
    type: 'default',
  },
  {
    title: '回到账户支持中心',
    text: '账户支持页会根据宠物、订单、照料者档案和体验设置继续给出推荐动作。',
    actionLabel: '进入账户支持',
    actionUrl: PETPAL_ACCOUNT_SUPPORT_PAGE,
    type: 'default',
  },
])

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? `${displayName.value}，起步向导会把主人与照料者两条路径拆成清晰步骤，并告诉你当前最值得先做哪一步。`
    : '登录后查看主人与照料者两条路径的起步步骤。'
))

function getStatusLabel(status: GuideStepStatus) {
  if (status === 'DONE') return '已完成'
  if (status === 'CURRENT') return '当前优先'
  return '稍后进入'
}

function getStatusTagType(status: GuideStepStatus) {
  if (status === 'DONE') return 'success'
  if (status === 'CURRENT') return 'danger'
  return 'default'
}

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function openLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function loadGuide(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      tokenStore.bootstrap(),
      userStore.fetchUserInfo().catch(() => undefined),
      notificationStore.refreshNotifications(),
    ])

    const [
      petsResult,
      requestsResult,
      ordersResult,
      caregiverProfileResult,
      caregiverServicesResult,
      caregiverOrdersResult,
    ] = await Promise.allSettled([
      listPets(),
      listServiceRequests(),
      listOrders(),
      getCaregiverProfile(),
      listCaregiverServices(),
      listCaregiverOrders({ page: 1, pageSize: 10 }),
    ])

    pets.value = petsResult.status === 'fulfilled' ? petsResult.value : []
    requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : []
    orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value : []
    caregiverProfile.value = caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null
    caregiverServices.value = caregiverServicesResult.status === 'fulfilled' ? caregiverServicesResult.value : []
    caregiverOrders.value = caregiverOrdersResult.status === 'fulfilled' ? caregiverOrdersResult.value.items : []
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载起步向导失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onLoad((query) => {
  const view = typeof query.view === 'string' ? query.view.toUpperCase() : ''
  if (view === 'OWNER' || view === 'CAREGIVER') {
    guideView.value = view
  }
})

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }

  void loadGuide(false)
})

onPullDownRefresh(() => {
  void loadGuide(true)
})
</script>

<template>
  <AppPageShell title="起步向导" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="起步总览" description="先明确当前走主人路径还是照料者路径，再集中处理最值得优先完成的步骤。">
        <view class="guide-hero">
          <view class="guide-hero__copy">
            <AppTag type="primary">
              PetPal 起步向导
            </AppTag>
            <text class="guide-hero__title">{{ displayName }}</text>
            <text class="guide-hero__summary">
              {{ activeGuideSummary }}
            </text>
          </view>
          <view class="guide-hero__actions">
            <AppButton size="medium" @click="navigateTo(PETPAL_HUB_PAGE)">
              角色入口
            </AppButton>
            <AppButton size="medium" type="info" @click="navigateTo(PETPAL_NOTIFICATIONS_PAGE)">
              通知中心
            </AppButton>
            <AppButton size="medium" type="danger" @click="navigateTo(PETPAL_REMINDERS_PAGE)">
              提醒中心
            </AppButton>
          </view>
        </view>

        <view class="guide-summary-grid">
          <view v-for="item in summaryCards" :key="item.label" class="guide-summary-card">
            <text class="guide-summary-card__label">{{ item.label }}</text>
            <text class="guide-summary-card__value">{{ item.value }}</text>
            <text class="guide-summary-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="选择当前路径" description="角色不同，页面与下一步动作也不同。先切换当前路径，再执行步骤。">
        <view class="guide-filter-panel">
          <AppChoiceChips v-model="guideView" :options="viewOptions" />
        </view>
      </AppSection>

      <AppSection :title="guideView === 'OWNER' ? `主人路径步骤 (${ownerCompletedCount}/${ownerSteps.length})` : `照料者路径步骤 (${caregiverCompletedCount}/${caregiverSteps.length})`">
        <view class="guide-step-list">
          <view
            v-for="item in currentSteps"
            :key="item.key"
            class="guide-step-card"
            :class="`guide-step-card--${item.status.toLowerCase()}`"
          >
            <view class="guide-step-card__header">
              <view class="guide-step-card__meta">
                <AppTag :type="getStatusTagType(item.status)">
                  {{ getStatusLabel(item.status) }}
                </AppTag>
                <AppTag type="default">
                  第 {{ item.stage }} 步
                </AppTag>
              </view>
              <AppButton
                size="medium"
                :type="item.status === 'CURRENT' ? 'danger' : 'primary'"
                @click="navigateTo(item.actionUrl)"
              >
                {{ item.actionLabel }}
              </AppButton>
            </view>
            <text class="guide-step-card__title">{{ item.title }}</text>
            <text class="guide-step-card__summary">{{ item.summary }}</text>
            <text class="guide-step-card__detail">{{ item.detail }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="角色切换辅助" description="不确定当前应该做什么时，先用这些固定入口判断和切换。">
        <view class="guide-support-grid">
          <view v-for="item in supportCards" :key="item.title" class="guide-support-card">
            <view class="guide-support-card__head">
              <AppTag :type="item.type">
                {{ item.type === 'danger' ? '优先查看' : item.type === 'warning' ? '建议配合' : item.type === 'primary' ? '重新选择' : '辅助说明' }}
              </AppTag>
            </view>
            <text class="guide-support-card__title">{{ item.title }}</text>
            <text class="guide-support-card__text">{{ item.text }}</text>
            <AppButton size="medium" type="info" @click="navigateTo(item.actionUrl)">
              {{ item.actionLabel }}
            </AppButton>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始使用起步向导" description="登录后查看主人与照料者两条路径的分步引导。">
        <view class="guide-empty">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="openLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.guide-hero {
  display: grid;
  gap: 20rpx;
  margin: 0 24rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 34%),
    linear-gradient(145deg, #0b7a75 0%, #155e75 50%, var(--app-accent) 100%);
  box-shadow: var(--app-elevation-3);
}

.guide-hero__copy {
  display: grid;
  gap: 12rpx;
}

.guide-hero__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.16;
  font-weight: 700;
}

.guide-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.72;
}

.guide-hero__actions,
.guide-step-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.guide-summary-grid,
.guide-support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 18rpx 24rpx 0;
}

.guide-filter-panel,
.guide-step-list {
  display: grid;
  gap: 16rpx;
  padding: 0 24rpx;
}

.guide-summary-card,
.guide-step-card,
.guide-support-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.guide-step-card--current {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.guide-step-card--done {
  background:
    radial-gradient(circle at top right, rgba(11, 122, 117, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.guide-step-card--upcoming {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.1), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.guide-summary-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}

.guide-summary-card__value {
  color: var(--app-text);
  font-size: 38rpx;
  line-height: 1.08;
  font-weight: 700;
}

.guide-summary-card__hint,
.guide-step-card__summary,
.guide-step-card__detail,
.guide-support-card__text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.72;
}

.guide-step-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.guide-step-card__title,
.guide-support-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.guide-support-card__head {
  display: flex;
  justify-content: flex-start;
}

.guide-empty {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .guide-summary-grid,
  .guide-support-grid {
    grid-template-columns: 1fr;
  }

  .guide-step-card__header {
    flex-direction: column;
  }
}
</style>
