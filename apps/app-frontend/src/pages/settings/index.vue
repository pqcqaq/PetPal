<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { defaultAppPreferences, useUiStore } from '@/store/ui'
import { useTokenStore } from '@/store/token'
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'
import { getErrorMessage, openLoginPage, toast } from '../petpal/rebuild/shared'

const tokenStore = useTokenStore()
const uiStore = useUiStore()
const { preferences } = storeToRefs(uiStore)
const saving = ref(false)
const themePresetOptions = ['graphite', 'ocean', 'forest', 'sunset'] as const
const themeModeOptions = ['light', 'dark', 'auto'] as const
const densityOptions = ['comfortable', 'compact'] as const
const tabbarStyleOptions = ['floating', 'solid'] as const

function selectThemePreset(value: string) {
  uiStore.patchPreferences({ themePresetId: value as (typeof themePresetOptions)[number] })
}

function selectThemeMode(value: string) {
  uiStore.patchPreferences({ themeMode: value as (typeof themeModeOptions)[number] })
}

function selectDensity(value: string) {
  uiStore.patchPreferences({ density: value as (typeof densityOptions)[number] })
}

function selectTabbarStyle(value: string) {
  uiStore.patchPreferences({ tabbarStyle: value as (typeof tabbarStyleOptions)[number] })
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
      <PetpalSection title="主题色">
        <view class="petpal-chip-row">
          <button
            v-for="item in themePresetOptions"
            :key="item"
            :class="['petpal-chip', preferences.themePresetId === item ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="selectThemePreset(item)"
          >
            {{ item }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="主题模式">
        <view class="petpal-chip-row">
          <button
            v-for="item in themeModeOptions"
            :key="item"
            :class="['petpal-chip', preferences.themeMode === item ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="selectThemeMode(item)"
          >
            {{ item }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="界面密度与动效">
        <view class="petpal-chip-row">
          <button
            v-for="item in densityOptions"
            :key="item"
            :class="['petpal-chip', preferences.density === item ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="selectDensity(item)"
          >
            {{ item }}
          </button>
          <button
            :class="['petpal-chip', preferences.motionEnabled ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="uiStore.patchPreferences({ motionEnabled: !preferences.motionEnabled })"
          >
            {{ preferences.motionEnabled ? '动效开启' : '动效关闭' }}
          </button>
        </view>
      </PetpalSection>

      <PetpalSection title="底栏样式">
        <view class="petpal-chip-row">
          <button
            v-for="item in tabbarStyleOptions"
            :key="item"
            :class="['petpal-chip', preferences.tabbarStyle === item ? 'petpal-chip--active' : '']"
            hover-class="none"
            @click="selectTabbarStyle(item)"
          >
            {{ item }}
          </button>
        </view>
      </PetpalSection>

      <view class="petpal-bottom-bar">
        <view class="petpal-action-row">
          <button class="petpal-btn petpal-btn--primary" hover-class="none" :disabled="saving" @click="savePreferences">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </view>
      </view>
    </template>
  </PetpalPage>
</template>
