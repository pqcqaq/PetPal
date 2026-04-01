<script lang="ts" setup>
import { computed } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore, useUserStore } from '@/store'
import {
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_GETTING_STARTED_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_REMINDERS_PAGE,
  PETPAL_WORKBENCH_PAGE,
} from './owner-shared'

defineOptions({
  name: 'PetPalHubPage',
})

definePage({
  style: {
    navigationBarTitleText: 'PetPal',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()
const userStore = useUserStore()

const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? 'PetPal 不再把主人与照料者逻辑混在一页里。请选择当前要进入的任务流。'
    : '登录后进入 PetPal 主人任务流或照料者工作台。'
))

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openOwnerFlow() {
  uni.redirectTo({ url: PETPAL_OWNER_HOME_PAGE })
}

function openCaregiverFlow() {
  uni.redirectTo({ url: PETPAL_CAREGIVER_HOME_PAGE })
}

function openLegacyWorkbench() {
  uni.redirectTo({ url: PETPAL_WORKBENCH_PAGE })
}

function openMessages() {
  uni.redirectTo({ url: PETPAL_MESSAGES_PAGE })
}

function openReminders() {
  uni.redirectTo({ url: PETPAL_REMINDERS_PAGE })
}

function openGettingStarted() {
  uni.redirectTo({ url: PETPAL_GETTING_STARTED_PAGE })
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void tokenStore.bootstrap()
  void userStore.fetchUserInfo().catch(() => undefined)
})
</script>

<template>
  <AppPageShell title="PetPal 入口" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="选择当前任务流" description="按角色和场景拆分入口，避免主人和照料者逻辑混放。">
        <view class="hub-hero">
          <view class="hub-hero__copy">
            <AppTag type="primary">
              PetPal 角色入口
            </AppTag>
            <text class="hub-hero__title">{{ displayName }}</text>
            <text class="hub-hero__summary">
              主人任务流用于宠物建档、需求发布和订单跟进；照料者任务流用于入驻、服务配置、接单和履约。
            </text>
          </view>
          <view class="hub-hero__actions">
            <AppButton size="medium" @click="openOwnerFlow">主人任务流</AppButton>
            <AppButton size="medium" type="info" @click="openCaregiverFlow">照料者任务流</AppButton>
            <AppButton size="medium" type="info" @click="openGettingStarted">起步向导</AppButton>
            <AppButton size="medium" type="danger" @click="openReminders">提醒中心</AppButton>
          </view>
        </view>

        <view class="hub-grid">
          <view class="hub-card">
            <text class="hub-card__title">主人任务流</text>
            <text class="hub-card__text">进入主人首页，依次完成宠物档案、需求发布、订单跟进与售后处理。</text>
            <view class="hub-card__tags">
              <AppTag type="success">建档</AppTag>
              <AppTag type="success">发布需求</AppTag>
              <AppTag type="success">跟进订单</AppTag>
              <AppTag type="success">售后收口</AppTag>
            </view>
            <AppButton @click="openOwnerFlow">进入主人流</AppButton>
          </view>

          <view class="hub-card">
            <text class="hub-card__title">照料者任务流</text>
            <text class="hub-card__text">进入照料者首页，分开处理入驻资料、服务配置、接单履约、提醒与收益表现。</text>
            <view class="hub-card__tags">
              <AppTag type="warning">服务报价</AppTag>
              <AppTag type="warning">接单</AppTag>
              <AppTag type="warning">履约</AppTag>
              <AppTag type="warning">收益表现</AppTag>
            </view>
            <AppButton type="info" @click="openCaregiverFlow">进入照料者</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="辅助入口" description="把提醒、消息和兼容入口保留在角色选择页下方，减少来回跳转。">
        <view class="hub-support-grid">
          <view class="hub-support-card">
            <text class="hub-support-card__title">起步向导</text>
            <text class="hub-support-card__text">把主人路径、照料者路径和角色切换建议拆成明确步骤。</text>
            <AppButton size="medium" type="info" @click="openGettingStarted">进入起步向导</AppButton>
          </view>
          <view class="hub-support-card">
            <text class="hub-support-card__title">提醒中心</text>
            <text class="hub-support-card__text">集中查看主人端、照料者端和售后相关待办。</text>
            <AppButton size="medium" type="danger" @click="openReminders">进入提醒中心</AppButton>
          </view>
          <view class="hub-support-card">
            <text class="hub-support-card__title">消息中心</text>
            <text class="hub-support-card__text">统一收口跨订单沟通，优先处理未读消息与异常反馈。</text>
            <AppButton size="medium" type="info" @click="openMessages">进入消息中心</AppButton>
          </view>
          <view class="hub-support-card hub-support-card--legacy">
            <text class="hub-support-card__title">兼容入口</text>
            <text class="hub-support-card__text">旧综合工作台暂时保留，避免当前照料者流程中断。</text>
            <AppButton size="medium" type="info" @click="openLegacyWorkbench">打开旧工作台</AppButton>
          </view>
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始使用 PetPal">
        <view class="hub-empty">
          <AppStatus text="登录后即可选择主人任务流或照料者工作台。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.hub-hero {
  display: grid;
  gap: 20rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 32%),
    linear-gradient(145deg, #0f766e 0%, #155e75 52%, var(--app-accent) 100%);
  box-shadow: var(--app-elevation-3);
}

.hub-hero__copy {
  display: grid;
  gap: 12rpx;
}

.hub-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.hub-hero__title {
  color: #f8fafc;
  font-size: 40rpx;
  line-height: 1.15;
  font-weight: 700;
}

.hub-hero__summary {
  font-size: 24rpx;
  line-height: 1.7;
  color: rgba(248, 250, 252, 0.88);
}

.hub-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 18rpx;
}

.hub-card,
.hub-support-card {
  display: grid;
  gap: 14rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.hub-card:first-child {
  background:
    radial-gradient(circle at top right, rgba(11, 122, 117, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.hub-card:last-child {
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.hub-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 700;
}

.hub-card__text,
.hub-support-card__text {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.hub-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.hub-support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.hub-support-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.4;
  font-weight: 700;
}

.hub-support-card--legacy {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.08), transparent 34%),
    linear-gradient(180deg, var(--app-surface-container-high) 0%, var(--app-surface) 100%);
}

.hub-empty {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .hub-grid,
  .hub-support-grid {
    grid-template-columns: 1fr;
  }
}
</style>
