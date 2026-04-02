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
    subtitle="查看和编辑单独拆开，需求创建也从这里单独进入。"
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
      <PetpalSection title="全部宠物" :subtitle="pets.length ? `共 ${pets.length} 只` : '先建立第一只宠物档案'">
        <template #trailing>
          <button class="petpal-icon-btn" hover-class="none" @click="openCreate">新增</button>
        </template>
        <template v-if="pets.length">
          <view v-for="pet in pets" :key="pet.id" class="petpal-stack" style="gap: 0;">
            <button class="petpal-row-btn" hover-class="none" @click="openEdit(pet.id)">
              <view class="petpal-row__copy">
                <text class="petpal-row__title">{{ pet.name }}</text>
                <text class="petpal-row__meta">{{ describePet(pet) }}</text>
                <text class="petpal-row__hint">{{ describePetCare(pet) }}</text>
              </view>
              <text class="petpal-row__value">编辑</text>
            </button>
            <view class="petpal-action-row" style="padding-top: 12rpx;">
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
