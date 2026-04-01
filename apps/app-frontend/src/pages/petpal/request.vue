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
const startDateTime = computed(() => dayjs(`${requestForm.startDate} ${requestForm.startTime}`))
const endDateTime = computed(() => dayjs(`${requestForm.endDate} ${requestForm.endTime}`))
const scheduleValid = computed(() => startDateTime.value.isValid() && endDateTime.value.isValid() && endDateTime.value.isAfter(startDateTime.value))
const selectedTags = computed(() => splitTagText(requestForm.demandTagsText))
const scheduleSummary = computed(() => (
  scheduleValid.value
    ? `${startDateTime.value.format('MM-DD HH:mm')} 至 ${endDateTime.value.format('MM-DD HH:mm')}`
    : '请重新确认时间'
))
const builderTitle = computed(() => {
  if (!selectedPet.value) {
    return serviceTypeLabels[requestForm.serviceType]
  }
  return `${selectedPet.value.name} · ${serviceTypeLabels[requestForm.serviceType]}`
})
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
  flowStep.value = preferredStep || 'REVIEW'
  hydratingRequest.value = false
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
  if (flowStep.value === 'PET') {
    if (!canMoveToSchedule.value) {
      uni.showToast({ title: '先选择宠物和服务', icon: 'none' })
      return
    }
    flowStep.value = 'SCHEDULE'
    return
  }

  if (flowStep.value === 'SCHEDULE') {
    if (!canMoveToDetail.value) {
      uni.showToast({ title: '先确认时间和地点', icon: 'none' })
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
      <OwnerFlowNav
        :current-path="PETPAL_REQUEST_PAGE"
        title="新建需求"
      />

      <AppSection v-if="activeRequest" title="继续进行中">
        <view class="request-active">
          <view class="request-active__copy">
            <view class="request-active__tags">
              <AppTag type="warning">{{ getRequestStatusLabel(activeRequest.status) }}</AppTag>
              <AppTag type="primary">{{ activeRequest.pet?.name || '宠物' }}</AppTag>
            </view>
            <text class="request-active__title">{{ serviceTypeLabels[activeRequest.serviceType] }}</text>
            <text class="request-active__meta">{{ formatRange(activeRequest.startTime, activeRequest.endTime) }}</text>
          </view>
          <AppButton size="medium" @click="openActiveRequest">继续处理</AppButton>
        </view>
      </AppSection>

      <AppSection title="本次需求">
        <view class="request-focus">
          <view class="request-focus__copy">
            <view class="request-focus__tags">
              <AppTag type="primary">{{ selectedPet ? selectedPet.name : '待选宠物' }}</AppTag>
              <AppTag :type="caregiverPreview.length ? 'success' : 'default'">推荐 {{ caregiverPreview.length }}</AppTag>
              <AppTag v-if="copiedFromRequestId" type="warning">已带入旧条件</AppTag>
            </view>
            <text class="request-focus__title">{{ builderTitle }}</text>
            <text class="request-focus__meta">{{ scheduleSummary }}</text>
          </view>
          <AppChoiceChips v-model="flowStep" :options="stepOptions" />
        </view>
      </AppSection>

      <AppSection v-if="!pets.length" title="先建宠物">
        <view class="request-empty request-empty--soft">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步宠物档案' : '还没有宠物档案'" />
          <AppButton size="medium" @click="openPets">去建档</AppButton>
        </view>
      </AppSection>

      <template v-else>
        <AppSection v-if="flowStep === 'PET'" title="宠物和服务">
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
          </view>
        </AppSection>

        <AppSection v-else-if="flowStep === 'SCHEDULE'" title="时间和地点">
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
              <text>{{ scheduleSummary }}</text>
            </view>

            <AppInput v-model="requestForm.locationText" label="服务地点" placeholder="例如：杭州市拱墅区北部软件园" />
            <AppInput v-model="requestForm.city" label="匹配城市" placeholder="例如：杭州" />
          </view>
        </AppSection>

        <AppSection v-else-if="flowStep === 'DETAIL'" title="预算和要求">
          <view class="request-step">
            <AppInput v-model="requestForm.budgetAmount" label="预算金额" placeholder="例如：200" type="digit" />
            <AppInput v-model="requestForm.demandTagsText" label="照料要求" placeholder="例如：怕生，定时喂药，晚上视频回传" />

            <view class="request-preview-strip">
              <view class="request-preview-strip__meta">
                <AppTag :type="caregiverPreview.length ? 'success' : 'default'">推荐 {{ caregiverPreview.length }}</AppTag>
                <AppButton size="medium" type="info" @click="loadMatches(true)">刷新推荐</AppButton>
              </view>
              <view v-if="caregiverPreview.length" class="request-preview-list">
                <view v-for="item in caregiverPreview" :key="item.serviceId" class="request-preview-item">
                  <text class="request-preview-item__title">{{ item.caregiverName }}</text>
                  <text class="request-preview-item__meta">¥{{ formatAmount(item.pricePerUnit) }}/{{ item.unitType }}</text>
                </view>
              </view>
            </view>
          </view>
        </AppSection>

        <AppSection v-else title="确认发布">
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

          <view class="request-inline-note request-inline-note--review">
            <view class="request-active__tags">
              <AppTag :type="caregiverPreview.length ? 'success' : 'default'">
                推荐 {{ caregiverPreview.length }} 人
              </AppTag>
              <AppTag v-if="copiedFromRequestId" type="warning">来自上一条需求</AppTag>
            </view>
            <text>发布后进入需求详情继续选人和下单。</text>
          </view>
        </AppSection>

        <view class="request-bottom-bar">
          <AppButton
            v-if="flowStep !== 'PET'"
            block
            size="large"
            type="info"
            @click="goPrevStep"
          >
            上一步
          </AppButton>
          <AppButton
            v-if="flowStep !== 'REVIEW'"
            block
            size="large"
            @click="goNextStep"
          >
            下一步
          </AppButton>
          <AppButton
            v-else
            block
            size="large"
            :loading="creatingRequest"
            :disabled="!canPublish"
            @click="submitRequest"
          >
            发布需求
          </AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后新建需求">
        <view class="request-empty request-empty--login">
          <AppStatus text="登录后即可发布宠物临时照料需求。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.request-active,
.request-focus,
.request-step,
.request-empty--soft,
.request-preview-item {
  display: grid;
  gap: 16rpx;
}

.request-active,
.request-focus,
.request-step,
.request-empty--soft {
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
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
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.request-active__copy,
.request-focus__copy,
.request-form-group,
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

.request-active__title,
.request-focus__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.25;
  font-weight: 700;
}

.request-active__meta,
.request-focus__meta,
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

.request-preview-list {
  display: grid;
  gap: 12rpx;
}

.request-preview-item {
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.68);
}

.request-preview-item__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.25;
  font-weight: 700;
}

.request-preview-item__meta {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.request-empty {
  padding: 8rpx 0;
}

.request-empty--login {
  padding-bottom: 28rpx;
}

.request-bottom-bar {
  padding: 0 32rpx calc(16rpx + env(safe-area-inset-bottom));
}

.request-bottom-bar .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .request-active,
  .request-picker-grid {
    grid-template-columns: 1fr;
  }
}
</style>
