<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 主人或照料者查看单笔订单，并且要立刻知道“现在处理什么”
 * Entry: 从订单列表、消息中心、售后中心、支付回流进入
 * Core scenes:
 * 1. 首屏先判断当前阶段、待支付金额、未读沟通和售后风险
 * 2. 支付 / 沟通 / 看履约 / 售后 / 评价都必须在首屏找到，不要求用户滚长页
 * 3. 总览负责决策，细节再进入沟通 / 履约 / 售后分栏
 * 4. 沟通分栏必须像聊天工作区，优先处理未读，再完成发送和附件查看
 * 5. 履约分栏必须先给出最新进展，再展示服务回传，最后决定是否确认完成
 * 6. 售后分栏必须先判断有没有纠纷，再展示退款 / 投诉卡片和最新处理动作
 * Primary action: 按状态快速处理支付、沟通、履约、确认完成、评价或投诉
 * Secondary actions: 查看支付记录、退款记录、服务记录和附件
 * Feedback: 当前阶段、下一步、未读消息、服务记录数量、售后进度
 * States: 加载中、订单不存在、待支付、待接单、服务中、待评价、售后中
 */
import type {
  CaregiverQualificationMaterialRecord,
  ComplaintActionType,
  ComplaintRecord,
  ComplaintStatus,
  ComplaintTargetRole,
  ComplaintType,
  CreateOrderMessagePayload,
  OrderDetailRecord,
  OrderConversationDetailRecord,
  OrderMessageRecord,
  OrderOperatorRole,
  OrderRefundProgressRecord,
  OrderStatus,
  OrderTimelineEventType,
  OrderTimelineRecord,
  ServiceLogRecord,
  ServiceLogType,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import {
  confirmOrderComplete,
  getOrderComplaints,
  getOrderDetail,
  getOrderMessages,
  getOrderRefundProgress,
  markOrderMessagesRead,
  sendOrderMessage,
} from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import {
  PETPAL_CHECKOUT_PAGE,
  PETPAL_COMPLAINT_RESULT_PAGE,
  PETPAL_ORDER_COMPLAINT_PAGE,
  PETPAL_ORDER_REVIEW_PAGE,
  PETPAL_REVIEW_RESULT_PAGE,
  PETPAL_REFUND_RESULT_PAGE,
  getConversationHint,
  getConversationPreview,
  getOrderTone,
} from '@/pages/petpal/owner-shared'
import { useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'OrderDetailPage',
})

definePage({
  style: {
    navigationBarTitleText: '订单详情',
    enablePullDownRefresh: true,
  },
})

const orderId = ref('')
const order = ref<OrderDetailRecord | null>(null)
const refundProgress = ref<OrderRefundProgressRecord | null>(null)
const complaints = ref<ComplaintRecord[]>([])
const messageConversation = ref<OrderConversationDetailRecord | null>(null)
const loading = ref(false)
const error = ref('')
const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)

const labels = {
  orderStatus: {
    PENDING_ACCEPT: '待接单',
    ACCEPTED: '已接单',
    SERVING: '服务中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    DISPUTED: '纠纷中',
    PARTIAL_REFUNDED: '部分退款',
    REFUNDED: '全额退款',
  } as Record<string, string>,
  serviceType: {
    BOARDING: '寄养',
    WALKING: '遛宠',
    FEEDING: '喂养',
    DOOR_VISIT: '上门陪伴',
  } as Record<string, string>,
  paymentStatus: {
    PENDING: '待支付',
    PAID: '已支付',
    FAILED: '支付失败',
    CLOSED: '已关闭',
  } as Record<string, string>,
  refundStatus: {
    PENDING: '处理中',
    APPROVED: '已批准',
    REJECTED: '已拒绝',
    SUCCESS: '已退款',
    FAILED: '退款失败',
  } as Record<string, string>,
  refundType: {
    FULL: '全额退款',
    PARTIAL: '部分退款',
  } as Record<string, string>,
  refundProgressStage: {
    NONE: '暂无退款',
    PENDING_REVIEW: '待审核',
    APPROVED_WAITING: '待退款',
    PARTIAL_SUCCESS: '部分退款成功',
    FULL_SUCCESS: '退款完成',
    REJECTED: '已驳回',
    FAILED: '退款失败',
  } as Record<string, string>,
  paymentBizType: {
    DEPOSIT: '定金',
    BALANCE: '尾款',
    ADJUSTMENT: '调整',
  } as Record<string, string>,
  timelineEvent: {
    CREATED: '订单创建',
    ACCEPTED: '照料者接单',
    CHECKED_IN: '照料者签到',
    SERVICE_LOGGED: '上传服务记录',
    CHECKED_OUT: '照料者签退',
    COMPLETED: '业主确认完成',
    DISPUTED: '发起投诉',
    CANCELLED: '订单取消',
    REFUND_APPLIED: '发起退款',
    REFUND_DONE: '退款完成',
  } as Record<string, string>,
  operatorRole: {
    OWNER: '宠物主人',
    CAREGIVER: '照料者',
    ADMIN: '管理员',
    SYSTEM: '系统',
  } as Record<string, string>,
  serviceLogType: {
    CHECK_IN: '签到记录',
    FEED: '喂养记录',
    WALK: '遛宠记录',
    PLAY: '陪玩记录',
    HEALTH: '健康观察',
    CHECK_OUT: '签退记录',
    NOTE: '服务备注',
  } as Record<string, string>,
  complaintTargetRole: {
    CAREGIVER: '照料者',
    PLATFORM: '平台',
  } as Record<string, string>,
  complaintType: {
    SAFETY: '安全问题',
    FEE: '费用争议',
    SERVICE: '服务质量',
    FRAUD: '欺诈风险',
    OTHER: '其他问题',
  } as Record<string, string>,
  complaintStatus: {
    OPEN: '待受理',
    PROCESSING: '处理中',
    RESOLVED: '已解决',
    REJECTED: '已驳回',
  } as Record<string, string>,
  complaintAction: {
    OPEN: '发起投诉',
    ASSIGN: '指派负责人',
    INVESTIGATE: '补充调查',
    CALL_USER: '联系用户',
    PENALTY: '处罚记录',
    CLOSE: '结案',
  } as Record<string, string>,
}

type AftersalesTimelineDotClass = 'warning' | 'primary' | 'success' | 'error' | 'closed'
type OrderDetailTab = 'overview' | 'chat' | 'service' | 'aftersales'
type OrderQuickAction = 'PAY' | 'COMPLETE' | 'CHAT' | 'SERVICE' | 'AFTERSALES' | 'REVIEW' | 'COMPLAINT'
type AppTagTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

interface AftersalesTimelineItem {
  id: string
  occurredAt: string
  title: string
  statusLabel: string
  statusClass: AftersalesTimelineDotClass
  referenceLabel: string
  referenceValue: string
  note: string | null
  details: string[]
}

interface OrderOverviewSignalCard {
  key: string
  title: string
  value: string
  hint: string
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'default'
  action: 'CHAT' | 'SERVICE' | 'AFTERSALES' | null
}

interface OrderHeroTag {
  label: string
  type: AppTagTone
}

interface OrderDetailTabCard {
  label: string
  value: OrderDetailTab
  metric: string
  hint: string
}

interface OrderTabSummaryCard {
  key: string
  label: string
  value: string
  hint: string
  tone: AppTagTone
}

const confirmingCompletion = ref(false)
const messageSubmitting = ref(false)
const detailTab = ref<OrderDetailTab>('overview')

const {
  uploading: messageAttachmentUploading,
  selectAndUploadAttachments: selectAndUploadMessageAttachments,
} = useManagedAttachmentUpload({
  maxCount: 4,
  maxSizeMb: 10,
})

const messageForm = reactive({
  content: '',
  attachments: [] as CaregiverQualificationMaterialRecord[],
})

const activeComplaint = computed(() => complaints.value.find(item => (
  item.status === 'OPEN' || item.status === 'PROCESSING'
)) ?? null)
const isOwnerView = computed(() => Boolean(userInfo.value.id && order.value?.ownerId === userInfo.value.id))
const outstandingAmount = computed(() => {
  if (!order.value) {
    return 0
  }
  return Number(Math.max(
    0,
    Number(order.value.amountTotal) + Number(order.value.amountAdjusted) - Number(order.value.amountPaid),
  ).toFixed(2))
})
const canPayOrder = computed(() => Boolean(
  isOwnerView.value
  && order.value?.orderStatus === 'PENDING_ACCEPT'
  && outstandingAmount.value > 0,
))
const canConfirmComplete = computed(() => Boolean(isOwnerView.value && order.value?.orderStatus === 'SERVING'))
const canCreateReview = computed(() => (
  Boolean(isOwnerView.value && order.value?.orderStatus === 'COMPLETED' && !order.value?.review)
))
const canCreateComplaint = computed(() => Boolean(
  isOwnerView.value
  && order.value
  && ['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(order.value.orderStatus)
  && !activeComplaint.value,
))
const currentConversationUnreadCount = computed(() => {
  if (!messageConversation.value) {
    return 0
  }

  return isOwnerView.value
    ? messageConversation.value.ownerUnreadCount
    : messageConversation.value.caregiverUnreadCount
})
const canSendMessage = computed(() => Boolean(order.value))
const currentConversationRole = computed(() => (isOwnerView.value ? 'owner' : 'caregiver'))
const ownerActionSummary = computed(() => {
  if (!isOwnerView.value) {
    return '当前先看订单状态、沟通和履约记录。'
  }
  if (canPayOrder.value) {
    return '先完成支付，再等待照料者接单。'
  }
  if (order.value?.orderStatus === 'PENDING_ACCEPT') {
    return '已支付，等待照料者确认接单。'
  }
  if (canConfirmComplete.value) {
    return '先核对服务记录，再确认完成。'
  }
  if (canCreateReview.value) {
    return '订单已完成，现在可以直接写评价。'
  }
  if (activeComplaint.value) {
    return `当前投诉${getComplaintStatusLabel(activeComplaint.value.status)}，先看售后进度。`
  }
  if (order.value?.review) {
    return '评价已提交，仍可继续查看履约和售后。'
  }
  return '在这里处理确认完成、评价和投诉。'
})
const currentStageLabel = computed(() => {
  if (!order.value) {
    return '同步中'
  }
  if (canPayOrder.value) {
    return `待支付 ¥${formatAmount(outstandingAmount.value)}`
  }
  if (order.value.orderStatus === 'PENDING_ACCEPT') {
    return '等待照料者接单'
  }
  if (order.value.orderStatus === 'ACCEPTED') {
    return '已接单，等待服务开始'
  }
  if (order.value.orderStatus === 'SERVING') {
    return canConfirmComplete.value ? '服务中，待确认完成' : '服务进行中'
  }
  if (activeComplaint.value) {
    return `投诉${getComplaintStatusLabel(activeComplaint.value.status)}`
  }
  if (canCreateReview.value) {
    return '订单已完成，待评价'
  }
  if (order.value.review) {
    return '订单已完成，评价已提交'
  }
  return labels.orderStatus[order.value.orderStatus] || order.value.orderStatus
})
const currentStageTagType = computed(() => {
  if (!order.value) {
    return 'default'
  }
  if (canPayOrder.value) {
    return 'warning'
  }
  if (activeComplaint.value) {
    return 'danger'
  }
  const tone = getOrderTone(order.value.orderStatus)
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'success') return 'success'
  return 'primary'
})
const orderHeroTags = computed<OrderHeroTag[]>(() => {
  if (!order.value) {
    return []
  }

  const tags: OrderHeroTag[] = [
    {
      label: currentStageLabel.value,
      type: currentStageTagType.value as AppTagTone,
    },
    {
      label: labels.serviceType[order.value.serviceType] || order.value.serviceType,
      type: 'primary',
    },
  ]

  if (currentConversationUnreadCount.value > 0) {
    tags.push({
      label: `${currentConversationUnreadCount.value} 条未读`,
      type: 'warning',
    })
  }

  if (activeComplaint.value) {
    tags.push({
      label: '售后处理中',
      type: 'danger',
    })
  }
  else if (refundProgress.value && refundProgress.value.stage !== 'NONE') {
    tags.push({
      label: getRefundProgressStageLabel(refundProgress.value.stage),
      type: 'warning',
    })
  }
  else if (order.value.review) {
    tags.push({
      label: '已评价',
      type: 'success',
    })
  }

  return tags
})
const detailTabCards = computed<OrderDetailTabCard[]>(() => {
  if (!order.value) {
    return []
  }

  return [
    {
      label: '总览',
      value: 'overview',
      metric: currentStageLabel.value,
      hint: ownerActionSummary.value,
    },
    {
      label: '沟通',
      value: 'chat',
      metric: currentConversationUnreadCount.value > 0
        ? `${currentConversationUnreadCount.value} 未读`
        : `${messageConversation.value?.messages.length || 0} 条`,
      hint: currentConversationUnreadCount.value > 0 ? '先回消息' : '查看最近沟通',
    },
    {
      label: '履约',
      value: 'service',
      metric: order.value.serviceLogs.length > 0
        ? `${order.value.serviceLogs.length} 条`
        : `${order.value.timeline.length} 条`,
      hint: order.value.serviceLogs.length > 0 ? '看服务记录' : '看履约轨迹',
    },
    {
      label: '售后',
      value: 'aftersales',
      metric: activeComplaint.value
        ? getComplaintStatusLabel(activeComplaint.value.status)
        : refundProgress.value && refundProgress.value.stage !== 'NONE'
          ? getRefundProgressStageLabel(refundProgress.value.stage)
          : '无售后',
      hint: activeComplaint.value || (refundProgress.value && refundProgress.value.stage !== 'NONE') ? '看处理进度' : '当前稳定',
    },
  ]
})
const overviewQuickActionOptions = computed(() => {
  if (!order.value) {
    return []
  }

  const options: Array<{ label: string, value: OrderQuickAction, description: string }> = []

  if (canPayOrder.value) {
    options.push({
      label: '去支付',
      value: 'PAY',
      description: `先完成 ¥${formatAmount(outstandingAmount.value)} 支付`,
    })
  }

  options.push({
    label: '看沟通',
    value: 'CHAT',
    description: currentConversationUnreadCount.value > 0
      ? `${currentConversationUnreadCount.value} 条未读消息`
      : '查看最近沟通和附件',
  })

  options.push({
    label: '看履约',
    value: 'SERVICE',
    description: order.value.serviceLogs.length > 0
      ? `已记录 ${order.value.serviceLogs.length} 条服务日志`
      : '查看时间线和服务记录',
  })

  options.push({
    label: '看售后',
    value: 'AFTERSALES',
    description: activeComplaint.value
      ? `投诉${getComplaintStatusLabel(activeComplaint.value.status)}`
      : refundProgress.value && refundProgress.value.stage !== 'NONE'
        ? getRefundProgressStageLabel(refundProgress.value.stage)
        : '查看退款和投诉进度',
  })

  if (canConfirmComplete.value) {
    options.push({
      label: '确认完成',
      value: 'COMPLETE',
      description: '核对服务记录后确认本单收尾',
    })
  }

  if (canCreateReview.value || order.value.review) {
    options.push({
      label: order.value.review ? '看评价' : '写评价',
      value: 'REVIEW',
      description: order.value.review ? '查看已提交评价内容' : '完成订单后的体验反馈',
    })
  }

  if (canCreateComplaint.value || activeComplaint.value) {
    options.push({
      label: activeComplaint.value ? '看投诉' : '发投诉',
      value: 'COMPLAINT',
      description: activeComplaint.value ? '查看处理日志和结果' : '售后争议走平台处理',
    })
  }

  return options
})
const primaryOverviewAction = computed(() => overviewQuickActionOptions.value[0] ?? null)
const overviewSignalCards = computed<OrderOverviewSignalCard[]>(() => {
  if (!order.value) {
    return []
  }

  const conversationValue = order.value.conversation
    ? getConversationPreview(order.value.conversation)
    : '暂未开始订单沟通'
  const conversationHint = getConversationHint(order.value.conversation, currentConversationRole.value)

  const serviceValue = order.value.serviceLogs.length > 0
    ? `已记录 ${order.value.serviceLogs.length} 条服务日志`
    : order.value.timeline.length > 0
      ? `当前有 ${order.value.timeline.length} 条履约时间线`
      : '暂未开始履约记录'

  const aftersalesValue = activeComplaint.value
    ? `投诉${getComplaintStatusLabel(activeComplaint.value.status)}`
    : refundProgress.value && refundProgress.value.stage !== 'NONE'
      ? getRefundProgressStageLabel(refundProgress.value.stage)
      : '当前无售后'

  const aftersalesHint = activeComplaint.value
    ? `投诉对象：${getComplaintTargetRoleLabel(activeComplaint.value.targetRole)}`
    : refundProgress.value && refundProgress.value.stage !== 'NONE'
      ? getRefundProgressStageHint(refundProgress.value.stage)
      : '暂未发起退款或投诉'

  return [
    {
      key: 'stage',
      title: '当前阶段',
      value: currentStageLabel.value,
      hint: ownerActionSummary.value,
      tone: canPayOrder.value ? 'warning' : activeComplaint.value ? 'danger' : 'primary',
      action: null,
    },
    {
      key: 'chat',
      title: '最近沟通',
      value: conversationValue,
      hint: conversationHint,
      tone: currentConversationUnreadCount.value > 0 ? 'warning' : 'default',
      action: 'CHAT',
    },
    {
      key: 'service',
      title: '履约进度',
      value: serviceValue,
      hint: order.value.timeline.length > 0 ? `最近更新 ${formatDateTime(order.value.updatedAt)}` : '暂未产生服务轨迹',
      tone: order.value.orderStatus === 'SERVING' ? 'primary' : order.value.serviceLogs.length > 0 ? 'success' : 'default',
      action: 'SERVICE',
    },
    {
      key: 'aftersales',
      title: '售后状态',
      value: aftersalesValue,
      hint: aftersalesHint,
      tone: activeComplaint.value ? 'danger' : refundProgress.value && refundProgress.value.stage !== 'NONE' ? 'warning' : 'default',
      action: 'AFTERSALES',
    },
  ]
})
const conversationMessages = computed(() => messageConversation.value?.messages ?? [])
const latestConversationMessage = computed(() => {
  const messages = conversationMessages.value
  return messages.length > 0 ? messages[messages.length - 1] : null
})
const conversationAttachmentCount = computed(() => (
  conversationMessages.value.reduce((total, item) => total + item.mediaUrls.length, 0)
))
const chatSpotlightTitle = computed(() => {
  if (currentConversationUnreadCount.value > 0) {
    return `先处理 ${currentConversationUnreadCount.value} 条未读消息`
  }
  if (latestConversationMessage.value) {
    return '继续本单沟通'
  }
  return '发送第一条交接消息'
})
const chatSpotlightHint = computed(() => {
  if (latestConversationMessage.value) {
    return `最近一条来自${getConversationSenderLabel(latestConversationMessage.value)}，更新于 ${formatDateTime(latestConversationMessage.value.createdAt)}。`
  }
  return '交接说明、异常同步和附件都集中保留在这里。'
})
const chatSummaryCards = computed<OrderTabSummaryCard[]>(() => [
  {
    key: 'unread',
    label: '未读',
    value: `${currentConversationUnreadCount.value} 条`,
    hint: currentConversationUnreadCount.value > 0 ? '进入后优先处理' : '当前沟通已读',
    tone: currentConversationUnreadCount.value > 0 ? 'warning' : 'default',
  },
  {
    key: 'message-count',
    label: '消息',
    value: `${conversationMessages.value.length} 条`,
    hint: latestConversationMessage.value ? '最近一条已同步到订单' : '暂未开始沟通',
    tone: conversationMessages.value.length > 0 ? 'primary' : 'default',
  },
  {
    key: 'attachment-count',
    label: '附件',
    value: `${conversationAttachmentCount.value} 个`,
    hint: conversationAttachmentCount.value > 0 ? '照片和文件已留档' : '当前没有附件',
    tone: conversationAttachmentCount.value > 0 ? 'success' : 'default',
  },
  {
    key: 'last-message',
    label: '最近更新',
    value: order.value?.conversation?.lastMessageAt ? dayjs(order.value.conversation.lastMessageAt).format('MM-DD HH:mm') : '未开始',
    hint: truncateText(getMessageDigest(latestConversationMessage.value), 22),
    tone: latestConversationMessage.value ? 'primary' : 'default',
  },
])
const serviceTimelineFeed = computed(() => {
  if (!order.value) {
    return []
  }
  return [...order.value.timeline].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ))
})
const serviceLogFeed = computed(() => {
  if (!order.value) {
    return []
  }
  return [...order.value.serviceLogs].sort((left, right) => (
    new Date(right.happenedAt).getTime() - new Date(left.happenedAt).getTime()
  ))
})
const latestServiceTimelineEvent = computed(() => serviceTimelineFeed.value[0] ?? null)
const latestServiceLog = computed(() => serviceLogFeed.value[0] ?? null)
const serviceMediaCount = computed(() => (
  serviceLogFeed.value.reduce((total, item) => total + item.mediaUrls.length, 0)
))
const serviceSpotlightTitle = computed(() => {
  if (canConfirmComplete.value) {
    return '先核对记录，再确认完成'
  }
  if (latestServiceLog.value) {
    return '最新服务回传已到达'
  }
  if (latestServiceTimelineEvent.value) {
    return '先看最新履约节点'
  }
  return '等待第一条履约记录'
})
const serviceSpotlightHint = computed(() => {
  if (canConfirmComplete.value) {
    return '服务已进入收尾，确认完成后就可以继续评价。'
  }
  if (latestServiceLog.value?.textNote) {
    return truncateText(latestServiceLog.value.textNote, 32)
  }
  if (latestServiceLog.value) {
    return `${labels.serviceLogType[latestServiceLog.value.logType] || latestServiceLog.value.logType} 已在 ${formatDateTime(latestServiceLog.value.happenedAt)} 回传。`
  }
  if (latestServiceTimelineEvent.value) {
    return `${labels.timelineEvent[latestServiceTimelineEvent.value.eventType] || latestServiceTimelineEvent.value.eventType} 已记录。`
  }
  return '履约节点和服务照片会持续更新在这里。'
})
const serviceSummaryCards = computed<OrderTabSummaryCard[]>(() => [
  {
    key: 'stage',
    label: '当前阶段',
    value: currentStageLabel.value,
    hint: ownerActionSummary.value,
    tone: canPayOrder.value ? 'warning' : activeComplaint.value ? 'danger' : 'primary',
  },
  {
    key: 'timeline',
    label: '履约节点',
    value: `${serviceTimelineFeed.value.length} 条`,
    hint: latestServiceTimelineEvent.value
      ? labels.timelineEvent[latestServiceTimelineEvent.value.eventType] || latestServiceTimelineEvent.value.eventType
      : '还没有节点',
    tone: serviceTimelineFeed.value.length > 0 ? 'primary' : 'default',
  },
  {
    key: 'service-logs',
    label: '服务回传',
    value: `${serviceLogFeed.value.length} 条`,
    hint: latestServiceLog.value
      ? labels.serviceLogType[latestServiceLog.value.logType] || latestServiceLog.value.logType
      : '还没有回传',
    tone: serviceLogFeed.value.length > 0 ? 'success' : 'default',
  },
  {
    key: 'service-media',
    label: '媒体',
    value: `${serviceMediaCount.value} 个`,
    hint: serviceMediaCount.value > 0 ? '可直接回看照片和文件' : '暂未上传媒体',
    tone: serviceMediaCount.value > 0 ? 'success' : 'default',
  },
])
const complaintFeed = computed(() => (
  [...complaints.value].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ))
))
const refundFeed = computed(() => {
  if (!order.value) {
    return []
  }
  return [...order.value.refunds].sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ))
})
const latestComplaintRecord = computed(() => complaintFeed.value[0] ?? null)
const latestRefundRecord = computed(() => refundFeed.value[0] ?? null)
const aftersalesTimelineFeed = computed(() => (
  [...aftersalesTimeline.value].sort((left, right) => (
    new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
  ))
))
const aftersalesSpotlightTitle = computed(() => {
  if (activeComplaint.value) {
    return '先看投诉最新进度'
  }
  if (refundProgress.value && refundProgress.value.stage !== 'NONE') {
    return '退款正在处理'
  }
  if (canCreateComplaint.value) {
    return '需要售后时可立即发起'
  }
  if (aftersalesTimelineFeed.value.length > 0) {
    return '售后记录已归档'
  }
  return '当前没有售后事项'
})
const aftersalesSpotlightHint = computed(() => {
  if (activeComplaint.value) {
    return `平台正在处理 ${getComplaintTypeLabel(activeComplaint.value.complaintType)}，当前状态为 ${getComplaintStatusLabel(activeComplaint.value.status)}。`
  }
  if (refundProgress.value && refundProgress.value.stage !== 'NONE') {
    return getRefundProgressStageHint(refundProgress.value.stage)
  }
  if (canCreateComplaint.value) {
    return '服务质量、费用争议和安全问题都从这里统一处理。'
  }
  if (aftersalesTimelineFeed.value.length > 0) {
    return '可以回看退款和投诉处理记录。'
  }
  return '本单当前没有退款申请和投诉。'
})
const aftersalesSummaryCards = computed<OrderTabSummaryCard[]>(() => [
  {
    key: 'after-status',
    label: '当前状态',
    value: activeComplaint.value
      ? `投诉${getComplaintStatusLabel(activeComplaint.value.status)}`
      : refundProgress.value && refundProgress.value.stage !== 'NONE'
        ? getRefundProgressStageLabel(refundProgress.value.stage)
        : '无售后',
    hint: aftersalesSpotlightHint.value,
    tone: activeComplaint.value ? 'danger' : refundProgress.value && refundProgress.value.stage !== 'NONE' ? 'warning' : 'default',
  },
  {
    key: 'refund-count',
    label: '退款单',
    value: `${refundFeed.value.length} 笔`,
    hint: latestRefundRecord.value
      ? `${labels.refundStatus[latestRefundRecord.value.refundStatus] || latestRefundRecord.value.refundStatus}`
      : '暂未申请',
    tone: refundFeed.value.length > 0 ? 'warning' : 'default',
  },
  {
    key: 'complaint-count',
    label: '投诉单',
    value: `${complaintFeed.value.length} 笔`,
    hint: latestComplaintRecord.value
      ? getComplaintTypeLabel(latestComplaintRecord.value.complaintType)
      : '暂未投诉',
    tone: complaintFeed.value.length > 0 ? 'danger' : 'default',
  },
  {
    key: 'refundable',
    label: '可退余额',
    value: `¥${formatAmount(refundProgress.value?.refundableBalance ?? 0)}`,
    hint: (() => {
      const latestAt = pickFirstDate(
        refundProgress.value?.latestReviewedAt,
        refundProgress.value?.latestAppliedAt,
        order.value?.updatedAt,
        order.value?.createdAt,
      )
      return latestAt ? `最近更新 ${formatDateTime(latestAt)}` : '暂无退款处理'
    })(),
    tone: Number(refundProgress.value?.refundableBalance ?? 0) > 0 ? 'primary' : 'default',
  },
])
const orderFocusSummary = computed(() => {
  if (!order.value) {
    return '正在准备订单详情。'
  }
  if (detailTab.value === 'chat') {
    return currentConversationUnreadCount.value > 0
      ? `当前有 ${currentConversationUnreadCount.value} 条未读消息。`
      : '当前沟通已读。'
  }
  if (detailTab.value === 'service') {
    return order.value.serviceLogs.length > 0
      ? `已有 ${order.value.serviceLogs.length} 条服务记录。`
      : '暂时还没有服务记录。'
  }
  if (detailTab.value === 'aftersales') {
    return aftersalesTimeline.value.length > 0
      ? `已有 ${aftersalesTimeline.value.length} 条售后进度。`
      : '当前没有售后记录。'
  }
  return ownerActionSummary.value
})

const formatAmount = (value: unknown) => {
  if (!value) return '0.00'
  return Number(value).toFixed(2)
}

const formatDate = (dateStr: string) => {
  return dayjs(dateStr).format('YYYY-MM-DD')
}

const formatDateTime = (dateStr: string) => {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
}

const truncateText = (value: string, maxLength: number) => (
  value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
)

const pickFirstDate = (...values: Array<string | null | undefined>) => (
  values.find((item): item is string => Boolean(item && item.trim())) ?? null
)

const getMessageDigest = (message: OrderMessageRecord | null) => {
  if (!message) {
    return '暂无消息'
  }
  const content = message.content?.trim()
  if (content) {
    return content
  }
  if (message.mediaUrls.length > 0) {
    return `附带 ${message.mediaUrls.length} 个附件`
  }
  return '已发送消息'
}

const getRefundProgressStageLabel = (stage: OrderRefundProgressRecord['stage']) => {
  return labels.refundProgressStage[stage] || stage
}

const getRefundProgressStageHint = (stage: OrderRefundProgressRecord['stage']) => {
  const hints: Record<OrderRefundProgressRecord['stage'], string> = {
    NONE: '当前暂无退款申请，后续售后进度会在这里同步展示。',
    PENDING_REVIEW: '退款申请已提交，等待平台审核处理。',
    APPROVED_WAITING: '退款申请已审核通过，等待退款渠道回调。',
    PARTIAL_SUCCESS: '订单已完成部分退款，可继续查看剩余可退余额。',
    FULL_SUCCESS: '退款已完成，订单售后金额已经结清。',
    REJECTED: '最近一笔退款申请已被驳回，可根据原因补充说明后再次联系平台。',
    FAILED: '退款处理失败，建议尽快联系平台核查渠道回执。',
  }
  return hints[stage] || stage
}

const getRefundProgressStageClass = (stage: OrderRefundProgressRecord['stage']) => {
  const classes: Record<OrderRefundProgressRecord['stage'], string> = {
    NONE: 'closed',
    PENDING_REVIEW: 'warning',
    APPROVED_WAITING: 'primary',
    PARTIAL_SUCCESS: 'warning',
    FULL_SUCCESS: 'success',
    REJECTED: 'error',
    FAILED: 'error',
  }
  return classes[stage] || 'closed'
}

const getStatusTagType = (statusClass: string): AppTagTone => {
  if (statusClass === 'primary') return 'primary'
  if (statusClass === 'success') return 'success'
  if (statusClass === 'warning' || statusClass === 'pending') return 'warning'
  if (statusClass === 'error') return 'danger'
  return 'default'
}

function handleQuickAction(action: OrderQuickAction) {
  if (action === 'PAY') {
    openCheckoutPage()
    return
  }
  if (action === 'COMPLETE') {
    void handleConfirmComplete()
    return
  }
  if (action === 'CHAT') {
    detailTab.value = 'chat'
    void markConversationAsRead()
    return
  }
  if (action === 'SERVICE') {
    detailTab.value = 'service'
    return
  }
  if (action === 'AFTERSALES') {
    detailTab.value = 'aftersales'
    return
  }
  if (action === 'REVIEW') {
    openReviewPage()
    return
  }
  if (action === 'COMPLAINT') {
    openComplaintPage()
  }
}

function handleDetailTabSelect(tab: OrderDetailTab) {
  if (detailTab.value === tab) {
    return
  }

  detailTab.value = tab
  if (tab === 'chat') {
    void markConversationAsRead()
  }
}

const getComplaintTargetRoleLabel = (role: ComplaintTargetRole) => {
  return labels.complaintTargetRole[role] || role
}

const getComplaintTypeLabel = (type: ComplaintType) => {
  return labels.complaintType[type] || type
}

const getComplaintStatusLabel = (status: ComplaintStatus) => {
  return labels.complaintStatus[status] || status
}

const getComplaintStatusClass = (status: ComplaintStatus) => {
  const classes: Record<ComplaintStatus, string> = {
    OPEN: 'warning',
    PROCESSING: 'primary',
    RESOLVED: 'success',
    REJECTED: 'closed',
  }
  return classes[status] || 'closed'
}

const getComplaintActionLabel = (actionType: ComplaintActionType) => {
  return labels.complaintAction[actionType] || actionType
}

const getRefundAftersalesClass = (status: string): AftersalesTimelineDotClass => {
  const classes: Record<string, AftersalesTimelineDotClass> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    REJECTED: 'error',
    SUCCESS: 'success',
    FAILED: 'error',
  }
  return classes[status] || 'closed'
}

const getComplaintAftersalesClass = (status: ComplaintStatus): AftersalesTimelineDotClass => {
  const classes: Record<ComplaintStatus, AftersalesTimelineDotClass> = {
    OPEN: 'warning',
    PROCESSING: 'primary',
    RESOLVED: 'success',
    REJECTED: 'closed',
  }
  return classes[status] || 'closed'
}

const buildRefundAftersalesItems = (refund: OrderDetailRecord['refunds'][number]) => {
  const items: AftersalesTimelineItem[] = [
    {
      id: `${refund.id}-created`,
      occurredAt: refund.createdAt,
      title: '退款申请已提交',
      statusLabel: '退款申请',
      statusClass: 'warning',
      referenceLabel: '退款单号',
      referenceValue: refund.refundNo,
      note: `申请退款 ¥${formatAmount(refund.refundAmount)}`,
      details: [
        `退款类型：${labels.refundType[refund.refundType] || refund.refundType}`,
        `当前状态：${labels.refundStatus[refund.refundStatus] || refund.refundStatus}`,
        `退款原因：${refund.refundReason}`,
      ],
    },
  ]

  if (refund.reviewedAt) {
    const reviewTitle = refund.refundStatus === 'REJECTED'
      ? '退款申请已驳回'
      : refund.refundStatus === 'APPROVED'
        ? '退款审核已通过'
        : refund.refundStatus === 'SUCCESS'
          ? '退款审核已完成'
          : '退款审核状态已更新'

    items.push({
      id: `${refund.id}-reviewed`,
      occurredAt: refund.reviewedAt,
      title: reviewTitle,
      statusLabel: labels.refundStatus[refund.refundStatus] || refund.refundStatus,
      statusClass: getRefundAftersalesClass(refund.refundStatus),
      referenceLabel: '退款单号',
      referenceValue: refund.refundNo,
      note: refund.refundStatus === 'REJECTED'
        ? '平台已完成审核，本次退款申请未通过。'
        : '平台已完成退款审核，后续结果会继续同步。',
      details: [
        `退款金额：¥${formatAmount(refund.refundAmount)}`,
        `审核人：${refund.reviewedBy || '平台管理员'}`,
        `退款类型：${labels.refundType[refund.refundType] || refund.refundType}`,
      ],
    })
  }

  if (
    ['SUCCESS', 'FAILED'].includes(refund.refundStatus)
    && refund.updatedAt !== refund.reviewedAt
    && refund.updatedAt !== refund.createdAt
  ) {
    items.push({
      id: `${refund.id}-settled`,
      occurredAt: refund.updatedAt,
      title: refund.refundStatus === 'SUCCESS' ? '退款结果已到账' : '退款处理失败',
      statusLabel: labels.refundStatus[refund.refundStatus] || refund.refundStatus,
      statusClass: getRefundAftersalesClass(refund.refundStatus),
      referenceLabel: '退款单号',
      referenceValue: refund.refundNo,
      note: refund.refundStatus === 'SUCCESS'
        ? `退款金额 ¥${formatAmount(refund.refundAmount)} 已完成处理。`
        : '退款渠道返回失败结果，建议尽快联系平台核查。',
      details: [
        `退款类型：${labels.refundType[refund.refundType] || refund.refundType}`,
        `退款原因：${refund.refundReason}`,
      ],
    })
  }

  return items
}

const buildComplaintAftersalesItems = (complaint: ComplaintRecord) => {
  const items: AftersalesTimelineItem[] = []

  if (!complaint.processLogs.some((log) => log.actionType === 'OPEN')) {
    items.push({
      id: `${complaint.id}-created`,
      occurredAt: complaint.createdAt,
      title: '投诉已提交',
      statusLabel: getComplaintStatusLabel(complaint.status),
      statusClass: getComplaintAftersalesClass(complaint.status),
      referenceLabel: '投诉类型',
      referenceValue: getComplaintTypeLabel(complaint.complaintType),
      note: complaint.description,
      details: [
        `投诉对象：${getComplaintTargetRoleLabel(complaint.targetRole)}`,
        `当前状态：${getComplaintStatusLabel(complaint.status)}`,
      ],
    })
  }

  complaint.processLogs.forEach((log) => {
    items.push({
      id: log.id,
      occurredAt: log.createdAt,
      title: getComplaintActionLabel(log.actionType),
      statusLabel: getComplaintStatusLabel(complaint.status),
      statusClass: getComplaintAftersalesClass(complaint.status),
      referenceLabel: '投诉类型',
      referenceValue: getComplaintTypeLabel(complaint.complaintType),
      note: log.note ?? (log.actionType === 'OPEN' ? complaint.description : null),
      details: [
        `投诉对象：${getComplaintTargetRoleLabel(complaint.targetRole)}`,
        `处理人：${log.operatorNickname || complaint.assignedAdminNickname || '平台处理中'}`,
        `当前状态：${getComplaintStatusLabel(complaint.status)}`,
        complaint.resultSummary && log.actionType === 'CLOSE' ? `处理结论：${complaint.resultSummary}` : null,
      ].filter((detail): detail is string => Boolean(detail)),
    })
  })

  return items
}

const aftersalesTimeline = computed<AftersalesTimelineItem[]>(() => {
  const refundItems = order.value
    ? order.value.refunds.flatMap((refund) => buildRefundAftersalesItems(refund))
    : []
  const complaintItems = complaints.value.flatMap((complaint) => buildComplaintAftersalesItems(complaint))

  return [...refundItems, ...complaintItems].sort((left, right) => (
    new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
  ))
})

const getRecordString = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value : null
}

const getRecordNumber = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const formatGeoValue = (value: unknown) => {
  if (!value || typeof value !== 'object') return null
  const lat = (value as { lat?: unknown }).lat
  const lng = (value as { lng?: unknown }).lng
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`
  }
  return null
}

const getTimelineClass = (eventType: OrderTimelineEventType) => {
  const classes: Record<OrderTimelineEventType, string> = {
    CREATED: 'pending',
    ACCEPTED: 'success',
    CHECKED_IN: 'warning',
    SERVICE_LOGGED: 'primary',
    CHECKED_OUT: 'success',
    COMPLETED: 'success',
    DISPUTED: 'error',
    CANCELLED: 'error',
    REFUND_APPLIED: 'warning',
    REFUND_DONE: 'closed',
  }
  return classes[eventType] || 'pending'
}

const getServiceLogClass = (logType: ServiceLogType) => {
  const classes: Record<ServiceLogType, string> = {
    CHECK_IN: 'warning',
    FEED: 'primary',
    WALK: 'success',
    PLAY: 'primary',
    HEALTH: 'error',
    CHECK_OUT: 'closed',
    NOTE: 'pending',
  }
  return classes[logType] || 'pending'
}

const formatOrderStatusLabel = (status: string) => {
  return labels.orderStatus[status] || status
}

const getTimelineDetails = (event: OrderTimelineRecord) => {
  const details: string[] = []
  const previousStatus = getRecordString(event.eventPayload, 'previousStatus')
  const nextStatus = getRecordString(event.eventPayload, 'nextStatus')
  const note = getRecordString(event.eventPayload, 'note')
  const happenedAt = getRecordString(event.eventPayload, 'happenedAt')
  const mediaCount = getRecordNumber(event.eventPayload, 'mediaCount')
  const geoText = formatGeoValue(event.eventPayload?.geo)

  if (previousStatus && nextStatus) {
    details.push(`状态流转：${formatOrderStatusLabel(previousStatus)} -> ${formatOrderStatusLabel(nextStatus)}`)
  }
  if (note) {
    details.push(`备注：${note}`)
  }
  if (happenedAt) {
    details.push(`业务时间：${formatDateTime(happenedAt)}`)
  }
  if (mediaCount !== null) {
    details.push(`附带媒体：${mediaCount} 个`)
  }
  if (geoText) {
    details.push('已记录服务地点')
  }
  return details
}

const getServiceLogDetails = (log: ServiceLogRecord) => {
  const details: string[] = []
  const geoText = formatGeoValue(log.geo)
  if (geoText) {
    details.push('已记录服务地点')
  }
  if (log.createdAt !== log.happenedAt) {
    details.push(`上传时间：${formatDateTime(log.createdAt)}`)
  }
  return details
}

const isPreviewableImage = (url: string) => /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(
  url.split(/[?#]/)[0] ?? '',
)

const getMediaLinkLabel = (url: string, index: number) => {
  const pathSegment = url.split(/[?#]/)[0]?.split('/').pop()
  if (!pathSegment) {
    return `附件 ${index + 1}`
  }

  try {
    return decodeURIComponent(pathSegment)
  }
  catch {
    return pathSegment
  }
}

const buildConversationSummary = (
  conversation: Pick<
    OrderConversationDetailRecord,
    'id' | 'orderId' | 'ownerUnreadCount' | 'caregiverUnreadCount' | 'lastMessageAt' | 'lastMessagePreview' | 'createdAt' | 'updatedAt'
  >,
) => ({
  id: conversation.id,
  orderId: conversation.orderId,
  ownerUnreadCount: conversation.ownerUnreadCount,
  caregiverUnreadCount: conversation.caregiverUnreadCount,
  lastMessageAt: conversation.lastMessageAt,
  lastMessagePreview: conversation.lastMessagePreview,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
})

const applyConversationSummary = (summary: OrderDetailRecord['conversation']) => {
  if (order.value) {
    order.value.conversation = summary ? { ...summary } : null
  }

  if (messageConversation.value && summary) {
    messageConversation.value.ownerUnreadCount = summary.ownerUnreadCount
    messageConversation.value.caregiverUnreadCount = summary.caregiverUnreadCount
    messageConversation.value.lastMessageAt = summary.lastMessageAt
    messageConversation.value.lastMessagePreview = summary.lastMessagePreview
    messageConversation.value.updatedAt = summary.updatedAt
  }
}

const applyConversationDetail = (conversation: OrderConversationDetailRecord | null) => {
  messageConversation.value = conversation
    ? {
        ...conversation,
        messages: [...conversation.messages],
      }
    : null
  applyConversationSummary(conversation ? buildConversationSummary(conversation) : null)
}

const getConversationSenderLabel = (message: OrderMessageRecord) => (
  message.senderRole === 'OWNER' ? '宠物主人' : '照料者'
)

const isOwnMessage = (message: OrderMessageRecord) => Boolean(userInfo.value.id && message.senderUserId === userInfo.value.id)

const resetMessageComposer = () => {
  messageForm.content = ''
  messageForm.attachments = []
}

const uploadMessageAttachments = async () => {
  if (!order.value) {
    return
  }

  try {
    const uploaded = await selectAndUploadMessageAttachments({
      tag1: 'petpal-order-message',
      tag2: order.value.id,
    })
    messageForm.attachments = [
      ...messageForm.attachments,
      ...uploaded,
    ].slice(0, 8)
    uni.showToast({
      title: `已上传 ${uploaded.length} 个附件`,
      icon: 'none',
    })
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '上传附件失败'),
      icon: 'none',
    })
  }
}

const removeMessageAttachment = (fileId: string) => {
  messageForm.attachments = messageForm.attachments.filter(item => item.fileId !== fileId)
}

const markConversationAsRead = async () => {
  if (!order.value || !messageConversation.value || currentConversationUnreadCount.value === 0) {
    return
  }

  try {
    const summary = await markOrderMessagesRead(order.value.id)
    applyConversationSummary(summary)
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '同步已读失败'),
      icon: 'none',
    })
  }
}

const submitMessage = async () => {
  if (!order.value) {
    return
  }

  const content = messageForm.content.trim()
  if (!content && messageForm.attachments.length === 0) {
    uni.showToast({
      title: '请填写消息或上传附件',
      icon: 'none',
    })
    return
  }

  try {
    messageSubmitting.value = true
    const payload: CreateOrderMessagePayload = {
      content: content || undefined,
      mediaUrls: messageForm.attachments.map(item => item.url),
    }
    const conversation = await sendOrderMessage(order.value.id, payload)
    applyConversationDetail(conversation)
    resetMessageComposer()
    uni.showToast({
      title: '消息已发送',
      icon: 'none',
    })
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '发送消息失败'),
      icon: 'none',
    })
  }
  finally {
    messageSubmitting.value = false
  }
}

const previewMediaImage = (mediaUrls: string[], currentUrl: string) => {
  const imageUrls = mediaUrls.filter((item) => isPreviewableImage(item))
  if (imageUrls.length === 0) {
    return
  }

  uni.previewImage({
    current: currentUrl,
    urls: imageUrls,
  })
}

const copyServiceLogMediaUrl = (url: string) => {
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({
        title: '媒体链接已复制',
        icon: 'none',
      })
    },
    fail: () => {
      uni.showToast({
        title: '当前环境暂不支持打开该附件',
        icon: 'none',
      })
    },
  })
}

const openMediaUrl = (mediaUrls: string[], url: string) => {
  if (isPreviewableImage(url)) {
    previewMediaImage(mediaUrls, url)
    return
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  copyServiceLogMediaUrl(url)
}

const openServiceLogMedia = (log: ServiceLogRecord, url: string) => {
  openMediaUrl(log.mediaUrls, url)
}

const openComplaintEvidence = (evidenceUrls: string[], url: string) => {
  openMediaUrl(evidenceUrls, url)
}

function openReviewPage() {
  if (!order.value) {
    return
  }
  const targetPage = order.value.review ? PETPAL_REVIEW_RESULT_PAGE : PETPAL_ORDER_REVIEW_PAGE
  uni.navigateTo({ url: `${targetPage}?id=${order.value.id}` })
}

function openCheckoutPage() {
  if (!order.value) {
    return
  }
  uni.navigateTo({ url: `${PETPAL_CHECKOUT_PAGE}?orderId=${order.value.id}` })
}

function openComplaintPage() {
  if (!order.value) {
    return
  }
  if (activeComplaint.value || complaints.value.length > 0) {
    uni.navigateTo({ url: `${PETPAL_COMPLAINT_RESULT_PAGE}?orderId=${order.value.id}` })
    return
  }
  uni.navigateTo({ url: `${PETPAL_ORDER_COMPLAINT_PAGE}?id=${order.value.id}` })
}

function openRefundResultPage() {
  if (!order.value) {
    return
  }
  uni.navigateTo({ url: `${PETPAL_REFUND_RESULT_PAGE}?orderId=${order.value.id}` })
}

async function handleConfirmComplete() {
  if (!order.value || confirmingCompletion.value) {
    return
  }

  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '确认完成',
      content: '确认后订单会进入已完成状态，后续可以继续提交评价。',
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    })
  })

  if (!confirmed) {
    return
  }

  confirmingCompletion.value = true
  try {
    await confirmOrderComplete(order.value.id)
    await loadOrderDetail()
    uni.showToast({ title: '订单已确认完成', icon: 'none' })
  }
  catch (err) {
    uni.showToast({ title: getErrorMessage(err, '确认完成失败'), icon: 'none' })
  }
  finally {
    confirmingCompletion.value = false
  }
}

async function loadOrderDetail() {
  if (!orderId.value) return

  loading.value = true
  error.value = ''
  try {
    const [detailResult, refundProgressResult, complaintsResult, messagesResult] = await Promise.allSettled([
      getOrderDetail(orderId.value),
      getOrderRefundProgress(orderId.value),
      getOrderComplaints(orderId.value),
      getOrderMessages(orderId.value),
    ])

    if (detailResult.status !== 'fulfilled') {
      throw detailResult.reason
    }

    const detail = detailResult.value
    order.value = detail
    applyConversationSummary(detail.conversation)

    refundProgress.value = refundProgressResult.status === 'fulfilled'
      ? refundProgressResult.value
      : null

    complaints.value = complaintsResult.status === 'fulfilled'
      ? complaintsResult.value
      : []
    applyConversationDetail(messagesResult.status === 'fulfilled' ? messagesResult.value : null)
    await markConversationAsRead()
  } catch (err) {
    refundProgress.value = null
    complaints.value = []
    applyConversationDetail(null)
    error.value = getErrorMessage(err, '加载订单详情失败')
  } finally {
    loading.value = false
  }
}

async function onPullDownRefresh() {
  await loadOrderDetail()
  uni.stopPullDownRefresh()
}

// Watch for orderId changes and load detail
watch(orderId, (newId) => {
  if (newId) {
    loadOrderDetail()
  }
})

function isOrderDetailTab(value: string | undefined): value is OrderDetailTab {
  return value === 'overview' || value === 'chat' || value === 'service' || value === 'aftersales'
}

// Uni page lifecycle - receive parameters from navigation
function handleGoBack() {
  uni.navigateBack({ delta: 1 })
}

// Uni page lifecycle - receive parameters from navigation
onLoad((options: Record<string, string | undefined>) => {
  if (options?.id) {
    orderId.value = options.id
  }
  if (isOrderDetailTab(options?.tab)) {
    detailTab.value = options.tab
  }
})
</script>

<template>
  <AppPageShell title="订单详情">
    <template v-if="loading">
      <AppSection title="同步状态">
        <AppStatus mode="loading" text="正在加载订单详情" />
      </AppSection>
    </template>

    <template v-else-if="order">
      <view class="petpal-order-container">
        <AppSection title="订单概览">
          <view class="petpal-order-overview-banner">
            <view class="petpal-order-overview-banner__tags">
              <AppTag
                v-for="tag in orderHeroTags"
                :key="tag.label"
                :type="tag.type"
              >
                {{ tag.label }}
              </AppTag>
            </view>
            <view class="petpal-order-overview-banner__headline">
              <text class="petpal-order-overview-banner__title">{{ order.orderNo }}</text>
              <text class="petpal-order-overview-banner__meta">
                {{ labels.orderStatus[order.orderStatus] || order.orderStatus }} · {{ labels.serviceType[order.serviceType] || order.serviceType }}
              </text>
            </view>
            <view class="petpal-order-overview-banner__stats">
              <view class="petpal-order-overview-banner__stat">
                <text class="petpal-order-overview-banner__stat-label">预约</text>
                <text class="petpal-order-overview-banner__stat-value">{{ formatDate(order.appointmentStart) }}</text>
              </view>
              <view class="petpal-order-overview-banner__stat">
                <text class="petpal-order-overview-banner__stat-label">实付</text>
                <text class="petpal-order-overview-banner__stat-value">¥{{ formatAmount(order.amountPaid) }}</text>
              </view>
              <view class="petpal-order-overview-banner__stat">
                <text class="petpal-order-overview-banner__stat-label">已退</text>
                <text class="petpal-order-overview-banner__stat-value">¥{{ formatAmount(order.amountRefunded) }}</text>
              </view>
            </view>
            <text class="petpal-order-overview-banner__summary">{{ orderFocusSummary }}</text>
          </view>
          <scroll-view class="petpal-detail-tab-scroll" :scroll-x="true" :show-scrollbar="false">
            <view class="petpal-detail-tab-track">
              <view
                v-for="item in detailTabCards"
                :key="item.value"
                class="petpal-detail-tab-card"
                :class="detailTab === item.value ? 'petpal-detail-tab-card--active' : ''"
                @click="handleDetailTabSelect(item.value)"
              >
                <text class="petpal-detail-tab-card__label">{{ item.label }}</text>
                <text class="petpal-detail-tab-card__metric">{{ item.metric }}</text>
                <text class="petpal-detail-tab-card__hint">{{ item.hint }}</text>
              </view>
            </view>
          </scroll-view>
        </AppSection>

        <AppSection v-if="detailTab === 'overview'" title="下一步">
          <view class="petpal-owner-actions">
            <view v-if="primaryOverviewAction" class="petpal-overview-focus">
              <view class="petpal-overview-focus__copy">
                <text class="petpal-overview-focus__eyebrow">现在先做这个</text>
                <text class="petpal-overview-focus__title">{{ primaryOverviewAction.label }}</text>
                <text class="petpal-overview-focus__hint">{{ primaryOverviewAction.description }}</text>
              </view>
              <view class="petpal-overview-focus__actions">
                <AppButton size="medium" @click="handleQuickAction(primaryOverviewAction.value)">
                  {{ primaryOverviewAction.label }}
                </AppButton>
              </view>
            </view>

            <view v-if="overviewQuickActionOptions.length" class="petpal-quick-grid">
              <view
                v-for="item in overviewQuickActionOptions"
                :key="item.value"
                class="petpal-quick-card"
                @click="handleQuickAction(item.value)"
              >
                <text class="petpal-quick-card__title">{{ item.label }}</text>
                <text class="petpal-quick-card__hint">{{ item.description }}</text>
              </view>
            </view>

            <view class="petpal-signal-grid">
              <view
                v-for="signal in overviewSignalCards"
                :key="signal.key"
                class="petpal-signal-card"
                :class="[
                  `petpal-signal-card--${signal.tone}`,
                  signal.action ? 'petpal-signal-card--clickable' : '',
                ]"
                @click="signal.action && handleQuickAction(signal.action)"
              >
                <text class="petpal-signal-card__title">{{ signal.title }}</text>
                <text class="petpal-signal-card__value">{{ signal.value }}</text>
                <text class="petpal-signal-card__hint">{{ signal.hint }}</text>
              </view>
            </view>

            <view v-if="order.review" class="petpal-action-panel">
              <view class="petpal-action-panel__header">
                <text class="petpal-action-panel__title">已提交评价</text>
                <text class="petpal-action-panel__meta">{{ formatDateTime(order.review.createdAt) }}</text>
              </view>
              <view class="petpal-detail-line">
                <text>评分：{{ order.review.rating }} / 5</text>
              </view>
              <view v-if="order.review.tags.length > 0" class="petpal-detail-line">
                <text>标签：{{ order.review.tags.join('、') }}</text>
              </view>
              <view v-if="order.review.content" class="petpal-note-card">
                <text>{{ order.review.content }}</text>
              </view>
              <view class="petpal-detail-line">
                <text>{{ order.review.isAnonymous ? '当前为匿名评价' : '当前为实名评价' }}</text>
              </view>
              <view class="petpal-action-grid">
                <AppButton size="medium" type="info" @click="openReviewPage">
                  {{ order.review ? '查看评价结果' : '进入评价页' }}
                </AppButton>
              </view>
            </view>

            <view v-if="activeComplaint" class="petpal-action-panel">
              <view class="petpal-action-panel__header">
                <text class="petpal-action-panel__title">进行中的投诉</text>
                <text class="petpal-action-panel__meta">{{ getComplaintStatusLabel(activeComplaint.status) }}</text>
              </view>
              <view class="petpal-note-card">
                <text>{{ activeComplaint.description }}</text>
              </view>
              <view class="petpal-detail-line">
                <text>投诉对象：{{ getComplaintTargetRoleLabel(activeComplaint.targetRole) }}</text>
              </view>
              <view class="petpal-detail-line">
                <text>投诉类型：{{ getComplaintTypeLabel(activeComplaint.complaintType) }}</text>
              </view>
              <view class="petpal-action-grid">
                <AppButton size="medium" type="danger" @click="openComplaintPage">查看投诉进度</AppButton>
              </view>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="detailTab === 'overview'" title="订单信息">
          <view class="petpal-info-grid">
            <view class="petpal-info-item">
              <text class="petpal-info-label">订单号</text>
              <text class="petpal-info-value">{{ order.orderNo }}</text>
            </view>
            <view class="petpal-info-item">
              <text class="petpal-info-label">状态</text>
              <text class="petpal-info-value">{{ labels.orderStatus[order.orderStatus] || order.orderStatus }}</text>
            </view>
            <view class="petpal-info-item">
              <text class="petpal-info-label">服务类型</text>
              <text class="petpal-info-value">{{ labels.serviceType[order.serviceType] || order.serviceType }}</text>
            </view>
            <view class="petpal-info-item">
              <text class="petpal-info-label">服务时间</text>
              <text class="petpal-info-value">{{ formatDate(order.appointmentStart) }} - {{ formatDate(order.appointmentEnd) }}</text>
            </view>
            <view class="petpal-info-item">
              <text class="petpal-info-label">创建时间</text>
              <text class="petpal-info-value">{{ formatDateTime(order.createdAt) }}</text>
            </view>
          </view>
        </AppSection>

        <!-- 金额信息 -->
        <AppSection v-if="detailTab === 'overview'" title="金额统计">
            <view class="petpal-amounts-grid">
              <view class="petpal-amount-item">
                <text class="petpal-amount-label">订单总额</text>
                <text class="petpal-amount-value">¥{{ formatAmount(order.amountTotal) }}</text>
              </view>
            <view v-if="Number(order.amountAdjusted) !== 0" class="petpal-amount-item">
              <text class="petpal-amount-label">调整金额</text>
              <text class="petpal-amount-value" :style="{ color: Number(order.amountAdjusted) > 0 ? '#FF6B6B' : '#52C41A' }">
                {{ Number(order.amountAdjusted) > 0 ? '+ ' : '' }}¥{{ formatAmount(Math.abs(Number(order.amountAdjusted))) }}
              </text>
            </view>
              <view class="petpal-amount-item">
                <text class="petpal-amount-label">已支付</text>
                <text class="petpal-amount-value is-paid">¥{{ formatAmount(order.amountPaid) }}</text>
              </view>
              <view v-if="outstandingAmount > 0" class="petpal-amount-item">
                <text class="petpal-amount-label">待支付</text>
                <text class="petpal-amount-value">¥{{ formatAmount(outstandingAmount) }}</text>
              </view>
              <view class="petpal-amount-item">
                <text class="petpal-amount-label">已退款</text>
                <text class="petpal-amount-value">¥{{ formatAmount(order.amountRefunded) }}</text>
              </view>
            </view>
        </AppSection>

        <AppSection v-if="detailTab === 'aftersales'" title="售后处理">
          <view class="petpal-tab-workspace">
            <view class="petpal-tab-hero petpal-tab-hero--aftersales">
              <view class="petpal-tab-hero__copy">
                <text class="petpal-tab-hero__eyebrow">售后区</text>
                <text class="petpal-tab-hero__title">{{ aftersalesSpotlightTitle }}</text>
                <text class="petpal-tab-hero__hint">{{ aftersalesSpotlightHint }}</text>
              </view>
              <view class="petpal-tab-hero__actions">
                <AppButton
                  v-if="activeComplaint || complaintFeed.length > 0"
                  size="medium"
                  :type="activeComplaint ? 'danger' : 'info'"
                  @click="openComplaintPage"
                >
                  {{ activeComplaint ? '看投诉进度' : '看投诉结果' }}
                </AppButton>
                <AppButton
                  v-if="refundProgress && refundProgress.stage !== 'NONE'"
                  size="medium"
                  :type="['REJECTED', 'FAILED'].includes(refundProgress.stage) ? 'danger' : 'info'"
                  @click="openRefundResultPage"
                >
                  {{ ['PENDING_REVIEW', 'APPROVED_WAITING'].includes(refundProgress.stage) ? '看退款进度' : '看退款结果' }}
                </AppButton>
                <AppButton
                  v-if="!activeComplaint && complaintFeed.length === 0 && canCreateComplaint"
                  size="medium"
                  type="danger"
                  @click="openComplaintPage"
                >
                  发起投诉
                </AppButton>
              </view>
            </view>

            <view class="petpal-tab-summary-grid">
              <view
                v-for="card in aftersalesSummaryCards"
                :key="card.key"
                class="petpal-tab-summary-card"
                :class="`petpal-tab-summary-card--${card.tone}`"
              >
                <text class="petpal-tab-summary-card__label">{{ card.label }}</text>
                <text class="petpal-tab-summary-card__value">{{ card.value }}</text>
                <text class="petpal-tab-summary-card__hint">{{ card.hint }}</text>
              </view>
            </view>

            <view v-if="refundFeed.length > 0 || complaintFeed.length > 0" class="petpal-case-stack">
              <view
                v-for="refund in refundFeed"
                :key="refund.id"
                class="petpal-case-card petpal-case-card--refund"
              >
                <view class="petpal-case-card__header">
                  <view class="petpal-case-card__headline">
                    <text class="petpal-case-card__title">{{ labels.refundType[refund.refundType] || refund.refundType }}</text>
                    <text class="petpal-case-card__meta">
                      {{ formatDateTime(refund.createdAt) }} · 申请 ¥{{ formatAmount(refund.refundAmount) }}
                    </text>
                  </view>
                  <AppTag :type="getStatusTagType(getRefundAftersalesClass(refund.refundStatus))">
                    {{ labels.refundStatus[refund.refundStatus] || refund.refundStatus }}
                  </AppTag>
                </view>
                <view class="petpal-feed-card__details">
                  <text class="petpal-feed-card__detail">退款金额：¥{{ formatAmount(refund.refundAmount) }}</text>
                  <text class="petpal-feed-card__detail">退款类型：{{ labels.refundType[refund.refundType] || refund.refundType }}</text>
                  <text v-if="refund.reviewedAt" class="petpal-feed-card__detail">
                    审核时间：{{ formatDateTime(refund.reviewedAt) }}
                  </text>
                </view>
                <view v-if="refund.refundReason" class="petpal-note-card">
                  <text>{{ refund.refundReason }}</text>
                </view>
                <view class="petpal-case-card__actions">
                  <AppButton size="medium" type="info" @click="openRefundResultPage">
                    查看退款结果
                  </AppButton>
                </view>
              </view>

              <view
                v-for="complaint in complaintFeed"
                :key="complaint.id"
                class="petpal-case-card petpal-case-card--complaint"
              >
                <view class="petpal-case-card__header">
                  <view class="petpal-case-card__headline">
                    <text class="petpal-case-card__title">{{ getComplaintTypeLabel(complaint.complaintType) }}</text>
                    <text class="petpal-case-card__meta">
                      {{ formatDateTime(complaint.createdAt) }} · 投诉对象：{{ getComplaintTargetRoleLabel(complaint.targetRole) }}
                    </text>
                  </view>
                  <AppTag :type="getStatusTagType(getComplaintStatusClass(complaint.status))">
                    {{ getComplaintStatusLabel(complaint.status) }}
                  </AppTag>
                </view>
                <view class="petpal-note-card">
                  <text>{{ complaint.description }}</text>
                </view>
                <view class="petpal-feed-card__details">
                  <text v-if="complaint.assignedAdminNickname" class="petpal-feed-card__detail">
                    当前负责人：{{ complaint.assignedAdminNickname }}
                  </text>
                  <text class="petpal-feed-card__detail">投诉类型：{{ getComplaintTypeLabel(complaint.complaintType) }}</text>
                  <text v-if="complaint.resultSummary" class="petpal-feed-card__detail">
                    处理结论：{{ complaint.resultSummary }}
                  </text>
                </view>

                <view v-if="complaint.evidenceUrls.length > 0" class="petpal-service-log-media">
                  <view
                    v-for="(url, index) in complaint.evidenceUrls"
                    :key="`${complaint.id}-${url}`"
                    class="petpal-service-log-media-item"
                    @tap="openComplaintEvidence(complaint.evidenceUrls, url)"
                  >
                    <image
                      v-if="isPreviewableImage(url)"
                      :src="url"
                      mode="aspectFill"
                      class="petpal-service-log-media-image"
                    />
                    <view v-else class="petpal-service-log-media-file">
                      <text>{{ getMediaLinkLabel(url, index) }}</text>
                    </view>
                    <text class="petpal-service-log-media-meta">
                      {{ isPreviewableImage(url) ? '点击预览证据' : '点击打开或复制链接' }}
                    </text>
                  </view>
                </view>

                <view v-if="complaint.processLogs.length > 0" class="petpal-inline-progress">
                  <view
                    v-for="log in complaint.processLogs.slice(0, 3)"
                    :key="log.id"
                    class="petpal-inline-progress__item"
                  >
                    <text class="petpal-inline-progress__title">{{ getComplaintActionLabel(log.actionType) }}</text>
                    <text class="petpal-inline-progress__meta">
                      {{ formatDateTime(log.createdAt) }} · {{ log.operatorNickname || '平台' }}
                    </text>
                    <text v-if="log.note" class="petpal-inline-progress__note">{{ log.note }}</text>
                  </view>
                </view>

                <view class="petpal-case-card__actions">
                  <AppButton
                    size="medium"
                    :type="['OPEN', 'PROCESSING'].includes(complaint.status) ? 'danger' : 'info'"
                    @click="openComplaintPage"
                  >
                    {{ ['OPEN', 'PROCESSING'].includes(complaint.status) ? '查看投诉进度' : '查看投诉结果' }}
                  </AppButton>
                </view>
              </view>
            </view>
            <view v-else class="petpal-empty petpal-empty--soft">
              <text>当前没有退款和投诉记录</text>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="detailTab === 'chat'" :title="conversationMessages.length ? `订单沟通 (${conversationMessages.length})` : '订单沟通'">
          <view class="petpal-tab-workspace">
            <view class="petpal-tab-hero petpal-tab-hero--chat">
              <view class="petpal-tab-hero__copy">
                <text class="petpal-tab-hero__eyebrow">沟通区</text>
                <text class="petpal-tab-hero__title">{{ chatSpotlightTitle }}</text>
                <text class="petpal-tab-hero__hint">{{ chatSpotlightHint }}</text>
              </view>
              <view class="petpal-tab-hero__actions">
                <AppButton v-if="currentConversationUnreadCount > 0" size="medium" @click="markConversationAsRead">
                  全部已读
                </AppButton>
                <AppButton size="medium" type="info" @click="handleQuickAction('SERVICE')">
                  看履约
                </AppButton>
              </view>
            </view>

            <view class="petpal-tab-summary-grid">
              <view
                v-for="card in chatSummaryCards"
                :key="card.key"
                class="petpal-tab-summary-card"
                :class="`petpal-tab-summary-card--${card.tone}`"
              >
                <text class="petpal-tab-summary-card__label">{{ card.label }}</text>
                <text class="petpal-tab-summary-card__value">{{ card.value }}</text>
                <text class="petpal-tab-summary-card__hint">{{ card.hint }}</text>
              </view>
            </view>

            <view v-if="conversationMessages.length" class="petpal-chat-thread">
              <view
                v-for="message in conversationMessages"
                :key="message.id"
                class="petpal-chat-row"
                :class="isOwnMessage(message) ? 'petpal-chat-row--self' : ''"
              >
                <view class="petpal-chat-bubble">
                  <view class="petpal-chat-bubble__meta">
                    <text class="petpal-chat-bubble__sender">{{ getConversationSenderLabel(message) }}</text>
                    <text class="petpal-chat-bubble__time">{{ formatDateTime(message.createdAt) }}</text>
                  </view>
                  <view v-if="message.content" class="petpal-note-card petpal-note-card--bubble">
                    <text>{{ message.content }}</text>
                  </view>
                  <view v-if="message.mediaUrls.length > 0" class="petpal-service-log-media">
                    <view
                      v-for="(url, index) in message.mediaUrls"
                      :key="`${message.id}-${url}`"
                      class="petpal-service-log-media-item"
                      @tap="openMediaUrl(message.mediaUrls, url)"
                    >
                      <image
                        v-if="isPreviewableImage(url)"
                        :src="url"
                        mode="aspectFill"
                        class="petpal-service-log-media-image"
                      />
                      <view v-else class="petpal-service-log-media-file">
                        <text>{{ getMediaLinkLabel(url, index) }}</text>
                      </view>
                      <text class="petpal-service-log-media-meta">
                        {{ isPreviewableImage(url) ? '点击预览附件' : '点击打开或复制链接' }}
                      </text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
            <view v-else class="petpal-empty petpal-empty--soft">
              <text>还没有沟通记录</text>
            </view>

            <view v-if="canSendMessage" class="petpal-chat-composer">
              <view class="petpal-chat-composer__header">
                <text class="petpal-chat-composer__title">发送消息</text>
                <text class="petpal-chat-composer__hint">交接说明和附件都会直接留在订单里。</text>
              </view>
              <textarea
                v-model="messageForm.content"
                class="petpal-textarea"
                :maxlength="300"
                auto-height
                placeholder="输入交接说明、异常同步或补充信息"
              />
              <view class="petpal-action-row">
                <AppButton
                  size="medium"
                  type="info"
                  :loading="messageAttachmentUploading"
                  @click="uploadMessageAttachments"
                >
                  上传附件
                </AppButton>
                <AppButton size="medium" :loading="messageSubmitting" @click="submitMessage">
                  发送消息
                </AppButton>
              </view>
              <view v-if="messageForm.attachments.length > 0" class="petpal-message-attachment-list">
                <view
                  v-for="item in messageForm.attachments"
                  :key="item.fileId"
                  class="petpal-message-attachment-item"
                >
                  <view class="petpal-message-attachment-item__copy">
                    <text>{{ item.name }}</text>
                    <text>{{ Math.max(1, Math.round(item.size / 1024)) }} KB</text>
                  </view>
                  <view class="petpal-action-row">
                    <AppButton size="medium" type="info" @click="openMediaUrl(messageForm.attachments.map(file => file.url), item.url)">
                      打开
                    </AppButton>
                    <AppButton size="medium" type="danger" @click="removeMessageAttachment(item.fileId)">
                      移除
                    </AppButton>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="detailTab === 'aftersales'" :title="aftersalesTimelineFeed.length > 0 ? `售后动态 (${aftersalesTimelineFeed.length})` : '售后动态'">
          <template v-if="aftersalesTimelineFeed.length > 0">
            <view class="petpal-feed-list">
              <view
                v-for="item in aftersalesTimelineFeed"
                :key="item.id"
                class="petpal-feed-card"
              >
                <view class="petpal-feed-card__header">
                  <view class="petpal-feed-card__headline">
                    <text class="petpal-feed-card__title">{{ item.title }}</text>
                    <text class="petpal-feed-card__meta">{{ formatDateTime(item.occurredAt) }}</text>
                  </view>
                  <AppTag :type="getStatusTagType(item.statusClass)">
                    {{ item.statusLabel }}
                  </AppTag>
                </view>
                <view class="petpal-feed-card__details">
                  <text class="petpal-feed-card__detail">{{ item.referenceLabel }}：{{ item.referenceValue }}</text>
                  <text
                    v-for="detail in item.details"
                    :key="`${item.id}-${detail}`"
                    class="petpal-feed-card__detail"
                  >
                    {{ detail }}
                  </text>
                </view>
                <view v-if="item.note" class="petpal-note-card">
                  <text>{{ item.note }}</text>
                </view>
              </view>
            </view>
          </template>
          <view v-else class="petpal-empty petpal-empty--soft">
            <text>还没有售后动态</text>
          </view>
        </AppSection>

        <AppSection v-if="detailTab === 'service'" title="履约进度">
          <view class="petpal-tab-workspace">
            <view class="petpal-tab-hero petpal-tab-hero--service">
              <view class="petpal-tab-hero__copy">
                <text class="petpal-tab-hero__eyebrow">履约区</text>
                <text class="petpal-tab-hero__title">{{ serviceSpotlightTitle }}</text>
                <text class="petpal-tab-hero__hint">{{ serviceSpotlightHint }}</text>
              </view>
              <view class="petpal-tab-hero__actions">
                <AppButton v-if="canConfirmComplete" size="medium" @click="handleConfirmComplete">
                  确认完成
                </AppButton>
                <AppButton size="medium" type="info" @click="handleQuickAction('CHAT')">
                  去沟通
                </AppButton>
              </view>
            </view>

            <view class="petpal-tab-summary-grid">
              <view
                v-for="card in serviceSummaryCards"
                :key="card.key"
                class="petpal-tab-summary-card"
                :class="`petpal-tab-summary-card--${card.tone}`"
              >
                <text class="petpal-tab-summary-card__label">{{ card.label }}</text>
                <text class="petpal-tab-summary-card__value">{{ card.value }}</text>
                <text class="petpal-tab-summary-card__hint">{{ card.hint }}</text>
              </view>
            </view>

            <view v-if="serviceTimelineFeed.length > 0" class="petpal-feed-list">
              <view
                v-for="event in serviceTimelineFeed"
                :key="event.id"
                class="petpal-feed-card"
              >
                <view class="petpal-feed-card__header">
                  <view class="petpal-feed-card__headline">
                    <text class="petpal-feed-card__title">{{ labels.timelineEvent[event.eventType] || event.eventType }}</text>
                    <text class="petpal-feed-card__meta">{{ formatDateTime(event.createdAt) }}</text>
                  </view>
                  <AppTag :type="getStatusTagType(getTimelineClass(event.eventType as OrderTimelineEventType))">
                    {{ labels.operatorRole[event.operatorRole] || event.operatorRole }}
                  </AppTag>
                </view>
                <view v-if="getTimelineDetails(event).length > 0" class="petpal-feed-card__details">
                  <text
                    v-for="detail in getTimelineDetails(event)"
                    :key="`${event.id}-${detail}`"
                    class="petpal-feed-card__detail"
                  >
                    {{ detail }}
                  </text>
                </view>
              </view>
            </view>
            <view v-else class="petpal-empty petpal-empty--soft">
              <text>还没有履约节点</text>
            </view>
          </view>
        </AppSection>

        <AppSection v-if="detailTab === 'service'" :title="serviceLogFeed.length > 0 ? `服务回传 (${serviceLogFeed.length})` : '服务回传'">
          <template v-if="serviceLogFeed.length > 0">
            <view class="petpal-feed-list">
              <view
                v-for="log in serviceLogFeed"
                :key="log.id"
                class="petpal-feed-card petpal-feed-card--service"
              >
                <view class="petpal-feed-card__header">
                  <view class="petpal-feed-card__headline">
                    <text class="petpal-feed-card__title">{{ labels.serviceLogType[log.logType] || log.logType }}</text>
                    <text class="petpal-feed-card__meta">{{ formatDateTime(log.happenedAt) }}</text>
                  </view>
                  <AppTag :type="getStatusTagType(getServiceLogClass(log.logType as ServiceLogType))">
                    {{ log.mediaUrls.length > 0 ? `${log.mediaUrls.length} 个媒体` : '文字回传' }}
                  </AppTag>
                </view>
                <view v-if="log.textNote" class="petpal-note-card">
                  <text>{{ log.textNote }}</text>
                </view>
                <view v-if="getServiceLogDetails(log).length > 0" class="petpal-feed-card__details">
                  <text
                    v-for="detail in getServiceLogDetails(log)"
                    :key="`${log.id}-${detail}`"
                    class="petpal-feed-card__detail"
                  >
                    {{ detail }}
                  </text>
                </view>
                <view v-if="log.mediaUrls.length > 0" class="petpal-service-log-media">
                  <view
                    v-for="(url, index) in log.mediaUrls"
                    :key="`${log.id}-${url}`"
                    class="petpal-service-log-media-item"
                    @tap="openServiceLogMedia(log, url)"
                  >
                    <image
                      v-if="isPreviewableImage(url)"
                      :src="url"
                      mode="aspectFill"
                      class="petpal-service-log-media-image"
                    />
                    <view v-else class="petpal-service-log-media-file">
                      <text>{{ getMediaLinkLabel(url, index) }}</text>
                    </view>
                    <text class="petpal-service-log-media-meta">
                      {{ isPreviewableImage(url) ? '点击预览' : '点击打开或复制链接' }}
                    </text>
                  </view>
                </view>
              </view>
            </view>
          </template>
          <view v-else class="petpal-empty petpal-empty--soft">
            <text>照料者还没有回传服务记录</text>
          </view>
        </AppSection>

        <!-- 支付时间线 -->
        <AppSection v-if="detailTab === 'overview' && order.payments.length > 0" :title="`支付记录 (${order.payments.length})`">
          <view class="petpal-timeline">
            <view v-for="payment in order.payments" :key="payment.id" class="petpal-timeline-item">
              <view class="petpal-timeline-dot" :class="`is-${payment.payStatus.toLowerCase()}`" />
              <view class="petpal-timeline-content">
                <view class="petpal-timeline-header">
                  <text class="petpal-timeline-title">{{ payment.payNo }}</text>
                  <text class="petpal-timeline-label">{{ labels.paymentStatus[payment.payStatus] || payment.payStatus }}</text>
                </view>
                <view class="petpal-timeline-meta">
                  <text class="petpal-timeline-meta-item">
                    <text class="petpal-timeline-meta-label">金额</text>
                    <text class="petpal-timeline-meta-value">¥{{ formatAmount(payment.payAmount) }}</text>
                  </text>
                  <text class="petpal-timeline-meta-item">
                    <text class="petpal-timeline-meta-label">类型</text>
                    <text class="petpal-timeline-meta-value">{{ labels.paymentBizType[payment.bizType] || payment.bizType }}</text>
                  </text>
                </view>
                <view v-if="payment.paidAt" class="petpal-timeline-meta">
                  <text class="petpal-timeline-meta-item">
                    <text class="petpal-timeline-meta-label">完成</text>
                    <text class="petpal-timeline-meta-value">{{ formatDateTime(payment.paidAt) }}</text>
                  </text>
                </view>
              </view>
            </view>
          </view>
        </AppSection>

        <!-- 返回按钮 -->
        <view class="petpal-order-actions">
          <AppButton type="primary" @click="handleGoBack">返回</AppButton>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="petpal-empty">
        <text>{{ error || '订单未找到' }}</text>
      </view>
    </template>
  </AppPageShell>
</template>

<style lang="scss" scoped>
.petpal-order-container {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.petpal-order-overview-banner {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding: 16px;
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 34%),
    linear-gradient(145deg, #115e59 0%, #155e75 52%, #1d4f91 100%);
  color: #f8fafc;
}

.petpal-order-overview-banner__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.petpal-order-overview-banner__headline {
  display: grid;
  gap: 4px;
}

.petpal-order-overview-banner__title {
  font-size: 18px;
  line-height: 1.2;
  font-weight: 700;
}

.petpal-order-overview-banner__meta {
  font-size: 12px;
  color: rgba(248, 250, 252, 0.88);
}

.petpal-order-overview-banner__summary {
  font-size: 13px;
  line-height: 1.7;
  color: rgba(248, 250, 252, 0.9);
}

.petpal-detail-tab-scroll {
  white-space: nowrap;
}

.petpal-detail-tab-track {
  display: inline-flex;
  gap: 12px;
  padding-bottom: 4px;
}

.petpal-detail-tab-card {
  display: grid;
  gap: 6px;
  width: 148px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
  box-sizing: border-box;
}

.petpal-detail-tab-card--active {
  border-color: transparent;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.petpal-detail-tab-card__label {
  color: #667085;
  font-size: 12px;
  line-height: 1.4;
}

.petpal-detail-tab-card__metric {
  color: #1f2937;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
}

.petpal-detail-tab-card__hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-order-overview-banner__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.petpal-order-overview-banner__stat {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.14);
}

.petpal-order-overview-banner__stat-label {
  font-size: 11px;
  color: rgba(248, 250, 252, 0.72);
}

.petpal-order-overview-banner__stat-value {
  font-size: 14px;
  color: #fff;
  font-weight: 700;
}

.petpal-owner-actions {
  display: grid;
  gap: 12px;
}

.petpal-overview-focus {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid #dbeafe;
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.12), transparent 34%),
    linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.petpal-overview-focus__copy {
  display: grid;
  gap: 6px;
}

.petpal-overview-focus__eyebrow {
  color: #667085;
  font-size: 12px;
  line-height: 1.4;
}

.petpal-overview-focus__title {
  color: #1f2937;
  font-size: 16px;
  line-height: 1.28;
  font-weight: 700;
}

.petpal-overview-focus__hint {
  color: #475467;
  font-size: 13px;
  line-height: 1.6;
}

.petpal-overview-focus__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.petpal-quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.petpal-quick-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.petpal-quick-card__title {
  color: #1f2937;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 700;
}

.petpal-quick-card__hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-signal-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.petpal-signal-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
  transition: transform 160ms ease, box-shadow 200ms ease, border-color 200ms ease;
}

.petpal-signal-card--clickable {
  cursor: pointer;
}

.petpal-signal-card--clickable:active {
  transform: scale(0.99);
}

.petpal-signal-card--primary {
  border-color: #dbeafe;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.petpal-signal-card--success {
  border-color: #cce9d5;
  background: linear-gradient(180deg, #edf9f0 0%, #ffffff 100%);
}

.petpal-signal-card--warning {
  border-color: #fde7b3;
  background: linear-gradient(180deg, #fff9e8 0%, #ffffff 100%);
}

.petpal-signal-card--danger {
  border-color: #ffd0d2;
  background: linear-gradient(180deg, #fff1f2 0%, #ffffff 100%);
}

.petpal-signal-card__title {
  color: #667085;
  font-size: 12px;
  line-height: 1.4;
}

.petpal-signal-card__value {
  color: #1f2937;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
}

.petpal-signal-card__hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.petpal-action-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}

.petpal-action-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-action-panel__title {
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.petpal-action-panel__meta {
  color: #667085;
  font-size: 12px;
}

.petpal-tab-workspace {
  display: grid;
  gap: 14px;
}

.petpal-tab-hero {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid #dbe3ef;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.06);
}

.petpal-tab-hero--chat {
  background:
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.14), transparent 34%),
    linear-gradient(180deg, #f2fbf6 0%, #ffffff 100%);
}

.petpal-tab-hero--service {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.16), transparent 34%),
    linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.petpal-tab-hero--aftersales {
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.14), transparent 34%),
    linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
}

.petpal-tab-hero__copy {
  display: grid;
  gap: 6px;
}

.petpal-tab-hero__eyebrow {
  color: #667085;
  font-size: 12px;
  line-height: 1.4;
}

.petpal-tab-hero__title {
  color: #111827;
  font-size: 18px;
  line-height: 1.32;
  font-weight: 700;
}

.petpal-tab-hero__hint {
  color: #475467;
  font-size: 13px;
  line-height: 1.7;
}

.petpal-tab-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.petpal-tab-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.petpal-tab-summary-card {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}

.petpal-tab-summary-card--primary {
  border-color: #dbeafe;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.petpal-tab-summary-card--success {
  border-color: #cce9d5;
  background: linear-gradient(180deg, #edf9f0 0%, #ffffff 100%);
}

.petpal-tab-summary-card--warning {
  border-color: #fde7b3;
  background: linear-gradient(180deg, #fff8e7 0%, #ffffff 100%);
}

.petpal-tab-summary-card--danger {
  border-color: #fecdd3;
  background: linear-gradient(180deg, #fff1f2 0%, #ffffff 100%);
}

.petpal-tab-summary-card__label {
  color: #667085;
  font-size: 12px;
  line-height: 1.4;
}

.petpal-tab-summary-card__value {
  color: #111827;
  font-size: 16px;
  line-height: 1.35;
  font-weight: 700;
}

.petpal-tab-summary-card__hint {
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-feed-list {
  display: grid;
  gap: 12px;
}

.petpal-feed-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.petpal-feed-card--service {
  background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
}

.petpal-feed-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-feed-card__headline {
  display: grid;
  gap: 4px;
}

.petpal-feed-card__title {
  color: #1f2937;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
}

.petpal-feed-card__meta {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-feed-card__details {
  display: grid;
  gap: 6px;
}

.petpal-feed-card__detail {
  color: #4b5563;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-case-stack {
  display: grid;
  gap: 12px;
}

.petpal-case-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.petpal-case-card--refund {
  border-color: #dbeafe;
  background: linear-gradient(180deg, #f6faff 0%, #ffffff 100%);
}

.petpal-case-card--complaint {
  border-color: #ffd6dc;
  background: linear-gradient(180deg, #fff6f7 0%, #ffffff 100%);
}

.petpal-case-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-case-card__headline {
  display: grid;
  gap: 4px;
}

.petpal-case-card__title {
  color: #111827;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 700;
}

.petpal-case-card__meta {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-case-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.petpal-inline-progress {
  display: grid;
  gap: 8px;
}

.petpal-inline-progress__item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid #e5ebf3;
}

.petpal-inline-progress__title {
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
}

.petpal-inline-progress__meta {
  color: #6b7280;
  font-size: 12px;
}

.petpal-inline-progress__note {
  color: #4b5563;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-chat-thread {
  display: grid;
  gap: 12px;
}

.petpal-chat-row {
  display: flex;
}

.petpal-chat-row--self {
  justify-content: flex-end;
}

.petpal-chat-bubble {
  display: grid;
  gap: 10px;
  width: 100%;
  max-width: 86%;
  padding: 12px;
  border-radius: 18px 18px 18px 8px;
  border: 1px solid #dbe3ef;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.petpal-chat-row--self .petpal-chat-bubble {
  border-radius: 18px 18px 8px 18px;
  border-color: #bfd7ff;
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.petpal-chat-bubble__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.petpal-chat-bubble__sender {
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

.petpal-chat-bubble__time {
  color: #6b7280;
  font-size: 12px;
}

.petpal-chat-composer {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid #dbe7ff;
  background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
}

.petpal-chat-composer__header {
  display: grid;
  gap: 4px;
}

.petpal-chat-composer__title {
  color: #111827;
  font-size: 15px;
  font-weight: 700;
}

.petpal-chat-composer__hint {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.petpal-form-group {
  display: grid;
  gap: 8px;
}

.petpal-form-group__label {
  color: #667085;
  font-size: 12px;
}

.petpal-textarea {
  width: 100%;
  min-height: 104px;
  padding: 12px;
  border: 1px solid #dbe3ef;
  border-radius: 12px;
  background: #fff;
  color: #1f2937;
  line-height: 1.6;
  box-sizing: border-box;
}

.petpal-textarea--compact {
  min-height: 84px;
}

.petpal-info-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.petpal-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e4e4e4;

  &:last-child {
    border-bottom: none;
  }
}

.petpal-info-label {
  color: #999;
  font-size: 12px;
  font-weight: 500;
}

.petpal-info-value {
  color: #333;
  font-size: 14px;
}

.petpal-amounts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.petpal-amount-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
  text-align: center;
}

.petpal-amount-label {
  color: #999;
  font-size: 12px;
  font-weight: 500;
}

.petpal-amount-value {
  color: #333;
  font-size: 16px;
  font-weight: 600;

  &.is-paid {
    color: #52c41a;
  }
}

.petpal-refund-progress {
  display: grid;
  gap: 12px;
}

.petpal-refund-progress__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-refund-progress__headline {
  display: grid;
  gap: 6px;
}

.petpal-refund-progress__title {
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.petpal-refund-progress__hint {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-refund-progress__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.petpal-refund-progress__stat {
  display: grid;
  gap: 4px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(180deg, #fff 0%, #f6f9ff 100%);
  border: 1px solid #e5ebf3;
}

.petpal-refund-progress__stat-label {
  color: #667085;
  font-size: 12px;
}

.petpal-refund-progress__stat-value {
  color: #1f2937;
  font-size: 16px;
  font-weight: 600;
}

.petpal-refund-progress__latest {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fbff;
  border: 1px solid #dbe7ff;
}

.petpal-refund-progress__actions {
  display: flex;
  justify-content: flex-start;
}

.petpal-refund-progress__latest-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}

.petpal-refund-progress__latest-no {
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.petpal-refund-progress__latest-status {
  color: #667085;
  font-size: 12px;
}

.petpal-complaint-list {
  display: grid;
  gap: 12px;
}

.petpal-complaint-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}

.petpal-complaint-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-complaint-card__headline {
  display: grid;
  gap: 4px;
}

.petpal-complaint-card__title {
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.petpal-complaint-card__meta {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-complaint-progress {
  display: grid;
  gap: 8px;
}

.petpal-complaint-progress__item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-left: 3px solid #dbeafe;
  border-radius: 0 10px 10px 0;
  background: #f9fbff;
}

.petpal-complaint-progress__title {
  color: #1f2937;
  font-size: 13px;
  font-weight: 600;
}

.petpal-complaint-progress__meta {
  color: #6b7280;
  font-size: 12px;
}

.petpal-complaint-progress__note {
  color: #4b5563;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-message-panel {
  display: grid;
  gap: 12px;
}

.petpal-message-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-message-panel__headline {
  display: grid;
  gap: 4px;
}

.petpal-message-panel__title {
  color: #1f2937;
  font-size: 15px;
  font-weight: 600;
}

.petpal-message-panel__hint {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.petpal-message-panel__badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #fee2e2;
  color: #b91c1c;
  font-size: 12px;
}

.petpal-message-list {
  display: grid;
  gap: 10px;
}

.petpal-message-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #e5ebf3;
  background: linear-gradient(180deg, #fff 0%, #fbfcfe 100%);
}

.petpal-message-card.is-self {
  border-color: #bfd7ff;
  background: linear-gradient(180deg, #f4f8ff 0%, #eef5ff 100%);
}

.petpal-message-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.petpal-message-card__headline {
  display: grid;
  gap: 4px;
}

.petpal-message-card__title {
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
}

.petpal-message-card__meta {
  color: #6b7280;
  font-size: 12px;
}

.petpal-message-card__tag {
  color: #475467;
  font-size: 12px;
}

.petpal-message-composer {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid #dbe7ff;
  background: linear-gradient(180deg, #fff 0%, #f7fbff 100%);
}

.petpal-message-attachment-list {
  display: grid;
  gap: 10px;
}

.petpal-message-attachment-item {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #e5ebf3;
  background: #fff;
}

.petpal-message-attachment-item__copy {
  display: grid;
  gap: 4px;
}

.petpal-message-attachment-item__copy text:last-child {
  color: #6b7280;
  font-size: 12px;
}

.petpal-timeline {
  position: relative;
  padding: 8px 0;
}

.petpal-timeline-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  margin-left: 20px;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: -14px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #e4e4e4;
  }

  &:last-child::before {
    display: none;
  }
}

.petpal-timeline-dot {
  position: absolute;
  left: -24px;
  top: 18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #e4e4e4;
  border: 2px solid #fff;

  &.is-paid {
    background: #52c41a;
  }

  &.is-pending {
    background: #1890ff;
  }

  &.is-success {
    background: #52c41a;
  }

  &.is-failed {
    background: #ff4d4f;
  }

  &.is-rejected {
    background: #ff4d4f;
  }

  &.is-approved {
    background: #faad14;
  }

  &.is-warning {
    background: #f59e0b;
  }

  &.is-primary {
    background: #3b82f6;
  }

  &.is-error {
    background: #ef4444;
  }

  &.is-closed {
    background: #8b8f97;
  }
}

.petpal-timeline-content {
  flex: 1;
  min-width: 0;
}

.petpal-timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.petpal-timeline-title {
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.petpal-timeline-label {
  color: #666;
  font-size: 12px;
}

.petpal-timeline-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.petpal-timeline-meta-item {
  display: flex;
  gap: 4px;
}

.petpal-timeline-meta-label {
  color: #999;
  font-weight: 500;
}

.petpal-timeline-meta-value {
  color: #666;
}

.petpal-detail-line {
  margin-top: 6px;
  font-size: 12px;
  color: #555;
  line-height: 1.6;
}

.petpal-note-card {
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #333;
  line-height: 1.6;
}

.petpal-note-card--bubble {
  margin-top: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
}

.petpal-chat-row--self .petpal-note-card--bubble {
  background: rgba(239, 246, 255, 0.95);
}

.petpal-service-log-media {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.petpal-service-log-media-item {
  display: grid;
  gap: 6px;
  padding: 10px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5ebf3;
}

.petpal-service-log-media-image,
.petpal-service-log-media-file {
  width: 100%;
  height: 128px;
  border-radius: 10px;
}

.petpal-service-log-media-image {
  background: #eef4fb;
}

.petpal-service-log-media-file {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: linear-gradient(135deg, #f6f8fb 0%, #edf4ff 100%);
  color: #2f4668;
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  box-sizing: border-box;
}

.petpal-service-log-media-meta {
  color: #6b7280;
  font-size: 11px;
}

.petpal-empty {
  padding: 32px 16px;
  text-align: center;
  color: #999;
}

.petpal-empty--soft {
  padding: 24px 16px;
  border-radius: 16px;
  border: 1px dashed #dbe3ef;
  background: #f8fafc;
  color: #667085;
}

.petpal-order-actions {
  display: flex;
  gap: 12px;
  padding: 12px 0;
}

@media (max-width: 680px) {
  .petpal-quick-grid,
  .petpal-signal-grid,
  .petpal-tab-summary-grid,
  .petpal-service-log-media,
  .petpal-order-overview-banner__stats {
    grid-template-columns: 1fr;
  }

  .petpal-chat-bubble {
    max-width: 100%;
  }
}
</style>
