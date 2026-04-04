import type {
  ComplaintRecord,
  ComplaintTargetRole,
  ComplaintType,
  CurrentUser,
  MatchedCaregiverRecord,
  OrderRecord,
  OwnerPayChannel,
  PetProfileRecord,
  PetServiceType,
  ServiceLogType,
} from '@rbac/api-common'
import {
  formatAmount,
  formatCaregiverExperience,
  formatCaregiverNoticeHours,
  formatCaregiverRadius,
  formatDate,
  formatDateTime,
  formatDistanceKm,
  formatRange,
  formatPetTagSummary,
  genderLabels,
  getCaregiverAuditHint,
  getCaregiverAuditLabel,
  getComplaintTargetRoleLabel,
  getComplaintTypeLabel,
  getComplaintStatusHint,
  getComplaintStatusLabel,
  getConversationHint,
  getConversationPreview,
  getConversationUnreadCount,
  getOwnerPayChannelLabel,
  getOrderTone,
  getOrderStatusLabel,
  getRefundProgressStageHint,
  getRefundProgressStageLabel,
  getRequestStatusLabel,
  getServiceLogTypeLabel,
  joinTagText,
  openPetPalOrderDetailPage,
  openPetPalAction,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  serviceTypeLabels,
  speciesLabels,
  splitTagText,
  type PetPalOrderDetailEntrySource,
  type PetPalOrderDetailTab,
} from '../owner-shared'

export * from '../owner-shared'

export type OrderDetailTab = PetPalOrderDetailTab
export type ResultTone = 'accent' | 'success' | 'warning' | 'danger'

export const LOGIN_PAGE = '/pages/auth/login'
export const REGISTER_PAGE = '/pages/auth/register'
export const PETPAL_SETTINGS_PAGE = '/pages/settings/index'

export const payChannelOptions: Array<{ label: string, value: OwnerPayChannel, note: string }> = [
  { label: getOwnerPayChannelLabel('WECHAT_PAY'), value: 'WECHAT_PAY', note: '适合快速完成下单' },
  { label: getOwnerPayChannelLabel('ALIPAY'), value: 'ALIPAY', note: '适合常用移动支付' },
  { label: getOwnerPayChannelLabel('BALANCE'), value: 'BALANCE', note: '如果账户余额已充值' },
]

export const reviewTagOptions = [
  '准时到达',
  '沟通清晰',
  '对宠温柔',
  '照片反馈及时',
  '环境整洁',
  '可再次预约',
]

export const requestTagOptions = [
  '怕生需慢慢熟悉',
  '需要喂药',
  '固定作息',
  '外出前要牵引',
  '夜间安静环境',
  '希望高频回传',
]

export const complaintTargetOptions: Array<{ label: string, value: ComplaintTargetRole }> = [
  { label: '照料者', value: 'CAREGIVER' },
  { label: '平台', value: 'PLATFORM' },
]

export const complaintTypeOptions: Array<{ label: string, value: ComplaintType }> = [
  { label: '安全问题', value: 'SAFETY' },
  { label: '费用争议', value: 'FEE' },
  { label: '服务质量', value: 'SERVICE' },
  { label: '欺诈风险', value: 'FRAUD' },
  { label: '其他问题', value: 'OTHER' },
]

export const serviceLogOptions: Array<{ label: string, value: ServiceLogType, note: string }> = [
  { label: getServiceLogTypeLabel('CHECK_IN'), value: 'CHECK_IN', note: '到达后快速记录' },
  { label: getServiceLogTypeLabel('FEED'), value: 'FEED', note: '饮食和水量' },
  { label: getServiceLogTypeLabel('WALK'), value: 'WALK', note: '外出与排便情况' },
  { label: getServiceLogTypeLabel('PLAY'), value: 'PLAY', note: '互动和安抚' },
  { label: getServiceLogTypeLabel('HEALTH'), value: 'HEALTH', note: '精神与观察结果' },
  { label: getServiceLogTypeLabel('CHECK_OUT'), value: 'CHECK_OUT', note: '服务结束交接' },
  { label: getServiceLogTypeLabel('NOTE'), value: 'NOTE', note: '其他补充说明' },
]

export function getErrorMessage(error: unknown, fallback = '操作失败') {
  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  if (error && typeof error === 'object') {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string' && message.trim()) {
      return message.trim()
    }
  }

  return fallback
}

export function toast(title: string, icon: 'success' | 'none' = 'none') {
  uni.showToast({
    title,
    icon,
    duration: 1800,
  })
}

export function stopPullDown() {
  try {
    uni.stopPullDownRefresh()
  }
  catch {
    // noop
  }
}

export function formatMoney(value: number | string | null | undefined) {
  return `¥${formatAmount(value)}`
}

export function formatScore(value: number | string | null | undefined) {
  const score = Number(value ?? 0)
  if (!Number.isFinite(score) || score <= 0) {
    return '暂无评分'
  }
  return `${score.toFixed(1)} 分`
}

export function initials(value: string | null | undefined) {
  const text = (value || '').trim()
  if (!text) {
    return 'PP'
  }
  return text.length <= 2 ? text.toUpperCase() : text.slice(0, 2).toUpperCase()
}

export function readTagArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || '').trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return splitTagText(value)
  }
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .flatMap(item => readTagArray(item))
      .filter(Boolean)
  }
  return [] as string[]
}

export function formatSlotSummary(value: unknown) {
  const tags = readTagArray(value)
  if (tags.length) {
    return tags.join(' / ')
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  return '时间待沟通'
}

export function openLoginPage() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

export function openRoleHome(role: 'owner' | 'caregiver') {
  openPetPalAction('redirect', role === 'caregiver' ? PETPAL_CAREGIVER_HOME_PAGE : PETPAL_OWNER_HOME_PAGE)
}

export function openOrderDetailPage(orderId: string, tab: OrderDetailTab = 'overview', source?: PetPalOrderDetailEntrySource) {
  openPetPalOrderDetailPage({
    orderId,
    tab,
    source,
    mode: 'navigate',
  })
}

export function openOrderReviewPage(orderId: string) {
  uni.navigateTo({ url: `/pages/order-review/index?id=${orderId}` })
}

export function openOrderComplaintPage(orderId: string) {
  uni.navigateTo({ url: `/pages/order-complaint/index?id=${orderId}` })
}

export function isCaregiverEnabled(user: CurrentUser | null | undefined) {
  const roles = user?.roles || []
  return roles.some((role) => {
    const code = role.code.toLowerCase()
    return code.includes('caregiver') || role.name.includes('照料')
  })
}

export function describePet(pet: PetProfileRecord) {
  const breedText = pet.breed?.trim() || '未补品种'
  const birthdayText = pet.birthday ? formatDate(pet.birthday) : '生日未填'
  return `${speciesLabels[pet.species]} · ${breedText} · ${genderLabels[pet.gender]} · ${birthdayText}`
}

export function describePetCare(pet: PetProfileRecord) {
  const tags = formatPetTagSummary(pet.temperamentTags)
  const emergency = pet.emergencyContact?.phone || '未填写紧急联系人'
  return `${tags} · ${emergency}`
}

export function describeRequestWindow(start: string, end: string) {
  return formatRange(start, end)
}

export function describeCaregiverMatch(match: MatchedCaregiverRecord) {
  return [
    formatMoney(match.pricePerUnit),
    match.unitType,
    formatDistanceKm(match.distanceKm),
    formatCaregiverExperience(match.experienceYears),
  ].join(' · ')
}

export function describeCaregiverCapability(match: MatchedCaregiverRecord) {
  return [
    match.city || '城市待确认',
    formatCaregiverRadius(match.serviceRadiusKm),
    formatCaregiverNoticeHours(match.minNoticeHours),
  ].join(' · ')
}

export function describeOrder(order: Pick<OrderRecord, 'orderStatus' | 'appointmentStart' | 'appointmentEnd' | 'amountTotal'>) {
  return [
    getOrderStatusLabel(order.orderStatus),
    describeRequestWindow(order.appointmentStart, order.appointmentEnd),
    formatMoney(order.amountTotal),
  ].join(' · ')
}

export function describeConversation(order: Pick<OrderRecord, 'conversation'>, role: 'owner' | 'caregiver') {
  return {
    preview: getConversationPreview(order.conversation),
    meta: getConversationHint(order.conversation, role),
    unread: getConversationUnreadCount(order.conversation, role),
  }
}

export function summarizeComplaint(item: ComplaintRecord) {
  return [
    getComplaintTargetRoleLabel(item.targetRole),
    getComplaintTypeLabel(item.complaintType),
    getComplaintStatusLabel(item.status),
  ].join(' · ')
}

export function getComplaintTone(status: ComplaintRecord['status']): ResultTone {
  if (status === 'RESOLVED') return 'success'
  if (status === 'PROCESSING') return 'warning'
  if (status === 'REJECTED') return 'danger'
  return 'accent'
}

export function getOrderToneClass(status: OrderRecord['orderStatus']) {
  return getOrderTone(status)
}

export function toggleTagValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter(item => item !== value)
    : [...current, value]
}

export function roleSummary(user: CurrentUser | null | undefined) {
  const roles = user?.roles || []
  if (!roles.length) {
    return '主人服务账号'
  }
  return roles.map(item => item.name).join(' / ')
}

export function complaintTypeLabel(value: ComplaintType) {
  return getComplaintTypeLabel(value)
}

export function complaintTargetLabel(value: ComplaintTargetRole) {
  return getComplaintTargetRoleLabel(value)
}

export function caregiverAuditSummary(status: ReturnType<typeof getCaregiverAuditLabel>) {
  return status
}

export const helpers = {
  formatAmount,
  formatCaregiverExperience,
  formatCaregiverNoticeHours,
  formatCaregiverRadius,
  formatDate,
  formatDateTime,
  formatDistanceKm,
  formatRange,
  formatMoney,
  formatScore,
  getCaregiverAuditHint,
  getCaregiverAuditLabel,
  getComplaintStatusHint,
  getComplaintStatusLabel,
  getOrderStatusLabel,
  getRefundProgressStageHint,
  getRefundProgressStageLabel,
  getRequestStatusLabel,
  getServiceLogTypeLabel,
  joinTagText,
  readTagArray,
  serviceTypeLabels,
  speciesLabels,
}
