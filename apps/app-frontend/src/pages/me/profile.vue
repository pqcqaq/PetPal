<script setup lang="ts">
import { reactive, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useManagedAvatarUpload } from '@/composables/useManagedAvatarUpload'
import { updateCurrentUserProfile } from '@/api/login'
import { useTokenStore, useUserStore } from '@/store'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { getErrorMessage, initials, openLoginPage, PETPAL_NOTIFICATIONS_PAGE, PETPAL_SETTINGS_PAGE, toast } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const userStore = useUserStore()
const upload = useManagedAvatarUpload()

const saving = ref(false)
const form = reactive({
  nickname: '',
  email: '',
})

function syncForm() {
  form.nickname = userStore.userInfo.nickname || ''
  form.email = userStore.userInfo.email || ''
}

function openSettings() {
  uni.navigateTo({ url: PETPAL_SETTINGS_PAGE })
}

function openNotifications() {
  uni.navigateTo({ url: PETPAL_NOTIFICATIONS_PAGE })
}

async function uploadAvatar() {
  try {
    const nextUser = await upload.selectAndUploadAvatar()
    userStore.setUserInfo(nextUser)
    toast('头像已更新', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '头像上传失败'))
  }
}

async function removeAvatar() {
  try {
    const nextUser = await upload.removeAvatar()
    userStore.setUserInfo(nextUser)
    toast('头像已移除', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '移除头像失败'))
  }
}

async function saveProfile() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }
  saving.value = true
  try {
    const nextUser = await updateCurrentUserProfile({
      nickname: form.nickname.trim(),
      email: form.email.trim() || null,
    })
    userStore.setUserInfo(nextUser)
    toast('资料已更新', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '保存资料失败'))
  }
  finally {
    saving.value = false
  }
}

onShow(() => {
  syncForm()
})
</script>

<template>
  <PetpalPage title="个人资料" subtitle="个人资料和系统设置分开，不再塞满同一页。" eyebrow="Profile" back :back-url="'/pages/me/me'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="头像与基础身份">
        <view class="petpal-inline">
          <view class="petpal-avatar-badge">{{ initials(userStore.userInfo.nickname || userStore.userInfo.username) }}</view>
          <view class="petpal-stack" style="gap: 6rpx;">
            <text class="petpal-banner__title">{{ userStore.userInfo.nickname || userStore.userInfo.username }}</text>
            <text class="petpal-note">{{ userStore.userInfo.username }}</text>
          </view>
        </view>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" @click="uploadAvatar">{{ upload.uploading ? '上传中...' : '上传头像' }}</button>
          <button class="petpal-btn petpal-btn--ghost" hover-class="none" @click="removeAvatar">移除头像</button>
        </view>
      </PetpalSection>

      <PetpalSection title="编辑资料">
        <view class="petpal-form">
          <view class="petpal-field">
            <text class="petpal-field__label">昵称</text>
            <input v-model="form.nickname" class="petpal-input" :maxlength="20" placeholder="请输入昵称" />
          </view>
          <view class="petpal-field">
            <text class="petpal-field__label">邮箱</text>
            <input v-model="form.email" class="petpal-input" :maxlength="60" placeholder="请输入邮箱（可留空）" />
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="快捷跳转">
        <button class="petpal-row-btn" hover-class="none" @click="openSettings">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">体验设置</text>
            <text class="petpal-row__hint">调整主题、密度和动效。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
        <button class="petpal-row-btn" hover-class="none" @click="openNotifications">
          <view class="petpal-row__copy">
            <text class="petpal-row__title">通知中心</text>
            <text class="petpal-row__hint">看资料补全和新任务提醒。</text>
          </view>
          <text class="petpal-row__value">进入</text>
        </button>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="saveProfile">
            {{ saving ? '保存中...' : '保存资料' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
