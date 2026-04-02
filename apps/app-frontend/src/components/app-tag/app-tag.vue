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
  min-height: 44rpx;
  padding: 0 16rpx;
  border: 1rpx solid var(--app-outline-variant);
  background: rgba(255, 253, 250, 0.88);
  color: var(--app-text-secondary);
  box-sizing: border-box;
}

.app-tag--round {
  border-radius: 999rpx;
}

.app-tag--default {
  border-color: var(--app-outline-variant);
  background: rgba(255, 253, 250, 0.9);
  color: var(--app-text-secondary);
}

.app-tag--primary {
  border-color: rgba(36, 84, 211, 0.14);
  background: var(--app-accent-soft);
  color: var(--app-accent);
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
  line-height: 40rpx;
  font-weight: 600;
  white-space: nowrap;
}
</style>
