<template>
  <view />
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad(() => {
  uni.redirectTo({
    url: '/pages/petpal/index',
    fail: () => {
      uni.navigateTo({ url: '/pages/petpal/index' })
    },
  })
})
</script>
