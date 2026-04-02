<template>
  <section class="petpal-admin-hub">
    <div class="petpal-admin-hub__hero">
      <p class="petpal-admin-hub__eyebrow">PetPal Admin</p>
      <h1>后台总览</h1>
      <div class="petpal-admin-hub__signals">
        <article v-for="item in signalCards" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.hint }}</small>
        </article>
      </div>
      <div class="petpal-admin-hub__hero-actions">
        <el-button plain :loading="overviewLoading" @click="loadHubOverview">刷新治理摘要</el-button>
        <p v-if="overviewNotice" class="petpal-admin-hub__notice">
          {{ overviewNotice }}
        </p>
      </div>
    </div>

    <div v-if="metricCards.length" class="petpal-admin-hub__metrics">
      <RouterLink
        v-for="card in metricCards"
        :key="card.label"
        :to="card.to"
        class="petpal-admin-metric"
        :class="`is-${card.tone}`"
      >
        <span>{{ card.label }}</span>
        <strong>{{ card.value }}</strong>
        <small>{{ card.hint }}</small>
      </RouterLink>
    </div>

    <section v-if="priorityItems.length" class="petpal-admin-hub__priority">
      <header class="petpal-admin-hub__section-header">
        <p>优先关注</p>
        <h2>当前治理摘要</h2>
      </header>
      <div class="petpal-admin-hub__priority-list">
        <RouterLink
          v-for="item in priorityItems"
          :key="item.title"
          :to="item.to"
          class="petpal-admin-priority"
          :class="`is-${item.tone}`"
        >
          <strong>{{ item.title }}</strong>
          <p>{{ item.detail }}</p>
        </RouterLink>
      </div>
    </section>

    <section v-if="quickActions.length" class="petpal-admin-hub__quick-actions">
      <header class="petpal-admin-hub__section-header">
        <p>值班动作</p>
        <h2>直接处理</h2>
      </header>
      <div class="petpal-admin-hub__quick-action-list">
        <template v-for="action in quickActions" :key="action.title">
          <button
            v-if="action.kind === 'button'"
            class="petpal-admin-quick-action"
            :class="`is-${action.tone}`"
            type="button"
            :disabled="action.disabled"
            @click="action.run"
          >
            <strong>{{ action.title }}</strong>
            <p>{{ action.detail }}</p>
          </button>
          <RouterLink
            v-else
            :to="action.to"
            class="petpal-admin-quick-action"
            :class="`is-${action.tone}`"
          >
            <strong>{{ action.title }}</strong>
            <p>{{ action.detail }}</p>
          </RouterLink>
        </template>
      </div>
    </section>

    <div class="petpal-admin-hub__grid">
      <RouterLink
        v-for="item in accessibleItems"
        :key="item.to"
        :to="item.to"
        class="petpal-admin-card"
      >
        <div class="petpal-admin-card__icon">
          <UnoIcon :name="item.icon" :size="22" />
        </div>
        <div class="petpal-admin-card__copy">
          <small>{{ item.caption }}</small>
          <h2>{{ item.title }}</h2>
          <p>{{ item.description }}</p>
        </div>
      </RouterLink>
    </div>

    <el-empty
      v-if="accessibleItems.length === 0"
      description="当前账号还没有可用的 PetPal 后台权限，请先分配后台角色或业务权限。"
    />
  </section>
</template>

<script setup lang="ts">
import type { CallbackAlertOutboxStats, CallbackAuditStats, ComplaintAdminStats } from '@rbac/api-common';
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
const deadRetrySubmitting = ref(false);
const assignUrgentComplaintsSubmitting = ref(false);

const canReadComplaints = computed(() => auth.permissions.includes('petpal.complaint.read'));
const canManageComplaints = computed(() => auth.permissions.includes('petpal.complaint.manage'));
const canAuditCaregivers = computed(() => auth.permissions.includes('petpal.caregiver.audit'));
const canReadCallbackAudits = computed(() => auth.permissions.includes('petpal.callback-audit.read'));
const canReadCallbackAlerts = computed(() => auth.permissions.includes('petpal.callback-alert.read'));
const canRetryCallbackAlerts = computed(() => auth.permissions.includes('petpal.callback-alert.retry'));
const currentAdminDisplayName = computed(() => auth.user?.nickname ?? auth.user?.username ?? '当前管理员');

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

  const tasks: Promise<void>[] = [];

  complaintStats.value = null;
  pendingCaregiverCount.value = null;
  callbackAuditStats.value = null;
  callbackAlertStats.value = null;

  if (canReadComplaints.value) {
    tasks.push(
      api.petpal.admin.complaintStats().then((response) => {
        complaintStats.value = response;
      }),
    );
  }

  if (canAuditCaregivers.value) {
    tasks.push(
      api.petpal.admin.caregiverAudits({
        page: 1,
        pageSize: 1,
        auditStatus: 'PENDING',
      }).then((response) => {
        pendingCaregiverCount.value = response.pagination.total;
      }),
    );
  }

  if (canReadCallbackAudits.value) {
    tasks.push(
      api.petpal.admin.callbackAuditStats().then((response) => {
        callbackAuditStats.value = response;
      }),
    );
  }

  if (canReadCallbackAlerts.value) {
    tasks.push(
      api.petpal.admin.callbackAlertOutboxStats().then((response) => {
        callbackAlertStats.value = response;
      }),
    );
  }

  try {
    const results = await Promise.allSettled(tasks);
    const firstRejected = results.find((item) => item.status === 'rejected');
    if (firstRejected?.status === 'rejected') {
      overviewNotice.value = '部分治理摘要加载失败，仍可直接进入对应工作区处理。';
      ElMessage.warning(getErrorMessage(firstRejected.reason, overviewNotice.value));
    }

    statsUpdatedAt.value = formatRefreshTime(new Date());
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
  gap: 20px;
}

.petpal-admin-hub__hero {
  display: grid;
  gap: 14px;
  padding: 28px;
  border: 1px solid rgba(32, 72, 67, 0.12);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(232, 251, 246, 0.9), transparent 28%),
    linear-gradient(135deg, rgba(248, 253, 250, 0.94) 0%, rgba(235, 245, 240, 0.92) 100%);
  box-shadow: 0 24px 52px rgba(24, 62, 57, 0.08);
}

.petpal-admin-hub__eyebrow {
  margin: 0;
  color: #5a6f67;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.petpal-admin-hub__hero h1 {
  margin: 0;
  color: #183e39;
  font-size: clamp(30px, 4vw, 44px);
  line-height: 1.02;
}

.petpal-admin-hub__hero p {
  max-width: 760px;
  margin: 0;
  color: #556a62;
  line-height: 1.8;
}

.petpal-admin-hub__signals {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.petpal-admin-hub__signals article {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(32, 72, 67, 0.08);
}

.petpal-admin-hub__signals span {
  color: #698077;
  font-size: 12px;
}

.petpal-admin-hub__signals strong {
  color: #183e39;
  font-size: 20px;
}

.petpal-admin-hub__signals small {
  color: #6c837b;
  line-height: 1.6;
}

.petpal-admin-hub__hero-actions {
  display: grid;
  gap: 10px;
}

.petpal-admin-hub__notice {
  margin: 0;
  color: #8c5e1a;
  font-size: 13px;
}

.petpal-admin-hub__metrics {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.petpal-admin-metric {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid rgba(32, 72, 67, 0.08);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 36px rgba(24, 62, 57, 0.05);
}

.petpal-admin-metric span {
  color: #698077;
  font-size: 12px;
}

.petpal-admin-metric strong {
  color: #183e39;
  font-size: clamp(28px, 3vw, 36px);
  line-height: 1;
}

.petpal-admin-metric small {
  color: #5c726a;
  line-height: 1.7;
}

.petpal-admin-metric.is-accent {
  border-color: rgba(26, 111, 94, 0.18);
  background: linear-gradient(180deg, rgba(241, 252, 248, 0.94), rgba(255, 255, 255, 0.88));
}

.petpal-admin-metric.is-warning {
  border-color: rgba(169, 124, 46, 0.2);
  background: linear-gradient(180deg, rgba(255, 249, 235, 0.94), rgba(255, 255, 255, 0.9));
}

.petpal-admin-metric.is-danger {
  border-color: rgba(169, 67, 50, 0.18);
  background: linear-gradient(180deg, rgba(255, 244, 242, 0.95), rgba(255, 255, 255, 0.9));
}

.petpal-admin-hub__priority {
  display: grid;
  gap: 14px;
}

.petpal-admin-hub__section-header {
  display: grid;
  gap: 6px;
}

.petpal-admin-hub__section-header p,
.petpal-admin-hub__section-header h2 {
  margin: 0;
}

.petpal-admin-hub__section-header p {
  color: #6d847c;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.petpal-admin-hub__section-header h2 {
  color: #183e39;
  font-size: 24px;
}

.petpal-admin-hub__priority-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.petpal-admin-priority {
  display: grid;
  gap: 8px;
  padding: 18px 20px;
  border-radius: 22px;
  border: 1px solid rgba(32, 72, 67, 0.08);
  background: rgba(255, 255, 255, 0.84);
}

.petpal-admin-priority strong,
.petpal-admin-priority p {
  margin: 0;
}

.petpal-admin-priority strong {
  color: #183e39;
}

.petpal-admin-priority p {
  color: #5b7269;
  line-height: 1.7;
}

.petpal-admin-priority.is-warning {
  border-color: rgba(169, 124, 46, 0.22);
}

.petpal-admin-priority.is-danger {
  border-color: rgba(169, 67, 50, 0.2);
}

.petpal-admin-hub__quick-actions {
  display: grid;
  gap: 14px;
}

.petpal-admin-hub__quick-action-list {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.petpal-admin-quick-action {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 18px 20px;
  text-align: left;
  border-radius: 22px;
  border: 1px solid rgba(32, 72, 67, 0.08);
  background: rgba(255, 255, 255, 0.84);
}

.petpal-admin-quick-action strong,
.petpal-admin-quick-action p {
  margin: 0;
}

.petpal-admin-quick-action strong {
  color: #183e39;
}

.petpal-admin-quick-action p {
  color: #5b7269;
  line-height: 1.7;
}

.petpal-admin-quick-action.is-accent {
  border-color: rgba(26, 111, 94, 0.18);
}

.petpal-admin-quick-action.is-warning {
  border-color: rgba(169, 124, 46, 0.2);
}

.petpal-admin-quick-action.is-danger {
  border-color: rgba(169, 67, 50, 0.2);
}

.petpal-admin-quick-action:disabled {
  cursor: wait;
  opacity: 0.72;
}

.petpal-admin-hub__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.petpal-admin-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border: 1px solid rgba(32, 72, 67, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 42px rgba(24, 62, 57, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.petpal-admin-card:hover {
  transform: translateY(-2px);
  border-color: rgba(24, 62, 57, 0.16);
  box-shadow: 0 24px 52px rgba(24, 62, 57, 0.1);
}

.petpal-admin-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #183e39;
  color: #f4fbf8;
}

.petpal-admin-card__copy {
  display: grid;
  gap: 8px;
}

.petpal-admin-card__copy small {
  color: #6d847c;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.petpal-admin-card__copy h2 {
  margin: 0;
  color: #183e39;
  font-size: 20px;
}

.petpal-admin-card__copy p {
  margin: 0;
  color: #5a6f67;
  line-height: 1.7;
}

@media (max-width: 900px) {
  .petpal-admin-hub__hero {
    padding: 22px;
  }
}
</style>
