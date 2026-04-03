<template>
  <section class="petpal-admin-hub">
    <header class="petpal-admin-hub__hero">
      <div class="petpal-admin-hub__hero-copy">
        <p class="petpal-admin-hub__eyebrow">PetPal Admin</p>
        <h1>先处理当前最紧急的治理事项</h1>
        <p>
          当前值班账号是 {{ currentAdminDisplayName }}。后台入口不再承担信息展示，只保留摘要、优先队列和直接处理动作。
        </p>
      </div>

      <div class="petpal-admin-hub__hero-actions">
        <el-button plain :loading="overviewLoading" @click="loadHubOverview">刷新治理摘要</el-button>
        <p v-if="overviewNotice" class="petpal-admin-hub__notice">
          {{ overviewNotice }}
        </p>
      </div>

      <dl class="petpal-admin-hub__hero-meta">
        <div v-for="item in signalCards" :key="item.label" class="petpal-admin-hub__hero-meta-item">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
          <p>{{ item.hint }}</p>
        </div>
      </dl>
    </header>

    <section v-if="priorityItems.length" class="petpal-admin-hub__section">
      <header class="petpal-admin-hub__section-header">
        <p>优先队列</p>
        <h2>现在先处理</h2>
      </header>
      <div class="petpal-admin-hub__stack-list">
        <RouterLink
          v-for="item in priorityItems"
          :key="item.title"
          :to="item.to"
          class="petpal-admin-hub__stack-row"
          :class="`is-${item.tone}`"
        >
          <div class="petpal-admin-hub__stack-copy">
            <strong>{{ item.title }}</strong>
            <p>{{ item.detail }}</p>
          </div>
          <span class="petpal-admin-hub__stack-action">进入处理</span>
        </RouterLink>
      </div>
    </section>

    <section v-if="metricCards.length" class="petpal-admin-hub__section">
      <header class="petpal-admin-hub__section-header">
        <p>实时摘要</p>
        <h2>只保留当前账号真的要看的计数</h2>
      </header>
      <div class="petpal-admin-hub__stack-list">
        <RouterLink
          v-for="card in metricCards"
          :key="card.label"
          :to="card.to"
          class="petpal-admin-hub__stack-row"
          :class="`is-${card.tone}`"
        >
          <div class="petpal-admin-hub__stat-copy">
            <span>{{ card.label }}</span>
            <strong>{{ card.value }}</strong>
          </div>
          <div class="petpal-admin-hub__stack-copy">
            <p>{{ card.hint }}</p>
          </div>
          <span class="petpal-admin-hub__stack-action">查看队列</span>
        </RouterLink>
      </div>
    </section>

    <section v-if="operationsMetricCards.length" class="petpal-admin-hub__section">
      <header class="petpal-admin-hub__section-header">
        <p>经营信号</p>
        <h2>补齐看板里的四个基础指标</h2>
      </header>
      <div class="petpal-admin-hub__operations-grid">
        <article
          v-for="card in operationsMetricCards"
          :key="card.label"
          class="petpal-admin-hub__operations-card"
          :class="`is-${card.tone}`"
        >
          <span class="petpal-admin-hub__operations-label">{{ card.label }}</span>
          <strong class="petpal-admin-hub__operations-value">{{ card.value }}</strong>
          <p class="petpal-admin-hub__operations-hint">{{ card.hint }}</p>
        </article>
      </div>
    </section>

    <section v-if="quickActions.length" class="petpal-admin-hub__section">
      <header class="petpal-admin-hub__section-header">
        <p>值班动作</p>
        <h2>直接处理，不先跳介绍页</h2>
      </header>
      <div class="petpal-admin-hub__stack-list">
        <template v-for="action in quickActions" :key="action.title">
          <button
            v-if="action.kind === 'button'"
            class="petpal-admin-hub__stack-row petpal-admin-hub__stack-row--button"
            :class="`is-${action.tone}`"
            type="button"
            :disabled="action.disabled"
            @click="action.run"
          >
            <div class="petpal-admin-hub__stack-copy">
              <strong>{{ action.title }}</strong>
              <p>{{ action.detail }}</p>
            </div>
            <span class="petpal-admin-hub__stack-action">
              {{ action.disabled ? '处理中' : '立即执行' }}
            </span>
          </button>
          <RouterLink
            v-else
            :to="action.to"
            class="petpal-admin-hub__stack-row"
            :class="`is-${action.tone}`"
          >
            <div class="petpal-admin-hub__stack-copy">
              <strong>{{ action.title }}</strong>
              <p>{{ action.detail }}</p>
            </div>
            <span class="petpal-admin-hub__stack-action">进入处理</span>
          </RouterLink>
        </template>
      </div>
    </section>

    <section v-if="accessibleItems.length" class="petpal-admin-hub__section">
      <header class="petpal-admin-hub__section-header">
        <p>治理工作区</p>
        <h2>按权限进入对应后台</h2>
      </header>
      <div class="petpal-admin-hub__workspace-list">
        <RouterLink
          v-for="item in accessibleItems"
          :key="item.to"
          :to="item.to"
          class="petpal-admin-hub__workspace-row"
        >
          <div class="petpal-admin-hub__workspace-icon">
            <UnoIcon :name="item.icon" :size="20" />
          </div>
          <div class="petpal-admin-hub__workspace-copy">
            <small>{{ item.caption }}</small>
            <strong>{{ item.title }}</strong>
            <p>{{ item.description }}</p>
          </div>
          <span class="petpal-admin-hub__stack-action">打开</span>
        </RouterLink>
      </div>
    </section>

    <el-empty
      v-else
      description="当前账号还没有可用的 PetPal 后台权限，请先分配后台角色或业务权限。"
    />
  </section>
</template>

<script setup lang="ts">
import type {
  CallbackAlertOutboxStats,
  CallbackAuditStats,
  ComplaintAdminStats,
  PetPalAdminOperationsMetrics,
} from '@rbac/api-common';
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import { useRouter } from 'vue-router';
import { api } from '@/api/client';
import UnoIcon from '@/components/common/UnoIcon.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { canAccessPetPalAdminNavItem, petpalAdminNavItems } from './navigation';

type HubTone = 'neutral' | 'accent' | 'warning' | 'danger';

const auth = useAuthStore();
const router = useRouter();
const accessibleItems = computed(() => petpalAdminNavItems.filter((item) => (
  item.to !== '/petpal-admin' && canAccessPetPalAdminNavItem(auth.permissions, item)
)));

const overviewLoading = ref(false);
const overviewNotice = ref('');
const statsUpdatedAt = ref('');
const complaintStats = ref<ComplaintAdminStats | null>(null);
const pendingCaregiverCount = ref<number | null>(null);
const callbackAuditStats = ref<CallbackAuditStats | null>(null);
const callbackAlertStats = ref<CallbackAlertOutboxStats | null>(null);
const operationsMetrics = ref<PetPalAdminOperationsMetrics | null>(null);
const deadRetrySubmitting = ref(false);
const assignUrgentComplaintsSubmitting = ref(false);

const canReadComplaints = computed(() => auth.permissions.includes('petpal.complaint.read'));
const canManageComplaints = computed(() => auth.permissions.includes('petpal.complaint.manage'));
const canAuditCaregivers = computed(() => auth.permissions.includes('petpal.caregiver.audit'));
const canReadCallbackAudits = computed(() => auth.permissions.includes('petpal.callback-audit.read'));
const canReadCallbackAlerts = computed(() => auth.permissions.includes('petpal.callback-alert.read'));
const canRetryCallbackAlerts = computed(() => auth.permissions.includes('petpal.callback-alert.retry'));
const currentAdminDisplayName = computed(() => auth.user?.nickname ?? auth.user?.username ?? '当前管理员');
const formatRate = (value: number) => `${value}%`;
const formatSupplyDemandRatio = (value: number | null) => (
  value === null ? '暂无需求' : `${value.toFixed(2)} : 1`
);

const signalCards = computed(() => {
  const cards = [
    {
      label: '可访问工作区',
      value: String(accessibleItems.value.length),
      hint: '这里只展示当前账号已开通的治理入口。',
    },
    {
      label: '当前账号',
      value: auth.user?.nickname ?? auth.user?.username ?? '未知用户',
      hint: '根级后台会复用当前登录态与访问控制。',
    },
  ];

  if (statsUpdatedAt.value) {
    cards.push({
      label: '最近刷新',
      value: statsUpdatedAt.value,
      hint: '治理摘要只聚合当前账号实际可见的数据。',
    });
  }

  return cards;
});

const metricCards = computed(() => {
  const cards: Array<{
    label: string;
    value: string;
    hint: string;
    to: RouteLocationRaw;
    tone: HubTone;
  }> = [];

  if (canReadComplaints.value && complaintStats.value) {
    cards.push({
      label: '已超时投诉',
      value: String(complaintStats.value.overdueCount),
      hint: `即将超时 ${complaintStats.value.dueSoonCount} · 未分配 ${complaintStats.value.unassignedCount}`,
      to: {
        path: '/petpal-admin/complaints',
        query: {
          slaStatus: complaintStats.value.overdueCount > 0 ? 'OVERDUE' : complaintStats.value.dueSoonCount > 0 ? 'DUE_SOON' : 'NORMAL',
        },
      },
      tone: complaintStats.value.overdueCount > 0 ? 'danger' : complaintStats.value.dueSoonCount > 0 ? 'warning' : 'neutral',
    });
  }

  if (canAuditCaregivers.value && pendingCaregiverCount.value !== null) {
    cards.push({
      label: '待审照料者',
      value: String(pendingCaregiverCount.value),
      hint: '优先处理入驻审核，避免订单承接能力积压。',
      to: {
        path: '/petpal-admin/caregiver-audits',
        query: {
          auditStatus: 'PENDING',
        },
      },
      tone: pendingCaregiverCount.value > 0 ? 'warning' : 'neutral',
    });
  }

  if (canReadCallbackAudits.value && callbackAuditStats.value) {
    const failureCount = callbackAuditStats.value.byStatus.FAILURE + callbackAuditStats.value.byStatus.ERROR;
    cards.push({
      label: '回调成功率',
      value: `${callbackAuditStats.value.successRate}%`,
      hint: `审计总量 ${callbackAuditStats.value.total} · 异常 ${failureCount}`,
      to: {
        path: '/petpal-admin/callback-audits',
        query: failureCount > 0
          ? {
              callbackStatus: callbackAuditStats.value.byStatus.ERROR > 0 ? 'ERROR' : 'FAILURE',
            }
          : {},
      },
      tone: failureCount > 0 ? 'warning' : 'accent',
    });
  }

  if (canReadCallbackAlerts.value && callbackAlertStats.value) {
    cards.push({
      label: '死信告警',
      value: String(callbackAlertStats.value.byStatus.DEAD),
      hint: `处理中卡住 ${callbackAlertStats.value.stuckProcessingCount} · 最老死信 ${callbackAlertStats.value.oldestDeadAgeMinutes} 分钟`,
      to: {
        path: '/petpal-admin/callback-alert-outbox',
        query: {
          status: callbackAlertStats.value.byStatus.DEAD > 0 ? 'DEAD' : callbackAlertStats.value.stuckProcessingCount > 0 ? 'PROCESSING' : 'PENDING',
        },
      },
      tone: callbackAlertStats.value.byStatus.DEAD > 0 ? 'danger' : callbackAlertStats.value.stuckProcessingCount > 0 ? 'warning' : 'neutral',
    });
  }

  return cards;
});

const operationsMetricCards = computed(() => {
  if (!operationsMetrics.value) {
    return [];
  }

  const metrics = operationsMetrics.value;

  return [
    {
      label: '供需比',
      value: formatSupplyDemandRatio(metrics.supplyDemandRatio),
      hint: `${metrics.windowDays} 天需求 ${metrics.demandCount} · 活跃供给 ${metrics.activeApprovedCaregiverCount}`,
      tone: metrics.supplyDemandRatio === null
        ? 'neutral'
        : metrics.supplyDemandRatio < 1
          ? 'warning'
          : 'accent',
    },
    {
      label: '完单率',
      value: formatRate(metrics.completionRate),
      hint: `${metrics.windowDays} 天订单 ${metrics.orderCount} · 完成 ${metrics.completedOrderCount}`,
      tone: metrics.completionRate >= 80 ? 'accent' : metrics.completionRate >= 60 ? 'warning' : 'danger',
    },
    {
      label: '退款率',
      value: formatRate(metrics.refundRate),
      hint: `已支付 ${metrics.paidOrderCount} · 发生退款 ${metrics.refundedOrderCount}`,
      tone: metrics.refundRate >= 15 ? 'danger' : metrics.refundRate >= 5 ? 'warning' : 'neutral',
    },
    {
      label: '投诉率',
      value: formatRate(metrics.complaintRate),
      hint: `${metrics.windowDays} 天投诉订单 ${metrics.complainedOrderCount} / ${metrics.orderCount}`,
      tone: metrics.complaintRate >= 10 ? 'danger' : metrics.complaintRate >= 3 ? 'warning' : 'neutral',
    },
  ];
});

const priorityItems = computed(() => {
  const items: Array<{
    title: string;
    detail: string;
    to: RouteLocationRaw;
    tone: Exclude<HubTone, 'neutral'>;
  }> = [];

  if (canReadComplaints.value && complaintStats.value?.overdueCount) {
    items.push({
      title: '投诉工单已超时',
      detail: `当前有 ${complaintStats.value.overdueCount} 单投诉超过 SLA，建议优先进入投诉工单台处理。`,
      to: {
        path: '/petpal-admin/complaints',
        query: {
          slaStatus: 'OVERDUE',
        },
      },
      tone: 'danger',
    });
  }

  if (canAuditCaregivers.value && pendingCaregiverCount.value) {
    items.push({
      title: '照料者审核待处理',
      detail: `当前仍有 ${pendingCaregiverCount.value} 份照料者档案待审核，可能影响接单供给。`,
      to: {
        path: '/petpal-admin/caregiver-audits',
        query: {
          auditStatus: 'PENDING',
        },
      },
      tone: 'warning',
    });
  }

  if (canReadCallbackAlerts.value && callbackAlertStats.value && (
    callbackAlertStats.value.byStatus.DEAD > 0 || callbackAlertStats.value.stuckProcessingCount > 0
  )) {
    items.push({
      title: '回调告警需要排查',
      detail: `死信 ${callbackAlertStats.value.byStatus.DEAD} 条，卡住 ${callbackAlertStats.value.stuckProcessingCount} 条，请优先检查告警队列。`,
      to: {
        path: '/petpal-admin/callback-alert-outbox',
        query: {
          status: callbackAlertStats.value.byStatus.DEAD > 0 ? 'DEAD' : 'PROCESSING',
        },
      },
      tone: callbackAlertStats.value.byStatus.DEAD > 0 ? 'danger' : 'warning',
    });
  }

  return items.slice(0, 3);
});

const retryDeadAlerts = async () => {
  try {
    deadRetrySubmitting.value = true;
    const result = await api.petpal.admin.retryDeadCallbackAlertOutbox(50);
    ElMessage.success(`已重试 ${result.requeued} 条死信告警`);
    await loadHubOverview();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '重试死信告警失败'));
  } finally {
    deadRetrySubmitting.value = false;
  }
};

const assignUrgentComplaintsToMe = async () => {
  if (!auth.user?.id) {
    return;
  }

  try {
    assignUrgentComplaintsSubmitting.value = true;

    const overdue = await api.petpal.admin.complaints({
      page: 1,
      pageSize: 20,
      unassignedOnly: true,
      slaStatus: 'OVERDUE',
    });

    const candidates = overdue.items.length > 0
      ? overdue.items
      : (await api.petpal.admin.complaints({
          page: 1,
          pageSize: 20,
          unassignedOnly: true,
          slaStatus: 'DUE_SOON',
        })).items;

    if (candidates.length === 0) {
      ElMessage.info('当前没有可直接接手的未指派紧急工单');
      return;
    }

    const result = await api.petpal.admin.batchAssignComplaints({
      complaintIds: candidates.map((item) => item.id),
      assigneeId: auth.user.id,
      note: `根级后台快捷接手：${currentAdminDisplayName.value} 接手未指派紧急投诉工单`,
    });

    ElMessage.success(`已接手 ${result.updatedCount} 条未指派紧急工单`);
    await loadHubOverview();
    await router.push({
      path: '/petpal-admin/complaints',
      query: {
        assignedAdminId: auth.user.id,
      },
    });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '接手未指派紧急工单失败'));
  } finally {
    assignUrgentComplaintsSubmitting.value = false;
  }
};

const quickActions = computed(() => {
  const actions: Array<
    | {
        kind: 'link';
        title: string;
        detail: string;
        to: RouteLocationRaw;
        tone: HubTone;
      }
    | {
        kind: 'button';
        title: string;
        detail: string;
        run: () => Promise<void>;
        disabled: boolean;
        tone: HubTone;
      }
  > = [];

  if (canReadComplaints.value && auth.user?.id) {
    actions.push({
      kind: 'link',
      title: '查看我的工单',
      detail: '直接进入当前账号负责的投诉工单，减少值班切换成本。',
      to: {
        path: '/petpal-admin/complaints',
        query: {
          assignedAdminId: auth.user.id,
        },
      },
      tone: 'accent',
    });
  }

  if (canReadComplaints.value && canManageComplaints.value && auth.user?.id && complaintStats.value) {
    actions.push({
      kind: 'button',
      title: assignUrgentComplaintsSubmitting.value ? '正在接手紧急工单' : '接手未指派紧急工单',
      detail: complaintStats.value.unassignedCount > 0
        ? `当前有 ${complaintStats.value.unassignedCount} 条未指派投诉，优先接手超时和即将超时工单。`
        : '当前没有未指派投诉工单，也可以随时查看我的工单。',
      run: assignUrgentComplaintsToMe,
      disabled: assignUrgentComplaintsSubmitting.value,
      tone: complaintStats.value.overdueCount > 0 ? 'danger' : complaintStats.value.unassignedCount > 0 ? 'warning' : 'neutral',
    });
  }

  if (canAuditCaregivers.value) {
    actions.push({
      kind: 'link',
      title: '处理待审照料者',
      detail: '直接查看待审核照料者，优先清理接单供给积压。',
      to: {
        path: '/petpal-admin/caregiver-audits',
        query: {
          auditStatus: 'PENDING',
        },
      },
      tone: 'warning',
    });
  }

  if (canRetryCallbackAlerts.value && callbackAlertStats.value) {
    actions.push({
      kind: 'button',
      title: deadRetrySubmitting.value ? '正在重试死信' : '重试死信告警',
      detail: callbackAlertStats.value.byStatus.DEAD > 0
        ? `当前有 ${callbackAlertStats.value.byStatus.DEAD} 条死信，可直接从首页触发重试。`
        : '当前没有死信积压，也可以手动触发一次兜底重试。',
      run: retryDeadAlerts,
      disabled: deadRetrySubmitting.value,
      tone: callbackAlertStats.value.byStatus.DEAD > 0 ? 'danger' : 'neutral',
    });
  }

  return actions;
});

const formatRefreshTime = (date: Date) => date.toLocaleTimeString('zh-CN', { hour12: false });

const loadHubOverview = async () => {
  if (!auth.ready || !auth.isAuthenticated) {
    return;
  }

  overviewLoading.value = true;
  overviewNotice.value = '';

  complaintStats.value = null;
  pendingCaregiverCount.value = null;
  callbackAuditStats.value = null;
  callbackAlertStats.value = null;
  operationsMetrics.value = null;

  try {
    const response = await api.petpal.admin.overview();
    complaintStats.value = response.complaintStats;
    pendingCaregiverCount.value = response.pendingCaregiverCount;
    callbackAuditStats.value = response.callbackAuditStats;
    callbackAlertStats.value = response.callbackAlertStats;
    operationsMetrics.value = response.operationsMetrics;

    if (response.unavailableScopes.length > 0) {
      overviewNotice.value = '部分治理摘要加载失败，仍可直接进入对应工作区处理。';
    }

    statsUpdatedAt.value = formatRefreshTime(new Date());
  } catch (error: unknown) {
    overviewNotice.value = '治理摘要加载失败，仍可直接进入对应工作区处理。';
    ElMessage.warning(getErrorMessage(error, overviewNotice.value));
  } finally {
    overviewLoading.value = false;
  }
};

watch(
  () => `${auth.ready}:${auth.permissions.join('|')}`,
  () => {
    if (!auth.ready) {
      return;
    }

    void loadHubOverview();
  },
  { immediate: true },
);
</script>

<style scoped lang="scss">
.petpal-admin-hub {
  display: grid;
  gap: 18px;
  max-width: 980px;
  margin: 0 auto;
}

.petpal-admin-hub__hero,
.petpal-admin-hub__section {
  display: grid;
  gap: 18px;
  padding: 28px;
  border: 1px solid rgba(32, 72, 67, 0.12);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 22px 48px rgba(24, 62, 57, 0.08);
}

.petpal-admin-hub__hero {
  background:
    radial-gradient(circle at top right, rgba(232, 251, 246, 0.88), transparent 28%),
    linear-gradient(135deg, rgba(248, 253, 250, 0.96) 0%, rgba(237, 245, 241, 0.94) 100%);
}

.petpal-admin-hub__hero-copy,
.petpal-admin-hub__section-header,
.petpal-admin-hub__stack-copy,
.petpal-admin-hub__workspace-copy {
  display: grid;
  gap: 8px;
}

.petpal-admin-hub__eyebrow {
  margin: 0;
  color: #5a6f67;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.petpal-admin-hub__hero h1,
.petpal-admin-hub__section-header h2 {
  margin: 0;
  color: #183e39;
  line-height: 1.02;
}

.petpal-admin-hub__hero h1 {
  font-size: clamp(34px, 4vw, 50px);
}

.petpal-admin-hub__hero p:not(.petpal-admin-hub__eyebrow),
.petpal-admin-hub__stack-copy p,
.petpal-admin-hub__workspace-copy p,
.petpal-admin-hub__hero-meta-item p {
  margin: 0;
  color: #556a62;
  line-height: 1.78;
}

.petpal-admin-hub__hero-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-admin-hub__notice {
  margin: 0;
  color: #8c5e1a;
  font-size: 13px;
}

.petpal-admin-hub__hero-meta {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.petpal-admin-hub__hero-meta-item {
  display: grid;
  gap: 6px;
  padding-top: 14px;
  border-top: 1px solid rgba(24, 62, 57, 0.1);
}

.petpal-admin-hub__hero-meta-item dt {
  color: #698077;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.petpal-admin-hub__hero-meta-item dd {
  margin: 0;
  color: #183e39;
  font-size: 22px;
  line-height: 1.18;
}

.petpal-admin-hub__section-header p {
  margin: 0;
  color: #6d847c;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.petpal-admin-hub__section-header h2 {
  font-size: 26px;
}

.petpal-admin-hub__stack-list,
.petpal-admin-hub__workspace-list {
  display: grid;
  gap: 12px;
}

.petpal-admin-hub__operations-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.petpal-admin-hub__operations-card {
  display: grid;
  gap: 10px;
  min-height: 168px;
  padding: 18px;
  border: 1px solid rgba(24, 62, 57, 0.1);
  border-radius: 22px;
  background: rgba(248, 253, 250, 0.74);
}

.petpal-admin-hub__operations-card.is-accent {
  border-color: rgba(26, 111, 94, 0.2);
}

.petpal-admin-hub__operations-card.is-warning {
  border-color: rgba(169, 124, 46, 0.24);
  background: rgba(255, 249, 238, 0.88);
}

.petpal-admin-hub__operations-card.is-danger {
  border-color: rgba(169, 67, 50, 0.24);
  background: rgba(255, 244, 241, 0.92);
}

.petpal-admin-hub__operations-label {
  color: #698077;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.petpal-admin-hub__operations-value {
  color: #183e39;
  font-size: clamp(24px, 2.8vw, 32px);
  line-height: 1;
}

.petpal-admin-hub__operations-hint {
  margin: 0;
  color: #556a62;
  line-height: 1.72;
}

.petpal-admin-hub__stack-row,
.petpal-admin-hub__workspace-row {
  display: grid;
  gap: 16px;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 18px 0;
  border-top: 1px solid rgba(24, 62, 57, 0.1);
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.petpal-admin-hub__stack-row:first-child,
.petpal-admin-hub__workspace-row:first-child {
  padding-top: 0;
  border-top: 0;
}

.petpal-admin-hub__stack-row strong,
.petpal-admin-hub__workspace-copy strong {
  color: #183e39;
  font-size: 18px;
}

.petpal-admin-hub__stack-row.is-warning,
.petpal-admin-hub__stack-row.is-danger,
.petpal-admin-hub__stack-row.is-accent,
.petpal-admin-hub__stack-row.is-neutral,
.petpal-admin-hub__workspace-row {
  cursor: pointer;
}

.petpal-admin-hub__stack-row.is-warning {
  border-color: rgba(169, 124, 46, 0.24);
}

.petpal-admin-hub__stack-row.is-danger {
  border-color: rgba(169, 67, 50, 0.24);
}

.petpal-admin-hub__stack-row.is-accent {
  border-color: rgba(26, 111, 94, 0.24);
}

.petpal-admin-hub__stack-row--button {
  width: 100%;
  text-align: left;
  background: transparent;
}

.petpal-admin-hub__stack-row:disabled {
  cursor: wait;
  opacity: 0.72;
}

.petpal-admin-hub__stack-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(24, 62, 57, 0.12);
  border-radius: 999px;
  color: #35534b;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.petpal-admin-hub__stat-copy {
  display: grid;
  gap: 6px;
}

.petpal-admin-hub__stat-copy span {
  color: #698077;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.petpal-admin-hub__stat-copy strong {
  color: #183e39;
  font-size: clamp(26px, 3vw, 34px);
  line-height: 1;
}

.petpal-admin-hub__workspace-row {
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.petpal-admin-hub__workspace-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(24, 62, 57, 0.08);
  color: #183e39;
}

.petpal-admin-hub__workspace-copy small {
  color: #6d847c;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 900px) {
  .petpal-admin-hub__hero,
  .petpal-admin-hub__section {
    padding: 22px;
  }

  .petpal-admin-hub__hero-meta {
    grid-template-columns: 1fr;
  }

  .petpal-admin-hub__operations-grid {
    grid-template-columns: 1fr;
  }

  .petpal-admin-hub__stack-row,
  .petpal-admin-hub__workspace-row {
    grid-template-columns: 1fr;
  }

  .petpal-admin-hub__workspace-row {
    justify-items: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .petpal-admin-hub__stack-row,
  .petpal-admin-hub__workspace-row {
    transition: none;
  }
}
</style>
