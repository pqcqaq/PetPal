<!--
UX Blueprint
User: 主人端查看订单相关结果页
Entry: 支付、退款、投诉、评价完成后的结果承接页
First screen: 结果、阶段、下一步动作
Primary action: 直接进入当前订单最相关的下一步
Secondary actions: 返回订单、消息、售后、订单列表
-->
<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">{{ pageEyebrow }}</p>
      <h1>{{ headline }}</h1>
      <p class="petpal-result__summary">{{ summary }}</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="loading" @click="openPrimaryAction">{{ primaryActionLabel }}</el-button>
        <el-button :disabled="!order" @click="openContextAction">{{ contextActionLabel }}</el-button>
        <el-button @click="openOrders">订单列表</el-button>
      </div>
    </section>

    <div v-loading="loading" class="petpal-result">
      <section v-if="loadError" class="frontend-card">
        <PetPalStatePanel :eyebrow="pageEyebrow" :title="`${pageTitle}加载失败`" :description="loadError" tone="danger">
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="reload">重新加载</el-button>
            <el-button size="small" @click="openOrders">返回订单列表</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <template v-else-if="order">
        <section v-if="partialNotice" class="frontend-card">
          <PetPalStatePanel eyebrow="结果同步" title="部分结果尚未完整同步" :description="partialNotice" tone="warning">
            <template #actions>
              <el-button size="small" type="primary" :loading="loading" @click="reload">刷新</el-button>
            </template>
          </PetPalStatePanel>
        </section>

        <article class="frontend-card petpal-result__hero-card">
          <div class="petpal-result__hero-head">
            <div class="petpal-result__hero-copy">
              <div class="petpal-result__tags">
                <el-tag v-for="tag in heroTags" :key="tag.label" :type="tag.type" effect="dark">{{ tag.label }}</el-tag>
              </div>
              <h2>{{ heroTitle }}</h2>
              <p>{{ heroHint }}</p>
            </div>
            <div class="petpal-result__order-chip">
              <span>订单号</span>
              <strong>{{ order.orderNo }}</strong>
              <small>{{ getPetPalServiceTypeLabel(order.serviceType) }}</small>
            </div>
          </div>

          <div class="petpal-result__signal-grid">
            <div v-for="card in signalCards" :key="card.key" class="petpal-result__signal-card" :class="`is-${card.tone}`">
              <span>{{ card.title }}</span>
              <strong>{{ card.value }}</strong>
              <p>{{ card.hint }}</p>
            </div>
          </div>
        </article>

        <section class="petpal-result__layout">
          <article class="frontend-card petpal-result__primary-card">
            <span class="frontend-card__eyebrow">{{ detailEyebrow }}</span>
            <div class="petpal-result__section-head">
              <div>
                <h3>{{ detailTitle }}</h3>
                <p>{{ detailHint }}</p>
              </div>
              <el-button v-if="detailActionLabel" plain :type="detailActionType" @click="openDetailAction">{{ detailActionLabel }}</el-button>
            </div>

            <template v-if="mode === 'payment'">
              <div class="petpal-result__focus">
                <div>
                  <span>最近一笔</span>
                  <strong>{{ latestPayment ? latestPayment.payNo : (outstandingAmount > 0 ? '仍待支付' : '暂无支付记录') }}</strong>
                  <p>{{ latestPayment ? `${getPaymentBizTypeLabel(latestPayment.bizType)} · ¥${formatAmount(latestPayment.payAmount)}` : outstandingAmount > 0 ? `还差 ¥${formatAmount(outstandingAmount)}` : '当前没有可回看的支付流水' }}</p>
                </div>
                <el-tag :type="latestPayment ? getPaymentStatusType(latestPayment.payStatus) : (outstandingAmount > 0 ? 'warning' : 'info')">
                  {{ latestPayment ? getPaymentStatusLabel(latestPayment.payStatus) : (outstandingAmount > 0 ? '待支付' : '暂无记录') }}
                </el-tag>
              </div>
              <div v-if="sortedPayments.length > 0" class="petpal-result__list">
                <button v-for="payment in sortedPayments.slice(0, 4)" :key="payment.id" type="button" class="petpal-result__list-item" @click="openOrderDetail('overview')">
                  <div>
                    <strong>{{ payment.payNo }}</strong>
                    <p>{{ getPaymentBizTypeLabel(payment.bizType) }} · {{ formatDateTime(payment.paidAt || payment.updatedAt || payment.createdAt) }}</p>
                  </div>
                  <div class="petpal-result__list-tail">
                    <span>¥{{ formatAmount(payment.payAmount) }}</span>
                    <el-tag size="small" :type="getPaymentStatusType(payment.payStatus)">{{ getPaymentStatusLabel(payment.payStatus) }}</el-tag>
                  </div>
                </button>
              </div>
            </template>

            <template v-else-if="mode === 'refund'">
              <div class="petpal-result__stats">
                <div class="petpal-result__stat"><span>退款阶段</span><strong>{{ refundProgress ? getPetPalRefundProgressStageLabel(refundProgress.stage) : '暂无退款' }}</strong></div>
                <div class="petpal-result__stat"><span>已退金额</span><strong>¥{{ formatAmount(refundProgress?.settledRefundAmount ?? order.amountRefunded) }}</strong></div>
                <div class="petpal-result__stat"><span>可退余额</span><strong>¥{{ formatAmount(refundProgress?.refundableBalance ?? 0) }}</strong></div>
              </div>
              <div class="petpal-result__focus">
                <div>
                  <span>最新退款</span>
                  <strong>{{ latestRefund ? latestRefund.refundNo : '暂无退款记录' }}</strong>
                  <p>{{ latestRefund ? `${getRefundTypeLabel(latestRefund.refundType)} · ¥${formatAmount(latestRefund.refundAmount)}` : '退款结果会在这里继续同步' }}</p>
                </div>
                <el-tag :type="latestRefund ? getRefundStatusType(latestRefund.refundStatus) : 'info'">{{ latestRefund ? getRefundStatusLabel(latestRefund.refundStatus) : '暂无记录' }}</el-tag>
              </div>
              <div v-if="sortedRefunds.length > 0" class="petpal-result__list">
                <button v-for="refund in sortedRefunds.slice(0, 4)" :key="refund.id" type="button" class="petpal-result__list-item" @click="openOrderDetail('aftersales')">
                  <div>
                    <strong>{{ refund.refundNo }}</strong>
                    <p>{{ formatDateTime(refund.updatedAt || refund.reviewedAt || refund.createdAt) }}</p>
                  </div>
                  <div class="petpal-result__list-tail">
                    <span>¥{{ formatAmount(refund.refundAmount) }}</span>
                    <el-tag size="small" :type="getRefundStatusType(refund.refundStatus)">{{ getRefundStatusLabel(refund.refundStatus) }}</el-tag>
                  </div>
                </button>
              </div>
            </template>

            <template v-else-if="mode === 'complaint'">
              <div class="petpal-result__focus">
                <div>
                  <span>当前投诉</span>
                  <strong>{{ activeComplaint?.id || latestComplaint?.id || '暂无投诉记录' }}</strong>
                  <p>{{ activeComplaint ? `${getPetPalComplaintTypeLabel(activeComplaint.complaintType)} · ${formatDateTime(activeComplaint.createdAt)}` : latestComplaint ? `${getPetPalComplaintTypeLabel(latestComplaint.complaintType)} · ${formatDateTime(latestComplaint.createdAt)}` : canCreateComplaint ? '可以直接补充投诉说明' : '当前没有可回看的投诉结果' }}</p>
                </div>
                <el-tag :type="complaintTagType">{{ complaintTagLabel }}</el-tag>
              </div>
              <div v-if="sortedComplaints.length > 0" class="petpal-result__complaints">
                <button v-for="complaint in sortedComplaints.slice(0, 3)" :key="complaint.id" type="button" class="petpal-result__complaint-item" @click="openOrderDetail('aftersales')">
                  <div class="petpal-result__complaint-head">
                    <strong>{{ getPetPalComplaintTypeLabel(complaint.complaintType) }}</strong>
                    <el-tag size="small" :type="getPetPalComplaintStatusType(complaint.status)">{{ getPetPalComplaintStatusLabel(complaint.status) }}</el-tag>
                  </div>
                  <p>{{ complaint.description }}</p>
                  <small>{{ complaint.processLogs[0] ? `${getComplaintActionLabel(complaint.processLogs[0].actionType)} · ${formatDateTime(complaint.processLogs[0].createdAt)}` : formatDateTime(complaint.createdAt) }}</small>
                </button>
              </div>
            </template>

            <template v-else>
              <div class="petpal-result__focus">
                <div>
                  <span>评分结果</span>
                  <strong>{{ order.review ? `${order.review.rating} / 5` : (canCreateReview ? '待评价' : '暂无评价') }}</strong>
                  <p>{{ order.review ? `${order.review.isAnonymous ? '匿名评价' : '实名评价'} · ${formatDateTime(order.review.createdAt)}` : canCreateReview ? '现在可以直接补充本次服务评价' : '当前没有可回看的评价结果' }}</p>
                </div>
                <el-tag :type="order.review ? 'success' : (canCreateReview ? 'warning' : 'info')">{{ order.review ? '已评价' : (canCreateReview ? '待评价' : '暂无记录') }}</el-tag>
              </div>
              <template v-if="order.review">
                <el-rate :model-value="order.review.rating" disabled show-score text-color="#c2410c" />
                <div v-if="order.review.tags.length > 0" class="petpal-result__tags-inline">
                  <el-tag v-for="tag in order.review.tags" :key="tag" size="small" effect="plain">{{ tag }}</el-tag>
                </div>
                <p v-if="order.review.content" class="petpal-result__note">{{ order.review.content }}</p>
              </template>
            </template>
          </article>

          <aside class="frontend-card petpal-result__aside">
            <span class="frontend-card__eyebrow">订单状态</span>
            <h3>{{ order.orderNo }}</h3>
            <div class="petpal-result__meta-grid">
              <div class="petpal-result__meta-item"><span>订单阶段</span><strong>{{ getPetPalOrderStatusLabel(order.orderStatus) }}</strong></div>
              <div class="petpal-result__meta-item"><span>服务时间</span><strong>{{ formatRange(order.appointmentStart, order.appointmentEnd) }}</strong></div>
              <div class="petpal-result__meta-item"><span>实付金额</span><strong>¥{{ formatAmount(order.amountPaid) }}</strong></div>
              <div class="petpal-result__meta-item"><span>已退款</span><strong>¥{{ formatAmount(order.amountRefunded) }}</strong></div>
              <div class="petpal-result__meta-item"><span>未读沟通</span><strong>{{ unreadCount > 0 ? `${unreadCount} 条` : '已读' }}</strong></div>
              <div class="petpal-result__meta-item"><span>售后状态</span><strong>{{ aftersalesSummary }}</strong></div>
            </div>
            <div class="petpal-result__quick-actions">
              <el-button @click="openOrderDetail('overview')">订单总览</el-button>
              <el-button @click="openOrderDetail('chat')">沟通</el-button>
              <el-button @click="openOrderDetail('service')">履约</el-button>
              <el-button @click="openOrderDetail('aftersales')">售后</el-button>
            </div>
          </aside>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import type {
  ComplaintActionType,
  ComplaintRecord,
  OrderDetailRecord,
  OrderRefundProgressRecord,
  PaymentBizType,
  PaymentStatus,
  RefundStatus,
  RefundType,
} from '@rbac/api-common';
import PetPalStatePanel from './PetPalStatePanel.vue';
import {
  getPetPalComplaintStatusLabel,
  getPetPalComplaintStatusType,
  getPetPalComplaintTypeLabel,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalRefundProgressStageHint,
  getPetPalRefundProgressStageLabel,
  getPetPalRefundProgressStageType,
  getPetPalServiceTypeLabel,
} from './shared';

type ResultMode = 'payment' | 'refund' | 'complaint' | 'review';
type DetailTab = 'overview' | 'chat' | 'service' | 'aftersales';
type Tone = 'primary' | 'success' | 'warning' | 'info' | 'danger';

interface SignalCard {
  key: string;
  title: string;
  value: string;
  hint: string;
  tone: Tone;
}

const props = defineProps<{ mode: ResultMode }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const order = ref<OrderDetailRecord | null>(null);
const complaints = ref<ComplaintRecord[]>([]);
const refundProgress = ref<OrderRefundProgressRecord | null>(null);
const loading = ref(false);
const loadError = ref('');
const partialNotice = ref('');

const orderId = computed(() => String(route.params.id ?? ''));
const isOwnerView = computed(() => Boolean(auth.user?.id && order.value?.ownerId === auth.user.id));
const unreadCount = computed(() => getPetPalConversationUnreadCount(order.value?.conversation, 'owner'));
const totalAmount = computed(() => order.value ? Number(order.value.amountTotal) + Number(order.value.amountAdjusted) : 0);
const outstandingAmount = computed(() => order.value ? Number(Math.max(0, totalAmount.value - Number(order.value.amountPaid)).toFixed(2)) : 0);
const sortedPayments = computed(() => order.value ? [...order.value.payments].sort((left, right) => getSortTime(right) - getSortTime(left)) : []);
const latestPayment = computed(() => sortedPayments.value[0] ?? null);
const sortedRefunds = computed(() => order.value ? [...order.value.refunds].sort((left, right) => getSortTime(right) - getSortTime(left)) : []);
const latestRefund = computed(() => sortedRefunds.value[0] ?? null);
const sortedComplaints = computed(() => [...complaints.value].sort((left, right) => getSortTime(right) - getSortTime(left)));
const latestComplaint = computed(() => sortedComplaints.value[0] ?? null);
const activeComplaint = computed(() => sortedComplaints.value.find(item => item.status === 'OPEN' || item.status === 'PROCESSING') ?? null);
const hasRefundTracking = computed(() => Boolean((refundProgress.value && refundProgress.value.stage !== 'NONE') || order.value?.refunds.length));
const canCreateReview = computed(() => Boolean(isOwnerView.value && order.value && order.value.orderStatus === 'COMPLETED' && !order.value.review));
const canCreateComplaint = computed(() => Boolean(
  isOwnerView.value
  && order.value
  && ['SERVING', 'COMPLETED', 'PARTIAL_REFUNDED', 'REFUNDED', 'DISPUTED'].includes(order.value.orderStatus)
  && !activeComplaint.value,
));

const pageTitle = computed(() => ({
  payment: '支付结果',
  refund: '退款结果',
  complaint: '投诉结果',
  review: '评价结果',
}[props.mode]));

const pageEyebrow = computed(() => ({
  payment: '支付工作台',
  refund: '退款工作台',
  complaint: '投诉工作台',
  review: '评价工作台',
}[props.mode]));

const headline = computed(() => {
  if (!order.value) return `正在同步${pageTitle.value}`;
  if (props.mode === 'payment') return outstandingAmount.value > 0 ? `仍待支付 ¥${formatAmount(outstandingAmount.value)}` : '支付已经到账';
  if (props.mode === 'refund') return refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : '暂无退款进度';
  if (props.mode === 'complaint') return activeComplaint.value ? getPetPalComplaintStatusLabel(activeComplaint.value.status) : latestComplaint.value ? getPetPalComplaintStatusLabel(latestComplaint.value.status) : canCreateComplaint.value ? '可以发起投诉' : '暂无投诉记录';
  return order.value.review ? `${order.value.review.rating} / 5 分` : canCreateReview.value ? '还没有评价' : '暂无评价记录';
});

const summary = computed(() => {
  if (!order.value) return '正在同步这笔订单的结果状态。';
  if (props.mode === 'payment') return outstandingAmount.value > 0 ? '这笔订单还没付完，先回订单确认金额。' : canCreateReview.value ? '订单已经完成，下一步直接去写评价。' : hasRefundTracking.value || activeComplaint.value ? '这单还有售后事项，先继续跟进。' : '支付结果已经同步，继续进入订单下一步。';
  if (props.mode === 'refund') return refundProgress.value ? getPetPalRefundProgressStageHint(refundProgress.value.stage) : '当前没有退款记录。';
  if (props.mode === 'complaint') return activeComplaint.value ? '当前投诉仍在处理中，优先看售后进度和平台处理日志。' : latestComplaint.value ? '投诉记录已经归档，可继续回看结论。' : canCreateComplaint.value ? '如需补充说明，可直接回订单提交投诉。' : '当前没有可回看的投诉结果。';
  return order.value.review ? hasRefundTracking.value || activeComplaint.value ? '评价已经提交，但这单还有售后事项，优先处理售后。' : '评价已经提交，可以直接回订单继续查看。' : canCreateReview.value ? '订单已经完成，现在可以直接补上评价。' : '当前没有可回看的评价结果。';
});

const heroTitle = computed(() => {
  if (!order.value) return pageTitle.value;
  if (props.mode === 'payment') return outstandingAmount.value > 0 ? '先处理未支付金额' : '付款已经完成';
  if (props.mode === 'refund') return refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : '先看退款状态';
  if (props.mode === 'complaint') return activeComplaint.value ? '投诉处理中' : latestComplaint.value ? '投诉结果已同步' : '投诉入口';
  return order.value.review ? '评价结果已同步' : '评价入口';
});

const heroHint = computed(() => {
  if (!order.value) return '正在同步这笔订单的最新结果。';
  if (props.mode === 'payment') return outstandingAmount.value > 0 ? `还差 ¥${formatAmount(outstandingAmount.value)}，回订单即可继续跟进。` : `当前订单状态：${getPetPalOrderStatusLabel(order.value.orderStatus)}。`;
  if (props.mode === 'refund') return refundProgress.value ? getPetPalRefundProgressStageHint(refundProgress.value.stage) : '退款结果会在这里继续更新。';
  if (props.mode === 'complaint') return activeComplaint.value?.resultSummary || latestComplaint.value?.resultSummary || '售后说明和证据提交后，会先回到这里确认结果。';
  return order.value.review?.content?.trim() || '完成服务后，先在这里确认评价是否已经提交。';
});

const heroTags = computed(() => {
  if (!order.value) return [];
  const tags: Array<{ label: string; type: Tone }> = [
    { label: getPetPalServiceTypeLabel(order.value.serviceType), type: 'primary' },
    { label: getPetPalOrderStatusLabel(order.value.orderStatus), type: 'info' },
  ];
  if (props.mode === 'payment') tags.unshift({ label: outstandingAmount.value > 0 ? '仍待支付' : '支付完成', type: outstandingAmount.value > 0 ? 'warning' : 'success' });
  if (props.mode === 'refund' && refundProgress.value) tags.unshift({ label: getPetPalRefundProgressStageLabel(refundProgress.value.stage), type: getPetPalRefundProgressStageType(refundProgress.value.stage) });
  if (props.mode === 'complaint' && (activeComplaint.value || latestComplaint.value)) {
    const complaint = activeComplaint.value ?? latestComplaint.value;
    if (complaint) tags.unshift({ label: getPetPalComplaintStatusLabel(complaint.status), type: getPetPalComplaintStatusType(complaint.status) });
  }
  if (props.mode === 'review') tags.unshift({ label: order.value.review ? '已评价' : canCreateReview.value ? '待评价' : '暂无评价', type: order.value.review ? 'success' : canCreateReview.value ? 'warning' : 'info' });
  if (unreadCount.value > 0) tags.push({ label: `${unreadCount.value} 条未读`, type: 'warning' });
  return tags;
});

const signalCards = computed<SignalCard[]>(() => {
  if (!order.value) return [];
  if (props.mode === 'payment') {
    return [
      { key: 'payment', title: '支付', value: outstandingAmount.value > 0 ? `待补 ¥${formatAmount(outstandingAmount.value)}` : `已付 ¥${formatAmount(order.value.amountPaid)}`, hint: latestPayment.value ? `${getPaymentStatusLabel(latestPayment.value.payStatus)} · ${formatDateTime(latestPayment.value.paidAt || latestPayment.value.updatedAt || latestPayment.value.createdAt)}` : '当前没有可回看的支付记录', tone: outstandingAmount.value > 0 ? 'warning' : 'success' },
      { key: 'stage', title: '订单阶段', value: getPetPalOrderStatusLabel(order.value.orderStatus), hint: formatRange(order.value.appointmentStart, order.value.appointmentEnd), tone: 'primary' },
      { key: 'follow', title: '继续处理', value: unreadCount.value > 0 ? `${unreadCount.value} 条未读` : hasRefundTracking.value ? '售后跟进' : '回订单', hint: unreadCount.value > 0 ? '先去看沟通' : '直接进入订单下一步', tone: unreadCount.value > 0 ? 'warning' : 'info' },
    ];
  }
  if (props.mode === 'refund') {
    return [
      { key: 'refund', title: '退款阶段', value: refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : '暂无退款', hint: refundProgress.value ? getPetPalRefundProgressStageHint(refundProgress.value.stage) : '当前没有退款记录', tone: refundProgress.value ? getPetPalRefundProgressStageType(refundProgress.value.stage) : 'info' },
      { key: 'amount', title: '已退金额', value: `¥${formatAmount(refundProgress.value?.settledRefundAmount ?? order.value.amountRefunded)}`, hint: `可退余额 ¥${formatAmount(refundProgress.value?.refundableBalance ?? 0)}`, tone: Number(order.value.amountRefunded) > 0 ? 'success' : 'info' },
      { key: 'link', title: '售后联动', value: activeComplaint.value ? '有进行中投诉' : '仅退款跟进', hint: activeComplaint.value ? '建议一并查看投诉处理结果' : '可直接回售后继续跟进', tone: activeComplaint.value ? 'warning' : 'primary' },
    ];
  }
  if (props.mode === 'complaint') {
    const complaint = activeComplaint.value ?? latestComplaint.value;
    return [
      { key: 'complaint', title: '投诉状态', value: complaint ? getPetPalComplaintStatusLabel(complaint.status) : canCreateComplaint.value ? '可发起' : '暂无记录', hint: complaint?.resultSummary || '平台处理日志会继续同步到这里', tone: complaint ? getPetPalComplaintStatusType(complaint.status) : canCreateComplaint.value ? 'warning' : 'info' },
      { key: 'refund', title: '退款联动', value: refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : '暂无退款', hint: refundProgress.value ? `已退 ¥${formatAmount(refundProgress.value.settledRefundAmount)}` : '没有退款记录时可直接回订单补充说明', tone: refundProgress.value ? getPetPalRefundProgressStageType(refundProgress.value.stage) : 'info' },
      { key: 'message', title: '沟通', value: unreadCount.value > 0 ? `${unreadCount.value} 条未读` : '已读', hint: unreadCount.value > 0 ? '先确认沟通再决定是否补充证据' : '可直接返回售后继续跟进', tone: unreadCount.value > 0 ? 'warning' : 'info' },
    ];
  }
  return [
    { key: 'review', title: '评价', value: order.value.review ? `${order.value.review.rating} / 5 分` : canCreateReview.value ? '待提交' : '暂无记录', hint: order.value.review ? `${order.value.review.isAnonymous ? '匿名评价' : '实名评价'} · ${order.value.review.tags.length} 个标签` : '订单完成后可提交一次评价', tone: order.value.review ? 'success' : canCreateReview.value ? 'warning' : 'info' },
    { key: 'stage', title: '订单阶段', value: getPetPalOrderStatusLabel(order.value.orderStatus), hint: hasRefundTracking.value || activeComplaint.value ? '这单还有售后事项' : '当前没有额外售后事项', tone: hasRefundTracking.value || activeComplaint.value ? 'warning' : 'primary' },
    { key: 'follow', title: '继续处理', value: unreadCount.value > 0 ? `${unreadCount.value} 条未读` : hasRefundTracking.value || activeComplaint.value ? '售后跟进' : '回订单', hint: unreadCount.value > 0 ? '先去看沟通' : '继续返回订单处理', tone: unreadCount.value > 0 ? 'warning' : 'info' },
  ];
});

const primaryActionLabel = computed(() => {
  if (!order.value) return '返回订单列表';
  if (props.mode === 'payment') return outstandingAmount.value > 0 ? '回订单处理金额' : canCreateReview.value ? '去写评价' : hasRefundTracking.value || activeComplaint.value ? '查看售后' : unreadCount.value > 0 ? '看沟通' : '返回订单';
  if (props.mode === 'refund') return activeComplaint.value ? '查看投诉处理' : '查看售后';
  if (props.mode === 'complaint') return activeComplaint.value || latestComplaint.value ? '查看售后' : canCreateComplaint.value ? '补充投诉' : '返回订单';
  return canCreateReview.value ? '去写评价' : hasRefundTracking.value || activeComplaint.value ? '查看售后' : unreadCount.value > 0 ? '看沟通' : '返回订单';
});

const contextActionLabel = computed(() => {
  if (!order.value) return '订单列表';
  if (props.mode === 'refund' || props.mode === 'complaint') return '售后中心';
  if (props.mode === 'review' && !order.value.review && canCreateReview.value) return '评价入口';
  return '订单总览';
});

const detailEyebrow = computed(() => ({ payment: '支付详情', refund: '退款详情', complaint: '投诉详情', review: '评价详情' }[props.mode]));
const detailTitle = computed(() => {
  if (!order.value) return pageTitle.value;
  if (props.mode === 'payment') return latestPayment.value ? '最近支付记录' : '支付状态';
  if (props.mode === 'refund') return latestRefund.value ? '退款进度' : '退款状态';
  if (props.mode === 'complaint') return latestComplaint.value ? '投诉处理记录' : '投诉入口';
  return order.value.review ? '评价内容' : '评价入口';
});
const detailHint = computed(() => props.mode === 'payment' ? '支付流水会在这里回看，不用再回长订单页里找。' : props.mode === 'refund' ? '退款阶段、金额和最新记录都集中在这里。' : props.mode === 'complaint' ? '投诉进度、结论和最近处理动作集中在这里。' : '评分、标签和文字反馈集中在这里。');
const detailActionLabel = computed(() => {
  if (!order.value) return '';
  if (props.mode === 'refund') return '去售后页';
  if (props.mode === 'complaint') return latestComplaint.value || activeComplaint.value ? '查看售后' : canCreateComplaint.value ? '发起投诉' : '';
  if (props.mode === 'review') return order.value.review ? '返回订单' : canCreateReview.value ? '去写评价' : '';
  return '订单总览';
});
const detailActionType = computed<Tone>(() => props.mode === 'complaint' ? activeComplaint.value ? 'warning' : 'danger' : props.mode === 'refund' ? 'warning' : props.mode === 'review' ? order.value?.review ? 'success' : 'primary' : 'primary');
const complaintTagLabel = computed(() => activeComplaint.value ? getPetPalComplaintStatusLabel(activeComplaint.value.status) : latestComplaint.value ? getPetPalComplaintStatusLabel(latestComplaint.value.status) : canCreateComplaint.value ? '可发起' : '暂无记录');
const complaintTagType = computed<Tone>(() => activeComplaint.value ? getPetPalComplaintStatusType(activeComplaint.value.status) : latestComplaint.value ? getPetPalComplaintStatusType(latestComplaint.value.status) : canCreateComplaint.value ? 'warning' : 'info');
const aftersalesSummary = computed(() => activeComplaint.value ? '投诉处理中' : refundProgress.value ? getPetPalRefundProgressStageLabel(refundProgress.value.stage) : hasRefundTracking.value ? '退款处理中' : '暂无售后');

const reload = async () => {
  if (!orderId.value) {
    loadError.value = '缺少订单编号';
    return;
  }

  loading.value = true;
  loadError.value = '';
  partialNotice.value = '';

  try {
    const detail = await api.petpal.orders.detail(orderId.value);
    order.value = detail;

    if (auth.user?.id && detail.ownerId === auth.user.id) {
      const notices: string[] = [];
      const [complaintsResult, refundResult] = await Promise.allSettled([
        api.petpal.orders.complaints(orderId.value),
        api.petpal.orders.refundProgress(orderId.value),
      ]);

      if (complaintsResult.status === 'fulfilled') {
        complaints.value = complaintsResult.value;
      } else {
        complaints.value = [];
        notices.push('投诉进度未完整同步');
      }

      if (refundResult.status === 'fulfilled') {
        refundProgress.value = refundResult.value;
      } else {
        refundProgress.value = null;
        notices.push('退款进度未完整同步');
      }

      partialNotice.value = notices.join('，');
    } else {
      complaints.value = [];
      refundProgress.value = null;
    }
  } catch (error) {
    order.value = null;
    complaints.value = [];
    refundProgress.value = null;
    loadError.value = getErrorMessage(error, `${pageTitle.value}加载失败`);
  } finally {
    loading.value = false;
  }
};

const openOrders = () => {
  router.push({ name: 'frontend-petpal' });
};

const openOrderDetail = (tab: DetailTab = 'overview', extraQuery: Record<string, string> = {}) => {
  if (!order.value) return;
  router.push({ name: 'frontend-petpal-order-detail', params: { id: order.value.id }, query: { tab, ...extraQuery } });
};

const openAftersales = () => {
  router.push({ name: 'frontend-petpal-aftersales' });
};

const openReviewComposer = () => {
  openOrderDetail('overview', { action: 'review' });
};

const openComplaintComposer = () => {
  openOrderDetail('aftersales', { action: 'complaint' });
};

const openPrimaryAction = () => {
  if (!order.value) {
    openOrders();
    return;
  }
  if (props.mode === 'payment') {
    if (outstandingAmount.value > 0) return openOrderDetail('overview');
    if (canCreateReview.value) return openReviewComposer();
    if (hasRefundTracking.value || activeComplaint.value) return openOrderDetail('aftersales');
    if (unreadCount.value > 0) return openOrderDetail('chat');
    if (order.value.orderStatus === 'ACCEPTED' || order.value.orderStatus === 'SERVING') return openOrderDetail('service');
    return openOrderDetail('overview');
  }
  if (props.mode === 'refund') return openOrderDetail('aftersales');
  if (props.mode === 'complaint') {
    if (activeComplaint.value || latestComplaint.value) return openOrderDetail('aftersales');
    if (canCreateComplaint.value) return openComplaintComposer();
    return openOrderDetail('overview');
  }
  if (canCreateReview.value) return openReviewComposer();
  if (hasRefundTracking.value || activeComplaint.value) return openOrderDetail('aftersales');
  if (unreadCount.value > 0) return openOrderDetail('chat');
  return openOrderDetail('overview');
};

const openContextAction = () => {
  if (!order.value) return openOrders();
  if (props.mode === 'refund' || props.mode === 'complaint') return openAftersales();
  if (props.mode === 'review' && !order.value.review && canCreateReview.value) return openReviewComposer();
  return openOrderDetail('overview');
};

const openDetailAction = () => {
  if (props.mode === 'refund') return openAftersales();
  if (props.mode === 'complaint') return latestComplaint.value || activeComplaint.value ? openOrderDetail('aftersales') : canCreateComplaint.value ? openComplaintComposer() : undefined;
  if (props.mode === 'review') return order.value?.review ? openOrderDetail('overview') : canCreateReview.value ? openReviewComposer() : undefined;
  return openOrderDetail('overview');
};

onMounted(() => {
  void reload();
});

function getPaymentStatusLabel(status: PaymentStatus) {
  return ({ PENDING: '待支付', PAID: '已支付', FAILED: '支付失败', CLOSED: '已关闭' }[status] ?? status);
}

function getPaymentStatusType(status: PaymentStatus): Tone {
  const map: Record<PaymentStatus, Tone> = {
    PENDING: 'warning',
    PAID: 'success',
    FAILED: 'danger',
    CLOSED: 'info',
  };
  return map[status] ?? 'info';
}

function getPaymentBizTypeLabel(type: PaymentBizType) {
  return ({ DEPOSIT: '定金', BALANCE: '尾款', ADJUSTMENT: '调整' }[type] ?? type);
}

function getRefundStatusLabel(status: RefundStatus) {
  return ({ PENDING: '处理中', APPROVED: '已批准', REJECTED: '已拒绝', SUCCESS: '已退款', FAILED: '退款失败' }[status] ?? status);
}

function getRefundStatusType(status: RefundStatus): Tone {
  const map: Record<RefundStatus, Tone> = {
    PENDING: 'warning',
    APPROVED: 'primary',
    REJECTED: 'danger',
    SUCCESS: 'success',
    FAILED: 'danger',
  };
  return map[status] ?? 'info';
}

function getRefundTypeLabel(type: RefundType) {
  return ({ FULL: '全额退款', PARTIAL: '部分退款' }[type] ?? type);
}

function getComplaintActionLabel(actionType: ComplaintActionType) {
  return ({ OPEN: '已提交投诉', ASSIGN: '已分配处理人', INVESTIGATE: '调查核实', CALL_USER: '联系用户', PENALTY: '处罚处理', CLOSE: '投诉结案' }[actionType] ?? actionType);
}

function getSortTime(record: { updatedAt?: string | null; paidAt?: string | null; reviewedAt?: string | null; createdAt?: string | null }) {
  const value = record.paidAt || record.updatedAt || record.reviewedAt || record.createdAt || '';
  return value ? new Date(value).getTime() : 0;
}

function formatAmount(value: unknown) {
  if (value === null || value === undefined || value === '') return '0.00';
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatRange(start: string, end: string) {
  return `${formatDateTime(start)} 至 ${formatDateTime(end)}`;
}
</script>

<style scoped>
.petpal-result {
  display: grid;
  gap: 1.5rem;
}

.petpal-result__summary {
  max-width: 42rem;
  margin: 0.75rem 0 0;
  color: #475467;
  line-height: 1.7;
}

.petpal-result__hero-card,
.petpal-result__primary-card,
.petpal-result__aside,
.petpal-result__order-chip,
.petpal-result__signal-card,
.petpal-result__stat,
.petpal-result__meta-item {
  display: grid;
  gap: 0.75rem;
}

.petpal-result__hero-head,
.petpal-result__section-head,
.petpal-result__focus,
.petpal-result__list-item,
.petpal-result__complaint-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-result__hero-copy h2,
.petpal-result__section-head h3 {
  margin: 0;
  color: #1f2937;
}

.petpal-result__hero-copy p,
.petpal-result__section-head p,
.petpal-result__signal-card p,
.petpal-result__focus p,
.petpal-result__list-item p,
.petpal-result__complaint-item p {
  margin: 0.5rem 0 0;
  color: #526071;
  line-height: 1.65;
}

.petpal-result__order-chip,
.petpal-result__signal-card,
.petpal-result__stat,
.petpal-result__meta-item,
.petpal-result__focus {
  padding: 1rem 1.125rem;
  border-radius: 18px;
  border: 1px solid #dde7f5;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}

.petpal-result__order-chip span,
.petpal-result__signal-card span,
.petpal-result__stat span,
.petpal-result__meta-item span,
.petpal-result__focus span {
  font-size: 0.875rem;
  color: #667085;
}

.petpal-result__tags,
.petpal-result__tags-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.petpal-result__signal-grid,
.petpal-result__stats,
.petpal-result__meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.875rem;
}

.petpal-result__signal-card.is-success {
  background: linear-gradient(180deg, #f4fff8 0%, #ebfff2 100%);
  border-color: #b7e4c7;
}

.petpal-result__signal-card.is-warning {
  background: linear-gradient(180deg, #fffdf4 0%, #fff6db 100%);
  border-color: #f3d58c;
}

.petpal-result__signal-card.is-danger {
  background: linear-gradient(180deg, #fff7f7 0%, #ffe5e5 100%);
  border-color: #f5b7b7;
}

.petpal-result__signal-card.is-primary {
  background: linear-gradient(180deg, #f6fbff 0%, #ecf5ff 100%);
  border-color: #c6dcff;
}

.petpal-result__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
  gap: 1.5rem;
  align-items: start;
}

.petpal-result__list,
.petpal-result__complaints,
.petpal-result__quick-actions {
  display: grid;
  gap: 0.75rem;
}

.petpal-result__list-item,
.petpal-result__complaint-item {
  width: 100%;
  border: 1px solid #e6edf7;
  border-radius: 16px;
  background: #fff;
  padding: 1rem 1.125rem;
  text-align: left;
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.petpal-result__list-item:hover,
.petpal-result__complaint-item:hover {
  transform: translateY(-1px);
  border-color: #b7cff5;
  box-shadow: 0 14px 28px rgba(31, 41, 55, 0.08);
}

.petpal-result__list-tail {
  display: grid;
  justify-items: end;
  gap: 0.375rem;
}

.petpal-result__complaint-item small {
  display: block;
  margin-top: 0.75rem;
  color: #667085;
}

.petpal-result__note {
  margin: 0;
  padding: 1rem 1.125rem;
  border-radius: 16px;
  background: #f8fafc;
  color: #334155;
  line-height: 1.7;
}

@media (max-width: 1024px) {
  .petpal-result__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .petpal-result__hero-head,
  .petpal-result__focus,
  .petpal-result__list-item {
    flex-direction: column;
    align-items: stretch;
  }

  .petpal-result__list-tail {
    justify-items: start;
  }

  .petpal-result__signal-grid,
  .petpal-result__stats,
  .petpal-result__meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
