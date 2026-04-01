<!--
UX Blueprint
User: 主人 Web 用户处理退款和投诉
Entry: 从订单详情、首页、提醒进入售后中心
First screen: 先看到哪些订单最急、为什么急
Primary action: 打开具体订单的售后详情
Secondary actions: 去消息、去订单列表
-->
<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">售后中心</p>
      <h1>宠托帮售后队列</h1>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="loading" @click="reloadAll">刷新</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          订单首页
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-reminders' }">
          提醒
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-messages' }">
          消息
        </RouterLink>
      </div>
    </section>

    <template v-if="auth.isAuthenticated">
      <template v-if="pageLoadState === 'ready'">
        <section class="frontend-page__section-grid">
          <article class="frontend-card petpal-grid-span-3">
            <span class="frontend-card__eyebrow">售后订单</span>
            <strong class="petpal-summary-value">{{ aftersalesItems.length }}</strong>
            <p class="petpal-summary-copy">直接进入处理队列。</p>
          </article>
          <article class="frontend-card petpal-grid-span-3">
            <span class="frontend-card__eyebrow">处理中退款</span>
            <strong class="petpal-summary-value">{{ refundInFlightCount }}</strong>
            <p class="petpal-summary-copy">优先处理退款异常。</p>
          </article>
          <article class="frontend-card petpal-grid-span-3">
            <span class="frontend-card__eyebrow">处理中投诉</span>
            <strong class="petpal-summary-value">{{ activeComplaintCount }}</strong>
            <p class="petpal-summary-copy">先看投诉进展。</p>
          </article>
          <article class="frontend-card petpal-grid-span-3">
            <span class="frontend-card__eyebrow">累计已退</span>
            <strong class="petpal-summary-value">¥{{ formatAmount(totalSettledRefundAmount) }}</strong>
            <p class="petpal-summary-copy">快速核对退款规模。</p>
          </article>
        </section>

        <section v-if="partialLoadNotice" class="frontend-card">
          <PetPalStatePanel
            eyebrow="加载提示"
            title="部分售后信号未完整加载"
            :description="partialLoadNotice"
            tone="warning"
          >
            <template #actions>
              <el-button size="small" type="primary" :loading="loading" @click="reloadAll">重新加载</el-button>
              <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: aftersalesItems[0]?.order.id } }">
                <el-button v-if="aftersalesItems[0]" size="small">打开最近订单</el-button>
              </RouterLink>
            </template>
          </PetPalStatePanel>
        </section>

        <section class="frontend-card">
          <span class="frontend-card__eyebrow">筛选售后</span>
          <div class="petpal-filter-toolbar">
            <el-radio-group v-model="focus" size="small">
              <el-radio-button label="ALL">全部</el-radio-button>
              <el-radio-button label="ACTIVE">处理中</el-radio-button>
              <el-radio-button label="REFUND">退款</el-radio-button>
              <el-radio-button label="COMPLAINT">投诉</el-radio-button>
              <el-radio-button label="RESOLVED">已结案</el-radio-button>
            </el-radio-group>
            <el-checkbox v-model="unresolvedOnly">仅看待跟进</el-checkbox>
            <el-input
              v-model="keyword"
              clearable
              size="small"
              maxlength="64"
              placeholder="按订单号、投诉类型或退款状态筛选"
              style="width: min(100%, 280px)"
            />
          </div>
        </section>

        <section class="frontend-card">
      <div class="petpal-section-heading">
        <div class="petpal-section-heading__meta">
          <span class="frontend-card__eyebrow">售后队列</span>
          <h3>优先处理这些订单</h3>
        </div>
        <el-tag type="warning">共 {{ filteredItems.length }} 条</el-tag>
      </div>

      <div v-if="filteredItems.length" class="petpal-aftersales-list">
        <article v-for="item in filteredItems" :key="item.order.id" class="petpal-aftersales-item">
          <div class="petpal-aftersales-item__header">
            <div class="petpal-aftersales-item__headline">
              <div class="petpal-aftersales-item__title-row">
                <h4>{{ item.order.orderNo }}</h4>
                <el-tag size="small" effect="plain">{{ getOrderStatusLabel(item.order.orderStatus) }}</el-tag>
                <el-tag size="small" :type="getPriorityTagType(item.priorityLevel)">
                  {{ getPriorityLabel(item.priorityLevel) }}
                </el-tag>
              </div>
              <p>
                {{ getServiceTypeLabel(item.order.serviceType) }} ·
                {{ formatTime(item.order.appointmentStart) }} ·
                {{ item.ownerUnreadCount ? `主人侧 ${item.ownerUnreadCount} 条未读` : '当前无未读沟通' }}
              </p>
            </div>
            <div class="petpal-aftersales-item__tags">
              <el-tag
                v-if="item.refundProgress && item.refundProgress.stage !== 'NONE'"
                size="small"
                :type="getRefundProgressStageType(item.refundProgress.stage)"
              >
                {{ getRefundProgressStageLabel(item.refundProgress.stage) }}
              </el-tag>
              <el-tag
                v-if="item.latestComplaint"
                size="small"
                :type="getComplaintStatusType(item.latestComplaint.status)"
              >
                {{ getComplaintStatusLabel(item.latestComplaint.status) }}
              </el-tag>
            </div>
          </div>

          <div class="petpal-aftersales-grid">
            <div class="petpal-aftersales-panel">
              <span class="frontend-card__eyebrow">退款进度</span>
              <template v-if="item.refundProgress">
                <strong>{{ getRefundProgressStageLabel(item.refundProgress.stage) }}</strong>
                <p>{{ getRefundProgressStageHint(item.refundProgress.stage) }}</p>
                <div class="petpal-aftersales-stats">
                  <span>申请 {{ item.refundProgress.totalRefundCount }} 笔</span>
                  <span>请求 ¥{{ formatAmount(item.refundProgress.requestedRefundAmount) }}</span>
                  <span>已退 ¥{{ formatAmount(item.refundProgress.settledRefundAmount) }}</span>
                  <span>可退 ¥{{ formatAmount(item.refundProgress.refundableBalance) }}</span>
                </div>
              </template>
              <template v-else>
                <strong>暂无退款</strong>
                <p>当前订单没有已进入售后中心的退款进度记录。</p>
              </template>
            </div>

            <div class="petpal-aftersales-panel">
              <span class="frontend-card__eyebrow">投诉处理</span>
              <template v-if="item.latestComplaint">
                <strong>{{ getComplaintTypeLabel(item.latestComplaint.complaintType) }}</strong>
                <p>
                  {{ getComplaintTargetRoleLabel(item.latestComplaint.targetRole) }} ·
                  {{ getComplaintStatusLabel(item.latestComplaint.status) }}
                </p>
                <div class="petpal-aftersales-stats">
                  <span>投诉记录 {{ item.complaints.length }} 条</span>
                  <span>活跃投诉 {{ item.activeComplaintCount }} 条</span>
                  <span>最近更新 {{ formatTime(item.latestComplaint.updatedAt) }}</span>
                </div>
                <p v-if="item.latestComplaint.resultSummary" class="petpal-aftersales-note">
                  处理结论：{{ item.latestComplaint.resultSummary }}
                </p>
              </template>
              <template v-else>
                <strong>暂无投诉</strong>
                <p>当前订单暂未产生投诉处理记录。</p>
              </template>
            </div>

            <div class="petpal-aftersales-panel">
              <span class="frontend-card__eyebrow">下一步建议</span>
              <strong>{{ getNextActionTitle(item) }}</strong>
              <p>{{ getNextActionCopy(item) }}</p>
              <div class="petpal-aftersales-stats">
                <span>最近更新 {{ formatTime(item.lastTouchedAt) }}</span>
                <span v-if="item.refundProgress?.latestRefundNo">退款单号 {{ item.refundProgress.latestRefundNo }}</span>
                <span v-if="item.latestComplaint">投诉对象 {{ getComplaintTargetRoleLabel(item.latestComplaint.targetRole) }}</span>
              </div>
            </div>
          </div>

          <div class="petpal-aftersales-actions">
            <RouterLink :to="{ name: 'frontend-petpal-order-detail', params: { id: item.order.id } }">
              <el-button type="primary" size="small">打开订单</el-button>
            </RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-messages' }">
              <el-button size="small">去消息中心</el-button>
            </RouterLink>
            <ListExportButton
              v-if="item.hasRefundHistory"
              :request="() => buildOrderRefundExportRequest(item.order.id)"
              label="导出退款明细"
              pending-label="导出中"
              error-message="导出订单退款明细失败"
            />
          </div>
        </article>
      </div>

          <PetPalStatePanel
            v-else
            eyebrow="售后队列"
            title="当前筛选下没有售后订单"
            description="可以先回到主人服务台继续跟进订单，或在提醒中心确认是否有需要优先处理的售后信号。"
          >
            <template #actions>
              <RouterLink :to="{ name: 'frontend-petpal' }">
                <el-button size="small" type="primary">去主人服务台</el-button>
              </RouterLink>
              <RouterLink :to="{ name: 'frontend-petpal-reminders' }">
                <el-button size="small">去提醒中心</el-button>
              </RouterLink>
            </template>
          </PetPalStatePanel>
        </section>
      </template>

      <section v-else-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="售后中心"
          title="主人售后中心加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="reloadAll">重试售后中心</el-button>
            <RouterLink :to="{ name: 'frontend-petpal' }">
              <el-button size="small">去主人服务台</el-button>
            </RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-reminders' }">
              <el-button size="small">去提醒中心</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="开始使用"
        title="登录后查看主人售后中心"
        description="这里会集中展示退款进度、投诉状态、售后优先级和订单退款导出入口。未登录时不加载任何售后数据。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
          <RouterLink :to="{ name: 'frontend-petpal-reminders' }">
            <el-button size="small">先看提醒中心</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type {
  ComplaintRecord,
  ComplaintStatus,
  DownloadRequestConfig,
  OrderRecord,
  OrderRefundProgressRecord,
  PetServiceType,
} from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/client';
import ListExportButton from '@/components/download/ListExportButton.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PetPalStatePanel from './PetPalStatePanel.vue';
import {
  getPetPalComplaintStatusLabel,
  getPetPalComplaintStatusType,
  getPetPalComplaintTargetRoleLabel,
  getPetPalComplaintTypeLabel,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalRefundProgressStageHint,
  getPetPalRefundProgressStageLabel,
  getPetPalRefundProgressStageType,
} from './shared';

defineOptions({
  name: 'PetPalAftersalesView',
});

type AftersalesFocus = 'ALL' | 'ACTIVE' | 'REFUND' | 'COMPLAINT' | 'RESOLVED';
type AftersalesPriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type PageLoadState = 'idle' | 'ready' | 'error';

type AftersalesOrderItem = {
  order: OrderRecord;
  refundProgress: OrderRefundProgressRecord | null;
  complaints: ComplaintRecord[];
  latestComplaint: ComplaintRecord | null;
  activeComplaintCount: number;
  ownerUnreadCount: number;
  hasRefundHistory: boolean;
  lastTouchedAt: string;
  priorityScore: number;
  priorityLevel: AftersalesPriorityLevel;
};

const auth = useAuthStore();

const loading = ref(false);
const pageLoadState = ref<PageLoadState>('idle');
const pageLoadErrorMessage = ref('');
const partialLoadNotice = ref('');
const aftersalesItems = ref<AftersalesOrderItem[]>([]);
const focus = ref<AftersalesFocus>('ACTIVE');
const unresolvedOnly = ref(false);
const keyword = ref('');

const toNumber = (value: number | string | null | undefined) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const formatAmount = (value: number | string | null | undefined) => toNumber(value).toFixed(2);
const formatTime = (value: string) => new Date(value).toLocaleString();

const getOrderStatusLabel = getPetPalOrderStatusLabel;
const getComplaintStatusLabel = getPetPalComplaintStatusLabel;
const getComplaintStatusType = getPetPalComplaintStatusType;
const getComplaintTargetRoleLabel = getPetPalComplaintTargetRoleLabel;
const getComplaintTypeLabel = getPetPalComplaintTypeLabel;
const getRefundProgressStageLabel = getPetPalRefundProgressStageLabel;
const getRefundProgressStageHint = getPetPalRefundProgressStageHint;
const getRefundProgressStageType = getPetPalRefundProgressStageType;

const getServiceTypeLabel = (value: PetServiceType) => ({
  BOARDING: '寄养',
  WALKING: '遛宠',
  FEEDING: '喂养',
  DOOR_VISIT: '上门陪伴',
}[value] ?? value);

const getPriorityLabel = (level: AftersalesPriorityLevel) => ({
  HIGH: '优先处理',
  MEDIUM: '持续跟进',
  LOW: '记录回看',
}[level]);

const getPriorityTagType = (level: AftersalesPriorityLevel): 'danger' | 'warning' | 'success' => {
  const map: Record<AftersalesPriorityLevel, 'danger' | 'warning' | 'success'> = {
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'success',
  };
  return map[level];
};

const getComplaintWeight = (status: ComplaintStatus) => ({
  OPEN: 220,
  PROCESSING: 180,
  REJECTED: 90,
  RESOLVED: 40,
}[status] ?? 0);

const getRefundWeight = (stage: OrderRefundProgressRecord['stage']) => ({
  NONE: 0,
  PENDING_REVIEW: 140,
  APPROVED_WAITING: 120,
  PARTIAL_SUCCESS: 70,
  FULL_SUCCESS: 40,
  REJECTED: 100,
  FAILED: 160,
}[stage] ?? 0);

const buildPriorityScore = (
  order: OrderRecord,
  refundProgress: OrderRefundProgressRecord | null,
  complaints: ComplaintRecord[],
) => {
  const latestComplaint = complaints[0] ?? null;
  const complaintScore = latestComplaint ? getComplaintWeight(latestComplaint.status) : 0;
  const refundScore = refundProgress ? getRefundWeight(refundProgress.stage) : 0;
  const unreadScore = getPetPalConversationUnreadCount(order.conversation, 'owner') * 60;
  const orderStatusScoreMap: Partial<Record<OrderRecord['orderStatus'], number>> = {
    DISPUTED: 160,
    PARTIAL_REFUNDED: 90,
    REFUNDED: 50,
    SERVING: 30,
    COMPLETED: 10,
  };
  const orderStatusScore = orderStatusScoreMap[order.orderStatus] ?? 0;
  return complaintScore + refundScore + unreadScore + orderStatusScore;
};

const buildPriorityLevel = (score: number): AftersalesPriorityLevel => {
  if (score >= 220) {
    return 'HIGH';
  }
  if (score >= 90) {
    return 'MEDIUM';
  }
  return 'LOW';
};

const hasActiveComplaint = (item: AftersalesOrderItem) => item.activeComplaintCount > 0;

const hasPendingRefund = (item: AftersalesOrderItem) => (
  item.refundProgress !== null
  && ['PENDING_REVIEW', 'APPROVED_WAITING', 'FAILED', 'REJECTED'].includes(item.refundProgress.stage)
);

const isResolvedItem = (item: AftersalesOrderItem) => (
  !hasActiveComplaint(item)
  && !hasPendingRefund(item)
  && (!item.refundProgress || ['NONE', 'PARTIAL_SUCCESS', 'FULL_SUCCESS'].includes(item.refundProgress.stage))
);

const matchesKeyword = (input: string, values: Array<string | null | undefined>) => {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return values.some(value => value?.toLowerCase().includes(normalized));
};

const filteredItems = computed(() => aftersalesItems.value.filter((item) => {
  if (unresolvedOnly.value && isResolvedItem(item)) {
    return false;
  }

  if (focus.value === 'ACTIVE' && isResolvedItem(item)) {
    return false;
  }

  if (focus.value === 'REFUND' && !item.hasRefundHistory) {
    return false;
  }

  if (focus.value === 'COMPLAINT' && item.complaints.length === 0) {
    return false;
  }

  if (focus.value === 'RESOLVED' && !isResolvedItem(item)) {
    return false;
  }

  return matchesKeyword(keyword.value, [
    item.order.orderNo,
    getOrderStatusLabel(item.order.orderStatus),
    item.refundProgress ? getRefundProgressStageLabel(item.refundProgress.stage) : null,
    item.latestComplaint ? getComplaintTypeLabel(item.latestComplaint.complaintType) : null,
    item.latestComplaint ? getComplaintStatusLabel(item.latestComplaint.status) : null,
  ]);
}));

const refundInFlightCount = computed(() => aftersalesItems.value.filter(item => hasPendingRefund(item)).length);
const activeComplaintCount = computed(() => aftersalesItems.value.reduce((total, item) => total + item.activeComplaintCount, 0));
const totalSettledRefundAmount = computed(() => aftersalesItems.value.reduce((total, item) => (
  total + toNumber(item.refundProgress?.settledRefundAmount)
), 0));

const buildOrderRefundExportRequest = (orderId: string): DownloadRequestConfig => (
  api.petpal.orders.exportRefunds(orderId)
);

const getNextActionTitle = (item: AftersalesOrderItem) => {
  if (item.activeComplaintCount > 0) {
    return '优先处理投诉协同';
  }
  if (item.refundProgress?.stage === 'FAILED') {
    return '优先核查退款失败原因';
  }
  if (item.refundProgress?.stage === 'REJECTED') {
    return '核查退款驳回原因';
  }
  if (item.refundProgress && ['PENDING_REVIEW', 'APPROVED_WAITING'].includes(item.refundProgress.stage)) {
    return '持续跟进退款进度';
  }
  if (item.ownerUnreadCount > 0) {
    return '先确认售后沟通';
  }
  return '售后记录可回看';
};

const getNextActionCopy = (item: AftersalesOrderItem) => {
  if (item.activeComplaintCount > 0) {
    return '投诉仍在处理中，建议尽快进入订单详情查看处理时间线，并在消息中心保持沟通畅通。';
  }
  if (item.refundProgress?.stage === 'FAILED') {
    return '退款渠道已返回失败结果，建议立即回到订单详情核查平台反馈，并联系平台继续处理。';
  }
  if (item.refundProgress?.stage === 'REJECTED') {
    return '最近一笔退款申请已被驳回，可结合投诉和沟通记录补充说明后再继续跟进。';
  }
  if (item.refundProgress && ['PENDING_REVIEW', 'APPROVED_WAITING'].includes(item.refundProgress.stage)) {
    return '退款仍在处理中，可继续关注审核结果或渠道回调，必要时回到订单详情查看最新售后时间线。';
  }
  if (item.ownerUnreadCount > 0) {
    return '当前仍有未读消息，建议先在消息中心确认沟通，再决定是否继续提交退款或投诉说明。';
  }
  return '当前售后记录已形成，可直接回看处理轨迹或导出退款明细留存。';
};

const loadAftersalesItems = async () => {
  partialLoadNotice.value = '';
  const orders = await api.petpal.orders.list();
  const sortedOrders = [...orders].sort((left, right) => (
    new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  ));

  let refundFailures = 0;
  let complaintFailures = 0;

  const results = await Promise.all(sortedOrders.map(async (order): Promise<AftersalesOrderItem | null> => {
    const [refundProgressResult, complaintsResult] = await Promise.allSettled([
      api.petpal.orders.refundProgress(order.id),
      api.petpal.orders.complaints(order.id),
    ]);

    const refundProgress = refundProgressResult.status === 'fulfilled'
      ? refundProgressResult.value
      : null;
    const complaints = complaintsResult.status === 'fulfilled'
      ? [...complaintsResult.value].sort((left, right) => (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ))
      : [];

    if (refundProgressResult.status === 'rejected') {
      refundFailures += 1;
    }

    if (complaintsResult.status === 'rejected') {
      complaintFailures += 1;
    }

    const hasRefundHistory = Boolean(
      (refundProgress && refundProgress.totalRefundCount > 0)
      || order.refunds.length
      || toNumber(order.amountRefunded) > 0,
    );
    const hasComplaintHistory = complaints.length > 0;
    const hasAftersales = hasRefundHistory
      || hasComplaintHistory
      || ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus);

    if (!hasAftersales) {
      return null;
    }

    const latestComplaint = complaints[0] ?? null;
    const activeCount = complaints.filter(item => ['OPEN', 'PROCESSING'].includes(item.status)).length;
    const lastTouchedAt = latestComplaint?.updatedAt
      ?? refundProgress?.latestAppliedAt
      ?? refundProgress?.latestReviewedAt
      ?? order.updatedAt;
    const priorityScore = buildPriorityScore(order, refundProgress, complaints);

    return {
      order,
      refundProgress,
      complaints,
      latestComplaint,
      activeComplaintCount: activeCount,
      ownerUnreadCount: getPetPalConversationUnreadCount(order.conversation, 'owner'),
      hasRefundHistory,
      lastTouchedAt,
      priorityScore,
      priorityLevel: buildPriorityLevel(priorityScore),
    };
  }));

  aftersalesItems.value = results
    .filter((item): item is AftersalesOrderItem => Boolean(item))
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      return new Date(right.lastTouchedAt).getTime() - new Date(left.lastTouchedAt).getTime();
    });

  const notices: string[] = [];
  if (refundFailures > 0) {
    notices.push(`有 ${refundFailures} 个订单的退款进度未能完整加载`);
  }
  if (complaintFailures > 0) {
    notices.push(`有 ${complaintFailures} 个订单的投诉进度未能完整加载`);
  }
  partialLoadNotice.value = notices.length
    ? `${notices.join('；')}，可进入订单详情继续核查。`
    : '';
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    return;
  }

  loading.value = true;
  pageLoadErrorMessage.value = '';
  pageLoadState.value = 'idle';
  try {
    await loadAftersalesItems();
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    aftersalesItems.value = [];
    partialLoadNotice.value = '';
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载售后中心失败');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void reloadAll();
});
</script>

<style scoped lang="scss">
.petpal-grid-span-3 {
  grid-column: span 3;
}

.petpal-summary-value {
  display: block;
  font-size: 32px;
  line-height: 1.05;
  color: #17384a;
}

.petpal-summary-copy {
  margin: 8px 0 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.petpal-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.petpal-section-heading__meta {
  display: grid;
  gap: 8px;
}

.petpal-section-heading__meta h3,
.petpal-aftersales-item__headline h4 {
  margin: 0;
}

.petpal-section-heading__meta p,
.petpal-aftersales-item__headline p {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-aftersales-list {
  display: grid;
  gap: 16px;
}

.petpal-aftersales-item {
  display: grid;
  gap: 16px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
}

.petpal-aftersales-item__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.petpal-aftersales-item__headline {
  display: grid;
  gap: 8px;
}

.petpal-aftersales-item__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.petpal-aftersales-item__tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.petpal-aftersales-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.petpal-aftersales-panel {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(247, 250, 252, 0.88);
}

.petpal-aftersales-panel strong {
  font-size: 18px;
  color: #17384a;
}

.petpal-aftersales-panel p,
.petpal-aftersales-note {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-aftersales-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.petpal-aftersales-stats span {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: #475569;
  font-size: 12px;
}

.petpal-aftersales-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.petpal-empty-state {
  margin: 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .petpal-grid-span-3 {
    grid-column: span 6;
  }

  .petpal-aftersales-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .petpal-grid-span-3 {
    grid-column: span 12;
  }

  .petpal-filter-toolbar,
  .petpal-section-heading,
  .petpal-aftersales-item__header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
