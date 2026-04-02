<template>
  <PetPalDeskPage
    eyebrow="服务清单"
    title="服务列表只做上架、停用和编辑"
    summary="服务页不再混入入驻审核和履约订单，照料者可以在这里稳定维护报价和可售状态。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-services"
    :primary-action="{ label: '新建服务', to: { name: 'frontend-petpal-caregiver-service-create' }, tone: 'primary' }"
    :actions="[{ label: '返回照料者总览', to: { name: 'frontend-petpal-caregiver' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Services" title="服务列表" description="如果还没完成入驻资料，请先去资料页补充。">
      <PetPalDeskEmpty
        v-if="!hasProfile"
        title="请先完成入驻资料"
        description="没有入驻资料时，服务清单无法稳定上架。"
      >
        <template #actions>
          <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-caregiver-profile' }">去资料页</RouterLink>
        </template>
      </PetPalDeskEmpty>

      <PetPalDeskEmpty
        v-else-if="!services.length"
        title="当前没有服务"
        description="建议至少创建一个可售服务，让主人在匹配中能看到你。"
      >
        <template #actions>
          <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-caregiver-service-create' }">新建服务</RouterLink>
        </template>
      </PetPalDeskEmpty>

      <div v-else class="petpal-sheet-list">
        <div v-for="service in services" :key="service.id" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ getPetPalServiceTypeLabel(service.serviceType) }} / {{ service.petSpecies }}</h3>
            <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(service.pricePerUnit) }}/{{ service.unitType }} · {{ service.serviceCity || '城市待补充' }}</p>
            <p class="petpal-sheet-row__desc">最短提前 {{ service.minNoticeHours }} 小时 · 更新时间 {{ service.updatedAt.slice(0, 10) }}</p>
          </div>
          <div class="petpal-sheet-row__tail">
            <span class="petpal-pill" :class="service.isActive ? 'is-success' : 'is-warning'">{{ service.isActive ? '在售' : '停用' }}</span>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver-service-edit', params: { id: service.id } }">编辑</RouterLink>
            <button type="button" class="petpal-link-button" @click="toggleService(service)">
              {{ service.isActive ? '停用' : '重新上架' }}
            </button>
          </div>
        </div>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverServiceRecord } from '@rbac/api-common';
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
  getPetPalServiceTypeLabel,
  petPalCaregiverWorkspaceNav,
} from './shared';

const hasProfile = ref(false);
const services = ref<CaregiverServiceRecord[]>([]);

const heroStats = computed(() => [
  { label: '服务总数', value: String(services.value.length), hint: '上架与停用都在这里' },
  { label: '在售服务', value: String(services.value.filter((item) => item.isActive).length), hint: '主人可见的服务数量' },
  { label: '停用服务', value: String(services.value.filter((item) => !item.isActive).length), hint: '可随时重新上架' },
  { label: '资料状态', value: hasProfile.value ? '已建档' : '未建档', hint: '服务上架前建议先完成资料' },
]);

async function loadPage() {
  const [profileResult, servicesResult] = await Promise.allSettled([
    api.petpal.caregiver.profile(),
    api.petpal.caregiver.services(),
  ]);
  hasProfile.value = profileResult.status === 'fulfilled';
  services.value = servicesResult.status === 'fulfilled' ? servicesResult.value : [];

  if (profileResult.status === 'rejected' && servicesResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(profileResult.reason, '加载服务清单失败'));
  }
}

async function toggleService(service: CaregiverServiceRecord) {
  try {
    await api.petpal.caregiver.updateService(service.id, {
      serviceType: service.serviceType,
      petSpecies: service.petSpecies,
      pricePerUnit: Number(service.pricePerUnit),
      unitType: service.unitType,
      minNoticeHours: service.minNoticeHours,
      serviceCity: service.serviceCity || undefined,
      isActive: !service.isActive,
      availableSlots: service.availableSlots,
      serviceLat: service.serviceLat ? Number(service.serviceLat) : undefined,
      serviceLng: service.serviceLng ? Number(service.serviceLng) : undefined,
    });
    ElMessage.success(service.isActive ? '服务已停用' : '服务已重新上架');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '更新服务状态失败'));
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-link-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
</style>
