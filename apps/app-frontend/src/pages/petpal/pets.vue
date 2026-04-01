<script lang="ts" setup>
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

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const pets = ref<PetProfileRecord[]>([])
const editingPetId = ref('')
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

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '把宠物基础信息、饮食提醒、健康备注和紧急联系人拆分出来，形成可复用的电子档案。'
    : '登录后即可维护宠物档案。'
))

const summaryCards = computed(() => [
  { label: '宠物总数', value: String(pets.value.length), hint: pets.value.length ? '每个宠物都可以独立复用到需求发布。' : '还没有建立宠物档案。' },
  { label: '可直接下单', value: String(pets.value.length), hint: pets.value.length ? '资料越完整，后续匹配越顺畅。' : '需要至少建立一只宠物。' },
])

function resetPetForm() {
  editingPetId.value = ''
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

function startEditPet(pet: PetProfileRecord) {
  editingPetId.value = pet.id
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

function openRequestFlow(petId?: string) {
  const suffix = petId ? `?petId=${petId}` : ''
  uni.redirectTo({ url: `${PETPAL_REQUEST_PAGE}${suffix}` })
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
    pets.value = await listPets()
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

    if (editingPetId.value) {
      await updatePet(editingPetId.value, payload)
      uni.showToast({ title: '宠物档案已更新', icon: 'none' })
    }
    else {
      await createPet(payload)
      uni.showToast({ title: '宠物档案已保存', icon: 'none' })
    }

    resetPetForm()
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, editingPetId.value ? '更新宠物档案失败' : '保存宠物档案失败'),
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
  <AppPageShell title="宠物档案" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_PETS_PAGE"
        title="宠物资料独立管理"
        description="档案、习性、喂养和紧急联系人独立维护，后续每次发布需求都直接复用这些信息。"
      />

      <AppSection title="档案概览">
        <view class="pet-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="pet-metric-card">
            <text class="pet-metric-card__label">{{ item.label }}</text>
            <text class="pet-metric-card__value">{{ item.value }}</text>
            <text class="pet-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="编辑档案" description="先把基础资料录全，再补充饮食、医疗和应急信息。">
        <view class="pet-form-block">
          <AppInput v-model="petForm.name" label="宠物名" placeholder="例如：可乐" />
          <AppInput v-model="petForm.breed" label="品种" placeholder="例如：柴犬 / 英短" />
          <AppInput v-model="petForm.birthday" label="生日" placeholder="例如：2024-05-06" />
          <AppInput v-model="petForm.weightKg" label="体重" placeholder="例如：5" type="digit" />

          <view class="pet-form-group">
            <text class="pet-form-group__label">宠物种类</text>
            <AppChoiceChips v-model="petForm.species" :options="speciesOptions" />
          </view>

          <view class="pet-form-group">
            <text class="pet-form-group__label">性别</text>
            <AppChoiceChips v-model="petForm.gender" :options="genderOptions" />
          </view>

          <view class="pet-form-group">
            <text class="pet-form-group__label">是否绝育</text>
            <AppChoiceChips v-model="petForm.neutered" :options="yesNoOptions" />
          </view>

          <AppInput v-model="petTemperamentTagsText" label="习性标签" placeholder="例如：怕生，亲人，喜欢零食" />

          <textarea
            v-model="petForm.feedingNote"
            class="pet-textarea"
            :maxlength="240"
            auto-height
            placeholder="记录日常喂养频率、忌口、奖励方式"
          />
          <textarea
            v-model="petForm.allergyNote"
            class="pet-textarea"
            :maxlength="180"
            auto-height
            placeholder="记录过敏源、禁用食物或环境注意事项"
          />
          <textarea
            v-model="petForm.medicalNote"
            class="pet-textarea"
            :maxlength="240"
            auto-height
            placeholder="记录疾病史、用药提醒和健康观察重点"
          />

          <AppInput v-model="petForm.emergencyName" label="紧急联系人" placeholder="例如：张三" />
          <AppInput v-model="petForm.emergencyPhone" label="紧急电话" placeholder="例如：13800000000" />
          <AppInput v-model="petForm.emergencyRelation" label="关系说明" placeholder="例如：家人 / 宠物医院" />

          <view class="pet-action-row">
            <AppButton size="medium" type="info" @click="resetPetForm">重置</AppButton>
            <AppButton size="medium" :loading="saving" @click="submitPet">
              {{ editingPetId ? '更新档案' : '保存档案' }}
            </AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="已建档宠物" description="从这里快速编辑既有档案或直接带入发布需求。">
        <view v-if="pets.length" class="pet-card-list">
          <view v-for="pet in pets" :key="pet.id" class="pet-card">
            <view class="pet-card__header">
              <view class="pet-card__headline">
                <text class="pet-card__title">{{ pet.name }}</text>
                <text class="pet-card__meta">
                  {{ speciesLabels[pet.species] }}{{ pet.breed ? ` · ${pet.breed}` : '' }} · {{ genderLabels[pet.gender] }}
                </text>
              </view>
              <AppTag :type="pet.neutered ? 'success' : 'warning'">
                {{ pet.neutered ? '已绝育' : '未绝育' }}
              </AppTag>
            </view>

            <view class="pet-card__detail-grid">
              <text>生日：{{ formatDate(pet.birthday) }}</text>
              <text>体重：{{ pet.weightKg || '-' }}kg</text>
              <text>习性：{{ formatPetTagSummary(pet.temperamentTags) }}</text>
            </view>

            <view v-if="pet.feedingNote || pet.allergyNote || pet.medicalNote" class="pet-card__notes">
              <text v-if="pet.feedingNote">喂养：{{ pet.feedingNote }}</text>
              <text v-if="pet.allergyNote">过敏：{{ pet.allergyNote }}</text>
              <text v-if="pet.medicalNote">医疗：{{ pet.medicalNote }}</text>
            </view>

            <view v-if="pet.emergencyContact" class="pet-card__detail-grid">
              <text>紧急联系人：{{ pet.emergencyContact.name }}</text>
              <text>联系电话：{{ pet.emergencyContact.phone }}</text>
              <text>关系：{{ pet.emergencyContact.relation || '未填写' }}</text>
            </view>

            <view class="pet-action-row">
              <AppButton size="medium" type="info" @click="startEditPet(pet)">编辑档案</AppButton>
              <AppButton size="medium" @click="openRequestFlow(pet.id)">用它发布需求</AppButton>
            </view>
          </view>
        </view>
        <view v-else class="pet-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步宠物档案' : '当前还没有宠物档案'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始管理宠物档案">
        <view class="pet-empty pet-empty--login">
          <AppStatus text="登录后即可维护宠物档案。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.pet-metric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.pet-metric-card,
.pet-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.pet-metric-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.pet-metric-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.pet-metric-card__hint,
.pet-card__meta,
.pet-card__detail-grid,
.pet-card__notes {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.pet-form-block,
.pet-card-list,
.pet-card__headline,
.pet-card__detail-grid,
.pet-card__notes {
  display: grid;
  gap: 16rpx;
}

.pet-form-group {
  display: grid;
  gap: 12rpx;
}

.pet-form-group__label {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.pet-textarea {
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

.pet-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.pet-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.pet-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.pet-empty {
  padding: 8rpx 0;
}

.pet-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .pet-metric-grid {
    grid-template-columns: 1fr;
  }

  .pet-card__header {
    flex-direction: column;
  }
}
</style>
