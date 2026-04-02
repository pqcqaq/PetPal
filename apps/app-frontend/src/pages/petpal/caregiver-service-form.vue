<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已决定创建或修改一项服务，只想专注配置报价和上架状态
 * Entry: 服务列表页、入驻资料保存后
 * First screen: 当前是新增还是编辑、服务会影响什么
 * Primary action: 保存服务
 * Secondary actions: 返回服务列表、去完善入驻资料
 * States: 未登录、未建档、加载中、无目标服务、可编辑
 */
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
import AppTag from '@/components/app-tag/app-tag.vue'
import { createCaregiverService, getCaregiverProfile, listCaregiverServices, updateCaregiverService } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  openPetPalAction,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  serviceTypeOptions,
  speciesOptions,
  yesNoOptions,
} from './owner-shared'

defineOptions({
  name: 'PetPalCaregiverServiceFormPage',
})

definePage({
  style: {
    navigationBarTitleText: '服务表单',
    enablePullDownRefresh: true,
  },
})

type YesNoChoice = 'YES' | 'NO'

const tokenStore = useTokenStore()

const loading = ref(false)
const saving = ref(false)
const serviceId = ref('')
const returnTo = ref(PETPAL_CAREGIVER_SERVICES_PAGE)
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)
const currentService = ref<CaregiverServiceRecord | null>(null)

const serviceForm = reactive({
  serviceType: 'BOARDING' as PetServiceType,
  petSpecies: 'DOG' as PetSpecies,
  pricePerUnit: '60',
  unitType: '小时',
  minNoticeHours: '2',
  serviceCity: '',
  isActive: 'YES' as YesNoChoice,
})

const isCreateMode = computed(() => !serviceId.value)
const heroTitle = computed(() => isCreateMode.value ? '新建照料服务' : '编辑照料服务')
const heroSummary = computed(() => isCreateMode.value
  ? '表单页只负责配置一项服务，不再混入列表筛选和上下架动作。'
  : '保存后回到服务清单，继续看整个服务组合。')

function resetForm() {
  currentService.value = null
  serviceForm.serviceType = 'BOARDING'
  serviceForm.petSpecies = 'DOG'
  serviceForm.pricePerUnit = '60'
  serviceForm.unitType = '小时'
  serviceForm.minNoticeHours = '2'
  serviceForm.serviceCity = caregiverProfile.value?.serviceCity || ''
  serviceForm.isActive = 'YES'
}

function applyService(service: CaregiverServiceRecord) {
  currentService.value = service
  serviceForm.serviceType = service.serviceType
  serviceForm.petSpecies = service.petSpecies
  serviceForm.pricePerUnit = String(service.pricePerUnit)
  serviceForm.unitType = service.unitType
  serviceForm.minNoticeHours = String(service.minNoticeHours)
  serviceForm.serviceCity = service.serviceCity || ''
  serviceForm.isActive = service.isActive ? 'YES' : 'NO'
}

function backToList() {
  openPetPalAction('redirect', returnTo.value || PETPAL_CAREGIVER_SERVICES_PAGE)
}

function openProfile() {
  uni.navigateTo({ url: PETPAL_CAREGIVER_PROFILE_PAGE })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    caregiverProfile.value = await getCaregiverProfile()
    if (!serviceId.value) {
      resetForm()
      return
    }

    const services = await listCaregiverServices()
    const targetService = services.find(item => item.id === serviceId.value) ?? null
    if (!targetService) {
      throw new Error('未找到要编辑的服务')
    }
    applyService(targetService)
  }
  catch (error: unknown) {
    currentService.value = null
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载服务表单失败'),
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

    if (serviceId.value) {
      await updateCaregiverService(serviceId.value, payload)
    }
    else {
      await createCaregiverService(payload)
    }

    uni.showToast({
      title: serviceId.value ? '服务已更新' : '服务已创建',
      icon: 'none',
    })
    backToList()
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '保存服务失败'),
      icon: 'none',
    })
  }
  finally {
    saving.value = false
  }
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

onLoad((options: Record<string, string | undefined>) => {
  serviceId.value = options.serviceId || ''
  returnTo.value = options.from || PETPAL_CAREGIVER_SERVICES_PAGE
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
  <AppPageShell title="服务表单">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="当前编辑">
        <view class="service-form-hero">
          <view class="service-form-hero__copy">
            <view class="service-form-hero__tags">
              <AppTag type="warning">照料者</AppTag>
              <AppTag :type="isCreateMode ? 'primary' : 'success'">
                {{ isCreateMode ? '新增' : '编辑' }}
              </AppTag>
            </view>
            <text class="service-form-hero__title">{{ heroTitle }}</text>
            <text class="service-form-hero__summary">{{ heroSummary }}</text>
          </view>
          <view class="service-form-hero__actions">
            <AppButton size="medium" type="info" @click="backToList">返回清单</AppButton>
            <AppButton size="medium" type="info" @click="openProfile">入驻资料</AppButton>
          </view>
        </view>
      </AppSection>

      <template v-if="loading">
        <AppSection title="同步表单">
          <view class="service-form-empty">
            <AppStatus mode="loading" text="正在加载服务表单" />
          </view>
        </AppSection>
      </template>

      <template v-else-if="!caregiverProfile">
        <AppSection title="请先完成入驻">
          <view class="service-form-empty">
            <AppStatus text="没有照料者档案时，无法创建或编辑服务。" />
            <AppButton size="medium" type="info" @click="openProfile">去完善资料</AppButton>
          </view>
        </AppSection>
      </template>

      <template v-else-if="!isCreateMode && !currentService">
        <AppSection title="无法继续编辑">
          <view class="service-form-empty">
            <AppStatus text="没有找到对应服务，请返回清单重新选择。" />
            <AppButton size="medium" type="info" @click="backToList">返回清单</AppButton>
          </view>
        </AppSection>
      </template>

      <template v-else>
        <AppSection title="服务配置">
          <view class="service-form-shell">
            <view class="service-form-group">
              <text class="service-form-label">服务类型</text>
              <AppChoiceChips v-model="serviceForm.serviceType" :options="serviceTypeOptions" />
            </view>

            <view class="service-form-group">
              <text class="service-form-label">适配宠物</text>
              <AppChoiceChips v-model="serviceForm.petSpecies" :options="speciesOptions" />
            </view>

            <AppInput v-model="serviceForm.pricePerUnit" label="报价" placeholder="例如 60" type="digit" />
            <AppInput v-model="serviceForm.unitType" label="计价单位" placeholder="例如 小时 / 次" />
            <AppInput v-model="serviceForm.minNoticeHours" label="最短提前量（小时）" placeholder="例如 2" type="digit" />
            <AppInput
              v-model="serviceForm.serviceCity"
              label="服务城市"
              :placeholder="caregiverProfile.serviceCity || '例如 杭州'"
            />

            <view class="service-form-group">
              <text class="service-form-label">是否上架</text>
              <AppChoiceChips v-model="serviceForm.isActive" :options="yesNoOptions" />
            </view>
          </view>
        </AppSection>

        <view class="service-form-actions">
          <AppButton block size="large" type="info" @click="backToList">取消</AppButton>
          <AppButton block size="large" :loading="saving" @click="saveService">
            {{ isCreateMode ? '保存服务' : '保存修改' }}
          </AppButton>
        </view>
      </template>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <view class="service-form-empty">
          <AppStatus text="登录后新增或编辑照料服务。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.service-form-hero,
.service-form-hero__actions,
.service-form-hero__tags,
.service-form-actions {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.service-form-hero {
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.18), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
  box-shadow: var(--app-elevation-1);
}

.service-form-hero__copy,
.service-form-shell,
.service-form-group,
.service-form-empty {
  display: grid;
  gap: 14rpx;
}

.service-form-hero__title {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.16;
  font-weight: 700;
}

.service-form-hero__summary,
.service-form-label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.64;
}

.service-form-actions {
  padding: 0 32rpx 12rpx;
}

.service-form-actions .app-button + .app-button {
  margin-top: 16rpx;
}
</style>
