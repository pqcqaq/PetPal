<script setup lang="ts">
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import {
  ownerFlowOptions,
  PETPAL_HUB_PAGE,
  PETPAL_WORKBENCH_PAGE,
} from '../owner-shared'

defineOptions({
  name: 'OwnerFlowNav',
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

function openCaregiverWorkbench() {
  redirectTo(`${PETPAL_WORKBENCH_PAGE}?mode=caregiver`)
}
</script>

<template>
  <view class="owner-flow-nav">
    <view class="owner-flow-nav__hero">
      <AppTag type="primary">
        主人任务流
      </AppTag>
      <text class="owner-flow-nav__title">{{ title }}</text>
      <text class="owner-flow-nav__description">{{ description }}</text>
    </view>

    <AppChoiceChips
      :model-value="currentPath"
      :options="ownerFlowOptions"
      @update:model-value="redirectTo"
    />

    <view class="owner-flow-nav__actions">
      <AppButton size="medium" type="info" @click="openHub">角色入口</AppButton>
      <AppButton size="medium" @click="openCaregiverWorkbench">照料者模式</AppButton>
    </view>
  </view>
</template>

<style scoped lang="scss">
.owner-flow-nav {
  display: grid;
  gap: 18rpx;
  margin: 0 24rpx 20rpx;
  padding: 26rpx;
  border-radius: 32rpx;
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.28), transparent 32%),
    linear-gradient(145deg, #0f766e 0%, #0f5e74 52%, #153c5a 100%);
  box-shadow: 0 18rpx 42rpx rgba(15, 23, 42, 0.14);
}

.owner-flow-nav__hero {
  display: grid;
  gap: 12rpx;
}

.owner-flow-nav__title {
  color: #f8fafc;
  font-size: 38rpx;
  line-height: 1.2;
  font-weight: 700;
}

.owner-flow-nav__description {
  color: rgba(248, 250, 252, 0.86);
  font-size: 24rpx;
  line-height: 1.7;
}

.owner-flow-nav :deep(.app-choice-chip) {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(255, 255, 255, 0.18);
}

.owner-flow-nav :deep(.app-choice-chip--active) {
  background: #e8fff9;
  border-color: #99f6e4;
}

.owner-flow-nav__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.owner-flow-nav__actions .app-button {
  min-width: 188rpx;
}
</style>
