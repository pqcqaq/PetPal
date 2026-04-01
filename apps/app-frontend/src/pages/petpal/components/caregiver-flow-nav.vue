<script setup lang="ts">
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  caregiverFlowOptions,
  PETPAL_HUB_PAGE,
  PETPAL_MESSAGES_PAGE,
  PETPAL_REMINDERS_PAGE,
} from '../owner-shared'

defineOptions({
  name: 'CaregiverFlowNav',
})

const props = defineProps<{
  currentPath: string
  title: string
  description: string
}>()

function redirectTo(url: string) {
  if (props.currentPath === url) {
    return
  }
  uni.redirectTo({ url })
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
  <view class="caregiver-flow-nav">
    <view class="caregiver-flow-nav__hero">
      <AppTag type="warning">
        照料者任务流
      </AppTag>
      <text class="caregiver-flow-nav__title">{{ title }}</text>
      <text class="caregiver-flow-nav__description">{{ description }}</text>
    </view>

    <AppChoiceChips
      :model-value="currentPath"
      :options="caregiverFlowOptions"
      @update:model-value="redirectTo"
    />

    <view class="caregiver-flow-nav__actions">
      <AppButton size="medium" type="info" @click="openHub">角色入口</AppButton>
      <AppButton size="medium" @click="openMessages">消息中心</AppButton>
      <AppButton size="medium" type="danger" @click="openReminders">提醒中心</AppButton>
    </view>
  </view>
</template>

<style scoped lang="scss">
.caregiver-flow-nav {
  display: grid;
  gap: 18rpx;
  margin: 0 24rpx 20rpx;
  padding: 26rpx;
  border-radius: 32rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 32%),
    linear-gradient(145deg, #7c2d12 0%, #9a3412 42%, #b45309 100%);
  box-shadow: 0 18rpx 42rpx rgba(15, 23, 42, 0.14);
}

.caregiver-flow-nav__hero {
  display: grid;
  gap: 12rpx;
}

.caregiver-flow-nav__title {
  color: #fff7ed;
  font-size: 38rpx;
  line-height: 1.2;
  font-weight: 700;
}

.caregiver-flow-nav__description {
  color: rgba(255, 247, 237, 0.88);
  font-size: 24rpx;
  line-height: 1.7;
}

.caregiver-flow-nav :deep(.app-choice-chip) {
  background: rgba(255, 250, 245, 0.94);
  border-color: rgba(255, 255, 255, 0.18);
}

.caregiver-flow-nav :deep(.app-choice-chip--active) {
  background: #fff1e6;
  border-color: #fdba74;
}

.caregiver-flow-nav__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.caregiver-flow-nav__actions .app-button {
  min-width: 188rpx;
}
</style>
