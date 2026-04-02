<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 需要快速找到正确入口，而不是读一页产品说明
 * Entry: 我的页、资料页、账户支持回流
 * First screen: 先选当前要解决的问题类型
 * Primary action: 直接进入对应场景页
 * Secondary actions: 查看支持入口、登录或注册
 * States: 未登录、主人问题、照料者问题、售后问题、账户问题
 */
import { computed } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useTokenStore, useUserStore } from '@/store'
import {
  openPetPalAction,
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_GETTING_STARTED_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_ORDERS_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '@/pages/petpal/owner-shared'

defineOptions({
  name: 'PetPalHelpPage',
})

definePage({
  style: {
    navigationBarTitleText: '帮助',
  },
})

type ProblemCard = {
  title: string
  hint: string
  actionLabel: string
  action: () => void
}

type SupportRow = {
  title: string
  hint: string
  value: string
  action: () => void
}

const tokenStore = useTokenStore()
const userStore = useUserStore()

const ACCOUNT_SUPPORT_PAGE = '/pages/account/support'
const SETTINGS_PAGE = '/pages/settings/index'
const PROFILE_PAGE = '/pages/me/profile'

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')

const problemCards = computed<ProblemCard[]>(() => [
  {
    title: '我要下单或跟单',
    hint: '宠物、需求、订单都从主人侧继续',
    actionLabel: '进入主人侧',
    action: () => openProtectedAction(PETPAL_OWNER_HOME_PAGE),
  },
  {
    title: '我要接单或履约',
    hint: '入驻、服务和履约都从照料者侧继续',
    actionLabel: '进入照料者侧',
    action: () => openProtectedAction(PETPAL_CAREGIVER_HOME_PAGE),
  },
  {
    title: '我要处理退款或投诉',
    hint: '售后问题统一去售后中心，不回订单列表里找',
    actionLabel: '进入售后',
    action: () => openProtectedAction(PETPAL_AFTERSALES_PAGE),
  },
  {
    title: '我要看消息或提醒',
    hint: '沟通、通知、待办各走各的入口',
    actionLabel: '进入提醒',
    action: () => openProtectedAction(PETPAL_REMINDERS_PAGE),
  },
])

const supportRows = computed<SupportRow[]>(() => [
  {
    title: '消息',
    hint: '跨订单沟通统一处理',
    value: '打开',
    action: () => openProtectedAction(PETPAL_MESSAGES_PAGE),
  },
  {
    title: '通知',
    hint: '统一收件箱和已读追踪',
    value: '打开',
    action: () => openProtectedAction(PETPAL_NOTIFICATIONS_PAGE),
  },
  {
    title: '订单',
    hint: '回看全部订单进度',
    value: '查看',
    action: () => openProtectedAction(PETPAL_ORDERS_PAGE),
  },
  {
    title: '起步向导',
    hint: '不确定先做什么时再进入这里',
    value: '查看',
    action: () => openProtectedAction(PETPAL_GETTING_STARTED_PAGE),
  },
  {
    title: '照料者资料',
    hint: '需要入驻、补资质或改服务信息',
    value: '进入',
    action: () => openProtectedAction(PETPAL_CAREGIVER_PROFILE_PAGE),
  },
  {
    title: '个人资料',
    hint: '修改头像、昵称和邮箱',
    value: '编辑',
    action: () => openProtectedAction(PROFILE_PAGE),
  },
  {
    title: '设置',
    hint: '通知偏好和界面选项',
    value: '调整',
    action: () => openProtectedAction(SETTINGS_PAGE),
  },
  {
    title: '账户支持',
    hint: '账号异常和同步问题',
    value: '支持',
    action: () => openProtectedAction(ACCOUNT_SUPPORT_PAGE),
  },
])

function openProtectedAction(url: string) {
  if (!tokenStore.hasLogin) {
    uni.navigateTo({ url: LOGIN_PAGE })
    return
  }
  openPetPalAction('navigate', url)
}

function openLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
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
  <AppPageShell title="帮助">
    <view class="help-page">
      <view class="help-focus">
        <view class="help-focus__copy">
          <view class="help-focus__tags">
            <AppTag type="primary">帮助</AppTag>
            <AppTag :type="tokenStore.hasLogin ? 'success' : 'default'">
              {{ tokenStore.hasLogin ? '已登录' : '未登录' }}
            </AppTag>
          </view>
          <text class="help-focus__title">{{ tokenStore.hasLogin ? `${displayName}，现在要处理什么？` : '现在要处理什么？' }}</text>
          <text class="help-focus__hint">先选问题类型，再直接进入对应页面，不在这里读长说明。</text>
        </view>

        <view v-if="!tokenStore.hasLogin" class="help-focus__actions">
          <AppButton size="medium" @click="openLogin">去登录</AppButton>
          <AppButton size="medium" type="info" @click="openRegister">去注册</AppButton>
        </view>
      </view>

      <view class="help-problem-grid">
        <view
          v-for="item in problemCards"
          :key="item.title"
          class="help-problem-card"
          @click="item.action"
        >
          <text class="help-problem-card__title">{{ item.title }}</text>
          <text class="help-problem-card__hint">{{ item.hint }}</text>
          <text class="help-problem-card__action">{{ item.actionLabel }}</text>
        </view>
      </view>

      <view class="help-support">
        <view class="help-support__head">
          <text class="help-support__title">常用支持入口</text>
          <AppTag type="default">{{ tokenStore.hasLogin ? '可直接进入' : '登录后可用' }}</AppTag>
        </view>

        <view class="help-support__list">
          <view
            v-for="item in supportRows"
            :key="item.title"
            class="help-row"
            @click="item.action"
          >
            <view class="help-row__copy">
              <text class="help-row__title">{{ item.title }}</text>
              <text class="help-row__hint">{{ item.hint }}</text>
            </view>
            <view class="help-row__meta">
              <text class="help-row__value">{{ item.value }}</text>
              <view class="help-row__arrow" />
            </view>
          </view>
        </view>
      </view>

      <view v-if="!tokenStore.hasLogin" class="help-login-tip">
        <AppStatus text="登录后可以直接从帮助页进入主人、照料者、售后和账户支持场景。" />
      </view>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.help-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.help-focus,
.help-support,
.help-login-tip {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.help-focus {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 34%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.2), transparent 34%),
    linear-gradient(145deg, #2563eb 0%, #60a5fa 44%, #f97316 100%);
}

.help-focus__copy {
  display: grid;
  gap: 12rpx;
}

.help-focus__tags,
.help-focus__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.help-focus__title {
  color: #eff6ff;
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 38rpx;
  line-height: 1.14;
  font-weight: 700;
}

.help-focus__hint {
  color: rgba(239, 246, 255, 0.92);
  font-size: 24rpx;
  line-height: 1.7;
}

.help-problem-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.help-problem-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 28rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
}

.help-problem-card__title,
.help-support__title,
.help-row__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.help-problem-card__hint,
.help-row__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.help-problem-card__action {
  color: var(--app-accent);
  font-size: 24rpx;
  line-height: 1.5;
  font-weight: 700;
}

.help-support {
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
}

.help-support__head,
.help-row,
.help-row__meta {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: center;
}

.help-support__list {
  display: grid;
}

.help-row {
  padding: 24rpx 0;
}

.help-row + .help-row {
  border-top: 1rpx solid rgba(245, 220, 192, 0.88);
}

.help-row__copy {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 8rpx;
}

.help-row__value {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.5;
}

.help-row__arrow {
  width: 16rpx;
  height: 16rpx;
  border-top: 3rpx solid var(--app-brand-strong);
  border-right: 3rpx solid var(--app-brand-strong);
  transform: rotate(45deg);
}

.help-login-tip {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
}

@media (max-width: 680px) {
  .help-problem-grid {
    grid-template-columns: 1fr;
  }

  .help-support__head,
  .help-row {
    align-items: flex-start;
  }
}
</style>
