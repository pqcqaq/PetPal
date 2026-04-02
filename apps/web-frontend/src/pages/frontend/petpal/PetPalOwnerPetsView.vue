<!--
UX Blueprint
User: 主人需要查看现有宠物，再决定新增还是编辑
Entry: 主人总览、需求表单前置建档
First screen: 宠物数量、可直接下单的档案、直接进入新建或编辑
Primary action: 新建宠物档案
Secondary actions: 编辑现有宠物、用某只宠物发需求
States: 未登录、加载失败、空态、列表可用
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="主人工作区"
      title="宠物档案清单"
      summary="列表页只负责挑选和查看，不再直接承载新增或编辑表单。"
      :nav-items="petPalOwnerWorkspaceNav"
      active-name="frontend-petpal-pets"
      :stats="heroStats"
      :primary-action="{ label: '新建宠物', to: { name: 'frontend-petpal-pet-create' } }"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section v-if="pageLoadState === 'error'" class="frontend-card">
        <PetPalStatePanel
          eyebrow="宠物档案"
          title="宠物清单加载失败"
          :description="pageLoadErrorMessage"
          tone="danger"
        >
          <template #actions>
            <el-button size="small" type="primary" :loading="loading" @click="loadPage">重试加载</el-button>
          </template>
        </PetPalStatePanel>
      </section>

      <section v-else class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-12">
          <span class="frontend-card__eyebrow">宠物列表</span>
          <div class="petpal-list-head">
            <h3>{{ pets.length ? `共 ${pets.length} 只宠物` : '还没有宠物档案' }}</h3>
            <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-pet-create' }">
              新建宠物
            </RouterLink>
          </div>

          <div v-if="pets.length" class="petpal-pet-grid">
            <article v-for="pet in pets" :key="pet.id" class="petpal-pet-card">
              <div class="petpal-pet-card__head">
                <div>
                  <h4>{{ pet.name }}</h4>
                  <p>{{ pet.species }}{{ pet.breed ? ` · ${pet.breed}` : '' }}{{ pet.gender ? ` · ${pet.gender}` : '' }}</p>
                </div>
                <el-tag size="small" :type="pet.emergencyContact?.name ? 'success' : 'warning'">
                  {{ pet.emergencyContact?.name ? '资料较完整' : '待补紧急联系人' }}
                </el-tag>
              </div>

              <div class="petpal-pet-card__metrics">
                <div>
                  <span>生日</span>
                  <strong>{{ formatPetPalDate(pet.birthday) }}</strong>
                </div>
                <div>
                  <span>体重</span>
                  <strong>{{ pet.weightKg ?? '-' }}kg</strong>
                </div>
                <div>
                  <span>习性</span>
                  <strong>{{ pet.temperamentTags.length ? pet.temperamentTags.join(' / ') : '待补充' }}</strong>
                </div>
              </div>

              <div class="petpal-pet-card__notes">
                <p v-if="pet.feedingNote"><strong>喂养：</strong>{{ pet.feedingNote }}</p>
                <p v-if="pet.allergyNote"><strong>过敏：</strong>{{ pet.allergyNote }}</p>
                <p v-if="pet.medicalNote"><strong>健康：</strong>{{ pet.medicalNote }}</p>
                <p v-if="pet.emergencyContact">
                  <strong>紧急：</strong>{{ pet.emergencyContact.name }} · {{ pet.emergencyContact.phone }}{{ pet.emergencyContact.relation ? ` · ${pet.emergencyContact.relation}` : '' }}
                </p>
              </div>

              <div class="petpal-card-actions">
                <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-pet-edit', params: { id: pet.id } }">
                  编辑档案
                </RouterLink>
                <RouterLink class="frontend-page__button is-secondary" :to="{ name: 'frontend-petpal-request-create', query: { petId: pet.id } }">
                  用它发需求
                </RouterLink>
              </div>
            </article>
          </div>

          <PetPalStatePanel
            v-else
            eyebrow="宠物档案"
            title="先建第一只宠物"
            description="建档完成后，再去需求表单填写时间、地点和预算。"
          >
            <template #actions>
              <RouterLink :to="{ name: 'frontend-petpal-pet-create' }">
                <el-button size="small" type="primary">去建档</el-button>
              </RouterLink>
            </template>
          </PetPalStatePanel>
        </article>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="宠物档案"
        title="登录后查看宠物清单"
        description="登录后从列表页选择宠物，再进入独立表单页新增或编辑。"
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
import type { PetProfileRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import { formatPetPalDate, petPalOwnerWorkspaceNav } from './shared';

const auth = useAuthStore();

const loading = ref(false);
const pageLoadState = ref<'idle' | 'ready' | 'error'>('idle');
const pageLoadErrorMessage = ref('');
const pets = ref<PetProfileRecord[]>([]);

const heroStats = computed(() => [
  {
    label: '宠物总数',
    value: String(pets.value.length),
    hint: pets.value.length ? '可直接带入需求' : '先建第一只',
  },
  {
    label: '完整档案',
    value: String(pets.value.filter((item) => item.emergencyContact?.name && item.feedingNote).length),
    hint: '紧急联系人和喂养提醒更适合直接复用',
  },
  {
    label: '待补资料',
    value: String(pets.value.filter((item) => !item.emergencyContact?.name || !item.feedingNote).length),
    hint: '建议优先补紧急联系人和喂养说明',
  },
  {
    label: '下一步',
    value: pets.value.length ? '去需求页' : '先建档',
    hint: '列表页只负责选择，不再直接编辑',
  },
]);

const heroActions = computed(() => [
  { label: '返回总览', to: { name: 'frontend-petpal' }, tone: 'secondary' as const },
  { label: '需求队列', to: { name: 'frontend-petpal-requests' }, tone: 'secondary' as const },
]);

async function loadPage() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  pageLoadState.value = 'idle';
  pageLoadErrorMessage.value = '';

  try {
    pets.value = await api.petpal.pets.list();
    pageLoadState.value = 'ready';
  } catch (error: unknown) {
    pets.value = [];
    pageLoadState.value = 'error';
    pageLoadErrorMessage.value = getErrorMessage(error, '加载宠物清单失败');
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
.petpal-grid-span-12 {
  grid-column: span 12;
}

.petpal-list-head,
.petpal-pet-card__head,
.petpal-card-actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-pet-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.petpal-pet-card,
.petpal-pet-card__notes {
  display: grid;
  gap: 14px;
}

.petpal-pet-card {
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(248, 252, 251, 0.86);
}

.petpal-pet-card h4 {
  margin: 0;
}

.petpal-pet-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.petpal-pet-card__metrics div {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
}

.petpal-pet-card__metrics span {
  color: #6d8683;
  font-size: 12px;
}

.petpal-pet-card__metrics strong {
  color: #143634;
}

@media (max-width: 1080px) {
  .petpal-pet-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .petpal-pet-card__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
