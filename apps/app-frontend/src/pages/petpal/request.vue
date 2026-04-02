<script setup lang="ts">
import type { MatchedCaregiverRecord, PetProfileRecord } from '@rbac/api-common'
import { computed, reactive, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createServiceRequest, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { buildOwnerMatchQuery, describeCaregiverMatch, getErrorMessage, helpers, openLoginPage, PETPAL_PETS_PAGE, PETPAL_REQUEST_DETAIL_PAGE, requestTagOptions, serviceTypeOptions, splitTagText, stopPullDown, toast } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const saving = ref(false)
const sourceRequestId = ref('')
const pets = ref<PetProfileRecord[]>([])
const previewMatches = ref<MatchedCaregiverRecord[]>([])

const form = reactive({
  petId: '',
  serviceType: 'BOARDING',
  startTime: '',
  endTime: '',
  locationText: '',
  budgetAmount: '',
  demandTags: [] as string[],
  demandTagsText: '',
})

const pageTitle = computed(() => sourceRequestId.value ? '按历史需求重新发布' : '新建需求')
const selectedPet = computed(() => pets.value.find(item => item.id === form.petId) ?? null)

async function hydrateFromRequest(requestId: string) {
  const requests = await listServiceRequests()
  const source = requests.find(item => item.id === requestId) ?? null
  if (!source) {
    return
  }

  form.petId = source.petId
  form.serviceType = source.serviceType
  form.startTime = source.startTime
  form.endTime = source.endTime
  form.locationText = source.locationText
  form.budgetAmount = source.budgetAmount ? String(source.budgetAmount) : ''
  form.demandTags = helpers.readTagArray(source.demandTags)
}

async function loadPreview() {
  if (!tokenStore.hasLogin || !selectedPet.value) {
    previewMatches.value = []
    return
  }

  try {
    const page = await matchCaregivers(buildOwnerMatchQuery({
      petSpecies: selectedPet.value.species,
      serviceType: form.serviceType as any,
      city: form.locationText || undefined,
      pageSize: 3,
    }))
    previewMatches.value = page.items
  }
  catch {
    previewMatches.value = []
  }
}

async function loadPage(petId?: string, requestId?: string) {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    pets.value = await listPets()
    form.petId = petId || form.petId || pets.value[0]?.id || ''
    if (requestId) {
      sourceRequestId.value = requestId
      await hydrateFromRequest(requestId)
    }
    await loadPreview()
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function togglePresetTag(value: string) {
  form.demandTags = form.demandTags.includes(value)
    ? form.demandTags.filter(item => item !== value)
    : [...form.demandTags, value]
}

async function submitRequest() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }
  if (!form.petId) {
    toast('请先选择宠物')
    return
  }
  if (!form.startTime.trim() || !form.endTime.trim() || !form.locationText.trim()) {
    toast('请补齐时间和地点')
    return
  }

  saving.value = true
  try {
    const tags = [...new Set([...form.demandTags, ...splitTagText(form.demandTagsText)])]
    const created = await createServiceRequest({
      petId: form.petId,
      serviceType: form.serviceType as any,
      startTime: form.startTime.trim(),
      endTime: form.endTime.trim(),
      locationText: form.locationText.trim(),
      budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : undefined,
      demandTags: tags,
    })
    toast('需求已创建', 'success')
    openCreatedRequest(created.id)
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '创建需求失败'))
  }
  finally {
    saving.value = false
  }
}

function goToPets() {
  uni.redirectTo({ url: PETPAL_PETS_PAGE })
}

function openCreatedRequest(id: string) {
  uni.redirectTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${id}` })
}

watch(() => [form.petId, form.serviceType, form.locationText], () => {
  void loadPreview()
})

onLoad((options) => {
  const petId = options?.petId || ''
  const requestId = options?.requestId || ''
  void loadPage(petId, requestId)
})
</script>

<template>
  <PetpalPage
    :title="pageTitle"
    subtitle="这里只明确宠物、时间、地点和预算。匹配、下单、支付都去后续页面。"
    eyebrow="Request"
    back
    :back-url="PETPAL_PETS_PAGE"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="!pets.length && !loading">
      <PetpalSection title="先创建宠物">
        <PetpalEmpty title="没有宠物档案，不能直接发需求" description="先补一只宠物的基础资料，再继续发起照料需求。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="goToPets">去建宠物档案</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="1. 先确认这次照料对象" subtitle="宠物和服务类型先定下来，后面的时间与预算才有意义。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="pet in pets"
            :key="pet.id"
            :class="['petpal-choice-tile', form.petId === pet.id ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.petId = pet.id"
          >
            <text class="petpal-choice-tile__eyebrow">{{ helpers.speciesLabels[pet.species] }}</text>
            <text class="petpal-choice-tile__title">{{ pet.name }}</text>
            <text class="petpal-choice-tile__meta">{{ pet.breed || '未补品种' }}</text>
            <text class="petpal-choice-tile__hint">{{ form.petId === pet.id ? '当前已选' : '切换到这只宠物' }}</text>
          </button>
        </view>
        <view v-if="selectedPet" class="petpal-banner">
          <text class="petpal-banner__eyebrow">Selected Pet</text>
          <text class="petpal-banner__title">{{ selectedPet.name }}</text>
          <text class="petpal-banner__meta">{{ helpers.speciesLabels[selectedPet.species] }} · {{ selectedPet.breed || '未补品种' }}</text>
        </view>
        <view class="petpal-choice-grid">
          <button
            v-for="item in serviceTypeOptions"
            :key="item.value"
            :class="['petpal-choice-tile', form.serviceType === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="form.serviceType = item.value"
          >
            <text class="petpal-choice-tile__eyebrow">Service</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ form.serviceType === item.value ? '当前服务类型' : '切换到这个服务类型' }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="2. 安排时间与地点" subtitle="这里只填写履约范围，不在这里做比价和支付。">
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">开始时间</text>
            <input v-model="form.startTime" class="petpal-input" placeholder="例如 2026-04-03 09:00" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">结束时间</text>
            <input v-model="form.endTime" class="petpal-input" placeholder="例如 2026-04-04 18:00" />
          </view>
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">地点</text>
          <input v-model="form.locationText" class="petpal-input" :maxlength="80" placeholder="请填写服务地点或城区" />
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">预算</text>
          <input v-model="form.budgetAmount" class="petpal-input" type="digit" placeholder="可留空，系统会按照照料者报价展示" />
        </view>
      </PetpalSection>

      <PetpalSection title="3. 说明照料要求" subtitle="常用要求直接点选，额外细节再补一段描述。">
        <view class="petpal-chip-row">
          <button
            v-for="item in requestTagOptions"
            :key="item"
            :class="['petpal-chip', form.demandTags.includes(item) ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="togglePresetTag(item)"
          >
            {{ item }}
          </button>
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">补充要求</text>
          <textarea
            v-model="form.demandTagsText"
            class="petpal-textarea"
            :maxlength="220"
            placeholder="例如：早晚各遛一次、需要按时喂药、希望每 4 小时回传照片"
          />
        </view>
      </PetpalSection>

      <PetpalSection title="4. 先看匹配预览" subtitle="这里只看量感和价格区间，不会直接提交。">
        <template v-if="previewMatches.length">
          <view
            v-for="item in previewMatches"
            :key="item.serviceId"
            class="petpal-sheet"
          >
            <text class="petpal-banner__title">{{ item.caregiverName }}</text>
            <text class="petpal-banner__meta">{{ describeCaregiverMatch(item) }}</text>
            <text class="petpal-note">{{ helpers.formatCaregiverRadius(item.serviceRadiusKm) }} · {{ helpers.formatCaregiverNoticeHours(item.minNoticeHours) }}</text>
          </view>
        </template>
        <PetpalEmpty v-else title="还没有可展示的匹配预览" description="补齐宠物、服务、地点后会自动计算建议照料者。"/>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">提交后会进入需求详情页继续匹配与确认，不会在当前页直接支付。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="submitRequest">
            {{ saving ? '创建中...' : '发布需求' }}
          </button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="goToPets">返回宠物档案</button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
