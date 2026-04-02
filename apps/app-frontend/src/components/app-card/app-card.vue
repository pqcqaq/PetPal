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
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-card__header {
  padding: 30rpx 30rpx 8rpx;
}

.app-card__title {
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 32rpx;
  line-height: 1.24;
  font-weight: 700;
  color: var(--app-text);
  letter-spacing: -0.01em;
}

.app-card__description {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.68;
  color: var(--app-text-secondary);
}

.app-card__body {
  padding: 22rpx 30rpx 30rpx;
}
</style>
