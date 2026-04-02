<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">产品边界</p>
      <h1>页面边界按真实任务拆开。</h1>
      <p>这里不再解释概念，只快速说明公开页、主人页、照料者页和后台页各自负责什么。</p>
    </section>

    <section class="frontend-page__section">
      <h2>页面边界</h2>
      <div class="frontend-route-list">
        <div v-for="item in layers" :key="item.title" class="frontend-route-row">
          <div class="frontend-route-row__copy">
            <span class="frontend-route-row__eyebrow">{{ item.title }}</span>
            <h3 class="frontend-route-row__title">{{ item.summary }}</h3>
            <ul class="frontend-note-list architecture-list">
              <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="frontend-page__section">
      <h2>重构规则</h2>
      <ul class="frontend-note-list architecture-list">
        <li v-for="item in principles" :key="item">{{ item }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { architectureLayers, operatingPrinciples } from '../frontend-content';

const layers = architectureLayers.map((item) => ({ ...item, details: [...item.details] }));
const principles = [...operatingPrinciples];
</script>

<style scoped lang="scss">
.architecture-list {
  color: #62584f;
  line-height: 1.85;
}
</style>
