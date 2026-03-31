<script lang="ts" setup>
import type {
  MatchCaregiverQuery,
  MatchedCaregiverRecord,
  OrderRecord,
  PetServiceType,
  PetProfileRecord,
  PetSpecies,
  ServiceRequestRecord,
} from '@rbac/api-common'
import dayjs from 'dayjs'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import {
  createPet,
  createServiceRequest,
  listOrders,
  listPets,
  listServiceRequests,
  matchCaregivers,
} from '@/api/petpal'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'PetPalPage',
})

definePage({
  style: {
    navigationBarTitleText: 'PetPal 服务台',
    enablePullDownRefresh: true,
  },
})

const loading = ref(false)
const creatingPet = ref(false)
const creatingRequest = ref(false)

const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregivers = ref<MatchedCaregiverRecord[]>([])

const petForm = reactive({
  name: '',
  species: 'DOG' as PetSpecies,
  breed: '',
  weightKg: '5',
})

const requestForm = reactive({
  petId: '',
  serviceType: 'BOARDING' as PetServiceType,
  locationText: '',
  budgetAmount: '200',
})

const matchQuery = reactive<MatchCaregiverQuery>({
  serviceType: 'BOARDING',
  petSpecies: 'DOG',
  page: 1,
  pageSize: 10,
})

const loadingText = computed(() => loading.value ? '正在加载数据' : '')

const formatTime = (value: string) => dayjs(value).format('MM-DD HH:mm')
const formatAmount = (value: number | string) => typeof value === 'number' ? value.toFixed(2) : value

function ensurePetSelection() {
  if (!requestForm.petId && pets.value.length) {
    requestForm.petId = pets.value[0].id
  }
}

async function reloadAll(showError = true) {
  if (loading.value) {
    return
  }

  loading.value = true
  try {
    const [petRows, requestRows, orderRows, matchedPage] = await Promise.all([
      listPets(),
      listServiceRequests(),
      listOrders(),
      matchCaregivers(matchQuery),
    ])

    pets.value = petRows
    requests.value = requestRows
    orders.value = orderRows
    caregivers.value = matchedPage.items
    ensurePetSelection()
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载宠托帮数据失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function submitPet() {
  if (!petForm.name.trim()) {
    uni.showToast({ title: '请填写宠物名称', icon: 'none' })
    return
  }

  creatingPet.value = true
  try {
    await createPet({
      name: petForm.name.trim(),
      species: petForm.species,
      breed: petForm.breed.trim() || undefined,
      weightKg: Number(petForm.weightKg || 0) || undefined,
    })
    petForm.name = ''
    petForm.breed = ''
    uni.showToast({ title: '宠物已添加', icon: 'none' })
    await reloadAll(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '添加宠物失败'), icon: 'none' })
  }
  finally {
    creatingPet.value = false
  }
}

async function submitRequest() {
  if (!requestForm.petId) {
    uni.showToast({ title: '请先选择宠物', icon: 'none' })
    return
  }
  if (!requestForm.locationText.trim()) {
    uni.showToast({ title: '请填写服务地点', icon: 'none' })
    return
  }

  creatingRequest.value = true
  try {
    const startTime = dayjs().add(1, 'day').hour(10).minute(0).second(0).millisecond(0)
    const endTime = startTime.add(1, 'day').hour(18)
    await createServiceRequest({
      petId: requestForm.petId,
      serviceType: requestForm.serviceType,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      locationText: requestForm.locationText.trim(),
      budgetAmount: Number(requestForm.budgetAmount || 0) || undefined,
      demandTags: [],
    })
    uni.showToast({ title: '需求已发布', icon: 'none' })
    await reloadAll(false)
  }
  catch (error: unknown) {
    uni.showToast({ title: getErrorMessage(error, '发布需求失败'), icon: 'none' })
  }
  finally {
    creatingRequest.value = false
  }
}

function pickPet(id: string) {
  requestForm.petId = id
}

function goToOrderDetail(orderId: string) {
  uni.navigateTo({ url: `/pages/order-detail/index?id=${orderId}` })
}

onLoad(() => {
  void reloadAll(false)
})

onPullDownRefresh(() => {
  void reloadAll(true)
})
</script>

<template>
  <AppPageShell title="PetPal 服务台" description="发布需求、维护宠物档案、匹配照料者并持续跟进订单。">
    <AppSection title="数据状态">
      <AppStatus :mode="loading ? 'loading' : 'empty'" :text="loadingText || '数据已同步'" />
    </AppSection>

    <AppSection title="新增宠物" description="先维护宠物档案，再发布照料需求。">
      <view class="petpal-form">
        <AppInput v-model="petForm.name" label="宠物名称" placeholder="例如：可乐" />
        <picker :range="['DOG', 'CAT', 'OTHER']" :value="['DOG', 'CAT', 'OTHER'].indexOf(petForm.species)" @change="petForm.species = (['DOG', 'CAT', 'OTHER'][$event.detail.value] as 'DOG' | 'CAT' | 'OTHER')">
          <view class="petpal-picker">物种：{{ petForm.species }}</view>
        </picker>
        <AppInput v-model="petForm.breed" label="品种" placeholder="可选" />
        <AppInput v-model="petForm.weightKg" label="体重(kg)" placeholder="例如：5" />
        <AppButton :loading="creatingPet" @click="submitPet">保存宠物</AppButton>
      </view>
    </AppSection>

    <AppSection title="我的宠物">
      <AppList v-if="pets.length">
        <AppListItem
          v-for="pet in pets"
          :key="pet.id"
          :title="`${pet.name} (${pet.species})`"
          :label="`品种：${pet.breed || '未填写'}`"
          :value="`体重 ${pet.weightKg || '-'}kg`"
          clickable
          @click="pickPet(pet.id)"
        />
      </AppList>
      <AppStatus v-else text="暂无宠物档案" />
    </AppSection>

    <AppSection title="发布需求" description="发布后可在下方查看匹配与订单进展。">
      <view class="petpal-form">
        <picker :range="pets.map(p => p.name)" :value="Math.max(0, pets.findIndex(p => p.id === requestForm.petId))" @change="pickPet(pets[$event.detail.value]?.id || '')">
          <view class="petpal-picker">宠物：{{ pets.find(p => p.id === requestForm.petId)?.name || '请选择' }}</view>
        </picker>
        <picker :range="['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT']" :value="['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT'].indexOf(requestForm.serviceType)" @change="requestForm.serviceType = (['BOARDING', 'WALKING', 'FEEDING', 'DOOR_VISIT'][$event.detail.value] as 'BOARDING' | 'WALKING' | 'FEEDING' | 'DOOR_VISIT')">
          <view class="petpal-picker">服务：{{ requestForm.serviceType }}</view>
        </picker>
        <AppInput v-model="requestForm.locationText" label="服务地点" placeholder="例如：上海市静安区" />
        <AppInput v-model="requestForm.budgetAmount" label="预算(元)" placeholder="例如：200" />
        <AppButton :loading="creatingRequest" @click="submitRequest">发布需求</AppButton>
      </view>
    </AppSection>

    <AppSection title="需求列表">
      <AppList v-if="requests.length">
        <AppListItem
          v-for="item in requests"
          :key="item.id"
          :title="`${item.pet?.name || '宠物'} · ${item.serviceType}`"
          :label="`${item.status} · ${item.locationText}`"
          :value="formatTime(item.startTime)"
        />
      </AppList>
      <AppStatus v-else text="暂无需求" />
    </AppSection>

    <AppSection title="订单总览">
      <AppList v-if="orders.length">
        <AppListItem
          v-for="order in orders"
          :key="order.id"
          :title="order.orderNo"
          :label="`状态：${order.orderStatus}`"
          :value="`实付 ${formatAmount(order.amountPaid)} / 已退 ${formatAmount(order.amountRefunded)}`"
          is-link
          @click="() => goToOrderDetail(order.id)"
        />
      </AppList>
      <AppStatus v-else text="暂无订单" />
    </AppSection>

    <AppSection title="照料者匹配">
      <AppList v-if="caregivers.length">
        <AppListItem
          v-for="caregiver in caregivers"
          :key="caregiver.serviceId"
          :title="caregiver.caregiverName"
          :label="`${caregiver.city || '未知城市'} · 评分 ${caregiver.ratingAvg}`"
          :value="`${formatAmount(caregiver.pricePerUnit)} / ${caregiver.unitType}`"
        />
      </AppList>
      <AppStatus v-else text="暂无匹配结果" />
    </AppSection>
  </AppPageShell>
</template>

<style scoped lang="scss">
.petpal-form {
  display: grid;
  gap: 16rpx;
}

.petpal-picker {
  min-height: 80rpx;
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  border-radius: 20rpx;
  background: #fff;
  color: #111827;
  border: 2rpx solid #e5e7eb;
}
</style>
