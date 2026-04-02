<script setup lang="ts">
import type { PetProfileRecord } from '@rbac/api-common'
import { ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { listPets } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import { describePet, describePetCare, openLoginPage, openPetPalPetFormPage, PETPAL_OWNER_HOME_PAGE, PETPAL_REQUEST_PAGE, stopPullDown } from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    pets.value = await listPets()
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openCreate() {
  openPetPalPetFormPage({ from: 'pets' })
}

function openEdit(id: string) {
  openPetPalPetFormPage({ petId: id, from: 'pets' })
}

function openRequestFlow(id?: string) {
  const suffix = id ? `?petId=${id}` : ''
  uni.navigateTo({ url: `${PETPAL_REQUEST_PAGE}${suffix}` })
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage
    title="宠物档案"
    subtitle="档案维护和需求发起分开处理，每只宠物都是独立入口。"
    eyebrow="Pets"
    back
    :back-url="PETPAL_OWNER_HOME_PAGE"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看宠物档案">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="你的宠物档案库" :subtitle="pets.length ? `当前共 ${pets.length} 只` : '先建立第一只宠物档案'">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreate">新增宠物</button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openRequestFlow()">直接新建需求</button>
        </view>
      </PetpalSection>

      <PetpalSection title="全部宠物" subtitle="每只宠物都单独维护资料，再单独发起需求。">
        <template v-if="pets.length">
          <view v-for="pet in pets" :key="pet.id" class="petpal-sheet">
            <text class="petpal-banner__eyebrow">Pet Profile</text>
            <text class="petpal-banner__title">{{ pet.name }}</text>
            <text class="petpal-banner__meta">{{ describePet(pet) }}</text>
            <text class="petpal-note">{{ describePetCare(pet) }}</text>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openEdit(pet.id)">编辑资料</button>
              <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="openRequestFlow(pet.id)">为它新建需求</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="还没有宠物" description="先创建一只宠物，再继续新建需求和下单。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCreate">创建宠物</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
