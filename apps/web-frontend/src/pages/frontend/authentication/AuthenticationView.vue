<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">登录方式</p>
      <h1>认证页只回答怎么登录，不再讲产品故事。</h1>
      <p>实际展示的方式会跟随后端配置变化，但登录后统一回到对应工作区。</p>
      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" to="/login">去登录</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/petpal">先看主人服务台</RouterLink>
      </div>
    </section>

    <section class="frontend-page__section-grid">
      <article v-for="item in strategies" :key="item.code" class="frontend-card auth-grid-span-4">
        <span class="frontend-card__eyebrow">{{ item.identifier }}</span>
        <h2>{{ item.title }}</h2>
        <p>{{ item.description }}</p>
        <strong class="auth-credential">{{ item.credential }}</strong>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">进入路径</span>
      <h2>登录后如何流转</h2>
      <ol class="auth-journey">
        <li v-for="item in journey" :key="item.title">
          <strong>{{ item.title }}</strong>
          <p>{{ item.body }}</p>
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { authJourney, authStrategies } from '../frontend-content';

const strategies = authStrategies.map((item) => ({ ...item }));
const journey = authJourney.map((item) => ({ ...item }));
</script>

<style scoped lang="scss">
.auth-grid-span-4 {
  grid-column: span 4;
}

.auth-credential {
  color: #8f6c4f;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.auth-journey {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 14px;
}

.auth-journey li {
  color: #62584f;
}

.auth-journey li strong {
  display: block;
  margin-bottom: 4px;
  color: #2b241f;
}

@media (max-width: 1080px) {
  .auth-grid-span-4 {
    grid-column: span 12;
  }
}
</style>
