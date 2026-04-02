<script setup lang="ts">
import PetpalPage from '../petpal/rebuild/petpal-page.vue'
import PetpalSection from '../petpal/rebuild/petpal-section.vue'

const helpGroups = [
  {
    title: '主人主流程',
    rows: [
      { title: '宠物档案', hint: '先建宠物，再发需求。', url: '/pages/petpal/pets' },
      { title: '新建需求', hint: '明确时间、地点、预算。', url: '/pages/petpal/request' },
      { title: '订单与售后', hint: '订单和售后分开看。', url: '/pages/petpal/orders' },
    ],
  },
  {
    title: '照料者主流程',
    rows: [
      { title: '入驻中心', hint: '先完善档案和资质。', url: '/pages/petpal/caregiver-profile' },
      { title: '服务管理', hint: '再维护价格和时效。', url: '/pages/petpal/caregiver-services' },
      { title: '履约订单', hint: '接单、签到、签退都在这里处理。', url: '/pages/petpal/caregiver-orders' },
    ],
  },
  {
    title: '账户支持',
    rows: [
      { title: '个人资料', hint: '编辑昵称、邮箱、头像。', url: '/pages/me/profile' },
      { title: '体验设置', hint: '主题、密度、动效。', url: '/pages/settings/index' },
      { title: '通知中心', hint: '统一查看当前待办。', url: '/pages/notifications/index' },
    ],
  },
]

function openUrl(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <PetpalPage title="帮助中心" subtitle="只保留最短路径，不放产品介绍。" eyebrow="Help" back :back-url="'/pages/me/me'">
    <PetpalSection tone="accent" title="按角色找路径" subtitle="这里只保留主人、照料者和账户三个工作区。">
      <view class="petpal-grid--two">
        <view class="petpal-stat">
          <text class="petpal-stat__label">主人</text>
          <text class="petpal-stat__value">3 步</text>
          <text class="petpal-stat__meta">宠物、需求、订单</text>
        </view>
        <view class="petpal-stat">
          <text class="petpal-stat__label">照料者</text>
          <text class="petpal-stat__value">3 步</text>
          <text class="petpal-stat__meta">入驻、服务、履约</text>
        </view>
      </view>
    </PetpalSection>

    <PetpalSection v-for="group in helpGroups" :key="group.title" :title="group.title">
      <view class="petpal-choice-grid">
        <button
          v-for="row in group.rows"
          :key="row.title"
          class="petpal-choice-tile"
          hover-class="none"
          @click="openUrl(row.url)"
        >
          <text class="petpal-choice-tile__eyebrow">{{ group.title }}</text>
          <text class="petpal-choice-tile__title">{{ row.title }}</text>
          <text class="petpal-choice-tile__meta">{{ row.hint }}</text>
          <text class="petpal-choice-tile__hint">直接进入对应页面，不额外解释流程背景。</text>
        </button>
      </view>
    </PetpalSection>
  </PetpalPage>
</template>
