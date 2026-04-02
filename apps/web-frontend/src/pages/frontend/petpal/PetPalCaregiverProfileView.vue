<template>
  <PetPalDeskPage
    eyebrow="入驻资料"
    title="把服务能力和审核资料写在单独页面"
    summary="这页只负责入驻资料，不承接服务上架和履约动作。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-profile"
    :actions="[{ label: '返回照料者总览', to: { name: 'frontend-petpal-caregiver' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Profile" title="基础资料" description="城市、半径、经验和专长直接影响主人匹配结果。">
      <el-form label-position="top" class="petpal-field-grid">
        <el-form-item label="服务城市">
          <el-input v-model="form.serviceCity" maxlength="30" placeholder="例如：杭州" />
        </el-form-item>
        <el-form-item label="服务半径 (km)">
          <el-input-number v-model="form.serviceRadiusKm" :min="1" :max="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="经验年限">
          <el-input-number v-model="form.experienceYears" :min="0" :max="30" style="width: 100%" />
        </el-form-item>
        <el-form-item label="专长标签">
          <el-input v-model="form.specialtyTagsText" placeholder="例如：幼宠、老年犬、猫咪喂药" />
        </el-form-item>
        <el-form-item label="个人简介" class="petpal-span-12">
          <el-input v-model="form.intro" type="textarea" :rows="4" maxlength="300" show-word-limit placeholder="用 2-3 句话说明你的照料风格和经验。" />
        </el-form-item>
        <el-form-item label="服务承诺" class="petpal-span-12">
          <el-input v-model="form.serviceCommitment" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：每 4 小时回传一次照片" />
        </el-form-item>
      </el-form>
    </PetPalDeskSection>

    <PetPalDeskSection eyebrow="Materials" title="资质材料" description="为了简化流程，这里改成手动维护材料条目，不再堆叠上传卡片。">
      <div class="petpal-field-grid petpal-material-entry">
        <el-form-item label="材料名称">
          <el-input v-model="materialDraft.name" maxlength="40" placeholder="例如：宠物护理证书" />
        </el-form-item>
        <el-form-item label="材料链接">
          <el-input v-model="materialDraft.url" maxlength="240" placeholder="例如：https://..." />
        </el-form-item>
      </div>
      <div class="petpal-actions">
        <el-button @click="appendMaterial">添加材料</el-button>
      </div>

      <PetPalDeskEmpty
        v-if="!form.qualificationMaterials.length"
        title="当前没有资质材料"
        description="如果暂时没有材料，也可以先保存基础资料，后续再补充。"
      />

      <div v-else class="petpal-sheet-list">
        <div v-for="item in form.qualificationMaterials" :key="item.fileId" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ item.name }}</h3>
            <p class="petpal-sheet-row__desc">{{ item.url }}</p>
            <p class="petpal-sheet-row__desc">{{ item.mimeType }} · {{ item.uploadedAt.slice(0, 10) }}</p>
          </div>
          <div class="petpal-sheet-row__tail">
            <a :href="item.url" target="_blank" rel="noreferrer">查看</a>
            <button type="button" class="petpal-link-button" @click="removeMaterial(item.fileId)">移除</button>
          </div>
        </div>
      </div>
    </PetPalDeskSection>

    <PetPalDeskSection eyebrow="Submit" title="保存资料" description="资料保存后仍可继续调整，审核状态会自动刷新。">
      <div class="petpal-actions">
        <el-button type="primary" :loading="submitting" @click="submit">保存资料</el-button>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverQualificationMaterialRecord } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { getPetPalCaregiverAuditLabel, normalizePetPalTagText, petPalCaregiverWorkspaceNav } from './shared';

const profile = ref<CaregiverProfileRecord | null>(null);
const submitting = ref(false);

const form = reactive({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [] as CaregiverQualificationMaterialRecord[],
});

const materialDraft = reactive({
  name: '',
  url: '',
});

const heroStats = computed(() => [
  { label: '审核状态', value: profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '待提交', hint: '保存后平台可继续审核' },
  { label: '材料数量', value: String(form.qualificationMaterials.length), hint: '条目越清晰越方便审核' },
  { label: '服务城市', value: form.serviceCity || '待填写', hint: '会影响主人筛选' },
  { label: '服务半径', value: `${form.serviceRadiusKm} km`, hint: '建议按真实接单范围填写' },
]);

function applyProfile(value: CaregiverProfileRecord) {
  profile.value = value;
  form.intro = value.intro || '';
  form.experienceYears = value.experienceYears;
  form.serviceRadiusKm = value.serviceRadiusKm;
  form.serviceCity = value.serviceCity || '';
  form.specialtyTagsText = value.specialtyTags.join('，');
  form.serviceCommitment = value.serviceCommitment || '';
  form.qualificationMaterials = [...value.qualificationMaterials];
}

function appendMaterial() {
  if (!materialDraft.name.trim() || !materialDraft.url.trim()) {
    ElMessage.warning('请先填写材料名称和链接');
    return;
  }
  form.qualificationMaterials = [
    ...form.qualificationMaterials,
    {
      fileId: `manual-${Date.now()}`,
      url: materialDraft.url.trim(),
      name: materialDraft.name.trim(),
      mimeType: 'link/manual',
      size: 0,
      uploadedAt: new Date().toISOString(),
    },
  ];
  materialDraft.name = '';
  materialDraft.url = '';
}

function removeMaterial(fileId: string) {
  form.qualificationMaterials = form.qualificationMaterials.filter((item) => item.fileId !== fileId);
}

async function loadPage() {
  try {
    const result = await api.petpal.caregiver.profile();
    applyProfile(result);
  } catch {
    profile.value = null;
  }
}

async function submit() {
  submitting.value = true;
  try {
    const result = await api.petpal.caregiver.upsertProfile({
      intro: form.intro.trim() || undefined,
      experienceYears: form.experienceYears,
      serviceRadiusKm: form.serviceRadiusKm,
      serviceCity: form.serviceCity.trim() || undefined,
      specialtyTags: normalizePetPalTagText(form.specialtyTagsText),
      serviceCommitment: form.serviceCommitment.trim() || undefined,
      qualificationMaterials: form.qualificationMaterials,
    });
    applyProfile(result);
    ElMessage.success('照料者资料已保存');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存照料者资料失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-material-entry {
  align-items: end;
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
