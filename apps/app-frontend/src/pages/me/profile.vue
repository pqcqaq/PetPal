<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录用户，需要修改头像、昵称和邮箱
 * Entry: 我的页进入、订单或消息页补资料回流
 * First screen: 直接看到头像和可编辑资料，不先展示能力说明
 * Primary action: 保存昵称和邮箱，必要时更换头像
 * Secondary actions: 提醒、设置、帮助、账户支持
 * States: 资料未修改、资料待保存、头像不可上传、账号同步中
 */
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { appApi } from '@/api/client'
import AppAvatarUploader from '@/components/app-avatar-uploader/app-avatar-uploader.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { PETPAL_REMINDERS_PAGE } from '@/pages/petpal/owner-shared'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

defineOptions({
  name: 'PetPalProfilePage',
})

definePage({
  style: {
    navigationBarTitleText: '个人资料',
    enablePullDownRefresh: true,
  },
})

type ShortcutItem = {
  title: string
  value: string
  hint: string
  action: () => void
}

type AccountRow = {
  title: string
  value: string
  hint: string
}

const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const HELP_PAGE = '/pages/help/index'
const ACCOUNT_SUPPORT_PAGE = '/pages/account/support'

const savingProfile = ref(false)
const profileForm = reactive({
  nickname: '',
  email: '',
})

const canUploadAvatar = computed(() => {
  const permissions = userInfo.value.permissions || []
  return permissions.includes('file.upload.avatar') || permissions.includes('file.upload')
})

const profileDirty = computed(() => {
  const nickname = profileForm.nickname.trim()
  const email = profileForm.email.trim()
  const currentEmail = userInfo.value.email || ''
  return nickname !== userInfo.value.nickname || email !== currentEmail
})

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || 'PetPal 用户')
const accountMeta = computed(() => userInfo.value.username || '账户同步中')
const statusTagType = computed(() => {
  if (!userInfo.value.status) {
    return 'default'
  }
  return userInfo.value.status === 'ACTIVE' ? 'success' : 'warning'
})
const statusTagText = computed(() => {
  if (!userInfo.value.status) {
    return '同步中'
  }
  return userInfo.value.status === 'ACTIVE' ? '账号正常' : '账号受限'
})
const emailTagText = computed(() => userInfo.value.email ? '邮箱已绑定' : '待补邮箱')
const formHint = computed(() => profileDirty.value ? '资料有改动，保存后会同步到首页、消息和订单页显示。' : '当前资料已是最新状态。')

const shortcutItems = computed<ShortcutItem[]>(() => [
  {
    title: '提醒',
    value: '查看',
    hint: '待办和售后提醒',
    action: openReminders,
  },
  {
    title: '设置',
    value: '调整',
    hint: '通知和界面选项',
    action: openSettings,
  },
  {
    title: '帮助',
    value: '查看',
    hint: '常见问题',
    action: openHelpCenter,
  },
  {
    title: '支持',
    value: '联系',
    hint: '账号异常处理',
    action: openAccountSupport,
  },
])

const accountRows = computed<AccountRow[]>(() => [
  {
    title: '用户名',
    value: userInfo.value.username || '--',
    hint: '用于登录和账号识别',
  },
  {
    title: '账号状态',
    value: statusTagText.value,
    hint: '影响是否可继续使用主流程',
  },
  {
    title: '邮箱',
    value: userInfo.value.email || '未绑定',
    hint: '建议用于接收订单和售后通知',
  },
])

function syncProfileForm() {
  profileForm.nickname = userInfo.value.nickname || ''
  profileForm.email = userInfo.value.email || ''
}

watch(() => userInfo.value.id, () => {
  syncProfileForm()
}, { immediate: true })

function handleAvatarUpdated(user: typeof userInfo.value) {
  userStore.setUserInfo(user)
  syncProfileForm()
}

function openSettings() {
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openReminders() {
  uni.navigateTo({ url: PETPAL_REMINDERS_PAGE })
}

function openHelpCenter() {
  uni.navigateTo({ url: HELP_PAGE })
}

function openAccountSupport() {
  uni.navigateTo({ url: ACCOUNT_SUPPORT_PAGE })
}

async function handleSaveProfile() {
  if (!tokenStore.hasLogin || savingProfile.value) {
    return
  }

  const nickname = profileForm.nickname.trim()
  const emailRaw = profileForm.email.trim()

  if (nickname.length < 2 || nickname.length > 24) {
    uni.showToast({
      title: '昵称长度需在 2-24 个字符',
      icon: 'none',
    })
    return
  }

  if (emailRaw && !/^\S+@\S+\.\S+$/.test(emailRaw)) {
    uni.showToast({
      title: '邮箱格式不正确',
      icon: 'none',
    })
    return
  }

  savingProfile.value = true
  try {
    const nextUser = await appApi.auth.updateProfile({
      nickname,
      email: emailRaw || null,
    })
    userStore.setUserInfo(nextUser)
    uni.showToast({
      title: '资料已更新',
      icon: 'none',
    })
  }
  catch (error: unknown) {
    uni.showToast({
      title: getErrorMessage(error, '资料更新失败'),
      icon: 'none',
    })
  }
  finally {
    savingProfile.value = false
  }
}

async function loadProfile(showError = false) {
  if (!tokenStore.hasLogin) {
    uni.stopPullDownRefresh()
    return
  }

  try {
    await userStore.fetchUserInfo()
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载资料失败'),
        icon: 'none',
      })
    }
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }

  void loadProfile(false)
})

onPullDownRefresh(() => {
  void loadProfile(true)
})
</script>

<template>
  <AppPageShell title="个人资料">
    <view class="profile-page">
      <view class="profile-head">
        <view class="profile-head__copy">
          <text class="profile-head__name">{{ displayName }}</text>
          <text class="profile-head__meta">{{ accountMeta }}</text>
          <view class="profile-head__tags">
            <AppTag :type="statusTagType">
              {{ statusTagText }}
            </AppTag>
            <AppTag :type="userInfo.email ? 'primary' : 'default'">
              {{ emailTagText }}
            </AppTag>
          </view>
        </view>

        <AppAvatarUploader
          :avatar-url="userInfo.avatarUrl"
          :display-name="displayName"
          :disabled="!canUploadAvatar"
          @updated="handleAvatarUpdated"
        />

        <text v-if="!canUploadAvatar" class="profile-head__hint">
          当前账号暂未开通头像上传，可先保存昵称和邮箱。
        </text>
      </view>

      <scroll-view class="profile-shortcut-scroll" :scroll-x="true" :show-scrollbar="false">
        <view class="profile-shortcut-track">
          <view
            v-for="item in shortcutItems"
            :key="item.title"
            class="profile-shortcut-card"
            @click="item.action"
          >
            <text class="profile-shortcut-card__title">{{ item.title }}</text>
            <text class="profile-shortcut-card__value">{{ item.value }}</text>
            <text class="profile-shortcut-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="profile-form">
        <view class="profile-form__head">
          <text class="profile-form__title">基本资料</text>
          <AppTag :type="profileDirty ? 'warning' : 'default'">
            {{ profileDirty ? '待保存' : '已同步' }}
          </AppTag>
        </view>

        <view class="profile-input-group">
          <AppInput v-model="profileForm.nickname" clearable label="昵称" placeholder="请输入昵称" />
          <AppInput v-model="profileForm.email" clearable label="邮箱" placeholder="请输入邮箱（可留空）" />
        </view>

        <text class="profile-form__hint">{{ formHint }}</text>

        <AppButton
          block
          size="large"
          :loading="savingProfile"
          :disabled="!profileDirty"
          @click="handleSaveProfile"
        >
          保存资料
        </AppButton>
      </view>

      <view class="profile-group">
        <view
          v-for="item in accountRows"
          :key="item.title"
          class="profile-row"
        >
          <view class="profile-row__copy">
            <text class="profile-row__title">{{ item.title }}</text>
            <text class="profile-row__hint">{{ item.hint }}</text>
          </view>
          <text class="profile-row__value">{{ item.value }}</text>
        </view>
      </view>

      <view class="profile-support">
        <AppStatus text="资料保存后会同步到首页、消息和订单等显示位置。" />
      </view>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.profile-page {
  display: grid;
  gap: 20rpx;
  padding-bottom: 36rpx;
}

.profile-head,
.profile-form,
.profile-group,
.profile-support {
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 30rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
}

.profile-head__copy,
.profile-form__head,
.profile-row__copy {
  display: grid;
  gap: 8rpx;
}

.profile-head__name,
.profile-form__title,
.profile-row__title {
  color: var(--app-text);
  font-family: 'Varela Round', 'Nunito Sans', 'PingFang SC', sans-serif;
  font-size: 30rpx;
  line-height: 1.22;
  font-weight: 700;
}

.profile-head__meta,
.profile-head__hint,
.profile-shortcut-card__hint,
.profile-form__hint,
.profile-row__hint {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.7;
}

.profile-head__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.profile-shortcut-scroll {
  white-space: nowrap;
}

.profile-shortcut-track {
  display: inline-flex;
  gap: 16rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.profile-shortcut-card {
  display: grid;
  gap: 10rpx;
  width: 220rpx;
  padding: 24rpx;
  border: 1rpx solid rgba(245, 220, 192, 0.88);
  border-radius: 26rpx;
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 246, 0.98) 0%, rgba(255, 242, 225, 0.98) 100%);
  box-shadow: var(--app-elevation-1);
  box-sizing: border-box;
}

.profile-shortcut-card__title {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.profile-shortcut-card__value,
.profile-row__value {
  color: var(--app-text);
  font-size: 28rpx;
  line-height: 1.32;
  font-weight: 700;
}

.profile-input-group {
  display: grid;
  gap: 8rpx;
  border-radius: 24rpx;
  background: rgba(255, 251, 246, 0.92);
  overflow: hidden;
}

.profile-input-group :deep(.app-input) + :deep(.app-input) {
  border-top: 1rpx solid rgba(245, 220, 192, 0.88);
}

.profile-group {
  padding: 0;
  overflow: hidden;
}

.profile-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: center;
  padding: 24rpx 28rpx;
}

.profile-row + .profile-row {
  border-top: 1rpx solid rgba(245, 220, 192, 0.88);
}

.profile-support {
  background:
    radial-gradient(circle at top right, rgba(249, 115, 22, 0.16), transparent 34%),
    linear-gradient(180deg, #fff0dd 0%, rgba(255, 251, 246, 0.98) 100%);
}

@media (max-width: 680px) {
  .profile-row {
    align-items: flex-start;
  }
}
</style>
