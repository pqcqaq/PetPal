import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  OrderRecord,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getCaregiverProfile,
  listCaregiverOrders,
  listCaregiverServices,
  listOrders,
  listPets,
  listServiceRequests,
} from '@/api/petpal'
import {
  type AftersalesFilter,
  type ConversationRole,
  type MessagesFilter,
  type PetPalOrderDetailEntryReason,
  type PetPalNotificationDrivenOrderDetailSource,
  type PetPalOrderDetailTab,
  type ReminderScope,
  formatRange,
  getCaregiverAuditLabel,
  getConversationUnreadCount,
  isOrderAftersalesTracked,
  openPetPalAftersalesPage,
  openPetPalMessagesPage,
  openPetPalOrderDetailPage,
  openPetPalRemindersPage,
  openPetPalAction,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_GETTING_STARTED_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '@/pages/petpal/owner-shared'
import { useTokenStore } from './token'
import { useUserStore } from './user'

export type AppNotificationScope = 'OWNER' | 'CAREGIVER' | 'ACCOUNT'
export type AppNotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type AppNotificationActionMode = 'navigate' | 'redirect'

export interface AppNotificationItem {
  id: string
  scope: AppNotificationScope
  priority: AppNotificationPriority
  title: string
  summary: string
  detail: string
  actionLabel: string
  actionUrl: string
  actionMode: AppNotificationActionMode
  actionOrderId?: string
  actionRole?: ConversationRole
  actionMessagesFilter?: MessagesFilter
  actionAftersalesFilter?: AftersalesFilter
  actionReminderScope?: ReminderScope
  actionOrderTab?: PetPalOrderDetailTab
  actionOrderReason?: PetPalOrderDetailEntryReason
  sortAt: number
  updatedAtKey: string
}

function createNotification(params: AppNotificationItem): AppNotificationItem {
  return params
}

function getPriorityWeight(priority: AppNotificationPriority) {
  if (priority === 'HIGH') return 3
  if (priority === 'MEDIUM') return 2
  return 1
}

function sortNotifications(items: AppNotificationItem[]) {
  return [...items].sort((left, right) => {
    const priorityGap = getPriorityWeight(right.priority) - getPriorityWeight(left.priority)
    if (priorityGap !== 0) {
      return priorityGap
    }
    return right.sortAt - left.sortAt
  })
}

function buildNotificationItems(payload: {
  userEmail: string | null
  pets: PetProfileRecord[]
  requests: ServiceRequestRecord[]
  ownerOrders: OrderRecord[]
  caregiverProfile: CaregiverProfileRecord | null
  caregiverServices: CaregiverServiceRecord[]
  caregiverOrders: CaregiverOrderRecord[]
}): AppNotificationItem[] {
  const {
    userEmail,
    pets,
    requests,
    ownerOrders,
    caregiverProfile,
    caregiverServices,
    caregiverOrders,
  } = payload

  const items: AppNotificationItem[] = []
  const now = dayjs()

  const activeOwnerRequests = requests.filter(item => (
    item.status === 'OPEN'
    || item.status === 'MATCHED'
  ))
  const ownerUnreadOrders = ownerOrders
    .filter(item => getConversationUnreadCount(item.conversation, 'owner') > 0)
    .sort((left, right) => {
      const unreadGap = getConversationUnreadCount(right.conversation, 'owner') - getConversationUnreadCount(left.conversation, 'owner')
      if (unreadGap !== 0) {
        return unreadGap
      }
      return dayjs(right.conversation?.lastMessageAt || right.updatedAt).valueOf() - dayjs(left.conversation?.lastMessageAt || left.updatedAt).valueOf()
    })
  const topOwnerUnreadOrder = ownerUnreadOrders[0]
  const ownerUnreadCount = ownerOrders.reduce((total, item) => (
    total + getConversationUnreadCount(item.conversation, 'owner')
  ), 0)
  const ownerUnreadLatestAt = ownerOrders
    .map(item => item.conversation?.lastMessageAt || item.updatedAt)
    .sort((left, right) => dayjs(right).valueOf() - dayjs(left).valueOf())[0]
  const ownerAftersalesOrders = ownerOrders.filter(item => isOrderAftersalesTracked(item))
  const topOwnerAftersalesOrder = [...ownerAftersalesOrders].sort((left, right) => (
    dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf()
  ))[0]
  const ownerUpcomingOrders = ownerOrders
    .filter(item => (
      ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)
      && dayjs(item.appointmentStart).isAfter(now.subtract(6, 'hour'))
      && dayjs(item.appointmentStart).isBefore(now.add(2, 'day'))
    ))
    .sort((left, right) => dayjs(left.appointmentStart).valueOf() - dayjs(right.appointmentStart).valueOf())

  const caregiverUnreadOrders = caregiverOrders
    .filter(item => getConversationUnreadCount(item.conversation, 'caregiver') > 0)
    .sort((left, right) => {
      const unreadGap = getConversationUnreadCount(right.conversation, 'caregiver') - getConversationUnreadCount(left.conversation, 'caregiver')
      if (unreadGap !== 0) {
        return unreadGap
      }
      return dayjs(right.conversation?.lastMessageAt || right.updatedAt).valueOf() - dayjs(left.conversation?.lastMessageAt || left.updatedAt).valueOf()
    })
  const caregiverUnreadCount = caregiverOrders.reduce((total, item) => (
    total + getConversationUnreadCount(item.conversation, 'caregiver')
  ), 0)
  const topCaregiverUnreadOrder = caregiverUnreadOrders[0]
  const caregiverUnreadLatestAt = caregiverOrders
    .map(item => item.conversation?.lastMessageAt || item.updatedAt)
    .sort((left, right) => dayjs(right).valueOf() - dayjs(left).valueOf())[0]
  const caregiverPendingOrders = caregiverOrders.filter(item => item.orderStatus === 'PENDING_ACCEPT')
  const topCaregiverPendingOrder = [...caregiverPendingOrders].sort((left, right) => (
    dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf()
  ))[0]
  const caregiverServingOrders = caregiverOrders.filter(item => item.orderStatus === 'SERVING')
  const topCaregiverServingOrder = [...caregiverServingOrders].sort((left, right) => (
    dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf()
  ))[0]
  const activeCaregiverServiceCount = caregiverServices.filter(item => item.isActive).length

  if (!userEmail) {
    items.push(createNotification({
      id: 'account-email-missing',
      scope: 'ACCOUNT',
      priority: 'MEDIUM',
      title: '补齐邮箱与基础资料',
      summary: '邮箱和昵称会影响账户识别、联系和资料同步。',
      detail: '建议先进入个人资料页补齐邮箱与昵称，再继续使用账户支持和提醒体系。',
      actionLabel: '编辑资料',
      actionUrl: '/pages/me/profile',
      actionMode: 'navigate',
      sortAt: 1,
      updatedAtKey: `account-email:${userEmail ? 'set' : 'missing'}`,
    }))
  }

  if (!pets.length) {
    items.push(createNotification({
      id: 'owner-no-pets',
      scope: 'OWNER',
      priority: 'HIGH',
      title: '先建立第一只宠物档案',
      summary: '没有宠物档案时，主人主流程无法稳定复用需求和订单配置。',
      detail: '先补齐宠物基础信息、喂养提醒和紧急联系人，再继续发布照料需求。',
      actionLabel: '打开起步向导',
      actionUrl: `${PETPAL_GETTING_STARTED_PAGE}?view=OWNER`,
      actionMode: 'redirect',
      sortAt: 2,
      updatedAtKey: `owner-pets:${pets.length}`,
    }))
  }

  if (activeOwnerRequests.length > 0) {
    const latestRequestAt = activeOwnerRequests
      .map(item => item.updatedAt)
      .sort((left, right) => dayjs(right).valueOf() - dayjs(left).valueOf())[0]

    items.push(createNotification({
      id: 'owner-active-requests',
      scope: 'OWNER',
      priority: activeOwnerRequests.length > 2 ? 'HIGH' : 'MEDIUM',
      title: `有 ${activeOwnerRequests.length} 条主人需求仍在流转`,
      summary: '这些需求仍处于待匹配、匹配中或待确认阶段。',
      detail: '建议回看时间、地点和预算，避免需求停留过久而影响成单。',
      actionLabel: '进入提醒中心',
      actionUrl: PETPAL_REMINDERS_PAGE,
      actionMode: 'navigate',
      actionReminderScope: 'OWNER',
      sortAt: dayjs(latestRequestAt).valueOf(),
      updatedAtKey: `owner-requests:${activeOwnerRequests.length}:${latestRequestAt}`,
    }))
  }

  if (ownerUpcomingOrders.length > 0) {
    const upcomingOrder = ownerUpcomingOrders[0]
    items.push(createNotification({
      id: 'owner-upcoming-order',
      scope: 'OWNER',
      priority: 'HIGH',
      title: '有订单将在 48 小时内开始',
      summary: `${upcomingOrder.orderNo} · ${formatRange(upcomingOrder.appointmentStart, upcomingOrder.appointmentEnd)}`,
      detail: '建议提前确认交接说明、地点和沟通方式，避免服务开始前才补信息。',
      actionLabel: '查看订单',
      actionUrl: `/pages/order-detail/index?id=${upcomingOrder.id}&tab=overview`,
      actionMode: 'navigate',
      actionOrderId: upcomingOrder.id,
      actionOrderTab: 'overview',
      actionOrderReason: 'upcoming-order',
      sortAt: dayjs(upcomingOrder.appointmentStart).valueOf(),
      updatedAtKey: `owner-upcoming:${upcomingOrder.id}:${upcomingOrder.updatedAt}`,
    }))
  }

  if (ownerUnreadCount > 0) {
    items.push(createNotification({
      id: 'owner-unread-messages',
      scope: 'OWNER',
      priority: ownerUnreadCount > 3 ? 'HIGH' : 'MEDIUM',
      title: `主人侧有 ${ownerUnreadCount} 条未读沟通`,
      summary: '订单交接、履约补充和售后说明可能仍在等待处理。',
      detail: '建议先统一进入消息中心处理未读，再决定是否回到具体订单继续沟通。',
      actionLabel: ownerUnreadOrders.length === 1 ? '查看沟通' : '进入消息中心',
      actionUrl: PETPAL_MESSAGES_PAGE,
      actionMode: 'redirect',
      actionOrderId: topOwnerUnreadOrder?.id,
      actionRole: 'owner',
      actionMessagesFilter: 'UNREAD',
      ...(topOwnerUnreadOrder?.id ? { actionOrderReason: 'unread-messages' as const } : {}),
      ...(ownerUnreadOrders.length === 1 && topOwnerUnreadOrder?.id
        ? { actionOrderTab: 'chat' as const }
        : {}),
      sortAt: ownerUnreadLatestAt ? dayjs(ownerUnreadLatestAt).valueOf() : 3,
      updatedAtKey: `owner-unread:${ownerUnreadCount}:${ownerUnreadLatestAt || 'none'}`,
    }))
  }

  if (ownerAftersalesOrders.length > 0) {
    const latestAftersalesAt = ownerAftersalesOrders
      .map(item => item.updatedAt)
      .sort((left, right) => dayjs(right).valueOf() - dayjs(left).valueOf())[0]

    items.push(createNotification({
      id: 'owner-aftersales',
      scope: 'OWNER',
      priority: 'HIGH',
      title: `有 ${ownerAftersalesOrders.length} 笔售后订单待跟进`,
      summary: '退款、争议和投诉订单已经从普通订单流里拆出。',
      detail: '优先进入售后中心处理争议订单、退款失败和仍在审核中的售后事项。',
      actionLabel: ownerAftersalesOrders.length === 1 ? '查看售后' : '进入售后中心',
      actionUrl: PETPAL_AFTERSALES_PAGE,
      actionMode: 'redirect',
      actionOrderId: topOwnerAftersalesOrder?.id,
      actionAftersalesFilter: 'HIGH',
      ...(topOwnerAftersalesOrder?.id ? { actionOrderReason: 'aftersales-followup' as const } : {}),
      ...(ownerAftersalesOrders.length === 1 && topOwnerAftersalesOrder?.id
        ? { actionOrderTab: 'aftersales' as const }
        : {}),
      sortAt: latestAftersalesAt ? dayjs(latestAftersalesAt).valueOf() : 4,
      updatedAtKey: `owner-aftersales:${ownerAftersalesOrders.length}:${latestAftersalesAt || 'none'}`,
    }))
  }

  if (!caregiverProfile) {
    items.push(createNotification({
      id: 'caregiver-profile-missing',
      scope: 'CAREGIVER',
      priority: 'MEDIUM',
      title: '如果你要接单，先建立照料者档案',
      summary: '当前账号还没有照料者档案或尚未开启照料者主流程。',
      detail: '建议先补齐服务城市、经验、介绍和资质材料，再继续配置服务。',
      actionLabel: '打开起步向导',
      actionUrl: `${PETPAL_GETTING_STARTED_PAGE}?view=CAREGIVER`,
      actionMode: 'redirect',
      sortAt: 5,
      updatedAtKey: 'caregiver-profile:missing',
    }))
  }
  else {
    if (caregiverProfile.auditStatus === 'REJECTED') {
      items.push(createNotification({
        id: 'caregiver-audit-rejected',
        scope: 'CAREGIVER',
        priority: 'HIGH',
        title: '照料者档案已被驳回',
        summary: `当前状态：${getCaregiverAuditLabel(caregiverProfile.auditStatus)}`,
        detail: '建议优先补齐资料和资质材料后再次提交审核。',
        actionLabel: '修正档案',
        actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
        actionMode: 'redirect',
        sortAt: dayjs(caregiverProfile.updatedAt).valueOf(),
        updatedAtKey: `caregiver-audit:${caregiverProfile.auditStatus}:${caregiverProfile.updatedAt}`,
      }))
    }

    if (caregiverProfile.auditStatus === 'PENDING') {
      items.push(createNotification({
        id: 'caregiver-audit-pending',
        scope: 'CAREGIVER',
        priority: 'MEDIUM',
        title: '照料者档案仍在审核中',
        summary: '审核进行中，建议趁等待时间把服务配置补齐。',
        detail: '这样审核通过后可以更快上架并开始接单。',
        actionLabel: '继续维护档案',
        actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
        actionMode: 'redirect',
        sortAt: dayjs(caregiverProfile.updatedAt).valueOf(),
        updatedAtKey: `caregiver-audit:${caregiverProfile.auditStatus}:${caregiverProfile.updatedAt}`,
      }))
    }
  }

  if (caregiverProfile && activeCaregiverServiceCount === 0) {
    items.push(createNotification({
      id: 'caregiver-no-service',
      scope: 'CAREGIVER',
      priority: 'HIGH',
      title: '照料者端还没有上架服务',
      summary: '没有上架服务时，主人端无法稳定看到你的可售能力。',
      detail: '建议至少补齐一个可售服务，设置价格、适配宠物和时效。',
      actionLabel: '打开起步向导',
      actionUrl: `${PETPAL_GETTING_STARTED_PAGE}?view=CAREGIVER`,
      actionMode: 'redirect',
      sortAt: 6,
      updatedAtKey: `caregiver-services:${activeCaregiverServiceCount}`,
    }))
  }

  if (caregiverPendingOrders.length > 0) {
    const latestPendingAt = caregiverPendingOrders
      .map(item => item.updatedAt)
      .sort((left, right) => dayjs(right).valueOf() - dayjs(left).valueOf())[0]

    items.push(createNotification({
      id: 'caregiver-pending-orders',
      scope: 'CAREGIVER',
      priority: 'HIGH',
      title: `有 ${caregiverPendingOrders.length} 笔待接单订单`,
      summary: '待接单过久会直接影响成单率与主人信任。',
      detail: '建议统一进入履约订单页，尽快确认是否接单和是否需要补充沟通。',
      actionLabel: caregiverPendingOrders.length === 1 ? '去处理订单' : '处理接单',
      actionUrl: PETPAL_CAREGIVER_ORDERS_PAGE,
      actionMode: 'redirect',
      actionOrderId: topCaregiverPendingOrder?.id,
      ...(caregiverPendingOrders.length === 1 && topCaregiverPendingOrder?.id
        ? { actionOrderTab: 'service' as const, actionOrderReason: 'pending-accept' as const }
        : {}),
      sortAt: latestPendingAt ? dayjs(latestPendingAt).valueOf() : 7,
      updatedAtKey: `caregiver-pending:${caregiverPendingOrders.length}:${latestPendingAt || 'none'}`,
    }))
  }

  if (caregiverServingOrders.length > 0) {
    const latestServingAt = caregiverServingOrders
      .map(item => item.updatedAt)
      .sort((left, right) => dayjs(right).valueOf() - dayjs(left).valueOf())[0]

    items.push(createNotification({
      id: 'caregiver-serving-orders',
      scope: 'CAREGIVER',
      priority: 'MEDIUM',
      title: `有 ${caregiverServingOrders.length} 笔服务中订单待回传`,
      summary: '服务日志越及时，主人确认与售后透明度就越高。',
      detail: '建议回到履约订单页继续补服务记录和异常说明。',
      actionLabel: caregiverServingOrders.length === 1 ? '继续当前订单' : '继续履约',
      actionUrl: PETPAL_CAREGIVER_ORDERS_PAGE,
      actionMode: 'redirect',
      actionOrderId: topCaregiverServingOrder?.id,
      ...(caregiverServingOrders.length === 1 && topCaregiverServingOrder?.id
        ? { actionOrderTab: 'service' as const, actionOrderReason: 'serving-followup' as const }
        : {}),
      sortAt: latestServingAt ? dayjs(latestServingAt).valueOf() : 8,
      updatedAtKey: `caregiver-serving:${caregiverServingOrders.length}:${latestServingAt || 'none'}`,
    }))
  }

  if (caregiverUnreadCount > 0) {
    items.push(createNotification({
      id: 'caregiver-unread-messages',
      scope: 'CAREGIVER',
      priority: caregiverUnreadCount > 3 ? 'HIGH' : 'MEDIUM',
      title: `照料者侧有 ${caregiverUnreadCount} 条未读沟通`,
      summary: '待接单确认、交接细节和异常反馈都可能阻塞履约。',
      detail: '建议先统一进入消息中心消化未读，避免在多个订单之间来回切换。',
      actionLabel: caregiverUnreadOrders.length === 1 ? '查看沟通' : '进入消息中心',
      actionUrl: PETPAL_MESSAGES_PAGE,
      actionMode: 'redirect',
      actionOrderId: topCaregiverUnreadOrder?.id,
      actionRole: 'caregiver',
      actionMessagesFilter: 'UNREAD',
      ...(topCaregiverUnreadOrder?.id ? { actionOrderReason: 'unread-messages' as const } : {}),
      ...(caregiverUnreadOrders.length === 1 && topCaregiverUnreadOrder?.id
        ? { actionOrderTab: 'chat' as const }
        : {}),
      sortAt: caregiverUnreadLatestAt ? dayjs(caregiverUnreadLatestAt).valueOf() : 9,
      updatedAtKey: `caregiver-unread:${caregiverUnreadCount}:${caregiverUnreadLatestAt || 'none'}`,
    }))
  }

  if (!items.length) {
    items.push(createNotification({
      id: 'account-stable',
      scope: 'ACCOUNT',
      priority: 'LOW',
      title: '当前没有新的高优先通知',
      summary: '主人主流程、照料者侧和账户状态目前较平稳。',
      detail: '可以继续通过提醒中心查看待办，或从帮助中心回看当前页面体系。',
      actionLabel: '进入提醒中心',
      actionUrl: PETPAL_REMINDERS_PAGE,
      actionMode: 'navigate',
      actionReminderScope: 'ALL',
      sortAt: 0,
      updatedAtKey: 'account-stable',
    }))
  }

  return sortNotifications(items)
}

export function openAppNotificationAction(item: Pick<
  AppNotificationItem,
  'actionMode' | 'actionUrl' | 'actionOrderId' | 'actionOrderTab' | 'actionOrderReason' | 'actionRole' | 'actionMessagesFilter' | 'actionAftersalesFilter' | 'actionReminderScope' | 'id'
>, options?: {
  orderDetailSource?: PetPalNotificationDrivenOrderDetailSource
}) {
  if (item.actionOrderId && item.actionOrderTab) {
    openPetPalOrderDetailPage({
      mode: item.actionMode,
      orderId: item.actionOrderId,
      tab: item.actionOrderTab,
      ...(options?.orderDetailSource ? { source: options.orderDetailSource } : {}),
      ...(item.actionOrderReason ? { reason: item.actionOrderReason } : {}),
    })
    return
  }

  if (item.actionUrl === PETPAL_MESSAGES_PAGE) {
    openPetPalMessagesPage({
      mode: item.actionMode,
      ...(item.actionRole ? { role: item.actionRole } : {}),
      ...(item.actionMessagesFilter ? { filter: item.actionMessagesFilter } : {}),
      ...(item.actionOrderId ? { focusOrderId: item.actionOrderId } : {}),
      ...(item.actionOrderReason ? { detailReason: item.actionOrderReason } : {}),
    })
    return
  }

  if (item.actionUrl === PETPAL_AFTERSALES_PAGE) {
    openPetPalAftersalesPage({
      mode: item.actionMode,
      ...(item.actionAftersalesFilter ? { filter: item.actionAftersalesFilter } : {}),
      ...(item.actionOrderId ? { focusOrderId: item.actionOrderId } : {}),
      ...(item.actionOrderReason ? { detailReason: item.actionOrderReason } : {}),
    })
    return
  }

  if (item.actionUrl === PETPAL_REMINDERS_PAGE) {
    openPetPalRemindersPage({
      mode: item.actionMode,
      ...(item.actionReminderScope ? { scope: item.actionReminderScope } : {}),
      focusNotificationId: item.id,
    })
    return
  }

  openPetPalAction(item.actionMode, item.actionUrl)
}

export const useNotificationStore = defineStore(
  'notifications',
  () => {
    const items = ref<AppNotificationItem[]>([])
    const seenVersions = ref<Record<string, string>>({})
    const syncedAt = ref('')
    const loading = ref(false)
    const lastError = ref('')

    const unreadCount = computed(() => items.value.filter(item => !isRead(item)).length)
    const unreadHighPriorityCount = computed(() => items.value.filter(item => (
      item.priority === 'HIGH' && !isRead(item)
    )).length)
    const ownerUnreadCount = computed(() => items.value.filter(item => (
      item.scope === 'OWNER' && !isRead(item)
    )).length)
    const caregiverUnreadCount = computed(() => items.value.filter(item => (
      item.scope === 'CAREGIVER' && !isRead(item)
    )).length)
    const accountUnreadCount = computed(() => items.value.filter(item => (
      item.scope === 'ACCOUNT' && !isRead(item)
    )).length)

    function isRead(item: AppNotificationItem) {
      return seenVersions.value[item.id] === item.updatedAtKey
    }

    function markAsRead(item: AppNotificationItem) {
      seenVersions.value = {
        ...seenVersions.value,
        [item.id]: item.updatedAtKey,
      }
    }

    function markAllAsRead(targetItems?: AppNotificationItem[]) {
      const next = { ...seenVersions.value }
      const rows = targetItems || items.value

      rows.forEach((item) => {
        next[item.id] = item.updatedAtKey
      })

      seenVersions.value = next
    }

    async function refreshNotifications() {
      const tokenStore = useTokenStore()
      const userStore = useUserStore()

      if (!tokenStore.hasLogin || loading.value) {
        return items.value
      }

      loading.value = true
      lastError.value = ''

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

        items.value = buildNotificationItems({
          userEmail: userStore.userInfo.email,
          pets: petsResult.status === 'fulfilled' ? petsResult.value : [],
          requests: requestsResult.status === 'fulfilled' ? requestsResult.value : [],
          ownerOrders: ownerOrdersResult.status === 'fulfilled' ? ownerOrdersResult.value : [],
          caregiverProfile: caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null,
          caregiverServices: caregiverServicesResult.status === 'fulfilled' ? caregiverServicesResult.value : [],
          caregiverOrders: caregiverOrdersResult.status === 'fulfilled' ? caregiverOrdersResult.value.items : [],
        })
        syncedAt.value = new Date().toISOString()
      }
      catch (error: unknown) {
        lastError.value = error instanceof Error ? error.message : 'load notifications failed'
      }
      finally {
        loading.value = false
      }

      return items.value
    }

    function clearNotifications() {
      items.value = []
      syncedAt.value = ''
      lastError.value = ''
      seenVersions.value = {}
    }

    return {
      items,
      syncedAt,
      loading,
      lastError,
      unreadCount,
      unreadHighPriorityCount,
      ownerUnreadCount,
      caregiverUnreadCount,
      accountUnreadCount,
      clearNotifications,
      isRead,
      markAsRead,
      markAllAsRead,
      refreshNotifications,
    }
  },
  {
    persist: true,
  },
)
