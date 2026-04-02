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
    subtitle="需求只做一件事：明确宠物、时间、地点和预算。匹配、下单、支付都去后续页面。"
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
      <PetpalSection title="选择宠物和服务类型">
        <view class="petpal-form">
          <view class="petpal-field">
            <text class="petpal-field__label">宠物</text>
            <view class="petpal-chip-row">
              <button
                v-for="pet in pets"
                :key="pet.id"
                :class="['petpal-chip', form.petId === pet.id ? 'petpal-chip--active' : '']"
                hover-class="none"
                @click="form.petId = pet.id"
              >
                {{ pet.name }}
              </button>
            </view>
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">服务类型</text>
            <view class="petpal-chip-row">
              <button
                v-for="item in serviceTypeOptions"
                :key="item.value"
                :class="['petpal-chip', form.serviceType === item.value ? 'petpal-chip--active' : '']"
                hover-class="none"
                @click="form.serviceType = item.value"
              >
                {{ item.label }}
              </button>
            </view>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="安排时间和地点">
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
          <input v-model="form.budgetAmount" class="petpal-input" type="digit" placeholder="可留空，系统将按报价展示" />
        </view>
      </PetpalSection>

      <PetpalSection title="照料要求" subtitle="常用标签直接勾选，额外要求再补充。">
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

      <PetpalSection title="匹配预览" subtitle="这里只给你一个量感，真正比价和选择在需求详情页完成。">
        <template v-if="previewMatches.length">
          <button
            v-for="item in previewMatches"
            :key="item.serviceId"
            class="petpal-row-btn"
            hover-class="none"
            @click="submitRequest"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ item.caregiverName }}</text>
              <text class="petpal-row__meta">{{ describeCaregiverMatch(item) }}</text>
              <text class="petpal-row__hint">{{ helpers.formatCaregiverRadius(item.serviceRadiusKm) }} · {{ helpers.formatCaregiverNoticeHours(item.minNoticeHours) }}</text>
            </view>
            <text class="petpal-row__value">{{ helpers.formatScore(item.ratingAvg) }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="还没有可展示的匹配预览" description="补齐宠物、服务、地点后会自动计算建议照料者。"/>
      </PetpalSection>

      <view class="petpal-bottom-bar">
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
