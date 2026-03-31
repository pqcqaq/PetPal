<script lang="ts" setup>
import type {
  OrderDetailRecord,
  OrderOperatorRole,
  OrderStatus,
  OrderTimelineEventType,
  OrderTimelineRecord,
  ServiceLogRecord,
  ServiceLogType,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { ref, watch } from 'vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppButton from '@/components/app-button/app-button.vue'
import { getOrderDetail } from '@/api/petpal'
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
const loading = ref(false)
const error = ref('')

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
}

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
    details.push(`定位坐标：${geoText}`)
  }
  return details
}

const getServiceLogDetails = (log: ServiceLogRecord) => {
  const details: string[] = []
  const geoText = formatGeoValue(log.geo)
  if (geoText) {
    details.push(`定位坐标：${geoText}`)
  }
  if (log.createdAt !== log.happenedAt) {
    details.push(`上传时间：${formatDateTime(log.createdAt)}`)
  }
  return details
}

async function loadOrderDetail() {
  if (!orderId.value) return

  loading.value = true
  error.value = ''
  try {
    const detail = await getOrderDetail(orderId.value)
    order.value = detail
  } catch (err) {
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

// Uni page lifecycle - receive parameters from navigation
function handleGoBack() {
  uni.navigateBack({ delta: 1 })
}

// Uni page lifecycle - receive parameters from navigation
onLoad((options: Record<string, any>) => {
  if (options?.id) {
    orderId.value = options.id
  }
})
</script>

<template>
  <AppPageShell title="订单详情" :loading="loading" :error="error" @refresh="onPullDownRefresh">
    <template v-if="order" #default>
      <div class="petpal-order-container">
        <!-- 订单基础信息 -->
        <AppSection title="订单信息">
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
        <AppSection title="金额统计">
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
            <view class="petpal-amount-item">
              <text class="petpal-amount-label">已退款</text>
              <text class="petpal-amount-value">¥{{ formatAmount(order.amountRefunded) }}</text>
            </view>
          </view>
        </AppSection>

        <AppSection :title="order.timeline.length > 0 ? `履约时间线 (${order.timeline.length})` : '履约时间线'">
          <template v-if="order.timeline.length > 0">
            <view class="petpal-timeline">
              <view v-for="event in order.timeline" :key="event.id" class="petpal-timeline-item">
                <view class="petpal-timeline-dot" :class="`is-${getTimelineClass(event.eventType as OrderTimelineEventType)}`" />
                <view class="petpal-timeline-content">
                  <view class="petpal-timeline-header">
                    <text class="petpal-timeline-title">{{ labels.timelineEvent[event.eventType] || event.eventType }}</text>
                    <text class="petpal-timeline-label">{{ labels.operatorRole[event.operatorRole] || event.operatorRole }}</text>
                  </view>
                  <view class="petpal-timeline-meta">
                    <text class="petpal-timeline-meta-item">
                      <text class="petpal-timeline-meta-label">记录</text>
                      <text class="petpal-timeline-meta-value">{{ formatDateTime(event.createdAt) }}</text>
                    </text>
                    <text v-if="event.operatorId" class="petpal-timeline-meta-item">
                      <text class="petpal-timeline-meta-label">操作人</text>
                      <text class="petpal-timeline-meta-value">{{ event.operatorId }}</text>
                    </text>
                  </view>
                  <view v-for="detail in getTimelineDetails(event)" :key="`${event.id}-${detail}`" class="petpal-detail-line">
                    <text>{{ detail }}</text>
                  </view>
                </view>
              </view>
            </view>
          </template>
          <view v-else class="petpal-empty">
            <text>订单尚未产生履约事件</text>
          </view>
        </AppSection>

        <AppSection :title="order.serviceLogs.length > 0 ? `服务记录 (${order.serviceLogs.length})` : '服务记录'">
          <template v-if="order.serviceLogs.length > 0">
            <view class="petpal-timeline">
              <view v-for="log in order.serviceLogs" :key="log.id" class="petpal-timeline-item">
                <view class="petpal-timeline-dot" :class="`is-${getServiceLogClass(log.logType as ServiceLogType)}`" />
                <view class="petpal-timeline-content">
                  <view class="petpal-timeline-header">
                    <text class="petpal-timeline-title">{{ labels.serviceLogType[log.logType] || log.logType }}</text>
                    <text class="petpal-timeline-label">{{ formatDateTime(log.happenedAt) }}</text>
                  </view>
                  <view class="petpal-timeline-meta">
                    <text class="petpal-timeline-meta-item">
                      <text class="petpal-timeline-meta-label">媒体</text>
                      <text class="petpal-timeline-meta-value">{{ log.mediaUrls.length }} 个</text>
                    </text>
                  </view>
                  <view v-if="log.textNote" class="petpal-note-card">
                    <text>{{ log.textNote }}</text>
                  </view>
                  <view v-for="detail in getServiceLogDetails(log)" :key="`${log.id}-${detail}`" class="petpal-detail-line">
                    <text>{{ detail }}</text>
                  </view>
                </view>
              </view>
            </view>
          </template>
          <view v-else class="petpal-empty">
            <text>照料者尚未上传服务记录</text>
          </view>
        </AppSection>

        <!-- 支付时间线 -->
        <AppSection v-if="order.payments.length > 0" :title="`支付记录 (${order.payments.length})`">
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

        <!-- 退款时间线 -->
        <AppSection v-if="order.refunds.length > 0" :title="`退款记录 (${order.refunds.length})`">
          <view class="petpal-timeline">
            <view v-for="refund in order.refunds" :key="refund.id" class="petpal-timeline-item">
              <view class="petpal-timeline-dot" :class="`is-${refund.refundStatus.toLowerCase()}`" />
              <view class="petpal-timeline-content">
                <view class="petpal-timeline-header">
                  <text class="petpal-timeline-title">{{ refund.refundNo }}</text>
                  <text class="petpal-timeline-label">{{ labels.refundStatus[refund.refundStatus] || refund.refundStatus }}</text>
                </view>
                <view class="petpal-timeline-meta">
                  <text class="petpal-timeline-meta-item">
                    <text class="petpal-timeline-meta-label">金额</text>
                    <text class="petpal-timeline-meta-value">¥{{ formatAmount(refund.refundAmount) }}</text>
                  </text>
                  <text class="petpal-timeline-meta-item">
                    <text class="petpal-timeline-meta-label">类型</text>
                    <text class="petpal-timeline-meta-value">{{ labels.refundType[refund.refundType] || refund.refundType }}</text>
                  </text>
                </view>
                <view v-if="refund.reviewedAt" class="petpal-timeline-meta">
                  <text class="petpal-timeline-meta-item">
                    <text class="petpal-timeline-meta-label">审核</text>
                    <text class="petpal-timeline-meta-value">{{ formatDateTime(refund.reviewedAt) }}</text>
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
      </div>
    </template>

    <template v-else #empty>
      <view class="petpal-empty">
        <text>订单未找到</text>
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

.petpal-empty {
  padding: 32px 16px;
  text-align: center;
  color: #999;
}

.petpal-order-actions {
  display: flex;
  gap: 12px;
  padding: 12px 0;
}
</style>
