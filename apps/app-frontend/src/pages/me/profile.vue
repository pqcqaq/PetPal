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
    <AppSection title="头像">
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

    <AppSection title="PetPal 账户">
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

    <AppSection title="当前账号能力">
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
  </AppPageShell>
</template>

<style scoped lang="scss">
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
</style>
