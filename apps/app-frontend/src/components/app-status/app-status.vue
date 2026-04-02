<script setup lang="ts">
defineOptions({
  name: 'AppStatus',
})

type AppStatusMode = 'empty' | 'loading'

withDefaults(defineProps<{
  mode?: AppStatusMode
  text?: string
}>(), {
  mode: 'empty',
  text: '',
})
</script>

<template>
  <view class="app-status" :class="`app-status--${mode}`">
    <view v-if="mode === 'loading'" class="app-status__spinner" />
    <view v-else class="app-status__empty-mark">
      <view class="app-status__empty-line" />
      <view class="app-status__empty-line app-status__empty-line--short" />
    </view>
    <text class="app-status__text">
      {{ text }}
    </text>
  </view>
</template>

<style scoped lang="scss">
.app-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28rpx 24rpx;
}

.app-status__spinner {
  width: 34rpx;
  height: 34rpx;
  border: 3rpx solid rgba(36, 84, 211, 0.14);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  box-sizing: border-box;
  animation: app-status-spin 0.72s linear infinite;
}

.app-status__empty-mark {
  width: 56rpx;
  height: 56rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: 999rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--app-surface);
}

.app-status__empty-line {
  width: 18rpx;
  height: 3rpx;
  border-radius: 999rpx;
  background: var(--app-border-strong);
}

.app-status__empty-line + .app-status__empty-line {
  margin-top: 8rpx;
}

.app-status__empty-line--short {
  width: 12rpx;
}

.app-status__text {
  margin-top: 14rpx;
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-secondary);
  text-align: center;
}

@keyframes app-status-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
