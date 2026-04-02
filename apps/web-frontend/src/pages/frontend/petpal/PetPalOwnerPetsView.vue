<template>
  <PetPalDeskPage
    eyebrow="宠物档案"
    title="宠物资料单独管理，需求和订单不再混在这里"
    summary="这个页面只保留宠物清单和进入编辑表单的入口。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-pets"
    :primary-action="{ label: '新建宠物档案', to: { name: 'frontend-petpal-pet-create' }, tone: 'primary' }"
    :actions="[{ label: '返回主人总览', to: { name: 'frontend-petpal' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
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
          <RouterLink class="frontend-page__button is-primary" :to="{ name: 'frontend-petpal-pet-create' }">新建宠物档案</RouterLink>
        </template>
      </PetPalDeskEmpty>

      <div v-else class="petpal-sheet-list">
        <div v-for="pet in pets" :key="pet.id" class="petpal-sheet-row">
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
            <RouterLink :to="{ name: 'frontend-petpal-pet-edit', params: { id: pet.id } }">编辑资料</RouterLink>
            <RouterLink :to="{ name: 'frontend-petpal-request-create', query: { petId: pet.id } }">为它发需求</RouterLink>
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
import { RouterLink } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { petPalOwnerWorkspaceNav } from './shared';

const auth = useAuthStore();
const pets = ref<PetProfileRecord[]>([]);

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

async function loadPage() {
  if (!auth.isAuthenticated) {
    pets.value = [];
    return;
  }
  try {
    pets.value = await api.petpal.pets.list();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载宠物档案失败'));
  }
}

onMounted(() => {
  void loadPage();
});
</script>
