<script setup lang="ts">
import type { CaregiverProfileRecord, CaregiverServiceRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { getCaregiverProfile, listCaregiverServices } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { helpers, openLoginPage, openPetPalCaregiverServiceFormPage, PETPAL_CAREGIVER_HOME_PAGE, PETPAL_CAREGIVER_PROFILE_PAGE } from './rebuild/shared'

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
    uni.stopPullDownRefresh()
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
  <PetpalPage title="服务管理" subtitle="服务清单和服务编辑彻底拆开，列表只负责查看状态。" eyebrow="Services" back :back-url="PETPAL_CAREGIVER_HOME_PAGE">
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
      <PetpalSection title="服务列表" :subtitle="services.length ? `共 ${services.length} 个服务` : '先上架第一个服务'">
        <template #trailing>
          <button class="petpal-icon-btn" hover-class="none" @click="openCreate">新增</button>
        </template>
        <template v-if="services.length">
          <button
            v-for="item in services"
            :key="item.id"
            class="petpal-row-btn"
            hover-class="none"
            @click="openEdit(item.id)"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">{{ helpers.serviceTypeLabels[item.serviceType] }} · {{ helpers.speciesLabels[item.petSpecies] }}</text>
              <text class="petpal-row__meta">{{ helpers.formatMoney(item.pricePerUnit) }} / {{ item.unitType }}</text>
              <text class="petpal-row__hint">{{ item.serviceCity || '城市待补' }} · {{ item.minNoticeHours }} 小时前预约</text>
            </view>
            <text class="petpal-row__value">{{ item.isActive ? '上架中' : '已下架' }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="还没有服务" description="上架一个清晰的服务，主人端才会有匹配入口。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreate">创建服务</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
