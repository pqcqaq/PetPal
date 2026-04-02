<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，维护宠物档案并准备继续发需求
 * Entry: 从主人首页、需求页、订单空态进入
 * First screen: 先切换当前宠物，再决定是预览档案还是进入某个编辑分区
 * Primary action: 保存当前宠物资料或直接用当前宠物发需求
 * Secondary actions: 新增宠物、切换宠物、在基础/照料/健康/紧急四个分区间切换
 * States: 未登录、无宠物、新建宠物、查看既有宠物、保存中
 */
import type { PetGender, PetProfileRecord, PetSpecies } from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppCard from '@/components/app-card/app-card.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { createPet, listPets, updatePet } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  formatDate,
  formatPetTagSummary,
  genderLabels,
  genderOptions,
  joinTagText,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_PAGE,
  speciesLabels,
  speciesOptions,
  splitTagText,
  yesNoOptions,
} from './owner-shared'

defineOptions({
  name: 'PetPalPetsPage',
})

definePage({
  style: {
    navigationBarTitleText: '宠物档案',
    enablePullDownRefresh: true,
  },
})

type YesNoChoice = 'YES' | 'NO'
type PetEditorSection = 'PROFILE' | 'CARE' | 'HEALTH' | 'EMERGENCY'

const editorSectionOptions = [
  { label: '基础', value: 'PROFILE' },
  { label: '照料', value: 'CARE' },
  { label: '健康', value: 'HEALTH' },
  { label: '紧急', value: 'EMERGENCY' },
]

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const pets = ref<PetProfileRecord[]>([])
const selectedPetId = ref('')
const editorSection = ref<PetEditorSection>('PROFILE')
const petTemperamentTagsText = ref('')

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

const focusPet = computed(() => pets.value.find(item => item.id === selectedPetId.value) ?? null)
const isCreateMode = computed(() => !selectedPetId.value)
const completedSectionCount = computed(() => {
  const checks = [
    Boolean(petForm.name.trim() && petForm.species),
    Boolean(petTemperamentTagsText.value.trim() || petForm.feedingNote.trim()),
    Boolean(petForm.allergyNote.trim() || petForm.medicalNote.trim()),
    Boolean(petForm.emergencyName.trim() && petForm.emergencyPhone.trim()),
  ]
  return checks.filter(Boolean).length
})
const heroTitle = computed(() => focusPet.value ? focusPet.value.name : '新建宠物')
const heroSummary = computed(() => {
  if (focusPet.value) {
    return `${speciesLabels[focusPet.value.species]}${focusPet.value.breed ? ` · ${focusPet.value.breed}` : ''}`
  }
  if (!pets.value.length) {
    return '先建第一只宠物，后面发布需求会直接复用这些资料。'
  }
  return '切到新建模式，补一只新的宠物档案。'
})
const summaryCards = computed(() => [
  {
    label: '宠物总数',
    value: String(pets.value.length),
    hint: pets.value.length ? '直接切换当前宠物' : '先创建第一只',
  },
  {
    label: '当前完成度',
    value: `${completedSectionCount.value}/4`,
    hint: completedSectionCount.value >= 3 ? '已经接近可用' : '建议补齐四个分区',
  },
  {
    label: '可直接下单',
    value: pets.value.length ? '可用' : '未就绪',
    hint: pets.value.length ? '当前宠物可直接进入需求页' : '先保存档案',
  },
])
const spotlightTags = computed(() => focusPet.value?.temperamentTags ?? [])
const spotlightNotes = computed(() => {
  if (!focusPet.value) {
    return []
  }

  const notes = [
    { label: '喂养', value: focusPet.value.feedingNote || '' },
    { label: '过敏', value: focusPet.value.allergyNote || '' },
    { label: '健康', value: focusPet.value.medicalNote || '' },
  ]

  if (focusPet.value.emergencyContact) {
    notes.push({
      label: '紧急',
      value: `${focusPet.value.emergencyContact.name} · ${focusPet.value.emergencyContact.phone}${focusPet.value.emergencyContact.relation ? ` · ${focusPet.value.emergencyContact.relation}` : ''}`,
    })
  }

  return notes.filter(item => item.value)
})
const saveButtonLabel = computed(() => selectedPetId.value ? '保存修改' : '保存并继续')

function resetPetForm() {
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
  petTemperamentTagsText.value = ''
}

function applyPetToForm(pet: PetProfileRecord) {
  selectedPetId.value = pet.id
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
  petTemperamentTagsText.value = joinTagText(pet.temperamentTags)
}

function openCreateMode() {
  selectedPetId.value = ''
  editorSection.value = 'PROFILE'
  resetPetForm()
}

function selectPet(petId: string) {
  const pet = pets.value.find(item => item.id === petId)
  if (!pet) {
    return
  }
  editorSection.value = 'PROFILE'
  applyPetToForm(pet)
}

function syncFocusPet(preferredPetId?: string) {
  if (!pets.value.length) {
    openCreateMode()
    return
  }

  const preferred = preferredPetId
    ? pets.value.find(item => item.id === preferredPetId)
    : undefined
  if (preferred) {
    applyPetToForm(preferred)
    return
  }

  const current = selectedPetId.value
    ? pets.value.find(item => item.id === selectedPetId.value)
    : undefined
  if (current) {
    applyPetToForm(current)
    return
  }

  applyPetToForm(pets.value[0])
}

function resetEditor() {
  if (focusPet.value) {
    applyPetToForm(focusPet.value)
    return
  }
  resetPetForm()
  editorSection.value = 'PROFILE'
}

function openRequestFlow(petId?: string) {
  const currentPetId = petId || selectedPetId.value
  const suffix = currentPetId ? `?petId=${currentPetId}` : ''
  uni.redirectTo({ url: `${PETPAL_REQUEST_PAGE}${suffix}` })
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function loadPage(showError = false, preferredPetId?: string) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    pets.value = await listPets()
    syncFocusPet(preferredPetId)
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载宠物档案失败'),
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
    editorSection.value = 'PROFILE'
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
      temperamentTags: splitTagText(petTemperamentTagsText.value),
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

    const savedPet = selectedPetId.value
      ? await updatePet(selectedPetId.value, payload)
      : await createPet(payload)

    uni.showToast({
      title: selectedPetId.value ? '宠物档案已更新' : '宠物档案已保存',
      icon: 'none',
    })

    await loadPage(false, savedPet.id)
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, selectedPetId.value ? '更新宠物档案失败' : '保存宠物档案失败'),
      icon: 'none',
    })
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
  <AppPageShell title="宠物档案">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_PETS_PAGE"
        title="宠物档案"
      />

      <AppCard>
        <view class="pet-hero">
          <view class="pet-hero__copy">
            <text class="pet-hero__eyebrow">{{ isCreateMode ? '新宠物' : '当前宠物' }}</text>
            <text class="pet-hero__title">{{ heroTitle }}</text>
            <text class="pet-hero__summary">{{ heroSummary }}</text>
          </view>

          <view class="pet-hero__actions">
            <AppButton size="medium" type="info" @click="openCreateMode">新增宠物</AppButton>
            <AppButton v-if="focusPet" size="medium" @click="openRequestFlow(focusPet.id)">用它发需求</AppButton>
          </view>
        </view>

        <view class="pet-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="pet-metric-card">
            <text class="pet-metric-card__label">{{ item.label }}</text>
            <text class="pet-metric-card__value">{{ item.value }}</text>
            <text class="pet-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppCard>

      <AppCard v-if="pets.length" title="切换宠物">
        <scroll-view class="pet-switcher" scroll-x enable-flex>
          <view class="pet-switcher__track">
            <view
              v-for="pet in pets"
              :key="pet.id"
              class="pet-switcher__card"
              :class="{ 'is-active': pet.id === selectedPetId }"
              @click="selectPet(pet.id)"
            >
              <view class="pet-switcher__card-head">
                <text class="pet-switcher__name">{{ pet.name }}</text>
                <AppTag :type="pet.neutered ? 'success' : 'warning'">
                  {{ pet.neutered ? '已绝育' : '未绝育' }}
                </AppTag>
              </view>
              <text class="pet-switcher__meta">
                {{ speciesLabels[pet.species] }}{{ pet.breed ? ` · ${pet.breed}` : '' }}
              </text>
              <text class="pet-switcher__hint">
                {{ formatPetTagSummary(pet.temperamentTags) }}
              </text>
            </view>

            <view class="pet-switcher__add" @click="openCreateMode">
              <text class="pet-switcher__add-icon">+</text>
              <text class="pet-switcher__add-text">新增宠物</text>
            </view>
          </view>
        </scroll-view>
      </AppCard>

      <AppCard v-if="focusPet" title="当前档案">
        <view class="pet-spotlight">
          <view class="pet-spotlight__head">
            <view class="pet-spotlight__headline">
              <text class="pet-spotlight__title">{{ focusPet.name }}</text>
              <text class="pet-spotlight__meta">
                {{ speciesLabels[focusPet.species] }}{{ focusPet.breed ? ` · ${focusPet.breed}` : '' }} · {{ genderLabels[focusPet.gender] }}
              </text>
            </view>
            <AppButton size="medium" type="info" @click="openRequestFlow(focusPet.id)">发布需求</AppButton>
          </view>

          <view class="pet-spotlight__stats">
            <view class="pet-spotlight__stat">
              <text class="pet-spotlight__stat-label">生日</text>
              <text class="pet-spotlight__stat-value">{{ formatDate(focusPet.birthday) }}</text>
            </view>
            <view class="pet-spotlight__stat">
              <text class="pet-spotlight__stat-label">体重</text>
              <text class="pet-spotlight__stat-value">{{ focusPet.weightKg || '-' }}kg</text>
            </view>
            <view class="pet-spotlight__stat">
              <text class="pet-spotlight__stat-label">档案完成度</text>
              <text class="pet-spotlight__stat-value">{{ completedSectionCount }}/4</text>
            </view>
          </view>

          <view v-if="spotlightTags.length" class="pet-tags">
            <AppTag v-for="tag in spotlightTags" :key="tag" type="primary">
              {{ tag }}
            </AppTag>
          </view>

          <view v-if="spotlightNotes.length" class="pet-note-grid">
            <view v-for="item in spotlightNotes" :key="item.label" class="pet-note-card">
              <text class="pet-note-card__label">{{ item.label }}</text>
              <text class="pet-note-card__value">{{ item.value }}</text>
            </view>
          </view>
        </view>
      </AppCard>

      <AppCard :title="isCreateMode ? '新建宠物' : `编辑 ${petForm.name || '宠物档案'}`">
        <view class="pet-editor">
          <AppChoiceChips v-model="editorSection" :options="editorSectionOptions" />

          <template v-if="editorSection === 'PROFILE'">
            <view class="pet-editor__group">
              <AppInput v-model="petForm.name" label="宠物名" placeholder="例如：可乐" />
              <AppInput v-model="petForm.breed" label="品种" placeholder="例如：柴犬 / 英短" />
              <AppInput v-model="petForm.birthday" label="生日" placeholder="例如：2024-05-06" />
              <AppInput v-model="petForm.weightKg" label="体重" placeholder="例如：5" type="digit" />

              <view class="pet-editor__chips">
                <text class="pet-editor__label">宠物种类</text>
                <AppChoiceChips v-model="petForm.species" :options="speciesOptions" />
              </view>

              <view class="pet-editor__chips">
                <text class="pet-editor__label">性别</text>
                <AppChoiceChips v-model="petForm.gender" :options="genderOptions" />
              </view>

              <view class="pet-editor__chips">
                <text class="pet-editor__label">是否绝育</text>
                <AppChoiceChips v-model="petForm.neutered" :options="yesNoOptions" />
              </view>
            </view>
          </template>

          <template v-else-if="editorSection === 'CARE'">
            <view class="pet-editor__group">
              <AppInput v-model="petTemperamentTagsText" label="习性标签" placeholder="例如：怕生，亲人，喜欢零食" />
              <view class="pet-editor__textarea-block">
                <text class="pet-editor__label">喂养提醒</text>
                <textarea
                  v-model="petForm.feedingNote"
                  class="pet-textarea"
                  :maxlength="240"
                  auto-height
                  placeholder="记录喂食频率、忌口、安抚方式"
                />
              </view>
            </view>
          </template>

          <template v-else-if="editorSection === 'HEALTH'">
            <view class="pet-editor__group">
              <view class="pet-editor__textarea-block">
                <text class="pet-editor__label">过敏与禁忌</text>
                <textarea
                  v-model="petForm.allergyNote"
                  class="pet-textarea"
                  :maxlength="180"
                  auto-height
                  placeholder="记录过敏源、禁用食物或环境注意事项"
                />
              </view>
              <view class="pet-editor__textarea-block">
                <text class="pet-editor__label">健康观察</text>
                <textarea
                  v-model="petForm.medicalNote"
                  class="pet-textarea"
                  :maxlength="240"
                  auto-height
                  placeholder="记录疾病史、用药提醒和需要重点观察的状态"
                />
              </view>
            </view>
          </template>

          <template v-else>
            <view class="pet-editor__group">
              <AppInput v-model="petForm.emergencyName" label="紧急联系人" placeholder="例如：张三" />
              <AppInput v-model="petForm.emergencyPhone" label="紧急电话" placeholder="例如：13800000000" />
              <AppInput v-model="petForm.emergencyRelation" label="关系说明" placeholder="例如：家人 / 宠物医院" />
            </view>
          </template>

          <view class="pet-editor__footer">
            <AppButton size="medium" type="info" @click="resetEditor">
              {{ focusPet ? '恢复当前档案' : '清空重填' }}
            </AppButton>
            <AppButton size="medium" :loading="saving" @click="submitPet">
              {{ saveButtonLabel }}
            </AppButton>
          </view>
        </view>
      </AppCard>
    </template>

    <template v-else>
      <AppCard title="登录后继续">
        <view class="pet-login-state">
          <AppStatus text="登录后即可切换宠物、维护档案并直接带入需求发布。" />
          <AppButton block @click="goToLogin">去登录</AppButton>
        </view>
      </AppCard>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.pet-hero,
.pet-hero__actions,
.pet-spotlight__head,
.pet-switcher__card-head,
.pet-editor__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
  flex-wrap: wrap;
}

.pet-hero {
  align-items: center;
}

.pet-hero__copy {
  display: grid;
  gap: 8rpx;
}

.pet-hero__eyebrow {
  color: var(--app-text-muted);
  font-size: 22rpx;
  letter-spacing: 0.08em;
}

.pet-hero__title,
.pet-spotlight__title {
  color: var(--app-text);
  font-size: 42rpx;
  line-height: 1.06;
  font-weight: 700;
}

.pet-hero__summary,
.pet-switcher__meta,
.pet-switcher__hint,
.pet-spotlight__meta,
.pet-note-card__value,
.pet-metric-card__hint {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.65;
}

.pet-metric-grid,
.pet-spotlight__stats,
.pet-note-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.pet-metric-card,
.pet-spotlight__stat,
.pet-note-card {
  display: grid;
  gap: 8rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.pet-metric-card__label,
.pet-spotlight__stat-label,
.pet-note-card__label,
.pet-editor__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.45;
}

.pet-metric-card__value,
.pet-spotlight__stat-value {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.1;
  font-weight: 700;
}

.pet-switcher {
  width: 100%;
}

.pet-switcher__track {
  display: flex;
  gap: 18rpx;
  padding-bottom: 6rpx;
}

.pet-switcher__card,
.pet-switcher__add {
  width: 300rpx;
  min-height: 200rpx;
  flex: 0 0 auto;
  display: grid;
  align-content: space-between;
  gap: 12rpx;
  padding: 22rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
  box-sizing: border-box;
}

.pet-switcher__card.is-active {
  border-color: transparent;
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
  box-shadow: var(--app-elevation-2);
}

.pet-switcher__name,
.pet-switcher__add-text {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.2;
  font-weight: 700;
}

.pet-switcher__add {
  place-items: center;
  justify-items: center;
}

.pet-switcher__add-icon {
  color: var(--app-accent);
  font-size: 68rpx;
  line-height: 1;
  font-weight: 500;
}

.pet-spotlight,
.pet-editor,
.pet-editor__group,
.pet-editor__chips,
.pet-editor__textarea-block {
  display: grid;
  gap: 18rpx;
}

.pet-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.pet-textarea {
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

.pet-editor__footer {
  position: sticky;
  bottom: 20rpx;
  padding: 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(18rpx);
  box-shadow: 0 16rpx 42rpx rgba(15, 23, 42, 0.08);
}

.pet-login-state {
  display: grid;
  gap: 22rpx;
}

@media (max-width: 680px) {
  .pet-metric-grid,
  .pet-spotlight__stats,
  .pet-note-grid {
    grid-template-columns: 1fr;
  }

  .pet-hero,
  .pet-spotlight__head,
  .pet-editor__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
