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
  padding: 34rpx 32rpx;
}

.app-status__spinner {
  width: 40rpx;
  height: 40rpx;
  border: 4rpx solid rgba(37, 99, 235, 0.16);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  box-sizing: border-box;
  animation: app-status-spin 0.72s linear infinite;
}

.app-status__empty-mark {
  width: 72rpx;
  height: 72rpx;
  border: 1rpx solid rgba(239, 199, 159, 0.88);
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.16), transparent 30%),
    rgba(255, 251, 246, 0.86);
  box-shadow: 0 12rpx 24rpx rgba(159, 73, 14, 0.08);
}

.app-status__empty-line {
  width: 24rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: var(--app-border-strong);
}

.app-status__empty-line + .app-status__empty-line {
  margin-top: 8rpx;
}

.app-status__empty-line--short {
  width: 16rpx;
}

.app-status__text {
  margin-top: 18rpx;
  font-size: 24rpx;
  line-height: 1.7;
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
