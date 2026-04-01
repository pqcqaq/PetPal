<script setup lang="ts">
defineOptions({
  name: 'AppCard',
})

withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: '',
  description: '',
})
</script>

<template>
  <view class="app-card">
    <view v-if="title || description || $slots.header" class="app-card__header">
      <slot name="header">
        <view v-if="title" class="app-card__title">
          {{ title }}
        </view>
        <view v-if="description" class="app-card__description">
          {{ description }}
        </view>
      </slot>
    </view>

    <view class="app-card__body">
      <slot />
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-card {
  margin: 0 24rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-card__header {
  padding: 28rpx 28rpx 10rpx;
}

.app-card__title {
  font-size: 31rpx;
  line-height: 1.34;
  font-weight: 700;
  color: var(--app-text);
  letter-spacing: -0.01em;
}

.app-card__description {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.62;
  color: var(--app-text-muted);
}

.app-card__body {
  padding: 22rpx 28rpx 28rpx;
}
</style>
