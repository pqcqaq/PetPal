<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">页面不存在</p>
      <h1>这个路径没有可用页面。</h1>
      <p>直接回到主人服务台、首页或后台治理入口继续处理当前任务。</p>

      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" :to="entryTarget">{{ entryLabel }}</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/">回到首页</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const entryTarget = computed(() => auth.isAuthenticated ? '/petpal-admin' : '/petpal');
const entryLabel = computed(() => auth.isAuthenticated ? '返回 PetPal 后台' : '进入主人服务台');
</script>
