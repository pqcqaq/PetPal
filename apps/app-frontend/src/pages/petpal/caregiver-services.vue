<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverServiceRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getCaregiverProfile, listCaregiverServices } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { formatSlotSummary, helpers, openLoginPage, openPetPalCaregiverServiceFormPage, PETPAL_CAREGIVER_HOME_PAGE, PETPAL_CAREGIVER_PROFILE_PAGE, stopPullDown } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const profile = ref<CaregiverProfileRecord | null>(null)
const services = ref<CaregiverServiceRecord[]>([])

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    return
  }
  loading.value = true
  try {
    const [profileResult, servicesResult] = await Promise.allSettled([
      getCaregiverProfile(),
      listCaregiverServices(),
    ])
    profile.value = profileResult.status === 'fulfilled' ? profileResult.value : null
    services.value = servicesResult.status === 'fulfilled' ? servicesResult.value : []
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openCreate() {
  openPetPalCaregiverServiceFormPage({ from: 'services' })
}

function openEdit(id: string) {
  openPetPalCaregiverServiceFormPage({ serviceId: id, from: 'services' })
}

function openProfile() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_PROFILE_PAGE })
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="服务管理" subtitle="服务列表只看状态，编辑和上架动作进入独立表单页。" eyebrow="Services" back :back-url="PETPAL_CAREGIVER_HOME_PAGE">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="!profile">
      <PetpalSection title="先建立照料者档案">
        <PetpalEmpty title="没有档案时不能稳定上架服务" description="先去入驻中心补齐城市、介绍和资质。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openProfile">去完善档案</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="先维护在售服务" :subtitle="profile ? helpers.getCaregiverAuditLabel(profile.auditStatus) : '照料者资料同步中'">
        <view class="petpal-stat-row">
          <view class="petpal-stat">
            <text class="petpal-stat__label">服务总数</text>
            <text class="petpal-stat__value">{{ services.length }}</text>
            <text class="petpal-stat__meta">已创建</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">上架中</text>
            <text class="petpal-stat__value">{{ services.filter(item => item.isActive).length }}</text>
            <text class="petpal-stat__meta">主人端可见</text>
          </view>
        </view>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreate">新增服务</button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openProfile">查看档案</button>
        </view>
      </PetpalSection>

      <PetpalSection title="服务列表" :subtitle="services.length ? '每项服务都是独立入口，不在列表里混编辑字段。' : '先上架第一个服务'">
        <template v-if="services.length">
          <view v-for="item in services" :key="item.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">{{ item.isActive ? 'Live Service' : 'Offline Service' }}</text>
            <text class="petpal-banner__title">{{ helpers.serviceTypeLabels[item.serviceType] }} · {{ helpers.speciesLabels[item.petSpecies] }}</text>
            <text class="petpal-banner__meta">{{ helpers.formatMoney(item.pricePerUnit) }} / {{ item.unitType }}</text>
            <text class="petpal-note">{{ item.serviceCity || '城市待补' }} · {{ item.minNoticeHours }} 小时前预约</text>
            <view class="petpal-tag-row">
              <text :class="['petpal-pill', item.isActive ? 'petpal-pill--success' : 'petpal-pill--warning']">{{ item.isActive ? '上架中' : '已下架' }}</text>
              <text class="petpal-pill">{{ formatSlotSummary(item.availableSlots) }}</text>
            </view>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openEdit(item.id)">编辑服务</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="还没有服务" description="上架一个清晰的服务，主人端才会有匹配入口。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreate">创建服务</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
