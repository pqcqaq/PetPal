<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppButton',
})

type AppButtonType = 'primary' | 'info' | 'default' | 'danger'
type AppButtonSize = 'large' | 'medium'

const props = withDefaults(defineProps<{
  type?: AppButtonType
  size?: AppButtonSize
  block?: boolean
  loading?: boolean
  disabled?: boolean
}>(), {
  type: 'primary',
  size: 'large',
  block: false,
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  (event: 'click'): void
}>()

const resolvedType = computed(() => props.type === 'default' ? 'info' : props.type)
const isDisabled = computed(() => props.disabled || props.loading)
const classes = computed(() => [
  'app-button',
  `app-button--${resolvedType.value}`,
  `app-button--${props.size}`,
  props.block ? 'app-button--block' : '',
  isDisabled.value ? 'is-disabled' : '',
  props.loading ? 'is-loading' : '',
])

function handleClick() {
  if (isDisabled.value) {
    return
  }
  emit('click')
}
</script>

<template>
  <view
    :class="classes"
    :hover-class="isDisabled ? '' : 'app-button--hover'"
    :hover-stay-time="80"
    @click="handleClick"
  >
    <view class="app-button__content">
      <view v-if="loading" class="app-button__spinner" />
      <text class="app-button__text">
        <slot />
      </text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 84rpx;
  padding: 0 34rpx;
  border: 1rpx solid rgba(215, 174, 133, 0.72);
  border-radius: 28rpx;
  background: linear-gradient(135deg, var(--app-accent) 0%, #60a5fa 100%);
  color: #fff;
  box-shadow: 0 18rpx 34rpx rgba(37, 99, 235, 0.24);
  box-sizing: border-box;
  transition:
    opacity var(--app-motion-duration-short) var(--app-motion-easing-standard),
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-button--block {
  display: flex;
  width: 100%;
}

.app-button--large {
  min-height: 98rpx;
}

.app-button--medium {
  min-height: 84rpx;
}

.app-button--primary {
  background: linear-gradient(135deg, var(--app-accent) 0%, #60a5fa 100%);
  border-color: rgba(37, 99, 235, 0.16);
  color: #fff;
}

.app-button--info {
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 238, 214, 0.98) 100%);
  border-color: rgba(239, 199, 159, 0.88);
  color: var(--app-text);
  box-shadow: 0 12rpx 24rpx rgba(159, 73, 14, 0.08);
}

.app-button--danger {
  background: linear-gradient(135deg, var(--app-danger) 0%, #fb7185 100%);
  border-color: rgba(220, 38, 38, 0.16);
  color: #fff;
  box-shadow: 0 16rpx 32rpx rgba(220, 38, 38, 0.22);
}

.app-button--hover {
  transform: translateY(-2rpx);
}

.app-button--hover.app-button--primary {
  background: linear-gradient(135deg, var(--app-accent-pressed) 0%, #3b82f6 100%);
  box-shadow: 0 22rpx 40rpx rgba(37, 99, 235, 0.26);
}

.app-button--hover.app-button--info {
  background: linear-gradient(180deg, #ffe9cf 0%, #fff8ef 100%);
  box-shadow: 0 16rpx 30rpx rgba(159, 73, 14, 0.12);
}

.app-button--hover.app-button--danger {
  background: linear-gradient(135deg, #b91c1c 0%, #f43f5e 100%);
  box-shadow: 0 18rpx 36rpx rgba(220, 38, 38, 0.26);
}

.app-button.is-disabled {
  opacity: 0.52;
  box-shadow: none;
}

.app-button__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.app-button__spinner {
  width: 28rpx;
  height: 28rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.36);
  border-top-color: #fff;
  border-radius: 50%;
  box-sizing: border-box;
  animation: app-button-spin 0.7s linear infinite;
}

.app-button--info .app-button__spinner {
  border-color: rgba(18, 26, 39, 0.18);
  border-top-color: var(--app-text);
}

.app-button__text {
  font-size: 28rpx;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.01em;
}

@keyframes app-button-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
