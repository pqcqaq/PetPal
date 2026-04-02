<!--
UX Blueprint
User: 照料者已经决定新增或编辑某项服务，只想专注填写价格和上架信息
Entry: 服务清单、新建服务入口
First screen: 当前模式、城市、是否上架
Primary action: 保存服务
Secondary actions: 返回服务清单、回入驻资料
States: 未登录、可新建、可编辑、未建档
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="照料者工作区"
      :title="heroTitle"
      summary="服务表单页只负责配置一项服务，不再混入清单筛选和上下架动作。"
      :nav-items="petPalCaregiverWorkspaceNav"
      active-name="frontend-petpal-caregiver-services"
      :stats="heroStats"
      :primary-action="null"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="!hasProfile" class="frontend-card">
        <PetPalStatePanel
          eyebrow="服务表单"
          title="请先完成入驻资料"
          description="没有照料者档案时，无法创建或编辑服务。"
          tone="warning"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal-caregiver-profile' }">
              <el-button size="small" type="primary">去入驻资料</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-8">
          <span class="frontend-card__eyebrow">服务表单</span>
          <el-form :model="serviceForm" label-position="top" size="small" class="petpal-form-grid">
            <div class="petpal-form-grid__row">
              <el-form-item label="服务类型">
                <el-select v-model="serviceForm.serviceType" style="width: 100%">
                  <el-option label="寄养" value="BOARDING" />
                  <el-option label="遛宠" value="WALKING" />
                  <el-option label="喂养" value="FEEDING" />
                  <el-option label="上门陪伴" value="DOOR_VISIT" />
                </el-select>
              </el-form-item>
              <el-form-item label="适配宠物">
                <el-select v-model="serviceForm.petSpecies" style="width: 100%">
                  <el-option label="犬" value="DOG" />
                  <el-option label="猫" value="CAT" />
                  <el-option label="其他" value="OTHER" />
                </el-select>
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="报价">
                <el-input-number v-model="serviceForm.pricePerUnit" :min="1" :max="10000" style="width: 100%" />
              </el-form-item>
              <el-form-item label="计价单位">
                <el-input v-model="serviceForm.unitType" placeholder="例如：小时 / 次" />
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="最短提前小时">
                <el-input-number v-model="serviceForm.minNoticeHours" :min="0" :max="168" style="width: 100%" />
              </el-form-item>
              <el-form-item label="服务城市">
                <el-input v-model="serviceForm.serviceCity" placeholder="例如：杭州" />
              </el-form-item>
            </div>

            <el-form-item label="是否上架">
              <el-switch v-model="serviceForm.isActive" />
            </el-form-item>
          </el-form>
        </article>

        <aside class="frontend-card petpal-grid-span-4">
          <span class="frontend-card__eyebrow">提交前确认</span>
          <div class="petpal-side-stack">
            <div class="petpal-side-item">
              <strong>这页只做一件事</strong>
              <p>配置一项服务，保存后回服务清单继续看整个组合。</p>
            </div>
            <div class="petpal-side-item">
              <strong>建议先确认</strong>
              <p>价格、计价单位、服务城市和上架状态会直接影响主人筛选结果。</p>
            </div>
            <div class="petpal-card-actions">
              <el-button type="primary" :loading="saving" @click="saveService">
                {{ editingServiceId ? '保存修改' : '创建服务' }}
              </el-button>
              <RouterLink :to="{ name: 'frontend-petpal-caregiver-services' }">
                <el-button>返回清单</el-button>
              </RouterLink>
            </div>
          </div>
        </aside>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="服务表单"
        title="登录后继续编辑服务"
        description="登录后在独立服务表单页新增或编辑一项服务。"
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
import type { CaregiverProfileRecord, CaregiverServiceRecord, PetServiceType, PetSpecies } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { petPalCaregiverWorkspaceNav } from './shared';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const hasProfile = ref(true);
const saving = ref(false);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);

const editingServiceId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const heroTitle = computed(() => editingServiceId.value ? '编辑服务' : '新建服务');
const heroStats = computed(() => [
  {
    label: '当前模式',
    value: editingServiceId.value ? '编辑' : '新建',
    hint: '表单页只负责一项服务',
  },
  {
    label: '服务城市',
    value: serviceForm.serviceCity || caregiverProfile.value?.serviceCity || '待补充',
    hint: '会直接影响主人筛选',
  },
  {
    label: '上架状态',
    value: serviceForm.isActive ? '在售' : '停用',
    hint: '保存后回清单继续看组合',
  },
  {
    label: '下一步',
    value: '保存服务',
    hint: '不会留在清单页里混合编辑',
  },
]);

const heroActions = computed(() => [
  { label: '返回服务清单', to: { name: 'frontend-petpal-caregiver-services' }, tone: 'secondary' as const },
  { label: '入驻资料', to: { name: 'frontend-petpal-caregiver-profile' }, tone: 'secondary' as const },
]);

const serviceForm = reactive({
  serviceType: 'BOARDING' as PetServiceType,
  petSpecies: 'DOG' as PetSpecies,
  pricePerUnit: 60,
  unitType: '小时',
  minNoticeHours: 2,
  serviceCity: '',
  isActive: true,
});

const applyService = (service: CaregiverServiceRecord) => {
  serviceForm.serviceType = service.serviceType;
  serviceForm.petSpecies = service.petSpecies;
  serviceForm.pricePerUnit = Number(service.pricePerUnit);
  serviceForm.unitType = service.unitType;
  serviceForm.minNoticeHours = service.minNoticeHours;
  serviceForm.serviceCity = service.serviceCity || '';
  serviceForm.isActive = service.isActive;
};

async function loadPage() {
  if (!auth.isAuthenticated) {
    return;
  }

  try {
    caregiverProfile.value = await api.petpal.caregiver.profile();
    hasProfile.value = true;
    serviceForm.serviceCity = caregiverProfile.value.serviceCity || '';

    if (editingServiceId.value) {
      const services = await api.petpal.caregiver.services();
      const target = services.find((item) => item.id === editingServiceId.value) ?? null;
      if (!target) {
        ElMessage.warning('没有找到要编辑的服务');
        await router.push({ name: 'frontend-petpal-caregiver-services' });
        return;
      }
      applyService(target);
    }
  } catch (error: unknown) {
    caregiverProfile.value = null;
    hasProfile.value = false;
  }
}

async function saveService() {
  if (!serviceForm.unitType.trim()) {
    ElMessage.warning('请填写计价单位');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      serviceType: serviceForm.serviceType,
      petSpecies: serviceForm.petSpecies,
      pricePerUnit: Number(serviceForm.pricePerUnit),
      unitType: serviceForm.unitType.trim(),
      minNoticeHours: serviceForm.minNoticeHours,
      serviceCity: serviceForm.serviceCity.trim() || undefined,
      isActive: serviceForm.isActive,
      availableSlots: [],
    };

    if (editingServiceId.value) {
      await api.petpal.caregiver.updateService(editingServiceId.value, payload);
      ElMessage.success('服务已更新');
    } else {
      await api.petpal.caregiver.createService(payload);
      ElMessage.success('服务已创建');
    }

    await router.push({ name: 'frontend-petpal-caregiver-services' });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, editingServiceId.value ? '更新服务失败' : '创建服务失败'));
  } finally {
    saving.value = false;
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
.petpal-grid-span-8 {
  grid-column: span 8;
}

.petpal-grid-span-4 {
  grid-column: span 4;
}

.petpal-form-grid,
.petpal-side-stack {
  display: grid;
  gap: 16px;
}

.petpal-form-grid__row,
.petpal-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.petpal-side-item {
  padding: 16px;
  border-radius: 18px;
  background: rgba(248, 252, 251, 0.86);
  border: 1px solid rgba(18, 53, 51, 0.08);
}

@media (max-width: 1080px) {
  .petpal-grid-span-8,
  .petpal-grid-span-4 {
    grid-column: span 12;
  }
}

@media (max-width: 720px) {
  .petpal-form-grid__row,
  .petpal-card-actions {
    grid-template-columns: 1fr;
  }
}
</style>
