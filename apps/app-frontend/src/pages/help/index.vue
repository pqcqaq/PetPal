<script lang="ts" setup>
import { computed } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useTokenStore, useUserStore } from '@/store'
import {
  PETPAL_AFTERSALES_PAGE,
  PETPAL_CAREGIVER_HOME_PAGE,
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '@/pages/petpal/owner-shared'

defineOptions({
  name: 'PetPalHelpPage',
})

definePage({
  style: {
    navigationBarTitleText: '帮助中心',
  },
})

type HelpSceneCard = {
  title: string
  text: string
  tags: string[]
  actionLabel: string
  actionUrl: string
}

type FaqCard = {
  question: string
  answer: string
}

const HELP_ACCOUNT_SUPPORT_PAGE = '/pages/account/support'
const SETTINGS_PAGE = '/pages/settings/index'
const PROFILE_PAGE = '/pages/me/profile'

const tokenStore = useTokenStore()
const userStore = useUserStore()

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? `${displayName.value}，这里把主人、照料者、售后和账号支持相关帮助按场景拆开，减少在旧工作台里来回查找。`
    : '登录后可查看主人、照料者、售后与账号支持场景的使用说明。'
))

const helpScenes = computed<HelpSceneCard[]>(() => [
  {
    title: '开始主人主流程',
    text: '从宠物建档、发布需求到订单跟进，按真实主人办事顺序进入，不再使用兼容工作台摸索。',
    tags: ['宠物建档', '发布需求', '订单跟进'],
    actionLabel: '进入主人首页',
    actionUrl: PETPAL_OWNER_HOME_PAGE,
  },
  {
    title: '开始照料者入驻',
    text: '如果你要接单，先维护入驻资料、资质材料和服务配置，再进入履约订单。',
    tags: ['入驻资料', '资质材料', '服务配置'],
    actionLabel: '进入入驻中心',
    actionUrl: PETPAL_CAREGIVER_PROFILE_PAGE,
  },
  {
    title: '处理沟通与提醒',
    text: '消息中心负责跨订单沟通，提醒中心负责优先级和下一步动作，不再混在首页的零散提示里。',
    tags: ['消息中心', '提醒中心', '未读处理'],
    actionLabel: '进入提醒中心',
    actionUrl: PETPAL_REMINDERS_PAGE,
  },
  {
    title: '处理售后问题',
    text: '退款、投诉和争议订单已经从订单列表里拆出，可以直接进入售后中心优先处理风险事项。',
    tags: ['退款', '投诉', '争议订单'],
    actionLabel: '进入售后中心',
    actionUrl: PETPAL_AFTERSALES_PAGE,
  },
])

const faqCards = computed<FaqCard[]>(() => [
  {
    question: '为什么不再把所有功能都放在一个工作台页面？',
    answer: 'PetPal 现在按主人、照料者、售后、消息和账户支持拆分页面，用户可以先进入当前场景，再执行具体动作，减少在超长页面里滚动查找。',
  },
  {
    question: '提醒中心和消息中心有什么区别？',
    answer: '消息中心处理跨订单沟通内容与未读消息，提醒中心负责把主人、照料者和售后待办聚合成“下一步动作”，两者不再互相混用。',
  },
  {
    question: '如果我同时是主人和照料者，该从哪里进入？',
    answer: '先从角色入口选择当前要处理的任务流。需要管理照料者入驻、服务和接单时进入照料者首页，需要建档、下单和售后时进入主人首页。',
  },
  {
    question: '账号资料、设置和帮助为什么单独拆页？',
    answer: '资料页负责维护头像和基础信息，设置页负责主题与布局，帮助中心负责场景引导，账户支持页负责同步状态和推荐动作，避免把账户相关逻辑再次堆回“我的”页。',
  },
])

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function openHelpAction(url: string) {
  if (!tokenStore.hasLogin && url !== HELP_ACCOUNT_SUPPORT_PAGE) {
    uni.navigateTo({ url: LOGIN_PAGE })
    return
  }

  navigateTo(url)
}

function openLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function openRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}

function openMessages() {
  openHelpAction(PETPAL_MESSAGES_PAGE)
}

function openAccountSupport() {
  openHelpAction(HELP_ACCOUNT_SUPPORT_PAGE)
}

function openProfile() {
  openHelpAction(PROFILE_PAGE)
}

function openSettings() {
  openHelpAction(SETTINGS_PAGE)
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
  <AppPageShell title="帮助中心" :description="pageDescription">
    <AppSection title="帮助总览" description="把主人、照料者、售后和账户支持拆成清晰场景，先告诉用户应该去哪里，而不是让用户先理解框架。">
      <view class="help-hero">
        <view class="help-hero__copy">
          <AppTag type="primary">
            PetPal 帮助中心
          </AppTag>
          <text class="help-hero__title">{{ displayName }}</text>
          <text class="help-hero__summary">
            你可以从这里快速进入主人主流程、照料者入驻、消息与提醒处理，以及账户支持与体验设置。
          </text>
        </view>
        <view class="help-hero__actions">
          <AppButton size="medium" @click="openAccountSupport">账户支持</AppButton>
          <AppButton size="medium" type="info" @click="openSettings">体验设置</AppButton>
          <AppButton size="medium" type="danger" @click="openMessages">消息中心</AppButton>
        </view>
      </view>
    </AppSection>

    <AppSection title="场景入口" description="直接按当前场景进入，不再在旧工作台里逐项寻找。">
      <view class="help-scene-grid">
        <view v-for="item in helpScenes" :key="item.title" class="help-scene-card">
          <text class="help-scene-card__title">{{ item.title }}</text>
          <text class="help-scene-card__text">{{ item.text }}</text>
          <view class="help-scene-card__tags">
            <AppTag v-for="tag in item.tags" :key="tag" type="default">
              {{ tag }}
            </AppTag>
          </view>
          <AppButton size="medium" @click="openHelpAction(item.actionUrl)">
            {{ item.actionLabel }}
          </AppButton>
        </view>
      </view>
    </AppSection>

    <AppSection title="常见问题" description="优先回答当前页面拆分后最容易困惑的操作逻辑。">
      <view class="help-faq-list">
        <view v-for="item in faqCards" :key="item.question" class="help-faq-card">
          <text class="help-faq-card__question">{{ item.question }}</text>
          <text class="help-faq-card__answer">{{ item.answer }}</text>
        </view>
      </view>
    </AppSection>

    <AppSection title="账户与支持" description="帮助、资料、设置和账户支持保持独立，但彼此互相可达。">
      <view class="help-support-grid">
        <view class="help-support-card">
          <text class="help-support-card__title">账户支持</text>
          <text class="help-support-card__text">查看当前账号状态、推荐动作和同步情况。</text>
          <AppButton size="medium" type="info" @click="openAccountSupport">进入账户支持</AppButton>
        </view>
        <view class="help-support-card">
          <text class="help-support-card__title">个人资料</text>
          <text class="help-support-card__text">维护昵称、邮箱、头像和账号角色摘要。</text>
          <AppButton size="medium" type="info" @click="openProfile">进入个人资料</AppButton>
        </view>
        <view class="help-support-card">
          <text class="help-support-card__title">体验设置</text>
          <text class="help-support-card__text">调整主题、首页布局、密度和动效策略。</text>
          <AppButton size="medium" type="info" @click="openSettings">进入体验设置</AppButton>
        </view>
      </view>
    </AppSection>

    <template v-if="!tokenStore.hasLogin">
      <AppSection title="开始使用" description="登录后可进入主人、照料者、消息和账户支持相关场景。">
        <view class="help-empty">
          <AppStatus text="当前尚未登录 PetPal 账号，登录后可以获取更有针对性的帮助入口。" />
        </view>
        <view class="help-auth-actions">
          <AppButton block @click="openLogin">去登录</AppButton>
          <AppButton block type="info" @click="openRegister">去注册</AppButton>
        </view>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.help-hero {
  display: grid;
  gap: 20rpx;
  margin: 0 24rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 34%),
    linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-pressed) 54%, var(--app-success) 100%);
  box-shadow: var(--app-elevation-3);
}

.help-hero__copy {
  display: grid;
  gap: 12rpx;
}

.help-hero__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.16;
  font-weight: 700;
}

.help-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.help-hero__actions,
.help-scene-card__tags,
.help-auth-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.help-scene-grid,
.help-support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.help-faq-list {
  display: grid;
  gap: 16rpx;
  padding: 0 24rpx;
}

.help-scene-card,
.help-faq-card,
.help-support-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.help-scene-card:nth-child(1) {
  background:
    radial-gradient(circle at top right, rgba(11, 122, 117, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, var(--app-surface) 100%);
}

.help-scene-card:nth-child(2) {
  background:
    radial-gradient(circle at top right, rgba(181, 106, 0, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-warning-soft) 0%, var(--app-surface) 100%);
}

.help-scene-card:nth-child(3) {
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.12), transparent 34%),
    linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
}

.help-scene-card:nth-child(4) {
  background:
    radial-gradient(circle at top right, rgba(186, 26, 26, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-danger-soft) 0%, var(--app-surface) 100%);
}

.help-scene-card__title,
.help-faq-card__question,
.help-support-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.help-scene-card__text,
.help-faq-card__answer,
.help-support-card__text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.72;
}

.help-empty {
  padding: 0 0 28rpx;
}

@media (max-width: 680px) {
  .help-scene-grid,
  .help-support-grid {
    grid-template-columns: 1fr;
  }
}
</style>
