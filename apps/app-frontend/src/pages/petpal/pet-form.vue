<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已决定新增或编辑某只宠物，只想专注填写档案
 * Entry: 宠物列表页、需求页需要补档案时
 * First screen: 当前是新增还是编辑、正在填写哪个分区
 * Primary action: 保存当前宠物档案
 * Secondary actions: 切换分区、返回宠物列表
 * States: 未登录、加载中、无目标宠物、可编辑
 */
import type { PetGender, PetProfileRecord, PetSpecies } from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { createPet, listPets, updatePet } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  genderOptions,
  joinTagText,
  openPetPalAction,
  PETPAL_PETS_PAGE,
  splitTagText,
  speciesOptions,
  yesNoOptions,
} from './owner-shared'

defineOptions({
  name: 'PetPalPetFormPage',
})

definePage({
  style: {
    navigationBarTitleText: '宠物表单',
    enablePullDownRefresh: true,
  },
})

type YesNoChoice = 'YES' | 'NO'
type PetEditorSection = 'PROFILE' | 'CARE' | 'HEALTH' | 'EMERGENCY'

const sectionOptions = [
  { label: '基础', value: 'PROFILE' },
  { label: '照料', value: 'CARE' },
  { label: '健康', value: 'HEALTH' },
  { label: '紧急', value: 'EMERGENCY' },
]

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const petId = ref('')
const returnTo = ref(PETPAL_PETS_PAGE)
const section = ref<PetEditorSection>('PROFILE')
const tagText = ref('')
const currentPet = ref<PetProfileRecord | null>(null)

const petForm = reactive({
  name: '',
  species: 'DOG' as PetSpecies,
  gender: 'UNKNOWN' as PetGender,
  breed: '',
  birthday: '',
  weightKg: '5',
  neutered: 'NO' as YesNoChoice,
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
})

const isCreateMode = computed(() => !petId.value)
const completedSectionCount = computed(() => {
  const checks = [
    Boolean(petForm.name.trim()),
    Boolean(tagText.value.trim() || petForm.feedingNote.trim()),
    Boolean(petForm.allergyNote.trim() || petForm.medicalNote.trim()),
    Boolean(petForm.emergencyName.trim() && petForm.emergencyPhone.trim()),
  ]
  return checks.filter(Boolean).length
})

const heroTitle = computed(() => isCreateMode.value ? '新建宠物档案' : `编辑 ${petForm.name || '宠物档案'}`)
const heroSummary = computed(() => isCreateMode.value
  ? '表单页只负责填写，不再夹带宠物切换和列表操作。'
  : '修改后会回到宠物清单，继续从列表里选择下一步。')

function resetForm() {
  currentPet.value = null
  petForm.name = ''
  petForm.species = 'DOG'
  petForm.gender = 'UNKNOWN'
  petForm.breed = ''
  petForm.birthday = ''
  petForm.weightKg = '5'
  petForm.neutered = 'NO'
  petForm.feedingNote = ''
  petForm.allergyNote = ''
  petForm.medicalNote = ''
  petForm.emergencyName = ''
  petForm.emergencyPhone = ''
  petForm.emergencyRelation = ''
  tagText.value = ''
}

function applyPet(pet: PetProfileRecord) {
  currentPet.value = pet
  petForm.name = pet.name
  petForm.species = pet.species
  petForm.gender = pet.gender
  petForm.breed = pet.breed || ''
  petForm.birthday = pet.birthday ? pet.birthday.slice(0, 10) : ''
  petForm.weightKg = pet.weightKg ? String(pet.weightKg) : '5'
  petForm.neutered = pet.neutered ? 'YES' : 'NO'
  petForm.feedingNote = pet.feedingNote || ''
  petForm.allergyNote = pet.allergyNote || ''
  petForm.medicalNote = pet.medicalNote || ''
  petForm.emergencyName = pet.emergencyContact?.name || ''
  petForm.emergencyPhone = pet.emergencyContact?.phone || ''
  petForm.emergencyRelation = pet.emergencyContact?.relation || ''
  tagText.value = joinTagText(pet.temperamentTags)
}

function backToList() {
  openPetPalAction('redirect', returnTo.value || PETPAL_PETS_PAGE)
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  if (!petId.value) {
    resetForm()
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    const pets = await listPets()
    const targetPet = pets.find(item => item.id === petId.value) ?? null
    if (!targetPet) {
      throw new Error('未找到要编辑的宠物')
    }
    applyPet(targetPet)
  }
  catch (error: unknown) {
    resetForm()
    currentPet.value = null
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载宠物表单失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitPet() {
  if (!petForm.name.trim()) {
    uni.showToast({ title: '请先填写宠物名称', icon: 'none' })
    section.value = 'PROFILE'
    return
  }

  saving.value = true
  try {
    const payload = {
      name: petForm.name.trim(),
      species: petForm.species,
      gender: petForm.gender,
      breed: petForm.breed.trim() || undefined,
      birthday: petForm.birthday || undefined,
      weightKg: Number(petForm.weightKg || 0) || undefined,
      neutered: petForm.neutered === 'YES',
      temperamentTags: splitTagText(tagText.value),
      feedingNote: petForm.feedingNote.trim() || undefined,
      allergyNote: petForm.allergyNote.trim() || undefined,
      medicalNote: petForm.medicalNote.trim() || undefined,
      emergencyContact: petForm.emergencyName.trim() && petForm.emergencyPhone.trim()
        ? {
            name: petForm.emergencyName.trim(),
            phone: petForm.emergencyPhone.trim(),
            relation: petForm.emergencyRelation.trim() || undefined,
          }
        : undefined,
    }

    if (petId.value) {
      await updatePet(petId.value, payload)
    }
    else {
      await createPet(payload)
    }

    uni.showToast({
      title: petId.value ? '宠物档案已更新' : '宠物档案已创建',
      icon: 'none',
    })
    backToList()
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, petId.value ? '更新宠物失败' : '创建宠物失败'),
      icon: 'none',
    })
  }
  finally {
    saving.value = false
  }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

onLoad((options: Record<string, string | undefined>) => {
  petId.value = options.petId || ''
  returnTo.value = options.from || PETPAL_PETS_PAGE
})

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
  <AppPageShell title="宠物表单">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="当前编辑">
        <view class="pet-form-hero">
          <view class="pet-form-hero__copy">
            <view class="pet-form-hero__tags">
              <AppTag type="primary">{{ isCreateMode ? '新增' : '编辑' }}</AppTag>
              <AppTag :type="completedSectionCount >= 3 ? 'success' : 'warning'">
                完成度 {{ completedSectionCount }}/4
              </AppTag>
            </view>
            <text class="pet-form-hero__title">{{ heroTitle }}</text>
            <text class="pet-form-hero__summary">{{ heroSummary }}</text>
          </view>
          <view class="pet-form-hero__actions">
            <AppButton size="medium" type="info" @click="backToList">返回清单</AppButton>
          </view>
        </view>
      </AppSection>

      <template v-if="loading">
        <AppSection title="同步表单">
          <view class="pet-form-empty">
            <AppStatus mode="loading" text="正在加载宠物表单" />
          </view>
        </AppSection>
      </template>

      <template v-else-if="!isCreateMode && !currentPet">
        <AppSection title="无法继续编辑">
          <view class="pet-form-empty">
            <AppStatus text="没有找到对应的宠物，请返回清单重新选择。" />
            <AppButton size="medium" type="info" @click="backToList">返回清单</AppButton>
          </view>
        </AppSection>
      </template>

      <template v-else>
        <AppSection title="填写分区">
          <view class="pet-form-shell">
            <AppChoiceChips v-model="section" :options="sectionOptions" />

            <template v-if="section === 'PROFILE'">
              <view class="pet-form-group">
                <AppInput v-model="petForm.name" label="宠物名" placeholder="例如：可乐" />
                <AppInput v-model="petForm.breed" label="品种" placeholder="例如：柴犬 / 英短" />
                <AppInput v-model="petForm.birthday" label="生日" placeholder="例如：2024-05-06" />
                <AppInput v-model="petForm.weightKg" label="体重" placeholder="例如：5" type="digit" />

                <view class="pet-form-chips">
                  <text class="pet-form-label">宠物种类</text>
                  <AppChoiceChips v-model="petForm.species" :options="speciesOptions" />
                </view>

                <view class="pet-form-chips">
                  <text class="pet-form-label">性别</text>
                  <AppChoiceChips v-model="petForm.gender" :options="genderOptions" />
                </view>

                <view class="pet-form-chips">
                  <text class="pet-form-label">是否绝育</text>
                  <AppChoiceChips v-model="petForm.neutered" :options="yesNoOptions" />
                </view>
              </view>
            </template>

            <template v-else-if="section === 'CARE'">
              <view class="pet-form-group">
                <AppInput v-model="tagText" label="习性标签" placeholder="例如：怕生，亲人，喜欢零食" />
                <view class="pet-form-block">
                  <text class="pet-form-label">喂养提醒</text>
                  <textarea
                    v-model="petForm.feedingNote"
                    class="pet-form-textarea"
                    auto-height
                    :maxlength="240"
                    placeholder="记录喂食频率、忌口和安抚方式"
                  />
                </view>
              </view>
            </template>

            <template v-else-if="section === 'HEALTH'">
              <view class="pet-form-group">
                <view class="pet-form-block">
                  <text class="pet-form-label">过敏与禁忌</text>
                  <textarea
                    v-model="petForm.allergyNote"
                    class="pet-form-textarea"
                    auto-height
                    :maxlength="180"
                    placeholder="记录过敏源、禁用食物或环境注意事项"
                  />
                </view>
                <view class="pet-form-block">
                  <text class="pet-form-label">健康观察</text>
                  <textarea
                    v-model="petForm.medicalNote"
                    class="pet-form-textarea"
                    auto-height
                    :maxlength="240"
                    placeholder="记录疾病史、用药提醒和重点观察点"
                  />
                </view>
              </view>
            </template>

            <template v-else>
              <view class="pet-form-group">
                <AppInput v-model="petForm.emergencyName" label="紧急联系人" placeholder="例如：张三" />
                <AppInput v-model="petForm.emergencyPhone" label="紧急电话" placeholder="例如：13800000000" />
                <AppInput v-model="petForm.emergencyRelation" label="关系说明" placeholder="例如：家人 / 宠物医院" />
              </view>
            </template>
          </view>
        </AppSection>

        <view class="pet-form-actions">
          <AppButton block size="large" type="info" @click="backToList">取消</AppButton>
          <AppButton block size="large" :loading="saving" @click="submitPet">
            {{ isCreateMode ? '保存宠物档案' : '保存修改' }}
          </AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <view class="pet-form-empty">
          <AppStatus text="登录后新增或编辑宠物档案。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.pet-form-hero,
.pet-form-hero__actions,
.pet-form-hero__tags,
.pet-form-actions {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.pet-form-hero {
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(34, 197, 94, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.pet-form-hero__copy,
.pet-form-shell,
.pet-form-group,
.pet-form-chips,
.pet-form-block,
.pet-form-empty {
  display: grid;
  gap: 14rpx;
}

.pet-form-hero__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.16;
  font-weight: 700;
}

.pet-form-hero__summary,
.pet-form-label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.64;
}

.pet-form-textarea {
  width: 100%;
  min-height: 172rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  color: var(--app-text);
  box-sizing: border-box;
  line-height: 1.7;
}

.pet-form-actions {
  padding: 0 32rpx 12rpx;
}

.pet-form-actions .app-button + .app-button {
  margin-top: 16rpx;
}
</style>
