<template>
  <PetPalDeskPage
    eyebrow="需求表单"
    title="把这次照料需求单独写清楚"
    summary="创建需求只在表单页完成，匹配和下单会在需求队列里继续。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal-requests"
    :actions="[{ label: '返回需求队列', to: { name: 'frontend-petpal-requests' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone" />
    </template>

    <PetPalDeskSection eyebrow="Form" title="需求信息" description="时间、地点、预算越清晰，后续匹配越稳定。">
      <PetPalDeskEmpty
        v-if="!pets.length"
        title="先准备一只可用宠物"
        description="需求发布依赖宠物档案，请先建档后再回来。"
      >
        <template #actions>
          <RouterLink
            class="frontend-page__button is-primary"
            :to="buildOwnerPetCreateRoute('这里已经定位到新建宠物档案，建档完成后可从宠物清单继续发起需求。')"
          >
            去建宠物档案
          </RouterLink>
        </template>
      </PetPalDeskEmpty>

      <template v-else>
        <el-form label-position="top" class="petpal-field-grid">
          <el-form-item label="选择宠物">
            <el-select v-model="form.petId" style="width: 100%">
              <el-option v-for="pet in pets" :key="pet.id" :label="pet.name" :value="pet.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="服务类型">
            <el-select v-model="form.serviceType" style="width: 100%">
              <el-option v-for="item in petPalServiceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker v-model="form.startTime" type="datetime" style="width: 100%" placeholder="选择开始时间" />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker v-model="form.endTime" type="datetime" style="width: 100%" placeholder="选择结束时间" />
          </el-form-item>
          <el-form-item label="地点" class="petpal-span-12">
            <el-input v-model="form.locationText" maxlength="120" placeholder="例如：杭州市西湖区文三路 88 号" />
          </el-form-item>
          <el-form-item label="预算" class="petpal-span-6">
            <el-input-number v-model="form.budgetAmount" :min="0" :max="10000" :precision="0" style="width: 100%" />
          </el-form-item>
          <el-form-item label="需求标签" class="petpal-span-6">
            <el-input v-model="form.demandTagsText" placeholder="例如：怕生，需喂药，希望回传照片" />
          </el-form-item>
        </el-form>
      </template>
    </PetPalDeskSection>

    <PetPalDeskSection eyebrow="Submit" title="提交后会发生什么" description="提交后回到需求队列查看匹配结果，确认后再创建订单。">
      <ul class="petpal-text-list">
        <li>需求会进入需求队列，后续匹配照料者和建单都从队列页继续。</li>
        <li>如果预算、服务时间或地点变化，建议直接新建下一条需求，避免把历史需求改成混合状态。</li>
      </ul>
      <div class="petpal-actions">
        <el-button type="primary" :loading="submitting" :disabled="!pets.length" @click="submit">发布需求</el-button>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { PetProfileRecord } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { buildPetPalDeskHandoffQuery, getPetPalQueryString, mergePetPalPageNotice } from './recovery';
import { normalizePetPalTagText, petPalOwnerWorkspaceNav, petPalServiceTypeOptions } from './shared';

const route = useRoute();
const router = useRouter();

const pets = ref<PetProfileRecord[]>([]);
const submitting = ref(false);
const form = reactive({
  petId: '',
  serviceType: 'BOARDING' as typeof petPalServiceTypeOptions[number]['value'],
  startTime: null as Date | null,
  endTime: null as Date | null,
  locationText: '',
  budgetAmount: 0,
  demandTagsText: '',
});
const preferredPetId = computed(() => getPetPalQueryString(route.query, 'petId'));
const preferredPet = computed(() => pets.value.find((item) => item.id === preferredPetId.value) ?? null);

const heroStats = computed(() => [
  { label: '可用宠物', value: String(pets.value.length), hint: '先选一只作为本次需求对象' },
  { label: '服务类型', value: form.serviceType, hint: '后续匹配按该服务筛选' },
  { label: '预算', value: form.budgetAmount ? `¥${form.budgetAmount}` : '待填写', hint: '预算会影响匹配结果' },
  { label: '状态', value: '待提交', hint: '提交后回需求队列继续' },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
    preferredPet.value ? `当前已带入宠物：${preferredPet.value.name}` : '',
  ]);
  if (!description) {
    return null;
  }
  return {
    title: '已进入需求表单',
    description,
    tone: 'accent' as const,
  };
});

function buildOwnerPetCreateRoute(notice: string) {
  return {
    name: 'frontend-petpal-pet-create',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

async function loadPage() {
  try {
    pets.value = await api.petpal.pets.list();
    form.petId = pets.value.some((item) => item.id === preferredPetId.value)
      ? preferredPetId.value
      : pets.value[0]?.id || '';
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载宠物档案失败'));
  }
}

async function submit() {
  if (!form.petId) {
    ElMessage.warning('请先选择宠物');
    return;
  }
  if (!form.startTime || !form.endTime) {
    ElMessage.warning('请先补齐服务时间');
    return;
  }
  if (!form.locationText.trim()) {
    ElMessage.warning('请先填写地点');
    return;
  }

  submitting.value = true;
  try {
    const result = await api.petpal.requests.create({
      petId: form.petId,
      serviceType: form.serviceType,
      startTime: form.startTime.toISOString(),
      endTime: form.endTime.toISOString(),
      locationText: form.locationText.trim(),
      budgetAmount: form.budgetAmount > 0 ? Number(form.budgetAmount) : undefined,
      demandTags: normalizePetPalTagText(form.demandTagsText),
    });
    ElMessage.success('需求已发布');
    await router.push({
      name: 'frontend-petpal-requests',
      query: buildPetPalDeskHandoffQuery({
        notice: '新需求已发布，可直接查看这条需求的匹配结果并继续下单。',
        focusRequestId: result.id,
      }),
    });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '发布需求失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>
