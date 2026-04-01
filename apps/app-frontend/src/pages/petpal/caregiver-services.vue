<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录照料者，需要快速上架、修改或停用服务
 * Entry: 首页点击服务配置、审核通过后首次上架、订单稀少时回看服务组合
 * First screen: 先确认当前可售服务和城市覆盖，再就地编辑价格与状态
 * Primary action: 新增服务、更新配置、快速上下架
 * Secondary actions: 去完善入驻资料、切换服务筛选
 * States: 未登录、未建档、无服务、编辑中、保存中、已上架/已停用
 */
import type {
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  PetServiceType,
  PetSpecies,
  UpsertCaregiverServicePayload,
} from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { createCaregiverService, getCaregiverProfile, listCaregiverServices, updateCaregiverService } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  formatAmount,
  serviceTypeLabels,
  serviceTypeOptions,
  speciesLabels,
  speciesOptions,
  yesNoOptions,
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

type YesNoChoice = 'YES' | 'NO'
type ServiceFilter = 'ACTIVE' | 'INACTIVE' | 'ALL'

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const serviceActionLoadingKey = ref('')
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const editingServiceId = ref('')
const serviceFilter = ref<ServiceFilter>('ACTIVE')

const serviceForm = reactive({
  serviceType: 'BOARDING' as PetServiceType,
  petSpecies: 'DOG' as PetSpecies,
  pricePerUnit: '60',
  unitType: '小时',
  minNoticeHours: '2',
  serviceCity: '',
  isActive: 'YES' as YesNoChoice,
})

const activeServiceCount = computed(() => caregiverServices.value.filter(item => item.isActive).length)
const inactiveServiceCount = computed(() => caregiverServices.value.filter(item => !item.isActive).length)
const coveredCityCount = computed(() => new Set(caregiverServices.value.map(item => item.serviceCity).filter(Boolean)).size)
const focusAction = computed(() => {
  if (!caregiverProfile.value) {
    return {
      label: '先补入驻资料',
      hint: '先确认城市、经验和资质，再上架服务更稳妥。',
      action: openProfile,
    }
  }
  if (!caregiverServices.value.length) {
    return {
      label: '新增第一个服务',
      hint: '先放一个可售服务，让主人能开始筛选你。',
      action: resetServiceForm,
    }
  }
  if (!activeServiceCount.value) {
    return {
      label: '恢复可售服务',
      hint: '当前所有服务都处于停用状态，先恢复一个可售项。',
      action: () => {
        serviceFilter.value = 'INACTIVE'
      },
    }
  }
  return {
    label: '继续调价格',
    hint: `${activeServiceCount.value} 个服务在售，可继续调整报价、提前量和覆盖城市。`,
    action: resetServiceForm,
  }
})

const filteredServices = computed(() => caregiverServices.value.filter((item) => {
  if (serviceFilter.value === 'ALL') {
    return true
  }
  if (serviceFilter.value === 'INACTIVE') {
    return !item.isActive
  }
  return item.isActive
}))

const serviceFilterOptions = [
  { label: '在售', value: 'ACTIVE' },
  { label: '全部', value: 'ALL' },
  { label: '停用', value: 'INACTIVE' },
]

function resetServiceForm() {
  editingServiceId.value = ''
  serviceForm.serviceType = 'BOARDING'
  serviceForm.petSpecies = 'DOG'
  serviceForm.pricePerUnit = '60'
  serviceForm.unitType = '小时'
  serviceForm.minNoticeHours = '2'
  serviceForm.serviceCity = caregiverProfile.value?.serviceCity || ''
  serviceForm.isActive = 'YES'
}

function startEditService(service: CaregiverServiceRecord) {
  editingServiceId.value = service.id
  serviceForm.serviceType = service.serviceType
  serviceForm.petSpecies = service.petSpecies
  serviceForm.pricePerUnit = String(service.pricePerUnit)
  serviceForm.unitType = service.unitType
  serviceForm.minNoticeHours = String(service.minNoticeHours)
  serviceForm.serviceCity = service.serviceCity || ''
  serviceForm.isActive = service.isActive ? 'YES' : 'NO'
}

function buildServicePayload(source: CaregiverServiceRecord): UpsertCaregiverServicePayload {
  const serviceLat = source.serviceLat == null ? undefined : Number(source.serviceLat)
  const serviceLng = source.serviceLng == null ? undefined : Number(source.serviceLng)

  return {
    serviceType: source.serviceType,
    petSpecies: source.petSpecies,
    pricePerUnit: Number(source.pricePerUnit),
    unitType: source.unitType,
    minNoticeHours: source.minNoticeHours,
    serviceCity: source.serviceCity || undefined,
    serviceLat: Number.isFinite(serviceLat) ? serviceLat : undefined,
    serviceLng: Number.isFinite(serviceLng) ? serviceLng : undefined,
    availableSlots: source.availableSlots,
    isActive: source.isActive,
  }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openProfile() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_PROFILE_PAGE })
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
    if (!editingServiceId.value && !serviceForm.serviceCity.trim()) {
      serviceForm.serviceCity = caregiverProfile.value?.serviceCity || ''
    }
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载服务管理页失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function saveService() {
  const price = Number(serviceForm.pricePerUnit || 0)
  if (!Number.isFinite(price) || price <= 0) {
    uni.showToast({ title: '请填写有效的服务价格', icon: 'none' })
    return
  }
  if (!serviceForm.unitType.trim()) {
    uni.showToast({ title: '请填写计价单位', icon: 'none' })
    return
  }

  saving.value = true
  try {
    const payload = {
      serviceType: serviceForm.serviceType,
      petSpecies: serviceForm.petSpecies,
      pricePerUnit: price,
      unitType: serviceForm.unitType.trim(),
      minNoticeHours: Number(serviceForm.minNoticeHours || 0) || 0,
      serviceCity: serviceForm.serviceCity.trim() || undefined,
      isActive: serviceForm.isActive === 'YES',
      availableSlots: [],
    }

    if (editingServiceId.value) {
      await updateCaregiverService(editingServiceId.value, payload)
      uni.showToast({ title: '服务已更新', icon: 'none' })
    }
    else {
      await createCaregiverService(payload)
      uni.showToast({ title: '服务已创建', icon: 'none' })
    }

    resetServiceForm()
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '保存服务失败'), icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

async function toggleService(service: CaregiverServiceRecord) {
  const nextActive = !service.isActive
  serviceActionLoadingKey.value = `toggle:${service.id}`
  try {
    await updateCaregiverService(service.id, {
      ...buildServicePayload(service),
      isActive: nextActive,
    })
    uni.showToast({ title: nextActive ? '已恢复上架' : '已停用', icon: 'none' })
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '切换服务状态失败'), icon: 'none' })
  }
  finally {
    serviceActionLoadingKey.value = ''
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

      <AppSection title="先安排这个">
        <view class="caregiver-service-focus">
          <view class="caregiver-service-focus__copy">
            <view class="caregiver-service-focus__tags">
              <AppTag :type="activeServiceCount > 0 ? 'success' : 'default'">
                在售 {{ activeServiceCount }}
              </AppTag>
              <AppTag :type="inactiveServiceCount > 0 ? 'warning' : 'default'">
                停用 {{ inactiveServiceCount }}
              </AppTag>
              <AppTag type="primary">
                覆盖 {{ coveredCityCount }} 城市
              </AppTag>
            </view>
            <text class="caregiver-service-focus__hint">{{ focusAction.hint }}</text>
          </view>
          <view class="caregiver-service-toolbar">
            <AppButton size="medium" @click="focusAction.action">{{ focusAction.label }}</AppButton>
            <AppButton size="medium" type="info" @click="openProfile">入驻资料</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="就地编辑">
        <view class="caregiver-service-form">
          <view v-if="!caregiverProfile" class="caregiver-service-note">
            <text class="caregiver-service-note__text">先把入驻资料补齐，再继续上架服务。</text>
            <AppButton size="medium" type="info" @click="openProfile">去完善</AppButton>
          </view>

          <view class="caregiver-service-form__group">
            <text class="caregiver-service-form__label">服务类型</text>
            <AppChoiceChips v-model="serviceForm.serviceType" :options="serviceTypeOptions" />
          </view>

          <view class="caregiver-service-form__group">
            <text class="caregiver-service-form__label">适配宠物</text>
            <AppChoiceChips v-model="serviceForm.petSpecies" :options="speciesOptions" />
          </view>

          <AppInput v-model="serviceForm.pricePerUnit" label="报价" placeholder="例如 60" type="digit" />
          <AppInput v-model="serviceForm.unitType" label="计价单位" placeholder="例如 小时 / 次" />
          <AppInput v-model="serviceForm.minNoticeHours" label="最短提前量（小时）" placeholder="例如 2" type="digit" />
          <AppInput v-model="serviceForm.serviceCity" label="服务城市" placeholder="例如 杭州" />

          <view class="caregiver-service-form__group">
            <text class="caregiver-service-form__label">是否上架</text>
            <AppChoiceChips v-model="serviceForm.isActive" :options="yesNoOptions" />
          </view>

          <view class="caregiver-service-toolbar">
            <AppButton v-if="editingServiceId" size="medium" type="info" @click="resetServiceForm">取消编辑</AppButton>
            <AppButton size="medium" :loading="saving" @click="saveService">
              {{ editingServiceId ? '更新服务' : '新增服务' }}
            </AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection :title="filteredServices.length ? `服务列表 (${filteredServices.length})` : '服务列表'">
        <view class="caregiver-service-toolbar caregiver-service-toolbar--top">
          <AppChoiceChips v-model="serviceFilter" :options="serviceFilterOptions" />
          <AppButton size="medium" type="info" @click="resetServiceForm">新建一项</AppButton>
        </view>

        <view v-if="filteredServices.length" class="caregiver-service-list">
          <view v-for="service in filteredServices" :key="service.id" class="caregiver-service-card">
            <view class="caregiver-service-card__header">
              <view class="caregiver-service-card__copy">
                <text class="caregiver-service-card__title">{{ serviceTypeLabels[service.serviceType] }} · {{ speciesLabels[service.petSpecies] }}</text>
                <text class="caregiver-service-card__meta">{{ service.serviceCity || '城市待补充' }} · 提前 {{ service.minNoticeHours }} 小时</text>
                <text class="caregiver-service-card__meta">¥{{ formatAmount(service.pricePerUnit) }}/{{ service.unitType }}</text>
              </view>
              <AppTag :type="service.isActive ? 'success' : 'warning'">
                {{ service.isActive ? '在售' : '停用' }}
              </AppTag>
            </view>

            <view class="caregiver-service-toolbar">
              <AppButton size="medium" type="info" @click="startEditService(service)">编辑</AppButton>
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
        <view v-else class="caregiver-service-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步服务配置' : '当前筛选下没有服务'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后管理服务">
        <view class="caregiver-service-empty caregiver-service-empty--login">
          <AppStatus text="登录后即可新增、修改和上下架照料服务。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-service-focus,
.caregiver-service-form,
.caregiver-service-card,
.caregiver-service-note {
  display: grid;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.caregiver-service-focus {
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.16), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.caregiver-service-focus__copy {
  display: grid;
  gap: 12rpx;
}

.caregiver-service-focus__tags,
.caregiver-service-toolbar {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.caregiver-service-focus__hint,
.caregiver-service-card__meta,
.caregiver-service-form__label,
.caregiver-service-note__text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

.caregiver-service-form__group,
.caregiver-service-list {
  display: grid;
  gap: 12rpx;
}

.caregiver-service-card__header {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
}

.caregiver-service-card__copy {
  display: grid;
  gap: 6rpx;
  min-width: 0;
}

.caregiver-service-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.3;
  font-weight: 700;
}

.caregiver-service-empty {
  padding: 8rpx 0;
}

.caregiver-service-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .caregiver-service-card__header {
    flex-direction: column;
  }
}
</style>
