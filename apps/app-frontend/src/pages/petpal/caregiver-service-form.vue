<script setup lang="ts">
import type { CaregiverServiceRecord } from '@rbac/api-common'
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createCaregiverService, listCaregiverServices, updateCaregiverService } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { getErrorMessage, helpers, openLoginPage, PETPAL_CAREGIVER_SERVICES_PAGE, serviceTypeOptions, speciesOptions, splitTagText, toast, yesNoOptions } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const saving = ref(false)
const serviceId = ref('')
const pageTitle = computed(() => (serviceId.value ? '编辑服务' : '新建服务'))

const form = reactive({
  serviceType: 'BOARDING',
  petSpecies: 'DOG',
  pricePerUnit: '',
  unitType: '',
  minNoticeHours: '2',
  serviceCity: '',
  availableSlotsText: '',
  isActive: 'YES',
})

function hydrateForm(service: CaregiverServiceRecord | null) {
  form.serviceType = service?.serviceType || 'BOARDING'
  form.petSpecies = service?.petSpecies || 'DOG'
  form.pricePerUnit = service?.pricePerUnit ? String(service.pricePerUnit) : ''
  form.unitType = service?.unitType || ''
  form.minNoticeHours = service ? String(service.minNoticeHours) : '2'
  form.serviceCity = service?.serviceCity || ''
  form.availableSlotsText = helpers.readTagArray(service?.availableSlots).join('，')
  form.isActive = service?.isActive ? 'YES' : 'NO'
}

async function loadDetail() {
  if (!tokenStore.hasLogin || !serviceId.value || loading.value) {
    return
  }
  loading.value = true
  try {
    const services = await listCaregiverServices()
    hydrateForm(services.find(item => item.id === serviceId.value) ?? null)
  }
  finally {
    loading.value = false
  }
}

async function saveService() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }
  if (!form.pricePerUnit || !form.unitType.trim()) {
    toast('请补齐价格和计费单位')
    return
  }

  saving.value = true
  try {
    const payload = {
      serviceType: form.serviceType as 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT',
      petSpecies: form.petSpecies as 'DOG' | 'CAT' | 'OTHER',
      pricePerUnit: Number(form.pricePerUnit || 0),
      unitType: form.unitType.trim(),
      minNoticeHours: Number(form.minNoticeHours || 0),
      serviceCity: form.serviceCity.trim() || undefined,
      availableSlots: splitTagText(form.availableSlotsText),
      isActive: form.isActive === 'YES',
    }

    if (serviceId.value) {
      await updateCaregiverService(serviceId.value, payload)
    }
    else {
      await createCaregiverService(payload)
    }

    toast(serviceId.value ? '服务已更新' : '服务已创建', 'success')
    backToList()
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '保存服务失败'))
  }
  finally {
    saving.value = false
  }
}

function backToList() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_SERVICES_PAGE })
}

onLoad((options) => {
  serviceId.value = options?.serviceId || ''
  if (serviceId.value) {
    void loadDetail()
  }
})
</script>

<template>
  <PetpalPage :title="pageTitle" subtitle="服务编辑只负责价格、范围和上架状态。" eyebrow="Service Form" back :back-url="PETPAL_CAREGIVER_SERVICES_PAGE">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection title="服务类型">
        <view class="petpal-field">
          <text class="petpal-field__label">服务类型</text>
          <view class="petpal-chip-row">
            <button
              v-for="item in serviceTypeOptions"
              :key="item.value"
              :class="['petpal-chip', form.serviceType === item.value ? 'petpal-chip--active' : '']"
              hover-class="none"
              @click="form.serviceType = item.value"
            >
              {{ item.label }}
            </button>
          </view>
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">适用宠物</text>
          <view class="petpal-chip-row">
            <button
              v-for="item in speciesOptions"
              :key="item.value"
              :class="['petpal-chip', form.petSpecies === item.value ? 'petpal-chip--active' : '']"
              hover-class="none"
              @click="form.petSpecies = item.value"
            >
              {{ item.label }}
            </button>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="价格和时效">
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">价格</text>
            <input v-model="form.pricePerUnit" class="petpal-input" type="digit" placeholder="例如 120" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">计费单位</text>
            <input v-model="form.unitType" class="petpal-input" :maxlength="20" placeholder="例如 次 / 天 / 小时" />
          </view>
        </view>
        <view class="petpal-grid--two">
          <view class="petpal-field">
            <text class="petpal-field__label">最短预约提前量</text>
            <input v-model="form.minNoticeHours" class="petpal-input" type="digit" placeholder="例如 2" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">服务城市</text>
            <input v-model="form.serviceCity" class="petpal-input" :maxlength="20" placeholder="例如 杭州" />
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="可接时段与状态">
        <view class="petpal-field">
          <text class="petpal-field__label">可接时段</text>
          <input v-model="form.availableSlotsText" class="petpal-input" placeholder="例如 工作日白天、周末全天、节假日可约" />
        </view>
        <view class="petpal-field">
          <text class="petpal-field__label">是否上架</text>
          <view class="petpal-chip-row">
            <button
              v-for="item in yesNoOptions"
              :key="item.value"
              :class="['petpal-chip', form.isActive === item.value ? 'petpal-chip--active' : '']"
              hover-class="none"
              @click="form.isActive = item.value"
            >
              {{ item.label }}
            </button>
          </view>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="saveService">
            {{ saving ? '保存中...' : (serviceId ? '保存修改' : '创建服务') }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
