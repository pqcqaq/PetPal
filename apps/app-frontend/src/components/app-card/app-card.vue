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
  background: var(--app-surface);
  box-shadow: var(--app-card-shadow);
  overflow: hidden;
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-card__header {
  padding: 24rpx 24rpx 8rpx;
}

.app-card__title {
  font-family: 'Playfair Display', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 32rpx;
  line-height: 1.18;
  font-weight: 600;
  color: var(--app-text);
  letter-spacing: -0.03em;
}

.app-card__description {
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-secondary);
}

.app-card__body {
  padding: 18rpx 24rpx 24rpx;
}
</style>
