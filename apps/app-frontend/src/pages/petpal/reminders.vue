<script lang="ts" setup>
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  OrderRecord,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
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
import { useTokenStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  formatRange,
  getCaregiverAuditLabel,
  getConversationUnreadCount,
  getOrderStatusLabel,
  isOrderAftersalesTracked,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDER_DETAIL_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
  PETPAL_REQUEST_PAGE,
  openPetPalAction,
} from './owner-shared'

defineOptions({
  name: 'PetPalRemindersPage',
})

definePage({
  style: {
    navigationBarTitleText: '提醒中心',
    enablePullDownRefresh: true,
  },
})

type ReminderPriority = 'HIGH' | 'MEDIUM' | 'LOW'
type ReminderRole = 'OWNER' | 'CAREGIVER' | 'SYSTEM'

interface ReminderCard {
  id: string
  role: ReminderRole
  priority: ReminderPriority
  title: string
  summary: string
  detail: string
  actionLabel: string
  actionMode: 'redirect' | 'navigate'
  actionUrl: string
}

interface ScheduleCard {
  id: string
  role: ReminderRole
  title: string
  detail: string
  status: string
  sortAt: number
  actionMode: 'navigate' | 'redirect'
  actionUrl: string
}

const tokenStore = useTokenStore()
const userStore = useUserStore()

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const ownerOrders = ref<OrderRecord[]>([])
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const caregiverOrders = ref<CaregiverOrderRecord[]>([])

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const ownerUnreadCount = computed(() => ownerOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'owner')
), 0))
const caregiverUnreadCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getConversationUnreadCount(item.conversation, 'caregiver')
), 0))
const totalUnreadCount = computed(() => ownerUnreadCount.value + caregiverUnreadCount.value)

const ownerAftersalesOrders = computed(() => ownerOrders.value.filter(item => isOrderAftersalesTracked(item)))
const pendingOwnerRequests = computed(() => requests.value.filter(item => (
  item.status === 'OPEN' || item.status === 'MATCHED'
)))
const firstPendingOwnerRequest = computed(() => pendingOwnerRequests.value
  .slice()
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null)
const ownerServingOrders = computed(() => ownerOrders.value.filter(item => item.orderStatus === 'SERVING'))
const ownerUpcomingOrders = computed(() => ownerOrders.value
  .filter(item => (
    ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)
    && dayjs(item.appointmentStart).isAfter(dayjs().subtract(6, 'hour'))
    && dayjs(item.appointmentStart).isBefore(dayjs().add(2, 'day'))
  ))
  .sort((left, right) => dayjs(left.appointmentStart).valueOf() - dayjs(right.appointmentStart).valueOf()))

const caregiverPendingOrders = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT'))
const caregiverServingOrders = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING'))
const caregiverAftersalesOrders = computed(() => caregiverOrders.value.filter(item => isOrderAftersalesTracked(item)))
const activeCaregiverServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)

const ownerReminderCards = computed<ReminderCard[]>(() => {
  const cards: ReminderCard[] = []

  if (!pets.value.length) {
    cards.push({
      id: 'owner-onboarding-pets',
      role: 'OWNER',
      priority: 'HIGH',
      title: '先建立第一只宠物档案',
      summary: '没有宠物档案时，主人主流程无法稳定复用需求与订单配置。',
      detail: '建议先补齐基础信息、饮食提醒、健康备注和紧急联系人，再继续发布照料需求。',
      actionLabel: '去建档',
      actionMode: 'redirect',
      actionUrl: PETPAL_PETS_PAGE,
    })
  }

  if (pendingOwnerRequests.value.length > 0) {
    cards.push({
      id: 'owner-requests',
      role: 'OWNER',
      priority: pendingOwnerRequests.value.length > 2 ? 'HIGH' : 'MEDIUM',
      title: `继续跟进 ${pendingOwnerRequests.value.length} 条主人需求`,
      summary: '这些需求仍处于待匹配、匹配中或待确认阶段。',
      detail: '建议优先回看时间、预算和地点，避免需求挂起太久导致无法及时成单。',
      actionLabel: '查看需求',
      actionMode: 'redirect',
      actionUrl: firstPendingOwnerRequest.value
        ? `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${firstPendingOwnerRequest.value.id}`
        : PETPAL_REQUEST_PAGE,
    })
  }

  if (ownerUpcomingOrders.value.length > 0) {
    const upcomingOrder = ownerUpcomingOrders.value[0]
    cards.push({
      id: 'owner-upcoming-order',
      role: 'OWNER',
      priority: 'HIGH',
      title: '有订单即将在 48 小时内开始',
      summary: `${upcomingOrder.orderNo} · ${formatRange(upcomingOrder.appointmentStart, upcomingOrder.appointmentEnd)}`,
      detail: '建议提前确认交接说明、地点、服务方式和即时沟通渠道，避免临近开始时再补信息。',
      actionLabel: '查看订单',
      actionMode: 'navigate',
      actionUrl: `${PETPAL_ORDER_DETAIL_PAGE}?id=${upcomingOrder.id}&tab=overview`,
    })
  }

  if (ownerServingOrders.value.length > 0) {
    const servingOrder = ownerServingOrders.value[0]
    cards.push({
      id: 'owner-serving-order',
      role: 'OWNER',
      priority: 'HIGH',
      title: `有 ${ownerServingOrders.value.length} 笔服务中订单待持续跟进`,
      summary: `${servingOrder.orderNo} 正在履约，建议及时查看签到、服务记录和完成确认时机。`,
      detail: '主人端最容易遗漏的是“服务已进行但未持续确认”，这里优先提醒回看履约过程。',
      actionLabel: '查看履约',
      actionMode: 'navigate',
      actionUrl: `${PETPAL_ORDER_DETAIL_PAGE}?id=${servingOrder.id}&tab=service`,
    })
  }

  if (ownerUnreadCount.value > 0) {
    cards.push({
      id: 'owner-unread-messages',
      role: 'OWNER',
      priority: ownerUnreadCount.value > 3 ? 'HIGH' : 'MEDIUM',
      title: `有 ${ownerUnreadCount.value} 条主人侧未读沟通`,
      summary: '订单交接、异常反馈和附件回传都可能在沟通里等待处理。',
      detail: '建议先统一进入消息中心消化未读，再决定是否需要进入具体订单继续处理。',
      actionLabel: '查看消息',
      actionMode: 'redirect',
      actionUrl: PETPAL_MESSAGES_PAGE,
    })
  }

  if (ownerAftersalesOrders.value.length > 0) {
    cards.push({
      id: 'owner-aftersales',
      role: 'OWNER',
      priority: 'HIGH',
      title: `有 ${ownerAftersalesOrders.value.length} 笔售后订单待跟进`,
      summary: '退款、争议和已退款订单已经被独立收口到售后中心。',
      detail: '建议优先处理争议订单、退款失败或仍在审核中的售后事项。',
      actionLabel: '进入售后中心',
      actionMode: 'redirect',
      actionUrl: PETPAL_AFTERSALES_PAGE,
    })
  }

  if (!cards.length) {
    cards.push({
      id: 'owner-stable',
      role: 'OWNER',
      priority: 'LOW',
      title: '主人主流程当前比较平稳',
      summary: '宠物、需求、订单和售后暂时没有高优先待办。',
      detail: '如果准备继续使用 PetPal，可以去主人首页继续建档、发需求或回看最近订单。',
      actionLabel: '进入主人首页',
      actionMode: 'redirect',
      actionUrl: PETPAL_OWNER_HOME_PAGE,
    })
  }

  return sortReminderCards(cards)
})

const caregiverReminderCards = computed<ReminderCard[]>(() => {
  const cards: ReminderCard[] = []

  if (!caregiverProfile.value) {
    cards.push({
      id: 'caregiver-profile-start',
      role: 'CAREGIVER',
      priority: 'MEDIUM',
      title: '如果你要接单，先完善照料者档案',
      summary: '当前还没有照料者档案或当前账号尚未开启照料者主流程。',
      detail: '先补齐服务城市、经验、介绍和资质材料，后续才能稳定上架服务和接单。',
      actionLabel: '去入驻中心',
      actionMode: 'redirect',
      actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
    })
  }
  else {
    if (caregiverProfile.value.auditStatus === 'REJECTED') {
      cards.push({
        id: 'caregiver-audit-rejected',
        role: 'CAREGIVER',
        priority: 'HIGH',
        title: '照料者档案已被驳回',
        summary: `当前状态：${getCaregiverAuditLabel(caregiverProfile.value.auditStatus)}`,
        detail: '建议优先补齐介绍、服务城市和资质材料，再重新提交审核。',
        actionLabel: '修正档案',
        actionMode: 'redirect',
        actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
      })
    }

    if (caregiverProfile.value.auditStatus === 'PENDING') {
      cards.push({
        id: 'caregiver-audit-pending',
        role: 'CAREGIVER',
        priority: 'MEDIUM',
        title: '照料者档案仍在审核中',
        summary: '平台正在审核你的资料，建议趁等待时间把服务配置补齐。',
        detail: '这样审核通过后可以更快开始上架和接单，不会继续卡在二次设置。',
        actionLabel: '完善服务',
        actionMode: 'redirect',
        actionUrl: PETPAL_CAREGIVER_SERVICES_PAGE,
      })
    }
  }

  if (caregiverProfile.value && activeCaregiverServiceCount.value === 0) {
    cards.push({
      id: 'caregiver-no-active-service',
      role: 'CAREGIVER',
      priority: 'HIGH',
      title: '照料者端还没有上架服务',
      summary: '没有上架服务时，主人侧无法稳定看到你的可售能力。',
      detail: '建议先补一个主服务并设置价格、时效和适配宠物，再开始接单。',
      actionLabel: '管理服务',
      actionMode: 'redirect',
      actionUrl: PETPAL_CAREGIVER_SERVICES_PAGE,
    })
  }

  if (caregiverPendingOrders.value.length > 0) {
    cards.push({
      id: 'caregiver-pending-orders',
      role: 'CAREGIVER',
      priority: 'HIGH',
      title: `有 ${caregiverPendingOrders.value.length} 笔待接单订单`,
      summary: '待接单过久会直接影响成单率和主人信任。',
      detail: '建议先统一进入履约订单页，尽快确认是否接单以及是否需要补充沟通。',
      actionLabel: '处理接单',
      actionMode: 'redirect',
      actionUrl: PETPAL_CAREGIVER_ORDERS_PAGE,
    })
  }

  if (caregiverServingOrders.value.length > 0) {
    const servingOrder = caregiverServingOrders.value[0]
    cards.push({
      id: 'caregiver-serving-orders',
      role: 'CAREGIVER',
      priority: 'MEDIUM',
      title: `有 ${caregiverServingOrders.value.length} 笔服务中订单待回传`,
      summary: `${servingOrder.orderNo} 正在服务中，建议及时上传服务记录和补充说明。`,
      detail: '服务日志越及时，主人确认和售后透明度就越高。',
      actionLabel: '查看履约',
      actionMode: 'navigate',
      actionUrl: `${PETPAL_ORDER_DETAIL_PAGE}?id=${servingOrder.id}&tab=service`,
    })
  }

  if (caregiverUnreadCount.value > 0) {
    cards.push({
      id: 'caregiver-unread-messages',
      role: 'CAREGIVER',
      priority: caregiverUnreadCount.value > 3 ? 'HIGH' : 'MEDIUM',
      title: `有 ${caregiverUnreadCount.value} 条照料者侧未读沟通`,
      summary: '待接单确认、交接细节和异常反馈都可能阻塞履约。',
      detail: '建议先统一进入消息中心消化未读，避免在多个订单之间来回切换。',
      actionLabel: '查看消息',
      actionMode: 'redirect',
      actionUrl: PETPAL_MESSAGES_PAGE,
    })
  }

  if (caregiverAftersalesOrders.value.length > 0) {
    cards.push({
      id: 'caregiver-aftersales-risk',
      role: 'CAREGIVER',
      priority: 'MEDIUM',
      title: `有 ${caregiverAftersalesOrders.value.length} 笔订单涉及售后或退款`,
      summary: '这些订单会影响收入沉淀、评分和后续复购。',
      detail: '建议回到收益表现页查看售后风险和近期受影响订单，再决定优先处理项。',
      actionLabel: '查看收益表现',
      actionMode: 'redirect',
      actionUrl: PETPAL_CAREGIVER_EARNINGS_PAGE,
    })
  }

  if (!cards.length) {
    cards.push({
      id: 'caregiver-stable',
      role: 'CAREGIVER',
      priority: 'LOW',
      title: '照料者侧当前没有高风险待办',
      summary: '审核、服务、接单和消息暂时比较平稳。',
      detail: '可以继续优化档案、报价和服务说明，或回看近期收益表现。',
      actionLabel: '进入照料者首页',
      actionMode: 'redirect',
      actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
    })
  }

  return sortReminderCards(cards)
})

const allReminderCards = computed(() => sortReminderCards([
  ...ownerReminderCards.value,
  ...caregiverReminderCards.value,
]))

const highPriorityCount = computed(() => allReminderCards.value.filter(item => item.priority === 'HIGH').length)
const mediumPriorityCount = computed(() => allReminderCards.value.filter(item => item.priority === 'MEDIUM').length)
const totalRiskOrderCount = computed(() => ownerAftersalesOrders.value.length + caregiverAftersalesOrders.value.length)
const highPriorityCards = computed(() => allReminderCards.value.filter(item => item.priority === 'HIGH'))

const scheduleCards = computed<ScheduleCard[]>(() => {
    const ownerSchedule = ownerUpcomingOrders.value.slice(0, 3).map<ScheduleCard>(item => ({
      id: `owner-order-${item.id}`,
      role: 'OWNER',
      title: `${item.orderNo} 即将开始`,
      detail: formatRange(item.appointmentStart, item.appointmentEnd),
      status: getOrderStatusLabel(item.orderStatus),
      sortAt: dayjs(item.appointmentStart).valueOf(),
      actionMode: 'navigate',
      actionUrl: `${PETPAL_ORDER_DETAIL_PAGE}?id=${item.id}&tab=overview`,
    }))

  const caregiverSchedule = caregiverOrders.value
    .filter(item => (
      ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)
      && dayjs(item.appointmentStart).isAfter(dayjs().subtract(6, 'hour'))
      && dayjs(item.appointmentStart).isBefore(dayjs().add(2, 'day'))
    ))
    .sort((left, right) => dayjs(left.appointmentStart).valueOf() - dayjs(right.appointmentStart).valueOf())
    .slice(0, 3)
    .map<ScheduleCard>(item => ({
      id: `caregiver-order-${item.id}`,
      role: 'CAREGIVER',
      title: `${item.orderNo} 待照料处理`,
      detail: `${item.ownerNickname} · ${formatRange(item.appointmentStart, item.appointmentEnd)}`,
      status: getOrderStatusLabel(item.orderStatus),
      sortAt: dayjs(item.appointmentStart).valueOf(),
      actionMode: 'navigate',
      actionUrl: `${PETPAL_ORDER_DETAIL_PAGE}?id=${item.id}&tab=service`,
    }))

  return [...ownerSchedule, ...caregiverSchedule]
    .sort((left, right) => left.sortAt - right.sortAt)
    .slice(0, 6)
})

const pageDescription = computed(() => {
  if (!tokenStore.hasLogin) {
    return '登录后集中查看主人端、照料者端和售后相关提醒。'
  }

  return `${displayName.value}，当前有 ${highPriorityCount.value} 条高优先提醒、${mediumPriorityCount.value} 条持续跟进提醒和 ${totalUnreadCount.value} 条未读沟通。`
})

const summaryCards = computed(() => [
  {
    label: '高优先提醒',
    value: String(highPriorityCount.value),
    hint: highPriorityCount.value ? '建议先处理可能直接影响履约、成单或售后的事项。' : '当前没有高优先提醒。',
  },
  {
    label: '持续跟进',
    value: String(mediumPriorityCount.value),
    hint: mediumPriorityCount.value ? '这些事项不紧急，但持续拖延会影响体验。' : '当前没有待持续跟进事项。',
  },
  {
    label: '未读沟通',
    value: String(totalUnreadCount.value),
    hint: totalUnreadCount.value ? '主人端和照料者端消息已统一纳入提醒中心。' : '当前沟通都已读。',
  },
  {
    label: '风险订单',
    value: String(totalRiskOrderCount.value),
    hint: totalRiskOrderCount.value ? '包含主人售后订单和照料者侧受退款影响订单。' : '当前没有售后风险订单。',
  },
])

function sortReminderCards(cards: ReminderCard[]) {
  return [...cards].sort((left, right) => {
    const priorityGap = getPriorityWeight(right.priority) - getPriorityWeight(left.priority)
    if (priorityGap !== 0) {
      return priorityGap
    }
    return left.title.localeCompare(right.title)
  })
}

function getPriorityWeight(priority: ReminderPriority) {
  if (priority === 'HIGH') return 3
  if (priority === 'MEDIUM') return 2
  return 1
}

function getPriorityLabel(priority: ReminderPriority) {
  if (priority === 'HIGH') return '优先处理'
  if (priority === 'MEDIUM') return '持续跟进'
  return '保持关注'
}

function getPriorityTagType(priority: ReminderPriority) {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}

function getRoleLabel(role: ReminderRole) {
  if (role === 'OWNER') return '主人'
  if (role === 'CAREGIVER') return '照料者'
  return '系统'
}

function getRoleTagType(role: ReminderRole) {
  if (role === 'OWNER') return 'primary'
  if (role === 'CAREGIVER') return 'warning'
  return 'default'
}

function runAction(mode: 'redirect' | 'navigate', url: string) {
  openPetPalAction(mode, url)
}

function refreshPage() {
  void loadPage(true)
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
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

    const [
      petsResult,
      requestsResult,
      ownerOrdersResult,
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
    ownerOrders.value = ownerOrdersResult.status === 'fulfilled' ? ownerOrdersResult.value : []
    caregiverProfile.value = caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null
    caregiverServices.value = caregiverServicesResult.status === 'fulfilled' ? caregiverServicesResult.value : []
    caregiverOrders.value = caregiverOrdersResult.status === 'fulfilled' ? caregiverOrdersResult.value.items : []
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载提醒中心失败'),
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
  <AppPageShell title="提醒中心" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="提醒概览" description="先看高优先事项，再决定进入主人、照料者还是售后工作流。">
        <view class="reminder-hero">
          <view class="reminder-hero__copy">
            <AppTag type="danger">
              PetPal 提醒中心
            </AppTag>
            <text class="reminder-hero__title">{{ displayName }}</text>
            <text class="reminder-hero__summary">
              提醒中心把主人端、照料者端和售后相关待办集中到一页，不再只靠工作台首页零散提示。
            </text>
          </view>
          <view class="reminder-hero__actions">
            <AppButton size="medium" type="info" @click="openNotifications">通知中心</AppButton>
            <AppButton size="medium" type="info" @click="runAction('redirect', PETPAL_MESSAGES_PAGE)">消息中心</AppButton>
            <AppButton size="medium" @click="refreshPage">刷新提醒</AppButton>
          </view>
        </view>

        <view class="reminder-summary-grid">
          <view v-for="item in summaryCards" :key="item.label" class="reminder-summary-card">
            <text class="reminder-summary-card__label">{{ item.label }}</text>
            <text class="reminder-summary-card__value">{{ item.value }}</text>
            <text class="reminder-summary-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="高优先提醒" description="这些事项最容易直接影响成单、履约、售后或沟通效率。">
        <view v-if="highPriorityCards.length" class="reminder-list">
          <view
            v-for="item in highPriorityCards"
            :key="item.id"
            class="reminder-card reminder-card--priority"
          >
            <view class="reminder-card__header">
              <view class="reminder-card__tags">
                <AppTag :type="getRoleTagType(item.role)">
                  {{ getRoleLabel(item.role) }}
                </AppTag>
                <AppTag :type="getPriorityTagType(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </AppTag>
              </view>
              <AppButton size="medium" :type="item.priority === 'HIGH' ? 'danger' : 'primary'" @click="runAction(item.actionMode, item.actionUrl)">
                {{ item.actionLabel }}
              </AppButton>
            </view>
            <text class="reminder-card__title">{{ item.title }}</text>
            <text class="reminder-card__summary">{{ item.summary }}</text>
            <text class="reminder-card__detail">{{ item.detail }}</text>
          </view>
        </view>
        <view v-else class="reminder-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在整理高优先提醒' : '当前没有高优先提醒'" />
        </view>
      </AppSection>

      <AppSection title="主人提醒" description="围绕建档、发需求、履约、沟通和售后的关键动作。">
        <view class="reminder-list">
          <view v-for="item in ownerReminderCards" :key="item.id" class="reminder-card">
            <view class="reminder-card__header">
              <view class="reminder-card__tags">
                <AppTag :type="getRoleTagType(item.role)">
                  {{ getRoleLabel(item.role) }}
                </AppTag>
                <AppTag :type="getPriorityTagType(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </AppTag>
              </view>
              <AppButton size="medium" :type="item.priority === 'HIGH' ? 'danger' : 'primary'" @click="runAction(item.actionMode, item.actionUrl)">
                {{ item.actionLabel }}
              </AppButton>
            </view>
            <text class="reminder-card__title">{{ item.title }}</text>
            <text class="reminder-card__summary">{{ item.summary }}</text>
            <text class="reminder-card__detail">{{ item.detail }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="照料者提醒" description="围绕入驻、上架、接单、履约和收入风险的关键动作。">
        <view class="reminder-list">
          <view v-for="item in caregiverReminderCards" :key="item.id" class="reminder-card">
            <view class="reminder-card__header">
              <view class="reminder-card__tags">
                <AppTag :type="getRoleTagType(item.role)">
                  {{ getRoleLabel(item.role) }}
                </AppTag>
                <AppTag :type="getPriorityTagType(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </AppTag>
              </view>
              <AppButton size="medium" :type="item.priority === 'HIGH' ? 'danger' : 'primary'" @click="runAction(item.actionMode, item.actionUrl)">
                {{ item.actionLabel }}
              </AppButton>
            </view>
            <text class="reminder-card__title">{{ item.title }}</text>
            <text class="reminder-card__summary">{{ item.summary }}</text>
            <text class="reminder-card__detail">{{ item.detail }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="今天与明天" description="把即将开始或需要尽快关注的订单放到时间维度里查看。">
        <view v-if="scheduleCards.length" class="schedule-list">
          <view v-for="item in scheduleCards" :key="item.id" class="schedule-card">
            <view class="schedule-card__header">
              <AppTag :type="getRoleTagType(item.role)">
                {{ getRoleLabel(item.role) }}
              </AppTag>
              <AppTag type="default">
                {{ item.status }}
              </AppTag>
            </view>
            <text class="schedule-card__title">{{ item.title }}</text>
            <text class="schedule-card__detail">{{ item.detail }}</text>
            <AppButton size="medium" type="info" @click="runAction(item.actionMode, item.actionUrl)">
              进入处理
            </AppButton>
          </view>
        </view>
        <view v-else class="reminder-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在整理时间提醒' : '未来两天没有需要特别关注的订单'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始使用提醒中心" description="登录后查看主人端、照料者端和售后相关待办。">
        <view class="reminder-empty reminder-empty--login">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.reminder-hero {
  display: grid;
  gap: 20rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.18);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 36%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.2), transparent 34%),
    linear-gradient(145deg, #2563eb 0%, #60a5fa 48%, #f97316 100%);
  box-shadow: var(--app-elevation-3);
}

.reminder-hero__copy {
  display: grid;
  gap: 12rpx;
}

.reminder-hero__title {
  color: #eff6ff;
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 40rpx;
  line-height: 1.12;
  font-weight: 700;
}

.reminder-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.reminder-hero__actions,
.reminder-card__tags,
.schedule-card__header {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.reminder-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.reminder-summary-card,
.reminder-card,
.schedule-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.reminder-card--priority {
  background:
    radial-gradient(circle at top right, rgba(220, 38, 38, 0.12), transparent 36%),
    linear-gradient(180deg, rgba(255, 236, 234, 0.96) 0%, rgba(255, 251, 246, 0.98) 100%);
}

.reminder-summary-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.reminder-summary-card__value {
  color: var(--app-brand-strong);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.reminder-summary-card__hint,
.reminder-card__summary,
.reminder-card__detail,
.schedule-card__detail {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.reminder-list,
.schedule-list {
  display: grid;
  gap: 16rpx;
}

.reminder-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.reminder-card__title,
.schedule-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.reminder-empty {
  padding: 8rpx 0;
}

.reminder-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .reminder-summary-grid {
    grid-template-columns: 1fr;
  }

  .reminder-card__header {
    flex-direction: column;
  }
}
</style>
