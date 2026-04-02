<template>
  <PetPalDeskPage
    eyebrow="兼容入口"
    title="旧工作台已经退场，这里只保留分流"
    summary="`/petpal/legacy` 现在只负责兼容旧链接，把你带回新的主人、照料者、消息和售后页面。"
    :nav-items="petPalOwnerWorkspaceNav"
    active-name="frontend-petpal"
    :actions="[{ label: '返回主人总览', to: { name: 'frontend-petpal' }, tone: 'secondary' }]"
    :stats="heroStats"
  >
    <PetPalDeskSection eyebrow="Redirect" title="请选择新的入口" description="旧的混合式超级页面已经被拆解，不再继续承载新增功能。">
      <div class="petpal-sheet-list">
        <div v-for="item in routes" :key="item.title" class="petpal-sheet-row">
          <div class="petpal-sheet-row__copy">
            <h3 class="petpal-sheet-row__title">{{ item.title }}</h3>
            <p class="petpal-sheet-row__desc">{{ item.description }}</p>
          </div>
          <div class="petpal-sheet-row__tail">
            <RouterLink :to="item.to">{{ item.actionLabel }}</RouterLink>
          </div>
        </div>
      </div>
    </PetPalDeskSection>
  </PetPalDeskPage>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import PetPalDeskPage from './rebuild/petpal-desk-page.vue';
import PetPalDeskSection from './rebuild/petpal-desk-section.vue';
import { petPalOwnerWorkspaceNav } from './shared';

const routes = [
  {
    title: '回主人总览',
    description: '如果你想继续宠物、需求或订单主流程，直接回主人总览。',
    actionLabel: '进入主人总览',
    to: { name: 'frontend-petpal' },
  },
  {
    title: '回照料者工作台',
    description: '如果你想继续处理资料、服务或履约订单，直接回照料者工作台。',
    actionLabel: '进入照料者工作台',
    to: { name: 'frontend-petpal-caregiver' },
  },
  {
    title: '查看消息或售后',
    description: '跨订单沟通和售后已经独立，不必再回旧工作台里寻找。',
    actionLabel: '进入消息中心',
    to: { name: 'frontend-petpal-messages' },
  },
];

const heroStats = computed(() => [
  { label: '兼容状态', value: '仅分流', hint: '不再承载业务逻辑' },
  { label: '替代入口', value: String(routes.length), hint: '新页面按任务拆开' },
  { label: '旧模式', value: '已废弃', hint: '不再新增任何功能' },
  { label: '推荐', value: '主人总览', hint: '通常从这里重新进入最快' },
]);
</script>
