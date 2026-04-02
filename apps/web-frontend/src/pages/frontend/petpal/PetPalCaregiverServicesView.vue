<template>
  <PetPalDeskPage
    eyebrow="服务清单"
    title="服务列表只做上架、停用和编辑"
    summary="服务页不再混入入驻审核和履约订单，照料者可以在这里稳定维护报价和可售状态。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-services"
    :primary-action="primaryAction"
    :actions="pageActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="loadState === 'error'"
            :loading="sectionReloadingKey === 'services'"
            @click="retryServices"
          >
            重试服务清单
          </el-button>
          <RouterLink
            v-else-if="highlightedService"
            :to="buildServiceEditRoute(highlightedService.id)"
          >
            继续编辑这个服务
          </RouterLink>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Services" title="服务列表" description="如果还没完成入驻资料，请先去资料页补充。">
      <PetPalDeskEmpty
        v-if="!hasProfile"
        title="请先完成入驻资料"
        description="没有入驻资料时，服务清单无法稳定上架。"
      >
        <template #actions>
          <RouterLink
            class="frontend-page__button is-primary"
            :to="{
              name: 'frontend-petpal-caregiver-profile',
              query: buildPetPalDeskHandoffQuery({
                notice: '这里已经定位到入驻资料页，可先补齐资料后再回来维护服务。',
              }),
            }"
          >
            去资料页
          </RouterLink>
        </template>
      </PetPalDeskEmpty>

      <PetPalDeskEmpty
        v-else-if="!services.length"
        title="当前没有服务"
        description="建议至少创建一个可售服务，让主人在匹配中能看到你。"
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
        <div v-for="service in services" :key="service.id" class="petpal-sheet-row" :class="{ 'is-focused': service.id === highlightedServiceId }">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ getPetPalServiceTypeLabel(service.serviceType) }} / {{ service.petSpecies }}</h3>
            <p class="petpal-sheet-row__desc">{{ formatPetPalMoney(service.pricePerUnit) }}/{{ service.unitType }} · {{ service.serviceCity || '城市待补充' }}</p>
            <p class="petpal-sheet-row__desc">最短提前 {{ service.minNoticeHours }} 小时 · 更新时间 {{ service.updatedAt.slice(0, 10) }}</p>
          </div>
          <div class="petpal-sheet-row__tail">
            <span class="petpal-pill" :class="service.isActive ? 'is-success' : 'is-warning'">{{ service.isActive ? '在售' : '停用' }}</span>
            <RouterLink :to="buildServiceEditRoute(service.id)">编辑</RouterLink>
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
  getPetPalServiceTypeLabel,
  petPalCaregiverWorkspaceNav,
} from './shared';

const route = useRoute();
const hasProfile = ref(false);
const services = ref<CaregiverServiceRecord[]>([]);
const loadState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'services'>('');
const highlightedServiceId = computed(() => getPetPalQueryString(route.query, 'focusServiceId'));
const highlightedService = computed(() => services.value.find((item) => item.id === highlightedServiceId.value) ?? null);
const primaryAction = computed(() => ({
  label: '新建服务',
  to: buildServiceCreateRoute('这里已经定位到新建服务页，可直接继续填写价格、城市和上架状态。'),
  tone: 'primary' as const,
}));
const pageActions = computed(() => [
  {
    label: '返回照料者总览',
    to: buildCaregiverDashboardRoute(
      hasProfile.value
        ? services.value.length
          ? '这里已经回到照料者总览，可继续查看服务状态或履约任务。'
          : '这里已经回到照料者总览，可继续开始第一个服务或查看履约状态。'
        : '这里已经回到照料者总览，可继续先补齐入驻资料后再维护服务。',
    ),
    tone: 'secondary' as const,
  },
]);

const heroStats = computed(() => [
  { label: '服务总数', value: String(services.value.length), hint: '上架与停用都在这里' },
  { label: '在售服务', value: String(services.value.filter((item) => item.isActive).length), hint: '主人可见的服务数量' },
  { label: '停用服务', value: String(services.value.filter((item) => !item.isActive).length), hint: '可随时重新上架' },
  { label: '资料状态', value: hasProfile.value ? '已建档' : '未建档', hint: '服务上架前建议先完成资料' },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    loadState.value === 'error' ? '服务清单暂未刷新完成，可直接重试当前页' : '',
  ]);
  if (!description) {
    return null;
  }
  return {
    title: loadState.value === 'error' ? '服务清单暂未刷新完整' : '已回到服务清单',
    description,
    tone: loadState.value === 'error' ? 'warning' as const : 'accent' as const,
  };
});

function buildServiceCreateRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver-service-create',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildCaregiverDashboardRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildServiceEditRoute(serviceId: string) {
  return {
    name: 'frontend-petpal-caregiver-service-edit',
    params: { id: serviceId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这里已经定位到这个服务，可直接继续调整价格、城市或上架状态。',
      focusServiceId: serviceId,
    }),
  };
}

async function loadPage() {
  loadState.value = 'idle';
  const [profileResult, servicesResult] = await Promise.allSettled([
    api.petpal.caregiver.profile(),
    api.petpal.caregiver.services(),
  ]);
  hasProfile.value = profileResult.status === 'fulfilled';
  services.value = servicesResult.status === 'fulfilled' ? servicesResult.value : [];
  loadState.value = profileResult.status === 'rejected' && servicesResult.status === 'rejected' ? 'error' : 'ready';

  if (profileResult.status === 'rejected' && servicesResult.status === 'rejected') {
    ElMessage.error(getErrorMessage(profileResult.reason, '加载服务清单失败'));
  }
}

async function retryServices() {
  await runPetPalSectionRetry({
    key: 'services',
    sectionReloadingKey,
    reload: loadPage,
    getState: () => loadState.value,
    successMessage: '服务清单已刷新',
    swallowError: true,
  });
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
.petpal-sheet-row.is-focused {
  margin-inline: -10px;
  padding-inline: 10px;
  background: rgba(244, 248, 255, 0.9);
}

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
