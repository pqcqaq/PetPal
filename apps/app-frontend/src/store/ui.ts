import type {
  AppThemeMode,
  AppThemePresetId,
  UserAppPreferences,
} from '@rbac/api-common'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { appApi } from '@/api/client'

const APP_THEME_PRESET_IDS = ['graphite', 'ocean', 'forest', 'sunset'] as const
const APP_THEME_MODES = ['light', 'dark', 'auto'] as const

export const defaultAppPreferences: UserAppPreferences = {
  themeMode: 'auto',
  themePresetId: 'graphite',
  surfaceStyle: 'soft',
  density: 'comfortable',
  tabbarStyle: 'floating',
  portalLayout: 'overview',
  motionEnabled: true,
}

type ThemePresetPalette = {
  accent: string
  accentPressed: string
  accentSoft: string
  success: string
  warning: string
  danger: string
}

const lightPresetPaletteMap: Record<AppThemePresetId, ThemePresetPalette> = {
  graphite: {
    accent: '#3559e0',
    accentPressed: '#2141bd',
    accentSoft: '#e7edff',
    success: '#0b7a75',
    warning: '#b56a00',
    danger: '#ba1a1a',
  },
  ocean: {
    accent: '#00639a',
    accentPressed: '#004d79',
    accentSoft: '#dff2ff',
    success: '#00756c',
    warning: '#b85b00',
    danger: '#ba1a1a',
  },
  forest: {
    accent: '#2f6c2f',
    accentPressed: '#245824',
    accentSoft: '#e5f4e5',
    success: '#0b7a75',
    warning: '#9d6a00',
    danger: '#ba1a1a',
  },
  sunset: {
    accent: '#b93815',
    accentPressed: '#922c0d',
    accentSoft: '#ffeadf',
    success: '#0b7a75',
    warning: '#b56a00',
    danger: '#c62828',
  },
}

const darkPresetPaletteMap: Record<AppThemePresetId, ThemePresetPalette> = {
  graphite: {
    accent: '#b8c4ff',
    accentPressed: '#dce2ff',
    accentSoft: '#24315d',
    success: '#70e0d5',
    warning: '#ffcb7a',
    danger: '#ffb4ab',
  },
  ocean: {
    accent: '#8dcfff',
    accentPressed: '#bfe3ff',
    accentSoft: '#183246',
    success: '#72e2d7',
    warning: '#ffcb84',
    danger: '#ffb4ab',
  },
  forest: {
    accent: '#9ad38f',
    accentPressed: '#c1e9b8',
    accentSoft: '#223724',
    success: '#8ddfb9',
    warning: '#f0c55a',
    danger: '#ffb4ab',
  },
  sunset: {
    accent: '#ffb59d',
    accentPressed: '#ffd3c5',
    accentSoft: '#452619',
    success: '#72e2d7',
    warning: '#ffd166',
    danger: '#ffb4ab',
  },
}

const resolveSystemThemeMode = (): Exclude<AppThemeMode, 'auto'> => {
  try {
    const theme = uni.getSystemInfoSync().theme
    return theme === 'dark' ? 'dark' : 'light'
  }
  catch {
    return 'light'
  }
}

const normalizeAppPreferences = (input?: Partial<UserAppPreferences> | null): UserAppPreferences => {
  const themePresetId = APP_THEME_PRESET_IDS.includes(input?.themePresetId as AppThemePresetId)
    ? (input?.themePresetId as AppThemePresetId)
    : defaultAppPreferences.themePresetId
  const themeMode = APP_THEME_MODES.includes(input?.themeMode as AppThemeMode)
    ? (input?.themeMode as AppThemeMode)
    : defaultAppPreferences.themeMode

  return {
    ...defaultAppPreferences,
    ...input,
    themeMode,
    themePresetId,
  }
}

export const useUiStore = defineStore(
  'ui',
  () => {
    const preferences = ref<UserAppPreferences>({ ...defaultAppPreferences })
    const syncing = ref(false)

    const resolvedThemeMode = computed<Exclude<AppThemeMode, 'auto'>>(() => {
      return preferences.value.themeMode === 'auto'
        ? resolveSystemThemeMode()
        : preferences.value.themeMode
    })

    const rootCssVars = computed<Record<string, string>>(() => {
      const isDark = resolvedThemeMode.value === 'dark'
      const palette = isDark
        ? darkPresetPaletteMap[preferences.value.themePresetId]
        : lightPresetPaletteMap[preferences.value.themePresetId]

      const densityScale = preferences.value.density === 'compact' ? '0.86' : '1'
      const motionDuration = preferences.value.motionEnabled ? '220ms' : '1ms'
      const motionDurationShort = preferences.value.motionEnabled ? '160ms' : '1ms'
      const motionDurationMedium = preferences.value.motionEnabled ? '260ms' : '1ms'
      const motionDurationLong = preferences.value.motionEnabled ? '420ms' : '1ms'
      const tabbarFloating = preferences.value.tabbarStyle === 'floating'

      return {
        '--app-bg': isDark ? '#0b1220' : '#edf2f8',
        '--app-bg-gradient-start': isDark ? '#111b2f' : '#fbfcff',
        '--app-bg-gradient-end': isDark ? '#0b1220' : '#eaf1fb',
        '--app-surface': isDark ? '#111d32' : '#ffffff',
        '--app-surface-soft': isDark
          ? (preferences.value.surfaceStyle === 'glass' ? 'rgba(19, 30, 49, 0.78)' : '#17243b')
          : (preferences.value.surfaceStyle === 'glass' ? 'rgba(255, 255, 255, 0.88)' : '#f7f9fe'),
        '--app-surface-strong': isDark ? '#1a2b46' : '#eef3fb',
        '--app-surface-container': isDark ? '#141f35' : '#f5f7fc',
        '--app-surface-container-high': isDark ? '#1a2840' : '#eef2fb',
        '--app-surface-container-highest': isDark ? '#22314b' : '#e6ecf8',
        '--app-border': isDark ? '#253755' : '#d8e0eb',
        '--app-border-light': isDark ? '#314565' : '#e7ecf4',
        '--app-border-strong': isDark ? '#4b6287' : '#bbc7d8',
        '--app-outline': isDark ? '#536987' : '#c4cfdd',
        '--app-outline-variant': isDark ? '#314565' : '#dce4f0',
        '--app-text': isDark ? '#f3f6fb' : '#111827',
        '--app-text-secondary': isDark ? '#d4deec' : '#344154',
        '--app-text-muted': isDark ? '#9fb0c8' : '#748399',
        '--app-accent': palette.accent,
        '--app-accent-pressed': palette.accentPressed,
        '--app-accent-soft': palette.accentSoft,
        '--app-success': palette.success,
        '--app-success-soft': isDark ? 'rgba(114, 226, 215, 0.18)' : '#e8f7f5',
        '--app-warning': palette.warning,
        '--app-warning-soft': isDark ? 'rgba(255, 203, 122, 0.2)' : '#fff3e2',
        '--app-danger': palette.danger,
        '--app-danger-soft': isDark ? 'rgba(255, 180, 171, 0.2)' : '#fdecea',
        '--app-density-scale': densityScale,
        '--app-motion-duration': motionDuration,
        '--app-motion-duration-short': motionDurationShort,
        '--app-motion-duration-medium': motionDurationMedium,
        '--app-motion-duration-long': motionDurationLong,
        '--app-motion-easing-standard': 'cubic-bezier(0.2, 0, 0, 1)',
        '--app-motion-easing-emphasis': 'cubic-bezier(0.2, 0, 0, 1.12)',
        '--app-card-radius': preferences.value.density === 'compact' ? '24rpx' : '28rpx',
        '--app-shape-xs': preferences.value.density === 'compact' ? '12rpx' : '14rpx',
        '--app-shape-sm': preferences.value.density === 'compact' ? '16rpx' : '18rpx',
        '--app-shape-md': preferences.value.density === 'compact' ? '20rpx' : '24rpx',
        '--app-shape-lg': preferences.value.density === 'compact' ? '26rpx' : '30rpx',
        '--app-shape-xl': preferences.value.density === 'compact' ? '32rpx' : '38rpx',
        '--app-shape-full': '9999rpx',
        '--app-elevation-1': isDark
          ? '0 12rpx 30rpx rgba(2, 8, 20, 0.34)'
          : '0 10rpx 28rpx rgba(15, 23, 42, 0.08)',
        '--app-elevation-2': isDark
          ? '0 20rpx 48rpx rgba(2, 8, 20, 0.42)'
          : '0 18rpx 44rpx rgba(15, 23, 42, 0.12)',
        '--app-elevation-3': isDark
          ? '0 28rpx 60rpx rgba(2, 8, 20, 0.5)'
          : '0 26rpx 56rpx rgba(15, 23, 42, 0.16)',
        '--app-card-shadow': isDark
          ? '0 12rpx 30rpx rgba(2, 8, 20, 0.34)'
          : '0 10rpx 28rpx rgba(15, 23, 42, 0.08)',
        '--app-tabbar-bg': tabbarFloating
          ? (isDark ? 'rgba(11, 18, 32, 0.82)' : 'rgba(255, 255, 255, 0.9)')
          : (isDark ? '#0f1a2e' : '#ffffff'),
        '--app-tabbar-border': isDark ? '#2f4366' : '#cdd8e6',
        '--app-tabbar-shadow': tabbarFloating
          ? (isDark ? '0 10rpx 36rpx rgba(0, 0, 0, 0.45)' : '0 10rpx 26rpx rgba(15, 23, 42, 0.12)')
          : 'none',
        '--app-tabbar-radius': tabbarFloating ? '34rpx' : '0rpx',
        '--app-tabbar-offset-x': tabbarFloating ? '18rpx' : '0rpx',
        '--app-tabbar-offset-y': tabbarFloating ? '10rpx' : '0rpx',
        '--app-page-max-width': '1160px',
      }
    })

    const hydrateFromUserPreferences = (next?: Partial<UserAppPreferences> | null) => {
      preferences.value = normalizeAppPreferences(next)
    }

    const patchPreferences = (next: Partial<UserAppPreferences>) => {
      preferences.value = normalizeAppPreferences({
        ...preferences.value,
        ...next,
      })
    }

    const resetPreferences = () => {
      preferences.value = { ...defaultAppPreferences }
    }

    const persistPreferences = async () => {
      const payload = normalizeAppPreferences(preferences.value)
      preferences.value = payload
      syncing.value = true
      try {
        await appApi.auth.updatePreferences({ app: payload })
        return payload
      }
      finally {
        syncing.value = false
      }
    }

    return {
      preferences,
      rootCssVars,
      resolvedThemeMode,
      syncing,
      hydrateFromUserPreferences,
      patchPreferences,
      resetPreferences,
      persistPreferences,
    }
  },
  {
    persist: true,
  },
)
