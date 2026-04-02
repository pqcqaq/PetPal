<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已入驻或准备接单的照料者，需要先看服务组合，再决定新建或编辑
 * Entry: 照料者首页、入驻资料保存后、订单稀少时回看报价
 * First screen: 在售数量、停用数量、服务覆盖情况
 * Primary action: 新增服务，或进入独立服务表单页编辑
 * Secondary actions: 快速上下架、回入驻中心
 * States: 未登录、未建档、加载中、空态、列表可用
 */
import type { CaregiverProfileRecord, CaregiverServiceRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getCaregiverProfile, listCaregiverServices, updateCaregiverService } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  formatAmount,
  openPetPalCaregiverServiceFormPage,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  serviceTypeLabels,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalCaregiverServicesPage',
})

definePage({
  style: {
    navigationBarTitleText: '服务管理',
    enablePullDownRefresh: true,
  },
})

type ServiceFilter = 'ACTIVE' | 'INACTIVE' | 'ALL'

const tokenStore = useTokenStore()

const loading = ref(false)
const serviceActionLoadingKey = ref('')
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const serviceFilter = ref<ServiceFilter>('ACTIVE')

const serviceFilterOptions = [
  { label: '在售', value: 'ACTIVE' },
  { label: '全部', value: 'ALL' },
  { label: '停用', value: 'INACTIVE' },
]

const activeServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)
const inactiveServiceCount = computed(() => caregiverServices.value.filter(item => !item.isActive).length)
const coveredCityCount = computed(() => new Set(caregiverServices.value.map(item => item.serviceCity).filter(Boolean)).size)

const filteredServices = computed(() => caregiverServices.value.filter((item) => {
  if (serviceFilter.value === 'ALL') {
    return true
  }
  if (serviceFilter.value === 'INACTIVE') {
    return !item.isActive
  }
  return item.isActive
}))

const summaryCards = computed(() => [
  {
    label: '在售服务',
    value: String(activeServiceCount.value),
    hint: activeServiceCount.value ? '当前可以继续接单' : '先恢复或新增一项',
  },
  {
    label: '停用服务',
    value: String(inactiveServiceCount.value),
    hint: inactiveServiceCount.value ? '可按需恢复' : '暂无停用项',
  },
  {
    label: '覆盖城市',
    value: String(coveredCityCount.value),
    hint: coveredCityCount.value ? '城市信息已形成组合' : '建议至少补一个服务城市',
  },
])

function openCreateForm() {
  openPetPalCaregiverServiceFormPage({
    mode: 'navigate',
    from: PETPAL_CAREGIVER_SERVICES_PAGE,
  })
}

function openEditForm(serviceId: string) {
  openPetPalCaregiverServiceFormPage({
    mode: 'navigate',
    serviceId,
    from: PETPAL_CAREGIVER_SERVICES_PAGE,
  })
}

function openProfile() {
  uni.navigateTo({ url: PETPAL_CAREGIVER_PROFILE_PAGE })
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function toggleService(service: CaregiverServiceRecord) {
  serviceActionLoadingKey.value = `toggle:${service.id}`
  try {
    await updateCaregiverService(service.id, {
      serviceType: service.serviceType,
      petSpecies: service.petSpecies,
      pricePerUnit: Number(service.pricePerUnit),
      unitType: service.unitType,
      minNoticeHours: service.minNoticeHours,
      serviceCity: service.serviceCity || undefined,
      serviceLat: service.serviceLat == null ? undefined : Number(service.serviceLat),
      serviceLng: service.serviceLng == null ? undefined : Number(service.serviceLng),
      availableSlots: service.availableSlots,
      isActive: !service.isActive,
    })
    uni.showToast({
      title: service.isActive ? '已停用' : '已恢复上架',
      icon: 'none',
    })
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '切换服务状态失败'),
      icon: 'none',
    })
  }
  finally {
    serviceActionLoadingKey.value = ''
  }
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    const [profileResult, servicesResult] = await Promise.allSettled([
      getCaregiverProfile(),
      listCaregiverServices(),
    ])
    caregiverProfile.value = profileResult.status === 'fulfilled' ? profileResult.value : null
    caregiverServices.value = servicesResult.status === 'fulfilled' ? servicesResult.value : []
  }
  catch (error: unknown) {
    caregiverProfile.value = null
    caregiverServices.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载服务管理失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
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
  <AppPageShell title="服务管理">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_SERVICES_PAGE"
        title="服务管理"
      />

      <AppSection title="先确认服务盘子">
        <view class="service-list-hero">
          <view class="service-list-hero__copy">
            <view class="service-list-hero__tags">
              <AppTag type="warning">照料者</AppTag>
              <AppTag :type="caregiverProfile ? 'success' : 'warning'">
                {{ caregiverProfile ? '已建档' : '先补入驻资料' }}
              </AppTag>
            </view>
            <text class="service-list-hero__title">列表页只负责查看组合和切换状态</text>
            <text class="service-list-hero__summary">新增和编辑统一进入独立表单页，不再把报价、筛选和大表单堆在一页里。</text>
          </view>
          <view class="service-list-hero__actions">
            <AppButton size="medium" @click="openCreateForm">新增服务</AppButton>
            <AppButton size="medium" type="info" @click="openProfile">入驻资料</AppButton>
          </view>
        </view>

        <view class="service-list-summary">
          <view v-for="item in summaryCards" :key="item.label" class="service-list-summary__card">
            <text class="service-list-summary__label">{{ item.label }}</text>
            <text class="service-list-summary__value">{{ item.value }}</text>
            <text class="service-list-summary__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="服务队列">
        <template v-if="loading">
          <view class="service-list-empty">
            <AppStatus mode="loading" text="正在同步服务管理数据" />
          </view>
        </template>

        <template v-else-if="!caregiverProfile">
          <view class="service-list-empty">
            <AppStatus text="请先完成照料者入驻资料，再继续上架服务。" />
            <AppButton size="medium" type="info" @click="openProfile">去完善资料</AppButton>
          </view>
        </template>

        <template v-else>
          <view class="service-filter-row">
            <AppChoiceChips v-model="serviceFilter" :options="serviceFilterOptions" />
            <AppButton size="medium" type="info" @click="openCreateForm">新建一项</AppButton>
          </view>

          <template v-if="filteredServices.length">
            <view class="service-card-list">
              <view v-for="service in filteredServices" :key="service.id" class="service-card">
                <view class="service-card__head">
                  <view class="service-card__headline">
                    <text class="service-card__title">{{ serviceTypeLabels[service.serviceType] }} · {{ speciesLabels[service.petSpecies] }}</text>
                    <text class="service-card__meta">
                      {{ service.serviceCity || caregiverProfile.serviceCity || '城市待补充' }} · 提前 {{ service.minNoticeHours }} 小时
                    </text>
                  </view>
                  <AppTag :type="service.isActive ? 'success' : 'warning'">
                    {{ service.isActive ? '在售' : '停用' }}
                  </AppTag>
                </view>

                <view class="service-card__grid">
                  <view class="service-card__metric">
                    <text class="service-card__metric-label">报价</text>
                    <text class="service-card__metric-value">¥{{ formatAmount(service.pricePerUnit) }}/{{ service.unitType }}</text>
                  </view>
                  <view class="service-card__metric">
                    <text class="service-card__metric-label">服务城市</text>
                    <text class="service-card__metric-value">{{ service.serviceCity || '待补充' }}</text>
                  </view>
                  <view class="service-card__metric">
                    <text class="service-card__metric-label">状态</text>
                    <text class="service-card__metric-value">{{ service.isActive ? '可接单' : '暂不展示' }}</text>
                  </view>
                </view>

                <view class="service-card__actions">
                  <AppButton size="medium" type="info" @click="openEditForm(service.id)">编辑服务</AppButton>
                  <AppButton
                    size="medium"
                    :type="service.isActive ? 'danger' : 'primary'"
                    :loading="serviceActionLoadingKey === `toggle:${service.id}`"
                    @click="toggleService(service)"
                  >
                    {{ service.isActive ? '停用' : '恢复上架' }}
                  </AppButton>
                </view>
              </view>
            </view>
          </template>

          <template v-else>
            <view class="service-list-empty">
              <AppStatus text="当前筛选下没有服务，直接新增一项即可。" />
              <AppButton size="medium" @click="openCreateForm">新增服务</AppButton>
            </view>
          </template>
        </template>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <view class="service-list-empty">
          <AppStatus text="登录后查看服务组合并进入独立表单页编辑。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.service-list-hero,
.service-list-hero__actions,
.service-list-hero__tags,
.service-card__head,
.service-card__actions,
.service-filter-row {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.service-list-hero {
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
  box-shadow: var(--app-elevation-1);
}

.service-list-hero__copy,
.service-card,
.service-card__headline,
.service-card__metric,
.service-list-empty {
  display: grid;
  gap: 12rpx;
}

.service-list-hero__title,
.service-card__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.16;
  font-weight: 700;
}

.service-list-hero__summary,
.service-list-summary__hint,
.service-card__meta,
.service-card__metric-label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.64;
}

.service-list-summary,
.service-card__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  padding: 18rpx 24rpx 0;
}

.service-list-summary__card,
.service-card,
.service-card__metric {
  padding: 22rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.service-list-summary__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.service-list-summary__value,
.service-card__metric-value {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.18;
  font-weight: 700;
}

.service-filter-row,
.service-card-list,
.service-list-empty {
  padding: 0 24rpx;
}

.service-card-list {
  display: grid;
  gap: 16rpx;
}

.service-card__grid {
  padding: 0;
}

@media (max-width: 680px) {
  .service-list-summary,
  .service-card__grid {
    grid-template-columns: 1fr;
  }
}
</style>
