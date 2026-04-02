<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppListItem',
})

const props = withDefaults(defineProps<{
  title: string
  label?: string
  value?: string
  clickable?: boolean
  isLink?: boolean
  valueEmphasis?: boolean
}>(), {
  label: '',
  value: '',
  clickable: false,
  isLink: false,
  valueEmphasis: false,
})

const emit = defineEmits<{
  (event: 'click'): void
}>()

const interactive = computed(() => props.clickable || props.isLink)

function handleClick() {
  if (!interactive.value) {
    return
  }
  emit('click')
}
</script>

<template>
  <view
    class="app-list-item"
    :class="interactive ? 'app-list-item--interactive' : ''"
    :hover-class="interactive ? 'app-list-item--hover' : ''"
    :hover-stay-time="70"
    @click="handleClick"
  >
    <view class="app-list-item__body">
      <view class="app-list-item__meta">
        <view class="app-list-item__heading">
          <text class="app-list-item__title">
            {{ title }}
          </text>
          <slot name="value">
            <text
              v-if="value"
              class="app-list-item__value"
              :class="valueEmphasis ? 'app-list-item__value--emphasis' : ''"
            >
              {{ value }}
            </text>
          </slot>
        </view>

        <text v-if="label" class="app-list-item__label">
          {{ label }}
        </text>
      </view>

      <view v-if="isLink" class="app-list-item__arrow" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-list-item {
  background: transparent;
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-list-item__body {
  display: flex;
  align-items: flex-start;
  padding: 24rpx;
}

.app-list-item__meta {
  flex: 1;
  min-width: 0;
}

.app-list-item__heading {
  display: flex;
  align-items: flex-start;
}

.app-list-item__title {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  line-height: 1.4;
  font-weight: 600;
  color: var(--app-text);
}

.app-list-item__value {
  max-width: 48%;
  margin-left: 18rpx;
  font-size: 24rpx;
  line-height: 1.45;
  color: var(--app-text-secondary);
  text-align: right;
  flex-shrink: 0;
}

.app-list-item__value--emphasis {
  color: var(--app-text);
  font-weight: 700;
}

.app-list-item__label {
  margin-top: 8rpx;
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-secondary);
  display: block;
}

.app-list-item__arrow {
  width: 14rpx;
  height: 14rpx;
  margin-top: 8rpx;
  margin-left: 16rpx;
  border-top: 2rpx solid var(--app-text-muted);
  border-right: 2rpx solid var(--app-text-muted);
  transform: rotate(45deg);
  flex-shrink: 0;
}

.app-list-item--hover {
  background: rgba(247, 241, 233, 0.92);
}
</style>
