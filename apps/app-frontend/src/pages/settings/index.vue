<script lang="ts" setup>
import type {
  AppDensityMode,
  AppPortalLayout,
  AppSurfaceStyle,
  AppTabbarStyle,
  AppThemeMode,
  AppThemePresetId,
  UserAppPreferences,
} from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppChoiceChips from '@/components/app-choice-chips/app-choice-chips.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import { defaultAppPreferences, useUiStore } from '@/store/ui'
import { useUserStore } from '@/store/user'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: 'PetPal 设置',
  },
})

const uiStore = useUiStore()
const userStore = useUserStore()
const tokenStore = useTokenStore()
const { userInfo } = storeToRefs(userStore)

const saving = ref(false)
const draft = reactive<UserAppPreferences>({
  ...defaultAppPreferences,
})

const themeModeOptions = [
  { label: '跟随系统', value: 'auto', description: '根据系统深浅色切换 PetPal 界面' },
  { label: '浅色', value: 'light', description: '适合白天和强光环境' },
  { label: '深色', value: 'dark', description: '适合夜间和低亮环境' },
]

const themePresetOptions = [
  { label: '石墨', value: 'graphite', description: '稳重中性色，适合后台感工作流' },
  { label: '海洋', value: 'ocean', description: '清爽蓝青，适合信息阅读' },
  { label: '森林', value: 'forest', description: '偏服务行业的自然绿' },
  { label: '落日', value: 'sunset', description: '更鲜明的暖色强调' },
]

const surfaceOptions = [
  { label: '柔和卡片', value: 'soft', description: '轻微层次与阴影' },
  { label: '实心卡片', value: 'solid', description: '信息块更沉稳、更直给' },
  { label: '玻璃卡片', value: 'glass', description: '适合更轻盈的视觉层次' },
]

const densityOptions = [
  { label: '舒适', value: 'comfortable', description: '信息节奏更从容' },
  { label: '紧凑', value: 'compact', description: '一屏展示更多订单与档案信息' },
]

const tabbarOptions = [
  { label: '悬浮底栏', value: 'floating', description: '更轻、更贴近移动端产品气质' },
  { label: '贴边底栏', value: 'solid', description: '更稳定、更像传统业务工具' },
]

const portalLayoutOptions = [
  { label: '概览看板', value: 'overview', description: '首页展示完整业务概览与推荐信息' },
  { label: '聚焦办事', value: 'focus', description: '首页优先展示关键动作与少量核心信息' },
]

const hasChanges = computed(() => {
  return (
    draft.themeMode !== uiStore.preferences.themeMode
    || draft.themePresetId !== uiStore.preferences.themePresetId
    || draft.surfaceStyle !== uiStore.preferences.surfaceStyle
    || draft.density !== uiStore.preferences.density
    || draft.tabbarStyle !== uiStore.preferences.tabbarStyle
    || draft.portalLayout !== uiStore.preferences.portalLayout
    || draft.motionEnabled !== uiStore.preferences.motionEnabled
  )
})

const previewSummary = computed(() => {
  const motionText = draft.motionEnabled ? '动效开' : '动效关'
  const homeLayout = draft.portalLayout === 'focus' ? '聚焦办事' : '概览看板'
  return `${draft.themePresetId} · ${draft.themeMode} · ${homeLayout} · ${motionText}`
})

function hydrateDraft() {
  const source = userInfo.value.preferences?.app || uiStore.preferences
  Object.assign(draft, {
    ...defaultAppPreferences,
    ...source,
  })
  uiStore.hydrateFromUserPreferences(source)
}

function handleMotionToggle(event: { detail?: { value?: boolean } }) {
  draft.motionEnabled = Boolean(event?.detail?.value)
}

function resetToDefault() {
  Object.assign(draft, defaultAppPreferences)
}

async function savePreferences() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }

  saving.value = true
  try {
    uiStore.patchPreferences({ ...draft })
    const payload = await uiStore.persistPreferences()
    userStore.setAppPreferences(payload)
    uni.showToast({
      title: '设置已同步',
      icon: 'none',
    })
  }
  catch (error: unknown) {
    hydrateDraft()
    uni.showToast({
      title: getErrorMessage(error, '设置保存失败'),
      icon: 'none',
    })
  }
  finally {
    saving.value = false
  }
}

function onThemeModeChange(value: string) {
  draft.themeMode = value as AppThemeMode
}

function onThemePresetChange(value: string) {
  draft.themePresetId = value as AppThemePresetId
}

function onSurfaceChange(value: string) {
  draft.surfaceStyle = value as AppSurfaceStyle
}

function onDensityChange(value: string) {
  draft.density = value as AppDensityMode
}

function onTabbarChange(value: string) {
  draft.tabbarStyle = value as AppTabbarStyle
}

function onPortalLayoutChange(value: string) {
  draft.portalLayout = value as AppPortalLayout
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }

  void userStore.fetchUserInfo()
    .then(() => {
      hydrateDraft()
    })
    .catch(() => {
      hydrateDraft()
    })
})
</script>

<template>
  <AppPageShell title="PetPal 设置" description="配置首页布局、主题外观和底栏样式，定制移动端办事体验。">
    <AppSection title="即时预览" :description="previewSummary">
      <view class="settings-preview">
        <view class="settings-preview__chip">
          首页：{{ draft.portalLayout === 'focus' ? '聚焦办事' : '概览看板' }}
        </view>
        <view class="settings-preview__chip">
          底栏：{{ draft.tabbarStyle === 'floating' ? '悬浮底栏' : '贴边底栏' }}
        </view>
      </view>
    </AppSection>

    <AppSection title="主题模式">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.themeMode"
          :options="themeModeOptions"
          @update:model-value="onThemeModeChange"
        />
      </view>
    </AppSection>

    <AppSection title="主题方案">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.themePresetId"
          :options="themePresetOptions"
          @update:model-value="onThemePresetChange"
        />
      </view>
    </AppSection>

    <AppSection title="卡片风格">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.surfaceStyle"
          :options="surfaceOptions"
          @update:model-value="onSurfaceChange"
        />
      </view>
    </AppSection>

    <AppSection title="信息密度">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.density"
          :options="densityOptions"
          @update:model-value="onDensityChange"
        />
      </view>
    </AppSection>

    <AppSection title="底栏样式">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.tabbarStyle"
          :options="tabbarOptions"
          @update:model-value="onTabbarChange"
        />
      </view>
    </AppSection>

    <AppSection title="首页布局">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.portalLayout"
          :options="portalLayoutOptions"
          @update:model-value="onPortalLayoutChange"
        />
      </view>
    </AppSection>

    <AppSection title="动效">
      <view class="settings-toggle-row">
        <view class="settings-toggle-row__meta">
          <view class="settings-toggle-row__title">
            页面动效
          </view>
          <view class="settings-toggle-row__desc">
            关闭后会减少 PetPal 首页切换、卡片进入和过渡动画。
          </view>
        </view>
        <switch
          :checked="draft.motionEnabled"
          color="var(--app-accent)"
          @change="handleMotionToggle"
        />
      </view>
    </AppSection>

    <view class="settings-actions">
      <AppButton block size="large" type="info" @click="resetToDefault">
        恢复默认
      </AppButton>
      <AppButton block size="large" :loading="saving" :disabled="!hasChanges" @click="savePreferences">
        保存到账号
      </AppButton>
    </view>
  </AppPageShell>
</template>

<style scoped lang="scss">
.settings-preview {
  padding: 0 32rpx;
  display: flex;
  flex-wrap: wrap;
  margin-left: -12rpx;
  margin-bottom: -12rpx;
}

.settings-preview__chip {
  margin-left: 12rpx;
  margin-bottom: 12rpx;
  padding: 10rpx 16rpx;
  border-radius: 14rpx;
  background: var(--app-accent-soft);
  color: var(--app-text-secondary);
  font-size: 22rpx;
}

.settings-choice-wrap {
  padding: 0 22rpx;
}

.settings-toggle-row {
  margin: 0 24rpx;
  padding: 20rpx 24rpx;
  background: var(--app-surface);
  border: 1rpx solid var(--app-border);
  border-radius: var(--app-card-radius);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-toggle-row__meta {
  flex: 1;
  min-width: 0;
  padding-right: 20rpx;
}

.settings-toggle-row__title {
  font-size: 28rpx;
  line-height: 1.4;
  color: var(--app-text);
  font-weight: 600;
}

.settings-toggle-row__desc {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--app-text-muted);
}

.settings-actions {
  padding: 0 32rpx 12rpx;
}

.settings-actions .app-button + .app-button {
  margin-top: 16rpx;
}
</style>
