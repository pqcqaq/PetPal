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
    <PetPalDeskSection eyebrow="Priority" title="最高优先待办" description="优先只显示最值得马上进入的页面。">
      <PetPalDeskEmpty
        v-if="!priorityTasks.length"
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
      <PetPalDeskSection class="petpal-span-6" eyebrow="Owner" title="主人侧待办" description="宠物、需求、订单和售后相关提醒。">
        <PetPalDeskEmpty
          v-if="!ownerTasks.length"
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

      <PetPalDeskSection class="petpal-span-6" eyebrow="Caregiver" title="照料者侧待办" description="资料、服务和履约相关提醒。">
        <PetPalDeskEmpty
          v-if="!caregiverTasks.length"
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
import { RouterLink } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { getPetPalCaregiverAuditLabel, getPetPalConversationUnreadCount, isPetPalAftersalesStatus, isPetPalOutstandingOrder, petPalOwnerWorkspaceNav } from './shared';

type ReminderTask = {
  title: string;
  description: string;
  actionLabel: string;
  to: { name: string };
  priority: number;
};

const pets = ref<PetProfileRecord[]>([]);
const requests = ref<ServiceRequestRecord[]>([]);
const ownerOrders = ref<OrderRecord[]>([]);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const caregiverServices = ref<CaregiverServiceRecord[]>([]);
const caregiverOrders = ref<CaregiverOrderRecord[]>([]);

const ownerTasks = computed<ReminderTask[]>(() => {
  const tasks: ReminderTask[] = [];
  if (!pets.value.length) {
    tasks.push({
      title: '先建立第一只宠物档案',
      description: '没有宠物档案时，需求和订单流程都无法顺畅开始。',
      actionLabel: '去建档',
      to: { name: 'frontend-petpal-pet-create' },
      priority: 100,
    });
  }
  if (requests.value.some((item) => ['OPEN', 'MATCHED', 'MATCHING', 'CONFIRMED'].includes(item.status))) {
    tasks.push({
      title: '有活跃需求等待继续处理',
      description: '建议回需求队列查看匹配结果并决定是否创建订单。',
      actionLabel: '去需求队列',
      to: { name: 'frontend-petpal-requests' },
      priority: 80,
    });
  }
  if (ownerOrders.value.some((item) => isPetPalOutstandingOrder(item))) {
    tasks.push({
      title: '存在待支付订单',
      description: '订单金额未结清时，建议优先进入订单队列完成支付。',
      actionLabel: '去订单队列',
      to: { name: 'frontend-petpal-orders' },
      priority: 95,
    });
  }
  if (ownerOrders.value.some((item) => isPetPalAftersalesStatus(item.orderStatus))) {
    tasks.push({
      title: '售后链路中有订单待回看',
      description: '退款或投诉中的订单已经独立收口到售后中心。',
      actionLabel: '去售后中心',
      to: { name: 'frontend-petpal-aftersales' },
      priority: 90,
    });
  }
  if (ownerOrders.value.some((item) => getPetPalConversationUnreadCount(item.conversation, 'owner') > 0)) {
    tasks.push({
      title: '存在主人侧未读消息',
      description: '跨订单消息已经独立，不必逐个订单翻找。',
      actionLabel: '去消息中心',
      to: { name: 'frontend-petpal-messages' },
      priority: 70,
    });
  }
  return tasks.sort((left, right) => right.priority - left.priority);
});

const caregiverTasks = computed<ReminderTask[]>(() => {
  const tasks: ReminderTask[] = [];
  if (!caregiverProfile.value) {
    tasks.push({
      title: '先完成照料者入驻资料',
      description: '没有资料时，后续服务和审核都无法进入稳定状态。',
      actionLabel: '去资料页',
      to: { name: 'frontend-petpal-caregiver-profile' },
      priority: 100,
    });
  }
  if (caregiverProfile.value && getPetPalCaregiverAuditLabel(caregiverProfile.value.auditStatus) !== '已通过') {
    tasks.push({
      title: '关注资料审核状态',
      description: `当前资料状态：${getPetPalCaregiverAuditLabel(caregiverProfile.value.auditStatus)}。`,
      actionLabel: '去资料页',
      to: { name: 'frontend-petpal-caregiver-profile' },
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
  if (caregiverOrders.value.some((item) => ['PENDING_ACCEPT', 'ACCEPTED', 'SERVING'].includes(item.orderStatus))) {
    tasks.push({
      title: '存在待处理履约订单',
      description: '接单、签到、服务记录和签退都已经收口到履约页。',
      actionLabel: '去履约页',
      to: { name: 'frontend-petpal-caregiver-orders' },
      priority: 96,
    });
  }
  if (caregiverOrders.value.some((item) => getPetPalConversationUnreadCount(item.conversation, 'caregiver') > 0)) {
    tasks.push({
      title: '存在照料者侧未读消息',
      description: '建议先进入消息中心确认是否需要回复或回传履约说明。',
      actionLabel: '去消息中心',
      to: { name: 'frontend-petpal-messages' },
      priority: 72,
    });
  }
  return tasks.sort((left, right) => right.priority - left.priority);
});

const priorityTasks = computed(() => [...ownerTasks.value, ...caregiverTasks.value].sort((left, right) => right.priority - left.priority).slice(0, 3));
const heroStats = computed(() => [
  { label: '高优先待办', value: String(priorityTasks.value.length), hint: '最多展示最该优先处理的 3 条' },
  { label: '主人侧待办', value: String(ownerTasks.value.length), hint: '宠物 / 需求 / 订单 / 售后' },
  { label: '照料者待办', value: String(caregiverTasks.value.length), hint: '资料 / 服务 / 履约' },
  { label: '当前策略', value: '先分流再处理', hint: '提醒中心不再直接承载业务细节' },
]);

async function loadPage() {
  const [petsResult, requestsResult, ownerOrdersResult, caregiverProfileResult, caregiverServicesResult, caregiverOrdersResult] = await Promise.allSettled([
    api.petpal.pets.list(),
    api.petpal.requests.list(),
    api.petpal.orders.list(),
    api.petpal.caregiver.profile(),
    api.petpal.caregiver.services(),
    api.petpal.caregiver.orders({ page: 1, pageSize: 50 }),
  ]);

  pets.value = petsResult.status === 'fulfilled' ? petsResult.value : [];
  requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : [];
  ownerOrders.value = ownerOrdersResult.status === 'fulfilled' ? ownerOrdersResult.value : [];
  caregiverProfile.value = caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null;
  caregiverServices.value = caregiverServicesResult.status === 'fulfilled' ? caregiverServicesResult.value : [];
  caregiverOrders.value = caregiverOrdersResult.status === 'fulfilled' ? caregiverOrdersResult.value.items : [];

  if (
    petsResult.status === 'rejected'
    && requestsResult.status === 'rejected'
    && ownerOrdersResult.status === 'rejected'
    && caregiverProfileResult.status === 'rejected'
  ) {
    ElMessage.error(getErrorMessage(ownerOrdersResult.reason, '加载提醒中心失败'));
  }
}

onMounted(() => {
  void loadPage();
});
</script>
