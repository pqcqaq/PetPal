<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">登录方式</p>
      <h1>选择登录入口，然后直接回到工作区。</h1>
      <p>认证页只回答当前有哪些登录方式，以及登录后会去哪里，不再承担产品介绍。</p>
      <div class="frontend-page__hero-actions">
        <RouterLink class="frontend-page__button is-primary" to="/login">去登录</RouterLink>
        <RouterLink class="frontend-page__button is-secondary" to="/petpal">先看主人服务台</RouterLink>
      </div>
    </section>

    <section class="frontend-page__section">
      <h2>当前可用方式</h2>
      <p>实际显示方式仍以后端配置为准，这里只给用户最短理解路径。</p>
      <div class="frontend-route-list">
        <div v-for="item in strategies" :key="item.code" class="frontend-route-row">
          <div class="frontend-route-row__copy">
            <span class="frontend-route-row__eyebrow">{{ item.identifier }}</span>
            <h3 class="frontend-route-row__title">{{ item.title }}</h3>
            <p class="frontend-route-row__meta">{{ item.description }}</p>
          </div>
          <div class="frontend-route-row__tail">
            <span class="auth-credential">{{ item.credential }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="frontend-page__section">
      <h2>登录后会发生什么</h2>
      <ol class="frontend-note-list auth-journey">
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
.auth-credential {
  color: #8f6c4f;
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.auth-journey {
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
</style>
