<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import { appApi } from '@/api/client'
import AppAvatarUploader from '@/components/app-avatar-uploader/app-avatar-uploader.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppInput from '@/components/app-input/app-input.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { PETPAL_REMINDERS_PAGE } from '@/pages/petpal/owner-shared'
import { useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: 'PetPal 资料',
  },
})

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
const hasPetPalAdminAccess = computed(() => userInfo.value.permissions.some(permission => permission.startsWith('petpal.')))

const profileDirty = computed(() => {
  const nickname = profileForm.nickname.trim()
  const email = profileForm.email.trim()
  const currentEmail = userInfo.value.email || ''
  return nickname !== userInfo.value.nickname || email !== currentEmail
})

const statusText = computed(() => userInfo.value.status === 'ACTIVE' ? '正常' : '停用')
const statusTagType = computed(() => userInfo.value.status === 'ACTIVE' ? 'success' : 'warning')
const roleSummary = computed(() => userInfo.value.roles.map(role => role.name).join('、') || '主人端账号')
const workspaceSummary = computed(() => hasPetPalAdminAccess.value ? '主人端 + 后台' : '主人端')
const profileAbilities = computed(() => [
  {
    title: '主人服务台',
    value: '已开通',
    label: '宠物档案、需求发布、订单跟进和售后主流程可直接使用。',
  },
  {
    title: '头像上传',
    value: canUploadAvatar.value ? '可用' : '受限',
    label: canUploadAvatar.value ? '当前账号可以更新头像。' : '当前账号暂未开通头像上传能力。',
  },
  {
    title: 'PetPal 后台',
    value: hasPetPalAdminAccess.value ? '可进入' : '未开通',
    label: hasPetPalAdminAccess.value ? '当前账号具备部分后台治理能力。' : '当前账号以主人端主流程为主。',
  },
  {
    title: '资料同步',
    value: '已开启',
    label: '昵称、邮箱和体验设置会跟随账号保持同步。',
  },
])
const profileSummaryCards = computed(() => [
  {
    label: '账号状态',
    value: statusText.value,
    hint: '决定账号是否可以继续访问 PetPal 主流程。',
  },
  {
    label: '当前身份',
    value: userInfo.value.roles.length ? `${userInfo.value.roles.length} 个` : '默认',
    hint: roleSummary.value,
  },
  {
    label: '工作区',
    value: workspaceSummary.value,
    hint: hasPetPalAdminAccess.value ? '当前账号同时具备治理后台权限。' : '当前账号以主人主流程为主。',
  },
  {
    label: '头像上传',
    value: canUploadAvatar.value ? '可用' : '受限',
    hint: canUploadAvatar.value ? '当前可以直接更新头像。' : '如需开放可联系管理员。',
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

onShow(() => {
  if (!tokenStore.hasLogin) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }

  void userStore.fetchUserInfo().catch(() => undefined)
})
</script>

<template>
  <AppPageShell title="PetPal 资料" description="编辑昵称、邮箱和头像，并查看当前账号在 PetPal 中的可用能力。">
    <AppSection title="资料总览" description="先确认账号状态、工作区和快捷入口，再决定是否继续编辑资料。">
      <view class="profile-hero">
        <view class="profile-hero__copy">
          <view class="app-tag-row app-tag-row--compact">
            <AppTag :type="statusTagType">
              {{ statusText }}
            </AppTag>
            <AppTag type="primary">
              {{ workspaceSummary }}
            </AppTag>
          </view>
          <view class="profile-hero__title">
            {{ userInfo.nickname || userInfo.username || 'PetPal 用户' }}
          </view>
          <view class="profile-hero__summary">
            当前身份：{{ roleSummary }}。资料、头像和体验设置都会随账号同步，减少多入口重复维护。
          </view>
        </view>
        <view class="profile-hero__actions">
          <AppButton size="medium" type="info" @click="openSettings">
            体验设置
          </AppButton>
          <AppButton size="medium" @click="openReminders">
            提醒中心
          </AppButton>
          <AppButton size="medium" type="info" @click="openAccountSupport">
            账户支持
          </AppButton>
        </view>
      </view>

      <view class="profile-summary-grid">
        <view v-for="item in profileSummaryCards" :key="item.label" class="profile-summary-card">
          <view class="profile-summary-card__label">
            {{ item.label }}
          </view>
          <view class="profile-summary-card__value">
            {{ item.value }}
          </view>
          <view class="profile-summary-card__hint">
            {{ item.hint }}
          </view>
        </view>
      </view>
    </AppSection>

    <AppSection title="头像" description="头像会在首页、消息和订单沟通场景复用。">
      <view class="profile-card-wrap">
        <AppAvatarUploader
          :avatar-url="userInfo.avatarUrl"
          :display-name="userInfo.nickname || userInfo.username"
          :disabled="!canUploadAvatar"
          @updated="handleAvatarUpdated"
        />
        <view v-if="!canUploadAvatar" class="profile-card__hint">
          当前账号暂未开通头像上传能力，如需开放可联系平台管理员处理。
        </view>
      </view>
    </AppSection>

    <AppSection title="基本资料" description="修改后会同步到当前 PetPal 账号。">
      <AppList>
        <AppInput v-model="profileForm.nickname" class="app-auth-input" label="昵称" placeholder="请输入昵称" />
        <AppInput v-model="profileForm.email" class="app-auth-input" label="邮箱" placeholder="请输入邮箱（可留空）" />
      </AppList>
      <view class="profile-actions">
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
    </AppSection>

    <AppSection title="PetPal 账户" description="这里展示账号在 PetPal 中的基础状态与身份。">
      <AppList>
        <AppListItem title="用户名" :value="userInfo.username || '--'" />
        <AppListItem title="账号状态" :value="statusText" value-emphasis />
        <AppListItem title="当前身份" :label="roleSummary" />
        <AppListItem title="邮箱状态" :value="userInfo.email ? '已绑定' : '未绑定'" />
        <AppListItem title="头像上传" :value="canUploadAvatar ? '可用' : '受限'" />
      </AppList>
      <view class="profile-tag-block">
        <view class="app-tag-row app-tag-row--compact">
          <AppTag :type="statusTagType">
            {{ statusText }}
          </AppTag>
          <AppTag v-for="role in userInfo.roles" :key="role.id" type="primary">
            {{ role.name }}
          </AppTag>
        </view>
      </view>
    </AppSection>

    <AppSection title="当前账号能力" description="围绕主人服务、头像上传和后台治理能力做快速确认。">
      <AppList>
        <AppListItem
          v-for="item in profileAbilities"
          :key="item.title"
          :title="item.title"
          :label="item.label"
          :value="item.value"
          :value-emphasis="item.value !== '未开通'"
        />
      </AppList>
    </AppSection>

    <AppSection title="帮助与辅助" description="帮助中心和账户支持页从资料页里独立出去，但在这里仍然保持直达入口。">
      <AppList>
        <AppListItem title="账户支持" label="查看账号状态、推荐动作和同步情况。" is-link clickable @click="openAccountSupport" />
        <AppListItem title="帮助中心" label="按主人、照料者、售后和账户场景查看说明。" is-link clickable @click="openHelpCenter" />
        <AppListItem title="体验设置" label="继续调整主题、首页布局和动效。" is-link clickable @click="openSettings" />
      </AppList>
    </AppSection>
  </AppPageShell>
</template>

<style scoped lang="scss">
.profile-hero {
  display: grid;
  gap: 20rpx;
  margin: 0 24rpx 18rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.22), transparent 34%),
    linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-pressed) 54%, var(--app-success) 100%);
  box-shadow: var(--app-elevation-3);
}

.profile-hero__copy {
  display: grid;
  gap: 12rpx;
}

.profile-hero__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.16;
  font-weight: 700;
}

.profile-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

.profile-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.profile-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.profile-summary-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.profile-summary-card__label {
  font-size: 22rpx;
  color: var(--app-text-muted);
}

.profile-summary-card__value {
  font-size: 34rpx;
  line-height: 1.12;
  color: var(--app-text);
  font-weight: 700;
}

.profile-summary-card__hint {
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-secondary);
}

.profile-card-wrap {
  padding: 0 32rpx;
}

.profile-card__hint {
  margin-top: 14rpx;
  font-size: 22rpx;
  line-height: 1.55;
  color: var(--app-warning);
}

.profile-actions {
  padding: 20rpx 32rpx 0;
}

.profile-tag-block {
  padding: 0 32rpx 16rpx;
  background: var(--app-surface);
  border-top: 1rpx solid var(--app-border);
  border-bottom: 1rpx solid var(--app-border);
}

@media (max-width: 680px) {
  .profile-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
