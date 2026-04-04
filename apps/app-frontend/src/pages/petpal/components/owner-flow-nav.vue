<script setup lang="ts">
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  openPetPalAction,
  openPetPalMessagesPage,
  openPetPalRemindersPage,
  ownerFlowOptions,
  PETPAL_HUB_PAGE,
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
  openPetPalMessagesPage({
    role: 'owner',
  })
}

function openReminders() {
  openPetPalRemindersPage({
    scope: 'OWNER',
  })
}
</script>

<template>
  <view class="owner-flow-nav">
    <view class="owner-flow-nav__top">
      <view class="owner-flow-nav__headline">
        <AppTag type="primary">
          主人任务
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
  gap: 16rpx;
  margin: 0 24rpx 20rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.14), transparent 36%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
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
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 30rpx;
  line-height: 1.18;
  font-weight: 700;
}

.owner-flow-nav :deep(.app-choice-chip) {
  background: rgba(255, 251, 246, 0.88);
  border-color: rgba(239, 199, 159, 0.88);
}

.owner-flow-nav :deep(.app-choice-chip--active) {
  background: linear-gradient(135deg, var(--app-accent) 0%, #60a5fa 100%);
  border-color: rgba(37, 99, 235, 0.16);
}

.owner-flow-nav__actions .app-button {
  min-width: 152rpx;
}
</style>
