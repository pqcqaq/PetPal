<template>
  <PetPalDeskPage
    eyebrow="入驻资料"
    title="把服务能力和审核资料写在单独页面"
    summary="这页只负责入驻资料，不承接服务上架和履约动作。"
    :nav-items="petPalCaregiverWorkspaceNav"
    active-name="frontend-petpal-caregiver-profile"
    :actions="pageActions"
    :stats="heroStats"
  >
    <template v-if="pageNotice" #notice>
      <PetPalDeskNotice eyebrow="Handoff" :title="pageNotice.title" :description="pageNotice.description" :tone="pageNotice.tone">
        <template #actions>
          <el-button
            v-if="profileState === 'error'"
            :loading="sectionReloadingKey === 'profile'"
            @click="retryProfile"
          >
            重试资料页
          </el-button>
        </template>
      </PetPalDeskNotice>
    </template>

    <PetPalDeskSection eyebrow="Profile" title="基础资料" description="城市、半径、经验和专长直接影响主人匹配结果。">
      <PetPalDeskEmpty
        v-if="profileState === 'error'"
        title="入驻资料暂未刷新完成"
        description="可以先重试资料页，恢复后再继续维护城市、经验和资质材料。"
      />

      <el-form v-else label-position="top" class="petpal-field-grid">
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

    <PetPalDeskSection
      v-if="profileState !== 'error'"
      eyebrow="Materials"
      title="资质材料"
      description="材料会按当前照料者档案范围上传；首次上传前请先保存一次基础资料。"
    >
      <PetPalDeskEmpty
        v-if="!form.qualificationMaterials.length"
        title="当前没有资质材料"
        description="可以先保存基础资料，后续再补上传资质截图。"
      />

      <div v-else class="petpal-sheet-list">
        <div v-for="item in form.qualificationMaterials" :key="item.fileId" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ item.name }}</h3>
            <p class="petpal-sheet-row__desc">{{ item.url }}</p>
            <p class="petpal-sheet-row__desc">{{ formatQualificationMaterialMeta(item) }}</p>
          </div>
          <div class="petpal-sheet-row__tail">
            <button type="button" class="petpal-link-button" @click="openQualificationMaterial(item.url)">查看</button>
            <button type="button" class="petpal-link-button" @click="removeMaterial(item.fileId)">移除</button>
          </div>
        </div>
      </div>

      <input
        ref="qualificationInputRef"
        class="petpal-qualification-upload-input"
        type="file"
        accept="image/*"
        multiple
        @change="handleQualificationMaterialChange"
      >
      <div class="petpal-actions">
        <el-button
          :loading="uploadingMaterials"
          :disabled="profileState !== 'ready' || qualificationSlotsLeft <= 0 || submitting"
          @click="triggerQualificationMaterialInput"
        >
          {{ uploadingMaterials ? '上传中...' : `上传资质截图${qualificationSlotsLeft > 0 ? `（剩余 ${qualificationSlotsLeft} 份）` : ''}` }}
        </el-button>
        <span class="petpal-sheet-row__desc">当前最多保留 {{ PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT }} 份，每次最多上传 {{ PETPAL_CAREGIVER_QUALIFICATION_UPLOAD_MAX_COUNT }} 份图片。</span>
      </div>
    </PetPalDeskSection>

    <PetPalDeskSection
      v-if="profileState !== 'error'"
      eyebrow="Submit"
      title="保存资料"
      description="保存后会回到照料者工作台继续查看审核状态和后续动作。"
    >
      <div class="petpal-actions">
        <el-button type="primary" :loading="submitting" @click="submit">保存资料</el-button>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import {
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_MAX_SIZE_BYTES,
  PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
  PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT,
  PETPAL_CAREGIVER_QUALIFICATION_UPLOAD_MAX_COUNT,
  createManagedAttachmentRecord,
  type CaregiverProfileRecord,
  type CaregiverQualificationMaterialRecord,
} from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api/client';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';
import PetPalDeskEmpty from './rebuild/petpal-desk-empty.vue';
import PetPalDeskNotice from './rebuild/petpal-desk-notice.vue';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import {
  buildPetPalPageNotice,
  buildPetPalDeskHandoffQuery,
  getPetPalQueryString,
  runPetPalSectionRetry,
  type PetPalSectionLoadState,
} from './recovery';
import { getPetPalCaregiverAuditLabel, normalizePetPalTagText, petPalCaregiverWorkspaceNav } from './shared';

const route = useRoute();
const router = useRouter();

const profile = ref<CaregiverProfileRecord | null>(null);
const profileState = ref<PetPalSectionLoadState>('idle');
const sectionReloadingKey = ref<'' | 'profile'>('');
const submitting = ref(false);
const uploadingMaterials = ref(false);
const qualificationInputRef = ref<HTMLInputElement | null>(null);

const form = reactive({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [] as CaregiverQualificationMaterialRecord[],
});
const qualificationSlotsLeft = computed(() =>
  Math.max(0, PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT - form.qualificationMaterials.length));

const pageNotice = computed(() => buildPetPalPageNotice({
  baseNotice: getPetPalQueryString(route.query, 'notice'),
  warnings: [
    profileState.value === 'error' ? '入驻资料暂未刷新完成，可先重试当前页' : '',
  ],
  successTitle: '已进入入驻资料页',
  warningTitle: '入驻资料暂未刷新完整',
}));
const pageActions = computed(() => [
  {
    label: '返回照料者总览',
    to: buildCaregiverDashboardRoute(
      profile.value
        ? '这里已经回到照料者总览，可继续查看审核状态、维护服务或处理履约任务。'
        : '这里已经回到照料者总览，可继续决定先完善入驻资料还是查看其他入口。',
    ),
    tone: 'secondary' as const,
  },
]);

const heroStats = computed(() => [
  { label: '审核状态', value: profile.value ? getPetPalCaregiverAuditLabel(profile.value.auditStatus) : '待提交', hint: '保存后平台可继续审核' },
  { label: '材料数量', value: String(form.qualificationMaterials.length), hint: '条目越清晰越方便审核' },
  { label: '服务城市', value: form.serviceCity || '待填写', hint: '会影响主人筛选' },
  { label: '服务半径', value: `${form.serviceRadiusKm} km`, hint: '建议按真实接单范围填写' },
]);

const hasStatus = (error: unknown): error is { status: number } =>
  typeof error === 'object'
  && error !== null
  && typeof Reflect.get(error, 'status') === 'number';

function resetForm() {
  profile.value = null;
  form.intro = '';
  form.experienceYears = 0;
  form.serviceRadiusKm = 5;
  form.serviceCity = '';
  form.specialtyTagsText = '';
  form.serviceCommitment = '';
  form.qualificationMaterials = [];
}

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

function buildCaregiverDashboardRoute(notice: string) {
  return {
    name: 'frontend-petpal-caregiver',
    query: buildPetPalDeskHandoffQuery({ notice }),
  };
}

function removeMaterial(fileId: string) {
  form.qualificationMaterials = form.qualificationMaterials.filter((item) => item.fileId !== fileId);
}

function formatQualificationMaterialSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '大小未知';
  }
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatQualificationMaterialMeta(item: CaregiverQualificationMaterialRecord) {
  const uploadedAt = item.uploadedAt ? item.uploadedAt.slice(0, 10) : '--';
  const segments = [formatQualificationMaterialSize(item.size)];
  if (item.mimeType && item.mimeType !== 'link/manual') {
    segments.unshift(item.mimeType);
  }
  segments.push(uploadedAt);
  return segments.join(' · ');
}

function openQualificationMaterial(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function triggerQualificationMaterialInput() {
  if (!profile.value?.id) {
    ElMessage.warning('请先保存一次基础资料，再上传资质材料');
    return;
  }
  qualificationInputRef.value?.click();
}

async function handleQualificationMaterialChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const selectedFiles = Array.from(input?.files ?? []);
  if (input) {
    input.value = '';
  }

  if (!profile.value?.id || !selectedFiles.length) {
    return;
  }

  const allowedCount = Math.min(
    qualificationSlotsLeft.value,
    PETPAL_CAREGIVER_QUALIFICATION_UPLOAD_MAX_COUNT,
  );
  const limitedFiles = selectedFiles.slice(0, allowedCount);
  if (selectedFiles.length > limitedFiles.length) {
    ElMessage.warning(`一次最多还能添加 ${allowedCount} 份资质材料`);
  }

  const validFiles = limitedFiles.filter((file) =>
    (!file.type || file.type.startsWith('image/')) && file.size <= PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_MAX_SIZE_BYTES);
  if (validFiles.length < limitedFiles.length) {
    ElMessage.warning('仅支持上传不超过 8 MB 的图片文件');
  }

  if (!validFiles.length) {
    return;
  }

  uploadingMaterials.value = true;
  try {
    for (const file of validFiles) {
      const uploaded = await uploadAttachmentFile(file, {
        tag1: PETPAL_CAREGIVER_QUALIFICATION_ATTACHMENT_TAG,
        tag2: profile.value.id,
      });

      form.qualificationMaterials = [
        ...form.qualificationMaterials,
        createManagedAttachmentRecord({
          fileId: uploaded.fileId,
          url: uploaded.url,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          uploadedAt: new Date(),
        }),
      ].slice(0, PETPAL_CAREGIVER_QUALIFICATION_MAX_COUNT);
    }

    ElMessage.success(validFiles.length === 1 ? '资质材料已上传' : `已上传 ${validFiles.length} 份资质材料`);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '上传资质材料失败'));
  } finally {
    uploadingMaterials.value = false;
  }
}

async function loadProfile() {
  profileState.value = 'idle';
  try {
    const result = await api.petpal.caregiver.profile();
    applyProfile(result);
    profileState.value = 'ready';
  } catch (error) {
    if (hasStatus(error) && error.status === 404) {
      resetForm();
      profileState.value = 'ready';
      return;
    }
    profileState.value = 'error';
    throw error;
  }
}

async function loadPage() {
  try {
    await loadProfile();
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '加载照料者资料失败'));
  }
}

async function submit() {
  submitting.value = true;
  try {
    const hadProfile = Boolean(profile.value);
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
    ElMessage.success(hadProfile ? '照料者资料已更新' : '照料者资料已保存');
    await router.push({
      name: 'frontend-petpal-caregiver',
      query: buildPetPalDeskHandoffQuery({
        notice: hadProfile
          ? '入驻资料已更新，可继续查看审核状态或维护服务。'
          : '入驻资料已保存，可继续查看审核状态并开始维护服务。',
      }),
    });
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存照料者资料失败'));
  } finally {
    submitting.value = false;
  }
}

async function retryProfile() {
  await runPetPalSectionRetry({
    key: 'profile',
    sectionReloadingKey,
    reload: loadProfile,
    getState: () => profileState.value,
    successMessage: '入驻资料已刷新',
    swallowError: true,
  });
}

onMounted(() => {
  void loadPage();
});
</script>

<style scoped lang="scss">
.petpal-material-entry {
  align-items: end;
}

.petpal-qualification-upload-input {
  display: none;
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
