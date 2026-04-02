<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录用户，需要像收件箱一样快速清理通知
 * Entry: 我的页、提醒页、订单/资料页回流
 * First screen: 先看到最该处理的一条通知和当前未读总量
 * Primary action: 进入该通知对应的下一步
 * Secondary actions: 切角色范围、切未读/全部、批量标记已读
 * States: 未登录、无通知、仅已读、高优先未读、主人/照料者/账户分栏
 */
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { LOGIN_PAGE } from '@/router/config'
import type { AppNotificationItem, AppNotificationPriority, AppNotificationScope } from '@/store'
import { useNotificationStore, useTokenStore } from '@/store'
import { formatDateTime, openPetPalAction } from '@/pages/petpal/owner-shared'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'PetPalNotificationsPage',
})

definePage({
  style: {
    navigationBarTitleText: '通知',
    enablePullDownRefresh: true,
  },
})

type NotificationScopeFilter = 'ALL' | AppNotificationScope
type NotificationViewFilter = 'ALL' | 'UNREAD'

type ScopeCard = {
  label: string
  value: NotificationScopeFilter
  total: number
  unread: number
  hint: string
}

const tokenStore = useTokenStore()
const notificationStore = useNotificationStore()
const { items, unreadCount, unreadHighPriorityCount, ownerUnreadCount, caregiverUnreadCount, accountUnreadCount, syncedAt } = storeToRefs(notificationStore)

const scopeFilter = ref<NotificationScopeFilter>('ALL')
const viewFilter = ref<NotificationViewFilter>('UNREAD')

const viewFilterOptions = [
  { label: '未读', value: 'UNREAD', description: '先清理未读' },
  { label: '全部', value: 'ALL', description: '查看全部通知' },
]

const filteredItems = computed(() => items.value.filter((item) => {
  if (scopeFilter.value !== 'ALL' && item.scope !== scopeFilter.value) {
    return false
  }
  if (viewFilter.value === 'UNREAD') {
    return !notificationStore.isRead(item)
  }
  return true
}))

const priorityItem = computed(() => (
  filteredItems.value.find(item => !notificationStore.isRead(item) && item.priority === 'HIGH')
  ?? filteredItems.value.find(item => !notificationStore.isRead(item))
  ?? filteredItems.value[0]
  ?? null
))

const syncLabel = computed(() => syncedAt.value ? formatDateTime(syncedAt.value) : '未同步')

const focusTitle = computed(() => {
  if (!priorityItem.value) {
    return '通知已处理完'
  }
  return priorityItem.value.title
})

const focusHint = computed(() => {
  if (!priorityItem.value) {
    return '当前没有需要进入的通知。'
  }
  return priorityItem.value.summary
})

const focusActionLabel = computed(() => priorityItem.value?.actionLabel || '去处理')

const scopeCards = computed<ScopeCard[]>(() => [
  {
    label: '全部',
    value: 'ALL',
    total: items.value.length,
    unread: unreadCount.value,
    hint: items.value.length ? '全部收件' : '暂无通知',
  },
  {
    label: '主人',
    value: 'OWNER',
    total: items.value.filter(item => item.scope === 'OWNER').length,
    unread: ownerUnreadCount.value,
    hint: '下单与售后',
  },
  {
    label: '照料者',
    value: 'CAREGIVER',
    total: items.value.filter(item => item.scope === 'CAREGIVER').length,
    unread: caregiverUnreadCount.value,
    hint: '接单与履约',
  },
  {
    label: '账户',
    value: 'ACCOUNT',
    total: items.value.filter(item => item.scope === 'ACCOUNT').length,
    unread: accountUnreadCount.value,
    hint: '资料与支持',
  },
])

function formatNotificationTime(sortAt: number) {
  if (!Number.isFinite(sortAt)) {
    return '--'
  }
  return formatDateTime(new Date(sortAt).toISOString())
}

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
  if (priority === 'HIGH') return '优先'
  if (priority === 'MEDIUM') return '处理中'
  return '关注'
}

function getPriorityTagType(priority: AppNotificationPriority) {
  if (priority === 'HIGH') return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}

function setScopeFilter(value: NotificationScopeFilter) {
  scopeFilter.value = value
}

function openLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function runAction(item: AppNotificationItem) {
  notificationStore.markAsRead(item)
  openPetPalAction(item.actionMode, item.actionUrl)
}

function openPriorityItem() {
  if (!priorityItem.value) {
    return
  }
  runAction(priorityItem.value)
}

function markAllVisibleAsRead() {
  if (!filteredItems.value.length) {
    return
  }

  notificationStore.markAllAsRead(filteredItems.value)
  uni.showToast({
    title: '当前列表已标记已读',
    icon: 'none',
  })
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
  <AppPageShell title="通知">
    <template v-if="tokenStore.hasLogin">
      <view class="notify-page">
        <view class="notify-focus">
          <view class="notify-focus__copy">
            <view class="notify-focus__tags">
              <AppTag :type="unreadCount > 0 ? 'warning' : 'default'">
                {{ unreadCount > 0 ? `${unreadCount} 条未读` : '已读' }}
              </AppTag>
              <AppTag :type="unreadHighPriorityCount > 0 ? 'danger' : 'default'">
                {{ unreadHighPriorityCount > 0 ? `${unreadHighPriorityCount} 条优先` : '无高优先' }}
              </AppTag>
              <AppTag type="default">{{ syncLabel }}</AppTag>
            </view>
            <text class="notify-focus__title">{{ focusTitle }}</text>
            <text class="notify-focus__hint">{{ focusHint }}</text>
          </view>

          <view class="notify-focus__actions">
            <AppButton size="medium" :disabled="!priorityItem" @click="openPriorityItem">{{ focusActionLabel }}</AppButton>
            <AppButton size="medium" type="info" :disabled="!filteredItems.length" @click="markAllVisibleAsRead">全部已读</AppButton>
          </view>
        </view>

        <scroll-view class="notify-scope-scroll" :scroll-x="true" :show-scrollbar="false">
          <view class="notify-scope-track">
            <view
              v-for="item in scopeCards"
              :key="item.label"
              class="notify-scope-card"
              :class="scopeFilter === item.value ? 'notify-scope-card--active' : ''"
              @click="setScopeFilter(item.value)"
            >
              <view class="notify-scope-card__head">
                <text class="notify-scope-card__label">{{ item.label }}</text>
                <AppTag :type="item.unread > 0 ? 'danger' : (scopeFilter === item.value ? 'primary' : 'default')">
                  {{ item.unread > 0 ? `${item.unread} 未读` : '已读' }}
                </AppTag>
              </view>
              <text class="notify-scope-card__value">{{ item.total }}</text>
              <text class="notify-scope-card__hint">{{ item.hint }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="notify-filter">
          <text class="notify-filter__label">列表范围</text>
          <AppChoiceChips v-model="viewFilter" :options="viewFilterOptions" />
        </view>

        <view class="notify-list-block">
          <view class="notify-list-block__head">
            <text class="notify-list-block__title">{{ filteredItems.length ? `通知 ${filteredItems.length}` : '通知列表' }}</text>
            <AppTag type="default">{{ viewFilter === 'UNREAD' ? '未读优先' : '全部通知' }}</AppTag>
          </view>

          <view v-if="filteredItems.length" class="notify-list">
            <view
              v-for="item in filteredItems"
              :key="item.id"
              class="notify-card"
              :class="notificationStore.isRead(item) ? 'notify-card--read' : ''"
              @click="runAction(item)"
            >
              <view class="notify-card__head">
                <view class="notify-card__tags">
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
                <text class="notify-card__time">{{ formatNotificationTime(item.sortAt) }}</text>
              </view>

              <text class="notify-card__title">{{ item.title }}</text>
              <text class="notify-card__summary">{{ item.summary }}</text>

              <view class="notify-card__footer">
                <text class="notify-card__detail">{{ item.detail }}</text>
                <text class="notify-card__action">{{ item.actionLabel }}</text>
              </view>
            </view>
          </view>

          <view v-else class="notify-empty">
            <AppStatus :mode="notificationStore.loading ? 'loading' : 'empty'" :text="notificationStore.loading ? '正在同步通知' : '当前筛选下没有通知'" />
          </view>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="notify-login">
        <view class="notify-login__copy">
          <text class="notify-login__title">登录后查看通知</text>
          <text class="notify-login__hint">通知会按未读、优先级和业务范围统一收进来。</text>
        </view>
        <AppStatus text="先登录，再继续处理通知。" />
        <AppButton block @click="openLogin">去登录</AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.notify-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.notify-focus,
.notify-filter,
.notify-list-block,
.notify-login {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 30rpx;
  box-shadow: var(--app-elevation-1);
}

.notify-focus {
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 34%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.2), transparent 32%),
    linear-gradient(145deg, #2563eb 0%, #60a5fa 44%, #f97316 100%);
}

.notify-focus__copy {
  display: grid;
  gap: 12rpx;
}

.notify-focus__tags,
.notify-focus__actions,
.notify-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.notify-focus__title,
.notify-login__title {
  color: #eff6ff;
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 38rpx;
  line-height: 1.14;
  font-weight: 700;
}

.notify-focus__hint,
.notify-login__hint {
  color: rgba(239, 246, 255, 0.92);
  font-size: 24rpx;
  line-height: 1.7;
}

.notify-scope-scroll {
  white-space: nowrap;
}

.notify-scope-track {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.notify-scope-card {
  display: grid;
  gap: 10rpx;
  width: 240rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 26rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
  box-sizing: border-box;
}

.notify-scope-card--active {
  border-color: rgba(37, 99, 235, 0.14);
  background: linear-gradient(135deg, var(--app-accent) 0%, #60a5fa 100%);
}

.notify-scope-card--active .notify-scope-card__label,
.notify-scope-card--active .notify-scope-card__value,
.notify-scope-card--active .notify-scope-card__hint {
  color: #eff6ff;
}

.notify-scope-card__head,
.notify-list-block__head,
.notify-card__head,
.notify-card__footer {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  align-items: flex-start;
}

.notify-scope-card__label,
.notify-filter__label {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.notify-scope-card__value {
  color: var(--app-brand-strong);
  font-size: 40rpx;
  line-height: 1.08;
  font-weight: 700;
}

.notify-scope-card__hint,
.notify-card__summary,
.notify-card__detail {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.notify-filter,
.notify-list-block,
.notify-login,
.notify-card {
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
}

.notify-list,
.notify-focus__copy,
.notify-login__copy {
  display: grid;
  gap: 16rpx;
}

.notify-list-block__title,
.notify-card__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.notify-card {
  display: grid;
  gap: 14rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 26rpx;
  box-shadow: var(--app-elevation-1);
}

.notify-card--read {
  opacity: 0.74;
}

.notify-card__time,
.notify-card__action {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}

.notify-card__action {
  color: var(--app-accent);
  font-weight: 700;
}

.notify-empty {
  padding-top: 8rpx;
}

.notify-login {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
}

.notify-login__title {
  color: var(--app-text);
}

.notify-login__hint {
  color: var(--app-text-secondary);
}

@media (max-width: 680px) {
  .notify-list-block__head,
  .notify-card__head,
  .notify-card__footer {
    flex-direction: column;
  }
}
</style>
