<template>
  <PetPalDeskPage
    eyebrow="照料者工作台"
    title="照料者入口只保留资料、服务和履约三条主线"
    summary="审核资料、上架服务和处理履约订单都已经拆开，不再与主人流混在一起。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver"
    :primary-action="primaryAction"
    :actions="heroActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="profileState === 'error'"
            :loading="sectionReloadingKey === 'profile'"
            @click="retryProfile"
          >
            重试资料区
          </el-button>
          <el-button
            v-if="servicesState === 'error'"
            :loading="sectionReloadingKey === 'services'"
            @click="retryServices"
          >
            重试服务区
          </el-button>
          <el-button
            v-if="ordersState === 'error'"
            :loading="sectionReloadingKey === 'orders'"
            @click="retryOrders"
          >
            重试履约区
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Priority" title="当前下一步" description="照料者总览只负责指出下一步，不承接具体表单。">
      <div class="petpal-sheet-list">
        <div class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ focusTask.title }}</h3>
            <p class="petpal-sheet-row__desc">{{ focusTask.description }}</p>
            <div class="petpal-pill-row">
              <span class="petpal-pill" :class="profile ? 'is-success' : 'is-warning'">{{ profile ? auditLabel : '未建档' }}</span>
              <span class="petpal-pill">服务 {{ services.length }}</span>
              <span class="petpal-pill">履约订单 {{ orders.length }}</span>
            </div>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="focusTask.to">{{ focusTask.actionLabel }}</RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>

    <div class="petpal-split-grid">
      <PetPalDeskSection class="petpal-span-4" eyebrow="Profile" title="入驻资料" description="资料页只做资质和服务能力说明。">
        <PetPalDeskEmpty
          v-if="profileState === 'error'"
          title="入驻资料暂未刷新完成"
          description="可以先重试资料区，恢复后再继续维护入驻信息。"
        />

        <PetPalDeskEmpty
          v-else-if="!profile"
          title="还没有照料者资料"
          description="先完成入驻资料，审核通过后再持续维护服务清单。"
        >
          <template #actions>
            <RouterLink
              class="frontend-page__button is-primary"
              :to="{
                name: 'frontend-petpal-caregiver-profile',
                query: buildPetPalDeskHandoffQuery({
                  notice: '这里已经定位到入驻资料页，可先补齐城市、经验和资质材料。',
                }),
              }"
            >
              去建档
            </RouterLink>
          </template>
        </PetPalDeskEmpty>

        <div v-else class="petpal-sheet-list">
          <div class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ auditLabel }}</h3>
              <p class="petpal-sheet-row__desc">{{ profile.serviceCity || '服务城市待补充' }} · {{ profile.experienceYears }} 年经验 · 半径 {{ profile.serviceRadiusKm }} km</p>
              <div class="petpal-pill-row">
                <span v-for="tag in profile.specialtyTags.slice(0, 3)" :key="tag" class="petpal-pill">{{ tag }}</span>
              </div>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink
                :to="{
                  name: 'frontend-petpal-caregiver-profile',
                  query: buildPetPalDeskHandoffQuery({
                    notice: '这里已经定位到入驻资料页，可继续补材料或查看审核状态。',
                  }),
                }"
              >
                维护资料
              </RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Services" title="服务清单" description="上架、停用和编辑都去服务页完成。">
        <PetPalDeskEmpty
          v-if="servicesState === 'error'"
          title="服务清单暂未刷新完成"
          description="可以先重试服务区，恢复后再继续编辑上下架状态。"
        />

        <PetPalDeskEmpty
          v-else-if="!services.length"
          title="当前没有服务"
          description="服务清单为空时，主人无法稳定匹配到你。"
        >
          <template #actions>
            <RouterLink
              class="frontend-page__button is-primary"
              :to="buildServiceCreateRoute('这里已经定位到新建服务页，可直接继续填写价格、城市和上架状态。')"
            >
              新建服务
            </RouterLink>
          </template>
        </PetPalDeskEmpty>

        <div v-else class="petpal-sheet-list">
          <div v-for="service in services.slice(0, 3)" :key="service.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ getPetPalServiceTypeLabel(service.serviceType) }} / {{ service.petSpecies }}</h3>
              <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(service.pricePerUnit) }}/{{ service.unitType }} · 提前 {{ service.minNoticeHours }} 小时</p>
              <p class="petpal-sheet-row__desc">{{ service.serviceCity || '城市待补充' }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <span class="petpal-pill" :class="service.isActive ? 'is-success' : 'is-warning'">{{ service.isActive ? '在售' : '停用' }}</span>
              <RouterLink
                :to="{
                  name: 'frontend-petpal-caregiver-services',
                  query: buildPetPalDeskHandoffQuery({
                    notice: '这里已经定位到这个服务，可直接继续编辑或调整上架状态。',
                    focusServiceId: service.id,
                  }),
                }"
              >
                去服务页
              </RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Orders" title="履约队列" description="接单、签到、服务记录和签退都放到履约页处理。">
        <PetPalDeskEmpty
          v-if="ordersState === 'error'"
          title="履约队列暂未刷新完成"
          description="可以先重试履约区，恢复后再继续接单或签到。"
        />

        <PetPalDeskEmpty
          v-else-if="!orders.length"
          title="当前没有履约订单"
          description="当主人下单并被你接单后，新的履约订单会出现在这里。"
        />

        <div v-else class="petpal-sheet-list">
          <div v-for="order in orders.slice(0, 3)" :key="order.id" class="petpal-sheet-row">
            <div class="petpal-sheet-row__copy">
              <h3 class="petpal-sheet-row__title">{{ order.orderNo }}</h3>
              <p class="petpal-sheet-row__desc">{{ getPetPalOrderStatusLabel(order.orderStatus) }} · {{ order.ownerNickname }} · {{ order.petName || '宠物待同步' }}</p>
              <p class="petpal-sheet-row__desc">{{ formatPetPalRange(order.appointmentStart, order.appointmentEnd) }}</p>
            </div>
            <div class="petpal-sheet-row__tail">
              <RouterLink
                :to="{
                  name: 'frontend-petpal-caregiver-orders',
                  query: buildPetPalDeskHandoffQuery({
                    notice: '这里已经定位到这笔履约订单，可直接继续接单或签到。',
                    focusOrderId: order.id,
                    focusRole: 'caregiver',
                  }),
                }"
              >
                进入履约
              </RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>
    </div>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverOrderRecord, CaregiverProfileRecord, CaregiverServiceRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalDeskHandoffQuery,
  getPetPalQueryString,
  mergePetPalPageNotice,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalCaregiverAuditLabel,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  petPalCaregiverWorkspaceNav,
} from './shared';

const route = useRoute();
const profile = ref<CaregiverProfileRecord | null>(null);
const services = ref<CaregiverServiceRecord[]>([]);
const orders = ref<CaregiverOrderRecord[]>([]);
const profileState = ref<PetPalSectionLoadState>('idle');
const servicesState = ref<PetPalSectionLoadState>('idle');
const ordersState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'profile' | 'services' | 'orders'>('');
const unreadOrder = computed(() => orders.value.find((item) => (item.conversation?.caregiverUnreadCount || 0) > 0) ?? null);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    profileState.value === 'error' ? '资料区暂未刷新完成，可只重试资料区' : '',
    servicesState.value === 'error' ? '服务区暂未刷新完成，可只重试服务区' : '',
    ordersState.value === 'error' ? '履约区暂未刷新完成，可只重试履约区' : '',
  ]);
  if (!description) {
    return null;
  }
  const hasError = profileState.value === 'error' || servicesState.value === 'error' || ordersState.value === 'error';
  return {
    title: hasError ? '照料者工作台还有部分分区未刷新完成' : '已回到照料者工作台',
    description,
    tone: hasError ? 'warning' as const : 'accent' as const,
  };
});

const auditLabel = computed(() => profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '未建档');
const heroStats = computed(() => [
  { label: '资料状态', value: auditLabel.value, hint: profile.value ? '资料页单独维护' : '先完成入驻建档' },
  { label: '服务数量', value: String(services.value.length), hint: services.value.length ? '服务页负责上下架' : '建议至少上架 1 个服务' },
  { label: '履约订单', value: String(orders.value.length), hint: orders.value.length ? '去履约页处理' : '当前暂无履约订单' },
  { label: '下一步', value: profile.value ? '看服务或履约' : '先建资料', hint: '按审核和接单状态变化' },
]);

function buildServiceCreateRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver-service-create',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOrdersRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-caregiver-orders',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
      focusRole: 'caregiver',
    }),
  };
}

function buildMessagesRoute(notice: string, orderId?: string) {
  return {
    name: 'frontend-petpal-messages',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(orderId ? { focusOrderId: orderId } : {}),
      focusRole: 'caregiver',
    }),
  };
}

const primaryAction = computed(() => {
  if (!profile.value) {
    return {
      label: '先完成入驻资料',
      to: {
        name: 'frontend-petpal-caregiver-profile',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到入驻资料页，可先补齐城市、经验和资质材料。',
        }),
      },
      tone: 'primary' as const,
    };
  }
  if (!services.value.length) {
    return {
      label: '新建第一个服务',
      to: buildServiceCreateRoute('这里已经定位到新建服务页，可直接继续填写价格、城市和上架状态。'),
      tone: 'primary' as const,
    };
  }
  return {
    label: '进入履约队列',
    to: buildOrdersRoute('这里已经定位到履约队列，可直接继续处理接单、签到或服务记录。', orders.value[0]?.id),
    tone: 'primary' as const,
  };
});

const heroActions = computed(() => [
  {
    label: '消息中心',
    to: unreadOrder.value
      ? buildMessagesRoute('这里已经定位到最近一笔需要回复的履约会话，可直接继续沟通。', unreadOrder.value.id)
      : buildMessagesRoute('这里已经回到照料者消息中心，可继续查看跨订单沟通。'),
    tone: 'secondary' as const,
  },
  {
    label: '提醒中心',
    to: {
      name: 'frontend-petpal-reminders',
      query: buildPetPalDeskHandoffQuery({
        notice: '这里已经定位到照料者侧待办，可优先处理资料、服务和履约任务。',
        focusRole: 'caregiver',
      }),
    },
    tone: 'secondary' as const,
  },
]);

const focusTask = computed(() => {
  if (!profile.value) {
    return {
      title: '先完成照料者入驻资料',
      description: '资料页会单独记录你的服务城市、半径、经验和资质材料，后续审核也只在那一页继续。',
      actionLabel: '去建档',
      to: {
        name: 'frontend-petpal-caregiver-profile',
        query: buildPetPalDeskHandoffQuery({
          notice: '这里已经定位到入驻资料页，可先补齐城市、经验和资质材料。',
        }),
      },
    };
  }
  if (!services.value.length) {
    return {
      title: '先上架一个可售服务',
      description: '没有服务时，主人无法在需求匹配里看到你，建议尽快创建至少一个服务项目。',
      actionLabel: '去新建服务',
      to: buildServiceCreateRoute('这里已经定位到新建服务页，可直接继续填写价格、城市和上架状态。'),
    };
  }
  if (orders.value.length) {
    return {
      title: '优先处理当前履约订单',
      description: `当前有 ${orders.value.length} 笔履约订单待跟进，接单、签到和服务记录都在履约页完成。`,
      actionLabel: '去履约页',
      to: buildOrdersRoute('这里已经定位到最近一笔待处理履约订单，可直接继续接单或签到。', orders.value[0].id),
    };
  }
  return {
    title: '继续维护在售服务',
    description: '资料和服务都已经就绪，现在更适合回服务页微调价格、城市和最短提前时长。',
    actionLabel: '去服务页',
    to: services.value[0]
      ? {
          name: 'frontend-petpal-caregiver-services',
          query: buildPetPalDeskHandoffQuery({
            notice: '这里已经定位到最近一个在售服务，可直接继续微调价格或上下架。',
            focusServiceId: services.value[0].id,
          }),
        }
      : { name: 'frontend-petpal-caregiver-services' },
  };
});

async function loadPage() {
  profileState.value = 'idle';
  servicesState.value = 'idle';
  ordersState.value = 'idle';
  const [profileResult, servicesResult, ordersResult] = await Promise.allSettled([
    api.petpal.caregiver.profile(),
    api.petpal.caregiver.services(),
    api.petpal.caregiver.orders({ page: 1, pageSize: 20 }),
  ]);

  profile.value = profileResult.status === 'fulfilled' ? profileResult.value : null;
  services.value = servicesResult.status === 'fulfilled' ? servicesResult.value : [];
  orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value.items : [];
  profileState.value = profileResult.status === 'fulfilled' ? 'ready' : 'error';
  servicesState.value = servicesResult.status === 'fulfilled' ? 'ready' : 'error';
  ordersState.value = ordersResult.status === 'fulfilled' ? 'ready' : 'error';

  if (profileResult.status === 'rejected' && servicesResult.status === 'rejected' && ordersResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(profileResult.reason, '加载照料者工作台失败'));
  }
}

async function retryProfile() {
  await runPetPalSectionRetry({
    key: 'profile',
    sectionReloadingKey,
    reload: async () => {
      profileState.value = 'idle';
      try {
        profile.value = await api.petpal.caregiver.profile();
        profileState.value = 'ready';
      } catch (error) {
        profileState.value = 'error';
        throw error;
      }
    },
    getState: () => profileState.value,
    successMessage: '资料区已刷新',
    swallowError: true,
  });
}

async function retryServices() {
  await runPetPalSectionRetry({
    key: 'services',
    sectionReloadingKey,
    reload: async () => {
      servicesState.value = 'idle';
      try {
        services.value = await api.petpal.caregiver.services();
        servicesState.value = 'ready';
      } catch (error) {
        servicesState.value = 'error';
        throw error;
      }
    },
    getState: () => servicesState.value,
    successMessage: '服务区已刷新',
    swallowError: true,
  });
}

async function retryOrders() {
  await runPetPalSectionRetry({
    key: 'orders',
    sectionReloadingKey,
    reload: async () => {
      ordersState.value = 'idle';
      try {
        const result = await api.petpal.caregiver.orders({ page: 1, pageSize: 20 });
        orders.value = result.items;
        ordersState.value = 'ready';
      } catch (error) {
        ordersState.value = 'error';
        throw error;
      }
    },
    getState: () => ordersState.value,
    successMessage: '履约区已刷新',
    swallowError: true,
  });
}

onMounted(() => {
  void loadPage();
});
</script>
