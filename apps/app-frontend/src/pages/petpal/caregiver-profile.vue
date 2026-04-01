<script lang="ts" setup>
import type {
  CaregiverProfileRecord,
  CaregiverQualificationMaterialRecord,
} from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getCaregiverProfile, upsertCaregiverProfile } from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  formatAmount,
  getCaregiverAuditHint,
  getCaregiverAuditLabel,
  joinTagText,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  splitTagText,
} from './owner-shared'

defineOptions({
  name: 'PetPalCaregiverProfilePage',
})

definePage({
  style: {
    navigationBarTitleText: '入驻中心',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)

const profileForm = reactive({
  intro: '',
  experienceYears: '0',
  serviceRadiusKm: '5',
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [] as CaregiverQualificationMaterialRecord[],
})

const {
  uploading: qualificationUploading,
  selectAndUploadAttachments,
} = useManagedAttachmentUpload({
  maxCount: 3,
  maxSizeMb: 8,
})

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '把照料者介绍、经验、服务承诺和资质材料集中在入驻中心维护。'
    : '登录后即可进入照料者入驻中心。'
))

function getAuditTagType() {
  if (!caregiverProfile.value) {
    return 'default'
  }
  if (caregiverProfile.value.auditStatus === 'APPROVED') {
    return 'success'
  }
  if (caregiverProfile.value.auditStatus === 'REJECTED') {
    return 'danger'
  }
  return 'warning'
}

function hydrateProfile(profile: CaregiverProfileRecord | null) {
  caregiverProfile.value = profile
  profileForm.intro = profile?.intro || ''
  profileForm.experienceYears = profile ? String(profile.experienceYears) : '0'
  profileForm.serviceRadiusKm = profile ? String(profile.serviceRadiusKm) : '5'
  profileForm.serviceCity = profile?.serviceCity || ''
  profileForm.specialtyTagsText = joinTagText(profile?.specialtyTags)
  profileForm.serviceCommitment = profile?.serviceCommitment || ''
  profileForm.qualificationMaterials = profile ? [...profile.qualificationMaterials] : []
}

function removeQualificationMaterial(fileId: string) {
  profileForm.qualificationMaterials = profileForm.qualificationMaterials
    .filter(item => item.fileId !== fileId)
}

async function uploadQualificationMaterials() {
  if (!caregiverProfile.value) {
    uni.showToast({ title: '请先保存一次档案后再上传', icon: 'none' })
    return
  }

  try {
    const uploaded = await selectAndUploadAttachments({
      tag1: 'petpal-caregiver-qualification',
      tag2: caregiverProfile.value.id,
    })
    profileForm.qualificationMaterials = [
      ...profileForm.qualificationMaterials,
      ...uploaded,
    ].slice(0, 12)
    uni.showToast({ title: `已上传 ${uploaded.length} 份材料`, icon: 'none' })
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '上传资质材料失败'), icon: 'none' })
  }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    const profile = await getCaregiverProfile()
    hydrateProfile(profile)
  }
  catch (error: unknown) {
    hydrateProfile(null)
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载照料者档案失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function saveProfile() {
  saving.value = true
  try {
    const profile = await upsertCaregiverProfile({
      intro: profileForm.intro.trim() || undefined,
      experienceYears: Number(profileForm.experienceYears || 0),
      serviceRadiusKm: Number(profileForm.serviceRadiusKm || 0),
      serviceCity: profileForm.serviceCity.trim() || undefined,
      specialtyTags: splitTagText(profileForm.specialtyTagsText),
      serviceCommitment: profileForm.serviceCommitment.trim() || undefined,
      qualificationMaterials: profileForm.qualificationMaterials,
    })
    hydrateProfile(profile)
    uni.showToast({ title: '入驻资料已保存', icon: 'none' })
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '保存入驻资料失败'), icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="入驻中心" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_PROFILE_PAGE"
        title="照料者入驻中心"
        description="照料介绍、经验、服务承诺和资质材料统一维护，审核状态也在这里集中反馈。"
      />

      <AppSection title="审核状态" description="优先确认当前审核状态和需要补齐的信息。">
        <view class="caregiver-profile-status">
          <AppTag :type="getAuditTagType()">
            {{ caregiverProfile ? getCaregiverAuditLabel(caregiverProfile.auditStatus) : '待创建档案' }}
          </AppTag>
          <text class="caregiver-profile-status__title">
            {{ caregiverProfile ? getCaregiverAuditHint(caregiverProfile.auditStatus) : '先补齐介绍、城市和资质材料，平台才会进入审核。' }}
          </text>
          <text v-if="caregiverProfile" class="caregiver-profile-status__meta">
            当前评分 {{ formatAmount(caregiverProfile.ratingAvg) }} · 已上传 {{ caregiverProfile.qualificationMaterials.length }} 份材料
          </text>
        </view>
      </AppSection>

      <AppSection title="入驻资料" description="资料越完整，越容易通过审核并被主人筛选命中。">
        <view class="caregiver-profile-form">
          <AppInput v-model="profileForm.experienceYears" label="照料经验（年）" placeholder="例如：3" type="digit" />
          <AppInput v-model="profileForm.serviceRadiusKm" label="服务半径（km）" placeholder="例如：8" type="digit" />
          <AppInput v-model="profileForm.serviceCity" label="服务城市" placeholder="例如：杭州" />
          <AppInput v-model="profileForm.specialtyTagsText" label="专长标签" placeholder="例如：幼宠，猫咪，异宠" />

          <textarea
            v-model="profileForm.intro"
            class="caregiver-profile-textarea"
            :maxlength="240"
            auto-height
            placeholder="介绍你的照料经验、擅长宠物类型和服务风格"
          />
          <textarea
            v-model="profileForm.serviceCommitment"
            class="caregiver-profile-textarea"
            :maxlength="180"
            auto-height
            placeholder="说明你的服务承诺，例如图文反馈频率、紧急响应方式"
          />

          <view class="caregiver-profile-materials">
            <view class="caregiver-profile-materials__header">
              <text class="caregiver-profile-materials__title">资质材料</text>
              <text class="caregiver-profile-materials__meta">{{ profileForm.qualificationMaterials.length }}/12 份</text>
            </view>

            <view class="caregiver-profile-action-row">
              <AppButton
                size="medium"
                type="info"
                :loading="qualificationUploading"
                :disabled="profileForm.qualificationMaterials.length >= 12"
                @click="uploadQualificationMaterials"
              >
                上传资质图片
              </AppButton>
            </view>

            <view v-if="profileForm.qualificationMaterials.length" class="caregiver-profile-material-list">
              <view
                v-for="item in profileForm.qualificationMaterials"
                :key="item.fileId"
                class="caregiver-profile-material-item"
              >
                <view class="caregiver-profile-material-item__copy">
                  <text>{{ item.name }}</text>
                  <text>{{ item.mimeType }} · {{ Math.max(1, Math.round(item.size / 1024)) }}KB</text>
                </view>
                <AppButton size="medium" type="danger" @click="removeQualificationMaterial(item.fileId)">移除</AppButton>
              </view>
            </view>
            <view v-else class="caregiver-profile-empty">
              <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步入驻资料' : '至少上传一份身份证明或培训资质图片'" />
            </view>
          </view>

          <view class="caregiver-profile-action-row">
            <AppButton size="medium" :loading="saving" @click="saveProfile">保存入驻资料</AppButton>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始进入入驻中心">
        <view class="caregiver-profile-empty caregiver-profile-empty--login">
          <AppStatus text="登录后即可维护照料者入驻资料。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-profile-status,
.caregiver-profile-form,
.caregiver-profile-materials,
.caregiver-profile-material-list {
  display: grid;
  gap: 16rpx;
}

.caregiver-profile-status {
  padding: 24rpx;
  border-radius: 26rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.2), transparent 34%),
    linear-gradient(145deg, #7c2d12 0%, #9a3412 42%, #b45309 100%);
  color: #fff7ed;
}

.caregiver-profile-status__title {
  font-size: 28rpx;
  line-height: 1.7;
  font-weight: 700;
}

.caregiver-profile-status__meta {
  font-size: 22rpx;
  line-height: 1.7;
  color: rgba(255, 247, 237, 0.88);
}

.caregiver-profile-textarea {
  width: 100%;
  min-height: 150rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  box-sizing: border-box;
  line-height: 1.7;
}

.caregiver-profile-materials {
  padding: 20rpx 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
}

.caregiver-profile-materials__header,
.caregiver-profile-material-item {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.caregiver-profile-materials__title {
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 700;
}

.caregiver-profile-materials__meta,
.caregiver-profile-material-item__copy text:last-child {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.caregiver-profile-material-item__copy {
  display: grid;
  gap: 6rpx;
}

.caregiver-profile-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.caregiver-profile-empty {
  padding: 8rpx 0;
}

.caregiver-profile-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .caregiver-profile-materials__header,
  .caregiver-profile-material-item {
    flex-direction: column;
  }
}
</style>
