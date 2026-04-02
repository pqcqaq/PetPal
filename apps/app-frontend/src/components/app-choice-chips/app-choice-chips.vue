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
  showDescriptions?: boolean
}>(), {
  disabled: false,
  showDescriptions: false,
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
      <view v-if="showDescriptions && item.description" class="app-choice-chip__description">
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
  min-width: 128rpx;
  margin-left: 10rpx;
  margin-bottom: 10rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: 999rpx;
  background: rgba(255, 253, 250, 0.9);
  transition:
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-choice-chip--hover {
  transform: translateY(-1rpx);
}

.app-choice-chip--active {
  border-color: rgba(36, 84, 211, 0.16);
  background: var(--app-accent);
}

.app-choice-chip--disabled {
  opacity: 0.56;
}

.app-choice-chip__label {
  font-size: 23rpx;
  line-height: 1.24;
  font-weight: 600;
  color: var(--app-text);
}

.app-choice-chip__description {
  margin-top: 6rpx;
  font-size: 20rpx;
  line-height: 1.45;
  color: var(--app-text-secondary);
}

.app-choice-chip--active .app-choice-chip__label,
.app-choice-chip--active .app-choice-chip__description {
  color: #eff6ff;
}
</style>
