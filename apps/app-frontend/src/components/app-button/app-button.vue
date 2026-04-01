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
  padding: 0 32rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-full);
  background: var(--app-accent);
  color: #fff;
  box-shadow: var(--app-elevation-1);
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
  min-height: 96rpx;
}

.app-button--medium {
  min-height: 80rpx;
}

.app-button--primary {
  background: var(--app-accent);
  border-color: transparent;
  color: #fff;
}

.app-button--info {
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container-high) 100%);
  border-color: var(--app-outline-variant);
  color: var(--app-text);
  box-shadow: none;
}

.app-button--danger {
  background: var(--app-danger);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 14rpx 32rpx rgba(186, 26, 26, 0.18);
}

.app-button--hover {
  transform: translateY(-2rpx);
}

.app-button--hover.app-button--primary {
  background: var(--app-accent-pressed);
  box-shadow: var(--app-elevation-2);
}

.app-button--hover.app-button--info {
  background: var(--app-surface-container-highest);
  box-shadow: var(--app-elevation-1);
}

.app-button--hover.app-button--danger {
  background: #a61111;
  box-shadow: 0 18rpx 38rpx rgba(186, 26, 26, 0.24);
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
