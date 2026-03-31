<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">订单详情</p>
      <h1>订单 {{ orderNo }}</h1>
      <p>查看订单状态、支付记录和退款进度</p>
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import type { OrderDetailRecord, OrderStatus, PetServiceType, PaymentStatus, RefundStatus, RefundType, PaymentBizType } from '@rbac/api-common';

const router = useRouter();
const orderId = router.currentRoute.value.params.id as string;

const order = ref<OrderDetailRecord | null>(null);
const orderNo = ref('');
const loading = ref(false);

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

const reload = async () => {
  loading.value = true;
  try {
    const detail = await api.petpal.orders.detail(orderId);
    order.value = detail;
    orderNo.value = detail.orderNo;
  } catch (err) {
    ElMessage.error('加载订单详情失败');
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

.petpal-empty {
  padding: 2rem;
  text-align: center;
  color: #999;
}
</style>
