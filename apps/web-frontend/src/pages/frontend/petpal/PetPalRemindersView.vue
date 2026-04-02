<template>
  <PetPalDeskPage
    eyebrow="提醒中心"
    title="把跨主人、照料者和售后的待办收口到一页"
    summary="提醒中心只回答现在先去哪里，不再在一个页面里同时展示大量业务明细。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-reminders"
    :actions="[{ label: '消息中心', to: { name: 'frontend-petpal-messages' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="ownerState === 'error' || ownerNeedsRetry"
            :loading="sectionReloadingKey === 'owner'"
            @click="retryOwnerTasks"
          >
            重试主人侧
          </el-button>
          <el-button
            v-if="caregiverState === 'error' || caregiverNeedsRetry"
            :loading="sectionReloadingKey === 'caregiver'"
            @click="retryCaregiverTasks"
          >
            重试照料者侧
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Priority" title="最高优先待办" description="优先只显示最值得马上进入的页面。">
      <PetPalDeskEmpty
        v-if="ownerState === 'error' && caregiverState === 'error'"
        title="提醒中心暂未刷新完成"
        description="可以分别重试主人侧和照料者侧待办，恢复后再继续分流。"
      />

      <PetPalDeskEmpty
        v-else-if="!priorityTasks.length"
        title="当前没有高优先待办"
        description="可以直接从主人或照料者工作台继续处理下一步。"
      />

      <div v-else class="petpal-sheet-list">
        <div v-for="task in priorityTasks" :key="task.title" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ task.title }}</h3>
            <p class="petpal-sheet-row__desc">{{ task.description }}</p>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="task.to">{{ task.actionLabel }}</RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection
        class="petpal-span-6"
        :class="{ 'petpal-section-focused': focusedRole === 'owner' }"
        eyebrow="Owner"
        title="主人侧待办"
        description="宠物、需求、订单和售后相关提醒。"
      >
        <PetPalDeskEmpty
          v-if="ownerState === 'error'"
          title="主人侧待办暂未刷新完成"
          description="可以只重试主人侧，不会影响照料者侧待办。"
        />

        <PetPalDeskEmpty
          v-else-if="ownerState === 'role_unavailable'"
          title="当前未开通主人侧能力"
          description="主人侧待办会在建立主人角色后自动接入，这里先只保留照料者侧分流。"
        />

        <PetPalDeskEmpty
          v-else-if="!ownerTasks.length"
          title="主人侧当前没有待办"
          description="主人链路当前没有必须优先处理的事项。"
        />

        <div v-else class="petpal-sheet-list">
          <div v-for="task in ownerTasks" :key="task.title" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ task.title }}</h3>
              <p class="petpal-sheet-row__desc">{{ task.description }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink :to="task.to">{{ task.actionLabel }}</RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection
        class="petpal-span-6"
        :class="{ 'petpal-section-focused': focusedRole === 'caregiver' }"
        eyebrow="Caregiver"
        title="照料者侧待办"
        description="资料、服务和履约相关提醒。"
      >
        <PetPalDeskEmpty
          v-if="caregiverState === 'error'"
          title="照料者侧待办暂未刷新完成"
          description="可以只重试照料者侧，不会影响主人侧待办。"
        />

        <PetPalDeskEmpty
          v-else-if="caregiverState === 'role_unavailable'"
          title="当前未开通照料者侧能力"
          description="照料者侧待办会在建立入驻资料后自动接入，这里先只保留主人侧分流。"
        />

        <PetPalDeskEmpty
          v-else-if="!caregiverTasks.length"
          title="照料者侧当前没有待办"
          description="照料者链路当前没有必须优先处理的事项。"
        />

        <div v-else class="petpal-sheet-list">
          <div v-for="task in caregiverTasks" :key="task.title" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ task.title }}</h3>
              <p class="petpal-sheet-row__desc">{{ task.description }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink :to="task.to">{{ task.actionLabel }}</RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, CaregiverProfileRecord, CaregiverServiceRecord, OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, type RouteLocationRaw, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalDeskHandoffQuery,
  getPetPalDeskFocusRole,
  getPetPalQueryString,
  mergePetPalPageNotice,
  runPetPalSectionRetry,
  type PetPalRoleAwareSectionLoadState,
} from './recovery';
import { getPetPalCaregiverAuditLabel, getPetPalConversationUnreadCount, isPetPalAftersalesStatus, isPetPalOutstandingOrder, petPalOwnerWorkspaceNav } from './shared';

type ReminderTask = {
  title: string;
  description: string;
  actionLabel: string;
  to: RouteLocationRaw;
  priority: number;
};

const route = useRoute();

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const ownerOrders = ref<OrderRecord[]>([]);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);
const ownerState = ref<PetPalRoleAwareSectionLoadState>('idle');
const caregiverState = ref<PetPalRoleAwareSectionLoadState>('idle');
const ownerNeedsRetry = ref(false);
const caregiverNeedsRetry = ref(false);
const sectionReloadingKey = ref<'' | 'owner' | 'caregiver'>('');

const focusedRole = computed(() => getPetPalDeskFocusRole(route.query));
const firstActiveRequest = computed(() =>
  requests.value.find((item) => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status)) ?? null,
);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    ownerState.value === 'error'
      ? '主人侧待办暂未刷新完成，可只重试主人侧'
      : ownerNeedsRetry.value
        ? '主人侧待办有部分数据未刷新完成，可只重试主人侧'
        : ownerState.value === 'role_unavailable' && focusedRole.value === 'owner'
          ? '当前账号还没有主人侧能力，可先处理照料者侧待办'
          : '',
    caregiverState.value === 'error'
      ? '照料者侧待办暂未刷新完成，可只重试照料者侧'
      : caregiverNeedsRetry.value
        ? '照料者侧待办有部分数据未刷新完成，可只重试照料者侧'
        : caregiverState.value === 'role_unavailable' && focusedRole.value === 'caregiver'
          ? '当前账号还没有照料者侧能力，可先处理主人侧待办'
          : '',
  ]);
  if (!description) {
    return null;
  }
  const hasError = ownerState.value === 'error'
    || caregiverState.value === 'error'
    || ownerNeedsRetry.value
    || caregiverNeedsRetry.value;
  return {
    title: hasError
      ? '提醒中心还有部分待办未刷新完整'
      : focusedRole.value === 'caregiver'
        ? '已回到照料者侧待办'
        : focusedRole.value === 'owner'
          ? '已回到主人侧待办'
          : '已回到提醒中心',
    description,
    tone: hasError ? 'warning' as const : 'accent' as const,
  };
});

const hasStatus = (error: unknown): error is { status: number } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number';

const isRoleUnavailableError = (error: unknown) =>
  hasStatus(error) && [401, 403, 404].includes(error.status);

const resolveReminderSectionState = (results: PromiseSettledResult<unknown>[]): {
  state: PetPalRoleAwareSectionLoadState;
  needsRetry: boolean;
} => {
  const rejected = results.filter((item): item is PromiseRejectedResult => item.status === 'rejected');
  const retryable = rejected.filter((item) => !isRoleUnavailableError(item.reason));
  return {
    state: rejected.length === 0
      ? 'ready'
      : rejected.length === results.length && retryable.length === 0
        ? 'role_unavailable'
        : rejected.length === results.length
          ? 'error'
          : 'ready',
    needsRetry: retryable.length > 0,
  };
};

const ownerTasks = computed<ReminderTask[]>(() => {
  const tasks: ReminderTask[] = [];
  const firstOutstandingOrder = ownerOrders.value.find((item) => isPetPalOutstandingOrder(item));
  const firstAftersalesOrder = ownerOrders.value.find((item) => isPetPalAftersalesStatus(item.orderStatus));
  const firstUnreadOwnerOrder = ownerOrders.value.find((item) => getPetPalConversationUnreadCount(item.conversation, 'owner') > 0);
  if (!pets.value.length) {
    tasks.push({
      title: '先建立第一只宠物档案',
      description: '没有宠物档案时，需求和订单流程都无法顺畅开始。',
      actionLabel: '去建档',
      to: { name: 'frontend-petpal-pet-create' },
      priority: 100,
    });
  }
  if (firstActiveRequest.value) {
    tasks.push({
      title: '有活跃需求等待继续处理',
      description: '建议回需求队列查看匹配结果并决定是否创建订单。',
      actionLabel: '去需求队列',
      to: {
        name: 'frontend-petpal-requests',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一条活跃需求，可直接继续看匹配和下单。',
          focusRequestId: firstActiveRequest.value.id,
        }),
      },
      priority: 80,
    });
  }
  if (firstOutstandingOrder) {
    tasks.push({
      title: '存在待支付订单',
      description: '订单金额未结清时，建议优先进入订单队列完成支付。',
      actionLabel: '去订单队列',
      to: {
        name: 'frontend-petpal-orders',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一笔待支付订单，可直接继续付款。',
          focusOrderId: firstOutstandingOrder.id,
          focusFilter: 'needs_payment',
        }),
      },
      priority: 95,
    });
  }
  if (firstAftersalesOrder) {
    tasks.push({
      title: '售后链路中有订单待回看',
      description: '退款或投诉中的订单已经独立收口到售后中心。',
      actionLabel: '去售后中心',
      to: {
        name: 'frontend-petpal-aftersales',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到当前最急的一笔售后订单，可直接继续跟进。',
          focusOrderId: firstAftersalesOrder.id,
        }),
      },
      priority: 90,
    });
  }
  if (firstUnreadOwnerOrder) {
    tasks.push({
      title: '存在主人侧未读消息',
      description: '跨订单消息已经独立，不必逐个订单翻找。',
      actionLabel: '去消息中心',
      to: {
        name: 'frontend-petpal-messages',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一笔有未读消息的订单，可直接继续沟通。',
          focusOrderId: firstUnreadOwnerOrder.id,
          focusRole: 'owner',
        }),
      },
      priority: 70,
    });
  }
  return tasks.sort((left, right) => right.priority - left.priority);
});

const caregiverTasks = computed<ReminderTask[]>(() => {
  const tasks: ReminderTask[] = [];
  const firstActiveCaregiverOrder = caregiverOrders.value.find((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus));
  const firstUnreadCaregiverOrder = caregiverOrders.value.find((item) => getPetPalConversationUnreadCount(item.conversation, 'caregiver') > 0);
  if (!caregiverProfile.value) {
    tasks.push({
      title: '先完成照料者入驻资料',
      description: '没有资料时，后续服务和审核都无法进入稳定状态。',
      actionLabel: '去资料页',
      to: {
        name: 'frontend-petpal-caregiver-profile',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到入驻资料页，可先补齐城市、经验和资质材料。',
        }),
      },
      priority: 100,
    });
  }
  if (caregiverProfile.value && getPetPalCaregiverAuditLabel(caregiverProfile.value.auditStatus) !== '已通过') {
    tasks.push({
      title: '关注资料审核状态',
      description: `当前资料状态：${getPetPalCaregiverAuditLabel(caregiverProfile.value.auditStatus)}。`,
      actionLabel: '去资料页',
      to: {
        name: 'frontend-petpal-caregiver-profile',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到入驻资料页，可继续补材料或查看审核状态。',
        }),
      },
      priority: 85,
    });
  }
  if (!caregiverServices.value.length) {
    tasks.push({
      title: '还没有在售服务',
      description: '建议至少创建一个服务，让主人端可以在匹配中看到你。',
      actionLabel: '去新建服务',
      to: { name: 'frontend-petpal-caregiver-service-create' },
      priority: 92,
    });
  }
  if (firstActiveCaregiverOrder) {
    tasks.push({
      title: '存在待处理履约订单',
      description: '接单、签到、服务记录和签退都已经收口到履约页。',
      actionLabel: '去履约页',
      to: {
        name: 'frontend-petpal-caregiver-orders',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一笔需要继续履约的订单，可直接处理。',
          focusOrderId: firstActiveCaregiverOrder.id,
          focusRole: 'caregiver',
        }),
      },
      priority: 96,
    });
  }
  if (firstUnreadCaregiverOrder) {
    tasks.push({
      title: '存在照料者侧未读消息',
      description: '建议先进入消息中心确认是否需要回复或回传履约说明。',
      actionLabel: '去消息中心',
      to: {
        name: 'frontend-petpal-messages',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到最近一笔需要回复的照料者会话，可直接继续沟通。',
          focusOrderId: firstUnreadCaregiverOrder.id,
          focusRole: 'caregiver',
        }),
      },
      priority: 72,
    });
  }
  return tasks.sort((left, right) => right.priority - left.priority);
});

const priorityTasks = computed(() =>
  [...ownerTasks.value, ...caregiverTasks.value]
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 3),
);
const heroStats = computed(() => [
  { label: '高优先待办', value: String(priorityTasks.value.length), hint: '最多展示最该优先处理的 3 条' },
  { label: '主人侧待办', value: String(ownerTasks.value.length), hint: '宠物 / 需求 / 订单 / 售后' },
  { label: '照料者待办', value: String(caregiverTasks.value.length), hint: '资料 / 服务 / 履约' },
  { label: '当前策略', value: '先分流再处理', hint: '提醒中心不再直接承载业务细节' },
]);

async function loadOwnerReminderData() {
  ownerState.value = 'idle';
  const [petsResult, requestsResult, ownerOrdersResult] = await Promise.allSettled([
    api.petpal.pets.list(),
    api.petpal.requests.list(),
    api.petpal.orders.list(),
  ]);

  pets.value = petsResult.status === 'fulfilled' ? petsResult.value : [];
  requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : [];
  ownerOrders.value = ownerOrdersResult.status === 'fulfilled' ? ownerOrdersResult.value : [];

  const result = resolveReminderSectionState([petsResult, requestsResult, ownerOrdersResult]);
  ownerState.value = result.state;
  ownerNeedsRetry.value = result.needsRetry;
}

async function loadCaregiverReminderData() {
  caregiverState.value = 'idle';
  const [caregiverProfileResult, caregiverServicesResult, caregiverOrdersResult] = await Promise.allSettled([
    api.petpal.caregiver.profile(),
    api.petpal.caregiver.services(),
    api.petpal.caregiver.orders({ page: 1, pageSize: 50 }),
  ]);

  caregiverProfile.value = caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null;
  caregiverServices.value = caregiverServicesResult.status === 'fulfilled' ? caregiverServicesResult.value : [];
  caregiverOrders.value = caregiverOrdersResult.status === 'fulfilled' ? caregiverOrdersResult.value.items : [];

  const result = resolveReminderSectionState([caregiverProfileResult, caregiverServicesResult, caregiverOrdersResult]);
  caregiverState.value = result.state;
  caregiverNeedsRetry.value = result.needsRetry;
}

async function loadPage() {
  await Promise.all([
    loadOwnerReminderData(),
    loadCaregiverReminderData(),
  ]);

  if (ownerState.value === 'error' && caregiverState.value === 'error') {
    ElMessage.error('加载提醒中心失败');
  }
}

async function retryOwnerTasks() {
  await runPetPalSectionRetry({
    key: 'owner',
    sectionReloadingKey,
    reload: loadOwnerReminderData,
    getState: () => ownerNeedsRetry.value ? 'error' : ownerState.value,
    successMessage: '主人侧待办已刷新',
    swallowError: true,
  });
}

async function retryCaregiverTasks() {
  await runPetPalSectionRetry({
    key: 'caregiver',
    sectionReloadingKey,
    reload: loadCaregiverReminderData,
    getState: () => caregiverNeedsRetry.value ? 'error' : caregiverState.value,
    successMessage: '照料者侧待办已刷新',
    swallowError: true,
  });
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-section-focused {
  border-color: rgba(37, 99, 235, 0.22);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.08);
}
</style>
