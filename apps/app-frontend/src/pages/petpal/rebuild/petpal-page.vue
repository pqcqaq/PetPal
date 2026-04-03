<script setup lang="ts">
import { ensurePetPalStartup } from '@/petpal/startup'

ensurePetPalStartup()

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  eyebrow?: string
  back?: boolean
  backUrl?: string
  withTabbar?: boolean
}>(), {
  subtitle: '',
  eyebrow: '',
  back: false,
  backUrl: '',
  withTabbar: false,
})

function handleBack() {
  uni.navigateBack({
    delta: 1,
    fail: () => {
      if (!props.backUrl) {
        return
      }
      uni.redirectTo({
        url: props.backUrl,
        fail: () => {
          uni.navigateTo({ url: props.backUrl })
        },
      })
    },
  })
}
</script>

<template>
  <view :class="['petpal-page', withTabbar ? 'petpal-page--tabbar' : '']">
    <view class="petpal-page__top">
      <view class="petpal-page__bar">
        <button
          v-if="back"
          class="petpal-icon-btn"
          hover-class="none"
          @click="handleBack"
        >
          返回
        </button>
        <view v-else class="petpal-page__bar-spacer" />
        <slot name="bar" />
      </view>
      <view class="petpal-page__hero">
        <text v-if="eyebrow" class="petpal-page__eyebrow">{{ eyebrow }}</text>
        <view class="petpal-page__heading">
          <view class="petpal-page__copy">
            <text class="petpal-page__title">{{ title }}</text>
            <text v-if="subtitle" class="petpal-page__subtitle">{{ subtitle }}</text>
          </view>
          <slot name="hero-side" />
        </view>
        <slot name="hero" />
      </view>
    </view>
    <view class="petpal-page__content">
      <slot />
    </view>
    <slot name="footer" />
  </view>
</template>
