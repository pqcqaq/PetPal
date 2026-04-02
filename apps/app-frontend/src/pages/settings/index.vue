<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/store/ui'
import { useTokenStore } from '@/store/token'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { getErrorMessage, openLoginPage, toast } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const uiStore = useUiStore()
const { preferences } = storeToRefs(uiStore)
const saving = ref(false)
const themePresetOptions = [
  { value: 'graphite', label: '石墨蓝', note: '冷静、中性、适合长时间查看' },
  { value: 'ocean', label: '海岸蓝', note: '清爽、通透、层级更明显' },
  { value: 'forest', label: '林地绿', note: '柔和、稳定、偏照护气质' },
  { value: 'sunset', label: '落日橙', note: '更温暖，适合强调行动按钮' },
] as const
const themeModeOptions = [
  { value: 'light', label: '浅色', note: '纸感界面，适合白天使用' },
  { value: 'dark', label: '深色', note: '弱光环境更舒适' },
  { value: 'auto', label: '跟随系统', note: '自动跟随设备主题切换' },
] as const
const densityOptions = [
  { value: 'comfortable', label: '舒展', note: '留白更充足，阅读压力更低' },
  { value: 'compact', label: '紧凑', note: '信息更密集，适合高频操作' },
] as const
const motionOptions = [
  { value: true, label: '动效开启', note: '保留层级切换和状态过渡' },
  { value: false, label: '动效关闭', note: '减少动画，交互更直接' },
] as const
const tabbarStyleOptions = [
  { value: 'floating', label: '悬浮底栏', note: '更轻、更现代，层次更明显' },
  { value: 'solid', label: '贴边底栏', note: '更稳、更克制，视觉干扰更少' },
] as const

const themePresetSummary = computed(() => themePresetOptions.find(item => item.value === preferences.value.themePresetId) ?? themePresetOptions[0])
const themeModeSummary = computed(() => themeModeOptions.find(item => item.value === preferences.value.themeMode) ?? themeModeOptions[0])
const densitySummary = computed(() => densityOptions.find(item => item.value === preferences.value.density) ?? densityOptions[0])
const tabbarSummary = computed(() => tabbarStyleOptions.find(item => item.value === preferences.value.tabbarStyle) ?? tabbarStyleOptions[0])
const motionSummary = computed(() => motionOptions.find(item => item.value === preferences.value.motionEnabled) ?? motionOptions[0])
const currentSummary = computed(() => [
  themePresetSummary.value.label,
  themeModeSummary.value.label,
  densitySummary.value.label,
  motionSummary.value.label,
  tabbarSummary.value.label,
].join(' · '))

function selectThemePreset(value: (typeof themePresetOptions)[number]['value']) {
  uiStore.patchPreferences({ themePresetId: value })
}

function selectThemeMode(value: (typeof themeModeOptions)[number]['value']) {
  uiStore.patchPreferences({ themeMode: value })
}

function selectDensity(value: (typeof densityOptions)[number]['value']) {
  uiStore.patchPreferences({ density: value })
}

function selectMotionEnabled(value: boolean) {
  uiStore.patchPreferences({ motionEnabled: value })
}

function selectTabbarStyle(value: (typeof tabbarStyleOptions)[number]['value']) {
  uiStore.patchPreferences({ tabbarStyle: value })
}

function restoreDefaults() {
  uiStore.resetPreferences()
  toast('已恢复默认，请保存后生效', 'success')
}

async function savePreferences() {
  if (!tokenStore.hasLogin || saving.value) {
    return
  }
  saving.value = true
  try {
    await uiStore.persistPreferences()
    toast('设置已保存', 'success')
  }
  catch (error: unknown) {
    toast(getErrorMessage(error, '保存设置失败'))
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <PetpalPage title="体验设置" subtitle="设置页只管视觉和交互偏好，不再夹杂账户信息。" eyebrow="Settings" back :back-url="'/pages/me/me'">
    <template v-if="!tokenStore.hasLogin">
      <PetpalSection title="需要登录">
        <button class="petpal-btn petpal-btn--primary" hover-class="none" @click="openLoginPage">去登录</button>
      </PetpalSection>
    </template>

    <template v-else>
      <PetpalSection tone="accent" title="当前界面预设" :subtitle="currentSummary">
        <view class="petpal-grid--two">
          <view class="petpal-stat">
            <text class="petpal-stat__label">色彩</text>
            <text class="petpal-stat__value">{{ themePresetSummary.label }}</text>
            <text class="petpal-stat__meta">{{ themePresetSummary.note }}</text>
          </view>
          <view class="petpal-stat">
            <text class="petpal-stat__label">阅读节奏</text>
            <text class="petpal-stat__value">{{ densitySummary.label }}</text>
            <text class="petpal-stat__meta">{{ motionSummary.label }}</text>
          </view>
        </view>
      </PetpalSection>

      <PetpalSection title="主题色预设" subtitle="先定整体气质，再决定其他细节。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in themePresetOptions"
            :key="item.value"
            :class="['petpal-choice-tile', preferences.themePresetId === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="selectThemePreset(item.value)"
          >
            <text class="petpal-choice-tile__eyebrow">Palette</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ item.note }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="显示模式" subtitle="决定浅色、深色还是跟随系统。">
        <view class="petpal-choice-grid">
          <button
            v-for="item in themeModeOptions"
            :key="item.value"
            :class="['petpal-choice-tile', preferences.themeMode === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="selectThemeMode(item.value)"
          >
            <text class="petpal-choice-tile__eyebrow">Mode</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ item.note }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="界面节奏" subtitle="密度和动效决定你浏览信息时的节奏。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in densityOptions"
            :key="item.value"
            :class="['petpal-choice-tile', preferences.density === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="selectDensity(item.value)"
          >
            <text class="petpal-choice-tile__eyebrow">Density</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ item.note }}</text>
          </button>
        </view>
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in motionOptions"
            :key="String(item.value)"
            :class="['petpal-choice-tile', preferences.motionEnabled === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="selectMotionEnabled(item.value)"
          >
            <text class="petpal-choice-tile__eyebrow">Motion</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ item.note }}</text>
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="底栏样式" subtitle="底部导航只在这里调整，不和账户页混写。">
        <view class="petpal-choice-grid petpal-choice-grid--two">
          <button
            v-for="item in tabbarStyleOptions"
            :key="item.value"
            :class="['petpal-choice-tile', preferences.tabbarStyle === item.value ? 'petpal-choice-tile--active' : '']"
            hover-class="none"
            @click="selectTabbarStyle(item.value)"
          >
            <text class="petpal-choice-tile__eyebrow">Tabbar</text>
            <text class="petpal-choice-tile__title">{{ item.label }}</text>
            <text class="petpal-choice-tile__hint">{{ item.note }}</text>
          </button>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <text class="petpal-note">恢复默认只会重置当前选择，点击保存后才会同步到账号。</text>
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--secondary" hover-class="none" :disabled="saving" @click="restoreDefaults">
            恢复默认
          </button>
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="savePreferences">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
