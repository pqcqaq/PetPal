<template>
  <PetPalDeskPage
    eyebrow="结果页"
    :title="pageTitle"
    :summary="pageSummary"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-orders"
    :actions="heroActions"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Order" title="订单摘要" description="先确认订单和当前阶段，再决定是否继续操作。">
      <PetPalDeskEmpty
        v-if="!order"
        title="订单暂时不可用"
        description="请返回订单队列重试，或稍后刷新页面。"
      />

      <div v-else class="petpal-kv-grid">
        <div class="petpal-kv">
          <span>订单号</span>
          <strong>{{ order.orderNo }}</strong>
        </div>
        <div class="petpal-kv">
          <span>订单状态</span>
          <strong>{{ getPetPalOrderStatusLabel(order.orderStatus) }}</strong>
        </div>
        <div class="petpal-kv">
          <span>服务类型</span>
          <strong>{{ getPetPalServiceTypeLabel(order.serviceType) }}</strong>
        </div>
        <div class="petpal-kv">
          <span>服务时间</span>
          <strong>{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</strong>
        </div>
      </div>
    </PetPalDeskSection>

    <PetPalDeskSection
      v-if="mode === 'payment'"
      eyebrow="Payment"
      title="支付结果与继续支付"
      description="支付动作被拆到单独结果页，避免订单详情继续膨胀。"
    >
      <PetPalDeskEmpty
        v-if="!order"
        title="订单未加载"
        description="订单加载完成后，这里会显示支付状态。"
      />

      <template v-else-if="!isPetPalOutstandingOrder(order)">
        <PetPalDeskEmpty title="这笔订单已经完成支付" description="当前不需要重复支付，可以回订单详情继续跟单。" />
      </template>

      <template v-else>
        <div class="petpal-field-grid petpal-field-grid--3">
          <div v-for="item in petPalPayChannelOptions" :key="item.value" class="petpal-pay-option" :class="{ 'is-active': payChannel === item.value }">
            <button type="button" class="petpal-pay-option__button" @click="payChannel = item.value">
              <strong>{{ item.label }}</strong>
              <span>{{ item.note }}</span>
            </button>
          </div>
        </div>
        <div class="petpal-actions">
          <el-button type="primary" :loading="paying" @click="payOrder">确认支付</el-button>
        </div>
      </template>
    </PetPalDeskSection>

    <PetPalDeskSection
      v-if="mode === 'refund'"
      eyebrow="Refund"
      title="退款结果"
      description="这里集中展示退款阶段、退款记录和导出入口。"
    >
      <PetPalDeskEmpty
        v-if="!order"
        title="订单未加载"
        description="订单加载完成后，这里会显示退款状态。"
      />

      <template v-else>
        <div class="petpal-kv-grid">
          <div class="petpal-kv">
            <span>退款阶段</span>
            <strong>{{ refundProgress ? getPetPalRefundProgressStageLabel(refundProgress.stage) : '暂无退款' }}</strong>
          </div>
          <div class="petpal-kv">
            <span>已退款金额</span>
            <strong>{{ refundProgress ? formatPetPalMoney(refundProgress.settledRefundAmount) : formatPetPalMoney(order.amountRefunded) }}</strong>
          </div>
        </div>

        <div class="petpal-actions">
          <ListExportButton :request="buildOrderRefundExportRequest" label="导出当前订单退款" pending-label="导出中" />
        </div>

        <PetPalDeskEmpty
          v-if="!order.refunds.length"
          title="当前没有退款记录"
          description="当订单进入退款链路后，具体记录会显示在这里。"
        />

        <div v-else class="petpal-sheet-list">
          <div v-for="refund in order.refunds" :key="refund.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ refund.refundNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ refund.refundType }} · {{ refund.refundStatus }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(refund.refundAmount) }} · {{ refund.refundReason }}</p>
            </div>
          </div>
        </div>
      </template>
    </PetPalDeskSection>

    <PetPalDeskSection
      v-if="mode === 'complaint'"
      eyebrow="Complaint"
      title="投诉结果与继续提交"
      description="投诉填写被拆到结果页，避免和订单详情混在一起。"
    >
      <PetPalDeskEmpty
        v-if="!order"
        title="订单未加载"
        description="订单加载完成后，这里会显示投诉记录。"
      />

      <template v-else>
        <PetPalDeskEmpty
          v-if="!complaints.length"
          title="当前没有投诉记录"
          description="如果需要发起投诉，可以直接在下方填写。"
        />

        <div v-else class="petpal-sheet-list">
          <div v-for="item in complaints" :key="item.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ getPetPalComplaintTypeLabel(item.complaintType) }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalComplaintStatusLabel(item.status) }} · {{ getPetPalComplaintTargetRoleLabel(item.targetRole) }}</p>
              <p class="petpal-sheet-row__desc">{{ item.resultSummary || item.description }}</p>
            </div>
          </div>
        </div>

        <div class="petpal-side-stack">
          <div class="petpal-field-grid">
            <el-form-item label="投诉对象">
              <el-select v-model="complaintForm.targetRole" style="width: 100%">
                <el-option v-for="item in petPalComplaintTargetOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="投诉类型">
              <el-select v-model="complaintForm.complaintType" style="width: 100%">
                <el-option v-for="item in petPalComplaintTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="投诉说明" class="petpal-span-12">
              <el-input v-model="complaintForm.description" type="textarea" :rows="4" maxlength="500" show-word-limit placeholder="请清楚描述本次争议情况" />
            </el-form-item>
            <el-form-item label="证据链接" class="petpal-span-12">
              <el-input v-model="complaintForm.evidenceUrlsText" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="可填写图片或文件链接，逗号分隔" />
            </el-form-item>
          </div>
          <div class="petpal-actions">
            <el-button type="primary" :loading="submittingComplaint" @click="submitComplaint">提交投诉</el-button>
          </div>
        </div>
      </template>
    </PetPalDeskSection>

    <PetPalDeskSection
      v-if="mode === 'review'"
      eyebrow="Review"
      title="评价结果与继续评价"
      description="评价被拆到结果页，避免和订单详情、售后动作混在一起。"
    >
      <PetPalDeskEmpty
        v-if="!order"
        title="订单未加载"
        description="订单加载完成后，这里会显示评价内容。"
      />

      <template v-else-if="order.review">
        <div class="petpal-side-stack">
          <el-rate :model-value="order.review.rating" disabled />
          <div class="petpal-pill-row">
            <span v-for="tag in order.review.tags" :key="tag" class="petpal-pill">{{ tag }}</span>
          </div>
          <p class="petpal-sheet-row__desc">{{ order.review.content || '本次评价没有填写文字说明。' }}</p>
        </div>
      </template>

      <template v-else-if="order.orderStatus === 'COMPLETED'">
        <div class="petpal-side-stack">
          <el-rate v-model="reviewForm.rating" />
          <el-checkbox-group v-model="reviewForm.tags" class="petpal-pill-row">
            <el-checkbox-button v-for="tag in petPalReviewTagOptions" :key="tag" :label="tag">{{ tag }}</el-checkbox-button>
          </el-checkbox-group>
          <el-input v-model="reviewForm.content" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="用 1-2 句话评价这次服务体验" />
          <el-checkbox v-model="reviewForm.isAnonymous">匿名展示本次评价</el-checkbox>
          <div class="petpal-actions">
            <el-button type="primary" :loading="submittingReview" @click="submitReview">提交评价</el-button>
          </div>
        </div>
      </template>

      <template v-else>
        <PetPalDeskEmpty title="订单完成后才能评价" description="当前订单尚未进入已完成状态，先回订单详情继续跟进。" />
      </template>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { ComplaintRecord, OrderDetailRecord, OrderRefundProgressRecord, OwnerPayChannel } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { buildPetPalDeskHandoffQuery, type PetPalDeskOrderFilter } from './recovery';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalComplaintStatusLabel,
  getPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalRefundProgressStageLabel,
  getPetPalServiceTypeLabel,
  isPetPalOutstandingOrder,
  normalizePetPalTagText,
  petPalComplaintTargetOptions,
  petPalComplaintTypeOptions,
  petPalOwnerWorkspaceNav,
  petPalPayChannelOptions,
  petPalReviewTagOptions,
} from './shared';

const props = defineProps<{
  mode: 'payment' | 'refund' | 'complaint' | 'review';
}>();

const route = useRoute();
const orderId = computed(() => String(route.params.id || ''));

const order = ref<OrderDetailRecord | null>(null);
const complaints = ref<ComplaintRecord[]>([]);
const refundProgress = ref<OrderRefundProgressRecord | null>(null);
const paying = ref(false);
const submittingComplaint = ref(false);
const submittingReview = ref(false);
const payChannel = ref<OwnerPayChannel>('WECHAT_PAY');

const complaintForm = reactive({
  targetRole: 'CAREGIVER' as typeof petPalComplaintTargetOptions[number]['value'],
  complaintType: 'SERVICE' as typeof petPalComplaintTypeOptions[number]['value'],
  description: '',
  evidenceUrlsText: '',
});

const reviewForm = reactive({
  rating: 5,
  tags: [] as string[],
  content: '',
  isAnonymous: false,
});

const pageTitle = computed(() => ({
  payment: '支付结果页',
  refund: '退款结果页',
  complaint: '投诉结果页',
  review: '评价结果页',
}[props.mode]));

const pageSummary = computed(() => ({
  payment: '支付动作被抽离成独立结果页，避免继续堆在订单详情里。',
  refund: '退款相关的进度、记录和导出都集中在这里。',
  complaint: '投诉记录和新投诉提交都在这里处理。',
  review: '评价查看与提交都在这里单独完成。',
}[props.mode]));

const currentOrderId = computed(() => order.value?.id || orderId.value);

const heroActions = computed(() => {
  if (!order.value) {
    return [{ label: '返回订单队列', to: { name: 'frontend-petpal-orders' }, tone: 'secondary' as const }];
  }
  const activeOrder = order.value;
  return [
    {
      label: props.mode === 'refund' || props.mode === 'complaint'
        ? '回售后中心继续跟进'
        : props.mode === 'review' && getPetPalConversationUnreadCount(activeOrder.conversation, 'owner')
          ? '回消息中心看最新沟通'
          : '回订单队列继续处理',
      to: props.mode === 'refund' || props.mode === 'complaint'
        ? {
            name: 'frontend-petpal-aftersales',
            query: buildPetPalDeskHandoffQuery({
              notice: '这笔订单仍在售后链路中，可直接继续查看退款和投诉摘要。',
              focusOrderId: activeOrder.id,
            }),
          }
        : props.mode === 'review' && getPetPalConversationUnreadCount(activeOrder.conversation, 'owner')
          ? {
              name: 'frontend-petpal-messages',
              query: buildPetPalDeskHandoffQuery({
                notice: '评价已提交，如需继续沟通可直接回到这笔订单。',
                focusOrderId: activeOrder.id,
                focusRole: 'owner',
              }),
            }
          : {
              name: 'frontend-petpal-orders',
              query: buildPetPalDeskHandoffQuery({
                notice: props.mode === 'payment'
                  ? '支付结果已更新，可继续跟进这笔订单。'
                  : '这笔订单的处理结果已更新，可继续在订单队列里跟进。',
                focusOrderId: activeOrder.id,
                focusFilter: resolveOrderFilter(activeOrder),
              }),
            },
      tone: 'secondary' as const,
    },
    {
      label: '返回订单详情',
      to: {
        name: 'frontend-petpal-order-detail',
        params: { id: activeOrder.id },
        query: buildPetPalDeskHandoffQuery({
          notice: props.mode === 'refund' || props.mode === 'complaint'
            ? '当前结果对应售后分区，可直接继续查看订单内摘要。'
            : props.mode === 'payment'
              ? '支付结果已更新，可直接回订单概览继续跟单。'
              : '评价结果已更新，可直接回订单概览继续查看状态。',
          focusOrderId: activeOrder.id,
          tab: props.mode === 'refund' || props.mode === 'complaint' ? 'aftersales' : 'summary',
        }),
      },
      tone: 'secondary' as const,
    },
  ];
});

const heroStats = computed(() => [
  { label: '当前页面', value: pageTitle.value, hint: '动作已从订单详情拆开' },
  { label: '订单状态', value: order.value ? getPetPalOrderStatusLabel(order.value.orderStatus) : '--', hint: '先确认当前阶段' },
  { label: props.mode === 'complaint' ? '投诉数' : props.mode === 'refund' ? '退款数' : props.mode === 'review' ? '评价状态' : '待支付', value: modeMetric.value, hint: modeMetricHint.value },
  { label: '下一步', value: nextStepLabel.value, hint: '结果页只负责承接后续动作' },
]);

const modeMetric = computed(() => {
  if (!order.value) {
    return '--';
  }
  if (props.mode === 'complaint') {
    return String(complaints.value.length);
  }
  if (props.mode === 'refund') {
    return String(order.value.refunds.length);
  }
  if (props.mode === 'review') {
    return order.value.review ? '已评价' : '待评价';
  }
  return isPetPalOutstandingOrder(order.value) ? '待支付' : '已支付';
});

const modeMetricHint = computed(() => {
  if (props.mode === 'complaint') {
    return '当前订单投诉记录数';
  }
  if (props.mode === 'refund') {
    return '当前订单退款记录数';
  }
  if (props.mode === 'review') {
    return '只有已完成订单才能评价';
  }
  return '根据支付状态决定是否继续付款';
});

const nextStepLabel = computed(() => {
  if (!order.value) {
    return '回订单队列';
  }
  if (props.mode === 'refund' || props.mode === 'complaint') {
    return '回售后中心';
  }
  if (props.mode === 'review' && getPetPalConversationUnreadCount(order.value.conversation, 'owner')) {
    return '回消息中心';
  }
  if (props.mode === 'payment' && isPetPalOutstandingOrder(order.value)) {
    return '继续完成支付';
  }
  return '回订单继续跟进';
});

function resolveOrderFilter(record: OrderDetailRecord): PetPalDeskOrderFilter {
  if (isPetPalOutstandingOrder(record)) {
    return 'needs_payment';
  }
  if (['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(record.orderStatus)) {
    return 'aftersales';
  }
  if (['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(record.orderStatus)) {
    return 'active';
  }
  if (record.orderStatus === 'COMPLETED') {
    return 'done';
  }
  return 'all';
}

async function loadPage() {
  if (!orderId.value) {
    return;
  }
  try {
    order.value = await api.petpal.orders.detail(orderId.value);
    const [complaintsResult, refundResult] = await Promise.allSettled([
      api.petpal.orders.complaints(orderId.value),
      api.petpal.orders.refundProgress(orderId.value),
    ]);
    complaints.value = complaintsResult.status === 'fulfilled' ? complaintsResult.value : [];
    refundProgress.value = refundResult.status === 'fulfilled' ? refundResult.value : null;
  } catch (error: unknown) {
    order.value = null;
    ElMessage.error(getErrorMessage(error, '加载结果页失败'));
  }
}

async function payOrder() {
  if (!order.value) {
    return;
  }
  paying.value = true;
  try {
    const result = await api.petpal.orders.pay(order.value.id, { payChannel: payChannel.value });
    order.value = result;
    ElMessage.success('支付已完成');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '支付失败'));
  } finally {
    paying.value = false;
  }
}

const buildOrderRefundExportRequest = () => api.petpal.orders.exportRefunds(currentOrderId.value);

async function submitComplaint() {
  if (!order.value) {
    return;
  }
  if (!complaintForm.description.trim()) {
    ElMessage.warning('请先填写投诉说明');
    return;
  }
  submittingComplaint.value = true;
  try {
    await api.petpal.orders.createComplaint(order.value.id, {
      targetRole: complaintForm.targetRole,
      complaintType: complaintForm.complaintType,
      description: complaintForm.description.trim(),
      evidenceUrls: normalizePetPalTagText(complaintForm.evidenceUrlsText),
    });
    complaintForm.description = '';
    complaintForm.evidenceUrlsText = '';
    await loadPage();
    ElMessage.success('投诉已提交');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '提交投诉失败'));
  } finally {
    submittingComplaint.value = false;
  }
}

async function submitReview() {
  if (!order.value) {
    return;
  }
  if (!reviewForm.rating) {
    ElMessage.warning('请先评分');
    return;
  }
  submittingReview.value = true;
  try {
    const result = await api.petpal.orders.review(order.value.id, {
      rating: reviewForm.rating,
      tags: reviewForm.tags,
      content: reviewForm.content.trim() || undefined,
      isAnonymous: reviewForm.isAnonymous,
    });
    order.value = result;
    ElMessage.success('评价已提交');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '提交评价失败'));
  } finally {
    submittingReview.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-pay-option {
  border: 1px solid rgba(44, 37, 29, 0.1);
}

.petpal-pay-option.is-active {
  border-color: rgba(37, 99, 235, 0.28);
}

.petpal-pay-option__button {
  width: 100%;
  display: grid;
  gap: 6px;
  padding: 14px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.petpal-pay-option__button strong {
  color: #2b241f;
}

.petpal-pay-option__button span {
  color: #675d55;
  font-size: 13px;
  line-height: 1.7;
}
</style>
