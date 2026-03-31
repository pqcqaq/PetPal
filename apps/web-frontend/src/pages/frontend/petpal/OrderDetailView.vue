<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">订单详情</p>
      <h1>订单 {{ orderNo }}</h1>
      <p>查看订单状态、履约时间线、服务记录以及支付退款进度</p>
      <div class="frontend-page__hero-actions">
        <el-button @click="goBack">返回列表</el-button>
        <el-button v-if="order" type="primary" :loading="loading" @click="reload">刷新</el-button>
      </div>
    </section>

    <div v-loading="loading" class="petpal-order-detail">
      <div v-if="order" class="petpal-order-detail__content">
        <!-- 订单基础信息卡片 -->
        <article class="frontend-card petpal-order-detail__header">
          <span class="frontend-card__eyebrow">订单信息</span>
          <h3>{{ orderNo }}</h3>
          <div class="petpal-order-info">
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">订单状态</span>
              <span class="petpal-order-info__value">
                <el-tag :type="getOrderStatusType(order.orderStatus)">
                  {{ getOrderStatusLabel(order.orderStatus) }}
                </el-tag>
              </span>
            </div>
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">服务类型</span>
              <span class="petpal-order-info__value">{{ getServiceTypeLabel(order.serviceType) }}</span>
            </div>
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">服务时间</span>
              <span class="petpal-order-info__value">
                {{ formatDate(order.appointmentStart) }} 至 {{ formatDate(order.appointmentEnd) }}
              </span>
            </div>
            <div class="petpal-order-info__item">
              <span class="petpal-order-info__label">创建时间</span>
              <span class="petpal-order-info__value">{{ formatDateTime(order.createdAt) }}</span>
            </div>
          </div>
        </article>

        <!-- 金额统计卡片 -->
        <article class="frontend-card petpal-order-detail__amounts">
          <span class="frontend-card__eyebrow">金额信息</span>
          <h3>金额统计</h3>
          <div class="petpal-amounts-grid">
            <div class="petpal-amount-item">
              <span class="petpal-amount-item__label">订单总额</span>
              <span class="petpal-amount-item__value">¥{{ formatAmount(order.amountTotal) }}</span>
            </div>
            <div v-if="Number(order.amountAdjusted) !== 0" class="petpal-amount-item">
              <span class="petpal-amount-item__label">调整金额</span>
              <span class="petpal-amount-item__value" :style="{ color: Number(order.amountAdjusted) > 0 ? '#FF6B6B' : '#52C41A' }">
                {{ Number(order.amountAdjusted) > 0 ? '+ ' : '' }}¥{{ formatAmount(Math.abs(Number(order.amountAdjusted))) }}
              </span>
            </div>
            <div class="petpal-amount-item">
              <span class="petpal-amount-item__label">已支付</span>
              <span class="petpal-amount-item__value petpal-amount-item__value--paid">¥{{ formatAmount(order.amountPaid) }}</span>
            </div>
            <div class="petpal-amount-item">
              <span class="petpal-amount-item__label">已退款</span>
              <span class="petpal-amount-item__value">¥{{ formatAmount(order.amountRefunded) }}</span>
            </div>
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__fulfillment">
          <span class="frontend-card__eyebrow">履约时间线</span>
          <h3>{{ order.timeline.length > 0 ? `共 ${order.timeline.length} 条履约事件` : '暂无履约事件' }}</h3>
          <template v-if="order.timeline.length > 0">
            <div class="petpal-timeline">
              <div v-for="event in order.timeline" :key="event.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getTimelineEventClass(event.eventType)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ getTimelineEventLabel(event.eventType) }}</h4>
                    <span class="petpal-timeline__label">
                      <el-space wrap size="small">
                        <el-tag size="small" effect="plain">
                          {{ getOperatorRoleLabel(event.operatorRole) }}
                        </el-tag>
                      </el-space>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>记录时间：</strong>{{ formatDateTime(event.createdAt) }}
                    </span>
                    <span v-if="event.operatorId" class="petpal-timeline__meta-item">
                      <strong>操作人：</strong>{{ event.operatorId }}
                    </span>
                  </div>
                  <div
                    v-for="detail in getTimelineDetails(event)"
                    :key="`${event.id}-${detail}`"
                    class="petpal-timeline__detail"
                  >
                    {{ detail }}
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>订单尚未产生履约事件</p>
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__service-logs">
          <span class="frontend-card__eyebrow">服务记录</span>
          <h3>{{ order.serviceLogs.length > 0 ? `共 ${order.serviceLogs.length} 条服务记录` : '暂无服务记录' }}</h3>
          <template v-if="order.serviceLogs.length > 0">
            <div class="petpal-timeline">
              <div v-for="log in order.serviceLogs" :key="log.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getServiceLogClass(log.logType)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ getServiceLogTypeLabel(log.logType) }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="getServiceLogTagType(log.logType)">
                        {{ getServiceLogTypeLabel(log.logType) }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>服务时间：</strong>{{ formatDateTime(log.happenedAt) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>媒体数量：</strong>{{ log.mediaUrls.length }}
                    </span>
                  </div>
                  <p v-if="log.textNote" class="petpal-timeline__note">{{ log.textNote }}</p>
                  <div
                    v-for="detail in getServiceLogDetails(log)"
                    :key="`${log.id}-${detail}`"
                    class="petpal-timeline__detail"
                  >
                    {{ detail }}
                  </div>
                  <div v-if="log.mediaUrls.length > 0" class="petpal-service-log-media">
                    <a
                      v-for="(url, index) in log.mediaUrls"
                      :key="`${log.id}-${url}`"
                      class="petpal-service-log-media__item"
                      :href="url"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        v-if="isPreviewableImage(url)"
                        :src="url"
                        :alt="`${getServiceLogTypeLabel(log.logType)}媒体 ${index + 1}`"
                        loading="lazy"
                      />
                      <div v-else class="petpal-service-log-media__file">
                        {{ getMediaLinkLabel(url, index) }}
                      </div>
                      <span class="petpal-service-log-media__meta">
                        {{ isPreviewableImage(url) ? '查看原图' : '打开附件' }}
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>照料者尚未上传服务记录</p>
          </div>
        </article>

        <article class="frontend-card petpal-order-detail__review">
          <span class="frontend-card__eyebrow">服务评价</span>
          <div class="petpal-review-card__header">
            <div class="petpal-review-card__headline">
              <h3>
                {{
                  order.review
                    ? '已提交评价'
                    : canCreateReview
                      ? '服务已完成，等待评价'
                      : '暂无评价'
                }}
              </h3>
              <p v-if="order.review">
                评价提交于 {{ formatDateTime(order.review.createdAt) }}
              </p>
              <p v-else-if="canCreateReview">
                评价将用于完善照料者服务画像与后续匹配结果。
              </p>
              <p v-else-if="order.orderStatus === 'COMPLETED'">
                当前订单尚未收到宠物主人的评价。
              </p>
              <p v-else>
                订单完成后才能提交评价。
              </p>
            </div>
            <el-button v-if="canCreateReview" type="primary" @click="openReviewDialog">
              提交评价
            </el-button>
          </div>

          <template v-if="order.review">
            <div class="petpal-review-card__body">
              <el-rate :model-value="order.review.rating" disabled show-score text-color="#c2410c" />
              <div class="petpal-review-card__meta">
                <el-tag size="small" :type="order.review.isAnonymous ? 'info' : 'success'">
                  {{ order.review.isAnonymous ? '匿名评价' : '实名评价' }}
                </el-tag>
                <span>标签数：{{ order.review.tags.length }}</span>
              </div>
              <div v-if="order.review.tags.length > 0" class="petpal-review-card__tags">
                <el-tag
                  v-for="tag in order.review.tags"
                  :key="tag"
                  size="small"
                  effect="plain"
                >
                  {{ tag }}
                </el-tag>
              </div>
              <p v-if="order.review.content" class="petpal-review-card__content">{{ order.review.content }}</p>
              <div v-else class="petpal-review-card__empty-text">
                本次评价未填写文字说明。
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>{{ canCreateReview ? '你可以现在提交本次服务评价' : '当前暂无评价内容' }}</p>
          </div>
        </article>

        <!-- 支付时间线 -->
        <article class="frontend-card petpal-order-detail__payments">
          <span class="frontend-card__eyebrow">支付记录</span>
          <h3>{{ order.payments.length > 0 ? `共 ${order.payments.length} 条支付记录` : '暂无支付记录' }}</h3>
          <template v-if="order.payments.length > 0">
            <div class="petpal-timeline">
              <div v-for="(payment, index) in order.payments" :key="payment.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getPaymentStatusClass(payment.payStatus)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ payment.payNo }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="getPaymentStatusType(payment.payStatus)">
                        {{ getPaymentStatusLabel(payment.payStatus) }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>金额：</strong>¥{{ formatAmount(payment.payAmount) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>类型：</strong>{{ getPaymentBizTypeLabel(payment.bizType) }}
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      
                    </span>
                    <template v-if="payment.paidAt">
                      <span class="petpal-timeline__meta-item">
                        <strong>完成：</strong>{{ formatDateTime(payment.paidAt) }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>暂无支付记录</p>
          </div>
        </article>

        <!-- 退款时间线 -->
        <article class="frontend-card petpal-order-detail__refunds">
          <span class="frontend-card__eyebrow">退款记录</span>
          <h3>{{ order.refunds.length > 0 ? `共 ${order.refunds.length} 条退款记录` : '暂无退款记录' }}</h3>
          <template v-if="order.refunds.length > 0">
            <div class="petpal-timeline">
              <div v-for="refund in order.refunds" :key="refund.id" class="petpal-timeline__item">
                <div class="petpal-timeline__dot" :class="`is-${getRefundStatusClass(refund.refundStatus)}`" />
                <div class="petpal-timeline__content">
                  <div class="petpal-timeline__header">
                    <h4>{{ refund.refundNo }}</h4>
                    <span class="petpal-timeline__label">
                      <el-tag size="small" :type="getRefundStatusType(refund.refundStatus)">
                        {{ getRefundStatusLabel(refund.refundStatus) }}
                      </el-tag>
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      <strong>金额：</strong>¥{{ formatAmount(refund.refundAmount) }}
                    </span>
                    <span class="petpal-timeline__meta-item">
                      <strong>类型：</strong>{{ getRefundTypeLabel(refund.refundType) }}
                    </span>
                  </div>
                  <div class="petpal-timeline__meta">
                    <span class="petpal-timeline__meta-item">
                      
                    </span>
                    <template v-if="refund.reviewedAt">
                      <span class="petpal-timeline__meta-item">
                        <strong>审核完成：</strong>{{ formatDateTime(refund.reviewedAt) }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="petpal-empty">
            <p>暂无退款记录</p>
          </div>
        </article>
      </div>
      <div v-else-if="!loading" class="petpal-empty">
        <p>订单未找到</p>
      </div>

      <el-dialog
        v-model="reviewDialogVisible"
        title="提交服务评价"
        width="560px"
        :close-on-click-modal="!reviewSubmitting"
        :close-on-press-escape="!reviewSubmitting"
        @closed="resetReviewDialog"
      >
        <el-form label-position="top">
          <el-form-item label="综合评分" required>
            <el-rate v-model="reviewForm.rating" />
          </el-form-item>

          <el-form-item label="评价标签">
            <el-select
              v-model="reviewForm.tags"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="可选择预设标签，也可直接输入"
              style="width: 100%"
            >
              <el-option
                v-for="tag in reviewPresetTags"
                :key="tag"
                :label="tag"
                :value="tag"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="文字评价">
            <el-input
              v-model="reviewForm.content"
              type="textarea"
              :rows="4"
              maxlength="1000"
              show-word-limit
              placeholder="可以补充说明服务过程、沟通感受或宠物状态"
            />
          </el-form-item>

          <el-form-item>
            <el-checkbox v-model="reviewForm.isAnonymous">匿名展示本次评价</el-checkbox>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button :disabled="reviewSubmitting" @click="reviewDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="reviewSubmitting" @click="submitReview">
            提交评价
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import type {
  CreateOrderReviewPayload,
  OrderDetailRecord,
  OrderOperatorRole,
  OrderStatus,
  OrderTimelineEventType,
  OrderTimelineRecord,
  PaymentBizType,
  PaymentStatus,
  PetServiceType,
  RefundStatus,
  RefundType,
  ServiceLogRecord,
  ServiceLogType,
} from '@rbac/api-common';

const router = useRouter();
const orderId = router.currentRoute.value.params.id as string;
const auth = useAuthStore();

const order = ref<OrderDetailRecord | null>(null);
const orderNo = ref('');
const loading = ref(false);
const reviewDialogVisible = ref(false);
const reviewSubmitting = ref(false);

const reviewPresetTags = ['准时签到', '沟通顺畅', '反馈及时', '服务细致', '宠物状态稳定', '环境整洁'];

const createEmptyReviewForm = () => ({
  rating: 5,
  tags: [] as string[],
  content: '',
  isAnonymous: false,
});

const reviewForm = reactive(createEmptyReviewForm());

const isOwnerView = computed(() => Boolean(auth.user?.id && order.value?.ownerId === auth.user.id));
const canCreateReview = computed(() =>
  Boolean(isOwnerView.value && order.value?.orderStatus === 'COMPLETED' && !order.value?.review),
);

const formatAmount = (value: unknown) => {
  if (!value) return '0.00';
  return Number(value).toFixed(2);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getRecordString = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

const getRecordNumber = (record: Record<string, unknown> | null | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const formatGeoValue = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const lat = (value as { lat?: unknown }).lat;
  const lng = (value as { lng?: unknown }).lng;
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
  }

  return null;
};

const getOrderStatusLabel = (status: OrderStatus): string => {
  const labels: Record<OrderStatus, string> = {
    PENDING_ACCEPT: '待接单',
    ACCEPTED: '已接单',
    SERVING: '服务中',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    DISPUTED: '纠纷中',
    PARTIAL_REFUNDED: '部分退款',
    REFUNDED: '全额退款',
  };
  return labels[status] || status;
};

const getOrderStatusType = (status: OrderStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<OrderStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING_ACCEPT: 'info',
    ACCEPTED: 'primary',
    SERVING: 'warning',
    COMPLETED: 'success',
    CANCELLED: 'danger',
    DISPUTED: 'danger',
    PARTIAL_REFUNDED: 'warning',
    REFUNDED: 'info',
  };
  return types[status] || 'info';
};

const getServiceTypeLabel = (type: PetServiceType): string => {
  const labels: Record<PetServiceType, string> = {
    BOARDING: '寄养',
    WALKING: '遛宠',
    FEEDING: '喂养',
    DOOR_VISIT: '上门陪伴',
  };
  return labels[type] || type;
};

const getTimelineEventLabel = (eventType: OrderTimelineEventType): string => {
  const labels: Record<OrderTimelineEventType, string> = {
    CREATED: '订单创建',
    ACCEPTED: '照料者接单',
    CHECKED_IN: '照料者签到',
    SERVICE_LOGGED: '上传服务记录',
    CHECKED_OUT: '照料者签退',
    COMPLETED: '业主确认完成',
    CANCELLED: '订单取消',
    REFUND_APPLIED: '发起退款',
    REFUND_DONE: '退款完成',
  };
  return labels[eventType] || eventType;
};

const getTimelineEventClass = (eventType: OrderTimelineEventType): string => {
  const classes: Record<OrderTimelineEventType, string> = {
    CREATED: 'pending',
    ACCEPTED: 'success',
    CHECKED_IN: 'warning',
    SERVICE_LOGGED: 'primary',
    CHECKED_OUT: 'success',
    COMPLETED: 'success',
    CANCELLED: 'error',
    REFUND_APPLIED: 'warning',
    REFUND_DONE: 'info',
  };
  return classes[eventType] || 'info';
};

const getOperatorRoleLabel = (role: OrderOperatorRole): string => {
  const labels: Record<OrderOperatorRole, string> = {
    OWNER: '宠物主人',
    CAREGIVER: '照料者',
    ADMIN: '管理员',
    SYSTEM: '系统',
  };
  return labels[role] || role;
};

const getServiceLogTypeLabel = (type: ServiceLogType): string => {
  const labels: Record<ServiceLogType, string> = {
    CHECK_IN: '签到记录',
    FEED: '喂养记录',
    WALK: '遛宠记录',
    PLAY: '陪玩记录',
    HEALTH: '健康观察',
    CHECK_OUT: '签退记录',
    NOTE: '服务备注',
  };
  return labels[type] || type;
};

const getServiceLogClass = (type: ServiceLogType): string => {
  const classes: Record<ServiceLogType, string> = {
    CHECK_IN: 'warning',
    FEED: 'primary',
    WALK: 'success',
    PLAY: 'primary',
    HEALTH: 'error',
    CHECK_OUT: 'info',
    NOTE: 'pending',
  };
  return classes[type] || 'info';
};

const getServiceLogTagType = (type: ServiceLogType): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<ServiceLogType, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    CHECK_IN: 'warning',
    FEED: 'primary',
    WALK: 'success',
    PLAY: 'primary',
    HEALTH: 'danger',
    CHECK_OUT: 'info',
    NOTE: 'info',
  };
  return types[type] || 'info';
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    PENDING: '待支付',
    PAID: '已支付',
    FAILED: '支付失败',
    CLOSED: '已关闭',
  };
  return labels[status] || status;
};

const getPaymentStatusType = (status: PaymentStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<PaymentStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING: 'info',
    PAID: 'success',
    FAILED: 'danger',
    CLOSED: 'info',
  };
  return types[status] || 'info';
};

const getPaymentStatusClass = (status: PaymentStatus): string => {
  const classes: Record<PaymentStatus, string> = {
    PENDING: 'pending',
    PAID: 'success',
    FAILED: 'error',
    CLOSED: 'info',
  };
  return classes[status] || 'info';
};

const getPaymentBizTypeLabel = (type: PaymentBizType): string => {
  const labels: Record<PaymentBizType, string> = {
    DEPOSIT: '定金',
    BALANCE: '尾款',
    ADJUSTMENT: '调整',
  };
  return labels[type] || type;
};

const getRefundStatusLabel = (status: RefundStatus): string => {
  const labels: Record<RefundStatus, string> = {
    PENDING: '处理中',
    APPROVED: '已批准',
    REJECTED: '已拒绝',
    SUCCESS: '已退款',
    FAILED: '退款失败',
  };
  return labels[status] || status;
};

const getRefundStatusType = (status: RefundStatus): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const types: Record<RefundStatus, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    PENDING: 'info',
    APPROVED: 'warning',
    REJECTED: 'danger',
    SUCCESS: 'success',
    FAILED: 'danger',
  };
  return types[status] || 'info';
};

const getRefundStatusClass = (status: RefundStatus): string => {
  const classes: Record<RefundStatus, string> = {
    PENDING: 'pending',
    APPROVED: 'warning',
    REJECTED: 'error',
    SUCCESS: 'success',
    FAILED: 'error',
  };
  return classes[status] || 'info';
};

const getRefundTypeLabel = (type: RefundType): string => {
  const labels: Record<RefundType, string> = {
    FULL: '全额退款',
    PARTIAL: '部分退款',
  };
  return labels[type] || type;
};

const getTimelineDetails = (event: OrderTimelineRecord) => {
  const details: string[] = [];
  const previousStatus = getRecordString(event.eventPayload, 'previousStatus');
  const nextStatus = getRecordString(event.eventPayload, 'nextStatus');
  const note = getRecordString(event.eventPayload, 'note');
  const happenedAt = getRecordString(event.eventPayload, 'happenedAt');
  const mediaCount = getRecordNumber(event.eventPayload, 'mediaCount');
  const geoText = formatGeoValue(event.eventPayload?.geo);

  if (previousStatus && nextStatus) {
    details.push(`状态流转：${getOrderStatusLabel(previousStatus as OrderStatus)} -> ${getOrderStatusLabel(nextStatus as OrderStatus)}`);
  }
  if (note) {
    details.push(`备注：${note}`);
  }
  if (happenedAt) {
    details.push(`业务时间：${formatDateTime(happenedAt)}`);
  }
  if (mediaCount !== null) {
    details.push(`附带媒体：${mediaCount} 个`);
  }
  if (geoText) {
    details.push(`定位坐标：${geoText}`);
  }

  return details;
};

const getServiceLogDetails = (log: ServiceLogRecord) => {
  const details: string[] = [];
  const geoText = formatGeoValue(log.geo);
  if (geoText) {
    details.push(`定位坐标：${geoText}`);
  }
  if (log.createdAt !== log.happenedAt) {
    details.push(`上传时间：${formatDateTime(log.createdAt)}`);
  }
  return details;
};

const isPreviewableImage = (url: string) => /\.(apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(
  url.split(/[?#]/)[0] ?? '',
);

const getMediaLinkLabel = (url: string, index: number) => {
  const pathSegment = url.split(/[?#]/)[0]?.split('/').pop();
  if (!pathSegment) {
    return `附件 ${index + 1}`;
  }

  try {
    return decodeURIComponent(pathSegment);
  } catch {
    return pathSegment;
  }
};

const resetReviewDialog = () => {
  Object.assign(reviewForm, createEmptyReviewForm());
};

const openReviewDialog = () => {
  resetReviewDialog();
  reviewDialogVisible.value = true;
};

const submitReview = async () => {
  if (!order.value) {
    return;
  }

  if (!reviewForm.rating) {
    ElMessage.error('请先选择评分');
    return;
  }

  reviewSubmitting.value = true;
  try {
    const payload: CreateOrderReviewPayload = {
      rating: reviewForm.rating,
      tags: reviewForm.tags,
      content: reviewForm.content.trim() || undefined,
      isAnonymous: reviewForm.isAnonymous,
    };
    const detail = await api.petpal.orders.review(order.value.id, payload);
    order.value = detail;
    orderNo.value = detail.orderNo;
    reviewDialogVisible.value = false;
    ElMessage.success('评价已提交');
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '提交评价失败'));
  } finally {
    reviewSubmitting.value = false;
  }
};

const reload = async () => {
  loading.value = true;
  try {
    const detail = await api.petpal.orders.detail(orderId);
    order.value = detail;
    orderNo.value = detail.orderNo;
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '加载订单详情失败'));
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.back();
};

onMounted(() => {
  reload();
});
</script>

<style scoped>
.petpal-order-detail {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: 2rem;
}

.petpal-order-detail__content {
  display: grid;
  gap: 2rem;
}

.petpal-order-info,
.petpal-amounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.petpal-order-info__item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.petpal-order-info__label {
  font-size: 0.875rem;
  color: #999;
  font-weight: 500;
}

.petpal-order-info__value {
  font-size: 1rem;
  color: #333;
}

.petpal-amount-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f9f9f9;
  border-radius: 4px;
}

.petpal-amount-item__label {
  font-size: 0.875rem;
  color: #999;
  font-weight: 500;
}

.petpal-amount-item__value {
  font-size: 1.3rem;
  font-weight: 600;
  color: #333;
}

.petpal-amount-item__value--paid {
  color: #52c41a;
}

.petpal-timeline {
  position: relative;
  padding: 1rem 0;
}

.petpal-timeline__item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-left: 2px solid #e4e4e4;
  margin-left: 10px;
  position: relative;
}

.petpal-timeline__dot {
  position: absolute;
  left: -8px;
  top: 18px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e4e4e4;
  border: 2px solid #fff;
}

.petpal-timeline__dot.is-success {
  background: #52c41a;
}

.petpal-timeline__dot.is-pending {
  background: #1890ff;
}

.petpal-timeline__dot.is-error {
  background: #ff4d4f;
}

.petpal-timeline__dot.is-warning {
  background: #faad14;
}

.petpal-timeline__content {
  flex: 1;
  min-width: 0;
}

.petpal-timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.petpal-timeline__header h4 {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.petpal-timeline__label {
  display: flex;
}

.petpal-timeline__meta {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.petpal-timeline__meta-item {
  font-size: 0.875rem;
  color: #666;
}

.petpal-timeline__detail {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #555;
  line-height: 1.6;
}

.petpal-timeline__note {
  margin: 0.75rem 0 0;
  padding: 0.75rem 0.875rem;
  border-radius: 8px;
  background: #f6f8fb;
  color: #333;
  line-height: 1.6;
}

.petpal-service-log-media {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 0.875rem;
}

.petpal-service-log-media__item {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid #e5ebf3;
  border-radius: 12px;
  background: #fff;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.petpal-service-log-media__item:hover {
  border-color: #91caff;
  box-shadow: 0 10px 24px rgba(24, 144, 255, 0.12);
  transform: translateY(-1px);
}

.petpal-service-log-media__item img,
.petpal-service-log-media__file {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 10px;
}

.petpal-service-log-media__item img {
  object-fit: cover;
  background: #eef4fb;
}

.petpal-service-log-media__file {
  display: grid;
  place-items: center;
  padding: 12px;
  background: linear-gradient(135deg, #f6f8fb 0%, #edf4ff 100%);
  color: #2f4668;
  font-size: 0.875rem;
  text-align: center;
  word-break: break-word;
}

.petpal-service-log-media__meta {
  font-size: 0.75rem;
  color: #6b7280;
}

.petpal-review-card__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-review-card__headline h3 {
  margin: 0;
  color: #333;
}

.petpal-review-card__headline p {
  margin: 0.5rem 0 0;
  color: #666;
  line-height: 1.6;
}

.petpal-review-card__body {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.petpal-review-card__meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  color: #666;
  font-size: 0.875rem;
}

.petpal-review-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.petpal-review-card__content {
  margin: 0;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #f6f8fb;
  color: #333;
  line-height: 1.7;
}

.petpal-review-card__empty-text {
  padding: 0.875rem 1rem;
  border-radius: 10px;
  background: #fafafa;
  color: #666;
}

.petpal-empty {
  padding: 2rem;
  text-align: center;
  color: #999;
}
</style>
