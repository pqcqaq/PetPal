<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
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

const pageSubtitle = computed(() => redirectUrl.value
  ? '注册完成后直接回到你刚才的流程，不再经过介绍页。'
  : '注册完成后直接进入新的任务式首页。')

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
    title="创建账号"
    :subtitle="pageSubtitle"
    eyebrow="Register"
    back
  >
    <template v-if="tokenStore.hasLogin">
      <PetpalSection tone="success" title="当前账号已可用" subtitle="如果你已经完成注册，可以直接回到当前任务。">
        <view class="petpal-sheet">
          <text class="petpal-banner__eyebrow">Ready</text>
          <text class="petpal-banner__title">继续当前流程</text>
          <text class="petpal-banner__meta">{{ pageSubtitle }}</text>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="finishAuth">继续</button>
        </view>
      </view>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="先建立身份" subtitle="用户名和昵称会成为你在平台上的基础识别。">
        <view class="petpal-form">
          <view class="petpal-field">
            <text class="petpal-field__label">用户名</text>
            <input v-model="form.username" class="petpal-input" :maxlength="30" placeholder="请输入用户名" confirm-type="next" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">昵称</text>
            <input v-model="form.nickname" class="petpal-input" :maxlength="20" placeholder="请输入昵称" confirm-type="next" />
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="设置登录方式" subtitle="邮箱和密码只在这里填写，后续资料编辑不会混在注册页。">
        <view class="petpal-form">
          <view class="petpal-field">
            <text class="petpal-field__label">邮箱</text>
            <input v-model="form.email" class="petpal-input" :maxlength="60" placeholder="请输入邮箱" confirm-type="next" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">密码</text>
            <input
              v-model="form.password"
              class="petpal-input"
              password
              :maxlength="60"
              placeholder="请设置密码"
              confirm-type="done"
              @confirm="submit"
            />
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="已有账号" subtitle="如果只是切换设备或回到原账号，直接登录即可。">
        <button class="petpal-choice-tile" hover-class="none" @click="toLogin">
          <text class="petpal-choice-tile__eyebrow">Login</text>
          <text class="petpal-choice-tile__title">去登录</text>
          <text class="petpal-choice-tile__meta">回到登录页继续当前任务。</text>
          <text class="petpal-choice-tile__hint">注册页不再承载找回、设置和帮助内容。</text>
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">注册页只处理建号，不混入业务入口和说明性内容。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="submitting" @click="submit">
            {{ submitting ? '注册中...' : '注册并进入' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
