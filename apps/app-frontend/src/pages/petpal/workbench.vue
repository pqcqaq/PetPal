<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 打开历史书签或旧入口的 PetPal 用户
 * Entry: 访问旧 workbench 路由，或带旧 mode/target 参数进入
 * First screen: 不再展示旧综合工作台，只提示“正在跳转到新页面”
 * Primary action: 自动跳转到新的主人 / 照料者 / 消息 / 提醒页面
 * Secondary actions: 跳转失败时手动返回角色入口
 * States: 未登录、自动跳转中、跳转失败
 */
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import {
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_EARNINGS_PAGE,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_CAREGIVER_ORDERS_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_CAREGIVER_SERVICES_PAGE,
  PETPAL_HUB_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REMINDERS_PAGE,
  PETPAL_REQUEST_PAGE,
} from './owner-shared'

defineOptions({
  name: 'PetPalWorkbenchLegacyPage',
})

definePage({
  style: {
    navigationBarTitleText: 'PetPal',
  },
})

type LegacyMode = 'owner' | 'caregiver'

const tokenStore = useTokenStore()

const redirecting = ref(true)
const redirectError = ref('')

const fallbackText = computed(() => (
  redirectError.value || '旧工作台已经下线，正在带你进入新的 PetPal 页面。'
))

function goToLogin() {
  uni.redirectTo({ url: LOGIN_PAGE })
}

function openHub() {
  uni.redirectTo({ url: PETPAL_HUB_PAGE })
}

function resolveLegacyTarget(options: Record<string, string | undefined>) {
  const mode = options.mode === 'caregiver' ? 'caregiver' : options.mode === 'owner' ? 'owner' : ''
  const target = options.target || options.page || options.section || ''

  if (target === 'messages') return PETPAL_MESSAGES_PAGE
  if (target === 'reminders') return PETPAL_REMINDERS_PAGE
  if (target === 'notifications') return PETPAL_NOTIFICATIONS_PAGE

  if (mode === 'caregiver') {
    if (target === 'orders') return PETPAL_CAREGIVER_ORDERS_PAGE
    if (target === 'services') return PETPAL_CAREGIVER_SERVICES_PAGE
    if (target === 'profile') return PETPAL_CAREGIVER_PROFILE_PAGE
    if (target === 'earnings') return PETPAL_CAREGIVER_EARNINGS_PAGE
    return PETPAL_CAREGIVER_HOME_PAGE
  }

  if (mode === 'owner') {
    if (target === 'pets') return PETPAL_PETS_PAGE
    if (target === 'request') return PETPAL_REQUEST_PAGE
    if (target === 'orders') return PETPAL_ORDERS_PAGE
    if (target === 'aftersales') return PETPAL_AFTERSALES_PAGE
    return PETPAL_OWNER_HOME_PAGE
  }

  return PETPAL_HUB_PAGE
}

function redirectToTarget(target: string) {
  uni.redirectTo({
    url: target,
    fail: () => {
      uni.navigateTo({ url: target })
    },
  })
}

onLoad((options: Record<string, string | undefined>) => {
  if (!tokenStore.hasLogin) {
    redirecting.value = false
    return
  }

  const target = resolveLegacyTarget(options)

  try {
    redirectToTarget(target)
  }
  catch (error) {
    redirecting.value = false
    redirectError.value = error instanceof Error ? error.message : '自动跳转失败'
  }
})
</script>

<template>
  <AppPageShell title="PetPal">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="正在进入新页面">
        <view class="legacy-workbench">
          <AppStatus :mode="redirecting ? 'loading' : 'empty'" :text="fallbackText" />
          <view v-if="!redirecting" class="legacy-workbench__actions">
            <AppButton size="medium" @click="openHub">进入角色入口</AppButton>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <view class="legacy-workbench">
          <AppStatus text="旧工作台已下线，登录后会直接进入新的 PetPal 页面。" />
          <view class="legacy-workbench__actions">
            <AppButton size="medium" @click="goToLogin">去登录</AppButton>
          </view>
        </view>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.legacy-workbench {
  display: grid;
  gap: 20rpx;
  padding: 16rpx 0 8rpx;
}

.legacy-workbench__actions {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}
</style>
