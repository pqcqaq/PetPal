<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">宠托帮 PetPal</p>
      <h1>把主人、照料者和治理入口拆开，让用户直接去办事。</h1>
      <p>首页不再承担产品宣讲，只保留进入主人服务台、照料者工作台和后台治理的最快路径。</p>
      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" to="/petpal">进入主人服务台</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/petpal/caregiver">进入照料者工作台</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" :to="adminTarget">{{ adminLabel }}</RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article v-for="item in signals" :key="item.label" class="frontend-card home-grid-span-4">
        <span class="frontend-card__eyebrow">{{ item.label }}</span>
        <h2>{{ item.value }}</h2>
        <p>{{ item.note }}</p>
      </article>
    </section>

    <section class="frontend-page__section-grid">
      <article v-for="card in cards" :key="card.title" class="frontend-card home-grid-span-4">
        <span class="frontend-card__eyebrow">{{ card.eyebrow }}</span>
        <h2>{{ card.title }}</h2>
        <p>{{ card.description }}</p>
        <ul class="home-list">
          <li v-for="item in card.bullets" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">后台治理</span>
      <h2>后台已经从前台说明页里抽离。</h2>
      <div class="home-admin-strip">
        <div v-for="item in highlights" :key="item.title" class="home-admin-strip__item">
          <strong>{{ item.title }}</strong>
          <p>{{ item.description }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { adminHighlights, capabilityCards, projectSignals } from '../frontend-content';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const signals = projectSignals.map((item) => ({ ...item }));
const cards = capabilityCards.map((item) => ({ ...item, bullets: [...item.bullets] }));
const highlights = adminHighlights.map((item) => ({ ...item }));
const adminTarget = computed(() => auth.isAuthenticated ? '/petpal-admin' : '/login');
const adminLabel = computed(() => auth.isAuthenticated ? '进入 PetPal 后台' : '登录 PetPal 后台');
</script>

<style scoped lang="scss">
.home-grid-span-4 {
  grid-column: span 4;
}

.home-list {
  margin: 0;
  padding-left: 18px;
  color: #62584f;
  line-height: 1.8;
}

.home-admin-strip {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.home-admin-strip__item {
  display: grid;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgba(44, 37, 29, 0.1);
}

.home-admin-strip__item strong {
  color: #2b241f;
}

@media (max-width: 1080px) {
  .home-grid-span-4 {
    grid-column: span 12;
  }

  .home-admin-strip {
    grid-template-columns: 1fr;
  }
}
</style>
