<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  type AppNotificationItem,
  type AppNotificationScope,
  useNotificationStore,
} from '@/store'
import {
  openPetPalAction,
  PETPAL_NOTIFICATIONS_PAGE,
} from '../owner-shared'

defineOptions({
  name: 'PetPalActionSignalCard',
})

const props = withDefaults(defineProps<{
  title: string
  description?: string
  scope?: AppNotificationScope | 'ALL'
  emptyText?: string
}>(), {
  scope: 'ALL',
  description: '',
  emptyText: '当前没有新的优先事项，可以继续按既有节奏推进。',
})

const notificationStore = useNotificationStore()

const visibleItems = computed(() => {
  if (props.scope === 'ALL') {
    return notificationStore.items
  }
  return notificationStore.items.filter(item => item.scope === props.scope)
})

const activeItem = computed<AppNotificationItem | null>(() => {
  const unreadItem = visibleItems.value.find(item => !notificationStore.isRead(item))
  return unreadItem || visibleItems.value[0] || null
})

const toneClass = computed(() => {
  const scope = activeItem.value?.scope || props.scope
  if (scope === 'OWNER') return 'action-signal-card--owner'
  if (scope === 'CAREGIVER') return 'action-signal-card--caregiver'
  return 'action-signal-card--account'
})

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

function getPriorityLabel(priority: AppNotificationItem['priority']) {
  if (priority === 'HIGH') return '优先处理'
  if (priority === 'MEDIUM') return '持续跟进'
  return '保持关注'
}

function getPriorityTagType(priority: AppNotificationItem['priority']) {
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
  uni.showToast({
    title: '已标记稍后处理',
    icon: 'none',
  })
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}
</script>

<template>
  <view class="action-signal-card" :class="toneClass">
    <template v-if="activeItem">
      <view class="action-signal-card__header">
        <view class="action-signal-card__tags">
          <AppTag :type="getScopeTagType(activeItem.scope)">
            {{ getScopeLabel(activeItem.scope) }}
          </AppTag>
          <AppTag :type="getPriorityTagType(activeItem.priority)">
            {{ getPriorityLabel(activeItem.priority) }}
          </AppTag>
          <AppTag :type="notificationStore.isRead(activeItem) ? 'default' : 'danger'">
            {{ notificationStore.isRead(activeItem) ? '已读' : '未读' }}
          </AppTag>
        </view>
        <AppButton size="medium" type="info" @click="openNotifications">
          全部通知
        </AppButton>
      </view>

      <text class="action-signal-card__eyebrow">{{ title }}</text>
      <text class="action-signal-card__title">{{ activeItem.title }}</text>
      <text class="action-signal-card__summary">{{ activeItem.summary }}</text>
      <text class="action-signal-card__detail">{{ activeItem.detail }}</text>

      <view class="action-signal-card__actions">
        <AppButton size="medium" :type="activeItem.priority === 'HIGH' ? 'danger' : 'primary'" @click="runAction(activeItem)">
          {{ activeItem.actionLabel }}
        </AppButton>
        <AppButton
          v-if="!notificationStore.isRead(activeItem)"
          size="medium"
          type="info"
          @click="markAsRead(activeItem)"
        >
          稍后处理
        </AppButton>
      </view>
    </template>

    <template v-else>
      <view class="action-signal-card__empty">
        <AppTag type="success">
          当前平稳
        </AppTag>
        <text class="action-signal-card__eyebrow">{{ title }}</text>
        <text class="action-signal-card__title">当前没有新的优先事项</text>
        <text class="action-signal-card__detail">{{ emptyText }}</text>
        <view class="action-signal-card__actions">
          <AppButton size="medium" type="info" @click="openNotifications">
            查看通知中心
          </AppButton>
        </view>
      </view>
    </template>

    <view v-if="notificationStore.loading && !activeItem" class="action-signal-card__loading">
      <AppStatus mode="loading" text="正在同步主动信号" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.action-signal-card {
  display: grid;
  gap: 14rpx;
  padding: 26rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
}

.action-signal-card--owner {
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.18), transparent 36%),
    linear-gradient(180deg, #eef5ff 0%, rgba(255, 251, 246, 0.98) 100%);
}

.action-signal-card--caregiver {
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.2), transparent 36%),
    linear-gradient(180deg, #fff1e1 0%, rgba(255, 251, 246, 0.98) 100%);
}

.action-signal-card--account {
  background:
    radial-gradient(circle at top right, rgba(21, 128, 61, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-success-soft) 0%, rgba(255, 251, 246, 0.98) 100%);
}

.action-signal-card__header,
.action-signal-card__actions {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  align-items: flex-start;
  flex-wrap: wrap;
}

.action-signal-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.action-signal-card__eyebrow {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}

.action-signal-card__title {
  color: var(--app-text);
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 30rpx;
  line-height: 1.28;
  font-weight: 700;
}

.action-signal-card__summary,
.action-signal-card__detail {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.74;
}

.action-signal-card__empty,
.action-signal-card__loading {
  display: grid;
  gap: 14rpx;
}
</style>
