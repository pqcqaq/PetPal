<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppChoiceChips',
})

type ChoiceChipOption = {
  label: string
  value: string
  description?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: ChoiceChipOption[]
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const normalizedOptions = computed(() => props.options || [])

function handleSelect(value: string) {
  if (props.disabled || value === props.modelValue) {
    return
  }
  emit('update:modelValue', value)
}
</script>

<template>
  <view class="app-choice-chips">
    <view
      v-for="item in normalizedOptions"
      :key="item.value"
      class="app-choice-chip"
      :class="[
        item.value === modelValue ? 'app-choice-chip--active' : '',
        disabled ? 'app-choice-chip--disabled' : '',
      ]"
      :hover-class="disabled ? '' : 'app-choice-chip--hover'"
      :hover-stay-time="70"
      @click="handleSelect(item.value)"
    >
      <view class="app-choice-chip__label">
        {{ item.label }}
      </view>
      <view v-if="item.description" class="app-choice-chip__description">
        {{ item.description }}
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-choice-chips {
  display: flex;
  flex-wrap: wrap;
  margin-left: -10rpx;
  margin-bottom: -10rpx;
}

.app-choice-chip {
  min-width: 164rpx;
  margin-left: 10rpx;
  margin-bottom: 10rpx;
  padding: 18rpx 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-lg);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.04);
  transition:
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-choice-chip--hover {
  transform: translateY(-2rpx);
  box-shadow: var(--app-elevation-1);
}

.app-choice-chip--active {
  border-color: transparent;
  background: linear-gradient(180deg, var(--app-accent-soft) 0%, var(--app-surface) 100%);
  box-shadow: var(--app-elevation-1);
}

.app-choice-chip--disabled {
  opacity: 0.56;
  box-shadow: none;
}

.app-choice-chip__label {
  font-size: 24rpx;
  line-height: 1.35;
  font-weight: 700;
  color: var(--app-text);
}

.app-choice-chip__description {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.45;
  color: var(--app-text-muted);
}
</style>
