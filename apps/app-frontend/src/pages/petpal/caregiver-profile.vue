<script setup lang="ts">
import type { CaregiverProfileRecord } from '@rbac/api-common'
import { reactive, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getCaregiverProfile, upsertCaregiverProfile } from '@/api/petpal'
import { useManagedAttachmentUpload } from '@/composables/useManagedAttachmentUpload'
import { useTokenStore } from '@/store'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { getErrorMessage, helpers, openLoginPage, PETPAL_CAREGIVER_HOME_PAGE, splitTagText, stopPullDown, toast } from './rebuild/shared'

const tokenStore = useTokenStore()
const upload = useManagedAttachmentUpload({ maxCount: 3, maxSizeMb: 8 })

const loading = ref(false)
const saving = ref(false)
const profile = ref<CaregiverProfileRecord | null>(null)

const form = reactive({
  intro: '',
  experienceYears: '0',
  serviceRadiusKm: '5',
  serviceCity: '',
  specialtyTagsText: '',
  serviceCommitment: '',
  qualificationMaterials: [] as CaregiverProfileRecord['qualificationMaterials'],
})

function hydrateForm(next: CaregiverProfileRecord | null) {
  profile.value = next
  form.intro = next?.intro || ''
  form.experienceYears = next ? String(next.experienceYears) : '0'
  form.serviceRadiusKm = next ? String(next.serviceRadiusKm) : '5'
  form.serviceCity = next?.serviceCity || ''
  form.specialtyTagsText = next?.specialtyTags?.join('，') || ''
  form.serviceCommitment = next?.serviceCommitment || ''
  form.qualificationMaterials = next ? [...next.qualificationMaterials] : []
}

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    return
  }
  loading.value = true
  try {
    const next = await getCaregiverProfile()
    hydrateForm(next)
  }
  catch {
    hydrateForm(null)
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

async function resolveCurrentCaregiverProfileId() {
  if (profile.value?.id) {
    return profile.value.id
  }

  try {
    const next = await getCaregiverProfile()
    if (next?.id) {
      profile.value = next
      return next.id
    }
  }
  catch {
    return null
  }

  return null
}

async function uploadMaterials() {
  try {
    const caregiverProfileId = await resolveCurrentCaregiverProfileId()
    if (!caregiverProfileId) {
      toast('请先保存照料者档案，再上传资质材料')
      return
    }

    const files = await upload.selectAndUploadAttachments({
      tag1: 'petpal-caregiver-qualification',
      tag2: caregiverProfileId,
    })
    form.qualificationMaterials = [...form.qualificationMaterials, ...files].slice(0, 12)
    toast('材料已添加', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '上传失败'))
  }
}

async function saveProfile() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }

  saving.value = true
  try {
    const next = await upsertCaregiverProfile({
      intro: form.intro.trim() || undefined,
      experienceYears: Number(form.experienceYears || 0),
      serviceRadiusKm: Number(form.serviceRadiusKm || 0),
      serviceCity: form.serviceCity.trim() || undefined,
      specialtyTags: splitTagText(form.specialtyTagsText),
      serviceCommitment: form.serviceCommitment.trim() || undefined,
      qualificationMaterials: form.qualificationMaterials,
    })
    hydrateForm(next)
    toast('照料者档案已保存', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '保存失败'))
  }
  finally {
    saving.value = false
  }
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="入驻中心" subtitle="档案、资质和服务承诺独立维护，不再和订单操作混在一起。" eyebrow="Caregiver Profile" back :back-url="PETPAL_CAREGIVER_HOME_PAGE">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="审核状态" :subtitle="helpers.getCaregiverAuditLabel(profile?.auditStatus || 'PENDING')">
        <view class="petpal-banner">
          <text class="petpal-banner__eyebrow">Audit</text>
          <text class="petpal-banner__title">{{ helpers.getCaregiverAuditLabel(profile?.auditStatus || 'PENDING') }}</text>
          <text class="petpal-banner__meta">{{ helpers.getCaregiverAuditHint(profile?.auditStatus) }}</text>
        </view>
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">材料份数</text>
            <text class="petpal-stat__value">{{ form.qualificationMaterials.length }}</text>
            <text class="petpal-stat__meta">最多 12 份</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">服务城市</text>
            <text class="petpal-stat__value">{{ form.serviceCity || '待补充' }}</text>
            <text class="petpal-stat__meta">用于服务匹配</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="基础档案" subtitle="经验、范围、城市和擅长领域只在这里维护。">
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">经验（年）</text>
            <input v-model="form.experienceYears" class="petpal-input" type="digit" placeholder="例如 3" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">服务半径（km）</text>
            <input v-model="form.serviceRadiusKm" class="petpal-input" type="digit" placeholder="例如 8" />
          </view>
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">服务城市</text>
          <input v-model="form.serviceCity" class="petpal-input" :maxlength="30" placeholder="例如 杭州" />
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">擅长标签</text>
          <input v-model="form.specialtyTagsText" class="petpal-input" placeholder="例如 幼宠、猫咪、异宠、夜间托管" />
        </view>
      </PetpalSection>

      <PetpalSection title="对外展示文案" subtitle="介绍和承诺只写服务风格与履约规则，不在首页重复解释。">
        <view class="petpal-field">
          <text class="petpal-field__label">个人介绍</text>
          <textarea v-model="form.intro" class="petpal-textarea" :maxlength="240" placeholder="介绍你的照料风格、经验和适合服务的宠物类型" />
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">服务承诺</text>
          <textarea v-model="form.serviceCommitment" class="petpal-textarea" :maxlength="220" placeholder="例如：最晚 2 小时内回复、每日回传至少 3 次照片" />
        </view>
      </PetpalSection>

      <PetpalSection title="资质材料" :subtitle="`${form.qualificationMaterials.length}/12 份`">
        <template v-if="form.qualificationMaterials.length">
          <view v-for="item in form.qualificationMaterials" :key="item.fileId" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">Qualification</text>
            <text class="petpal-banner__title">{{ item.name }}</text>
            <text class="petpal-note">{{ item.url }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="form.qualificationMaterials = form.qualificationMaterials.filter(current => current.fileId !== item.fileId)">移除材料</button>
            </view>
          </view>
        </template>
        <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="uploadMaterials">
          {{ upload.uploading ? '上传中...' : '添加材料' }}
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">保存后审核状态会自动刷新，订单页和服务页不会再混入这些档案字段。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="saveProfile">
            {{ saving ? '保存中...' : '保存档案' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
