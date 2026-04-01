<script lang="ts" setup>
import type {
  CaregiverProfileRecord,
  CaregiverServiceRecord,
  PetServiceType,
  PetSpecies,
} from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import { createCaregiverService, getCaregiverProfile, listCaregiverServices, updateCaregiverService } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import CaregiverFlowNav from './components/caregiver-flow-nav.vue'
import {
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  serviceTypeLabels,
  serviceTypeOptions,
  speciesLabels,
  speciesOptions,
  formatAmount,
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

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const caregiverServices = ref<CaregiverServiceRecord[]>([])
const editingServiceId = ref('')

const serviceForm = reactive({
  serviceType: 'BOARDING' as PetServiceType,
  petSpecies: 'DOG' as PetSpecies,
  pricePerUnit: '60',
  unitType: '小时',
  minNoticeHours: '2',
  serviceCity: '',
  isActive: 'YES' as YesNoChoice,
})

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? '在独立页面里维护报价、适配宠物、通知提前量和上架状态。'
    : '登录后即可维护照料服务配置。'
))

const summaryCards = computed(() => [
  {
    label: '服务总数',
    value: String(caregiverServices.value.length),
    hint: caregiverServices.value.length ? '服务越完整，主人越容易筛到你。' : '还没有任何服务配置。',
  },
  {
    label: '已上架',
    value: String(caregiverServices.value.filter(item => item.isActive).length),
    hint: '停用中的服务不会进入主人匹配结果。',
  },
  {
    label: '覆盖城市',
    value: String(new Set(caregiverServices.value.map(item => item.serviceCity).filter(Boolean)).size),
    hint: '跨城市前先确认履约能力与半径设置。',
  },
])

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
      uni.showToast({ title: '服务配置已更新', icon: 'none' })
    }
    else {
      await createCaregiverService(payload)
      uni.showToast({ title: '服务配置已创建', icon: 'none' })
    }

    resetServiceForm()
    await loadPage(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '保存服务配置失败'), icon: 'none' })
  }
  finally {
    saving.value = false
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
  <AppPageShell title="服务管理" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <CaregiverFlowNav
        :current-path="PETPAL_CAREGIVER_SERVICES_PAGE"
        title="照料服务管理"
        description="把价格、适配宠物、响应时效和上架状态拆成独立页面维护，避免在工作台里来回切。"
      />

      <AppSection title="服务概览">
        <view class="caregiver-service-metric-grid">
          <view v-for="item in summaryCards" :key="item.label" class="caregiver-service-metric-card">
            <text class="caregiver-service-metric-card__label">{{ item.label }}</text>
            <text class="caregiver-service-metric-card__value">{{ item.value }}</text>
            <text class="caregiver-service-metric-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="编辑服务" description="服务报价和时效会直接影响主人侧的匹配结果。">
        <view class="caregiver-service-form">
          <view v-if="!caregiverProfile" class="caregiver-service-note">
            <text>建议先完善入驻资料，确保服务城市、服务介绍和资质审核信息完整。</text>
            <AppButton size="medium" type="info" @click="openProfile">先去入驻中心</AppButton>
          </view>

          <view class="caregiver-service-form__group">
            <text class="caregiver-service-form__label">服务类型</text>
            <AppChoiceChips v-model="serviceForm.serviceType" :options="serviceTypeOptions" />
          </view>
          <view class="caregiver-service-form__group">
            <text class="caregiver-service-form__label">适配宠物</text>
            <AppChoiceChips v-model="serviceForm.petSpecies" :options="speciesOptions" />
          </view>

          <AppInput v-model="serviceForm.pricePerUnit" label="报价" placeholder="例如：60" type="digit" />
          <AppInput v-model="serviceForm.unitType" label="计价单位" placeholder="例如：小时 / 次" />
          <AppInput v-model="serviceForm.minNoticeHours" label="最短提前量（小时）" placeholder="例如：2" type="digit" />
          <AppInput v-model="serviceForm.serviceCity" label="服务城市" placeholder="例如：杭州" />

          <view class="caregiver-service-form__group">
            <text class="caregiver-service-form__label">是否上架</text>
            <AppChoiceChips v-model="serviceForm.isActive" :options="yesNoOptions" />
          </view>

          <view class="caregiver-service-action-row">
            <AppButton v-if="editingServiceId" size="medium" type="info" @click="resetServiceForm">取消编辑</AppButton>
            <AppButton size="medium" :loading="saving" @click="saveService">
              {{ editingServiceId ? '更新服务配置' : '新增服务配置' }}
            </AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="已配置服务" description="点击某项可直接带入编辑。">
        <view v-if="caregiverServices.length" class="caregiver-service-list">
          <view v-for="service in caregiverServices" :key="service.id" class="caregiver-service-card" @click="startEditService(service)">
            <view class="caregiver-service-card__header">
              <view class="caregiver-service-card__headline">
                <text class="caregiver-service-card__title">{{ serviceTypeLabels[service.serviceType] }} · {{ speciesLabels[service.petSpecies] }}</text>
                <text class="caregiver-service-card__meta">
                  {{ service.serviceCity || '城市待设置' }} · 提前 {{ service.minNoticeHours }} 小时
                </text>
              </view>
              <AppButton size="medium" type="info">编辑</AppButton>
            </view>
            <text class="caregiver-service-card__meta">¥{{ formatAmount(service.pricePerUnit) }}/{{ service.unitType }}</text>
            <text class="caregiver-service-card__meta">{{ service.isActive ? '已上架' : '已停用' }}</text>
          </view>
        </view>
        <view v-else class="caregiver-service-empty">
          <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loading ? '正在同步服务配置' : '还没有配置任何照料服务'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始管理服务">
        <view class="caregiver-service-empty caregiver-service-empty--login">
          <AppStatus text="登录后即可维护照料服务配置。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.caregiver-service-metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.caregiver-service-metric-card,
.caregiver-service-card,
.caregiver-service-note {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.caregiver-service-metric-card__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.caregiver-service-metric-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.caregiver-service-metric-card__hint,
.caregiver-service-card__meta,
.caregiver-service-note {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.caregiver-service-form,
.caregiver-service-list {
  display: grid;
  gap: 16rpx;
}

.caregiver-service-form__group {
  display: grid;
  gap: 12rpx;
}

.caregiver-service-form__label {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.caregiver-service-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.caregiver-service-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.caregiver-service-card__headline {
  display: grid;
  gap: 6rpx;
}

.caregiver-service-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.caregiver-service-empty {
  padding: 8rpx 0;
}

.caregiver-service-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .caregiver-service-metric-grid {
    grid-template-columns: 1fr;
  }

  .caregiver-service-card__header {
    flex-direction: column;
  }
}
</style>
