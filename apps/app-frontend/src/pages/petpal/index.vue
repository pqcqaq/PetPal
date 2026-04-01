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
  PETPAL_OWNER_HOME_PAGE,
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
          <AppTag type="primary">
            PetPal 角色入口
          </AppTag>
          <text class="hub-hero__title">{{ displayName }}</text>
          <text class="hub-hero__summary">
            主人任务流用于宠物建档、需求发布和订单跟进；照料者任务流用于入驻、服务配置、接单和履约。
          </text>
        </view>

        <view class="hub-grid">
          <view class="hub-card">
            <text class="hub-card__title">主人任务流</text>
            <text class="hub-card__text">进入主人首页，依次完成宠物档案、需求发布和订单跟进。</text>
            <view class="hub-card__tags">
              <AppTag type="success">建档</AppTag>
              <AppTag type="success">发布需求</AppTag>
              <AppTag type="success">跟进订单</AppTag>
            </view>
            <AppButton @click="openOwnerFlow">进入主人流</AppButton>
          </view>

          <view class="hub-card">
            <text class="hub-card__title">照料者任务流</text>
            <text class="hub-card__text">进入照料者首页，分开处理入驻资料、服务配置、接单履约和消息协同。</text>
            <view class="hub-card__tags">
              <AppTag type="warning">服务报价</AppTag>
              <AppTag type="warning">接单</AppTag>
              <AppTag type="warning">履约</AppTag>
            </view>
            <AppButton type="info" @click="openCaregiverFlow">进入照料者</AppButton>
          </view>
        </view>
      </AppSection>

      <AppSection title="兼容入口" description="旧综合工作台暂时保留，避免当前照料者流程中断。">
        <view class="hub-legacy">
          <text>如果需要临时查看保留版综合工作台，可以继续进入旧入口。</text>
          <AppButton size="medium" type="info" @click="openLegacyWorkbench">打开旧工作台</AppButton>
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
  gap: 12rpx;
  padding: 28rpx;
  border-radius: 30rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 32%),
    linear-gradient(145deg, #115e59 0%, #155e75 52%, #1d4f91 100%);
  color: #f8fafc;
}

.hub-hero__title {
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
.hub-legacy {
  display: grid;
  gap: 14rpx;
  padding: 24rpx;
  border-radius: 26rpx;
  border: 1rpx solid var(--app-border);
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.hub-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  font-weight: 700;
}

.hub-card__text,
.hub-legacy {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
}

.hub-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.hub-empty {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .hub-grid {
    grid-template-columns: 1fr;
  }
}
</style>
