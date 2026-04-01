<script lang="ts" setup>
import type {
  MatchedCaregiverRecord,
  PetProfileRecord,
  PetServiceType,
  ServiceRequestRecord,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref, watch } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
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
  PETPAL_PETS_PAGE,
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
    navigationBarTitleText: '发布需求',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()

const loading = ref(false)
const creatingRequest = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])

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

const petSelectionOptions = computed(() => pets.value.map(item => ({
  label: item.name,
  value: item.id,
  description: `${speciesLabels[item.species]}${item.breed ? ` · ${item.breed}` : ''}`,
})))

const selectedPet = computed(() => pets.value.find(item => item.id === requestForm.petId) ?? null)
const scheduleSummary = computed(() => {
  const start = dayjs(`${requestForm.startDate} ${requestForm.startTime}`)
  const end = dayjs(`${requestForm.endDate} ${requestForm.endTime}`)
  if (!start.isValid() || !end.isValid()) {
    return '请重新选择服务时间'
  }
  return `${start.format('MM-DD HH:mm')} 至 ${end.format('MM-DD HH:mm')}`
})

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '把服务请求、时间选择和照料者匹配拆成明确步骤，减少主人在一页里处理过多信息。'
    : '登录后即可发布宠物临时照料需求。'
))

function ensurePetSelection(preferredPetId?: string) {
  if (preferredPetId && pets.value.some(item => item.id === preferredPetId)) {
    requestForm.petId = preferredPetId
    return
  }

  if (!requestForm.petId && pets.value.length > 0) {
    requestForm.petId = pets.value[0].id
  }
}

function updateSchedule(field: 'startDate' | 'startTime' | 'endDate' | 'endTime', value: string) {
  requestForm[field] = value
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openPets() {
  uni.redirectTo({ url: PETPAL_PETS_PAGE })
}

async function loadMatches(showError = false) {
  if (!selectedPet.value) {
    caregivers.value = []
    return
  }

  try {
    caregivers.value = (await matchCaregivers(buildOwnerMatchQuery({
      petSpecies: selectedPet.value.species,
      serviceType: requestForm.serviceType,
      city: requestForm.city,
      pageSize: 6,
    }))).items
  }
  catch (error: unknown) {
    caregivers.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '刷新照料者推荐失败'),
        icon: 'none',
      })
    }
  }
}

async function loadPage(showError = false, preferredPetId?: string) {
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
    await loadMatches(false)
  }
  catch (error: unknown) {
    caregivers.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载服务需求页失败'),
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
  if (!requestForm.petId) {
    uni.showToast({ title: '请先选择宠物', icon: 'none' })
    return
  }

  if (!requestForm.locationText.trim()) {
    uni.showToast({ title: '请填写服务地点', icon: 'none' })
    return
  }

  const start = dayjs(`${requestForm.startDate} ${requestForm.startTime}`)
  const end = dayjs(`${requestForm.endDate} ${requestForm.endTime}`)
  if (!start.isValid() || !end.isValid() || !end.isAfter(start)) {
    uni.showToast({ title: '请确认服务时间范围', icon: 'none' })
    return
  }

  creatingRequest.value = true
  try {
    await createServiceRequest({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: Number(requestForm.budgetAmount || 0) || undefined,
      demandTags: splitTagText(requestForm.demandTagsText),
    })
    requestForm.locationText = ''
    requestForm.city = ''
    requestForm.demandTagsText = ''
    uni.showToast({ title: '服务需求已发布', icon: 'none' })
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '发布服务需求失败'),
      icon: 'none',
    })
  }
  finally {
    creatingRequest.value = false
  }
}

watch(() => requestForm.petId, () => {
  if (tokenStore.hasLogin) {
    void loadMatches(false)
  }
})

watch(() => requestForm.serviceType, () => {
  if (tokenStore.hasLogin) {
    void loadMatches(false)
  }
})

onLoad((options: Record<string, string | undefined>) => {
  if (options?.petId && tokenStore.hasLogin) {
    void loadPage(false, options.petId)
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
  <AppPageShell title="发布需求" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_REQUEST_PAGE"
        title="从需求到匹配的完整流程"
        description="先定义时间、地点和预算，再看照料者匹配结果，避免主人在复杂工作台里反复切换。"
      />

      <AppSection title="发布本次照料计划" description="围绕一次真实服务场景组织字段，先定宠物和时间，再定地点和预算。">
        <view class="request-form-block">
          <view v-if="petSelectionOptions.length" class="request-form-group">
            <text class="request-form-group__label">选择宠物</text>
            <AppChoiceChips v-model="requestForm.petId" :options="petSelectionOptions" />
          </view>
          <view v-else class="request-empty request-empty--soft">
            <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步宠物档案' : '还没有宠物档案，请先建档'" />
            <AppButton size="medium" @click="openPets">先去建档</AppButton>
          </view>

          <view class="request-form-group">
            <text class="request-form-group__label">服务类型</text>
            <AppChoiceChips v-model="requestForm.serviceType" :options="serviceTypeOptions" />
          </view>

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
            <text>服务时段：{{ scheduleSummary }}</text>
          </view>

          <AppInput v-model="requestForm.locationText" label="服务地点" placeholder="例如：杭州市拱墅区北部软件园" />
          <AppInput v-model="requestForm.city" label="匹配城市" placeholder="例如：杭州" />
          <AppInput v-model="requestForm.budgetAmount" label="预算金额" placeholder="例如：200" type="digit" />
          <AppInput v-model="requestForm.demandTagsText" label="照料要求" placeholder="例如：怕生，定时喂药，晚上视频回传" />

          <view class="request-action-row">
            <AppButton size="medium" type="info" @click="loadMatches(true)">刷新推荐</AppButton>
            <AppButton size="medium" :loading="creatingRequest" @click="submitRequest">发布需求</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="照料者推荐" description="根据当前宠物和服务类型做快速初筛，方便你先比价格、城市和评分。">
        <view v-if="caregivers.length" class="request-caregiver-grid">
          <view v-for="caregiver in caregivers" :key="caregiver.serviceId" class="request-caregiver-card">
            <text class="request-caregiver-card__name">{{ caregiver.caregiverName }}</text>
            <text class="request-caregiver-card__meta">
              {{ caregiver.city || '城市待补充' }} · 评分 {{ formatAmount(caregiver.ratingAvg) }}
            </text>
            <text class="request-caregiver-card__meta">
              {{ serviceTypeLabels[caregiver.serviceType] }} · {{ speciesLabels[caregiver.petSpecies] }}
            </text>
            <text class="request-caregiver-card__price">¥{{ formatAmount(caregiver.pricePerUnit) }}/{{ caregiver.unitType }}</text>
          </view>
        </view>
        <view v-else class="request-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步照料者推荐' : '当前筛选条件下暂无推荐照料者'" />
        </view>
      </AppSection>

      <AppSection title="已发布需求" description="保留最近的发布记录，便于回看状态与服务时间。">
        <view v-if="requests.length" class="request-history-list">
          <view v-for="item in requests" :key="item.id" class="request-history-card">
            <text class="request-history-card__title">{{ item.pet?.name || '宠物' }} · {{ serviceTypeLabels[item.serviceType] }}</text>
            <text class="request-history-card__meta">{{ getRequestStatusLabel(item.status) }} · {{ formatRange(item.startTime, item.endTime) }}</text>
            <text class="request-history-card__meta">{{ item.locationText }} · 预算 ¥{{ formatAmount(item.budgetAmount) }}</text>
          </view>
        </view>
        <view v-else class="request-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步需求记录' : '还没有发布过服务需求'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始发布需求">
        <view class="request-empty request-empty--login">
          <AppStatus text="登录后即可发布宠物临时照料需求。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.request-form-block,
.request-form-group,
.request-history-list {
  display: grid;
  gap: 16rpx;
}

.request-form-group__label {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.request-picker-grid,
.request-caregiver-grid {
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
  border: 1rpx solid var(--app-border);
  background: var(--app-surface);
  color: var(--app-text);
  box-sizing: border-box;
}

.request-inline-note,
.request-caregiver-card,
.request-history-card,
.request-empty--soft {
  padding: 20rpx 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
}

.request-inline-note {
  background: #eefaf7;
  color: #125a54;
  line-height: 1.7;
}

.request-caregiver-card,
.request-history-card {
  display: grid;
  gap: 10rpx;
}

.request-caregiver-card__name,
.request-history-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  font-weight: 700;
}

.request-caregiver-card__meta,
.request-history-card__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.request-caregiver-card__price {
  color: #0f766e;
  font-size: 24rpx;
  font-weight: 700;
}

.request-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.request-empty {
  padding: 8rpx 0;
}

.request-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .request-picker-grid,
  .request-caregiver-grid {
    grid-template-columns: 1fr;
  }
}
</style>
