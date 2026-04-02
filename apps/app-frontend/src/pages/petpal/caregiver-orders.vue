<script setup lang="ts">
import type { CaregiverOrderRecord, OrderStatus } from '@rbac/api-common'
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { acceptCaregiverOrder, checkInCaregiverOrder, checkOutCaregiverOrder, listCaregiverOrders } from '@/api/petpal'
import { useTokenStore } from '@/store'
import PetpalEmpty from './rebuild/petpal-empty.vue'
import PetpalPage from './rebuild/petpal-page.vue'
import PetpalSection from './rebuild/petpal-section.vue'
import PetpalSegmented from './rebuild/petpal-segmented.vue'
import { getErrorMessage, openLoginPage, openOrderDetailPage, stopPullDown, toast } from './rebuild/shared'

type FilterValue = OrderStatus | 'ALL'

const tokenStore = useTokenStore()
const loading = ref(false)
const actionLoading = ref(false)
const filter = ref<FilterValue>('ALL')
const orders = ref<CaregiverOrderRecord[]>([])

const visibleOrders = computed(() => {
  return orders.value.filter(item => filter.value === 'ALL' || item.orderStatus === filter.value)
})

async function loadPage() {
  if (!tokenStore.hasLogin || loading.value) {
    stopPullDown()
    return
  }
  loading.value = true
  try {
    const page = await listCaregiverOrders({ page: 1, pageSize: 40 })
    orders.value = page.items
  }
  finally {
    loading.value = false
    stopPullDown()
  }
}

async function runAction(task: () => Promise<void>, successText: string) {
  if (actionLoading.value) {
    return
  }
  actionLoading.value = true
  try {
    await task()
    toast(successText, 'success')
    await loadPage()
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '操作失败'))
  }
  finally {
    actionLoading.value = false
  }
}

onShow(() => {
  void loadPage()
})

onPullDownRefresh(() => {
  void loadPage()
})
</script>

<template>
  <PetpalPage title="履约订单" subtitle="队列只处理下一步动作，详细服务记录进入订单详情页。" eyebrow="Caregiver Orders" back :back-url="'/pages/petpal/caregiver-home'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <PetpalEmpty title="登录后查看履约订单">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
        </PetpalEmpty>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection title="订单筛选">
        <PetpalSegmented
          v-model="filter"
          :options="[
            { label: '全部', value: 'ALL', badge: orders.length },
            { label: '待接单', value: 'PENDING_ACCEPT', badge: orders.filter(item => item.orderStatus === 'PENDING_ACCEPT').length },
            { label: '已接单', value: 'ACCEPTED', badge: orders.filter(item => item.orderStatus === 'ACCEPTED').length },
            { label: '服务中', value: 'SERVING', badge: orders.filter(item => item.orderStatus === 'SERVING').length },
            { label: '已完成', value: 'COMPLETED', badge: orders.filter(item => item.orderStatus === 'COMPLETED').length },
          ]"
        />
      </PetpalSection>

      <PetpalSection title="订单队列" subtitle="每一行只给当前最需要的动作。">
        <template v-if="visibleOrders.length">
          <view v-for="item in visibleOrders" :key="item.id" class="petpal-stack">
            <button class="petpal-row-btn" hover-class="none" @click="openOrderDetailPage(item.id, 'service')">
              <view class="petpal-row__copy">
                <text class="petpal-row__title">{{ item.orderNo }}</text>
                <text class="petpal-row__meta">{{ item.ownerNickname }} · {{ item.petName || '宠物待同步' }}</text>
                <text class="petpal-row__hint">{{ item.locationText || '地点待同步' }} · {{ item.orderStatus }}</text>
              </view>
              <text class="petpal-row__value">详情</text>
            </button>
            <view class="petpal-action-row">
              <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="openOrderDetailPage(item.id, 'chat')">沟通</button>
              <button v-if="item.orderStatus === 'PENDING_ACCEPT'" class="petpal-btn petpal-btn--primary" hover-class="none" @click="runAction(() => acceptCaregiverOrder(item.id).then(() => undefined), '已接单')">接单</button>
              <button v-if="item.orderStatus === 'ACCEPTED'" class="petpal-btn petpal-btn--primary" hover-class="none" @click="runAction(() => checkInCaregiverOrder(item.id, { note: '移动端签到' }).then(() => undefined), '签到成功')">签到</button>
              <button v-if="item.orderStatus === 'SERVING'" class="petpal-btn petpal-btn--ghost" hover-class="none" @click="runAction(() => checkOutCaregiverOrder(item.id, { note: '移动端签退' }).then(() => undefined), '签退成功')">签退</button>
            </view>
          </view>
        </template>
        <PetpalEmpty v-else title="当前筛选下没有订单" description="切换筛选查看其他状态的订单。"/>
      </PetpalSection>
    </template>
  </PetpalPage>
</template>
