<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已发布需求、现在要迅速判断“选谁下单最稳”的主人
 * Entry: 主人首页最近需求、发布成功后的回流、提醒中心中的活跃需求、订单支付回跳
 * Core scenes:
 * 1. 先确认这条需求现在是否还有效，是否已有人可选
 * 2. 在同一屏里用排序、筛选、候选切换和对比板完成判断
 * 3. 选中后直接进入下单，不要求用户再读说明文字
 * Primary action: 切候选、看可信信息、继续下单
 * Secondary actions: 刷新一批、改时间地点、改预算要求、复制条件重建
 * Feedback: 选中状态、预算预估、评分距离、预约提前量、服务范围、照料专长
 * States: 未登录、参数缺失、需求不存在、匹配为空、筛选后为空、需求关闭
 */
import type { MatchedCaregiverRecord, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listServiceRequests, matchCaregivers } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  buildOwnerMatchQuery,
  canRequestCheckout,
  formatAmount,
  formatCaregiverExperience,
  formatCaregiverNoticeHours,
  formatCaregiverRadius,
  formatDateTime,
  formatDistanceKm,
  formatRange,
  getRequestStatusLabel,
  getRequestTagType,
  isRequestActive,
  joinTagText,
  PETPAL_CHECKOUT_PAGE,
  PETPAL_REQUEST_PAGE,
  serviceTypeLabels,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalRequestDetailPage',
})

definePage({
  style: {
    navigationBarTitleText: '需求详情',
    enablePullDownRefresh: true,
  },
})

type RequestDetailPanel = 'MATCHES' | 'PLAN' | 'STATE'
type MatchSortMode = 'RECOMMENDED' | 'PRICE_LOW' | 'RATING_HIGH' | 'DISTANCE_NEAR'
type MatchFilterMode = 'ALL' | 'WITHIN_BUDGET' | 'NEARBY' | 'TOP_RATED'
type RequestFlowStep = 'SCHEDULE' | 'DETAIL' | 'REVIEW'

const tokenStore = useTokenStore()

const requestId = ref('')
const loading = ref(false)
const matchesLoading = ref(false)
const error = ref('')

const requestRecord = ref<ServiceRequestRecord | null>(null)
const matchItems = ref<MatchedCaregiverRecord[]>([])
const selectedServiceId = ref('')
const activePanel = ref<RequestDetailPanel>('MATCHES')
const matchSortMode = ref<MatchSortMode>('RECOMMENDED')
const matchFilterMode = ref<MatchFilterMode>('ALL')

const panelOptions = [
  { label: '匹配', value: 'MATCHES' },
  { label: '安排', value: 'PLAN' },
  { label: '进度', value: 'STATE' },
]

const matchSortOptions = [
  { label: '综合', value: 'RECOMMENDED' },
  { label: '更省', value: 'PRICE_LOW' },
  { label: '高分', value: 'RATING_HIGH' },
  { label: '更近', value: 'DISTANCE_NEAR' },
]

const matchFilterOptions = [
  { label: '全部', value: 'ALL' },
  { label: '预算内', value: 'WITHIN_BUDGET' },
  { label: '更近', value: 'NEARBY' },
  { label: '更稳', value: 'TOP_RATED' },
]

function getDistanceValue(item: MatchedCaregiverRecord) {
  return item.distanceKm == null ? Number.POSITIVE_INFINITY : Number(item.distanceKm)
}

function sortMatches(
  items: MatchedCaregiverRecord[],
  mode: MatchSortMode,
  matchedCaregiverId?: string | null,
) {
  return [...items].sort((left, right) => {
    const leftMatched = matchedCaregiverId && left.caregiverId === matchedCaregiverId ? 1 : 0
    const rightMatched = matchedCaregiverId && right.caregiverId === matchedCaregiverId ? 1 : 0

    if (mode === 'RECOMMENDED' && leftMatched !== rightMatched) {
      return rightMatched - leftMatched
    }

    if (mode === 'PRICE_LOW') {
      const priceGap = Number(left.pricePerUnit) - Number(right.pricePerUnit)
      if (priceGap !== 0) return priceGap
    }

    if (mode === 'RATING_HIGH') {
      const ratingGap = Number(right.ratingAvg) - Number(left.ratingAvg)
      if (ratingGap !== 0) return ratingGap
      const ratingCountGap = right.ratingCount - left.ratingCount
      if (ratingCountGap !== 0) return ratingCountGap
    }

    if (mode === 'DISTANCE_NEAR') {
      const distanceGap = getDistanceValue(left) - getDistanceValue(right)
      if (distanceGap !== 0) return distanceGap
    }

    const recommendedRatingGap = Number(right.ratingAvg) - Number(left.ratingAvg)
    if (recommendedRatingGap !== 0) return recommendedRatingGap

    const recommendedDistanceGap = getDistanceValue(left) - getDistanceValue(right)
    if (recommendedDistanceGap !== 0) return recommendedDistanceGap

    return Number(left.pricePerUnit) - Number(right.pricePerUnit)
  })
}

function getRequestDurationHours(request: ServiceRequestRecord) {
  return Math.max(
    1,
    Math.ceil(Math.max(0, new Date(request.endTime).getTime() - new Date(request.startTime).getTime()) / (1000 * 60 * 60)),
  )
}

function getEstimatedUnits(request: ServiceRequestRecord, caregiver: MatchedCaregiverRecord) {
  const durationHours = getRequestDurationHours(request)
  const unitType = caregiver.unitType.trim().toUpperCase()

  if (unitType.includes('DAY')) {
    return Math.max(1, Math.ceil(durationHours / 24))
  }
  if (unitType.includes('HOUR')) {
    return Math.max(1, Math.ceil(durationHours))
  }
  if (unitType.includes('HALF')) {
    return Math.max(1, Math.ceil(durationHours / 12))
  }
  if (unitType.includes('VISIT') || unitType.includes('TIME') || unitType.includes('TRIP')) {
    return 1
  }
  if (request.serviceType === 'BOARDING') {
    return Math.max(1, Math.ceil(durationHours / 24))
  }
  return 1
}

function getEstimatedSpend(request: ServiceRequestRecord, caregiver: MatchedCaregiverRecord) {
  return Number((Number(caregiver.pricePerUnit) * getEstimatedUnits(request, caregiver)).toFixed(2))
}

function filterMatches(
  items: MatchedCaregiverRecord[],
  mode: MatchFilterMode,
  request: ServiceRequestRecord | null,
) {
  if (!request) {
    return items
  }

  const budgetAmount = Number(request.budgetAmount ?? 0)
  return items.filter((item) => {
    if (mode === 'WITHIN_BUDGET') {
      return budgetAmount > 0 ? getEstimatedSpend(request, item) <= budgetAmount : true
    }
    if (mode === 'NEARBY') {
      return item.distanceKm == null || item.distanceKm <= 5
    }
    if (mode === 'TOP_RATED') {
      return Number(item.ratingAvg) >= 4.8 || item.ratingCount >= 20
    }
    return true
  })
}

const rankedMatchItems = computed(() => sortMatches(
  filterMatches(matchItems.value, matchFilterMode.value, requestRecord.value),
  matchSortMode.value,
  requestRecord.value?.matchedCaregiverId,
))

const selectedCaregiver = computed(() => {
  if (!rankedMatchItems.value.length) {
    return null
  }
  return rankedMatchItems.value.find(item => item.serviceId === selectedServiceId.value)
    ?? rankedMatchItems.value.find(item => item.caregiverId === requestRecord.value?.matchedCaregiverId)
    ?? rankedMatchItems.value[0]
    ?? null
})

const quickCandidateOptions = computed(() => rankedMatchItems.value
  .slice(0, 6)
  .map(item => ({
    label: item.caregiverName,
    value: item.serviceId,
    description: requestRecord.value
      ? `预估 ¥${formatAmount(getEstimatedSpend(requestRecord.value, item))} · ${formatDistanceKm(item.distanceKm)} · ${formatCaregiverNoticeHours(item.minNoticeHours)}`
      : `¥${formatAmount(item.pricePerUnit)} · ${formatCaregiverExperience(item.experienceYears)}`,
  })))

const alternativeCaregivers = computed(() => rankedMatchItems.value
  .filter(item => item.serviceId !== selectedCaregiver.value?.serviceId)
  .slice(0, 3))

const compareCandidates = computed(() => rankedMatchItems.value.slice(0, 3))

const filterSummary = computed(() => {
  const totalCount = matchItems.value.length
  const visibleCount = rankedMatchItems.value.length
  if (totalCount === 0) {
    return '当前还没有候选照料者'
  }
  if (visibleCount === totalCount) {
    return `当前共 ${totalCount} 位候选`
  }
  return `当前筛出 ${visibleCount} / ${totalCount} 位候选`
})

const selectedCaregiverMetrics = computed(() => {
  const caregiver = selectedCaregiver.value
  if (!caregiver) {
    return []
  }
  return [
    {
      label: '报价',
      value: `¥${formatAmount(caregiver.pricePerUnit)}/${caregiver.unitType}`,
    },
    {
      label: '预估',
      value: requestRecord.value ? `¥${formatAmount(getEstimatedSpend(requestRecord.value, caregiver))}` : '--',
    },
    {
      label: '评分',
      value: `${formatAmount(caregiver.ratingAvg)} / ${caregiver.ratingCount}`,
    },
    {
      label: '距离',
      value: formatDistanceKm(caregiver.distanceKm),
    },
    {
      label: '接单前',
      value: formatCaregiverNoticeHours(caregiver.minNoticeHours),
    },
    {
      label: '服务圈',
      value: formatCaregiverRadius(caregiver.serviceRadiusKm),
    },
  ]
})

const selectedCaregiverPills = computed(() => {
  const caregiver = selectedCaregiver.value
  if (!caregiver) {
    return []
  }
  return [
    formatCaregiverExperience(caregiver.experienceYears),
    formatCaregiverNoticeHours(caregiver.minNoticeHours),
    formatCaregiverRadius(caregiver.serviceRadiusKm),
    ...caregiver.specialtyTags.slice(0, 3),
  ]
})

const canCheckoutNow = computed(() => Boolean(
  requestRecord.value && (selectedCaregiver.value || canRequestCheckout(requestRecord.value))
))

const requestMetrics = computed(() => {
  const request = requestRecord.value
  if (!request) {
    return []
  }
  return [
    {
      label: '预算',
      value: `¥${formatAmount(request.budgetAmount)}`,
    },
    {
      label: '匹配',
      value: `${matchItems.value.length} 人`,
    },
    {
      label: '更新',
      value: formatDateTime(request.updatedAt),
    },
  ]
})

const requestSummaryRows = computed(() => {
  const request = requestRecord.value
  if (!request) {
    return []
  }
  return [
    {
      title: '宠物与服务',
      label: `${request.pet?.name || '宠物'} · ${speciesLabels[request.pet?.species || 'DOG']}`,
      value: serviceTypeLabels[request.serviceType],
    },
    {
      title: '服务时间',
      label: formatRange(request.startTime, request.endTime),
      value: `${getRequestDurationHours(request)} 小时`,
    },
    {
      title: '服务地点',
      label: request.locationText,
      value: getRequestStatusLabel(request.status),
    },
    {
      title: '照料要求',
      label: joinTagText(Array.isArray(request.demandTags) ? request.demandTags : []) || '暂无特别要求',
      value: `¥${formatAmount(request.budgetAmount)}`,
    },
  ]
})

const stateRows = computed(() => {
  const request = requestRecord.value
  return [
    {
      title: '当前状态',
      label: request ? getRequestStatusLabel(request.status) : '--',
      value: request && isRequestActive(request.status) ? '处理中' : '已结束',
    },
    {
      title: '当前候选',
      label: selectedCaregiver.value
        ? `${selectedCaregiver.value.caregiverName} · ${formatDistanceKm(selectedCaregiver.value.distanceKm)}`
        : '还没有照料者',
      value: selectedCaregiver.value ? `¥${formatAmount(selectedCaregiver.value.pricePerUnit)}` : '待匹配',
    },
    {
      title: '下一步',
      label: canCheckoutNow.value ? '可以直接继续下单' : '先刷新匹配或调整条件',
      value: canCheckoutNow.value ? '结算' : '调整',
    },
  ]
})

const progressSteps = computed(() => {
  const request = requestRecord.value
  const matched = Boolean(rankedMatchItems.value.length || request?.matchedCaregiverId)
  const payable = Boolean(request && canRequestCheckout(request))
  return [
    {
      label: '已发布',
      active: Boolean(request),
    },
    {
      label: matched ? '已匹配' : '等待匹配',
      active: matched,
    },
    {
      label: payable ? '可下单' : '待确认',
      active: payable,
    },
  ]
})

const primaryActionLabel = computed(() => {
  const request = requestRecord.value
  if (!request) {
    return '刷新'
  }
  if (!isRequestActive(request.status)) {
    return '按当前条件重建'
  }
  if (canCheckoutNow.value) {
    return '继续下单'
  }
  return '刷新匹配'
})

function syncSelectedCaregiver() {
  if (!matchItems.value.length) {
    selectedServiceId.value = ''
    return
  }

  const rankedItems = sortMatches(
    filterMatches(matchItems.value, matchFilterMode.value, requestRecord.value),
    matchSortMode.value,
    requestRecord.value?.matchedCaregiverId,
  )
  if (selectedServiceId.value && rankedItems.some(item => item.serviceId === selectedServiceId.value)) {
    return
  }
  selectedServiceId.value = rankedItems[0]?.serviceId || ''
}

async function loadMatches(showError = false, resetSelection = false) {
  const request = requestRecord.value
  if (!request?.pet?.species) {
    matchItems.value = []
    selectedServiceId.value = ''
    return
  }

  matchesLoading.value = true
  try {
    const page = await matchCaregivers(buildOwnerMatchQuery({
      petSpecies: request.pet.species,
      serviceType: request.serviceType,
      pageSize: 8,
    }))
    matchItems.value = page.items
    if (resetSelection) {
      selectedServiceId.value = ''
    }
    syncSelectedCaregiver()
  }
  catch (cause: unknown) {
    matchItems.value = []
    selectedServiceId.value = ''
    if (showError) {
      uni.showToast({
        title: getErrorMessage(cause, '刷新匹配失败'),
        icon: 'none',
      })
    }
  }
  finally {
    matchesLoading.value = false
  }
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  if (!requestId.value) {
    error.value = '缺少需求参数'
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  error.value = ''
  try {
    const requests = await listServiceRequests()
    requestRecord.value = requests.find(item => item.id === requestId.value) ?? null

    if (!requestRecord.value) {
      throw new Error('需求不存在或已不可用')
    }

    await loadMatches(false)
  }
  catch (cause: unknown) {
    requestRecord.value = null
    matchItems.value = []
    selectedServiceId.value = ''
    error.value = getErrorMessage(cause, '加载需求详情失败')
    if (showError) {
      uni.showToast({
        title: error.value,
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openNewRequest() {
  uni.redirectTo({ url: PETPAL_REQUEST_PAGE })
}

function openRequestStep(step: RequestFlowStep) {
  if (!requestRecord.value) {
    openNewRequest()
    return
  }
  uni.redirectTo({ url: `${PETPAL_REQUEST_PAGE}?requestId=${requestRecord.value.id}&step=${step}` })
}

function duplicateRequest() {
  if (!requestRecord.value) {
    openNewRequest()
    return
  }
  uni.redirectTo({ url: `${PETPAL_REQUEST_PAGE}?requestId=${requestRecord.value.id}` })
}

function openCheckout() {
  if (!requestRecord.value) {
    return
  }

  if (!canCheckoutNow.value) {
    uni.showToast({ title: '先选择一位照料者', icon: 'none' })
    return
  }

  const caregiverQuery = selectedCaregiver.value?.serviceId
    ? `&caregiverServiceId=${selectedCaregiver.value.serviceId}`
    : ''
  uni.navigateTo({
    url: `${PETPAL_CHECKOUT_PAGE}?requestId=${requestRecord.value.id}${caregiverQuery}`,
  })
}

function handlePrimaryAction() {
  const request = requestRecord.value
  if (!request) {
    void loadPage(true)
    return
  }

  if (!isRequestActive(request.status)) {
    duplicateRequest()
    return
  }

  if (canCheckoutNow.value) {
    openCheckout()
    return
  }

  void loadMatches(true, true)
}

watch(matchSortMode, () => {
  if (!matchItems.value.length) {
    return
  }
  syncSelectedCaregiver()
})

watch(matchFilterMode, () => {
  if (!matchItems.value.length) {
    return
  }
  syncSelectedCaregiver()
})

onLoad((options: Record<string, string | undefined>) => {
  requestId.value = options.requestId || ''
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
  <AppPageShell title="需求详情">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_REQUEST_PAGE"
        title="需求详情"
      />

      <template v-if="loading">
        <AppSection title="同步状态">
          <AppStatus mode="loading" text="正在同步需求" />
        </AppSection>
      </template>

      <template v-else-if="!error && requestRecord">
        <AppSection title="当前需求">
          <view class="request-stage">
            <view class="request-stage__copy">
              <view class="request-stage__tags">
                <AppTag :type="getRequestTagType(requestRecord.status)">
                  {{ getRequestStatusLabel(requestRecord.status) }}
                </AppTag>
                <AppTag type="primary">{{ requestRecord.pet?.name || '宠物' }}</AppTag>
                <AppTag v-if="canCheckoutNow" type="success">可下单</AppTag>
              </view>
              <text class="request-stage__title">{{ serviceTypeLabels[requestRecord.serviceType] }}</text>
              <text class="request-stage__meta">{{ formatRange(requestRecord.startTime, requestRecord.endTime) }}</text>
              <text class="request-stage__meta">{{ requestRecord.locationText }}</text>
            </view>

            <view class="request-stage__metrics">
              <view
                v-for="metric in requestMetrics"
                :key="metric.label"
                class="request-stage__metric"
              >
                <text class="request-stage__metric-label">{{ metric.label }}</text>
                <text class="request-stage__metric-value">{{ metric.value }}</text>
              </view>
            </view>
          </view>
        </AppSection>

        <AppSection title="切换">
          <AppChoiceChips v-model="activePanel" :options="panelOptions" />
        </AppSection>

        <AppSection v-if="activePanel === 'MATCHES'" :title="matchItems.length ? `匹配照料者 (${rankedMatchItems.length}/${matchItems.length})` : '匹配照料者'">
          <view class="request-stack">
            <AppChoiceChips v-model="matchFilterMode" :options="matchFilterOptions" />
            <AppChoiceChips v-model="matchSortMode" :options="matchSortOptions" />

            <view class="request-inline-summary">
              <text>{{ filterSummary }}</text>
            </view>

            <AppChoiceChips
              v-if="quickCandidateOptions.length"
              v-model="selectedServiceId"
              :options="quickCandidateOptions"
              show-descriptions
            />

            <view class="request-toolbar">
              <AppButton size="medium" type="info" :loading="matchesLoading" @click="loadMatches(true, true)">刷新推荐</AppButton>
              <AppButton size="medium" type="info" @click="openRequestStep('SCHEDULE')">改时间地点</AppButton>
              <AppButton size="medium" type="info" @click="openRequestStep('DETAIL')">改预算要求</AppButton>
            </view>

            <view v-if="selectedCaregiver" class="selected-caregiver">
              <view class="selected-caregiver__headline">
                <view class="selected-caregiver__copy">
                  <view class="selected-caregiver__tags">
                    <AppTag type="success">当前选中</AppTag>
                    <AppTag type="default">{{ selectedCaregiver.city || '城市待补充' }}</AppTag>
                    <AppTag
                      v-for="pill in selectedCaregiverPills"
                      :key="pill"
                      type="default"
                    >
                      {{ pill }}
                    </AppTag>
                  </view>
                  <text class="selected-caregiver__title">{{ selectedCaregiver.caregiverName }}</text>
                  <text class="selected-caregiver__meta">
                    {{ formatDistanceKm(selectedCaregiver.distanceKm) }} · 评分 {{ formatAmount(selectedCaregiver.ratingAvg) }} · {{ selectedCaregiver.ratingCount }} 条评价
                  </text>
                  <text v-if="selectedCaregiver.intro" class="selected-caregiver__intro">{{ selectedCaregiver.intro }}</text>
                </view>
                <AppTag type="primary">¥{{ formatAmount(selectedCaregiver.pricePerUnit) }}/{{ selectedCaregiver.unitType }}</AppTag>
              </view>

              <view class="selected-caregiver__metrics">
                <view
                  v-for="metric in selectedCaregiverMetrics"
                  :key="metric.label"
                  class="selected-caregiver__metric"
                >
                  <text class="selected-caregiver__metric-label">{{ metric.label }}</text>
                  <text class="selected-caregiver__metric-value">{{ metric.value }}</text>
                </view>
              </view>

              <view v-if="selectedCaregiver.serviceCommitment" class="selected-caregiver__promise">
                <text class="selected-caregiver__promise-label">承诺</text>
                <text class="selected-caregiver__promise-text">{{ selectedCaregiver.serviceCommitment }}</text>
              </view>

              <view class="request-toolbar">
                <AppButton size="medium" type="info" @click="duplicateRequest">复制条件</AppButton>
                <AppButton size="medium" @click="openCheckout">继续下单</AppButton>
              </view>
            </view>

            <view v-if="compareCandidates.length" class="compare-board">
              <view class="compare-board__header">
                <text class="compare-board__title">快速对比</text>
                <AppTag type="default">{{ compareCandidates.length }} 位候选</AppTag>
              </view>
              <scroll-view scroll-x class="compare-board__scroll">
                <view class="compare-board__table">
                  <view class="compare-board__row compare-board__row--header">
                    <text class="compare-board__metric">维度</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`header-${item.serviceId}`"
                      class="compare-board__cell compare-board__cell--candidate"
                      :class="selectedServiceId === item.serviceId ? 'compare-board__cell--active' : ''"
                      @click="selectedServiceId = item.serviceId"
                    >
                      <text class="compare-board__candidate">{{ item.caregiverName }}</text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">预估</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`spend-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value">
                        {{ requestRecord ? `¥${formatAmount(getEstimatedSpend(requestRecord, item))}` : '--' }}
                      </text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">评分</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`rating-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value">
                        {{ formatAmount(item.ratingAvg) }} / {{ item.ratingCount }}
                      </text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">距离</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`distance-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value">{{ formatDistanceKm(item.distanceKm) }}</text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">经验</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`experience-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value">{{ formatCaregiverExperience(item.experienceYears) }}</text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">接单前</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`notice-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value">{{ formatCaregiverNoticeHours(item.minNoticeHours) }}</text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">专长</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`specialty-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value compare-board__value--wrap">
                        {{ joinTagText(item.specialtyTags.slice(0, 2)) || '常规照料' }}
                      </text>
                    </view>
                  </view>
                  <view class="compare-board__row">
                    <text class="compare-board__metric">计价</text>
                    <view
                      v-for="item in compareCandidates"
                      :key="`unit-${item.serviceId}`"
                      class="compare-board__cell"
                    >
                      <text class="compare-board__value">
                        ¥{{ formatAmount(item.pricePerUnit) }}/{{ item.unitType }}
                      </text>
                    </view>
                  </view>
                </view>
              </scroll-view>
            </view>

            <AppList v-if="alternativeCaregivers.length">
              <AppListItem
                v-for="item in alternativeCaregivers"
                :key="item.serviceId"
                :title="item.caregiverName"
                :label="`${formatDistanceKm(item.distanceKm)} · ${formatCaregiverExperience(item.experienceYears)}`"
                :value="`¥${formatAmount(item.pricePerUnit)}/${item.unitType}`"
                value-emphasis
                clickable
                is-link
                @click="selectedServiceId = item.serviceId"
              />
            </AppList>

            <view v-if="!rankedMatchItems.length" class="request-empty">
              <AppStatus
                :mode="matchesLoading ? 'loading' : 'empty'"
                :text="matchesLoading ? '正在刷新匹配' : (matchItems.length ? '当前筛选下没有合适照料者' : '当前没有可用照料者')"
              />
              <view v-if="!matchesLoading && matchItems.length" class="request-toolbar">
                <AppButton size="medium" type="info" @click="matchFilterMode = 'ALL'">清空筛选</AppButton>
                <AppButton size="medium" @click="loadMatches(true, true)">换一批</AppButton>
              </view>
            </view>
          </view>
        </AppSection>

        <AppSection v-else-if="activePanel === 'PLAN'" title="服务安排">
          <AppList>
            <AppListItem
              v-for="item in requestSummaryRows"
              :key="item.title"
              :title="item.title"
              :label="item.label"
              :value="item.value"
              value-emphasis
            />
          </AppList>
          <view class="request-toolbar">
            <AppButton size="medium" type="info" @click="openRequestStep('SCHEDULE')">改时间地点</AppButton>
            <AppButton size="medium" type="info" @click="openRequestStep('DETAIL')">改预算要求</AppButton>
            <AppButton size="medium" @click="duplicateRequest">复制条件</AppButton>
          </view>
        </AppSection>

        <AppSection v-else title="推进进度">
          <view class="progress-rail">
            <view
              v-for="step in progressSteps"
              :key="step.label"
              class="progress-node"
              :class="step.active ? 'progress-node--active' : ''"
            >
              <view class="progress-node__dot" />
              <text class="progress-node__label">{{ step.label }}</text>
            </view>
          </view>

          <AppList>
            <AppListItem
              v-for="item in stateRows"
              :key="item.title"
              :title="item.title"
              :label="item.label"
              :value="item.value"
              value-emphasis
            />
          </AppList>

          <view class="request-toolbar">
            <AppButton size="medium" type="info" :loading="matchesLoading" @click="loadMatches(true, true)">刷新匹配</AppButton>
            <AppButton size="medium" type="info" @click="openRequestStep('REVIEW')">重新确认</AppButton>
            <AppButton size="medium" @click="handlePrimaryAction">{{ primaryActionLabel }}</AppButton>
          </view>
        </AppSection>

        <view class="request-bottom-bar">
          <AppButton block size="large" :loading="matchesLoading" @click="handlePrimaryAction">
            {{ primaryActionLabel }}
          </AppButton>
          <AppButton block size="large" type="info" @click="openRequestStep('DETAIL')">调整当前需求</AppButton>
        </view>
      </template>

      <template v-else>
        <AppSection title="当前不可用">
          <AppStatus :text="error" />
        </AppSection>
        <view class="request-bottom-bar">
          <AppButton block size="large" type="info" @click="openNewRequest">返回新建需求</AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <AppStatus text="登录后才能继续跟进需求。" />
      </AppSection>
      <view class="request-bottom-bar">
        <AppButton block size="large" @click="goToLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.request-stage,
.request-stage__metric,
.request-stack,
.selected-caregiver,
.selected-caregiver__metric {
  display: grid;
  gap: 14rpx;
}

.request-stage {
  padding: 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.request-stage__copy,
.selected-caregiver__copy {
  display: grid;
  gap: 10rpx;
}

.request-stage__tags,
.selected-caregiver__tags,
.request-toolbar {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.request-stage__title,
.selected-caregiver__title {
  color: var(--app-text);
  font-size: 32rpx;
  line-height: 1.25;
  font-weight: 700;
}

.request-stage__meta,
.request-stage__metric-label,
.selected-caregiver__meta,
.selected-caregiver__intro,
.selected-caregiver__metric-label,
.progress-node__label,
.request-inline-summary,
.compare-board__metric,
.compare-board__value {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.request-stage__metrics,
.selected-caregiver__metrics {
  display: grid;
  gap: 16rpx;
}

.request-stage__metrics,
.selected-caregiver__metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.request-stage__metric,
.selected-caregiver__metric {
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
}

.request-stage__metric-value,
.selected-caregiver__metric-value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.25;
  font-weight: 700;
}

.selected-caregiver {
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid rgba(15, 118, 110, 0.2);
  background: linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.selected-caregiver__intro {
  color: var(--app-text);
}

.request-inline-summary,
.compare-board {
  padding: 20rpx 24rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.selected-caregiver__headline {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.selected-caregiver__promise {
  display: grid;
  gap: 8rpx;
  padding: 18rpx 20rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.55);
}

.selected-caregiver__promise-label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.4;
}

.selected-caregiver__promise-text {
  color: var(--app-text);
  font-size: 24rpx;
  line-height: 1.6;
}

.compare-board {
  display: grid;
  gap: 16rpx;
}

.compare-board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.compare-board__title,
.compare-board__candidate {
  color: var(--app-text);
  font-size: 26rpx;
  line-height: 1.3;
  font-weight: 700;
}

.compare-board__scroll {
  width: 100%;
  white-space: nowrap;
}

.compare-board__table {
  display: grid;
  min-width: 720rpx;
}

.compare-board__row {
  display: grid;
  grid-template-columns: 140rpx repeat(3, minmax(0, 1fr));
}

.compare-board__row + .compare-board__row {
  border-top: 1rpx solid var(--app-outline-variant);
}

.compare-board__metric,
.compare-board__cell {
  padding: 20rpx 16rpx;
}

.compare-board__metric {
  color: var(--app-text-muted);
}

.compare-board__cell--candidate {
  cursor: pointer;
}

.compare-board__cell--active {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, rgba(255, 255, 255, 0) 100%);
}

.compare-board__value {
  color: var(--app-text);
}

.compare-board__value--wrap {
  white-space: normal;
}

.progress-rail {
  display: grid;
  gap: 16rpx;
}

.progress-node {
  display: grid;
  grid-template-columns: 28rpx 1fr;
  gap: 16rpx;
  align-items: center;
  padding: 18rpx 22rpx;
  border-radius: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
}

.progress-node--active {
  border-color: rgba(53, 89, 224, 0.22);
  background: linear-gradient(180deg, var(--app-primary-soft) 0%, var(--app-surface) 100%);
}

.progress-node__dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: var(--app-outline);
}

.progress-node--active .progress-node__dot {
  background: var(--app-accent);
  box-shadow: 0 0 0 10rpx rgba(53, 89, 224, 0.12);
}

.request-empty {
  padding: 8rpx 0;
}

.request-bottom-bar {
  padding: 0 32rpx calc(16rpx + env(safe-area-inset-bottom));
}

.request-bottom-bar .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .request-stage__metrics,
  .selected-caregiver__metrics {
    grid-template-columns: 1fr;
  }

  .selected-caregiver__headline {
    flex-direction: column;
  }
}
</style>
