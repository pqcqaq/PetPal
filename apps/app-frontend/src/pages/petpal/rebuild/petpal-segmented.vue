<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  options: Array<{ label: string, value: string, badge?: string | number }>
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

function selectOption(value: string) {
  emit('update:modelValue', value)
}
</script>

<template>
  <scroll-view class="petpal-segmented" :scroll-x="true" :show-scrollbar="false">
    <view class="petpal-segmented__track">
      <button
        v-for="item in props.options"
        :key="item.value"
        :class="[
          'petpal-segmented__item',
          props.modelValue === item.value ? 'petpal-segmented__item--active' : '',
        ]"
        hover-class="none"
        @click="selectOption(item.value)"
      >
        <text>{{ item.label }}</text>
        <text v-if="item.badge !== undefined && item.badge !== ''" class="petpal-segmented__badge">{{ item.badge }}</text>
      </button>
    </view>
  </scroll-view>
</template>
