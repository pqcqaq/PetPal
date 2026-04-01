<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，准备发起一次真实照料需求
 * Entry: 从主人首页、宠物页建档后回流、订单页再次下单进入
 * First screen: 先看到当前步骤和本次需求摘要，再按顺序填写宠物、时间地点、预算要求
 * Primary action: 按步骤继续并最终发布需求
 * Secondary actions: 切换步骤、刷新推荐、去补宠物档案
 * States: 未登录、无宠物、步骤未完成、推荐为空、发布中、最近需求存在
 */
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
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
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

type RequestFlowStep = 'PET' | 'SCHEDULE' | 'DETAIL' | 'REVIEW'

const tokenStore = useTokenStore()

const loading = ref(false)
const creatingRequest = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])
const flowStep = ref<RequestFlowStep>('PET')

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
  { label: '宠物', value: 'PET' },
  { label: '时间', value: 'SCHEDULE' },
  { label: '要求', value: 'DETAIL' },
  { label: '确认', value: 'REVIEW' },
]

const petSelectionOptions = computed(() => pets.value.map(item => ({
  label: item.name,
  value: item.id,
})))

const selectedPet = computed(() => pets.value.find(item => item.id === requestForm.petId) ?? null)
const selectedTags = computed(() => splitTagText(requestForm.demandTagsText))
const startDateTime = computed(() => dayjs(`${requestForm.startDate} ${requestForm.startTime}`))
const endDateTime = computed(() => dayjs(`${requestForm.endDate} ${requestForm.endTime}`))
const scheduleValid = computed(() => startDateTime.value.isValid() && endDateTime.value.isValid() && endDateTime.value.isAfter(startDateTime.value))
const scheduleSummary = computed(() => {
  if (!scheduleValid.value) {
    return '请重新确认服务时间'
  }
  return `${startDateTime.value.format('MM-DD HH:mm')} 至 ${endDateTime.value.format('MM-DD HH:mm')}`
})
const activeRequestCount = computed(() => requests.value.filter(item => (
  item.status === 'OPEN' || item.status === 'MATCHING' || item.status === 'CONFIRMED'
)).length)
const caregiverHighlights = computed(() => caregivers.value.slice(0, 3))
const recentRequests = computed(() => [...requests.value]
  .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  .slice(0, 3))
const canMoveToSchedule = computed(() => Boolean(requestForm.petId && requestForm.serviceType))
const canMoveToDetail = computed(() => Boolean(
  canMoveToSchedule.value
  && scheduleValid.value
  && requestForm.locationText.trim(),
))
const canPublish = computed(() => Boolean(
  canMoveToDetail.value
  && selectedPet.value,
))

const focusHint = computed(() => {
  if (!pets.value.length) {
    return '先补一只宠物，后面的需求、匹配和订单才能真正跑起来。'
  }
  if (flowStep.value === 'PET') {
    return selectedPet.value
      ? `先确定 ${selectedPet.value.name} 这次需要什么服务。`
      : '先选宠物，再决定这次要寄养、喂养还是上门陪伴。'
  }
  if (flowStep.value === 'SCHEDULE') {
    return '把时间和地点定清楚，照料者推荐才会更准确。'
  }
  if (flowStep.value === 'DETAIL') {
    return '补预算和特别要求，让照料者更快判断能否接单。'
  }
  return '最后核对一遍摘要，再发布这次需求。'
})

const reviewRows = computed(() => [
  {
    title: '宠物与服务',
    label: selectedPet.value
      ? `${selectedPet.value.name} · ${speciesLabels[selectedPet.value.species]}`
      : '还没有选择宠物',
    value: serviceTypeLabels[requestForm.serviceType],
  },
  {
    title: '服务时间',
    label: scheduleSummary.value,
    value: scheduleValid.value ? '已确认' : '待确认',
  },
  {
    title: '服务地点',
    label: requestForm.locationText.trim() || '地点待填写',
    value: requestForm.city.trim() || '城市待填',
  },
  {
    title: '预算与要求',
    label: selectedTags.value.length ? selectedTags.value.join('、') : '暂无特别要求',
    value: `¥${formatAmount(requestForm.budgetAmount)}`,
  },
])

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
  if (flowStep.value === 'PET') {
    if (!canMoveToSchedule.value) {
      uni.showToast({ title: '请先选择宠物和服务类型', icon: 'none' })
      return
    }
    flowStep.value = 'SCHEDULE'
    return
  }

  if (flowStep.value === 'SCHEDULE') {
    if (!scheduleValid.value || !requestForm.locationText.trim()) {
      uni.showToast({ title: '请确认时间范围和服务地点', icon: 'none' })
      return
    }
    flowStep.value = 'DETAIL'
    return
  }

  if (flowStep.value === 'DETAIL') {
    flowStep.value = 'REVIEW'
  }
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
      city: requestForm.city.trim() || undefined,
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

  if (!scheduleValid.value) {
    uni.showToast({ title: '请确认服务时间范围', icon: 'none' })
    return
  }

  creatingRequest.value = true
  try {
    await createServiceRequest({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: startDateTime.value.toISOString(),
      endTime: endDateTime.value.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: Number(requestForm.budgetAmount || 0) || undefined,
      demandTags: splitTagText(requestForm.demandTagsText),
    })
    uni.showToast({ title: '服务需求已发布', icon: 'none' })
    flowStep.value = 'REVIEW'
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

watch(() => requestForm.city, () => {
  if (tokenStore.hasLogin && (flowStep.value === 'DETAIL' || flowStep.value === 'REVIEW')) {
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
  <AppPageShell title="发布需求">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_REQUEST_PAGE"
        title="发布需求"
      />

      <AppSection title="这次先做什么">
        <view class="request-focus">
          <view class="request-focus__copy">
            <view class="request-focus__tags">
              <AppTag type="primary">{{ selectedPet ? selectedPet.name : '待选宠物' }}</AppTag>
              <AppTag :type="caregiverHighlights.length ? 'success' : 'default'">
                推荐 {{ caregiverHighlights.length }} 人
              </AppTag>
              <AppTag :type="activeRequestCount > 0 ? 'warning' : 'default'">
                进行中 {{ activeRequestCount }} 条
              </AppTag>
            </view>
            <text class="request-focus__title">{{ serviceTypeLabels[requestForm.serviceType] }}</text>
            <text class="request-focus__hint">{{ focusHint }}</text>
          </view>
          <AppChoiceChips v-model="flowStep" :options="stepOptions" />
        </view>
      </AppSection>

      <AppSection v-if="!pets.length" title="先建宠物档案">
        <view class="request-empty request-empty--soft">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步宠物档案' : '还没有宠物档案，先建一只宠物'" />
          <AppButton size="medium" @click="openPets">去建档</AppButton>
        </view>
      </AppSection>

      <template v-else>
        <AppSection v-if="flowStep === 'PET'" title="选择宠物和服务">
          <view class="request-step">
            <view class="request-form-group">
              <text class="request-form-group__label">这次是谁需要照料</text>
              <AppChoiceChips v-model="requestForm.petId" :options="petSelectionOptions" />
            </view>

            <view class="request-form-group">
              <text class="request-form-group__label">需要什么服务</text>
              <AppChoiceChips v-model="requestForm.serviceType" :options="serviceTypeOptions" />
            </view>

            <view v-if="selectedPet" class="request-inline-note">
              <text>{{ selectedPet.name }} · {{ speciesLabels[selectedPet.species] }}{{ selectedPet.breed ? ` · ${selectedPet.breed}` : '' }}</text>
            </view>

            <view class="request-action-row">
              <AppButton size="medium" type="info" @click="openPets">管理宠物</AppButton>
              <AppButton size="medium" @click="goNextStep">下一步</AppButton>
            </view>
          </view>
        </AppSection>

        <AppSection v-else-if="flowStep === 'SCHEDULE'" title="安排时间和地点">
          <view class="request-step">
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

            <view class="request-action-row">
              <AppButton size="medium" type="info" @click="goPrevStep">上一步</AppButton>
              <AppButton size="medium" @click="goNextStep">下一步</AppButton>
            </view>
          </view>
        </AppSection>

        <AppSection v-else-if="flowStep === 'DETAIL'" title="补充预算和要求">
          <view class="request-step">
            <AppInput v-model="requestForm.budgetAmount" label="预算金额" placeholder="例如：200" type="digit" />
            <AppInput v-model="requestForm.demandTagsText" label="照料要求" placeholder="例如：怕生，定时喂药，晚上视频回传" />

            <AppList v-if="caregiverHighlights.length">
              <AppListItem
                v-for="caregiver in caregiverHighlights"
                :key="caregiver.serviceId"
                :title="caregiver.caregiverName"
                :label="`${caregiver.city || '城市待补充'} · 评分 ${formatAmount(caregiver.ratingAvg)}`"
                :value="`¥${formatAmount(caregiver.pricePerUnit)}/${caregiver.unitType}`"
                value-emphasis
              />
            </AppList>
            <view v-else class="request-empty">
              <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步推荐' : '当前条件下还没有推荐照料者'" />
            </view>

            <view class="request-action-row">
              <AppButton size="medium" type="info" @click="goPrevStep">上一步</AppButton>
              <AppButton size="medium" type="info" @click="loadMatches(true)">刷新推荐</AppButton>
              <AppButton size="medium" @click="goNextStep">下一步</AppButton>
            </view>
          </view>
        </AppSection>

        <AppSection v-else title="确认后发布">
          <AppList>
            <AppListItem
              v-for="item in reviewRows"
              :key="item.title"
              :title="item.title"
              :label="item.label"
              :value="item.value"
              value-emphasis
            />
          </AppList>

          <view class="request-review-notice">
            <text>{{ caregiverHighlights.length ? `当前已有 ${caregiverHighlights.length} 位照料者符合基础条件。` : '当前还没有匹配到照料者，发布后仍可继续等待匹配。' }}</text>
          </view>

          <view class="request-action-row">
            <AppButton size="medium" type="info" @click="goPrevStep">上一步</AppButton>
            <AppButton size="medium" type="info" @click="loadMatches(true)">刷新推荐</AppButton>
            <AppButton size="medium" :loading="creatingRequest" @click="submitRequest">发布需求</AppButton>
          </view>
        </AppSection>
      </template>

      <AppSection title="最近需求">
        <AppList v-if="recentRequests.length">
          <AppListItem
            v-for="item in recentRequests"
            :key="item.id"
            :title="`${item.pet?.name || '宠物'} · ${serviceTypeLabels[item.serviceType]}`"
            :label="`${getRequestStatusLabel(item.status)} · ${formatRange(item.startTime, item.endTime)}`"
            :value="`¥${formatAmount(item.budgetAmount)}`"
            value-emphasis
          />
        </AppList>
        <view v-else class="request-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步需求记录' : '还没有发布过服务需求'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后发布需求">
        <view class="request-empty request-empty--login">
          <AppStatus text="登录后即可发布宠物临时照料需求。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.request-focus,
.request-step,
.request-empty--soft {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.request-focus {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.request-focus__copy,
.request-form-group {
  display: grid;
  gap: 12rpx;
}

.request-focus__tags,
.request-action-row {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.request-focus__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.25;
  font-weight: 700;
}

.request-focus__hint,
.request-form-group__label {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
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
.request-review-notice {
  padding: 20rpx 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
  color: var(--app-text);
  line-height: 1.7;
}

.request-empty {
  padding: 8rpx 0;
}

.request-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .request-picker-grid {
    grid-template-columns: 1fr;
  }
}
</style>
