<script lang="ts" setup>
import type { OrderRecord, PetProfileRecord, ServiceRequestRecord } from '@rbac/api-common'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import AppAvatar from '@/components/app-avatar/app-avatar.vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppList from '@/components/app-list/app-list.vue'
import AppListItem from '@/components/app-list-item/app-list-item.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listOrders, listPets, listServiceRequests } from '@/api/petpal'
import { LOGIN_PAGE, REGISTER_PAGE } from '@/router/config'
import { useUiStore, useUserStore } from '@/store'
import { useTokenStore } from '@/store/token'
import { getErrorMessage } from '@/utils/error'

definePage({
  style: {
    navigationBarTitleText: '我的 PetPal',
  },
})

const userStore = useUserStore()
const tokenStore = useTokenStore()
const uiStore = useUiStore()
const { userInfo } = storeToRefs(userStore)

const petpalLoading = ref(false)
const pets = ref<PetProfileRecord[]>([])
const requests = ref<ServiceRequestRecord[]>([])
const orders = ref<OrderRecord[]>([])

const displayName = computed(() => userInfo.value.nickname || userInfo.value.username || '未登录')
const pageDescription = computed(() => {
  if (!tokenStore.hasLogin) {
    return '登录后查看你的 PetPal 资料、宠物资产和订单进展。'
  }

  return `${displayName.value}，这里集中展示账号资料、宠物资产和需要跟进的订单。`
})

const petpalAdminPermissionPrefixes = ['petpal.complaint.', 'petpal.caregiver.', 'petpal.callback-']
const canUploadAvatar = computed(() => {
  const permissions = userInfo.value.permissions || []
  return permissions.includes('file.upload.avatar') || permissions.includes('file.upload')
})
const hasPetPalAdminAccess = computed(() => userInfo.value.permissions.some(permission => (
  petpalAdminPermissionPrefixes.some(prefix => permission.startsWith(prefix))
)))
const petpalTierSummary = computed(() => {
  if (userInfo.value.roles.some(role => role.code === 'super-admin')) {
    return '平台全量治理账号'
  }

  if (userInfo.value.roles.some(role => role.code === 'ops-manager')) {
    return '运营协同账号'
  }

  return '主人服务账号'
})
const workspaceSummary = computed(() => hasPetPalAdminAccess.value ? '主人服务台 + 治理后台' : '主人服务台')
const capabilitySummary = computed(() => {
  const capabilities = ['宠物档案', '需求发布', '订单跟进']

  if (canUploadAvatar.value) {
    capabilities.push('资料上传')
  }

  if (hasPetPalAdminAccess.value) {
    capabilities.push('后台治理')
  }

  return capabilities.join('、')
})
const statusTagType = computed(() => userInfo.value.status === 'ACTIVE' ? 'success' : 'warning')
const appPreferenceSummary = computed(() => {
  const app = uiStore.preferences
  const homeLayout = app.portalLayout === 'focus' ? '聚焦办事' : '概览看板'
  return `${app.themePresetId} · ${app.themeMode} · ${homeLayout}`
})

const activeOrderCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'PENDING_ACCEPT'
  || item.orderStatus === 'ACCEPTED'
  || item.orderStatus === 'SERVING'
)).length)

const aftersaleCount = computed(() => orders.value.filter(item => (
  item.orderStatus === 'DISPUTED'
  || item.orderStatus === 'PARTIAL_REFUNDED'
  || item.orderStatus === 'REFUNDED'
)).length)

const latestOrders = computed(() => orders.value.slice(0, 3))

const summaryCards = computed(() => [
  {
    label: '宠物档案',
    value: String(pets.value.length),
    hint: pets.value.length ? '已建档宠物可以直接用于下单。' : '还没有宠物档案。',
  },
  {
    label: '服务需求',
    value: String(requests.value.length),
    hint: requests.value.length ? '记录已发布和已完成的照料需求。' : '当前还没有发布过需求。',
  },
  {
    label: '进行中订单',
    value: String(activeOrderCount.value),
    hint: activeOrderCount.value ? '记得关注签到、服务日志和确认完成。' : '当前没有进行中的订单。',
  },
  {
    label: '售后关注',
    value: String(aftersaleCount.value),
    hint: aftersaleCount.value ? '存在退款、争议或已退款订单。' : '当前没有售后风险订单。',
  },
])

function handleLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

function handleRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}

function openProfile() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/me/profile' })
}

function openSettings() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/settings/index' })
}

function openServiceBoard() {
  if (!tokenStore.hasLogin) {
    handleLogin()
    return
  }
  uni.navigateTo({ url: '/pages/petpal/index' })
}

function openHome() {
  uni.switchTab({ url: '/pages/index/index' })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前 PetPal 账号吗？',
    success: async (res) => {
      if (res.confirm) {
        await tokenStore.logout()
        uni.reLaunch({ url: LOGIN_PAGE })
      }
    },
  })
}

async function loadPetPalAccount(showError = false) {
  if (!tokenStore.hasLogin || petpalLoading.value) {
    return
  }

  petpalLoading.value = true
  try {
    await Promise.all([
      userStore.fetchUserInfo().catch(() => undefined),
      listPets().then(rows => (pets.value = rows)),
      listServiceRequests().then(rows => (requests.value = rows)),
      listOrders().then(rows => (orders.value = rows)),
    ])
  }
  catch (error: unknown) {
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载 PetPal 账户失败'),
        icon: 'none',
      })
    }
  }
  finally {
    petpalLoading.value = false
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }

  void loadPetPalAccount(false)
})
</script>

<template>
  <AppPageShell title="我的 PetPal" :description="pageDescription">
    <view class="app-hero">
      <AppAvatar
        class="app-hero__avatar"
        :src="userInfo.avatarUrl || '/static/images/default-avatar.png'"
        :text="displayName"
        size="large"
        shape="square"
      />
      <view class="app-hero__body">
        <view class="app-hero__title">
          {{ displayName }}
        </view>
        <view class="app-hero__meta">
          {{ userInfo.email || '未设置邮箱' }}
        </view>
        <view class="app-tag-row">
          <AppTag :type="tokenStore.hasLogin ? statusTagType : 'default'">
            {{ tokenStore.hasLogin ? (userInfo.status === 'ACTIVE' ? '账号正常' : '账号受限') : '未登录' }}
          </AppTag>
          <AppTag v-if="tokenStore.hasLogin" type="primary">
            {{ petpalTierSummary }}
          </AppTag>
        </view>
      </view>
    </view>

    <template v-if="tokenStore.hasLogin">
      <AppSection title="业务概览">
        <view class="petpal-me-grid">
          <view v-for="item in summaryCards" :key="item.label" class="petpal-me-card">
            <text class="petpal-me-card__label">{{ item.label }}</text>
            <text class="petpal-me-card__value">{{ item.value }}</text>
            <text class="petpal-me-card__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="常用入口">
        <AppList>
          <AppListItem title="进入服务台" label="继续发布需求、维护宠物档案和查看匹配。" is-link clickable @click="openServiceBoard" />
          <AppListItem title="个人资料" label="更新昵称、头像和联系方式。" is-link clickable @click="openProfile" />
          <AppListItem title="PetPal 设置" label="调整首页布局、主题和底栏样式。" is-link clickable @click="openSettings" />
          <AppListItem title="返回首页" label="回到首页继续查看订单和推荐照料者。" is-link clickable @click="openHome" />
        </AppList>
      </AppSection>

      <AppSection title="近期订单提醒">
        <AppList v-if="latestOrders.length">
          <AppListItem
            v-for="order in latestOrders"
            :key="order.id"
            :title="order.orderNo"
            :label="`状态：${order.orderStatus}`"
            :value="`实付 ${order.amountPaid} / 已退 ${order.amountRefunded}`"
          />
        </AppList>
        <view v-else class="app-status-wrap">
          <AppStatus :mode="petpalLoading ? 'loading' : 'empty'" :text="petpalLoading ? '正在同步订单数据' : '暂无订单提醒'" />
        </view>
      </AppSection>

      <AppSection title="账户能力">
        <AppList>
          <AppListItem title="账号状态" :value="userInfo.status === 'ACTIVE' ? '正常' : '停用'" value-emphasis />
          <AppListItem title="账号定位" :value="petpalTierSummary" />
          <AppListItem title="可用工作区" :value="workspaceSummary" />
          <AppListItem title="资料上传" :value="canUploadAvatar ? '可用' : '受限'" />
          <AppListItem title="已开通能力" :label="capabilitySummary" />
          <AppListItem title="当前体验设置" :label="appPreferenceSummary" />
        </AppList>
      </AppSection>

      <view class="petpal-action-block">
        <AppButton block size="large" type="info" @click="handleLogout">
          退出登录
        </AppButton>
      </view>
    </template>

    <template v-else>
      <AppSection title="账户提示">
        <view class="app-status-wrap app-status-wrap--spacious">
          <AppStatus text="登录后可查看 PetPal 资料、宠物资产和服务进展。" />
        </view>
      </AppSection>

      <view class="petpal-action-block">
        <AppButton block size="large" @click="handleLogin">
          去登录
        </AppButton>
        <AppButton block size="large" type="info" @click="handleRegister">
          去注册
        </AppButton>
      </view>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.petpal-me-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  padding: 0 24rpx;
}

.petpal-me-card {
  display: grid;
  gap: 10rpx;
  padding: 22rpx;
  border: 1rpx solid var(--app-border);
  border-radius: 24rpx;
  background: var(--app-surface);
}

.petpal-me-card__label {
  font-size: 22rpx;
  color: var(--app-text-muted);
}

.petpal-me-card__value {
  font-size: 40rpx;
  line-height: 1.05;
  color: var(--app-text);
  font-weight: 700;
}

.petpal-me-card__hint {
  font-size: 22rpx;
  line-height: 1.6;
  color: var(--app-text-secondary);
}

.petpal-action-block {
  padding: 0 32rpx 12rpx;
}

.petpal-action-block .app-button + .app-button {
  margin-top: 16rpx;
}

@media (max-width: 680px) {
  .petpal-me-grid {
    grid-template-columns: 1fr;
  }
}
</style>
