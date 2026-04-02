<script setup lang="ts">
defineOptions({
  name: 'AppNavBar',
})

withDefaults(defineProps<{
  title: string
  showBack?: boolean
  auth?: boolean
}>(), {
  showBack: false,
  auth: false,
})

const emit = defineEmits<{
  (event: 'back'): void
}>()

function handleBack() {
  emit('back')
}
</script>

<template>
  <view :class="['app-nav-bar', auth ? 'app-nav-bar--auth' : '']">
    <view class="app-nav-bar__inner">
      <view class="app-nav-bar__side app-nav-bar__side--left">
        <view
          v-if="showBack"
          class="app-nav-bar__back"
          hover-class="app-nav-bar__back--hover"
          :hover-stay-time="80"
          @click="handleBack"
        >
          <view class="app-nav-bar__back-icon" />
        </view>
      </view>

      <view class="app-nav-bar__title">
        {{ title }}
      </view>

      <view class="app-nav-bar__side app-nav-bar__side--right">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-nav-bar {
  min-height: var(--app-nav-height);
}

.app-nav-bar__inner {
  min-height: var(--app-nav-height);
  display: flex;
  align-items: center;
  padding: 8rpx 0 14rpx;
  border-bottom: 1rpx solid rgba(226, 216, 203, 0.84);
  background: transparent;
}

.app-nav-bar__side {
  width: 72rpx;
  min-height: 72rpx;
  display: flex;
  align-items: center;
}

.app-nav-bar__side--right {
  justify-content: flex-end;
}

.app-nav-bar__back {
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(226, 216, 203, 0.92);
  background: rgba(255, 253, 250, 0.9);
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    border-color var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-nav-bar__back--hover {
  background: rgba(244, 236, 227, 0.94);
  border-color: rgba(190, 169, 150, 0.92);
  transform: translateY(-1rpx);
}

.app-nav-bar__back-icon {
  width: 16rpx;
  height: 16rpx;
  border-left: 3rpx solid var(--app-text);
  border-bottom: 3rpx solid var(--app-text);
  transform: rotate(45deg);
  margin-left: 6rpx;
}

.app-nav-bar__title {
  flex: 1;
  min-width: 0;
  font-family: 'Playfair Display', 'Noto Serif SC', 'Source Han Serif SC', serif;
  font-size: 38rpx;
  line-height: 1.08;
  font-weight: 600;
  color: var(--app-text);
  text-align: center;
  letter-spacing: -0.03em;
}

.app-nav-bar--auth .app-nav-bar__inner {
  padding: 0 10rpx;
  border: 0;
  box-shadow: none;
  background: transparent;
  backdrop-filter: none;
}

.app-nav-bar--auth .app-nav-bar__side {
  display: none;
}

.app-nav-bar--auth .app-nav-bar__title {
  text-align: left;
  font-size: 44rpx;
}
</style>
