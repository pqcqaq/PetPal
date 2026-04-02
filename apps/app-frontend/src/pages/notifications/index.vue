<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE } from '@/router/config'
import type { AppNotificationItem, AppNotificationPriority, AppNotificationScope } from '@/store'
import { useNotificationStore, useTokenStore, useUserStore } from '@/store'
import { formatDateTime, openPetPalAction, PETPAL_MESSAGES_PAGE, PETPAL_REMINDERS_PAGE } from '@/pages/petpal/owner-shared'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'PetPalNotificationsPage',
})

definePage({
  style: {
    navigationBarTitleText: '通知中心',
    enablePullDownRefresh: true,
  },
})

type NotificationScopeFilter = 'ALL' | AppNotificationScope
type NotificationViewFilter = 'ALL' | 'UNREAD'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const notificationStore = useNotificationStore()
const { items, unreadCount, unreadHighPriorityCount, ownerUnreadCount, caregiverUnreadCount, accountUnreadCount, syncedAt } = storeToRefs(notificationStore)

const scopeFilter = ref<NotificationScopeFilter>('ALL')
const viewFilter = ref<NotificationViewFilter>('UNREAD')

const scopeFilterOptions = [
  { label: '全部', value: 'ALL', description: '查看所有通知' },
  { label: '主人', value: 'OWNER', description: '聚焦主人端主流程与售后通知' },
  { label: '照料者', value: 'CAREGIVER', description: '聚焦照料者入驻、接单与履约通知' },
  { label: '账户', value: 'ACCOUNT', description: '聚焦资料、设置和账户辅助通知' },
]

const viewFilterOptions = [
  { label: '未读优先', value: 'UNREAD', description: '先处理还没有消化的通知' },
  { label: '全部通知', value: 'ALL', description: '包括已经标记已读的通知' },
]

const displayName = computed(() => userStore.userInfo.nickname || userStore.userInfo.username || 'PetPal 用户')
const pageDescription = computed(() => (
  tokenStore.hasLogin
    ? `${displayName.value}，通知中心把提醒、未读沟通、即将开始的订单和账户类提示统一收口，并支持已读状态追踪。`
    : '登录后查看统一通知流。'
))

const filteredItems = computed(() => items.value.filter((item) => {
  if (scopeFilter.value !== 'ALL' && item.scope !== scopeFilter.value) {
    return false
  }
  if (viewFilter.value === 'UNREAD') {
    return !notificationStore.isRead(item)
  }
  return true
}))

const summaryCards = computed(() => [
  {
    label: '未读通知',
    value: String(unreadCount.value),
    hint: unreadCount.value ? '还存在尚未处理或尚未消化的通知。' : '当前没有未读通知。',
  },
  {
    label: '高优先未读',
    value: String(unreadHighPriorityCount.value),
    hint: unreadHighPriorityCount.value ? '建议先处理会直接影响履约、成单或售后的通知。' : '当前没有高优先未读。',
  },
  {
    label: '主人通知',
    value: String(ownerUnreadCount.value),
    hint: '主人端建档、需求、沟通和售后相关未读。',
  },
  {
    label: '照料者通知',
    value: String(caregiverUnreadCount.value),
    hint: '照料者入驻、接单、履约和沟通相关未读。',
  },
  {
    label: '账户通知',
    value: String(accountUnreadCount.value),
    hint: '资料、设置和账户辅助相关未读。',
  },
  {
    label: '上次同步',
    value: syncedAt.value ? formatDateTime(syncedAt.value) : '--',
    hint: syncedAt.value ? '通知中心会在进入页面后重新同步。' : '当前还没有完成通知同步。',
  },
])

function getScopeLabel(scope: AppNotificationScope) {
  if (scope === 'OWNER') return '主人'
  if (scope === 'CAREGIVER') return '照料者'
  return '账户'
}

function getScopeTagType(scope: AppNotificationScope) {
  if (scope === 'OWNER') return 'primary'
  if (scope === 'CAREGIVER') return 'warning'
  return 'default'
}

function getPriorityLabel(priority: AppNotificationPriority) {
  if (priority === 'HIGH') return '优先处理'
  if (priority === 'MEDIUM') return '持续跟进'
  return '保持关注'
}

function getPriorityTagType(priority: AppNotificationPriority) {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}

function runAction(item: AppNotificationItem) {
  notificationStore.markAsRead(item)
  openPetPalAction(item.actionMode, item.actionUrl)
}

function markAsRead(item: AppNotificationItem) {
  notificationStore.markAsRead(item)
}

function markAllVisibleAsRead() {
  notificationStore.markAllAsRead(filteredItems.value)
  uni.showToast({
    title: '当前通知已标记已读',
    icon: 'none',
  })
}

function openReminders() {
  openPetPalAction('navigate', PETPAL_REMINDERS_PAGE)
}

function openMessages() {
  openPetPalAction('navigate', PETPAL_MESSAGES_PAGE)
}

function openLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function refreshNotifications(showError = false) {
  if (!tokenStore.hasLogin) {
    uni.stopPullDownRefresh()
    return
  }

  await notificationStore.refreshNotifications()

  if (showError && notificationStore.lastError) {
    uni.showToast({
      title: getErrorMessage(notificationStore.lastError, '同步通知失败'),
      icon: 'none',
    })
  }

  uni.stopPullDownRefresh()
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }

  void refreshNotifications(false)
})

onPullDownRefresh(() => {
  void refreshNotifications(true)
})
</script>

<template>
  <AppPageShell title="通知中心" :description="pageDescription">
    <template v-if="tokenStore.hasLogin">
      <AppSection title="统一通知流" description="通知中心负责统一收件、已读追踪和下一步入口；提醒中心继续负责任务优先级。">
        <view class="notification-hero">
          <view class="notification-hero__copy">
            <AppTag type="primary">
              PetPal 通知中心
            </AppTag>
            <text class="notification-hero__title">{{ displayName }}</text>
            <text class="notification-hero__summary">
              当前有 {{ unreadCount }} 条未读通知，其中 {{ unreadHighPriorityCount }} 条需要优先处理。通知中心把提醒、未读沟通和账户提示统一成可追踪的收件箱。
            </text>
          </view>
        <view class="notification-hero__actions">
            <AppButton size="medium" type="info" @click="openReminders">
              提醒中心
            </AppButton>
            <AppButton size="medium" type="info" @click="openMessages">
              消息中心
            </AppButton>
            <AppButton size="medium" :disabled="!filteredItems.length" @click="markAllVisibleAsRead">
              全部标记已读
            </AppButton>
          </view>
        </view>

        <view class="notification-summary-grid">
          <view v-for="item in summaryCards" :key="item.label" class="notification-summary-card">
            <text class="notification-summary-card__label">{{ item.label }}</text>
            <text class="notification-summary-card__value">{{ item.value }}</text>
            <text class="notification-summary-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="筛选通知" description="先按角色范围和未读状态收窄，再进入具体流程。">
        <view class="notification-filter-panel">
          <view class="notification-filter-panel__group">
            <text class="notification-filter-panel__label">通知范围</text>
            <AppChoiceChips v-model="scopeFilter" :options="scopeFilterOptions" />
          </view>
          <view class="notification-filter-panel__group">
            <text class="notification-filter-panel__label">阅读状态</text>
            <AppChoiceChips v-model="viewFilter" :options="viewFilterOptions" />
          </view>
        </view>
      </AppSection>

      <AppSection :title="filteredItems.length ? `通知列表 (${filteredItems.length})` : '通知列表'">
        <view v-if="filteredItems.length" class="notification-list">
          <view v-for="item in filteredItems" :key="item.id" class="notification-card" :class="notificationStore.isRead(item) ? 'notification-card--read' : ''">
            <view class="notification-card__header">
              <view class="notification-card__tags">
                <AppTag :type="getScopeTagType(item.scope)">
                  {{ getScopeLabel(item.scope) }}
                </AppTag>
                <AppTag :type="getPriorityTagType(item.priority)">
                  {{ getPriorityLabel(item.priority) }}
                </AppTag>
                <AppTag :type="notificationStore.isRead(item) ? 'default' : 'danger'">
                  {{ notificationStore.isRead(item) ? '已读' : '未读' }}
                </AppTag>
              </view>
              <view class="notification-card__actions">
                <AppButton
                  v-if="!notificationStore.isRead(item)"
                  size="medium"
                  type="info"
                  @click="markAsRead(item)"
                >
                  标记已读
                </AppButton>
                <AppButton size="medium" :type="item.priority === 'HIGH' ? 'danger' : 'primary'" @click="runAction(item)">
                  {{ item.actionLabel }}
                </AppButton>
              </view>
            </view>

            <text class="notification-card__title">{{ item.title }}</text>
            <text class="notification-card__summary">{{ item.summary }}</text>
            <text class="notification-card__detail">{{ item.detail }}</text>
          </view>
        </view>
        <view v-else class="notification-empty">
          <AppStatus :mode="notificationStore.loading ? 'loading' : 'empty'" :text="notificationStore.loading ? '正在同步通知中心' : '当前筛选下没有通知'" />
        </view>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="开始查看通知" description="登录后可查看统一通知流、阅读状态和下一步动作。">
        <view class="notification-empty notification-empty--login">
          <AppStatus text="当前尚未登录 PetPal 账号。" />
        </view>
        <AppButton block @click="openLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.notification-hero {
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

.notification-hero__copy {
  display: grid;
  gap: 12rpx;
}

.notification-hero__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.16;
  font-weight: 700;
}

.notification-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.notification-hero__actions,
.notification-card__tags,
.notification-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.notification-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 18rpx 24rpx 0;
}

.notification-summary-card,
.notification-filter-panel,
.notification-card {
  display: grid;
  gap: 12rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.notification-card--read {
  opacity: 0.8;
}

.notification-summary-card__label,
.notification-filter-panel__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}

.notification-summary-card__value {
  color: var(--app-text);
  font-size: 40rpx;
  line-height: 1.05;
  font-weight: 700;
}

.notification-summary-card__hint,
.notification-card__summary,
.notification-card__detail {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.notification-filter-panel,
.notification-filter-panel__group,
.notification-list {
  display: grid;
  gap: 16rpx;
}

.notification-card__header {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.notification-card__title {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.45;
  font-weight: 700;
}

.notification-empty {
  padding: 8rpx 0;
}

.notification-empty--login {
  padding-bottom: 28rpx;
}

@media (max-width: 680px) {
  .notification-summary-grid {
    grid-template-columns: 1fr;
  }

  .notification-card__header {
    flex-direction: column;
  }
}
</style>
