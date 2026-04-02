<script lang="ts" setup>
import { reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import { LOGIN_PAGE } from '@/router/config'
import { isPageTabbar } from '@/tabbar/store'
import { useTokenStore } from '@/store/token'
import { HOME_PAGE } from '@/utils'
import { getErrorMessage } from '@/utils/error'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '注册',
  },
})

const tokenStore = useTokenStore()
const redirectUrl = ref('')
const submitting = ref(false)
const form = reactive({
  username: '',
  nickname: '',
  email: '',
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

async function submit() {
  if (submitting.value) {
    return
  }
  if (!form.username.trim() || !form.nickname.trim() || !form.email.trim() || !form.password) {
    uni.showToast({
      title: '请完整填写注册信息',
      icon: 'none',
    })
    return
  }

  submitting.value = true
  try {
    await tokenStore.register({
      username: form.username.trim(),
      nickname: form.nickname.trim(),
      email: form.email.trim(),
      password: form.password,
    })
    finishAuth()
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '注册失败'),
      icon: 'none',
    })
  }
  finally {
    submitting.value = false
  }
}

function toLogin() {
  const url = redirectUrl.value
    ? `${LOGIN_PAGE}?redirect=${encodeURIComponent(redirectUrl.value)}`
    : LOGIN_PAGE
  uni.navigateTo({ url })
}
</script>

<template>
  <PetpalPage
    title="创建宠托帮账号"
    subtitle="注册页只保留必要字段，完成后直接进入当前设备。"
    eyebrow="Register"
    back
  >
    <PetpalSection title="填写注册信息" subtitle="昵称、邮箱和密码都会在完成后同步到当前账号。">
      <view class="app-auth-block">
        <AppInput v-model="form.username" label="用户名" clearable placeholder="请输入用户名" class="app-auth-input" />
        <AppInput v-model="form.nickname" label="昵称" clearable placeholder="请输入昵称" class="app-auth-input" />
        <AppInput v-model="form.email" label="邮箱" clearable placeholder="请输入邮箱" class="app-auth-input" />
        <AppInput
          v-model="form.password"
          label="密码"
          show-password
          placeholder="请设置密码"
          confirm-type="done"
          class="app-auth-input"
          @confirm="submit"
        />
        <AppButton block size="large" :loading="submitting" @click="submit">
          注册并进入
        </AppButton>
      </view>
    </PetpalSection>

    <PetpalSection title="已有账号" subtitle="如果只是切换设备或回到原账号，直接登录即可。">
      <button class="app-auth-link-row" hover-class="none" @click="toLogin">
        <view class="app-auth-link-row__copy">
          <text class="app-auth-link-row__title">去登录</text>
          <text class="app-auth-link-row__meta">返回登录页继续当前任务。</text>
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
