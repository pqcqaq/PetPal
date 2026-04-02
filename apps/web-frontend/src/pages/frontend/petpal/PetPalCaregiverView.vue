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
          v-if="!profile"
          title="还没有照料者资料"
          description="先完成入驻资料，审核通过后再持续维护服务清单。"
        >
          <template #actions>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-caregiver-profile' }">去建档</RouterLink>
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
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-profile' }">维护资料</RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Services" title="服务清单" description="上架、停用和编辑都去服务页完成。">
        <PetPalDeskEmpty
          v-if="!services.length"
          title="当前没有服务"
          description="服务清单为空时，主人无法稳定匹配到你。"
        >
          <template #actions>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-caregiver-service-create' }">新建服务</RouterLink>
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
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-services' }">去服务页</RouterLink>
            </div>
          </div>
        </div>
      </PetPalDeskSection>

      <PetPalDeskSection class="petpal-span-4" eyebrow="Orders" title="履约队列" description="接单、签到、服务记录和签退都放到履约页处理。">
        <PetPalDeskEmpty
          v-if="!orders.length"
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
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-orders' }">进入履约</RouterLink>
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
import { RouterLink } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  formatPetPalMoney,
  formatPetPalRange,
  getPetPalCaregiverAuditLabel,
  getPetPalOrderStatusLabel,
  getPetPalServiceTypeLabel,
  petPalCaregiverWorkspaceNav,
} from './shared';

const profile = ref<CaregiverProfileRecord | null>(null);
const services = ref<CaregiverServiceRecord[]>([]);
const orders = ref<CaregiverOrderRecord[]>([]);

const auditLabel = computed(() => profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '未建档');
const heroStats = computed(() => [
  { label: '资料状态', value: auditLabel.value, hint: profile.value ? '资料页单独维护' : '先完成入驻建档' },
  { label: '服务数量', value: String(services.value.length), hint: services.value.length ? '服务页负责上下架' : '建议至少上架 1 个服务' },
  { label: '履约订单', value: String(orders.value.length), hint: orders.value.length ? '去履约页处理' : '当前暂无履约订单' },
  { label: '下一步', value: profile.value ? '看服务或履约' : '先建资料', hint: '按审核和接单状态变化' },
]);

const primaryAction = computed(() => {
  if (!profile.value) {
    return { label: '先完成入驻资料', to: { name: 'frontend-petpal-caregiver-profile' }, tone: 'primary' as const };
  }
  if (!services.value.length) {
    return { label: '新建第一个服务', to: { name: 'frontend-petpal-caregiver-service-create' }, tone: 'primary' as const };
  }
  return { label: '进入履约队列', to: { name: 'frontend-petpal-caregiver-orders' }, tone: 'primary' as const };
});

const heroActions = computed(() => [
  { label: '消息中心', to: { name: 'frontend-petpal-messages' }, tone: 'secondary' as const },
  { label: '提醒中心', to: { name: 'frontend-petpal-reminders' }, tone: 'secondary' as const },
]);

const focusTask = computed(() => {
  if (!profile.value) {
    return {
      title: '先完成照料者入驻资料',
      description: '资料页会单独记录你的服务城市、半径、经验和资质材料，后续审核也只在那一页继续。',
      actionLabel: '去建档',
      to: { name: 'frontend-petpal-caregiver-profile' },
    };
  }
  if (!services.value.length) {
    return {
      title: '先上架一个可售服务',
      description: '没有服务时，主人无法在需求匹配里看到你，建议尽快创建至少一个服务项目。',
      actionLabel: '去新建服务',
      to: { name: 'frontend-petpal-caregiver-service-create' },
    };
  }
  if (orders.value.length) {
    return {
      title: '优先处理当前履约订单',
      description: `当前有 ${orders.value.length} 笔履约订单待跟进，接单、签到和服务记录都在履约页完成。`,
      actionLabel: '去履约页',
      to: { name: 'frontend-petpal-caregiver-orders' },
    };
  }
  return {
    title: '继续维护在售服务',
    description: '资料和服务都已经就绪，现在更适合回服务页微调价格、城市和最短提前时长。',
    actionLabel: '去服务页',
    to: { name: 'frontend-petpal-caregiver-services' },
  };
});

async function loadPage() {
  const [profileResult, servicesResult, ordersResult] = await Promise.allSettled([
    api.petpal.caregiver.profile(),
    api.petpal.caregiver.services(),
    api.petpal.caregiver.orders({ page: 1, pageSize: 20 }),
  ]);

  profile.value = profileResult.status === 'fulfilled' ? profileResult.value : null;
  services.value = servicesResult.status === 'fulfilled' ? servicesResult.value : [];
  orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value.items : [];

  if (profileResult.status === 'rejected' && servicesResult.status === 'rejected' && ordersResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(profileResult.reason, '加载照料者工作台失败'));
  }
}

onMounted(() => {
  void loadPage();
});
</script>
