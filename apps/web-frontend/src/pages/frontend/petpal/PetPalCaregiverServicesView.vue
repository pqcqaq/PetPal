<!--
UX Blueprint
User: 照料者需要先查看服务组合，再决定新增或编辑某一项服务
Entry: 照料者总览、入驻资料保存后
First screen: 在售数量、停用数量、当前筛选
Primary action: 新建服务
Secondary actions: 编辑、上下架、回入驻资料
States: 未登录、未建档、加载失败、列表可用
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="照料者工作区"
      title="服务清单"
      summary="服务列表页只负责看组合和上下架，新增与编辑都拆到独立表单页。"
      :nav-items="petPalCaregiverWorkspaceNav"
      active-name="frontend-petpal-caregiver-services"
      :stats="heroStats"
      :primary-action="{ label: '新建服务', to: { name: 'frontend-petpal-caregiver-service-create' } }"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="服务清单"
          title="服务清单加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-card">
        <span class="frontend-card__eyebrow">服务筛选</span>
        <div class="petpal-toolbar">
          <el-radio-group v-model="filter" size="small">
            <el-radio-button label="ACTIVE">在售</el-radio-button>
            <el-radio-button label="ALL">全部</el-radio-button>
            <el-radio-button label="INACTIVE">停用</el-radio-button>
          </el-radio-group>
          <div class="petpal-inline-actions">
            <RouterLink :to="{ name: 'frontend-petpal-caregiver-profile' }">入驻资料</RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver-service-create' }">新建服务</RouterLink>
          </div>
        </div>

        <div v-if="filteredServices.length" class="petpal-service-list">
          <article v-for="service in filteredServices" :key="service.id" class="petpal-service-card">
            <div class="petpal-service-card__head">
              <div>
                <h3>{{ service.serviceType }} · {{ service.petSpecies }}</h3>
                <p>{{ service.serviceCity || caregiverProfile?.serviceCity || '城市待补充' }} · 提前 {{ service.minNoticeHours }} 小时预约</p>
              </div>
              <el-tag size="small" :type="service.isActive ? 'success' : 'warning'">
                {{ service.isActive ? '在售' : '停用' }}
              </el-tag>
            </div>

            <div class="petpal-service-card__metrics">
              <div>
                <span>价格</span>
                <strong>¥{{ formatPetPalAmount(service.pricePerUnit) }}/{{ service.unitType }}</strong>
              </div>
              <div>
                <span>服务城市</span>
                <strong>{{ service.serviceCity || '待补充' }}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{{ service.isActive ? '可被匹配' : '暂不展示' }}</strong>
              </div>
            </div>

            <div class="petpal-card-actions">
              <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-caregiver-service-edit', params: { id: service.id } }">
                编辑服务
              </RouterLink>
              <el-button :type="service.isActive ? 'danger' : 'primary'" size="small" :loading="actionLoadingKey === service.id" @click="toggleService(service)">
                {{ service.isActive ? '停用' : '恢复上架' }}
              </el-button>
            </div>
          </article>
        </div>

        <PetPalStatePanel
          v-else
          eyebrow="服务清单"
          title="当前筛选下没有服务"
          description="服务表单已经独立出去，可以直接新建一项服务。"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver-service-create' }">
              <el-button size="small" type="primary">新建服务</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="服务清单"
        title="登录后查看服务清单"
        description="登录后查看服务组合，并进入独立表单页新增或编辑。"
      >
        <template #actions>
          <RouterLink to="/login">
            <el-button size="small" type="primary">去登录</el-button>
          </RouterLink>
        </template>
      </PetPalStatePanel>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverServiceRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { ElButton, ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatPetPalAmount, petPalCaregiverWorkspaceNav } from './shared';

type ServiceFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

const auth = useAuthStore();

const loading = ref(false);
const filter = ref<ServiceFilter>('ACTIVE');
const actionLoadingKey = ref('');
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const services = ref<CaregiverServiceRecord[]>([]);

const filteredServices = computed(() => services.value.filter((item) => {
  if (filter.value === 'ALL') {
    return true;
  }
  if (filter.value === 'INACTIVE') {
    return !item.isActive;
  }
  return item.isActive;
}));

const heroStats = computed(() => [
  {
    label: '服务总数',
    value: String(services.value.length),
    hint: '清单页只负责看组合',
  },
  {
    label: '在售',
    value: String(services.value.filter((item) => item.isActive).length),
    hint: '可继续被主人匹配',
  },
  {
    label: '停用',
    value: String(services.value.filter((item) => !item.isActive).length),
    hint: '可按需恢复上架',
  },
  {
    label: '当前城市',
    value: caregiverProfile.value?.serviceCity || '待补充',
    hint: '会影响主人筛选',
  },
]);

const heroActions = computed(() => [
  { label: '返回总览', to: { name: 'frontend-petpal-caregiver' }, tone: 'secondary' as const },
  { label: '履约队列', to: { name: 'frontend-petpal-caregiver-orders' }, tone: 'secondary' as const },
]);

async function toggleService(service: CaregiverServiceRecord) {
  actionLoadingKey.value = service.id;
  try {
    await api.petpal.caregiver.updateService(service.id, {
      serviceType: service.serviceType,
      petSpecies: service.petSpecies,
      pricePerUnit: Number(service.pricePerUnit),
      unitType: service.unitType,
      minNoticeHours: service.minNoticeHours,
      serviceCity: service.serviceCity || undefined,
      serviceLat: service.serviceLat == null ? undefined : Number(service.serviceLat),
      serviceLng: service.serviceLng == null ? undefined : Number(service.serviceLng),
      availableSlots: service.availableSlots,
      isActive: !service.isActive,
    });
    ElMessage.success(service.isActive ? '服务已停用' : '服务已恢复上架');
    await loadPage();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '切换服务状态失败'));
  } finally {
    actionLoadingKey.value = '';
  }
}

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    const [profileResult, servicesResult] = await Promise.all([
      api.petpal.caregiver.profile(),
      api.petpal.caregiver.services(),
    ]);
    caregiverProfile.value = profileResult;
    services.value = servicesResult;
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    caregiverProfile.value = null;
    services.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载服务清单失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-toolbar,
.petpal-inline-actions,
.petpal-service-card__head,
.petpal-card-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-service-list,
.petpal-service-card {
  display: grid;
  gap: 14px;
}

.petpal-service-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-service-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.petpal-service-card__metrics div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.petpal-service-card__metrics span {
  color: #6d8683;
  font-size: 12px;
}

@media (max-width: 720px) {
  .petpal-service-card__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
