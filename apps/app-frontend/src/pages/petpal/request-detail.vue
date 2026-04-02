<script setup lang="ts">
import type { MatchedCaregiverRecord, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { listServiceRequests, matchCaregivers } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import {
  buildOwnerMatchQuery,
  describeCaregiverCapability,
  describeCaregiverMatch,
  getErrorMessage,
  helpers,
  openLoginPage,
  PETPAL_CHECKOUT_PAGE,
  PETPAL_REQUEST_PAGE,
  stopPullDown,
  toast,
} from './rebuild/shared'

const tokenStore = useTokenStore()
const loading = ref(false)
const requestId = ref('')
const requestRecord = ref<ServiceRequestRecord | null>(null)
const matchRows = ref<MatchedCaregiverRecord[]>([])
const selectedServiceId = ref('')

const selectedCaregiver = computed(() => matchRows.value.find(item => item.serviceId === selectedServiceId.value) ?? matchRows.value[0] ?? null)
const demandTags = computed(() => helpers.readTagArray(requestRecord.value?.demandTags))

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value || !requestId.value) {
    stopPullDown()
    return
  }

  loading.value = true
  try {
    const requests = await listServiceRequests()
    requestRecord.value = requests.find(item => item.id === requestId.value) ?? null

    if (!requestRecord.value) {
      matchRows.value = []
      return
    }

    const page = await matchCaregivers(buildOwnerMatchQuery({
      petSpecies: requestRecord.value.pet?.species || 'DOG',
      serviceType: requestRecord.value.serviceType,
      city: requestRecord.value.locationText || undefined,
      pageSize: 8,
    }))
    matchRows.value = page.items
    if (!selectedServiceId.value || !matchRows.value.some(item => item.serviceId === selectedServiceId.value)) {
      selectedServiceId.value = matchRows.value[0]?.serviceId || ''
    }
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '加载需求详情失败'))
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

function openCheckout() {
  if (!requestRecord.value || !selectedCaregiver.value) {
    toast('请先选择照料者')
    return
  }
  uni.navigateTo({
    url: `${PETPAL_CHECKOUT_PAGE}?requestId=${requestRecord.value.id}&caregiverServiceId=${selectedCaregiver.value.serviceId}`,
  })
}

function rebuildRequest() {
  uni.redirectTo({ url: `${PETPAL_REQUEST_PAGE}?requestId=${requestId.value}` })
}

onLoad((options) => {
  requestId.value = options?.requestId || ''
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage
    title="需求详情"
    subtitle="先看需求，再决定照料者，最后去支付。"
    eyebrow="Request Detail"
    back
    :back-url="PETPAL_REQUEST_PAGE"
  >
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else-if="!requestRecord && !loading">
      <PetpalSection title="没有找到这条需求">
        <PetpalEmpty title="需求不存在或已失效" description="可以回到新建需求页重新发布一条。">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="rebuildRequest">重新发布</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else-if="requestRecord">
      <PetpalSection tone="accent" title="本次需求" :subtitle="helpers.getRequestStatusLabel(requestRecord.status)">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">服务</text>
            <text class="petpal-stat__value">{{ helpers.serviceTypeLabels[requestRecord.serviceType] }}</text>
            <text class="petpal-stat__meta">{{ requestRecord.pet?.name || '宠物待同步' }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">预算</text>
            <text class="petpal-stat__value">{{ helpers.formatMoney(requestRecord.budgetAmount) }}</text>
            <text class="petpal-stat__meta">{{ helpers.formatRange(requestRecord.startTime, requestRecord.endTime) }}</text>
          </view>
        </view>
        <text class="petpal-paragraph">{{ requestRecord.locationText }}</text>
        <view v-if="demandTags.length" class="petpal-tag-row">
          <text v-for="tag in demandTags" :key="tag" class="petpal-mini-tag">{{ tag }}</text>
        </view>
      </PetpalSection>

      <PetpalSection title="可选照料者" :subtitle="matchRows.length ? `共匹配到 ${matchRows.length} 位` : '当前还没有可比对的照料者'">
        <template v-if="matchRows.length">
          <button
            v-for="item in matchRows"
            :key="item.serviceId"
            class="petpal-row-btn"
            hover-class="none"
            @click="selectedServiceId = item.serviceId"
          >
            <view class="petpal-row__copy">
              <text class="petpal-row__title">
                {{ item.caregiverName }}
                <text v-if="selectedServiceId === item.serviceId" class="petpal-note"> · 已选</text>
              </text>
              <text class="petpal-row__meta">{{ describeCaregiverMatch(item) }}</text>
              <text class="petpal-row__hint">{{ describeCaregiverCapability(item) }}</text>
            </view>
            <text class="petpal-row__value">{{ helpers.formatScore(item.ratingAvg) }}</text>
          </button>
        </template>
        <PetpalEmpty v-else title="还没有照料者可选" description="可以稍后重试，或回到需求页调整时间、预算和地点。">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="rebuildRequest">调整需求</button>
        </PetpalEmpty>
      </PetpalSection>

      <PetpalSection v-if="selectedCaregiver" title="当前准备下单的照料者" subtitle="这里只保留你即将下单的这一位。">
        <view class="petpal-banner">
          <text class="petpal-banner__title">{{ selectedCaregiver.caregiverName }}</text>
          <text class="petpal-banner__meta">{{ describeCaregiverMatch(selectedCaregiver) }}</text>
          <text class="petpal-note">{{ selectedCaregiver.specialtyTags.join(' / ') || '暂无专长标签' }}</text>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openCheckout">确认并去支付</button>
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="rebuildRequest">调整需求</button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
