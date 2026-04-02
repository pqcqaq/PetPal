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
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.08), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: var(--app-shape-xl);
  box-shadow: var(--app-elevation-1);
}

:deep(.app-list-item + .app-list-item) {
  border-top: 1rpx solid var(--app-border-light);
}
</style>
