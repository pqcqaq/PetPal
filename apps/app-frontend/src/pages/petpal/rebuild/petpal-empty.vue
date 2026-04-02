<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <view class="petpal-empty">
    <text class="petpal-empty__title">{{ title }}</text>
    <text v-if="description" class="petpal-empty__description">{{ description }}</text>
    <slot />
  </view>
</template>
