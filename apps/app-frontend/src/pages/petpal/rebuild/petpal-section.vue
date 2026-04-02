<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'danger'
}>(), {
  title: '',
  subtitle: '',
  tone: 'default',
})
</script>

<template>
  <view :class="['petpal-section', `petpal-section--${tone}`]">
    <view v-if="title || subtitle || $slots.trailing" class="petpal-section__head">
      <view class="petpal-section__copy">
        <text v-if="title" class="petpal-section__title">{{ title }}</text>
        <text v-if="subtitle" class="petpal-section__subtitle">{{ subtitle }}</text>
      </view>
      <slot name="trailing" />
    </view>
    <view class="petpal-section__body">
      <slot />
    </view>
  </view>
</template>
