import {
  formatPetPalAmount as formatSharedPetPalAmount,
  getPetPalComplaintStatusLabel as getSharedPetPalComplaintStatusLabel,
  getPetPalComplaintTargetRoleLabel as getSharedPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel as getSharedPetPalComplaintTypeLabel,
  formatPetPalConversationMeta as formatSharedPetPalConversationMeta,
  formatPetPalConversationPreview as formatSharedPetPalConversationPreview,
  formatPetPalDate as formatSharedPetPalDate,
  getPetPalOwnerPayChannelLabel as getSharedPetPalOwnerPayChannelLabel,
  getPetPalOrderStatusLabel as getSharedPetPalOrderStatusLabel,
  getPetPalOwnerOrderFilter as getSharedPetPalOwnerOrderFilter,
  getPetPalOrderTone as getSharedPetPalOrderTone,
  getPetPalRefundProgressStageHint as getSharedPetPalRefundProgressStageHint,
  getPetPalRefundProgressStageLabel as getSharedPetPalRefundProgressStageLabel,
  formatPetPalRange as formatSharedPetPalRange,
  getPetPalServiceLogTypeLabel as getSharedPetPalServiceLogTypeLabel,
  getPetPalServiceTypeLabel as getSharedPetPalServiceTypeLabel,
  formatPetPalTime as formatSharedPetPalTime,
  getPetPalConversationUnreadCount as getSharedPetPalConversationUnreadCount,
  formatPetPalTagSummary as formatSharedPetPalTagSummary,
  isPetPalOrderAftersalesTracked as isSharedPetPalOrderAftersalesTracked,
  joinPetPalTagText as joinSharedPetPalTagText,
  splitPetPalTagText as splitSharedPetPalTagText,
  getPetPalServiceRequestStatusLabel as getSharedPetPalServiceRequestStatusLabel,
  type CaregiverAuditStatus,
  type ComplaintStatus,
  type ComplaintTargetRole,
  type ComplaintType,
  type MatchCaregiverQuery,
  type OwnerPayChannel,
  type OrderRecord,
  type OrderConversationRecord,
  type OrderStatus,
  type PetGender,
  type PetServiceType,
  type PetSpecies,
  type RefundProgressStage,
  type ServiceLogType,
  type ServiceRequestStatus,
} from '@rbac/api-common'

export const PETPAL_HUB_PAGE = '/pages/petpal/index'
export const PETPAL_WORKBENCH_PAGE = '/pages/petpal/workbench'
export const PETPAL_GETTING_STARTED_PAGE = '/pages/petpal/getting-started'
export const PETPAL_OWNER_HOME_PAGE = '/pages/petpal/owner-home'
export const PETPAL_PETS_PAGE = '/pages/petpal/pets'
export const PETPAL_PET_FORM_PAGE = '/pages/petpal/pet-form'
export const PETPAL_REQUEST_PAGE = '/pages/petpal/request'
export const PETPAL_REQUEST_DETAIL_PAGE = '/pages/petpal/request-detail'
export const PETPAL_CHECKOUT_PAGE = '/pages/petpal/checkout'
export const PETPAL_PAYMENT_RESULT_PAGE = '/pages/petpal/payment-result'
export const PETPAL_REFUND_RESULT_PAGE = '/pages/petpal/refund-result'
export const PETPAL_COMPLAINT_RESULT_PAGE = '/pages/petpal/complaint-result'
export const PETPAL_REVIEW_RESULT_PAGE = '/pages/petpal/review-result'
export const PETPAL_ORDERS_PAGE = '/pages/petpal/orders'
export const PETPAL_AFTERSALES_PAGE = '/pages/petpal/aftersales'
export const PETPAL_REMINDERS_PAGE = '/pages/petpal/reminders'
export const PETPAL_NOTIFICATIONS_PAGE = '/pages/notifications/index'
export const PETPAL_HELP_PAGE = '/pages/help/index'
export const PETPAL_ACCOUNT_SUPPORT_PAGE = '/pages/account/support'
export const PETPAL_CAREGIVER_HOME_PAGE = '/pages/petpal/caregiver-home'
export const PETPAL_CAREGIVER_PROFILE_PAGE = '/pages/petpal/caregiver-profile'
export const PETPAL_CAREGIVER_SERVICES_PAGE = '/pages/petpal/caregiver-services'
export const PETPAL_CAREGIVER_SERVICE_FORM_PAGE = '/pages/petpal/caregiver-service-form'
export const PETPAL_CAREGIVER_ORDERS_PAGE = '/pages/petpal/caregiver-orders'
export const PETPAL_CAREGIVER_EARNINGS_PAGE = '/pages/petpal/caregiver-earnings'
export const PETPAL_MESSAGES_PAGE = '/pages/petpal/messages'
export const PETPAL_ORDER_DETAIL_PAGE = '/pages/order-detail/index'
export const PETPAL_ORDER_REVIEW_PAGE = '/pages/order-review/index'
export const PETPAL_ORDER_COMPLAINT_PAGE = '/pages/order-complaint/index'
export const PETPAL_TABBAR_PAGES = [
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_MESSAGES_PAGE,
  '/pages/me/me',
]
const PETPAL_PAGE_CONTEXT_STORAGE_PREFIX = 'petpal:page-context'

export type ConversationRole = 'owner' | 'caregiver'
export type CaregiverOrderFilterValue = OrderStatus | 'ALL'
export type OwnerOrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'AFTERSALES'
export type AftersalesFilter = 'ALL' | 'HIGH' | 'REFUND' | 'COMPLAINT'
export type MessagesFilter = 'ALL' | 'UNREAD'
export type ReminderScope = 'ALL' | 'OWNER' | 'CAREGIVER' | 'ACCOUNT'
export type PetPalOrderDetailTab = 'overview' | 'chat' | 'service' | 'aftersales'
export type PetPalNotificationDrivenOrderDetailSource = 'notifications' | 'reminders'
export type PetPalOrderDetailEntrySource = 'messages' | 'payment-result' | 'refund-result' | 'complaint-result' | 'review-result' | 'owner-home' | 'orders' | 'aftersales' | 'caregiver-home' | 'caregiver-orders' | 'caregiver-earnings' | PetPalNotificationDrivenOrderDetailSource

export interface PetPalOrdersPageContext {
  filter?: OwnerOrderFilter
  focusOrderId?: string
}

export interface PetPalAftersalesPageContext {
  filter?: AftersalesFilter
  focusOrderId?: string
}

export interface PetPalMessagesPageContext {
  role?: ConversationRole
  filter?: MessagesFilter
  focusOrderId?: string
}

export interface PetPalRemindersPageContext {
  scope?: ReminderScope
  focusNotificationId?: string
}

export interface PetPalOrderDetailPageContext {
  orderId?: string
  tab?: PetPalOrderDetailTab
  source?: PetPalOrderDetailEntrySource
}

const ownerOrderFilters: OwnerOrderFilter[] = ['ALL', 'ACTIVE', 'COMPLETED', 'AFTERSALES']
const aftersalesFilters: AftersalesFilter[] = ['ALL', 'HIGH', 'REFUND', 'COMPLAINT']
const messagesFilters: MessagesFilter[] = ['ALL', 'UNREAD']
const reminderScopes: ReminderScope[] = ['ALL', 'OWNER', 'CAREGIVER', 'ACCOUNT']
const orderDetailTabs: PetPalOrderDetailTab[] = ['overview', 'chat', 'service', 'aftersales']
const orderDetailEntrySources: PetPalOrderDetailEntrySource[] = ['messages', 'payment-result', 'refund-result', 'complaint-result', 'review-result', 'owner-home', 'orders', 'aftersales', 'caregiver-home', 'caregiver-orders', 'caregiver-earnings', 'notifications', 'reminders']

export const serviceTypeLabels: Record<PetServiceType, string> = {
  BOARDING: getSharedPetPalServiceTypeLabel('BOARDING'),
  WALKING: getSharedPetPalServiceTypeLabel('WALKING'),
  FEEDING: getSharedPetPalServiceTypeLabel('FEEDING'),
  DOOR_VISIT: getSharedPetPalServiceTypeLabel('DOOR_VISIT'),
}

export const speciesLabels: Record<PetSpecies, string> = {
  DOG: '犬类',
  CAT: '猫咪',
  OTHER: '其他宠物',
}

export const genderLabels: Record<PetGender, string> = {
  MALE: '公',
  FEMALE: '母',
  UNKNOWN: '未知',
}

export const caregiverAuditLabels: Record<CaregiverAuditStatus, string> = {
  PENDING: '待审核',
  APPROVED: '审核通过',
  REJECTED: '审核驳回',
}

export const serviceTypeOptions = [
  { label: getSharedPetPalServiceTypeLabel('BOARDING'), value: 'BOARDING', description: '短住照料与过夜陪护' },
  { label: getSharedPetPalServiceTypeLabel('WALKING'), value: 'WALKING', description: '固定时段外出活动' },
  { label: getSharedPetPalServiceTypeLabel('FEEDING'), value: 'FEEDING', description: '定时上门喂食换水' },
  { label: getSharedPetPalServiceTypeLabel('DOOR_VISIT'), value: 'DOOR_VISIT', description: '互动安抚与环境巡视' },
]

export const speciesOptions = [
  { label: '犬类', value: 'DOG', description: '外出活动和寄养需求更常见' },
  { label: '猫咪', value: 'CAT', description: '更关注环境稳定与应激管理' },
  { label: '其他', value: 'OTHER', description: '异宠或定制化照料' },
]

export const genderOptions = [
  { label: '公', value: 'MALE' },
  { label: '母', value: 'FEMALE' },
  { label: '未知', value: 'UNKNOWN' },
]

export const yesNoOptions = [
  { label: '是', value: 'YES' },
  { label: '否', value: 'NO' },
]

export const ownerFlowOptions = [
  { label: '宠物档案', value: PETPAL_PETS_PAGE, description: '维护宠物资料与照料偏好' },
  { label: '新建需求', value: PETPAL_REQUEST_PAGE, description: '创建临时照料需求并筛选照料者' },
  { label: '确认支付', value: PETPAL_CHECKOUT_PAGE, description: '确认照料者、金额与支付方式' },
  { label: '售后中心', value: PETPAL_AFTERSALES_PAGE, description: '集中处理退款、投诉和争议事项' },
]

export const caregiverFlowOptions = [
  { label: '照料者首页', value: PETPAL_CAREGIVER_HOME_PAGE, description: '查看待办、审核状态与履约摘要' },
  { label: '入驻中心', value: PETPAL_CAREGIVER_PROFILE_PAGE, description: '维护介绍、专长和资质材料' },
  { label: '服务管理', value: PETPAL_CAREGIVER_SERVICES_PAGE, description: '设置报价、范围与上架状态' },
  { label: '履约订单', value: PETPAL_CAREGIVER_ORDERS_PAGE, description: '处理接单、签到和服务记录' },
  { label: '收益表现', value: PETPAL_CAREGIVER_EARNINGS_PAGE, description: '查看收入、评分和售后风险' },
]

export const caregiverOrderFilterOptions = [
  { label: '待接单', value: 'PENDING_ACCEPT' },
  { label: '已接单', value: 'ACCEPTED' },
  { label: '服务中', value: 'SERVING' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '全部', value: 'ALL' },
]

export const serviceLogTypeOptions = [
  { label: '备注', value: 'NOTE', description: '交接与补充说明' },
  { label: '喂养', value: 'FEED', description: '记录饮食和水量' },
  { label: '遛宠', value: 'WALK', description: '记录外出时长和状态' },
  { label: '陪伴', value: 'PLAY', description: '记录互动和玩耍情况' },
  { label: '观察', value: 'HEALTH', description: '记录精神与健康表现' },
]

export function formatAmount(value: number | string | null | undefined) {
  return formatSharedPetPalAmount(value)
}

export function getOwnerPayChannelLabel(channel: OwnerPayChannel) {
  return getSharedPetPalOwnerPayChannelLabel(channel)
}

export function openPetPalAction(mode: 'redirect' | 'navigate', url: string) {
  const normalizedUrl = url.split('?')[0]
  if (PETPAL_TABBAR_PAGES.includes(normalizedUrl)) {
    uni.switchTab({ url: normalizedUrl })
    return
  }

  const openWithNavigate = () => {
    uni.navigateTo({ url })
  }

  if (mode === 'navigate') {
    openWithNavigate()
    return
  }

  uni.redirectTo({
    url,
    fail: () => openWithNavigate(),
  })
}

function normalizePageContextId(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function getPetPalPageContextStorageKey(page: 'orders' | 'aftersales' | 'messages' | 'reminders' | 'order-detail') {
  return `${PETPAL_PAGE_CONTEXT_STORAGE_PREFIX}:${page}`
}

export function isOwnerOrderFilter(value: string | null | undefined): value is OwnerOrderFilter {
  return ownerOrderFilters.includes(value as OwnerOrderFilter)
}

export function isAftersalesFilter(value: string | null | undefined): value is AftersalesFilter {
  return aftersalesFilters.includes(value as AftersalesFilter)
}

export function isMessagesFilter(value: string | null | undefined): value is MessagesFilter {
  return messagesFilters.includes(value as MessagesFilter)
}

export function isReminderScope(value: string | null | undefined): value is ReminderScope {
  return reminderScopes.includes(value as ReminderScope)
}

export function isPetPalOrderDetailTab(value: string | null | undefined): value is PetPalOrderDetailTab {
  return orderDetailTabs.includes(value as PetPalOrderDetailTab)
}

export function isPetPalOrderDetailEntrySource(value: string | null | undefined): value is PetPalOrderDetailEntrySource {
  return orderDetailEntrySources.includes(value as PetPalOrderDetailEntrySource)
}

function stashPetPalPageContext(page: 'orders', context: PetPalOrdersPageContext): void
function stashPetPalPageContext(page: 'aftersales', context: PetPalAftersalesPageContext): void
function stashPetPalPageContext(page: 'messages', context: PetPalMessagesPageContext): void
function stashPetPalPageContext(page: 'reminders', context: PetPalRemindersPageContext): void
function stashPetPalPageContext(page: 'order-detail', context: PetPalOrderDetailPageContext): void
function stashPetPalPageContext(
  page: 'orders' | 'aftersales' | 'messages' | 'reminders' | 'order-detail',
  context: PetPalOrdersPageContext | PetPalAftersalesPageContext | PetPalMessagesPageContext | PetPalRemindersPageContext | PetPalOrderDetailPageContext,
) {
  const hasFilter = 'filter' in context && typeof context.filter === 'string' && context.filter.length > 0
  const hasRole = 'role' in context && typeof context.role === 'string' && context.role.length > 0
  const hasScope = 'scope' in context && typeof context.scope === 'string' && context.scope.length > 0
  const hasTab = 'tab' in context && typeof context.tab === 'string' && context.tab.length > 0
  const hasSource = 'source' in context && typeof context.source === 'string' && context.source.length > 0
  const focusOrderId = 'focusOrderId' in context ? normalizePageContextId(context.focusOrderId) : ''
  const focusNotificationId = 'focusNotificationId' in context ? normalizePageContextId(context.focusNotificationId) : ''
  const orderId = 'orderId' in context ? normalizePageContextId(context.orderId) : ''
  const key = getPetPalPageContextStorageKey(page)

  if (!hasFilter && !hasRole && !hasScope && !hasTab && !hasSource && !focusOrderId && !focusNotificationId && !orderId) {
    uni.removeStorageSync(key)
    return
  }

  uni.setStorageSync(key, {
    ...(hasFilter ? { filter: context.filter } : {}),
    ...(hasRole ? { role: context.role } : {}),
    ...(hasScope ? { scope: context.scope } : {}),
    ...(hasTab ? { tab: context.tab } : {}),
    ...(hasSource ? { source: context.source } : {}),
    ...(focusOrderId ? { focusOrderId } : {}),
    ...(focusNotificationId ? { focusNotificationId } : {}),
    ...(orderId ? { orderId } : {}),
  })
}

export function consumePetPalOrdersPageContext(): PetPalOrdersPageContext | null {
  const key = getPetPalPageContextStorageKey('orders')
  const rawValue = uni.getStorageSync(key)
  uni.removeStorageSync(key)

  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  const record = rawValue as Record<string, unknown>
  const filter = isOwnerOrderFilter(record.filter as string) ? record.filter as OwnerOrderFilter : undefined
  const focusOrderId = normalizePageContextId(record.focusOrderId) || undefined

  if (!filter && !focusOrderId) {
    return null
  }

  return {
    ...(filter ? { filter } : {}),
    ...(focusOrderId ? { focusOrderId } : {}),
  }
}

export function consumePetPalAftersalesPageContext(): PetPalAftersalesPageContext | null {
  const key = getPetPalPageContextStorageKey('aftersales')
  const rawValue = uni.getStorageSync(key)
  uni.removeStorageSync(key)

  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  const record = rawValue as Record<string, unknown>
  const filter = isAftersalesFilter(record.filter as string) ? record.filter as AftersalesFilter : undefined
  const focusOrderId = normalizePageContextId(record.focusOrderId) || undefined

  if (!filter && !focusOrderId) {
    return null
  }

  return {
    ...(filter ? { filter } : {}),
    ...(focusOrderId ? { focusOrderId } : {}),
  }
}

export function consumePetPalMessagesPageContext(): PetPalMessagesPageContext | null {
  const key = getPetPalPageContextStorageKey('messages')
  const rawValue = uni.getStorageSync(key)
  uni.removeStorageSync(key)

  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  const record = rawValue as Record<string, unknown>
  const role = record.role === 'owner' || record.role === 'caregiver' ? record.role : undefined
  const filter = isMessagesFilter(record.filter as string) ? record.filter as MessagesFilter : undefined
  const focusOrderId = normalizePageContextId(record.focusOrderId) || undefined

  if (!role && !filter && !focusOrderId) {
    return null
  }

  return {
    ...(role ? { role } : {}),
    ...(filter ? { filter } : {}),
    ...(focusOrderId ? { focusOrderId } : {}),
  }
}

export function consumePetPalRemindersPageContext(): PetPalRemindersPageContext | null {
  const key = getPetPalPageContextStorageKey('reminders')
  const rawValue = uni.getStorageSync(key)
  uni.removeStorageSync(key)

  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  const record = rawValue as Record<string, unknown>
  const scope = isReminderScope(record.scope as string) ? record.scope as ReminderScope : undefined
  const focusNotificationId = normalizePageContextId(record.focusNotificationId) || undefined

  if (!scope && !focusNotificationId) {
    return null
  }

  return {
    ...(scope ? { scope } : {}),
    ...(focusNotificationId ? { focusNotificationId } : {}),
  }
}

export function consumePetPalOrderDetailPageContext(): PetPalOrderDetailPageContext | null {
  const key = getPetPalPageContextStorageKey('order-detail')
  const rawValue = uni.getStorageSync(key)
  uni.removeStorageSync(key)

  if (!rawValue || typeof rawValue !== 'object') {
    return null
  }

  const record = rawValue as Record<string, unknown>
  const orderId = normalizePageContextId(record.orderId) || undefined
  const tab = isPetPalOrderDetailTab(record.tab as string) ? record.tab as PetPalOrderDetailTab : undefined
  const source = isPetPalOrderDetailEntrySource(record.source as string)
    ? record.source as PetPalOrderDetailEntrySource
    : undefined

  if (!orderId || !source) {
    return null
  }

  return {
    orderId,
    ...(tab ? { tab } : {}),
    source,
  }
}

export function openPetPalOrdersPage(params?: PetPalOrdersPageContext & { mode?: 'redirect' | 'navigate' }) {
  const { mode = 'redirect', ...context } = params ?? {}
  stashPetPalPageContext('orders', context)
  openPetPalAction(mode, PETPAL_ORDERS_PAGE)
}

export function openPetPalAftersalesPage(params?: PetPalAftersalesPageContext & { mode?: 'redirect' | 'navigate' }) {
  const { mode = 'redirect', ...context } = params ?? {}
  stashPetPalPageContext('aftersales', context)
  openPetPalAction(mode, PETPAL_AFTERSALES_PAGE)
}

export function openPetPalMessagesPage(params?: PetPalMessagesPageContext & { mode?: 'redirect' | 'navigate' }) {
  const { mode = 'redirect', ...context } = params ?? {}
  stashPetPalPageContext('messages', context)
  openPetPalAction(mode, PETPAL_MESSAGES_PAGE)
}

export function openPetPalRemindersPage(params?: PetPalRemindersPageContext & { mode?: 'redirect' | 'navigate' }) {
  const { mode = 'redirect', ...context } = params ?? {}
  stashPetPalPageContext('reminders', context)
  openPetPalAction(mode, PETPAL_REMINDERS_PAGE)
}

export function openPetPalOrderDetailPage(params: PetPalOrderDetailPageContext & { mode?: 'redirect' | 'navigate' }) {
  const {
    mode = 'navigate',
    orderId,
    tab = 'overview',
    source,
  } = params
  const normalizedOrderId = normalizePageContextId(orderId)

  if (!normalizedOrderId) {
    return
  }

  if (source) {
    stashPetPalPageContext('order-detail', {
      orderId: normalizedOrderId,
      tab,
      source,
    })
  }

  openPetPalAction(mode, `${PETPAL_ORDER_DETAIL_PAGE}?id=${normalizedOrderId}&tab=${tab}`)
}

export function openPetPalPetFormPage(options?: {
  mode?: 'redirect' | 'navigate'
  petId?: string
  from?: string
}) {
  const mode = options?.mode || 'navigate'
  const query = new URLSearchParams()
  if (options?.petId) {
    query.set('petId', options.petId)
  }
  if (options?.from) {
    query.set('from', options.from)
  }
  const suffix = query.toString()
  openPetPalAction(mode, `${PETPAL_PET_FORM_PAGE}${suffix ? `?${suffix}` : ''}`)
}

export function openPetPalCaregiverServiceFormPage(options?: {
  mode?: 'redirect' | 'navigate'
  serviceId?: string
  from?: string
}) {
  const mode = options?.mode || 'navigate'
  const query = new URLSearchParams()
  if (options?.serviceId) {
    query.set('serviceId', options.serviceId)
  }
  if (options?.from) {
    query.set('from', options.from)
  }
  const suffix = query.toString()
  openPetPalAction(mode, `${PETPAL_CAREGIVER_SERVICE_FORM_PAGE}${suffix ? `?${suffix}` : ''}`)
}

export function formatPercent(value: number | null | undefined) {
  const numberValue = Number(value ?? 0)
  if (!Number.isFinite(numberValue)) {
    return '0%'
  }
  return `${(numberValue * 100).toFixed(numberValue >= 0.1 ? 1 : 0)}%`
}

export function formatDate(value: string | null | undefined) {
  return formatSharedPetPalDate(value)
}

export function formatDateTime(value: string | null | undefined) {
  return formatSharedPetPalTime(value)
}

export function formatRange(start: string | null | undefined, end: string | null | undefined) {
  return formatSharedPetPalRange(start, end)
}

export function formatDistanceKm(distanceKm: number | null | undefined) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) {
    return '距离待确认'
  }
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`
  }
  return `${distanceKm >= 10 ? distanceKm.toFixed(0) : distanceKm.toFixed(1)}km`
}

export function formatCaregiverExperience(years: number | null | undefined) {
  const normalizedYears = Number(years ?? 0)
  if (!Number.isFinite(normalizedYears) || normalizedYears <= 0) {
    return '新入驻'
  }
  return `${normalizedYears} 年经验`
}

export function formatCaregiverRadius(radiusKm: number | null | undefined) {
  const normalizedRadius = Number(radiusKm ?? 0)
  if (!Number.isFinite(normalizedRadius) || normalizedRadius <= 0) {
    return '范围待确认'
  }
  return `${normalizedRadius}km 服务圈`
}

export function formatCaregiverNoticeHours(hours: number | null | undefined) {
  const normalizedHours = Number(hours ?? 0)
  if (!Number.isFinite(normalizedHours) || normalizedHours <= 0) {
    return '即时可约'
  }
  return `${normalizedHours} 小时前预约`
}

export function splitTagText(value: string) {
  return splitSharedPetPalTagText(value, {
    dedupe: true,
  })
}

export function joinTagText(tags?: string[]) {
  return joinSharedPetPalTagText(tags)
}

export function formatPetTagSummary(tags?: string[]) {
  return formatSharedPetPalTagSummary(tags)
}

export function getOrderStatusLabel(status: OrderStatus) {
  return getSharedPetPalOrderStatusLabel(status)
}

export function getCaregiverAuditLabel(status: CaregiverAuditStatus) {
  return caregiverAuditLabels[status] || status
}

export function getRequestStatusLabel(status: ServiceRequestStatus) {
  return getSharedPetPalServiceRequestStatusLabel(status)
}

export function isRequestActive(status: ServiceRequestStatus) {
  return status === 'OPEN' || status === 'MATCHED'
}

export function canRequestCheckout(request: {
  status: ServiceRequestStatus
  matchedCaregiverId?: string | null
}) {
  return request.status === 'MATCHED' || Boolean(request.matchedCaregiverId)
}

export function getRequestTagType(status: ServiceRequestStatus) {
  if (status === 'MATCHED') {
    return 'success'
  }
  if (status === 'OPEN') {
    return 'warning'
  }
  return 'default'
}

export function getRefundProgressStageLabel(stage: RefundProgressStage) {
  return getSharedPetPalRefundProgressStageLabel(stage)
}

export function getRefundProgressStageHint(stage: RefundProgressStage) {
  return getSharedPetPalRefundProgressStageHint(stage)
}

export function getComplaintStatusLabel(status: ComplaintStatus) {
  return getSharedPetPalComplaintStatusLabel(status)
}

export function getComplaintStatusHint(status: ComplaintStatus) {
  const hints: Record<ComplaintStatus, string> = {
    OPEN: '投诉已提交，等待平台受理并同步后续处理动作。',
    PROCESSING: '平台正在核查投诉内容，建议持续关注处理日志和沟通消息。',
    RESOLVED: '投诉已经完成处理，当前可以回看结论并继续订单后续动作。',
    REJECTED: '本次投诉未通过，建议先看原因，再决定是否补充材料或重新发起。',
  }
  return hints[status] || status
}

export function getComplaintTypeLabel(type: ComplaintType) {
  return getSharedPetPalComplaintTypeLabel(type)
}

export function getComplaintTargetRoleLabel(role: ComplaintTargetRole) {
  return getSharedPetPalComplaintTargetRoleLabel(role)
}

export function getCaregiverAuditHint(status: CaregiverAuditStatus | null | undefined) {
  if (!status || status === 'PENDING') {
    return '平台会结合资料完整度、资质材料和服务说明进行审核。'
  }
  if (status === 'APPROVED') {
    return '档案已通过审核，继续保持服务配置和履约反馈的时效。'
  }
  return '档案曾被驳回，请补齐介绍、城市与资质材料后再次提交。'
}

export function getOrderTone(status: OrderStatus) {
  return getSharedPetPalOrderTone(status)
}

export function getConversationUnreadCount(
  conversation: OrderConversationRecord | null | undefined,
  role: ConversationRole,
) {
  return getSharedPetPalConversationUnreadCount(conversation, role)
}

export function getConversationPreview(conversation: OrderConversationRecord | null | undefined) {
  return formatSharedPetPalConversationPreview(conversation, {
    recentMessageFallbackText: '最近同步了一条附件或简短消息',
    emptyText: '暂未开始订单沟通',
  })
}

export function getConversationHint(
  conversation: OrderConversationRecord | null | undefined,
  role: ConversationRole,
) {
  return formatSharedPetPalConversationMeta(conversation, {
    role,
    formatTime: formatDateTime,
    emptyText: '已读完',
  })
}

export function getServiceLogTypeLabel(logType: ServiceLogType) {
  return getSharedPetPalServiceLogTypeLabel(logType)
}

export function isOrderAftersalesTracked(
  order: Pick<OrderRecord, 'orderStatus' | 'refunds' | 'amountRefunded'>,
) {
  return isSharedPetPalOrderAftersalesTracked(order)
}

export function getOwnerOrderFilterForOrder(
  order: Pick<OrderRecord, 'orderStatus' | 'refunds' | 'amountRefunded'>,
): OwnerOrderFilter {
  return getSharedPetPalOwnerOrderFilter(order)
}

export function buildOwnerMatchQuery(params: {
  petSpecies?: PetSpecies
  serviceType?: PetServiceType
  city?: string
  pageSize?: number
}): MatchCaregiverQuery {
  return {
    serviceType: params.serviceType || 'BOARDING',
    petSpecies: params.petSpecies || 'DOG',
    city: params.city?.trim() || undefined,
    page: 1,
    pageSize: params.pageSize || 6,
  }
}
