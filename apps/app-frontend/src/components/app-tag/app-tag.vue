<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppTag',
})

type AppTagType = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  type?: AppTagType
  round?: boolean
}>(), {
  type: 'default',
  round: true,
})

const classes = computed(() => [
  'app-tag',
  `app-tag--${props.type}`,
  props.round ? 'app-tag--round' : '',
])
</script>

<template>
  <view :class="classes">
    <text class="app-tag__text">
      <slot />
    </text>
  </view>
</template>

<style scoped lang="scss">
.app-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48rpx;
  padding: 0 18rpx;
  border: 1rpx solid rgba(239, 199, 159, 0.68);
  background: rgba(255, 255, 255, 0.64);
  color: var(--app-text-secondary);
  box-shadow: 0 8rpx 18rpx rgba(159, 73, 14, 0.08);
  box-sizing: border-box;
}

.app-tag--round {
  border-radius: 999rpx;
}

.app-tag--default {
  border-color: rgba(239, 199, 159, 0.88);
  background: rgba(255, 251, 246, 0.88);
  color: var(--app-text-secondary);
}

.app-tag--primary {
  border-color: rgba(249, 115, 22, 0.16);
  background: var(--app-brand-soft);
  color: var(--app-brand-strong);
}

.app-tag--success {
  border-color: rgba(21, 128, 61, 0.16);
  background: var(--app-success-soft);
  color: var(--app-success);
}

.app-tag--warning {
  border-color: rgba(217, 119, 6, 0.16);
  background: var(--app-warning-soft);
  color: var(--app-warning);
}

.app-tag--danger {
  border-color: rgba(220, 38, 38, 0.16);
  background: var(--app-danger-soft);
  color: var(--app-danger);
}

.app-tag__text {
  font-size: 22rpx;
  line-height: 44rpx;
  font-weight: 700;
  white-space: nowrap;
}
</style>
