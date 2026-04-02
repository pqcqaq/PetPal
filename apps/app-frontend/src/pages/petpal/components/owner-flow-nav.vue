<script setup lang="ts">
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  openPetPalAction,
  ownerFlowOptions,
  PETPAL_HUB_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '../owner-shared'

defineOptions({
  name: 'OwnerFlowNav',
})

const props = defineProps<{
  currentPath: string
  title: string
  description?: string
}>()

function redirectTo(url: string) {
  if (props.currentPath === url) {
    return
  }
  openPetPalAction('redirect', url)
}

function openHub() {
  redirectTo(PETPAL_HUB_PAGE)
}

function openMessages() {
  redirectTo(PETPAL_MESSAGES_PAGE)
}

function openReminders() {
  redirectTo(PETPAL_REMINDERS_PAGE)
}
</script>

<template>
  <view class="owner-flow-nav">
    <view class="owner-flow-nav__top">
      <view class="owner-flow-nav__headline">
        <AppTag type="primary">
          当前任务
        </AppTag>
        <text class="owner-flow-nav__title">{{ title }}</text>
      </view>
      <view class="owner-flow-nav__actions">
        <AppButton size="medium" type="info" @click="openHub">切换身份</AppButton>
        <AppButton size="medium" @click="openMessages">消息</AppButton>
        <AppButton size="medium" type="danger" @click="openReminders">提醒</AppButton>
      </view>
    </view>

    <AppChoiceChips
      :model-value="currentPath"
      :options="ownerFlowOptions"
      @update:model-value="redirectTo"
    />
  </view>
</template>

<style scoped lang="scss">
.owner-flow-nav {
  display: grid;
  gap: 14rpx;
  margin: 0 24rpx 20rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.owner-flow-nav__top,
.owner-flow-nav__actions {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.owner-flow-nav__headline {
  display: flex;
  gap: 12rpx;
  align-items: center;
  flex-wrap: wrap;
}

.owner-flow-nav__title {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.2;
  font-weight: 700;
}

.owner-flow-nav :deep(.app-choice-chip) {
  background: var(--app-surface-soft);
  border-color: var(--app-outline-variant);
}

.owner-flow-nav :deep(.app-choice-chip--active) {
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
  border-color: transparent;
}

.owner-flow-nav__actions .app-button {
  min-width: 152rpx;
}
</style>
