<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已经发布过需求、现在要继续推进匹配或下单的主人
 * Entry: 从主人首页的最近需求、发布成功后的回流、提醒中心中的活跃需求进入
 * First screen: 先看到当前需求状态、服务安排和能否继续下单
 * Primary action: 选择一位照料者并继续结算，或在没有匹配时刷新推荐
 * Secondary actions: 复制当前条件重建一单、返回新建需求、查看安排摘要
 * States: 未登录、参数缺失、需求不存在、匹配为空、已匹配可下单、需求已关闭
 */
import type { MatchedCaregiverRecord, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
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
  formatDateTime,
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

const tokenStore = useTokenStore()

const requestId = ref('')
const loading = ref(false)
const matchesLoading = ref(false)
const error = ref('')

const requestRecord = ref<ServiceRequestRecord | null>(null)
const matchItems = ref<MatchedCaregiverRecord[]>([])
const selectedServiceId = ref('')
const activePanel = ref<RequestDetailPanel>('MATCHES')

const panelOptions = [
  { label: '匹配', value: 'MATCHES' },
  { label: '安排', value: 'PLAN' },
  { label: '进度', value: 'STATE' },
]

const selectedCaregiver = computed(() => {
  if (!matchItems.value.length) {
    return null
  }
  return matchItems.value.find(item => item.serviceId === selectedServiceId.value)
    ?? matchItems.value.find(item => item.caregiverId === requestRecord.value?.matchedCaregiverId)
    ?? matchItems.value[0]
    ?? null
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
      tone: 'default',
    },
    {
      label: '匹配',
      value: `${matchItems.value.length} 人`,
      tone: matchItems.value.length ? 'success' : 'default',
    },
    {
      label: '更新',
      value: formatDateTime(request.updatedAt),
      tone: 'default',
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
      value: `${Math.max(1, Math.ceil(Math.max(0, new Date(request.endTime).getTime() - new Date(request.startTime).getTime()) / (1000 * 60 * 60)))} 小时`,
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

const progressSteps = computed(() => {
  const request = requestRecord.value
  const matched = Boolean(matchItems.value.length || request?.matchedCaregiverId)
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
    return '复制条件新建'
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

  if (selectedServiceId.value && matchItems.value.some(item => item.serviceId === selectedServiceId.value)) {
    return
  }

  const matchedService = matchItems.value.find(item => item.caregiverId === requestRecord.value?.matchedCaregiverId)
  selectedServiceId.value = matchedService?.serviceId || matchItems.value[0].serviceId
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

        <AppSection v-if="activePanel === 'MATCHES'" :title="matchItems.length ? `匹配照料者 (${matchItems.length})` : '匹配照料者'">
          <view class="request-toolbar">
            <AppButton size="medium" type="info" :loading="matchesLoading" @click="loadMatches(true, true)">刷新推荐</AppButton>
            <AppButton size="medium" type="info" @click="duplicateRequest">复制条件</AppButton>
          </view>

          <view v-if="selectedCaregiver" class="selected-caregiver">
            <view class="selected-caregiver__copy">
              <view class="selected-caregiver__tags">
                <AppTag type="success">当前选中</AppTag>
                <AppTag type="default">{{ selectedCaregiver.city || '城市待补充' }}</AppTag>
              </view>
              <text class="selected-caregiver__title">{{ selectedCaregiver.caregiverName }}</text>
              <text class="selected-caregiver__meta">
                评分 {{ formatAmount(selectedCaregiver.ratingAvg) }} · {{ selectedCaregiver.ratingCount }} 条评价
              </text>
            </view>
            <AppTag type="primary">¥{{ formatAmount(selectedCaregiver.pricePerUnit) }}/{{ selectedCaregiver.unitType }}</AppTag>
          </view>

          <view v-if="matchItems.length" class="match-grid">
            <view
              v-for="item in matchItems"
              :key="item.serviceId"
              class="match-tile"
              :class="selectedServiceId === item.serviceId ? 'match-tile--active' : ''"
              @click="selectedServiceId = item.serviceId"
            >
              <view class="match-tile__top">
                <view class="match-tile__copy">
                  <text class="match-tile__title">{{ item.caregiverName }}</text>
                  <text class="match-tile__meta">{{ item.city || '城市待补充' }}</text>
                </view>
                <AppTag :type="selectedServiceId === item.serviceId ? 'success' : 'default'">
                  {{ selectedServiceId === item.serviceId ? '已选' : '可选' }}
                </AppTag>
              </view>
              <view class="match-tile__bottom">
                <text class="match-tile__price">¥{{ formatAmount(item.pricePerUnit) }}/{{ item.unitType }}</text>
                <text class="match-tile__score">评分 {{ formatAmount(item.ratingAvg) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="request-empty">
            <AppStatus :mode="matchesLoading ? 'loading' : 'empty'" :text="matchesLoading ? '正在刷新匹配' : '当前没有可用照料者'" />
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
            <AppButton size="medium" type="info" @click="duplicateRequest">复制条件</AppButton>
            <AppButton size="medium" @click="openNewRequest">新建需求</AppButton>
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

          <view class="request-toolbar">
            <AppButton size="medium" type="info" :loading="matchesLoading" @click="loadMatches(true, true)">刷新匹配</AppButton>
            <AppButton size="medium" type="info" @click="duplicateRequest">复制条件</AppButton>
            <AppButton size="medium" @click="handlePrimaryAction">{{ primaryActionLabel }}</AppButton>
          </view>
        </AppSection>

        <view class="request-bottom-bar">
          <AppButton block size="large" :loading="matchesLoading" @click="handlePrimaryAction">
            {{ primaryActionLabel }}
          </AppButton>
          <AppButton block size="large" type="info" @click="openNewRequest">新建需求</AppButton>
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
.selected-caregiver,
.match-tile,
.request-stage__metric {
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

.request-stage__copy {
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
.selected-caregiver__title,
.match-tile__title {
  color: var(--app-text);
  font-size: 32rpx;
  line-height: 1.25;
  font-weight: 700;
}

.request-stage__meta,
.selected-caregiver__meta,
.match-tile__meta,
.request-stage__metric-label,
.progress-node__label,
.match-tile__score {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.request-stage__metrics,
.match-grid {
  display: grid;
  gap: 16rpx;
}

.request-stage__metrics {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.request-stage__metric {
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
}

.request-stage__metric-value,
.match-tile__price {
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

.selected-caregiver__copy {
  display: grid;
  gap: 10rpx;
}

.match-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.match-tile {
  padding: 22rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.match-tile--active {
  border-color: rgba(15, 118, 110, 0.24);
  background:
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.12), transparent 30%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-2);
  transform: translateY(-2rpx);
}

.match-tile__top,
.match-tile__bottom {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.match-tile__copy {
  display: grid;
  gap: 8rpx;
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
  .match-grid {
    grid-template-columns: 1fr;
  }

  .match-tile__top,
  .match-tile__bottom {
    flex-direction: column;
  }
}
</style>
