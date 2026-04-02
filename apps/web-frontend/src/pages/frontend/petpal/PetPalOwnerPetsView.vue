<template>
  <PetPalDeskPage
    eyebrow="宠物档案"
    title="宠物资料单独管理，需求和订单不再混在这里"
    summary="这个页面只保留宠物清单和进入编辑表单的入口。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-pets"
    :primary-action="primaryAction"
    :actions="pageActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="loadState === 'error'"
            :loading="sectionReloadingKey === 'pets'"
            @click="retryPets"
          >
            重试宠物清单
          </el-button>
          <RouterLink
            v-else-if="highlightedPet"
            :to="buildOwnerPetEditRoute(highlightedPet.id)"
          >
            继续编辑这只宠物
          </RouterLink>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="List" title="宠物清单" description="建档、更新和发需求各走各的入口。">
      <PetPalDeskEmpty
        v-if="!auth.isAuthenticated"
        title="登录后管理宠物档案"
        description="宠物档案是主人侧所有需求和订单的起点。"
      >
        <template #actions>
          <RouterLink class="frontend-page__button is-primary" to="/login">去登录</RouterLink>
        </template>
      </PetPalDeskEmpty>

      <PetPalDeskEmpty
        v-else-if="!pets.length"
        title="还没有宠物档案"
        description="先建第一只宠物，再进入需求页发布照料计划。"
      >
        <template #actions>
          <RouterLink
            class="frontend-page__button is-primary"
            :to="buildOwnerPetCreateRoute('这里已经定位到新建宠物档案，可先补齐第一只宠物后再回来继续主人任务。')"
          >
            新建宠物档案
          </RouterLink>
        </template>
      </PetPalDeskEmpty>

      <div v-else class="petpal-sheet-list">
        <div v-for="pet in pets" :key="pet.id" class="petpal-sheet-row" :class="{ 'is-focused': pet.id === highlightedPetId }">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ pet.name }}</h3>
            <p class="petpal-sheet-row__desc">{{ pet.species }} · {{ pet.breed || '品种待补充' }} · {{ pet.gender }}</p>
            <p class="petpal-sheet-row__desc">{{ pet.feedingNote || pet.medicalNote || '护理说明待补充' }}</p>
            <div class="petpal-pill-row">
              <span class="petpal-pill">体重 {{ pet.weightKg || '--' }} kg</span>
              <span class="petpal-pill" :class="pet.neutered ? 'is-success' : 'is-warning'">{{ pet.neutered ? '已绝育' : '未绝育' }}</span>
              <span v-for="tag in pet.temperamentTags.slice(0, 3)" :key="tag" class="petpal-pill">{{ tag }}</span>
            </div>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="buildOwnerPetEditRoute(pet.id)">编辑资料</RouterLink>
            <RouterLink
              :to="buildOwnerRequestCreateRoute(pet.id, '这里已经带着这只宠物进入需求表单，可直接继续填写服务时间和预算。')"
            >
              为它发需求
            </RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>

    <PetPalDeskSection eyebrow="Guide" title="建档时建议优先补齐" description="尽量让照料者和售后链路拿到稳定的基础信息。">
      <ul class="petpal-text-list">
        <li>喂养说明、过敏说明和医疗说明优先填写，避免下单后再口头补充。</li>
        <li>紧急联系人建议保留真实电话，便于照料异常时快速联络。</li>
        <li>性格标签尽量写具体，例如怕生、护食、夜间敏感，而不是泛泛描述。</li>
      </ul>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { PetProfileRecord } from '@rbac/api-common';
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
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
import { petPalOwnerWorkspaceNav } from './shared';

const auth = useAuthStore();
const route = useRoute();
const pets = ref<PetProfileRecord[]>([]);
const loadState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'pets'>('');
const highlightedPetId = computed(() => getPetPalQueryString(route.query, 'focusPetId'));
const highlightedPet = computed(() => pets.value.find((item) => item.id === highlightedPetId.value) ?? null);
const primaryAction = computed(() => ({
  label: '新建宠物档案',
  to: buildOwnerPetCreateRoute('这里已经定位到新建宠物档案，可先补齐第一只宠物后再回来继续主人任务。'),
  tone: 'primary' as const,
}));
const pageActions = computed(() => [
  {
    label: '返回主人总览',
    to: buildOwnerDashboardRoute(
      pets.value.length
        ? '这里已经回到主人总览，可继续为宠物发需求、查看订单或处理售后。'
        : '这里已经回到主人总览，可继续开始第一只宠物档案。',
    ),
    tone: 'secondary' as const,
  },
]);

const heroStats = computed(() => {
  const withEmergencyContact = pets.value.filter((item) => item.emergencyContact?.phone).length;
  const withCareNotes = pets.value.filter((item) => item.feedingNote || item.allergyNote || item.medicalNote).length;
  return [
    { label: '宠物数量', value: String(pets.value.length), hint: '可直接用于需求表单' },
    { label: '紧急联系人', value: String(withEmergencyContact), hint: '异常情况可直接联络' },
    { label: '护理说明', value: String(withCareNotes), hint: '减少下单后补充沟通' },
    { label: '下一步', value: pets.value.length ? '继续发需求' : '先建第一只', hint: '建档后再进入需求页' },
  ];
});
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    loadState.value === 'error' ? '宠物清单暂未刷新完成，可直接重试当前页' : '',
  ]);
  if (!description) {
    return null;
  }
  return {
    title: loadState.value === 'error' ? '宠物清单暂未刷新完整' : '已回到宠物清单',
    description,
    tone: loadState.value === 'error' ? 'warning' as const : 'accent' as const,
  };
});

function buildOwnerPetCreateRoute(notice: string) {
  return {
    name: 'frontend-petpal-pet-create',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOwnerDashboardRoute(notice: string) {
  return {
    name: 'frontend-petpal',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function buildOwnerPetEditRoute(petId: string) {
  return {
    name: 'frontend-petpal-pet-edit',
    params: { id: petId },
    query: buildPetPalDeskHandoffQuery({
      notice: '这里已经定位到这只宠物档案，可直接继续补齐资料。',
      focusPetId: petId,
    }),
  };
}

function buildOwnerRequestCreateRoute(petId: string, notice: string) {
  return {
    name: 'frontend-petpal-request-create',
    query: {
      petId,
      ...buildPetPalDeskHandoffQuery({
        notice,
        focusPetId: petId,
      }),
    },
  };
}

async function loadPage() {
  if (!auth.isAuthenticated) {
    pets.value = [];
    loadState.value = 'ready';
    return;
  }
  try {
    loadState.value = 'idle';
    pets.value = await api.petpal.pets.list();
    loadState.value = 'ready';
  } catch (error: unknown) {
    loadState.value = 'error';
    ElMessage.error(getErrorMessage(error, '加载宠物档案失败'));
  }
}

async function retryPets() {
  await runPetPalSectionRetry({
    key: 'pets',
    sectionReloadingKey,
    reload: loadPage,
    getState: () => loadState.value,
    successMessage: '宠物清单已刷新',
    swallowError: true,
  });
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
</style>
