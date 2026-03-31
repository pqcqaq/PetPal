<template>
  <div class="frontend-page">
    <HomeHero :console-target="consoleTarget" :console-label="consoleLabel" :signals="signals" />

    <section class="frontend-card intro-card">
      <span class="frontend-card__eyebrow">使用方式</span>
      <h2>公开页看产品，主人台和后台直接办事。</h2>
      <p>
        公开前台只负责说明 PetPal 的业务结构和进入方式。主人服务台负责订单流，后台负责治理流，页面边界已经按真实产品拆开。
      </p>
    </section>

    <HomeCapabilityGrid :cards="cards" />
    <HomeConsolePreview :highlights="highlights" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { capabilityCards, consoleHighlights, projectSignals } from '../frontend-content';
import { useAuthStore } from '@/stores/auth';
import HomeCapabilityGrid from './components/HomeCapabilityGrid.vue';
import HomeConsolePreview from './components/HomeConsolePreview.vue';
import HomeHero from './components/HomeHero.vue';

const auth = useAuthStore();
const signals = projectSignals.map((item) => ({ ...item }));
const cards = capabilityCards.map((item) => ({ ...item, bullets: [...item.bullets] }));
const highlights = consoleHighlights.map((item) => ({ ...item }));
const consoleTarget = computed(() => auth.isAuthenticated ? '/petpal-admin' : '/login');
const consoleLabel = computed(() => auth.isAuthenticated ? '进入 PetPal 后台' : '登录 PetPal 后台');
</script>

<style scoped lang="scss">
.intro-card {
  max-width: 820px;
}

.intro-card h2 {
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.08;
}
</style>
