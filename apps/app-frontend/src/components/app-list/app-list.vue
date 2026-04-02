<script setup lang="ts">
defineOptions({
  name: 'AppList',
})
</script>

<template>
  <view class="app-list">
    <slot />
  </view>
</template>

<style scoped lang="scss">
.app-list {
  background: var(--app-surface);
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  box-shadow: var(--app-elevation-1);
}

:deep(.app-list-item + .app-list-item) {
  border-top: 1rpx solid var(--app-border-light);
}
</style>
