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
  padding: 14rpx 20rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.72);
  border-radius: var(--app-shape-lg);
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.96) 0%, rgba(255, 239, 218, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
  backdrop-filter: blur(18px);
}

.app-nav-bar__side {
  width: 84rpx;
  min-height: 84rpx;
  display: flex;
  align-items: center;
}

.app-nav-bar__side--right {
  justify-content: flex-end;
}

.app-nav-bar__back {
  width: 72rpx;
  height: 72rpx;
  border-radius: var(--app-shape-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(240, 199, 159, 0.76);
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.18), transparent 30%),
    linear-gradient(180deg, var(--app-brand-soft) 0%, rgba(255, 255, 255, 0.96) 100%);
  box-shadow: 0 14rpx 28rpx rgba(159, 73, 14, 0.14);
  transition:
    transform var(--app-motion-duration-short) var(--app-motion-easing-emphasis),
    background-color var(--app-motion-duration-medium) var(--app-motion-easing-standard),
    box-shadow var(--app-motion-duration-medium) var(--app-motion-easing-standard);
}

.app-nav-bar__back--hover {
  background: linear-gradient(180deg, #ffe7ca 0%, #fff8ef 100%);
  transform: translateY(-2rpx);
  box-shadow: 0 18rpx 32rpx rgba(159, 73, 14, 0.16);
}

.app-nav-bar__back-icon {
  width: 20rpx;
  height: 20rpx;
  border-left: 4rpx solid var(--app-brand-strong);
  border-bottom: 4rpx solid var(--app-brand-strong);
  transform: rotate(45deg);
  margin-left: 8rpx;
}

.app-nav-bar__title {
  flex: 1;
  min-width: 0;
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 34rpx;
  line-height: 1.16;
  font-weight: 700;
  color: var(--app-text);
  text-align: center;
  letter-spacing: -0.02em;
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
  font-size: 42rpx;
}
</style>
