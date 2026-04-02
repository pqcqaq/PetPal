<!--
UX Blueprint
User: 主人已经准备好宠物资料，需要专注新建一条需求
Entry: 主人总览、宠物清单
First screen: 当前选中宠物、服务类型、时间和地点
Primary action: 发布需求
Secondary actions: 返回需求队列、先去补宠物档案
States: 未登录、无宠物、可提交
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="主人工作区"
      title="新建照料需求"
      summary="表单页只负责发布需求，提交后回到需求队列继续看匹配和下单。"
      :nav-items="petPalOwnerWorkspaceNav"
      active-name="frontend-petpal-requests"
      :stats="heroStats"
      :primary-action="null"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="!pets.length && !loading" class="frontend-card">
        <PetPalStatePanel
          eyebrow="新建需求"
          title="请先建立宠物档案"
          description="没有宠物档案时，需求表单无法继续提交。"
          tone="warning"
        >
          <template #actions>
            <RouterLink :to="{ name: 'frontend-petpal-pet-create' }">
              <el-button size="small" type="primary">先去建档</el-button>
            </RouterLink>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-8">
          <span class="frontend-card__eyebrow">需求表单</span>
          <el-form :model="requestForm" label-position="top" size="small" class="petpal-form-grid">
            <div class="petpal-form-grid__row">
              <el-form-item label="宠物">
                <el-select v-model="requestForm.petId" style="width: 100%">
                  <el-option
                    v-for="pet in pets"
                    :key="pet.id"
                    :label="`${pet.name} (${pet.species})`"
                    :value="pet.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="服务类型">
                <el-select v-model="requestForm.serviceType" style="width: 100%">
                  <el-option label="寄养" value="BOARDING" />
                  <el-option label="遛宠" value="WALKING" />
                  <el-option label="喂养" value="FEEDING" />
                  <el-option label="上门陪伴" value="DOOR_VISIT" />
                </el-select>
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="开始时间">
                <el-date-picker v-model="requestForm.startTime" type="datetime" style="width: 100%" />
              </el-form-item>
              <el-form-item label="结束时间">
                <el-date-picker v-model="requestForm.endTime" type="datetime" style="width: 100%" />
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="地点描述">
                <el-input v-model="requestForm.locationText" placeholder="例如：上海市静安区" />
              </el-form-item>
              <el-form-item label="预算(元)">
                <el-input-number v-model="requestForm.budgetAmount" :min="1" :max="20000" style="width: 100%" />
              </el-form-item>
            </div>
          </el-form>
        </article>

        <aside class="frontend-card petpal-grid-span-4">
          <span class="frontend-card__eyebrow">提交前确认</span>
          <div class="petpal-side-stack">
            <div class="petpal-side-item">
              <strong>提交后去哪</strong>
              <p>提交成功后回到需求队列，在队列里看匹配、选照料者和继续结算。</p>
            </div>
            <div class="petpal-side-item">
              <strong>建议先确认</strong>
              <p>宠物、时间和地点会直接影响匹配结果，预算只负责收窄候选范围。</p>
            </div>
            <div class="petpal-card-actions">
              <el-button type="primary" :loading="saving" @click="submitRequest">发布需求</el-button>
              <RouterLink :to="{ name: 'frontend-petpal-requests' }">
                <el-button>返回队列</el-button>
              </RouterLink>
            </div>
          </div>
        </aside>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="新建需求"
        title="登录后继续发布需求"
        description="登录后再进入独立需求表单页。"
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
import type { PetProfileRecord, PetServiceType } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { petPalOwnerWorkspaceNav } from './shared';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const pets = ref<PetProfileRecord[]>([]);

const requestForm = reactive({
  petId: '',
  serviceType: 'BOARDING' as PetServiceType,
  startTime: new Date(),
  endTime: new Date(Date.now() + 1000 * 60 * 60 * 24),
  locationText: '',
  budgetAmount: 80,
});

const heroStats = computed(() => [
  {
    label: '表单职责',
    value: '只发需求',
    hint: '匹配和下单回需求队列',
  },
  {
    label: '前置条件',
    value: pets.value.length ? '宠物已就绪' : '先建宠物',
    hint: '宠物资料会直接带入队列',
  },
  {
    label: '提交后',
    value: '回队列',
    hint: '继续看匹配和候选',
  },
  {
    label: '当前预算',
    value: `¥${requestForm.budgetAmount}`,
    hint: '预算只负责收窄匹配范围',
  },
]);

const heroActions = computed(() => [
  { label: '返回需求队列', to: { name: 'frontend-petpal-requests' }, tone: 'secondary' as const },
  { label: '宠物档案', to: { name: 'frontend-petpal-pets' }, tone: 'secondary' as const },
]);

async function loadPets() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  try {
    pets.value = await api.petpal.pets.list();
    const preferredPetId = typeof route.query.petId === 'string' ? route.query.petId : '';
    requestForm.petId = preferredPetId && pets.value.some((item) => item.id === preferredPetId)
      ? preferredPetId
      : pets.value[0]?.id ?? '';
  } catch (error: unknown) {
    pets.value = [];
    ElMessage.error(getErrorMessage(error, '加载宠物失败'));
  } finally {
    loading.value = false;
  }
}

async function submitRequest() {
  if (!requestForm.petId) {
    ElMessage.warning('请先选择宠物');
    return;
  }
  if (!requestForm.locationText.trim()) {
    ElMessage.warning('请填写地点描述');
    return;
  }
  if (requestForm.endTime <= requestForm.startTime) {
    ElMessage.warning('结束时间必须晚于开始时间');
    return;
  }

  saving.value = true;
  try {
    await api.petpal.requests.create({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: requestForm.startTime.toISOString(),
      endTime: requestForm.endTime.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: requestForm.budgetAmount,
    });
    ElMessage.success('需求已发布');
    await router.push({ name: 'frontend-petpal-requests' });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发布需求失败'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void loadPets();
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
