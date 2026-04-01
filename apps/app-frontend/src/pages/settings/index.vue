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
import AppTag from '@/components/app-tag/app-tag.vue'
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

const appearanceCards = computed(() => [
  {
    label: '主题方案',
    value: resolveOptionLabel(themePresetOptions, draft.themePresetId),
    hint: '决定主色、强调色和主要氛围。',
  },
  {
    label: '首页布局',
    value: resolveOptionLabel(portalLayoutOptions, draft.portalLayout),
    hint: '决定首页优先展示概览还是关键动作。',
  },
  {
    label: '信息密度',
    value: resolveOptionLabel(densityOptions, draft.density),
    hint: '决定列表和卡片的一屏承载量。',
  },
  {
    label: '动效反馈',
    value: draft.motionEnabled ? '已开启' : '已关闭',
    hint: '控制页面过渡、按钮反馈和卡片进入节奏。',
  },
])

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

function resolveOptionLabel(
  options: Array<{ label: string, value: string }>,
  value: string,
) {
  return options.find(item => item.value === value)?.label || value
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
    <AppSection title="体验预览" :description="previewSummary">
      <view class="settings-hero">
        <view class="settings-hero__copy">
          <AppTag type="primary">
            Material 3
          </AppTag>
          <view class="settings-hero__title">
            PetPal 移动体验
          </view>
          <view class="settings-hero__summary">
            主题、布局、密度和动效会一起影响首页卡片层级、导航反馈和任务节奏。
          </view>
        </view>
      </view>

      <view class="settings-preview">
        <view class="settings-preview__chip">
          首页：{{ draft.portalLayout === 'focus' ? '聚焦办事' : '概览看板' }}
        </view>
        <view class="settings-preview__chip">
          底栏：{{ draft.tabbarStyle === 'floating' ? '悬浮底栏' : '贴边底栏' }}
        </view>
        <view class="settings-preview__chip">
          主题：{{ resolveOptionLabel(themePresetOptions, draft.themePresetId) }}
        </view>
        <view class="settings-preview__chip">
          模式：{{ resolveOptionLabel(themeModeOptions, draft.themeMode) }}
        </view>
      </view>

      <view class="settings-preview-grid">
        <view v-for="item in appearanceCards" :key="item.label" class="settings-preview-card">
          <view class="settings-preview-card__label">
            {{ item.label }}
          </view>
          <view class="settings-preview-card__value">
            {{ item.value }}
          </view>
          <view class="settings-preview-card__hint">
            {{ item.hint }}
          </view>
        </view>
      </view>
    </AppSection>

    <AppSection title="主题模式" description="先确定整体深浅色策略，再继续调整色板。">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.themeMode"
          :options="themeModeOptions"
          @update:model-value="onThemeModeChange"
        />
      </view>
    </AppSection>

    <AppSection title="主题方案" description="色板会影响首页、提醒、按钮和卡片强调色。">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.themePresetId"
          :options="themePresetOptions"
          @update:model-value="onThemePresetChange"
        />
      </view>
    </AppSection>

    <AppSection title="卡片风格" description="控制页面层次、内容承载感和浮起程度。">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.surfaceStyle"
          :options="surfaceOptions"
          @update:model-value="onSurfaceChange"
        />
      </view>
    </AppSection>

    <AppSection title="信息密度" description="移动端默认舒适模式，紧凑模式适合频繁查看订单。">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.density"
          :options="densityOptions"
          @update:model-value="onDensityChange"
        />
      </view>
    </AppSection>

    <AppSection title="底栏样式" description="控制底栏是更轻盈悬浮，还是更稳定贴边。">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.tabbarStyle"
          :options="tabbarOptions"
          @update:model-value="onTabbarChange"
        />
      </view>
    </AppSection>

    <AppSection title="首页布局" description="概览看板适合浏览全局，聚焦办事适合高频快速操作。">
      <view class="settings-choice-wrap">
        <AppChoiceChips
          :model-value="draft.portalLayout"
          :options="portalLayoutOptions"
          @update:model-value="onPortalLayoutChange"
        />
      </view>
    </AppSection>

    <AppSection title="动效" description="动效用于引导注意力，不应该拖慢主要任务。">
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
      <view class="settings-actions__meta">
        <view class="settings-actions__title">
          同步当前设置
        </view>
        <view class="settings-actions__desc">
          保存后，主题、首页布局、密度和动效会跟随当前账号生效。
        </view>
      </view>
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
.settings-hero {
  margin: 0 24rpx 18rpx;
  padding: 28rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  border-radius: var(--app-shape-xl);
  background:
    radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 34%),
    linear-gradient(145deg, var(--app-accent) 0%, var(--app-accent-pressed) 54%, var(--app-warning) 100%);
  box-shadow: var(--app-elevation-3);
}

.settings-hero__copy {
  display: grid;
  gap: 12rpx;
}

.settings-hero__title {
  color: #eff6ff;
  font-size: 40rpx;
  line-height: 1.18;
  font-weight: 700;
}

.settings-hero__summary {
  color: rgba(239, 246, 255, 0.9);
  font-size: 24rpx;
  line-height: 1.7;
}

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

.settings-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 18rpx 24rpx 0;
}

.settings-preview-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-outline-variant);
  border-radius: var(--app-shape-xl);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.settings-preview-card__label {
  font-size: 22rpx;
  color: var(--app-text-muted);
}

.settings-preview-card__value {
  font-size: 34rpx;
  line-height: 1.12;
  color: var(--app-text);
  font-weight: 700;
}

.settings-preview-card__hint {
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-secondary);
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
  display: grid;
  gap: 16rpx;
  margin: 0 24rpx 12rpx;
  padding: 24rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.settings-actions__meta {
  display: grid;
  gap: 8rpx;
}

.settings-actions__title {
  font-size: 28rpx;
  line-height: 1.4;
  color: var(--app-text);
  font-weight: 700;
}

.settings-actions__desc {
  font-size: 22rpx;
  line-height: 1.62;
  color: var(--app-text-muted);
}

.settings-actions .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .settings-preview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
