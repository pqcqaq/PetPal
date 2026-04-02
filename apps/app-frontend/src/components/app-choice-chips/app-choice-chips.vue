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
  margin-left: -12rpx;
  margin-bottom: -12rpx;
}

.app-choice-chip {
  min-width: 146rpx;
  margin-left: 12rpx;
  margin-bottom: 12rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid rgba(239, 199, 159, 0.88);
  border-radius: 24rpx;
  background:
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 240, 220, 0.98) 100%);
  box-shadow: 0 10rpx 22rpx rgba(159, 73, 14, 0.08);
  transition:
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-choice-chip--hover {
  transform: translateY(-2rpx);
  box-shadow: 0 16rpx 28rpx rgba(159, 73, 14, 0.12);
}

.app-choice-chip--active {
  border-color: rgba(37, 99, 235, 0.12);
  background: linear-gradient(135deg, var(--app-accent) 0%, #60a5fa 100%);
  box-shadow: 0 18rpx 30rpx rgba(37, 99, 235, 0.2);
}

.app-choice-chip--disabled {
  opacity: 0.56;
  box-shadow: none;
}

.app-choice-chip__label {
  font-size: 24rpx;
  line-height: 1.24;
  font-weight: 700;
  color: var(--app-text);
}

.app-choice-chip__description {
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.5;
  color: var(--app-text-secondary);
}

.app-choice-chip--active .app-choice-chip__label,
.app-choice-chip--active .app-choice-chip__description {
  color: #eff6ff;
}
</style>
