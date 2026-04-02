<script lang="ts" setup>
/**
 * UX Blueprint
 * User: 已登录主人，需要先看清当前有哪些宠物，再决定新增还是编辑
 * Entry: 主人首页、需求页空态、订单页回流
 * First screen: 宠物数量、档案完成度、直接发需求入口
 * Primary action: 新增宠物，或进入某只宠物的独立表单页
 * Secondary actions: 直接用现有宠物发需求、返回主人首页
 * States: 未登录、加载中、空态、列表可用
 */
import type { PetProfileRecord } from '@rbac/api-common'
import { computed, ref } from 'vue'
import AppButton from '@/components/app-button/app-button.vue'
import AppPageShell from '@/components/app-page-shell/app-page-shell.vue'
import AppSection from '@/components/app-section/app-section.vue'
import AppStatus from '@/components/app-status/app-status.vue'
import AppTag from '@/components/app-tag/app-tag.vue'
import { listPets } from '@/api/petpal'
import { LOGIN_PAGE } from '@/router/config'
import { useTokenStore } from '@/store'
import { getErrorMessage } from '@/utils/error'
import OwnerFlowNav from './components/owner-flow-nav.vue'
import {
  formatDate,
  formatPetTagSummary,
  genderLabels,
  openPetPalPetFormPage,
  PETPAL_OWNER_HOME_PAGE,
  PETPAL_PETS_PAGE,
  PETPAL_REQUEST_PAGE,
  speciesLabels,
} from './owner-shared'

defineOptions({
  name: 'PetPalPetsPage',
})

definePage({
  style: {
    navigationBarTitleText: '宠物档案',
    enablePullDownRefresh: true,
  },
})

const tokenStore = useTokenStore()

const loading = ref(false)
const pets = ref<PetProfileRecord[]>([])

const completedPetCount = computed(() => pets.value.filter(item => (
  Boolean(item.feedingNote || item.medicalNote || item.allergyNote)
  && Boolean(item.emergencyContact?.name && item.emergencyContact?.phone)
)).length)

const summaryCards = computed(() => [
  {
    label: '宠物总数',
    value: String(pets.value.length),
    hint: pets.value.length ? '先挑一只继续办事' : '先建第一只宠物',
  },
  {
    label: '完整档案',
    value: String(completedPetCount.value),
    hint: completedPetCount.value ? '已有可直接复用档案' : '建议补齐紧急联系人',
  },
  {
    label: '可发需求',
    value: pets.value.length ? '就绪' : '未就绪',
    hint: pets.value.length ? '直接带入下单流程' : '保存后再去新建需求',
  },
])

function openCreateForm() {
  openPetPalPetFormPage({
    mode: 'navigate',
    from: PETPAL_PETS_PAGE,
  })
}

function openEditForm(petId: string) {
  openPetPalPetFormPage({
    mode: 'navigate',
    petId,
    from: PETPAL_PETS_PAGE,
  })
}

function openRequestFlow(petId?: string) {
  const suffix = petId ? `?petId=${petId}` : ''
  uni.navigateTo({ url: `${PETPAL_REQUEST_PAGE}${suffix}` })
}

function backToOwnerHome() {
  uni.redirectTo({ url: PETPAL_OWNER_HOME_PAGE })
}

function goToLogin() {
  uni.navigateTo({ url: LOGIN_PAGE })
}

async function loadPage(showError = false) {
  if (!tokenStore.hasLogin || loading.value) {
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  try {
    pets.value = await listPets()
  }
  catch (error: unknown) {
    pets.value = []
    if (showError) {
      uni.showToast({
        title: getErrorMessage(error, '加载宠物档案失败'),
        icon: 'none',
      })
    }
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onShow(() => {
  if (!tokenStore.hasLogin) {
    return
  }
  void loadPage(false)
})

onPullDownRefresh(() => {
  void loadPage(true)
})
</script>

<template>
  <AppPageShell title="宠物档案">
    <template v-if="tokenStore.hasLogin">
      <OwnerFlowNav
        :current-path="PETPAL_PETS_PAGE"
        title="宠物档案"
      />

      <AppSection title="先看已有档案">
        <view class="pet-list-hero">
          <view class="pet-list-hero__copy">
            <view class="pet-list-hero__tags">
              <AppTag type="primary">主人</AppTag>
              <AppTag :type="pets.length ? 'success' : 'warning'">
                {{ pets.length ? '可直接下单' : '先建档' }}
              </AppTag>
            </view>
            <text class="pet-list-hero__title">把宠物列表和编辑表单彻底拆开</text>
            <text class="pet-list-hero__summary">这里只负责查看、选择和决定下一步，不再在列表页里直接塞长表单。</text>
          </view>
          <view class="pet-list-hero__actions">
            <AppButton size="medium" @click="openCreateForm">新增宠物</AppButton>
            <AppButton v-if="pets.length" size="medium" type="info" @click="openRequestFlow()">新建需求</AppButton>
            <AppButton size="medium" type="info" @click="backToOwnerHome">返回首页</AppButton>
          </view>
        </view>

        <view class="pet-list-summary">
          <view v-for="item in summaryCards" :key="item.label" class="pet-list-summary__card">
            <text class="pet-list-summary__label">{{ item.label }}</text>
            <text class="pet-list-summary__value">{{ item.value }}</text>
            <text class="pet-list-summary__hint">{{ item.hint }}</text>
          </view>
        </view>
      </AppSection>

      <AppSection title="宠物清单" :description="pets.length ? `共 ${pets.length} 只，可直接进入独立表单页编辑。` : '先创建第一只宠物。'">
        <template v-if="loading">
          <view class="pet-list-empty">
            <AppStatus mode="loading" text="正在同步宠物档案" />
          </view>
        </template>

        <template v-else-if="pets.length">
          <view class="pet-card-list">
            <view v-for="pet in pets" :key="pet.id" class="pet-card">
              <view class="pet-card__head">
                <view class="pet-card__headline">
                  <text class="pet-card__name">{{ pet.name }}</text>
                  <text class="pet-card__meta">
                    {{ speciesLabels[pet.species] }}{{ pet.breed ? ` · ${pet.breed}` : '' }} · {{ genderLabels[pet.gender] }}
                  </text>
                </view>
                <AppTag :type="pet.emergencyContact?.name ? 'success' : 'warning'">
                  {{ pet.emergencyContact?.name ? '档案较完整' : '待补紧急信息' }}
                </AppTag>
              </view>

              <view class="pet-card__grid">
                <view class="pet-card__metric">
                  <text class="pet-card__metric-label">生日</text>
                  <text class="pet-card__metric-value">{{ formatDate(pet.birthday) }}</text>
                </view>
                <view class="pet-card__metric">
                  <text class="pet-card__metric-label">体重</text>
                  <text class="pet-card__metric-value">{{ pet.weightKg || '-' }}kg</text>
                </view>
                <view class="pet-card__metric">
                  <text class="pet-card__metric-label">习性</text>
                  <text class="pet-card__metric-value">{{ formatPetTagSummary(pet.temperamentTags) }}</text>
                </view>
              </view>

              <view class="pet-card__notes">
                <view v-if="pet.feedingNote" class="pet-card__note">
                  <text class="pet-card__note-label">喂养</text>
                  <text class="pet-card__note-value">{{ pet.feedingNote }}</text>
                </view>
                <view v-if="pet.allergyNote" class="pet-card__note">
                  <text class="pet-card__note-label">过敏</text>
                  <text class="pet-card__note-value">{{ pet.allergyNote }}</text>
                </view>
                <view v-if="pet.medicalNote" class="pet-card__note">
                  <text class="pet-card__note-label">健康</text>
                  <text class="pet-card__note-value">{{ pet.medicalNote }}</text>
                </view>
                <view v-if="pet.emergencyContact" class="pet-card__note">
                  <text class="pet-card__note-label">紧急</text>
                  <text class="pet-card__note-value">
                    {{ pet.emergencyContact.name }} · {{ pet.emergencyContact.phone }}{{ pet.emergencyContact.relation ? ` · ${pet.emergencyContact.relation}` : '' }}
                  </text>
                </view>
              </view>

              <view class="pet-card__actions">
                <AppButton size="medium" type="info" @click="openEditForm(pet.id)">编辑档案</AppButton>
                <AppButton size="medium" @click="openRequestFlow(pet.id)">用它发需求</AppButton>
              </view>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="pet-list-empty">
            <AppStatus text="还没有宠物档案，先建第一只再去下单。" />
            <AppButton size="medium" @click="openCreateForm">开始建档</AppButton>
          </view>
        </template>
      </AppSection>
    </template>

    <template v-else>
      <AppSection title="登录后继续">
        <view class="pet-list-empty">
          <AppStatus text="登录后查看宠物清单并进入独立表单页编辑。" />
        </view>
        <AppButton block @click="goToLogin">去登录</AppButton>
      </AppSection>
    </template>
  </AppPageShell>
</template>

<style scoped lang="scss">
.pet-list-hero,
.pet-list-hero__actions,
.pet-list-hero__tags,
.pet-card__head,
.pet-card__actions {
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.pet-list-hero {
  margin: 0 24rpx;
  padding: 28rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background:
    radial-gradient(circle at top right, rgba(53, 89, 224, 0.14), transparent 34%),
    linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.pet-list-hero__copy,
.pet-card,
.pet-card__headline,
.pet-card__metric,
.pet-card__note,
.pet-list-empty {
  display: grid;
  gap: 12rpx;
}

.pet-list-hero__title,
.pet-card__name {
  color: var(--app-text);
  font-size: 34rpx;
  line-height: 1.16;
  font-weight: 700;
}

.pet-list-hero__summary,
.pet-list-summary__hint,
.pet-card__meta,
.pet-card__note-value,
.pet-card__metric-label {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.64;
}

.pet-list-summary,
.pet-card__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
  padding: 18rpx 24rpx 0;
}

.pet-list-summary__card,
.pet-card,
.pet-card__metric,
.pet-card__note {
  padding: 22rpx;
  border-radius: var(--app-shape-xl);
  border: 1rpx solid var(--app-outline-variant);
  background: linear-gradient(180deg, var(--app-surface) 0%, var(--app-surface-container) 100%);
  box-shadow: var(--app-elevation-1);
}

.pet-list-summary__label,
.pet-card__note-label {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.pet-list-summary__value,
.pet-card__metric-value {
  color: var(--app-text);
  font-size: 30rpx;
  line-height: 1.18;
  font-weight: 700;
}

.pet-card-list {
  display: grid;
  gap: 16rpx;
  padding: 0 24rpx;
}

.pet-card__grid {
  padding: 0;
}

.pet-card__notes {
  display: grid;
  gap: 12rpx;
}

.pet-list-empty {
  padding: 0 24rpx 8rpx;
}

@media (max-width: 680px) {
  .pet-list-summary,
  .pet-card__grid {
    grid-template-columns: 1fr;
  }

  .pet-list-hero,
  .pet-card__head,
  .pet-card__actions {
    align-items: stretch;
  }
}
</style>
