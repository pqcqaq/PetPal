<script lang="ts" setup>
import { reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import { REGISTER_PAGE } from '@/router/config'
import { isPageTabbar } from '@/tabbar/store'
import { useTokenStore } from '@/store/token'
import { HOME_PAGE } from '@/utils'
import { getErrorMessage } from '@/utils/error'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '登录',
  },
})

const tokenStore = useTokenStore()
const redirectUrl = ref('')
const submitting = ref(false)
const form = reactive({
  account: '',
  password: '',
})

function normalizeRedirect(value?: string) {
  if (!value) {
    return ''
  }
  try {
    return decodeURIComponent(value)
  }
  catch {
    return value
  }
}

function finishAuth() {
  const url = redirectUrl.value || HOME_PAGE
  if (isPageTabbar(url)) {
    uni.switchTab({ url })
    return
  }
  uni.reLaunch({ url })
}

onLoad((options) => {
  redirectUrl.value = normalizeRedirect(typeof options?.redirect === 'string' ? options.redirect : '')
})

async function doLogin() {
  if (submitting.value) {
    return
  }
  if (tokenStore.hasLogin) {
    finishAuth()
    return
  }
  if (!form.account.trim() || !form.password) {
    uni.showToast({
      title: '请输入账号和密码',
      icon: 'none',
    })
    return
  }

  submitting.value = true
  try {
    await tokenStore.login({
      account: form.account.trim(),
      password: form.password,
    })
    finishAuth()
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '登录失败'),
      icon: 'none',
    })
  }
  finally {
    submitting.value = false
  }
}

function toRegister() {
  const url = redirectUrl.value
    ? `${REGISTER_PAGE}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : REGISTER_PAGE
  uni.navigateTo({ url })
}
</script>

<template>
  <PetpalPage
    title="进入宠托帮"
    subtitle="登录页只保留输入和跳转，不展示多余介绍。"
    eyebrow="Login"
    back
  >
    <PetpalSection title="账号登录" subtitle="使用账号和密码继续当前任务。">
      <view class="app-auth-block">
        <AppInput
          v-model="form.account"
          label="账号"
          clearable
          placeholder="用户名或邮箱"
          confirm-type="next"
          class="app-auth-input"
        />
        <AppInput
          v-model="form.password"
          label="密码"
          show-password
          placeholder="请输入密码"
          confirm-type="done"
          class="app-auth-input"
          @confirm="doLogin"
        />
        <AppButton block size="large" :loading="submitting" @click="doLogin">
          登录
        </AppButton>
      </view>
    </PetpalSection>

    <PetpalSection title="还没有账号" subtitle="注册后会直接回到当前设备。">
      <button class="app-auth-link-row" hover-class="none" @click="toRegister">
        <view class="app-auth-link-row__copy">
          <text class="app-auth-link-row__title">去注册</text>
          <text class="app-auth-link-row__meta">创建一个新的主人服务账号。</text>
        </view>
        <text class="app-auth-link-row__value">进入</text>
      </button>
    </PetpalSection>
  </PetpalPage>
</template>

<style scoped lang="scss">
.app-auth-block {
  display: grid;
  gap: 20rpx;
}

.app-auth-link-row {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
}

.app-auth-link-row__copy {
  display: grid;
  gap: 8rpx;
}

.app-auth-link-row__title {
  font-size: 30rpx;
  color: var(--app-text);
  font-weight: 700;
}

.app-auth-link-row__meta,
.app-auth-link-row__value {
  font-size: 24rpx;
  color: var(--app-text-secondary);
}
</style>
