<script setup lang="ts">
import type { PetProfileRecord } from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createPet, listPets, updatePet } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { genderOptions, getErrorMessage, openLoginPage, PETPAL_PETS_PAGE, speciesOptions, splitTagText, toast, yesNoOptions } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const saving = ref(false)
const petId = ref('')
const pageTitle = computed(() => (petId.value ? '编辑宠物档案' : '新建宠物档案'))

const form = reactive({
  name: '',
  species: 'DOG',
  breed: '',
  gender: 'UNKNOWN',
  birthday: '',
  weightKg: '',
  neutered: 'NO',
  temperamentTagsText: '',
  feedingNote: '',
  allergyNote: '',
  medicalNote: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
})

function hydrateForm(pet: PetProfileRecord | null) {
  form.name = pet?.name || ''
  form.species = pet?.species || 'DOG'
  form.breed = pet?.breed || ''
  form.gender = pet?.gender || 'UNKNOWN'
  form.birthday = pet?.birthday || ''
  form.weightKg = pet?.weightKg ? String(pet.weightKg) : ''
  form.neutered = pet?.neutered ? 'YES' : 'NO'
  form.temperamentTagsText = pet?.temperamentTags?.join('，') || ''
  form.feedingNote = pet?.feedingNote || ''
  form.allergyNote = pet?.allergyNote || ''
  form.medicalNote = pet?.medicalNote || ''
  form.emergencyName = pet?.emergencyContact?.name || ''
  form.emergencyPhone = pet?.emergencyContact?.phone || ''
  form.emergencyRelation = pet?.emergencyContact?.relation || ''
}

async function loadDetail() {
  if (!petId.value || !tokenStore.hasLogin || loading.value) {
    return
  }

  loading.value = true
  try {
    const pets = await listPets()
    hydrateForm(pets.find(item => item.id === petId.value) ?? null)
  }
  finally {
    loading.value = false
  }
}

async function savePet() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }
  if (!form.name.trim()) {
    toast('请填写宠物名称')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      species: form.species as 'DOG' | 'CAT' | 'OTHER',
      breed: form.breed.trim() || undefined,
      gender: form.gender as 'MALE' | 'FEMALE' | 'UNKNOWN',
      birthday: form.birthday.trim() || undefined,
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      neutered: form.neutered === 'YES',
      temperamentTags: splitTagText(form.temperamentTagsText),
      feedingNote: form.feedingNote.trim() || undefined,
      allergyNote: form.allergyNote.trim() || undefined,
      medicalNote: form.medicalNote.trim() || undefined,
      emergencyContact: form.emergencyName.trim() && form.emergencyPhone.trim()
        ? {
            name: form.emergencyName.trim(),
            phone: form.emergencyPhone.trim(),
            relation: form.emergencyRelation.trim() || undefined,
          }
        : undefined,
    }

    if (petId.value) {
      await updatePet(petId.value, payload)
    }
    else {
      await createPet(payload)
    }

    toast(petId.value ? '宠物档案已更新' : '宠物档案已创建', 'success')
    backToList()
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, petId.value ? '更新失败' : '创建失败'))
  }
  finally {
    saving.value = false
  }
}

function backToList() {
  uni.redirectTo({ url: PETPAL_PETS_PAGE })
}

onLoad((options) => {
  petId.value = options?.petId || ''
  if (petId.value) {
    void loadDetail()
  }
})
</script>

<template>
  <PetpalPage
    :title="pageTitle"
    subtitle="资料维护单独成页，不再和宠物列表、需求创建混在一起。"
    eyebrow="Pet Form"
    back
    :back-url="PETPAL_PETS_PAGE"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="先确认这只宠物是谁" subtitle="名字、种类和性别先明确，后续照料说明再补充。">
        <view class="petpal-field">
          <text class="petpal-field__label">宠物名字</text>
          <input v-model="form.name" class="petpal-input" :maxlength="20" placeholder="例如：团子" />
        </view>
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in speciesOptions"
            :key="item.value"
            :class="['petpal-choice-tile', form.species === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.species = item.value"
          >
            <text class="petpal-choice-tile__eyebrow">Species</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ form.species === item.value ? '当前品类' : '切换到该品类' }}</text>
          </button>
        </view>
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in genderOptions"
            :key="item.value"
            :class="['petpal-choice-tile', form.gender === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.gender = item.value"
          >
            <text class="petpal-choice-tile__eyebrow">Gender</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ form.gender === item.value ? '当前性别' : '切换到该性别' }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="基础资料" subtitle="品种、生日和体重只保留必要输入。">
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">品种</text>
            <input v-model="form.breed" class="petpal-input" :maxlength="30" placeholder="可留空" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">生日</text>
            <input v-model="form.birthday" class="petpal-input" placeholder="YYYY-MM-DD" />
          </view>
        </view>
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">体重（kg）</text>
            <input v-model="form.weightKg" class="petpal-input" type="digit" placeholder="例如 4.5" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">是否绝育</text>
            <view class="petpal-choice-grid">
              <button
                v-for="item in yesNoOptions"
                :key="item.value"
                :class="['petpal-choice-tile', form.neutered === item.value ? 'petpal-choice-tile--active' : '']"
                hover-class="none"
                @click="form.neutered = item.value"
              >
                <text class="petpal-choice-tile__eyebrow">Neutered</text>
                <text class="petpal-choice-tile__title">{{ item.label }}</text>
              </button>
            </view>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="照料说明" subtitle="真正影响服务的说明单独集中，方便后续直接复用。">
        <view class="petpal-form">
          <view class="petpal-field">
            <text class="petpal-field__label">性格标签</text>
            <input v-model="form.temperamentTagsText" class="petpal-input" placeholder="例如：粘人、怕生、爱玩球" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">喂养说明</text>
            <textarea v-model="form.feedingNote" class="petpal-textarea" :maxlength="200" placeholder="喂食时间、份量、需要提醒的细节" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">过敏或禁忌</text>
            <textarea v-model="form.allergyNote" class="petpal-textarea" :maxlength="160" placeholder="食物、药物或环境禁忌" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">健康备注</text>
            <textarea v-model="form.medicalNote" class="petpal-textarea" :maxlength="160" placeholder="慢病、药物、术后恢复等" />
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="紧急联系人" subtitle="联系人信息独立收口，便于紧急情况快速查看。">
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">联系人</text>
            <input v-model="form.emergencyName" class="petpal-input" :maxlength="20" placeholder="例如：家人" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">电话</text>
            <input v-model="form.emergencyPhone" class="petpal-input" type="number" :maxlength="20" placeholder="请填写联系电话" />
          </view>
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">关系</text>
          <input v-model="form.emergencyRelation" class="petpal-input" :maxlength="20" placeholder="例如：配偶、朋友、邻居" />
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">保存后返回宠物档案列表，需求创建不会再和资料编辑混在同一页。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="savePet">
            {{ saving ? '保存中...' : (petId ? '保存修改' : '创建宠物') }}
          </button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="backToList">返回列表</button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
