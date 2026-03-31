<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">登录方式</p>
      <h1>同一个产品入口，支持多种身份验证方式。</h1>
      <p>
        PetPal 会根据当前配置展示可用的登录和注册方式，主人端与后台用户都通过同一套认证能力进入各自工作区。
      </p>
    </section>

    <AuthStrategyDeck :strategies="strategies" />
    <AuthJourneyTimeline :items="journey" />
  </div>
</template>

<script setup lang="ts">
import { authJourney, authStrategies } from '../frontend-content';
import AuthJourneyTimeline from './components/AuthJourneyTimeline.vue';
import AuthStrategyDeck from './components/AuthStrategyDeck.vue';

const strategies = authStrategies.map((item) => ({ ...item }));
const journey = authJourney.map((item) => ({ ...item }));
</script>
