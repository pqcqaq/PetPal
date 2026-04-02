<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">宠托帮 PetPal</p>
      <h1>选择你现在要进入的工作区。</h1>
      <p>首页只做分流，不再承担介绍、宣讲或功能罗列。主人、照料者和后台治理都各走各的路径。</p>
      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" to="/petpal">进入主人服务台</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/petpal/caregiver">进入照料者工作台</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="adminTarget">{{ adminLabel }}</RouterLink>
      </div>
    </section>

    <section class="frontend-page__section">
      <h2>直接进入</h2>
      <p>每个入口只保留自己的任务，不再把查看、创建、编辑、售后混在一个巨型门户页里。</p>
      <div class="frontend-route-list">
        <div v-for="item in routes" :key="item.title" class="frontend-route-row">
          <div class="frontend-route-row__copy">
            <span class="frontend-route-row__eyebrow">{{ item.eyebrow }}</span>
            <h3 class="frontend-route-row__title">{{ item.title }}</h3>
            <p class="frontend-route-row__meta">{{ item.description }}</p>
          </div>
          <div class="frontend-route-row__tail">
            <RouterLink :to="item.to">{{ item.action }}</RouterLink>
          </div>
        </div>
      </div>
    </section>

    <section class="frontend-page__section">
      <h2>当前重构结果</h2>
      <p>这里只保留最少但必要的判断信息，帮助用户快速知道产品现在怎么用。</p>
      <div class="frontend-summary-strip">
        <div v-for="item in signals" :key="item.label">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.note }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { projectSignals } from '../frontend-content';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const signals = projectSignals.map((item) => ({ ...item }));
const adminTarget = computed(() => auth.isAuthenticated ? '/petpal-admin' : '/login');
const adminLabel = computed(() => auth.isAuthenticated ? '进入 PetPal 后台' : '登录 PetPal 后台');
const routes = computed(() => [
  {
    eyebrow: 'Owner',
    title: '主人服务台',
    description: '继续宠物建档、需求发布、订单跟进、消息和售后处理。',
    action: '进入主人服务台',
    to: '/petpal',
  },
  {
    eyebrow: 'Caregiver',
    title: '照料者工作台',
    description: '继续入驻资料、服务设置、履约留痕和收益查看。',
    action: '进入照料者工作台',
    to: '/petpal/caregiver',
  },
  {
    eyebrow: 'Admin',
    title: '后台治理',
    description: auth.isAuthenticated ? '投诉、审核、回调排查都直接进入后台工作区。' : '后台入口需要先登录，不再经过介绍页。',
    action: adminLabel.value,
    to: adminTarget.value,
  },
]);
</script>
