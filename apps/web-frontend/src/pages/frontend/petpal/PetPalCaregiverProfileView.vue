<!--
UX Blueprint
User: 照料者需要专注填写入驻资料和上传资质
Entry: 照料者总览、服务清单前置要求
First screen: 当前审核状态、资料完整度、直接保存
Primary action: 保存照料者档案
Secondary actions: 上传资质材料、返回总览
States: 未登录、加载中、可新建、可编辑
-->
<template>
  <div class="frontend-page">
    <PetPalWorkspaceHero
      eyebrow="照料者工作区"
      title="入驻资料"
      summary="资料页只负责入驻信息和资质材料，不再混入服务清单和履约订单。"
      :nav-items="petPalCaregiverWorkspaceNav"
      active-name="frontend-petpal-caregiver-profile"
      :stats="heroStats"
      :primary-action="null"
      :actions="heroActions"
    />

    <template v-if="auth.isAuthenticated">
      <section class="frontend-page__section-grid">
        <article class="frontend-card petpal-grid-span-8">
          <span class="frontend-card__eyebrow">资料表单</span>
          <el-form :model="profileForm" label-position="top" size="small" class="petpal-form-grid">
            <el-form-item label="简介">
              <el-input v-model="profileForm.intro" type="textarea" :rows="4" placeholder="介绍照料经验、擅长宠物和服务风格" />
            </el-form-item>

            <div class="petpal-form-grid__row">
              <el-form-item label="经验年限">
                <el-input-number v-model="profileForm.experienceYears" :min="0" :max="60" style="width: 100%" />
              </el-form-item>
              <el-form-item label="服务半径(km)">
                <el-input-number v-model="profileForm.serviceRadiusKm" :min="1" :max="100" style="width: 100%" />
              </el-form-item>
            </div>

            <div class="petpal-form-grid__row">
              <el-form-item label="服务城市">
                <el-input v-model="profileForm.serviceCity" placeholder="例如：杭州" />
              </el-form-item>
              <el-form-item label="专长标签">
                <el-input v-model="specialtyTagsText" placeholder="例如：幼宠看护，猫咪喂养，异宠熟悉" />
              </el-form-item>
            </div>

            <el-form-item label="服务承诺">
              <el-input
                v-model="profileForm.serviceCommitment"
                type="textarea"
                :rows="4"
                placeholder="例如：支持每日两次图文反馈，紧急情况第一时间联系主人"
              />
            </el-form-item>
          </el-form>
        </article>

        <aside class="frontend-card petpal-grid-span-4">
          <span class="frontend-card__eyebrow">审核与资质</span>
          <div class="petpal-side-stack">
            <div class="petpal-side-item">
              <strong>审核状态</strong>
              <p>{{ caregiverProfile?.auditStatus || '待提交' }}</p>
              <p>{{ loadNotice }}</p>
            </div>

            <div class="petpal-side-item">
              <div class="petpal-side-item__head">
                <strong>资质材料</strong>
                <span>{{ profileForm.qualificationMaterials.length }}/12</span>
              </div>
              <input
                ref="qualificationUploadInput"
                type="file"
                multiple
                class="petpal-hidden-file-input"
                accept="image/*,.pdf"
                @change="onQualificationFilesChange"
              >
              <el-button plain :loading="qualificationUploading" @click="openQualificationFilePicker">
                上传资质材料
              </el-button>
              <el-progress
                v-if="qualificationUploadProgress !== null"
                :percentage="qualificationUploadProgress"
                :status="qualificationUploadProgress >= 100 ? 'success' : undefined"
              />
            </div>

            <div v-if="profileForm.qualificationMaterials.length" class="petpal-qualification-list">
              <div v-for="item in profileForm.qualificationMaterials" :key="item.fileId" class="petpal-qualification-item">
                <div class="petpal-qualification-item__copy">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.mimeType }} · {{ Math.round(item.size / 1024) }} KB</span>
                </div>
                <div class="petpal-inline-actions">
                  <el-button link type="primary" size="small" @click="openExternalLink(item.url)">预览</el-button>
                  <el-button link type="danger" size="small" @click="removeQualificationMaterial(item.fileId)">移除</el-button>
                </div>
              </div>
            </div>

            <div class="petpal-card-actions">
              <el-button type="primary" :loading="saving" @click="saveProfile">保存档案</el-button>
              <RouterLink :to="{ name: 'frontend-petpal-caregiver' }">
                <el-button>返回总览</el-button>
              </RouterLink>
            </div>
          </div>
        </aside>
      </section>
    </template>

    <section v-else class="frontend-card">
      <PetPalStatePanel
        eyebrow="入驻资料"
        title="登录后继续维护入驻资料"
        description="登录后在独立资料页填写介绍、城市、专长和资质材料。"
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
import type { CaregiverProfileRecord, CaregiverQualificationMaterialRecord } from '@rbac/api-common';
import { computed, onMounted, reactive, ref } from 'vue';
import { ElButton, ElMessage } from 'element-plus';
import { api } from '@/api/client';
import PetPalStatePanel from '@/pages/frontend/petpal/PetPalStatePanel.vue';
import PetPalWorkspaceHero from '@/pages/frontend/petpal/components/PetPalWorkspaceHero.vue';
import { useAuthStore } from '@/stores/auth';
import { uploadAttachmentFile } from '@/utils/direct-upload';
import { getErrorMessage } from '@/utils/errors';
import { petPalCaregiverWorkspaceNav } from './shared';

const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const qualificationUploading = ref(false);
const qualificationUploadProgress = ref<number | null>(null);
const qualificationUploadInput = ref<HTMLInputElement | null>(null);
const caregiverProfile = ref<CaregiverProfileRecord | null>(null);
const loadNotice = ref('首次填写后即可提交审核。');
const specialtyTagsText = ref('');

const profileForm = reactive({
  intro: '',
  experienceYears: 0,
  serviceRadiusKm: 5,
  serviceCity: '',
  serviceCommitment: '',
  qualificationMaterials: [] as CaregiverQualificationMaterialRecord[],
});

const heroStats = computed(() => [
  {
    label: '审核状态',
    value: caregiverProfile.value?.auditStatus || '待提交',
    hint: '资料页只负责入驻信息',
  },
  {
    label: '资质材料',
    value: String(profileForm.qualificationMaterials.length),
    hint: '支持图片和 PDF',
  },
  {
    label: '服务城市',
    value: profileForm.serviceCity || '待补充',
    hint: '会影响后续服务清单',
  },
  {
    label: '下一步',
    value: '保存档案',
    hint: '保存后再去服务清单',
  },
]);

const heroActions = computed(() => [
  { label: '返回总览', to: { name: 'frontend-petpal-caregiver' }, tone: 'secondary' as const },
  { label: '服务清单', to: { name: 'frontend-petpal-caregiver-services' }, tone: 'secondary' as const },
]);

const splitTagText = (value: string) => [...new Set(
  value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean),
)];

function applyProfile(profile: CaregiverProfileRecord) {
  caregiverProfile.value = profile;
  profileForm.intro = profile.intro || '';
  profileForm.experienceYears = profile.experienceYears;
  profileForm.serviceRadiusKm = profile.serviceRadiusKm;
  profileForm.serviceCity = profile.serviceCity || '';
  profileForm.serviceCommitment = profile.serviceCommitment || '';
  profileForm.qualificationMaterials = [...profile.qualificationMaterials];
  specialtyTagsText.value = profile.specialtyTags.join('，');
  loadNotice.value = profile.auditStatus === 'APPROVED'
    ? '资料已通过审核，可继续维护服务清单。'
    : '资料保存后会进入审核流程。';
}

async function loadProfile() {
  if (!auth.isAuthenticated || loading.value) {
    return;
  }

  loading.value = true;
  try {
    const profile = await api.petpal.caregiver.profile();
    applyProfile(profile);
  } catch (error: unknown) {
    caregiverProfile.value = null;
    profileForm.intro = '';
    profileForm.experienceYears = 0;
    profileForm.serviceRadiusKm = 5;
    profileForm.serviceCity = '';
    profileForm.serviceCommitment = '';
    profileForm.qualificationMaterials = [];
    specialtyTagsText.value = '';
    loadNotice.value = getErrorMessage(error, '还没有入驻资料，继续填写后可直接保存。');
  } finally {
    loading.value = false;
  }
}

function removeQualificationMaterial(fileId: string) {
  profileForm.qualificationMaterials = profileForm.qualificationMaterials.filter((item) => item.fileId !== fileId);
}

function openQualificationFilePicker() {
  qualificationUploadInput.value?.click();
}

function openExternalLink(url: string) {
  window.open(url, '_blank', 'noopener');
}

async function uploadQualificationFiles(files: File[]) {
  if (!files.length) {
    return;
  }

  qualificationUploading.value = true;
  qualificationUploadProgress.value = 0;

  const uploaded: CaregiverQualificationMaterialRecord[] = [];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  let completedSize = 0;

  try {
    for (const file of files) {
      const result = await uploadAttachmentFile(
        file,
        {
          tag1: 'petpal-caregiver-qualification',
          tag2: caregiverProfile.value?.id || 'draft',
        },
        (percent) => {
          const currentBytes = Math.round((file.size * percent) / 100);
          qualificationUploadProgress.value = Math.min(
            99,
            Math.round(((completedSize + currentBytes) / Math.max(totalSize, 1)) * 100),
          );
        },
      );

      uploaded.push({
        fileId: result.fileId,
        url: result.url,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedAt: new Date().toISOString(),
      });

      completedSize += file.size;
      qualificationUploadProgress.value = Math.min(
        99,
        Math.round((completedSize / Math.max(totalSize, 1)) * 100),
      );
    }

    profileForm.qualificationMaterials = [
      ...profileForm.qualificationMaterials,
      ...uploaded,
    ].slice(0, 12);
    qualificationUploadProgress.value = 100;
    ElMessage.success(`已上传 ${uploaded.length} 份资质材料`);
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '上传资质材料失败'));
  } finally {
    qualificationUploading.value = false;
    setTimeout(() => {
      qualificationUploadProgress.value = null;
    }, 600);
  }
}

async function onQualificationFilesChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  await uploadQualificationFiles(files);
}

async function saveProfile() {
  saving.value = true;
  try {
    const profile = await api.petpal.caregiver.upsertProfile({
      intro: profileForm.intro.trim() || undefined,
      experienceYears: profileForm.experienceYears,
      serviceRadiusKm: profileForm.serviceRadiusKm,
      serviceCity: profileForm.serviceCity.trim() || undefined,
      specialtyTags: splitTagText(specialtyTagsText.value),
      serviceCommitment: profileForm.serviceCommitment.trim() || undefined,
      qualificationMaterials: profileForm.qualificationMaterials,
    });
    applyProfile(profile);
    ElMessage.success('照料者档案已更新');
  } catch (error: unknown) {
    ElMessage.error(getErrorMessage(error, '保存照料者档案失败'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (!auth.isAuthenticated) {
    return;
  }
  void loadProfile();
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
.petpal-side-stack,
.petpal-qualification-list {
  display: grid;
  gap: 16px;
}

.petpal-form-grid__row,
.petpal-card-actions,
.petpal-inline-actions,
.petpal-side-item__head,
.petpal-qualification-item {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-side-item,
.petpal-qualification-item {
  padding: 16px;
  border-radius: 18px;
  background: rgba(248, 252, 251, 0.86);
  border: 1px solid rgba(18, 53, 51, 0.08);
}

.petpal-hidden-file-input {
  display: none;
}

.petpal-qualification-item__copy {
  display: grid;
  gap: 4px;
}

.petpal-qualification-item__copy span {
  color: #6d8683;
  font-size: 12px;
}

@media (max-width: 1080px) {
  .petpal-grid-span-8,
  .petpal-grid-span-4 {
    grid-column: span 12;
  }
}

@media (max-width: 720px) {
  .petpal-form-grid__row {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
