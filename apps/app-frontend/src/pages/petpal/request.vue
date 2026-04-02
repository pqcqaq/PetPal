<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，准备发起一条新的照料需求
 * Entry: 从主人首页、宠物中心、订单空态或需求详情中的“复制条件”进入
 * First screen: 先选宠物和服务，再逐步补时间、地点、预算与要求
 * Primary action: 按步骤推进并发布需求
 * Secondary actions: 管理宠物、刷新推荐、继续处理一条进行中的需求
 * States: 未登录、无宠物、步骤未完成、发布中、从旧需求带入条件
 */
import type { MatchedCaregiverRecord, PetProfileRecord, PetServiceType, ServiceRequestRecord } from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref, watch } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { createServiceRequest, listPets, listServiceRequests, matchCaregivers } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  buildOwnerMatchQuery,
  formatAmount,
  formatRange,
  getRequestStatusLabel,
  isRequestActive,
  joinTagText,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_DETAIL_PAGE,
  PETPAL_REQUEST_PAGE,
  serviceTypeLabels,
  serviceTypeOptions,
  speciesLabels,
  splitTagText,
} from './owner-shared'

defineOptions({
  name: 'PetPalRequestPage',
})

definePage({
  style: {
    navigationBarTitleText: '新建需求',
    enablePullDownRefresh: true,
  },
})

type RequestFlowStep = 'PET' | 'SCHEDULE' | 'DETAIL' | 'REVIEW'

const tokenStore = useTokenStore()

const loading = ref(false)
const creatingRequest = ref(false)
const hydratingRequest = ref(false)
const flowStep = ref<RequestFlowStep>('PET')
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const caregiverPreview = ref<MatchedCaregiverRecord[]>([])
const copiedFromRequestId = ref('')

const requestForm = reactive({
  petId: '',
  serviceType: 'BOARDING' as PetServiceType,
  startDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  startTime: '10:00',
  endDate: dayjs().add(1, 'day').format('YYYY-MM-DD'),
  endTime: '18:00',
  locationText: '',
  city: '',
  budgetAmount: '200',
  demandTagsText: '',
})

const stepOptions = [
  { label: '对象', value: 'PET' },
  { label: '时段', value: 'SCHEDULE' },
  { label: '要求', value: 'DETAIL' },
  { label: '发布', value: 'REVIEW' },
]

const schedulePresetOptions = [
  { label: '明天白天', value: 'DAYTIME' },
  { label: '过夜寄养', value: 'OVERNIGHT' },
  { label: '周末托管', value: 'WEEKEND' },
  { label: '自定义', value: 'CUSTOM' },
]

const budgetPresetOptions = [
  { label: '¥120', value: '120' },
  { label: '¥200', value: '200' },
  { label: '¥300', value: '300' },
  { label: '自定', value: 'CUSTOM' },
]

const demandTagSuggestions = [
  '视频回传',
  '定时喂药',
  '怕生慢热',
  '夜间巡查',
  '幼宠照料',
  '老年宠照料',
  '上门前联系',
  '环境消毒',
]

const schedulePreset = ref('DAYTIME')
const budgetPreset = ref('200')

const selectedPet = computed(() => pets.value.find(item => item.id === requestForm.petId) ?? null)
const activeRequest = computed(() => [...requests.value]
  .filter(item => isRequestActive(item.status))
  .sort((left, right) => {
    const leftRank = left.status === 'MATCHED' ? 0 : 1
    const rightRank = right.status === 'MATCHED' ? 0 : 1
    if (leftRank !== rightRank) {
      return leftRank - rightRank
    }
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  })[0] ?? null)
const reusableRequests = computed(() => [...requests.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .filter(item => item.id !== activeRequest.value?.id)
  .slice(0, 4))
const startDateTime = computed(() => dayjs(`${requestForm.startDate} ${requestForm.startTime}`))
const endDateTime = computed(() => dayjs(`${requestForm.endDate} ${requestForm.endTime}`))
const scheduleValid = computed(() => startDateTime.value.isValid() && endDateTime.value.isValid() && endDateTime.value.isAfter(startDateTime.value))
const selectedTags = computed(() => splitTagText(requestForm.demandTagsText))
const locationSuggestions = computed(() => [...new Set(
  requests.value
    .map(item => item.locationText.trim())
    .filter(Boolean),
)].slice(0, 3))
const scheduleSummary = computed(() => (
  scheduleValid.value
    ? `${startDateTime.value.format('MM-DD HH:mm')} 至 ${endDateTime.value.format('MM-DD HH:mm')}`
    : '请重新确认时间'
))
const durationSummary = computed(() => (
  scheduleValid.value
    ? `${endDateTime.value.diff(startDateTime.value, 'hour')} 小时`
    : '时段待确认'
))
const builderTitle = computed(() => {
  if (!selectedPet.value) {
    return serviceTypeLabels[requestForm.serviceType]
  }
  return `${selectedPet.value.name} · ${serviceTypeLabels[requestForm.serviceType]}`
})
const builderHint = computed(() => {
  if (flowStep.value === 'PET') return '先选宠物和服务类型。'
  if (flowStep.value === 'SCHEDULE') return '时段和地点决定能匹配到谁。'
  if (flowStep.value === 'DETAIL') return '预算和要求会影响推荐结果。'
  return '确认后发布，后续在需求详情继续筛人。'
})
const currentStepNumber = computed(() => stepOptions.findIndex(item => item.value === flowStep.value) + 1)
const canMoveToSchedule = computed(() => Boolean(requestForm.petId && requestForm.serviceType))
const canMoveToDetail = computed(() => Boolean(canMoveToSchedule.value && scheduleValid.value && requestForm.locationText.trim()))
const canPublish = computed(() => Boolean(canMoveToDetail.value && selectedPet.value))
const reviewRows = computed(() => [
  {
    title: '宠物与服务',
    label: selectedPet.value
      ? `${selectedPet.value.name} · ${speciesLabels[selectedPet.value.species]}`
      : '未选择',
    value: serviceTypeLabels[requestForm.serviceType],
  },
  {
    title: '服务时间',
    label: scheduleSummary.value,
    value: scheduleValid.value ? '已确认' : '待确认',
  },
  {
    title: '服务地点',
    label: requestForm.locationText.trim() || '待填写',
    value: requestForm.city.trim() || '城市待补充',
  },
  {
    title: '预算与要求',
    label: joinTagText(selectedTags.value) || '暂无特别要求',
    value: `¥${formatAmount(requestForm.budgetAmount)}`,
  },
])

const reviewTagsText = computed(() => joinTagText(selectedTags.value) || '暂无特别要求')

function normalizeDemandTagsText(value: unknown) {
  if (Array.isArray(value)) {
    return joinTagText(value.map(item => String(item).trim()).filter(Boolean))
  }
  if (typeof value === 'string') {
    return joinTagText(splitTagText(value))
  }
  return ''
}

function normalizeFlowStep(value: string | undefined): RequestFlowStep | undefined {
  if (value === 'PET' || value === 'SCHEDULE' || value === 'DETAIL' || value === 'REVIEW') {
    return value
  }
  return undefined
}

function ensurePetSelection(preferredPetId?: string) {
  if (preferredPetId && pets.value.some(item => item.id === preferredPetId)) {
    requestForm.petId = preferredPetId
    return
  }
  if (!requestForm.petId && pets.value.length) {
    requestForm.petId = pets.value[0].id
  }
}

function applyRequestToForm(request: ServiceRequestRecord, preferredStep?: RequestFlowStep) {
  hydratingRequest.value = true
  copiedFromRequestId.value = request.id
  requestForm.petId = request.petId
  requestForm.serviceType = request.serviceType
  requestForm.startDate = dayjs(request.startTime).format('YYYY-MM-DD')
  requestForm.startTime = dayjs(request.startTime).format('HH:mm')
  requestForm.endDate = dayjs(request.endTime).format('YYYY-MM-DD')
  requestForm.endTime = dayjs(request.endTime).format('HH:mm')
  requestForm.locationText = request.locationText
  requestForm.city = ''
  requestForm.budgetAmount = request.budgetAmount == null ? '' : String(request.budgetAmount)
  requestForm.demandTagsText = normalizeDemandTagsText(request.demandTags)
  budgetPreset.value = budgetPresetOptions.some(item => item.value === requestForm.budgetAmount)
    ? requestForm.budgetAmount
    : 'CUSTOM'
  schedulePreset.value = 'CUSTOM'
  flowStep.value = preferredStep || 'REVIEW'
  hydratingRequest.value = false
}

function updateSchedule(field: 'startDate' | 'startTime' | 'endDate' | 'endTime', value: string) {
  requestForm[field] = value
  schedulePreset.value = 'CUSTOM'
}

function setFlowStep(nextStep: string) {
  const target = normalizeFlowStep(nextStep)
  if (!target) {
    return
  }
  if (target === 'SCHEDULE' && !canMoveToSchedule.value) {
    uni.showToast({ title: '先选择宠物和服务', icon: 'none' })
    return
  }
  if ((target === 'DETAIL' || target === 'REVIEW') && !canMoveToDetail.value) {
    uni.showToast({ title: '先确认时间和地点', icon: 'none' })
    return
  }
  flowStep.value = target
}

function applySchedulePreset(preset: string) {
  const base = dayjs().add(1, 'day')
  if (preset === 'DAYTIME') {
    schedulePreset.value = preset
    requestForm.startDate = base.format('YYYY-MM-DD')
    requestForm.startTime = '09:00'
    requestForm.endDate = base.format('YYYY-MM-DD')
    requestForm.endTime = '18:00'
    return
  }
  if (preset === 'OVERNIGHT') {
    schedulePreset.value = preset
    requestForm.startDate = base.format('YYYY-MM-DD')
    requestForm.startTime = '18:00'
    requestForm.endDate = base.add(1, 'day').format('YYYY-MM-DD')
    requestForm.endTime = '10:00'
    return
  }
  if (preset === 'WEEKEND') {
    const saturday = base.day() === 6 ? base : base.day(6)
    schedulePreset.value = preset
    requestForm.startDate = saturday.format('YYYY-MM-DD')
    requestForm.startTime = '10:00'
    requestForm.endDate = saturday.add(1, 'day').format('YYYY-MM-DD')
    requestForm.endTime = '18:00'
    return
  }
  schedulePreset.value = 'CUSTOM'
}

function applyBudgetPreset(value: string) {
  budgetPreset.value = value
  if (value !== 'CUSTOM') {
    requestForm.budgetAmount = value
  }
}

function toggleDemandTag(tag: string) {
  const tagSet = new Set(selectedTags.value)
  if (tagSet.has(tag)) {
    tagSet.delete(tag)
  }
  else {
    tagSet.add(tag)
  }
  requestForm.demandTagsText = joinTagText([...tagSet])
}

function applyLocationSuggestion(value: string) {
  requestForm.locationText = value
}

function reuseRequest(request: ServiceRequestRecord) {
  applyRequestToForm(request, 'REVIEW')
  uni.showToast({ title: '已带入上一条条件', icon: 'none' })
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openPets() {
  uni.redirectTo({ url: PETPAL_PETS_PAGE })
}

function openActiveRequest() {
  if (!activeRequest.value) {
    return
  }
  uni.redirectTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${activeRequest.value.id}` })
}

function goPrevStep() {
  if (flowStep.value === 'REVIEW') {
    flowStep.value = 'DETAIL'
    return
  }
  if (flowStep.value === 'DETAIL') {
    flowStep.value = 'SCHEDULE'
    return
  }
  if (flowStep.value === 'SCHEDULE') {
    flowStep.value = 'PET'
  }
}

function goNextStep() {
  if (flowStep.value === 'PET') return setFlowStep('SCHEDULE')
  if (flowStep.value === 'SCHEDULE') return setFlowStep('DETAIL')
  if (flowStep.value === 'DETAIL') return setFlowStep('REVIEW')
}

async function loadMatches(showError = false) {
  if (!selectedPet.value) {
    caregiverPreview.value = []
    return
  }

  try {
    caregiverPreview.value = (await matchCaregivers(buildOwnerMatchQuery({
      petSpecies: selectedPet.value.species,
      serviceType: requestForm.serviceType,
      city: requestForm.city.trim() || undefined,
      pageSize: 3,
    }))).items
  }
  catch (error: unknown) {
    caregiverPreview.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '刷新推荐失败'),
        icon: 'none',
      })
    }
  }
}

async function loadPage(
  showError = false,
  preferredPetId?: string,
  preferredRequestId?: string,
  preferredStep?: RequestFlowStep,
) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    const [petRows, requestRows] = await Promise.all([
      listPets(),
      listServiceRequests(),
    ])

    pets.value = petRows
    requests.value = requestRows
    ensurePetSelection(preferredPetId)

    if (preferredRequestId) {
      const preferredRequest = requestRows.find(item => item.id === preferredRequestId)
      if (preferredRequest) {
        applyRequestToForm(preferredRequest, preferredStep)
      }
    }

    await loadMatches(false)
  }
  catch (error: unknown) {
    caregiverPreview.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载需求页失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitRequest() {
  if (!canPublish.value) {
    uni.showToast({ title: '先补齐宠物、时间和地点', icon: 'none' })
    return
  }

  creatingRequest.value = true
  try {
    const created = await createServiceRequest({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: startDateTime.value.toISOString(),
      endTime: endDateTime.value.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: Number(requestForm.budgetAmount || 0) || undefined,
      demandTags: splitTagText(requestForm.demandTagsText),
    })
    uni.showToast({ title: '需求已发布', icon: 'none' })
    uni.redirectTo({ url: `${PETPAL_REQUEST_DETAIL_PAGE}?requestId=${created.id}` })
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '发布需求失败'),
      icon: 'none',
    })
  }
  finally {
    creatingRequest.value = false
  }
}

watch(() => requestForm.petId, () => {
  if (tokenStore.hasLogin && !hydratingRequest.value) {
    void loadMatches(false)
  }
})

watch(() => requestForm.serviceType, () => {
  if (tokenStore.hasLogin && !hydratingRequest.value) {
    void loadMatches(false)
  }
})

watch(() => requestForm.city, () => {
  if (tokenStore.hasLogin && !hydratingRequest.value && (flowStep.value === 'DETAIL' || flowStep.value === 'REVIEW')) {
    void loadMatches(false)
  }
})

watch(() => requestForm.budgetAmount, (value) => {
  if (hydratingRequest.value) {
    return
  }
  budgetPreset.value = budgetPresetOptions.some(item => item.value === value) ? value : 'CUSTOM'
})

onLoad((options: Record<string, string | undefined>) => {
  if (tokenStore.hasLogin && (options?.petId || options?.requestId)) {
    void loadPage(false, options.petId, options.requestId, normalizeFlowStep(options.step))
  }
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
  <AppPageShell title="新建需求">
    <template v-if="tokenStore.hasLogin">
      <view class="request-page">
        <OwnerFlowNav
          :current-path="PETPAL_REQUEST_PAGE"
          title="新建需求"
        />

        <view class="request-focus">
          <view class="request-focus__copy">
            <text class="request-focus__eyebrow">第 {{ currentStepNumber }}/4 步</text>
            <text class="request-focus__title">{{ builderTitle }}</text>
            <text class="request-focus__meta">{{ builderHint }}</text>
          </view>
          <view class="request-focus__tags">
            <AppTag type="primary">{{ selectedPet ? selectedPet.name : '待选宠物' }}</AppTag>
            <AppTag :type="caregiverPreview.length ? 'success' : 'default'">推荐 {{ caregiverPreview.length }}</AppTag>
            <AppTag v-if="copiedFromRequestId" type="warning">复用旧条件</AppTag>
          </view>
          <AppChoiceChips :model-value="flowStep" :options="stepOptions" @update:model-value="setFlowStep" />
        </view>

        <view v-if="activeRequest" class="request-active">
          <view class="request-active__copy">
            <text class="request-active__title">{{ activeRequest.pet?.name || '宠物' }} · {{ serviceTypeLabels[activeRequest.serviceType] }}</text>
            <text class="request-active__meta">{{ getRequestStatusLabel(activeRequest.status) }} · {{ formatRange(activeRequest.startTime, activeRequest.endTime) }}</text>
          </view>
          <AppButton size="medium" @click="openActiveRequest">继续进行中</AppButton>
        </view>

        <scroll-view v-if="reusableRequests.length" class="request-reuse-scroll" :scroll-x="true" :show-scrollbar="false">
          <view class="request-reuse-track">
            <view v-for="item in reusableRequests" :key="item.id" class="request-reuse-card" @click="reuseRequest(item)">
              <text class="request-reuse-card__title">{{ item.pet?.name || '宠物' }} · {{ serviceTypeLabels[item.serviceType] }}</text>
              <text class="request-reuse-card__meta">{{ formatRange(item.startTime, item.endTime) }}</text>
            </view>
          </view>
        </scroll-view>

        <view v-if="!pets.length" class="request-empty request-empty--soft">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步宠物档案' : '还没有宠物档案'" />
          <AppButton size="medium" @click="openPets">去建档</AppButton>
        </view>

        <template v-else>
          <view v-if="flowStep === 'PET'" class="request-step">
            <scroll-view class="request-pet-scroll" :scroll-x="true" :show-scrollbar="false">
              <view class="request-pet-track">
                <view
                  v-for="pet in pets"
                  :key="pet.id"
                  class="request-pet-card"
                  :class="pet.id === requestForm.petId ? 'request-pet-card--active' : ''"
                  @click="requestForm.petId = pet.id"
                >
                  <text class="request-pet-card__title">{{ pet.name }}</text>
                  <text class="request-pet-card__meta">{{ speciesLabels[pet.species] }}{{ pet.breed ? ` · ${pet.breed}` : '' }}</text>
                </view>
              </view>
            </scroll-view>

            <view class="request-service-grid">
              <view
                v-for="item in serviceTypeOptions"
                :key="item.value"
                class="request-service-card"
                :class="item.value === requestForm.serviceType ? 'request-service-card--active' : ''"
                @click="requestForm.serviceType = item.value as PetServiceType"
              >
                <text class="request-service-card__title">{{ item.label }}</text>
                <text class="request-service-card__meta">{{ item.description }}</text>
              </view>
            </view>
          </view>

          <view v-else-if="flowStep === 'SCHEDULE'" class="request-step">
            <AppChoiceChips :model-value="schedulePreset" :options="schedulePresetOptions" @update:model-value="applySchedulePreset" />
            <view class="request-picker-grid">
              <view class="request-picker-cell">
                <text class="request-form-group__label">开始日期</text>
                <picker mode="date" :value="requestForm.startDate" @change="updateSchedule('startDate', $event.detail.value)">
                  <view class="request-picker">{{ requestForm.startDate }}</view>
                </picker>
              </view>
              <view class="request-picker-cell">
                <text class="request-form-group__label">开始时间</text>
                <picker mode="time" :value="requestForm.startTime" @change="updateSchedule('startTime', $event.detail.value)">
                  <view class="request-picker">{{ requestForm.startTime }}</view>
                </picker>
              </view>
              <view class="request-picker-cell">
                <text class="request-form-group__label">结束日期</text>
                <picker mode="date" :value="requestForm.endDate" @change="updateSchedule('endDate', $event.detail.value)">
                  <view class="request-picker">{{ requestForm.endDate }}</view>
                </picker>
              </view>
              <view class="request-picker-cell">
                <text class="request-form-group__label">结束时间</text>
                <picker mode="time" :value="requestForm.endTime" @change="updateSchedule('endTime', $event.detail.value)">
                  <view class="request-picker">{{ requestForm.endTime }}</view>
                </picker>
              </view>
            </view>

            <view class="request-inline-note">
              <text>{{ scheduleSummary }} · {{ durationSummary }}</text>
            </view>

            <AppInput v-model="requestForm.locationText" label="服务地点" placeholder="例如：杭州市拱墅区北部软件园" />
            <scroll-view v-if="locationSuggestions.length" class="request-reuse-scroll" :scroll-x="true" :show-scrollbar="false">
              <view class="request-location-track">
                <view v-for="item in locationSuggestions" :key="item" class="request-location-chip" @click="applyLocationSuggestion(item)">
                  {{ item }}
                </view>
              </view>
            </scroll-view>
            <AppInput v-model="requestForm.city" label="匹配城市" placeholder="例如：杭州" />
          </view>

          <view v-else-if="flowStep === 'DETAIL'" class="request-step">
            <AppChoiceChips :model-value="budgetPreset" :options="budgetPresetOptions" @update:model-value="applyBudgetPreset" />
            <AppInput v-model="requestForm.budgetAmount" label="预算金额" placeholder="例如：200" type="digit" />

            <view class="request-tag-grid">
              <view
                v-for="tag in demandTagSuggestions"
                :key="tag"
                class="request-tag-chip"
                :class="selectedTags.includes(tag) ? 'request-tag-chip--active' : ''"
                @click="toggleDemandTag(tag)"
              >
                {{ tag }}
              </view>
            </view>

            <textarea
              v-model="requestForm.demandTagsText"
              class="request-textarea"
              :maxlength="180"
              placeholder="补充要求，例如：怕生、定时喂药、晚上视频回传"
            />

            <view class="request-preview-strip">
              <view class="request-preview-strip__meta">
                <AppTag :type="caregiverPreview.length ? 'success' : 'default'">推荐 {{ caregiverPreview.length }}</AppTag>
                <AppButton size="medium" type="info" @click="loadMatches(true)">刷新推荐</AppButton>
              </view>
              <scroll-view v-if="caregiverPreview.length" class="request-reuse-scroll" :scroll-x="true" :show-scrollbar="false">
                <view class="request-preview-track">
                  <view v-for="item in caregiverPreview" :key="item.serviceId" class="request-preview-item">
                    <text class="request-preview-item__title">{{ item.caregiverName }}</text>
                    <text class="request-preview-item__meta">¥{{ formatAmount(item.pricePerUnit) }}/{{ item.unitType }}</text>
                    <text class="request-preview-item__meta">{{ item.city || '城市待补充' }}</text>
                  </view>
                </view>
              </scroll-view>
            </view>
          </view>

          <view v-else class="request-step">
            <view class="request-review-grid">
              <view v-for="item in reviewRows" :key="item.title" class="request-review-card">
                <text class="request-review-card__label">{{ item.title }}</text>
                <text class="request-review-card__value">{{ item.value }}</text>
                <text class="request-review-card__meta">{{ item.label }}</text>
              </view>
            </view>
            <view class="request-inline-note request-inline-note--review">
              <view class="request-active__tags">
                <AppTag :type="caregiverPreview.length ? 'success' : 'default'">推荐 {{ caregiverPreview.length }} 人</AppTag>
                <AppTag v-if="copiedFromRequestId" type="warning">来自上一条需求</AppTag>
              </view>
              <text>{{ scheduleSummary }} · {{ reviewTagsText }}</text>
            </view>
          </view>

          <view class="request-bottom-bar">
            <AppButton v-if="flowStep !== 'PET'" block size="large" type="info" @click="goPrevStep">上一步</AppButton>
            <AppButton v-if="flowStep !== 'REVIEW'" block size="large" @click="goNextStep">下一步</AppButton>
            <AppButton v-else block size="large" :loading="creatingRequest" :disabled="!canPublish" @click="submitRequest">发布需求</AppButton>
          </view>
        </template>
      </view>
    </template>

    <template v-else>
      <view class="request-page">
        <view class="request-focus request-focus--guest">
          <view class="request-focus__copy">
            <text class="request-focus__eyebrow">PetPal</text>
            <text class="request-focus__title">登录后开始新建需求</text>
            <text class="request-focus__meta">先选宠物，再补时段、地点和要求。</text>
          </view>
          <AppButton block @click="goToLogin">去登录</AppButton>
        </view>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.request-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.request-active,
.request-focus,
.request-step,
.request-empty--soft,
.request-preview-item,
.request-reuse-card,
.request-pet-card,
.request-service-card,
.request-review-card,
.request-location-chip {
  display: grid;
  gap: 16rpx;
}

.request-active,
.request-focus,
.request-step,
.request-empty--soft {
  margin: 0 24rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.request-active {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.request-focus {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.18), transparent 36%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.request-active__copy,
.request-focus__copy,
.request-preview-strip {
  display: grid;
  gap: 12rpx;
}

.request-active__tags,
.request-focus__tags,
.request-preview-strip__meta {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
  align-items: center;
}

.request-focus__eyebrow,
.request-form-group__label,
.request-review-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.request-active__title,
.request-focus__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.25;
  font-weight: 700;
}

.request-active__meta,
.request-focus__meta,
.request-review-card__meta {
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.66;
}

.request-reuse-scroll,
.request-pet-scroll {
  white-space: nowrap;
}

.request-reuse-track,
.request-preview-track,
.request-pet-track,
.request-location-track {
  display: inline-flex;
  gap: 14rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.request-reuse-card,
.request-preview-item,
.request-pet-card {
  width: 340rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
  box-shadow: var(--app-elevation-1);
  box-sizing: border-box;
}

.request-reuse-card__title,
.request-pet-card__title,
.request-service-card__title,
.request-preview-item__title,
.request-review-card__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.36;
  font-weight: 700;
}

.request-reuse-card__meta,
.request-pet-card__meta,
.request-service-card__meta,
.request-preview-item__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.58;
}

.request-pet-card--active,
.request-service-card--active,
.request-tag-chip--active {
  border-color: transparent;
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.request-service-grid,
.request-tag-grid,
.request-review-grid {
  display: grid;
  gap: 14rpx;
}

.request-service-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.request-service-card,
.request-review-card {
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
}

.request-picker-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.request-picker-cell {
  display: grid;
  gap: 12rpx;
}

.request-picker {
  min-height: 84rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  border-radius: 20rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text);
  box-sizing: border-box;
}

.request-inline-note,
.request-preview-strip {
  padding: 20rpx 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  color: var(--app-text);
  line-height: 1.7;
}

.request-inline-note--review {
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.request-location-chip,
.request-tag-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 20rpx;
  border-radius: 999rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
  color: var(--app-text);
  font-size: 22rpx;
  line-height: 1;
  box-sizing: border-box;
}

.request-tag-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.request-textarea {
  min-height: 180rpx;
  padding: 20rpx 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.7;
  box-sizing: border-box;
}

.request-review-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.request-empty {
  margin: 0 24rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
  box-shadow: var(--app-elevation-1);
}

.request-bottom-bar {
  padding: 0 32rpx calc(16rpx + env(safe-area-inset-bottom));
}

.request-bottom-bar .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .request-active,
  .request-picker-grid,
  .request-service-grid,
  .request-review-grid,
  .request-tag-grid {
    grid-template-columns: 1fr;
  }

  .request-reuse-card,
  .request-preview-item,
  .request-pet-card {
    width: 300rpx;
  }
}
</style>
