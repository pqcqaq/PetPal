<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
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

const destinationTitle = computed(() => redirectUrl.value ? '继续之前的流程' : '进入新的首页分流')
const destinationHint = computed(() => redirectUrl.value
  ? '登录成功后会直接回到你刚才离开的页面，不再经过多余介绍页。'
  : '登录成功后会进入新的任务式首页，再按主人或照料者角色继续。')

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
    title="登录账号"
    :subtitle="destinationHint"
    eyebrow="Login"
    back
  >
    <template v-if="tokenStore.hasLogin">
      <PetpalSection tone="success" title="当前账号已登录" subtitle="如果你只是误入登录页，直接继续当前任务即可。">
        <view class="petpal-sheet">
          <text class="petpal-banner__eyebrow">Current</text>
          <text class="petpal-banner__title">{{ destinationTitle }}</text>
          <text class="petpal-banner__meta">{{ destinationHint }}</text>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="finishAuth">继续</button>
        </view>
      </view>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="登录后的去向" :subtitle="destinationTitle">
        <view class="petpal-sheet">
          <text class="petpal-banner__eyebrow">Next</text>
          <text class="petpal-banner__title">{{ destinationTitle }}</text>
          <text class="petpal-banner__meta">{{ destinationHint }}</text>
        </view>
      </PetpalSection>

      <PetpalSection title="输入账号信息" subtitle="只保留账号和密码两个字段。">
        <view class="petpal-form">
          <view class="petpal-field">
            <text class="petpal-field__label">账号</text>
            <input
              v-model="form.account"
              class="petpal-input"
              :maxlength="60"
              placeholder="用户名或邮箱"
              confirm-type="next"
            />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">密码</text>
            <input
              v-model="form.password"
              class="petpal-input"
              password
              :maxlength="60"
              placeholder="请输入密码"
              confirm-type="done"
              @confirm="doLogin"
            />
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="还没有账号" subtitle="注册完成后也会直接回到当前流程。">
        <button class="petpal-choice-tile" hover-class="none" @click="toRegister">
          <text class="petpal-choice-tile__eyebrow">Register</text>
          <text class="petpal-choice-tile__title">去注册</text>
          <text class="petpal-choice-tile__meta">创建新的宠托帮账号。</text>
          <text class="petpal-choice-tile__hint">不会再跳到单独介绍页。</text>
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">登录页只处理身份验证，不混入介绍、通知和业务列表。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="submitting" @click="doLogin">
            {{ submitting ? '登录中...' : '登录并继续' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
