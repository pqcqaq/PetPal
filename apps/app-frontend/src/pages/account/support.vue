<script lang="ts" setup>
import type { CaregiverProfileRecord, OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { getCaregiverProfile, listOrders, listPets, listServiceRequests } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore, useUiStore, useUserStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import {
  PETPAL_CAREGIVER_PROFILE_PAGE,
  PETPAL_GETTING_STARTED_PAGE,
  PETPAL_NOTIFICATIONS_PAGE,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '@/pages/petpal/owner-shared'

defineOptions({
  name: 'PetPalAccountSupportPage',
})

definePage({
  style: {
    navigationBarTitleText: '账户支持',
    enablePullDownRefresh: true,
  },
})

type SupportActionCard = {
  title: string
  text: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  actionLabel: string
  actionUrl: string
}

const HELP_PAGE = '/pages/help/index'
const PROFILE_PAGE = '/pages/me/profile'
const SETTINGS_PAGE = '/pages/settings/index'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const uiStore = useUiStore()

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])
const caregiverProfile = ref<CaregiverProfileRecord | null>(null)

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const activeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)
const activeRequestCount = computed(() => requests.value.filter(item => (
  item.status === 'OPEN'
  || item.status === 'MATCHED'
)).length)
const workspaceSummary = computed(() => {
  const permissions = userStore.userInfo.permissions || []
  return permissions.some(permission => permission.startsWith('petpal.'))
    ? '主人端 + 治理后台'
    : '主人端主流程'
})
const themeSummary = computed(() => {
  const app = uiStore.preferences
  const layout = app.portalLayout === 'focus' ? '聚焦办事' : '概览看板'
  return `${app.themePresetId} · ${app.themeMode} · ${layout}`
})
const statusText = computed(() => userStore.userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限')
const statusTagType = computed(() => userStore.userInfo.status === 'ACTIVE' ? 'success' : 'warning')
const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? `${displayName.value}，这里汇总账号同步状态、推荐动作和帮助入口，用来承接“我的 / 资料 / 设置”之外的账户辅助逻辑。`
    : '登录后查看账号同步状态、推荐动作和帮助入口。'
))

const summaryCards = computed(() => [
  {
    label: '宠物档案',
    value: String(pets.value.length),
    hint: pets.value.length ? '主人主流程可直接复用这些宠物资料。' : '还没有宠物档案。',
  },
  {
    label: '活跃需求',
    value: String(activeRequestCount.value),
    hint: activeRequestCount.value ? '仍有需求在匹配或待确认。' : '当前没有待跟进需求。',
  },
  {
    label: '进行中订单',
    value: String(activeOrderCount.value),
    hint: activeOrderCount.value ? '建议优先回到提醒中心跟进。' : '当前没有进行中的订单。',
  },
  {
    label: '照料者档案',
    value: caregiverProfile.value ? '已建立' : '未建立',
    hint: caregiverProfile.value ? '可继续维护资质材料和服务配置。' : '如果要接单，可继续进入入驻中心。',
  },
])

const supportActions = computed<SupportActionCard[]>(() => {
  const cards: SupportActionCard[] = []

  if (!pets.value.length) {
    cards.push({
      title: '先建立第一只宠物档案',
      text: '没有宠物档案时，主人主流程无法稳定复用下单信息。',
      priority: 'HIGH',
      actionLabel: '打开起步向导',
      actionUrl: `${PETPAL_GETTING_STARTED_PAGE}?view=OWNER`,
    })
  }

  if (!userStore.userInfo.email) {
    cards.push({
      title: '补齐邮箱与基础资料',
      text: '邮箱和昵称会影响账户同步、身份识别和后续联系。',
      priority: 'MEDIUM',
      actionLabel: '编辑资料',
      actionUrl: PROFILE_PAGE,
    })
  }

  if (activeOrderCount.value > 0 || activeRequestCount.value > 0) {
    cards.push({
      title: '优先回到提醒中心',
      text: '有活跃需求或进行中订单时，提醒中心能更快告诉你下一步该做什么。',
      priority: 'HIGH',
      actionLabel: '进入提醒中心',
      actionUrl: PETPAL_REMINDERS_PAGE,
    })
  }

  if (!caregiverProfile.value) {
    cards.push({
      title: '如果你要接单，先建立照料者档案',
      text: '照料者档案、资质材料和服务配置需要先完成，后续才能稳定接单。',
      priority: 'MEDIUM',
      actionLabel: '打开起步向导',
      actionUrl: `${PETPAL_GETTING_STARTED_PAGE}?view=CAREGIVER`,
    })
  }

  if (uiStore.preferences.portalLayout !== 'focus' || uiStore.preferences.motionEnabled) {
    cards.push({
      title: '继续微调体验设置',
      text: '可以根据自己的使用习惯调整首页布局、动效和主题方案。',
      priority: 'LOW',
      actionLabel: '打开设置',
      actionUrl: SETTINGS_PAGE,
    })
  }

  if (!cards.length) {
    cards.push({
      title: '当前账户状态较稳定',
      text: '基础资料、主人主流程和体验设置都已具备，可继续通过帮助中心查看更多操作说明。',
      priority: 'LOW',
      actionLabel: '进入帮助中心',
      actionUrl: HELP_PAGE,
    })
  }

  return cards
})

function getPriorityLabel(priority: SupportActionCard['priority']) {
  if (priority === 'HIGH') return '优先处理'
  if (priority === 'MEDIUM') return '继续完善'
  return '可选优化'
}

function getPriorityTagType(priority: SupportActionCard['priority']) {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}

function navigateTo(url: string) {
  uni.navigateTo({ url })
}

function openLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    await Promise.all([
      tokenStore.bootstrap(),
      userStore.fetchUserInfo().catch(() => undefined),
    ])

    const [petsResult, requestsResult, ordersResult, caregiverProfileResult] = await Promise.allSettled([
      listPets(),
      listServiceRequests(),
      listOrders(),
      getCaregiverProfile(),
    ])

    pets.value = petsResult.status === 'fulfilled' ? petsResult.value : []
    requests.value = requestsResult.status === 'fulfilled' ? requestsResult.value : []
    orders.value = ordersResult.status === 'fulfilled' ? ordersResult.value : []
    caregiverProfile.value = caregiverProfileResult.status === 'fulfilled' ? caregiverProfileResult.value : null
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载账户支持失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }

  void loadPage(false)
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="账户支持" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="账户总览" description="这里承接资料、设置之外的账户辅助逻辑，优先告诉你当前账号是否还缺关键动作。">
        <view class="account-support-hero">
          <view class="account-support-hero__copy">
            <view class="app-tag-row app-tag-row--compact">
              <AppTag :type="statusTagType">
                {{ statusText }}
              </AppTag>
              <AppTag type="primary">
                {{ workspaceSummary }}
              </AppTag>
            </view>
            <text class="account-support-hero__title">{{ displayName }}</text>
            <text class="account-support-hero__summary">
              账户支持中心会根据宠物、需求、订单、照料者档案和体验设置，给出更明确的下一步动作。
            </text>
          </view>
          <view class="account-support-hero__actions">
            <AppButton size="medium" @click="navigateTo(PETPAL_GETTING_STARTED_PAGE)">起步向导</AppButton>
            <AppButton size="medium" @click="navigateTo(PETPAL_NOTIFICATIONS_PAGE)">通知中心</AppButton>
            <AppButton size="medium" @click="navigateTo(PETPAL_REMINDERS_PAGE)">提醒中心</AppButton>
            <AppButton size="medium" type="info" @click="navigateTo(HELP_PAGE)">帮助中心</AppButton>
            <AppButton size="medium" type="info" @click="navigateTo(SETTINGS_PAGE)">体验设置</AppButton>
          </view>
        </view>

        <view class="account-support-grid">
          <view v-for="item in summaryCards" :key="item.label" class="account-support-card">
            <text class="account-support-card__label">{{ item.label }}</text>
            <text class="account-support-card__value">{{ item.value }}</text>
            <text class="account-support-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="推荐动作" description="优先处理真正会阻塞主流程的事项，不再让账户辅助信息散落在多个页面。">
        <view class="account-action-list">
          <view v-for="item in supportActions" :key="item.title" class="account-action-card">
            <view class="account-action-card__header">
              <AppTag :type="getPriorityTagType(item.priority)">
                {{ getPriorityLabel(item.priority) }}
              </AppTag>
              <AppButton size="medium" :type="item.priority === 'HIGH' ? 'danger' : 'primary'" @click="navigateTo(item.actionUrl)">
                {{ item.actionLabel }}
              </AppButton>
            </view>
            <text class="account-action-card__title">{{ item.title }}</text>
            <text class="account-action-card__text">{{ item.text }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="账户与同步" description="账号状态、资料和体验设置都在这里做统一确认。">
        <AppList>
          <AppListItem title="账号状态" :value="statusText" value-emphasis />
          <AppListItem title="邮箱" :value="userStore.userInfo.email || '未绑定'" />
          <AppListItem title="当前身份" :label="userStore.userInfo.roles.map(role => role.name).join('、') || '主人服务账号'" />
          <AppListItem title="工作区" :value="workspaceSummary" />
          <AppListItem title="体验设置" :label="themeSummary" />
        </AppList>
      </AppSection>

      <AppSection title="帮助入口" description="帮助、资料、设置和提醒保持独立页面，但可以在账户支持页里互相跳转。">
        <AppList>
          <AppListItem title="起步向导" label="按主人路径和照料者路径查看当前最值得优先完成的步骤。" is-link clickable @click="navigateTo(PETPAL_GETTING_STARTED_PAGE)" />
          <AppListItem title="通知中心" label="统一查看提醒、未读沟通和账户提示，并追踪已读状态。" is-link clickable @click="navigateTo(PETPAL_NOTIFICATIONS_PAGE)" />
          <AppListItem title="帮助中心" label="查看主人、照料者、售后和账户支持场景说明。" is-link clickable @click="navigateTo(HELP_PAGE)" />
          <AppListItem title="个人资料" label="编辑昵称、邮箱和头像。" is-link clickable @click="navigateTo(PROFILE_PAGE)" />
          <AppListItem title="体验设置" label="继续调整主题、首页布局和动效。" is-link clickable @click="navigateTo(SETTINGS_PAGE)" />
          <AppListItem title="提醒中心" label="处理当前最高优先的待办事项。" is-link clickable @click="navigateTo(PETPAL_REMINDERS_PAGE)" />
        </AppList>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始使用账户支持" description="登录后查看账户状态、推荐动作和帮助入口。">
        <view class="account-support-empty">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="openLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.account-support-hero {
  display: grid;
  gap: 20rpx;
  margin: 0 24rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 34%),
    linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-pressed) 54%, var(--app-warning) 100%);
  box-shadow: var(--app-elevation-3);
}

.account-support-hero__copy {
  display: grid;
  gap: 12rpx;
}

.account-support-hero__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.16;
  font-weight: 700;
}

.account-support-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.account-support-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.account-support-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 18rpx 24rpx 0;
}

.account-support-card,
.account-action-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.account-support-card__label {
  font-size: 22rpx;
  color: var(--app-text-muted);
}

.account-support-card__value {
  font-size: 34rpx;
  line-height: 1.12;
  color: var(--app-text);
  font-weight: 700;
}

.account-support-card__hint,
.account-action-card__text {
  font-size: 22rpx;
  line-height: 1.68;
  color: var(--app-text-secondary);
}

.account-action-list {
  display: grid;
  gap: 16rpx;
  padding: 0 24rpx;
}

.account-action-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.account-action-card__title {
  font-size: 28rpx;
  line-height: 1.45;
  color: var(--app-text);
  font-weight: 700;
}

.account-support-empty {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .account-support-grid {
    grid-template-columns: 1fr;
  }

  .account-action-card__header {
    flex-direction: column;
  }
}
</style>
