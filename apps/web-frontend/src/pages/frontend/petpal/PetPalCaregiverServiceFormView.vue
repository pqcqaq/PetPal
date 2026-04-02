<template>
  <PetPalDeskPage
    eyebrow="服务表单"
    :title="isEditing ? '更新服务配置' : '新建服务配置'"
    summary="表单页只负责一个服务的配置，不再展示审核或履约内容。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-services"
    :actions="pageActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone" />
    </template>

    <PetPalDeskSection eyebrow="Form" :title="isEditing ? '编辑服务' : '填写服务'" description="价格、计价单位、提前时长和城市是主人最先看到的字段。">
      <PetPalDeskEmpty
        v-if="!hasProfile"
        title="请先完成入驻资料"
        description="没有入驻资料时，先去资料页完成建档，再回来创建服务。"
      >
        <template #actions>
          <RouterLink
            class="frontend-page__button is-primary"
            :to="{
              name: 'frontend-petpal-caregiver-profile',
              query: buildPetPalDeskHandoffQuery({
                notice: '这里已经定位到入驻资料页，可先补齐资料后再回来创建服务。',
              }),
            }"
          >
            去资料页
          </RouterLink>
        </template>
      </PetPalDeskEmpty>

      <el-form v-else label-position="top" class="petpal-field-grid">
        <el-form-item label="服务类型">
          <el-select v-model="form.serviceType" style="width: 100%">
            <el-option v-for="item in petPalServiceTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="适配宠物">
          <el-select v-model="form.petSpecies" style="width: 100%">
            <el-option v-for="item in petPalSpeciesOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="报价">
          <el-input-number v-model="form.pricePerUnit" :min="1" :max="10000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计价单位">
          <el-input v-model="form.unitType" maxlength="12" placeholder="例如：小时 / 次" />
        </el-form-item>
        <el-form-item label="最短提前小时">
          <el-input-number v-model="form.minNoticeHours" :min="0" :max="168" style="width: 100%" />
        </el-form-item>
        <el-form-item label="服务城市">
          <el-input v-model="form.serviceCity" maxlength="30" placeholder="例如：杭州" />
        </el-form-item>
        <el-form-item label="是否上架">
          <el-switch v-model="form.isActive" />
        </el-form-item>
      </el-form>
    </PetPalDeskSection>

    <PetPalDeskSection eyebrow="Submit" title="保存服务" description="保存后回服务清单继续查看所有服务组合。">
      <div class="petpal-actions">
        <el-button type="primary" :loading="submitting" :disabled="!hasProfile" @click="submit">{{ isEditing ? '保存更新' : '创建服务' }}</el-button>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverServiceRecord } from '@rbac/api-common';
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
import { petPalCaregiverWorkspaceNav, petPalServiceTypeOptions, petPalSpeciesOptions } from './shared';

const route = useRoute();
const router = useRouter();

const editingServiceId = computed(() => typeof route.params.id === 'string' ? route.params.id : '');
const isEditing = computed(() => Boolean(editingServiceId.value));
const hasProfile = ref(false);
const submitting = ref(false);

const form = reactive({
  serviceType: 'BOARDING' as typeof petPalServiceTypeOptions[number]['value'],
  petSpecies: 'DOG' as typeof petPalSpeciesOptions[number]['value'],
  pricePerUnit: 60,
  unitType: '小时',
  minNoticeHours: 2,
  serviceCity: '',
  isActive: true,
});

const heroStats = computed(() => [
  { label: '当前模式', value: isEditing.value ? '编辑' : '新建', hint: '一次只维护一个服务' },
  { label: '服务类型', value: form.serviceType, hint: '会影响主人匹配入口' },
  { label: '服务城市', value: form.serviceCity || '待填写', hint: '默认沿用资料页城市' },
  { label: '在售状态', value: form.isActive ? '在售' : '停用', hint: '保存后可随时切换' },
]);
const pageActions = computed(() => [
  {
    label: '返回服务清单',
    to: buildServiceListRoute(
      isEditing.value ? '这里已经回到服务清单，可继续查看这个服务的上下架状态。' : '这里已经回到服务清单，可继续查看所有服务配置。',
      editingServiceId.value || undefined,
    ),
    tone: 'secondary' as const,
  },
]);
const pageNotice = computed(() => {
  const description = mergePetPalPageNotice([
    getPetPalQueryString(route.query, 'notice'),
  ]);
  if (!description) {
    return null;
  }
  return {
    title: isEditing.value ? '已进入服务编辑页' : '已进入新建服务页',
    description,
    tone: 'accent' as const,
  };
});

function buildServiceListRoute(notice: string, serviceId?: string) {
  return {
    name: 'frontend-petpal-caregiver-services',
    query: buildPetPalDeskHandoffQuery({
      notice,
      ...(serviceId ? { focusServiceId: serviceId } : {}),
    }),
  };
}

function applyService(service: CaregiverServiceRecord) {
  form.serviceType = service.serviceType;
  form.petSpecies = service.petSpecies;
  form.pricePerUnit = Number(service.pricePerUnit);
  form.unitType = service.unitType;
  form.minNoticeHours = service.minNoticeHours;
  form.serviceCity = service.serviceCity || '';
  form.isActive = service.isActive;
}

async function loadPage() {
  try {
    const profile = await api.petpal.caregiver.profile();
    hasProfile.value = true;
    form.serviceCity = profile.serviceCity || '';
  } catch {
    hasProfile.value = false;
    return;
  }

  if (!editingServiceId.value) {
    return;
  }

  try {
    const services = await api.petpal.caregiver.services();
    const target = services.find((item) => item.id === editingServiceId.value);
    if (!target) {
      ElMessage.warning('没有找到对应服务');
      void router.replace(buildServiceListRoute('未找到对应服务，已回到服务清单，可改为检查其他服务配置。'));
      return;
    }
    applyService(target);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载服务配置失败'));
  }
}

async function submit() {
  if (!form.unitType.trim()) {
    ElMessage.warning('请填写计价单位');
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      serviceType: form.serviceType,
      petSpecies: form.petSpecies,
      pricePerUnit: Number(form.pricePerUnit),
      unitType: form.unitType.trim(),
      minNoticeHours: form.minNoticeHours,
      serviceCity: form.serviceCity.trim() || undefined,
      isActive: form.isActive,
      availableSlots: [],
    };

    if (editingServiceId.value) {
      const result = await api.petpal.caregiver.updateService(editingServiceId.value, payload);
      ElMessage.success('服务已更新');
      await router.push({
        ...buildServiceListRoute('服务配置已更新，可继续检查上下架状态或再次编辑。', result.id),
      });
    } else {
      const result = await api.petpal.caregiver.createService(payload);
      ElMessage.success('服务已创建');
      await router.push({
        ...buildServiceListRoute('新服务已创建，可继续微调报价或上架状态。', result.id),
      });
    }
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存服务失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>
