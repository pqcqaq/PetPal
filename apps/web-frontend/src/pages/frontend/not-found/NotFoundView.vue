<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">页面不存在</p>
      <h1>当前页面不存在。</h1>
      <p>请返回首页，或通过下方入口进入控制台。</p>

      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" :to="consoleTarget">{{ consoleLabel }}</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/">回到首页</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const consoleTarget = computed(() => auth.isAuthenticated ? '/petpal-admin' : '/login');
const consoleLabel = computed(() => auth.isAuthenticated ? '返回 PetPal 后台' : '登录 PetPal 后台');
</script>
