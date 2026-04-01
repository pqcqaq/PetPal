<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">PetPal Reminders</p>
      <h1>宠托帮提醒中心</h1>
      <p>把主人、照料者、沟通和售后待办集中到一个入口里，先看优先级，再决定进入哪条业务流处理。</p>
      <div class="frontend-page__hero-actions">
        <el-button type="primary" :loading="loading" @click="reloadAll">刷新提醒</el-button>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal' }">
          主人服务台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver' }">
          照料者工作台
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-messages' }">
          消息中心
        </RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-aftersales' }">
          售后中心
        </RouterLink>
      </div>
    </section>

    <template v-if="auth.isAuthenticated">
      <section class="frontend-page__section-grid">
        <article v-for="item in summaryCards" :key="item.label" class="frontend-card petpal-grid-span-3">
          <span class="frontend-card__eyebrow">{{ item.label }}</span>
          <strong class="petpal-summary-value">{{ item.value }}</strong>
          <p class="petpal-summary-copy">{{ item.hint }}</p>
        </article>
      </section>

      <section class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-8">
          <div class="petpal-section-heading">
            <div class="petpal-section-heading__meta">
              <span class="frontend-card__eyebrow">优先处理</span>
              <h3>高优先提醒</h3>
              <p>这些事项最容易直接影响成单、履约、售后透明度或沟通效率，建议先处理。</p>
            </div>
            <el-tag type="danger">共 {{ highPriorityCards.length }} 条</el-tag>
          </div>

          <div v-if="highPriorityCards.length" class="petpal-reminder-grid">
            <article v-for="item in highPriorityCards" :key="item.id" class="petpal-reminder-card is-priority">
              <div class="petpal-reminder-card__header">
                <div class="petpal-reminder-card__tags">
                  <el-tag size="small" :type="getRoleTagType(item.role)">
                    {{ getRoleLabel(item.role) }}
                  </el-tag>
                  <el-tag size="small" :type="getPriorityTagType(item.priority)">
                    {{ getPriorityLabel(item.priority) }}
                  </el-tag>
                </div>
                <RouterLink :to="item.actionTo">
                  <el-button size="small" type="primary">{{ item.actionLabel }}</el-button>
                </RouterLink>
              </div>
              <h4>{{ item.title }}</h4>
              <p class="petpal-reminder-card__summary">{{ item.summary }}</p>
              <p class="petpal-reminder-card__detail">{{ item.detail }}</p>
            </article>
          </div>

          <PetPalStatePanel
            v-else-if="!hasVisibleCapability"
            eyebrow="可见提醒"
            title="当前账号还没有可展示的提醒视角"
            description="你可能还未开通主人或照料者能力。先切到对应工作台完善资料，或登录另一个账号后再回来查看。"
            tone="warning"
          >
            <template #actions>
              <RouterLink :to="{ name: 'frontend-petpal' }">
                <el-button size="small" type="primary">去主人服务台</el-button>
              </RouterLink>
              <RouterLink :to="{ name: 'frontend-petpal-caregiver' }">
                <el-button size="small">去照料者工作台</el-button>
              </RouterLink>
            </template>
          </PetPalStatePanel>

          <p v-else class="petpal-empty-state">
            当前筛选下没有高优先提醒，说明可见的主人、照料者和售后主链路暂时比较平稳。
          </p>
        </article>

        <article class="frontend-card petpal-grid-span-4">
          <div class="petpal-section-heading">
            <div class="petpal-section-heading__meta">
              <span class="frontend-card__eyebrow">今天与明天</span>
              <h3>近 48 小时安排</h3>
              <p>把即将开始、正在服务或仍需快速确认的订单放到时间维度里查看。</p>
            </div>
            <el-tag type="info">共 {{ scheduleCards.length }} 条</el-tag>
          </div>

          <div v-if="scheduleCards.length" class="petpal-schedule-list">
            <article v-for="item in scheduleCards" :key="item.id" class="petpal-schedule-card">
              <div class="petpal-schedule-card__tags">
                <el-tag size="small" :type="getRoleTagType(item.role)">
                  {{ getRoleLabel(item.role) }}
                </el-tag>
                <el-tag size="small" effect="plain">
                  {{ item.status }}
                </el-tag>
              </div>
              <h4>{{ item.title }}</h4>
              <p>{{ item.detail }}</p>
              <RouterLink :to="item.actionTo">
                <el-button size="small">进入处理</el-button>
              </RouterLink>
            </article>
          </div>

          <p v-else class="petpal-empty-state">
            未来两天没有需要特别提前关注的订单，可继续按提醒卡片推进常规工作。
          </p>
        </article>
      </section>

      <section class="frontend-card">
        <span class="frontend-card__eyebrow">筛选提醒</span>
        <div class="petpal-filter-toolbar">
          <el-radio-group v-model="scope" size="small">
            <el-radio-button label="ALL">全部</el-radio-button>
            <el-radio-button label="OWNER">主人视角</el-radio-button>
            <el-radio-button label="CAREGIVER">照料者视角</el-radio-button>
          </el-radio-group>
          <el-checkbox v-model="highOnly">仅看高优先</el-checkbox>
          <el-input
            v-model="keyword"
            clearable
            size="small"
            maxlength="64"
            placeholder="按标题、摘要或动作筛选"
            style="width: min(100%, 260px)"
          />
        </div>
      </section>

      <section v-if="shouldShowOwnerSection" class="frontend-card">
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <span class="frontend-card__eyebrow">主人提醒</span>
            <h3>主人主流程</h3>
            <p>围绕宠物建档、需求发布、订单履约、消息未读和售后风险集中推进。</p>
          </div>
          <el-tag type="info">共 {{ filteredOwnerReminderCards.length }} 条</el-tag>
        </div>

        <PetPalStatePanel
          v-if="ownerCapabilityState === 'role_unavailable'"
          eyebrow="主人能力"
          title="当前账号未开通主人提醒视角"
          description="主人端的宠物、需求、订单和售后待办不会显示在这里。你可以先去照料者工作台处理当前账号的任务。"
          tone="warning"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver' }">
              <el-button size="small" type="primary">去照料者工作台</el-button>
            </RouterLink>
            <RouterLink to="/login">
              <el-button size="small">切换账号</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>

        <PetPalStatePanel
          v-else-if="ownerCapabilityState === 'error'"
          eyebrow="主人提醒"
          title="主人侧提醒加载失败"
          :description="ownerCapabilityErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="retryingSection === 'owner'" @click="retryOwnerCapability">
              重试主人提醒
            </el-button>
            <RouterLink :to="{ name: 'frontend-petpal' }">
              <el-button size="small">去主人服务台</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>

        <template v-else-if="filteredOwnerReminderCards.length">
          <PetPalStatePanel
            v-if="ownerCapabilityNotice"
            eyebrow="主人提醒"
            title="主人侧提醒未完整加载"
            :description="ownerCapabilityNotice"
            tone="warning"
          >
            <template #actions>
              <el-button size="small" type="primary" :loading="retryingSection === 'owner'" @click="retryOwnerCapability">
                重新加载主人提醒
              </el-button>
            </template>
          </PetPalStatePanel>

        <div class="petpal-reminder-grid">
          <article v-for="item in filteredOwnerReminderCards" :key="item.id" class="petpal-reminder-card">
            <div class="petpal-reminder-card__header">
              <div class="petpal-reminder-card__tags">
                <el-tag size="small" :type="getRoleTagType(item.role)">
                  {{ getRoleLabel(item.role) }}
                </el-tag>
                <el-tag size="small" :type="getPriorityTagType(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </el-tag>
              </div>
              <RouterLink :to="item.actionTo">
                <el-button size="small" type="primary">{{ item.actionLabel }}</el-button>
              </RouterLink>
            </div>
            <h4>{{ item.title }}</h4>
            <p class="petpal-reminder-card__summary">{{ item.summary }}</p>
            <p class="petpal-reminder-card__detail">{{ item.detail }}</p>
          </article>
        </div>
        </template>

        <PetPalStatePanel
          v-else
          eyebrow="主人提醒"
          title="当前筛选下没有主人提醒"
          description="可以直接回到主人服务台继续建档、发需求或回看订单，也可以去提醒中心首页恢复默认筛选。"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal' }">
              <el-button size="small" type="primary">去主人服务台</el-button>
            </RouterLink>
            <el-button size="small" @click="resetReminderFilters">恢复默认筛选</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-if="shouldShowCaregiverSection" class="frontend-card">
        <div class="petpal-section-heading">
          <div class="petpal-section-heading__meta">
            <span class="frontend-card__eyebrow">照料者提醒</span>
            <h3>照料者主流程</h3>
            <p>围绕入驻审核、服务上架、接单、履约记录和照料者侧未读沟通集中推进。</p>
          </div>
          <el-tag type="warning">共 {{ filteredCaregiverReminderCards.length }} 条</el-tag>
        </div>

        <PetPalStatePanel
          v-if="caregiverCapabilityState === 'role_unavailable'"
          eyebrow="照料者能力"
          title="当前账号未开通照料者提醒视角"
          description="照料者端的审核、服务、接单和履约待办不会显示在这里。你可以先回到主人服务台继续处理当前账号的任务。"
          tone="warning"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal' }">
              <el-button size="small" type="primary">去主人服务台</el-button>
            </RouterLink>
            <RouterLink to="/login">
              <el-button size="small">切换账号</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>

        <PetPalStatePanel
          v-else-if="caregiverCapabilityState === 'error'"
          eyebrow="照料者提醒"
          title="照料者侧提醒加载失败"
          :description="caregiverCapabilityErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="retryingSection === 'caregiver'" @click="retryCaregiverCapability">
              重试照料者提醒
            </el-button>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver' }">
              <el-button size="small">去照料者工作台</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>

        <template v-else-if="filteredCaregiverReminderCards.length">
          <PetPalStatePanel
            v-if="caregiverCapabilityNotice"
            eyebrow="照料者提醒"
            title="照料者侧提醒未完整加载"
            :description="caregiverCapabilityNotice"
            tone="warning"
          >
            <template #actions>
              <el-button size="small" type="primary" :loading="retryingSection === 'caregiver'" @click="retryCaregiverCapability">
                重新加载照料者提醒
              </el-button>
            </template>
          </PetPalStatePanel>

        <div class="petpal-reminder-grid">
          <article v-for="item in filteredCaregiverReminderCards" :key="item.id" class="petpal-reminder-card">
            <div class="petpal-reminder-card__header">
              <div class="petpal-reminder-card__tags">
                <el-tag size="small" :type="getRoleTagType(item.role)">
                  {{ getRoleLabel(item.role) }}
                </el-tag>
                <el-tag size="small" :type="getPriorityTagType(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </el-tag>
              </div>
              <RouterLink :to="item.actionTo">
                <el-button size="small" type="primary">{{ item.actionLabel }}</el-button>
              </RouterLink>
            </div>
            <h4>{{ item.title }}</h4>
            <p class="petpal-reminder-card__summary">{{ item.summary }}</p>
            <p class="petpal-reminder-card__detail">{{ item.detail }}</p>
          </article>
        </div>
        </template>

        <PetPalStatePanel
          v-else
          eyebrow="照料者提醒"
          title="当前筛选下没有照料者提醒"
          description="可以先回到照料者工作台检查是否有待接单或服务中订单，也可以恢复默认筛选后再查看。"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver' }">
              <el-button size="small" type="primary">去照料者工作台</el-button>
            </RouterLink>
            <el-button size="small" @click="resetReminderFilters">恢复默认筛选</el-button>
          </template>
        </PetPalStatePanel>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="开始使用"
        title="登录后查看提醒中心"
        description="提醒中心会汇总主人端、照料者端、消息和售后相关待办。未登录时不加载任何业务数据。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
          <RouterLink :to="{ name: 'frontend-petpal' }">
            <el-button size="small">浏览主人服务台</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type {
  CaregiverOrderRecord,
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  ComplaintRecord,
  OrderRecord,
  OrderRefundProgressRecord,
  PetProfileRecord,
  ServiceRequestRecord,
} from '@rbac/api-common';
import type { RouteLocationRaw } from 'vue-router';
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PetPalStatePanel from './PetPalStatePanel.vue';
import {
  getPetPalCaregiverAuditLabel,
  getPetPalConversationUnreadCount,
  getPetPalOrderStatusLabel,
  getPetPalRefundProgressStageLabel,
  getPetPalServiceRequestStatusLabel,
  getPetPalServiceTypeLabel,
} from './shared';

defineOptions({
  name: 'PetPalRemindersView',
});

type ReminderPriority = 'HIGH' | 'MEDIUM' | 'LOW';
type ReminderRole = 'OWNER' | 'CAREGIVER';
type ReminderScope = 'ALL' | 'OWNER' | 'CAREGIVER';
type CapabilityLoadState = 'idle' | 'ready' | 'role_unavailable' | 'error';

type ReminderCard = {
  id: string;
  role: ReminderRole;
  priority: ReminderPriority;
  title: string;
  summary: string;
  detail: string;
  actionLabel: string;
  actionTo: RouteLocationRaw;
};

type ScheduleCard = {
  id: string;
  role: ReminderRole;
  title: string;
  detail: string;
  status: string;
  sortAt: number;
  actionTo: RouteLocationRaw;
};

type OwnerAftersalesSignal = {
  order: OrderRecord;
  refundProgress: OrderRefundProgressRecord | null;
  latestComplaint: ComplaintRecord | null;
  activeComplaintCount: number;
  lastTouchedAt: string;
  priorityScore: number;
};

const auth = useAuthStore();

const hasStatusCode = (error: unknown): error is { status: number } => (
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number'
);

const isRoleUnavailableError = (error: unknown) => (
  hasStatusCode(error)
  && [401, 403, 404].includes(error.status)
);

const isReadyCapabilityState = (state: CapabilityLoadState) => state === 'ready';

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const ownerOrders = ref<OrderRecord[]>([]);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const ownerAftersalesSignals = ref<OwnerAftersalesSignal[]>([]);

const loading = ref(false);
const ownerCapabilityState = ref<CapabilityLoadState>('idle');
const caregiverCapabilityState = ref<CapabilityLoadState>('idle');
const ownerCapabilityErrorMessage = ref('');
const caregiverCapabilityErrorMessage = ref('');
const ownerCapabilityNotice = ref('');
const caregiverCapabilityNotice = ref('');
const retryingSection = ref<'owner' | 'caregiver' | ''>('');
const scope = ref<ReminderScope>('ALL');
const highOnly = ref(false);
const keyword = ref('');

const formatTime = (value: string) => new Date(value).toLocaleString();

const formatRange = (startAt: string, endAt: string) => (
  `${formatTime(startAt)} - ${formatTime(endAt)}`
);

const toNumber = (value: number | string | null | undefined) => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

const getPriorityWeight = (priority: ReminderPriority) => ({
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}[priority]);

const getPriorityLabel = (priority: ReminderPriority) => ({
  HIGH: '优先处理',
  MEDIUM: '持续跟进',
  LOW: '保持关注',
}[priority]);

const getPriorityTagType = (
  priority: ReminderPriority,
): 'danger' | 'warning' | 'success' => {
  const map: Record<ReminderPriority, 'danger' | 'warning' | 'success'> = {
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'success',
  };
  return map[priority];
};

const getRoleLabel = (role: ReminderRole) => ({
  OWNER: '主人',
  CAREGIVER: '照料者',
}[role]);

const getRoleTagType = (
  role: ReminderRole,
): 'primary' | 'warning' => {
  const map: Record<ReminderRole, 'primary' | 'warning'> = {
    OWNER: 'primary',
    CAREGIVER: 'warning',
  };
  return map[role];
};

const sortReminderCards = (items: ReminderCard[]) => [...items]
  .sort((left, right) => {
    const priorityDiff = getPriorityWeight(right.priority) - getPriorityWeight(left.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return left.title.localeCompare(right.title);
  });

const matchesKeyword = (input: string, values: Array<string | null | undefined>) => {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return values.some(value => value?.toLowerCase().includes(normalized));
};

const mergeCapabilityNotice = (items: string[]) => {
  const normalized = items
    .map(item => item.trim().replace(/[。.]$/, ''))
    .filter(Boolean);
  return normalized.length ? `${normalized.join('；')}。` : '';
};

const resetReminderFilters = () => {
  scope.value = 'ALL';
  highOnly.value = false;
  keyword.value = '';
};

const isUpcomingWindow = (value: string) => {
  const timestamp = new Date(value).getTime();
  const now = Date.now();
  const sixHours = 6 * 60 * 60 * 1000;
  const fortyEightHours = 48 * 60 * 60 * 1000;
  return timestamp >= now - sixHours && timestamp <= now + fortyEightHours;
};

const buildComplaintWeight = (status: ComplaintRecord['status']) => ({
  OPEN: 220,
  PROCESSING: 180,
  REJECTED: 90,
  RESOLVED: 40,
}[status] ?? 0);

const buildRefundWeight = (stage: OrderRefundProgressRecord['stage']) => ({
  NONE: 0,
  PENDING_REVIEW: 150,
  APPROVED_WAITING: 130,
  PARTIAL_SUCCESS: 80,
  FULL_SUCCESS: 40,
  REJECTED: 100,
  FAILED: 170,
}[stage] ?? 0);

const ownerUnreadCount = computed(() => ownerOrders.value.reduce((total, item) => (
  total + getPetPalConversationUnreadCount(item.conversation, 'owner')
), 0));

const caregiverUnreadCount = computed(() => caregiverOrders.value.reduce((total, item) => (
  total + getPetPalConversationUnreadCount(item.conversation, 'caregiver')
), 0));

const totalUnreadCount = computed(() => ownerUnreadCount.value + caregiverUnreadCount.value);

const pendingOwnerRequests = computed(() => requests.value.filter(item => (
  item.status === 'OPEN'
  || item.status === 'MATCHED'
)));

const ownerUpcomingOrders = computed(() => [...ownerOrders.value]
  .filter(item => (
    ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)
    && isUpcomingWindow(item.appointmentStart)
  ))
  .sort((left, right) => (
    new Date(left.appointmentStart).getTime() - new Date(right.appointmentStart).getTime()
  )));

const ownerServingOrders = computed(() => ownerOrders.value.filter(item => item.orderStatus === 'SERVING'));

const caregiverPendingOrders = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'PENDING_ACCEPT'));
const caregiverServingOrders = computed(() => caregiverOrders.value.filter(item => item.orderStatus === 'SERVING'));

const caregiverUpcomingOrders = computed(() => [...caregiverOrders.value]
  .filter(item => (
    ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus)
    && isUpcomingWindow(item.appointmentStart)
  ))
  .sort((left, right) => (
    new Date(left.appointmentStart).getTime() - new Date(right.appointmentStart).getTime()
  )));

const caregiverRiskOrders = computed(() => caregiverOrders.value.filter(item => (
  ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(item.orderStatus)
)));

const activeCaregiverServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length);

const totalRiskOrderCount = computed(() => ownerAftersalesSignals.value.length + caregiverRiskOrders.value.length);
const hasVisibleCapability = computed(() => (
  ['idle', 'ready'].includes(ownerCapabilityState.value)
  || ['idle', 'ready'].includes(caregiverCapabilityState.value)
));

const ownerReminderCards = computed<ReminderCard[]>(() => {
  if (ownerCapabilityState.value !== 'ready') {
    return [];
  }

  const cards: ReminderCard[] = [];

  if (!pets.value.length) {
    cards.push({
      id: 'owner-pets',
      role: 'OWNER',
      priority: 'HIGH',
      title: '先建立第一只宠物档案',
      summary: '没有宠物档案时，主人工作台里的需求发布和订单复用都会受阻。',
      detail: '建议先补齐宠物基础信息、喂养备注、健康提醒和紧急联系人，再继续发需求。',
      actionLabel: '去建档',
      actionTo: { name: 'frontend-petpal' },
    });
  }

  if (pendingOwnerRequests.value.length > 0) {
    const firstRequest = pendingOwnerRequests.value[0];
    cards.push({
      id: 'owner-requests',
      role: 'OWNER',
      priority: pendingOwnerRequests.value.length > 2 ? 'HIGH' : 'MEDIUM',
      title: `继续跟进 ${pendingOwnerRequests.value.length} 条主人需求`,
      summary: `${firstRequest.pet?.name || '当前宠物'} · ${getPetPalServiceTypeLabel(firstRequest.serviceType)} · ${getPetPalServiceRequestStatusLabel(firstRequest.status)}`,
      detail: '建议优先核对时间、地点和预算，避免需求长期停在待匹配或待确认状态。',
      actionLabel: '查看需求',
      actionTo: { name: 'frontend-petpal' },
    });
  }

  if (ownerUpcomingOrders.value.length > 0) {
    const upcomingOrder = ownerUpcomingOrders.value[0];
    cards.push({
      id: 'owner-upcoming-order',
      role: 'OWNER',
      priority: 'HIGH',
      title: '有订单将在 48 小时内开始',
      summary: `${upcomingOrder.orderNo} · ${getPetPalServiceTypeLabel(upcomingOrder.serviceType)}`,
      detail: `建议提前确认交接说明、地点和沟通渠道。当前安排：${formatRange(upcomingOrder.appointmentStart, upcomingOrder.appointmentEnd)}。`,
      actionLabel: '打开订单',
      actionTo: { name: 'frontend-petpal-order-detail', params: { id: upcomingOrder.id } },
    });
  }

  if (ownerServingOrders.value.length > 0) {
    const servingOrder = ownerServingOrders.value[0];
    cards.push({
      id: 'owner-serving-orders',
      role: 'OWNER',
      priority: 'HIGH',
      title: `有 ${ownerServingOrders.value.length} 笔服务中订单待持续跟进`,
      summary: `${servingOrder.orderNo} 正在履约，建议持续确认签到、服务记录和完成时机。`,
      detail: '主人侧最容易遗漏的是“服务已开始但没有持续回看履约过程”，这里优先提醒补看。',
      actionLabel: '查看履约',
      actionTo: { name: 'frontend-petpal-order-detail', params: { id: servingOrder.id } },
    });
  }

  if (ownerUnreadCount.value > 0) {
    cards.push({
      id: 'owner-unread',
      role: 'OWNER',
      priority: ownerUnreadCount.value > 3 ? 'HIGH' : 'MEDIUM',
      title: `有 ${ownerUnreadCount.value} 条主人侧未读沟通`,
      summary: '订单交接、异常反馈和附件回传都可能在沟通里等待你确认。',
      detail: '建议先统一进入消息中心消化未读，再决定是否需要进入具体订单继续处理。',
      actionLabel: '查看消息',
      actionTo: { name: 'frontend-petpal-messages' },
    });
  }

  if (ownerAftersalesSignals.value.length > 0) {
    const signal = ownerAftersalesSignals.value[0];
    const complaintSummary = signal.latestComplaint
      ? `投诉 ${signal.activeComplaintCount} 条`
      : '当前无活跃投诉';
    const refundSummary = signal.refundProgress
      ? getPetPalRefundProgressStageLabel(signal.refundProgress.stage)
      : '暂无退款';
    cards.push({
      id: 'owner-aftersales',
      role: 'OWNER',
      priority: signal.priorityScore >= 220 ? 'HIGH' : 'MEDIUM',
      title: `有 ${ownerAftersalesSignals.value.length} 笔售后订单待跟进`,
      summary: `${signal.order.orderNo} · ${refundSummary} · ${complaintSummary}`,
      detail: '建议优先处理争议、退款失败、待审核退款和仍在处理中的投诉，再回看已结案记录。',
      actionLabel: '进入售后中心',
      actionTo: { name: 'frontend-petpal-aftersales' },
    });
  }

  if (!cards.length) {
    cards.push({
      id: 'owner-stable',
      role: 'OWNER',
      priority: 'LOW',
      title: '主人主流程当前比较平稳',
      summary: '宠物、需求、订单、沟通和售后暂时没有高优先待办。',
      detail: '如果准备继续使用 PetPal，可以直接进入主人服务台继续建档、发需求或回看最近订单。',
      actionLabel: '进入主人服务台',
      actionTo: { name: 'frontend-petpal' },
    });
  }

  return sortReminderCards(cards);
});

const caregiverReminderCards = computed<ReminderCard[]>(() => {
  if (caregiverCapabilityState.value !== 'ready') {
    return [];
  }

  const cards: ReminderCard[] = [];

  if (!caregiverProfile.value) {
    cards.push({
      id: 'caregiver-profile',
      role: 'CAREGIVER',
      priority: 'MEDIUM',
      title: '如果你要接单，先完善照料者档案',
      summary: '当前还没有照料者档案，或当前账号尚未开启照料者主流程。',
      detail: '先补齐介绍、服务城市、照料经验和资质材料，后续才能更稳定地上架服务和接单。',
      actionLabel: '去入驻',
      actionTo: { name: 'frontend-petpal-caregiver' },
    });
  } else {
    if (caregiverProfile.value.auditStatus === 'REJECTED') {
      cards.push({
        id: 'caregiver-audit-rejected',
        role: 'CAREGIVER',
        priority: 'HIGH',
        title: '照料者档案已被驳回',
        summary: `当前状态：${getPetPalCaregiverAuditLabel(caregiverProfile.value.auditStatus)}`,
        detail: '建议优先补齐介绍、服务城市和资质材料，再重新提交审核，避免继续阻塞接单。',
        actionLabel: '修正档案',
        actionTo: { name: 'frontend-petpal-caregiver' },
      });
    }

    if (caregiverProfile.value.auditStatus === 'PENDING') {
      cards.push({
        id: 'caregiver-audit-pending',
        role: 'CAREGIVER',
        priority: 'MEDIUM',
        title: '照料者档案仍在审核中',
        summary: '平台正在审核你的资料，等待期间可以先把服务设置补齐。',
        detail: '审核通过后，服务上架与接单就不需要再等第二轮补配置。',
        actionLabel: '完善服务',
        actionTo: { name: 'frontend-petpal-caregiver' },
      });
    }
  }

  if (caregiverProfile.value && activeCaregiverServiceCount.value === 0) {
    cards.push({
      id: 'caregiver-services',
      role: 'CAREGIVER',
      priority: 'HIGH',
      title: '照料者端还没有上架服务',
      summary: '没有上架服务时，主人侧无法稳定看到你的可售能力。',
      detail: '建议先补一个主服务并设置价格、时效和适配宠物，再开始接单。',
      actionLabel: '管理服务',
      actionTo: { name: 'frontend-petpal-caregiver' },
    });
  }

  if (caregiverPendingOrders.value.length > 0) {
    cards.push({
      id: 'caregiver-pending-orders',
      role: 'CAREGIVER',
      priority: 'HIGH',
      title: `有 ${caregiverPendingOrders.value.length} 笔待接单订单`,
      summary: '待接单过久会直接影响成单率和主人信任。',
      detail: '建议先进入照料者工作台统一处理接单动作，并补齐接单前的必要沟通。',
      actionLabel: '处理接单',
      actionTo: { name: 'frontend-petpal-caregiver' },
    });
  }

  if (caregiverServingOrders.value.length > 0) {
    const servingOrder = caregiverServingOrders.value[0];
    cards.push({
      id: 'caregiver-serving-orders',
      role: 'CAREGIVER',
      priority: 'MEDIUM',
      title: `有 ${caregiverServingOrders.value.length} 笔服务中订单待回传`,
      summary: `${servingOrder.orderNo} 正在服务中，建议及时上传服务记录和补充说明。`,
      detail: '服务日志越及时，主人确认和售后透明度就越高。',
      actionLabel: '查看履约',
      actionTo: { name: 'frontend-petpal-order-detail', params: { id: servingOrder.id } },
    });
  }

  if (caregiverUnreadCount.value > 0) {
    cards.push({
      id: 'caregiver-unread',
      role: 'CAREGIVER',
      priority: caregiverUnreadCount.value > 3 ? 'HIGH' : 'MEDIUM',
      title: `有 ${caregiverUnreadCount.value} 条照料者侧未读沟通`,
      summary: '待接单确认、交接细节和异常反馈都可能阻塞履约。',
      detail: '建议先统一进入消息中心清掉未读，避免在多个订单之间来回切换。',
      actionLabel: '查看消息',
      actionTo: { name: 'frontend-petpal-messages' },
    });
  }

  if (caregiverRiskOrders.value.length > 0) {
    const riskOrder = caregiverRiskOrders.value[0];
    cards.push({
      id: 'caregiver-risk',
      role: 'CAREGIVER',
      priority: 'MEDIUM',
      title: `有 ${caregiverRiskOrders.value.length} 笔订单涉及争议或退款`,
      summary: `${riskOrder.orderNo} · ${getPetPalOrderStatusLabel(riskOrder.orderStatus)}`,
      detail: '这些订单会影响收入沉淀、评分和后续复购，建议及时回看订单详情与沟通记录。',
      actionLabel: '查看订单',
      actionTo: { name: 'frontend-petpal-order-detail', params: { id: riskOrder.id } },
    });
  }

  if (!cards.length) {
    cards.push({
      id: 'caregiver-stable',
      role: 'CAREGIVER',
      priority: 'LOW',
      title: '照料者侧当前没有高风险待办',
      summary: '审核、服务、接单、履约和消息暂时比较平稳。',
      detail: '可以继续优化档案、报价和服务说明，或回看最近订单，提升接单效率。',
      actionLabel: '进入照料者工作台',
      actionTo: { name: 'frontend-petpal-caregiver' },
    });
  }

  return sortReminderCards(cards);
});

const filterReminderCards = (items: ReminderCard[]) => items.filter((item) => {
  if (highOnly.value && item.priority !== 'HIGH') {
    return false;
  }

  return matchesKeyword(keyword.value, [
    item.title,
    item.summary,
    item.detail,
    item.actionLabel,
  ]);
});

const filteredOwnerReminderCards = computed(() => filterReminderCards(ownerReminderCards.value));
const filteredCaregiverReminderCards = computed(() => filterReminderCards(caregiverReminderCards.value));

const filteredReminderCards = computed(() => {
  if (scope.value === 'OWNER') {
    return filteredOwnerReminderCards.value;
  }
  if (scope.value === 'CAREGIVER') {
    return filteredCaregiverReminderCards.value;
  }
  return [
    ...filteredOwnerReminderCards.value,
    ...filteredCaregiverReminderCards.value,
  ];
});

const highPriorityCards = computed(() => sortReminderCards(filteredReminderCards.value.filter(item => item.priority === 'HIGH')));
const shouldShowOwnerSection = computed(() => scope.value === 'ALL' || scope.value === 'OWNER');
const shouldShowCaregiverSection = computed(() => scope.value === 'ALL' || scope.value === 'CAREGIVER');

const scheduleCards = computed<ScheduleCard[]>(() => {
  const ownerItems = ownerCapabilityState.value === 'ready'
    ? ownerUpcomingOrders.value.slice(0, 3).map<ScheduleCard>(item => ({
    id: `owner-${item.id}`,
    role: 'OWNER',
    title: `${item.orderNo} 即将开始`,
    detail: `${getPetPalServiceTypeLabel(item.serviceType)} · ${formatRange(item.appointmentStart, item.appointmentEnd)}`,
    status: getPetPalOrderStatusLabel(item.orderStatus),
    sortAt: new Date(item.appointmentStart).getTime(),
    actionTo: { name: 'frontend-petpal-order-detail', params: { id: item.id } },
    }))
    : [];

  const caregiverItems = caregiverCapabilityState.value === 'ready'
    ? caregiverUpcomingOrders.value.slice(0, 3).map<ScheduleCard>(item => ({
    id: `caregiver-${item.id}`,
    role: 'CAREGIVER',
    title: `${item.orderNo} 待照料处理`,
    detail: `${item.ownerNickname || '主人未命名'} · ${formatRange(item.appointmentStart, item.appointmentEnd)}`,
    status: getPetPalOrderStatusLabel(item.orderStatus),
    sortAt: new Date(item.appointmentStart).getTime(),
    actionTo: { name: 'frontend-petpal-order-detail', params: { id: item.id } },
    }))
    : [];

  return [...ownerItems, ...caregiverItems]
    .sort((left, right) => left.sortAt - right.sortAt)
    .slice(0, 6);
});

const mediumPriorityCount = computed(() => filteredReminderCards.value.filter(item => item.priority === 'MEDIUM').length);

const summaryCards = computed(() => [
  {
    label: '高优先提醒',
    value: String(highPriorityCards.value.length),
    hint: highPriorityCards.value.length ? '建议先处理可能直接影响履约、成单或售后的事项。' : '当前没有高优先提醒。',
  },
  {
    label: '持续跟进',
    value: String(mediumPriorityCount.value),
    hint: mediumPriorityCount.value ? '这些事项不紧急，但持续拖延会影响体验。' : '当前没有需要持续跟进的事项。',
  },
  {
    label: '未读沟通',
    value: String(totalUnreadCount.value),
    hint: totalUnreadCount.value ? '主人端和照料者端未读会话已经统一纳入这里。' : '当前沟通都已读。',
  },
  {
    label: '风险订单',
    value: String(totalRiskOrderCount.value),
    hint: totalRiskOrderCount.value ? '包含主人售后订单与照料者侧争议/退款订单。' : '当前没有售后或争议风险订单。',
  },
]);

const loadPets = async () => {
  pets.value = await api.petpal.pets.list();
};

const loadRequests = async () => {
  requests.value = await api.petpal.requests.list();
};

const loadOwnerOrders = async () => {
  ownerOrders.value = await api.petpal.orders.list();
};

const loadCaregiverProfile = async () => {
  caregiverProfile.value = await api.petpal.caregiver.profile();
};

const loadCaregiverServices = async () => {
  caregiverServices.value = await api.petpal.caregiver.services();
};

const loadCaregiverOrders = async () => {
  const page = await api.petpal.caregiver.orders({
    page: 1,
    pageSize: 50,
  });
  caregiverOrders.value = page.items;
};

const loadOwnerAftersalesSignals = async (orders: OrderRecord[]) => {
  const candidates = [...orders]
    .filter(order => (
      ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)
      || order.refunds.length > 0
      || toNumber(order.amountRefunded) > 0
    ))
    .sort((left, right) => (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    ))
    .slice(0, 12);

  if (!candidates.length) {
    ownerAftersalesSignals.value = [];
    return '';
  }

  let refundFailures = 0;
  let complaintFailures = 0;

  const results: Array<OwnerAftersalesSignal | null> = await Promise.all(candidates.map(async (order) => {
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

    const hasSignal = (
      Boolean(refundProgress && refundProgress.stage !== 'NONE')
      || complaints.length > 0
      || ['DISPUTED', 'PARTIAL_REFUNDED', 'REFUNDED'].includes(order.orderStatus)
    );

    if (!hasSignal) {
      return null;
    }

    const latestComplaint = complaints[0] ?? null;
    const activeComplaintCount = complaints.filter(item => ['OPEN', 'PROCESSING'].includes(item.status)).length;
    const unreadScore = getPetPalConversationUnreadCount(order.conversation, 'owner') * 60;
    const priorityScore = unreadScore
      + (refundProgress ? buildRefundWeight(refundProgress.stage) : 0)
      + (latestComplaint ? buildComplaintWeight(latestComplaint.status) : 0);

    return {
      order,
      refundProgress,
      latestComplaint,
      activeComplaintCount,
      lastTouchedAt: latestComplaint?.updatedAt
        ?? refundProgress?.latestReviewedAt
        ?? refundProgress?.latestAppliedAt
        ?? order.updatedAt,
      priorityScore,
    } satisfies OwnerAftersalesSignal;
  }));

  ownerAftersalesSignals.value = results
    .filter((item): item is OwnerAftersalesSignal => item !== null)
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }
      return new Date(right.lastTouchedAt).getTime() - new Date(left.lastTouchedAt).getTime();
    });

  const notices: string[] = [];
  if (refundFailures > 0) {
    notices.push(`有 ${refundFailures} 笔订单的退款进度未能完整加载，可进入订单详情继续查看`);
  }

  if (complaintFailures > 0) {
    notices.push(`有 ${complaintFailures} 笔订单的投诉进度未能完整加载，可进入售后中心继续查看`);
  }

  return mergeCapabilityNotice(notices);
};

const loadOwnerCapability = async () => {
  pets.value = [];
  requests.value = [];
  ownerOrders.value = [];
  ownerAftersalesSignals.value = [];
  ownerCapabilityErrorMessage.value = '';
  ownerCapabilityNotice.value = '';

  const notices: string[] = [];
  let successCount = 0;
  let roleUnavailableCount = 0;

  const results = await Promise.allSettled([
    loadPets(),
    loadRequests(),
    loadOwnerOrders(),
  ]);

  if (results[0].status === 'fulfilled') {
    successCount += 1;
  } else if (isRoleUnavailableError(results[0].reason)) {
    roleUnavailableCount += 1;
  } else {
    notices.push(getErrorMessage(results[0].reason, '宠物档案未能加载，当前仅展示其余主人提醒'));
  }

  if (results[1].status === 'fulfilled') {
    successCount += 1;
  } else if (isRoleUnavailableError(results[1].reason)) {
    roleUnavailableCount += 1;
  } else {
    notices.push(getErrorMessage(results[1].reason, '主人需求未能加载，当前仅展示其余主人提醒'));
  }

  if (results[2].status === 'fulfilled') {
    successCount += 1;
  } else if (isRoleUnavailableError(results[2].reason)) {
    roleUnavailableCount += 1;
  } else {
    notices.push(getErrorMessage(results[2].reason, '主人订单未能加载，当前仅展示建档和需求提醒'));
  }

  if (successCount === 0 && roleUnavailableCount === results.length) {
    ownerCapabilityState.value = 'role_unavailable';
    return;
  }

  if (successCount === 0) {
    ownerCapabilityState.value = 'error';
    ownerCapabilityErrorMessage.value = mergeCapabilityNotice(notices) || '主人提醒暂时不可用，请稍后重试。';
    return;
  }

  ownerCapabilityState.value = 'ready';

  if (results[2].status === 'fulfilled') {
    try {
      const aftersalesNotice = await loadOwnerAftersalesSignals(ownerOrders.value);
      if (aftersalesNotice) {
        notices.push(aftersalesNotice);
      }
    } catch (error: unknown) {
      ownerAftersalesSignals.value = [];
      notices.push(getErrorMessage(error, '售后提醒未能加载，当前仅展示其余主人提醒'));
    }
  }

  ownerCapabilityNotice.value = mergeCapabilityNotice(notices);
};

const loadCaregiverCapability = async () => {
  caregiverProfile.value = null;
  caregiverServices.value = [];
  caregiverOrders.value = [];
  caregiverCapabilityErrorMessage.value = '';
  caregiverCapabilityNotice.value = '';

  const notices: string[] = [];
  let successCount = 0;
  let roleUnavailableCount = 0;

  const results = await Promise.allSettled([
    loadCaregiverProfile(),
    loadCaregiverServices(),
    loadCaregiverOrders(),
  ]);

  if (results[0].status === 'fulfilled') {
    successCount += 1;
  } else if (isRoleUnavailableError(results[0].reason)) {
    roleUnavailableCount += 1;
  } else {
    notices.push(getErrorMessage(results[0].reason, '照料者档案未能加载，当前仅展示其余照料提醒'));
  }
  if (results[1].status === 'fulfilled') {
    successCount += 1;
  } else if (isRoleUnavailableError(results[1].reason)) {
    roleUnavailableCount += 1;
  } else {
    notices.push(getErrorMessage(results[1].reason, '照料服务未能加载，当前仅展示其余照料提醒'));
  }
  if (results[2].status === 'fulfilled') {
    successCount += 1;
  } else if (isRoleUnavailableError(results[2].reason)) {
    roleUnavailableCount += 1;
  } else {
    notices.push(getErrorMessage(results[2].reason, '照料者订单未能加载，当前仅展示入驻与服务提醒'));
  }

  if (successCount === 0 && roleUnavailableCount === results.length) {
    caregiverCapabilityState.value = 'role_unavailable';
    return;
  }

  if (successCount === 0) {
    caregiverCapabilityState.value = 'error';
    caregiverCapabilityErrorMessage.value = mergeCapabilityNotice(notices) || '照料者提醒暂时不可用，请稍后重试。';
    return;
  }

  caregiverCapabilityState.value = 'ready';
  caregiverCapabilityNotice.value = mergeCapabilityNotice(notices);
};

const reloadAll = async () => {
  if (!auth.isAuthenticated) {
    ElMessage.info('登录后可查看提醒中心');
    return;
  }

  loading.value = true;
  ownerCapabilityState.value = 'idle';
  caregiverCapabilityState.value = 'idle';
  try {
    await Promise.all([
      loadOwnerCapability(),
      loadCaregiverCapability(),
    ]);
  } finally {
    loading.value = false;
  }
};

const retryOwnerCapability = async () => {
  retryingSection.value = 'owner';
  ownerCapabilityState.value = 'idle';
  try {
    await loadOwnerCapability();
    if (isReadyCapabilityState(ownerCapabilityState.value)) {
      ElMessage.success('主人提醒已刷新');
    }
  } finally {
    retryingSection.value = '';
  }
};

const retryCaregiverCapability = async () => {
  retryingSection.value = 'caregiver';
  caregiverCapabilityState.value = 'idle';
  try {
    await loadCaregiverCapability();
    if (isReadyCapabilityState(caregiverCapabilityState.value)) {
      ElMessage.success('照料者提醒已刷新');
    }
  } finally {
    retryingSection.value = '';
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

.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-grid-span-8 {
  grid-column: span 8;
}

.petpal-summary-value {
  display: block;
  font-size: 32px;
  line-height: 1.05;
  color: #17384a;
}

.petpal-summary-copy,
.petpal-empty-state,
.petpal-reminder-card__summary,
.petpal-reminder-card__detail,
.petpal-schedule-card p {
  margin: 0;
  color: var(--frontend-color-muted);
  line-height: 1.7;
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
.petpal-reminder-card h4,
.petpal-schedule-card h4 {
  margin: 0;
}

.petpal-filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.petpal-reminder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.petpal-reminder-card,
.petpal-schedule-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.petpal-reminder-card.is-priority {
  background:
    radial-gradient(circle at top right, rgba(251, 191, 36, 0.18), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 235, 0.96) 0%, rgba(255, 255, 255, 0.82) 100%);
}

.petpal-reminder-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.petpal-reminder-card__tags,
.petpal-schedule-card__tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.petpal-schedule-list {
  display: grid;
  gap: 12px;
}

@media (max-width: 1200px) {
  .petpal-grid-span-3,
  .petpal-grid-span-4,
  .petpal-grid-span-8 {
    grid-column: span 12;
  }
}

@media (max-width: 720px) {
  .petpal-section-heading,
  .petpal-filter-toolbar,
  .petpal-reminder-card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .petpal-reminder-grid {
    grid-template-columns: 1fr;
  }
}
</style>
