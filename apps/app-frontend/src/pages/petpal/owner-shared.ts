import type {
  MatchCaregiverQuery,
  OrderConversationRecord,
  OrderStatus,
  PetGender,
  PetServiceType,
  PetSpecies,
  ServiceRequestStatus,
} from '@rbac/api-common'
import dayjs from 'dayjs'

export const PETPAL_HUB_PAGE = '/pages/petpal/index'
export const PETPAL_WORKBENCH_PAGE = '/pages/petpal/workbench'
export const PETPAL_OWNER_HOME_PAGE = '/pages/petpal/owner-home'
export const PETPAL_PETS_PAGE = '/pages/petpal/pets'
export const PETPAL_REQUEST_PAGE = '/pages/petpal/request'
export const PETPAL_ORDERS_PAGE = '/pages/petpal/orders'
export const PETPAL_ORDER_DETAIL_PAGE = '/pages/order-detail/index'

export type ConversationRole = 'owner' | 'caregiver'

export const serviceTypeLabels: Record<PetServiceType, string> = {
  BOARDING: '寄养',
  WALKING: '遛宠',
  FEEDING: '喂养',
  DOOR_VISIT: '上门陪伴',
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

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING_ACCEPT: '待接单',
  ACCEPTED: '已接单',
  SERVING: '服务中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTED: '纠纷中',
  PARTIAL_REFUNDED: '部分退款',
  REFUNDED: '已退款',
}

export const serviceRequestStatusLabels: Record<ServiceRequestStatus, string> = {
  OPEN: '待匹配',
  MATCHING: '匹配中',
  CONFIRMED: '已确认',
  CANCELLED: '已取消',
  COMPLETED: '已完成',
}

export const serviceTypeOptions = [
  { label: '寄养', value: 'BOARDING', description: '短住照料与过夜陪护' },
  { label: '遛宠', value: 'WALKING', description: '固定时段外出活动' },
  { label: '喂养', value: 'FEEDING', description: '定时上门喂食换水' },
  { label: '上门陪伴', value: 'DOOR_VISIT', description: '互动安抚与环境巡视' },
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
  { label: '主人首页', value: PETPAL_OWNER_HOME_PAGE, description: '查看办事概览与快捷入口' },
  { label: '宠物档案', value: PETPAL_PETS_PAGE, description: '维护宠物资料与照料偏好' },
  { label: '发布需求', value: PETPAL_REQUEST_PAGE, description: '创建临时照料需求并筛选照料者' },
  { label: '订单跟进', value: PETPAL_ORDERS_PAGE, description: '按沟通、履约和售后持续跟进' },
]

export function formatAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0)
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return '--'
  }
  return dayjs(value).format('YYYY-MM-DD')
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '--'
  }
  return dayjs(value).format('MM-DD HH:mm')
}

export function formatRange(start: string | null | undefined, end: string | null | undefined) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`
}

export function splitTagText(value: string) {
  return [...new Set(
    value
      .split(/[\n,，、]/)
      .map(item => item.trim())
      .filter(Boolean),
  )]
}

export function joinTagText(tags?: string[]) {
  return (tags ?? []).join('，')
}

export function formatPetTagSummary(tags?: string[]) {
  return tags?.length ? tags.join(' / ') : '暂无偏好标签'
}

export function getOrderStatusLabel(status: OrderStatus) {
  return orderStatusLabels[status] || status
}

export function getRequestStatusLabel(status: ServiceRequestStatus) {
  return serviceRequestStatusLabels[status] || status
}

export function getOrderTone(status: OrderStatus) {
  if (status === 'COMPLETED') return 'success'
  if (status === 'SERVING' || status === 'ACCEPTED') return 'warning'
  if (status === 'DISPUTED' || status === 'PARTIAL_REFUNDED' || status === 'REFUNDED') return 'danger'
  return 'neutral'
}

export function getConversationUnreadCount(
  conversation: OrderConversationRecord | null | undefined,
  role: ConversationRole,
) {
  if (!conversation) {
    return 0
  }
  return role === 'owner' ? conversation.ownerUnreadCount : conversation.caregiverUnreadCount
}

export function getConversationPreview(conversation: OrderConversationRecord | null | undefined) {
  const preview = conversation?.lastMessagePreview?.trim()
  if (preview) {
    return preview
  }
  if (conversation?.lastMessageAt) {
    return '最近同步了一条附件或简短消息'
  }
  return '暂未开始订单沟通'
}

export function getConversationHint(
  conversation: OrderConversationRecord | null | undefined,
  role: ConversationRole,
) {
  const unreadCount = getConversationUnreadCount(conversation, role)
  const unreadText = unreadCount > 0 ? `${unreadCount} 条未读` : '已读完'
  if (conversation?.lastMessageAt) {
    return `${formatDateTime(conversation.lastMessageAt)} · ${unreadText}`
  }
  return unreadText
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
